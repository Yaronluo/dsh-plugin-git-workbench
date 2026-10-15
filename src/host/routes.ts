import type { IncomingMessage, ServerResponse } from 'node:http'
import type { GitService } from './git-service.js'

interface Group {
  path: string
  subscribers: Set<ServerResponse>
  inFlight: boolean
}

function badRequest(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 400 })
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let failed = false
    req.on('data', chunk => {
      size += Buffer.byteLength(chunk)
      if (size > 64 * 1024) { failed = true; reject(badRequest('Request body is too large')); return }
      if (!failed) chunks.push(Buffer.from(chunk))
    })
    req.on('end', () => {
      if (failed) return
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error()
        resolve(payload)
      } catch { reject(badRequest('A JSON object is required')) }
    })
    req.on('error', reject)
    req.on('aborted', () => reject(badRequest('Request aborted')))
  })
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.destroyed || res.writableEnded) return
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}

function stringField(payload: Record<string, any>, key: string, optional = false): string | undefined {
  const value = payload[key]
  if (optional && value === undefined) return undefined
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw badRequest(`${key} must be a non-empty string`)
  return value
}

export function registerRoutes(ctx: any, service: GitService, options: { pollIntervalMs?: number } = {}): () => void {
  const groups = new Map<string, Group>()
  const lastSent = new WeakMap<ServerResponse, string>()
  let stopped = false
  let heartbeatTimer: NodeJS.Timeout | undefined
  let pollTimer: NodeJS.Timeout | undefined

  const send = (res: ServerResponse, event: string, payload: unknown) => {
    if (stopped || res.destroyed || res.writableEnded) return
    // Bound memory for a disconnected/slow EventSource instead of queueing forever.
    if (res.writableLength > 1024 * 1024) { res.destroy(); return }
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
  }
  const pollGroup = async (group: Group) => {
    if (stopped || group.inFlight || !group.subscribers.size) return
    group.inFlight = true
    try {
      const status = await service.status(group.path)
      const key = JSON.stringify(status) // Includes content revision, conflicts, upstream and operation state.
      for (const res of group.subscribers) {
        if (lastSent.get(res) === key) continue
        send(res, 'status', status)
        lastSent.set(res, key)
      }
    } catch (error: any) {
      for (const res of group.subscribers) {
        send(res, 'status-error', { error: error?.message || 'Git status failed' })
        lastSent.delete(res) // A recovery frame clears the visible error even if status is unchanged.
      }
    } finally { group.inFlight = false }
  }
  const poll = () => { for (const group of groups.values()) void pollGroup(group) }
  const stopTimersWhenEmpty = () => {
    if (groups.size) return
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    if (pollTimer) clearInterval(pollTimer)
    heartbeatTimer = pollTimer = undefined
  }

  const sseHandler = (req: IncomingMessage, res: ServerResponse, url: URL) => {
    if (req.method !== 'GET') { writeJson(res, 405, { ok: false, error: 'Method Not Allowed' }); return }
    const path = stringField({ path: url.searchParams.get('path') }, 'path')!
    const count = [...groups.values()].reduce((n, g) => n + g.subscribers.size, 0)
    if (count >= 100) { writeJson(res, 503, { ok: false, error: 'Too many Git subscribers' }); return }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    })
    res.write(': connected\n\n')
    let group = groups.get(path)
    if (!group) { group = { path, subscribers: new Set(), inFlight: false }; groups.set(path, group) }
    group.subscribers.add(res)
    const currentGroup = group
    res.once('close', () => {
      currentGroup.subscribers.delete(res)
      if (!currentGroup.subscribers.size && groups.get(path) === currentGroup) groups.delete(path)
      stopTimersWhenEmpty()
    })
    void pollGroup(group)
    if (!heartbeatTimer) heartbeatTimer = setInterval(() => {
      for (const g of groups.values()) for (const target of g.subscribers) {
        if (!target.destroyed && !target.writableEnded) target.write(': ping\n\n')
      }
    }, 15000)
    if (!pollTimer) pollTimer = setInterval(poll, options.pollIntervalMs ?? 3000)
  }

  const apiHandler = async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (url.pathname === '/dsh-git/events') { sseHandler(req, res, url); return }
      if (req.method !== 'POST') { writeJson(res, 405, { ok: false, error: 'Method Not Allowed' }); return }
      const payload = await readJsonBody(req)
      // A missing cwd is an error, never authority to modify the first workspace.
      const path = stringField(payload, 'path')!
      const required = (name: string) => stringField(payload, name)!
      const optional = (name: string) => stringField(payload, name, true)
      switch (url.pathname) {
        case '/dsh-git/status': writeJson(res, 200, { ok: true, value: await service.status(path) }); return
        case '/dsh-git/branches': writeJson(res, 200, { ok: true, value: await service.branches(path) }); return
        case '/dsh-git/switch': writeJson(res, 200, await service.switchBranch(path, required('branch'))); return
        case '/dsh-git/create-branch': writeJson(res, 200, await service.createBranch(path, required('name'), optional('base'))); return
        case '/dsh-git/diff': writeJson(res, 200, { ok: true, value: await service.diff(path, optional('base'), optional('target')) }); return
        case '/dsh-git/worktrees': writeJson(res, 200, { ok: true, value: await service.worktrees(path) }); return
        case '/dsh-git/create-worktree': writeJson(res, 200, await service.createWorktree(path, required('name'), optional('base'))); return
        case '/dsh-git/remove-worktree': writeJson(res, 200, await service.removeWorktree(path, required('worktreePath'))); return
        case '/dsh-git/log': {
          if (payload.limit !== undefined && (!Number.isInteger(payload.limit) || payload.limit < 1 || payload.limit > 500)) throw badRequest('limit must be between 1 and 500')
          writeJson(res, 200, { ok: true, value: await service.log(path, payload.limit) }); return
        }
        default: writeJson(res, 404, { ok: false, error: 'Not found' })
      }
    } catch (error: any) {
      writeJson(res, error?.statusCode === 400 ? 400 : 500, { ok: false, error: error?.message || 'Internal Error' })
    }
  }
  if (!ctx.webServer?.register) throw new Error('Git plugin requires webServer.register')
  const unregister = ctx.webServer.register({ kind: 'prefix', path: '/dsh-git', handler: apiHandler })
  return () => {
    stopped = true
    unregister()
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    if (pollTimer) clearInterval(pollTimer)
    for (const group of groups.values()) for (const res of group.subscribers) res.end()
    groups.clear()
  }
}
