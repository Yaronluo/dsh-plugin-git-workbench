import type { IncomingMessage, ServerResponse } from 'node:http'
import type { GitService } from './git-service.js'

interface Subscriber {
  path: string
  last: string
  res: ServerResponse
}

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(Buffer.from(chunk)))
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf-8')
        resolve(text ? JSON.parse(text) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}

export function registerRoutes(ctx: any, service: GitService): () => void {
  const subscribers = new Set<Subscriber>()
  let heartbeatTimer: NodeJS.Timeout | undefined
  let pollTimer: NodeJS.Timeout | undefined

  const runPoll = async () => {
    for (const sub of subscribers) {
      try {
        const status = await service.status(sub.path)
        const key = `${status.isGit}|${status.branch}|${status.head}|${status.dirtyFiles}`
        if (key !== sub.last) {
          sub.last = key
          sub.res.write(`event: status\ndata: ${JSON.stringify(status)}\n\n`)
        }
      } catch {
        // Ignore background polling errors
      }
    }
  }

  const sseHandler = (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.searchParams.get('path') || ''

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })
    res.write(': connected\n\n')

    const sub: Subscriber = { path, last: '', res }
    subscribers.add(sub)

    // Initial push
    service.status(path).then(status => {
      sub.last = `${status.isGit}|${status.branch}|${status.head}|${status.dirtyFiles}`
      sub.res.write(`event: status\ndata: ${JSON.stringify(status)}\n\n`)
    }).catch(() => {})

    if (!heartbeatTimer) {
      heartbeatTimer = setInterval(() => {
        for (const s of subscribers) s.res.write(': ping\n\n')
      }, 15000)
    }

    if (!pollTimer) {
      pollTimer = setInterval(runPoll, 10000)
    }

    req.on('close', () => {
      subscribers.delete(sub)
      if (subscribers.size === 0) {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer)
          heartbeatTimer = undefined
        }
        if (pollTimer) {
          clearInterval(pollTimer)
          pollTimer = undefined
        }
      }
    })
  }

  const apiHandler = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const pathname = url.pathname

    if (pathname === '/dsh-git/events') {
      return sseHandler(req, res)
    }

    if (req.method !== 'POST') {
      res.writeHead(405)
      res.end('Method Not Allowed')
      return
    }

    let payload: any = {}
    try {
      payload = await readJsonBody(req)
    } catch {
      writeJson(res, 400, { ok: false, error: 'Invalid JSON' })
      return
    }

    const path = payload.path
    if (!path && pathname !== '/dsh-git/health') {
      writeJson(res, 400, { ok: false, error: 'Path is required' })
      return
    }

    try {
      switch (pathname) {
        case '/dsh-git/status': {
          const status = await service.status(path)
          writeJson(res, 200, { ok: true, value: status })
          return
        }
        case '/dsh-git/branches': {
          const branches = await service.branches(path)
          writeJson(res, 200, { ok: true, value: branches })
          return
        }
        case '/dsh-git/switch': {
          const result = await service.switchBranch(path, payload.branch)
          writeJson(res, 200, result)
          return
        }
        case '/dsh-git/create-branch': {
          const result = await service.createBranch(path, payload.name, payload.base)
          writeJson(res, 200, result)
          return
        }
        case '/dsh-git/diff': {
          const diff = await service.diff(path, payload.base, payload.target)
          writeJson(res, 200, { ok: true, value: diff })
          return
        }
        case '/dsh-git/worktrees': {
          const list = await service.worktrees(path)
          writeJson(res, 200, { ok: true, value: list })
          return
        }
        case '/dsh-git/create-worktree': {
          const result = await service.createWorktree(path, payload.name, payload.base)
          writeJson(res, 200, result)
          return
        }
        case '/dsh-git/remove-worktree': {
          const result = await service.removeWorktree(path, payload.worktreePath)
          writeJson(res, 200, result)
          return
        }
        case '/dsh-git/log': {
          const list = await service.log(path, payload.limit)
          writeJson(res, 200, { ok: true, value: list })
          return
        }
        default:
          writeJson(res, 404, { ok: false, error: 'Not found' })
      }
    } catch (err: any) {
      writeJson(res, 500, { ok: false, error: err?.message || 'Internal Error' })
    }
  }

  // Register with webServer
  const disposers: (() => void)[] = []
  if (ctx.webServer && typeof ctx.webServer.register === 'function') {
    disposers.push(
      ctx.webServer.register({ kind: 'prefix', path: '/dsh-git', handler: apiHandler })
    )
  }

  return () => {
    for (const d of disposers) d()
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    if (pollTimer) clearInterval(pollTimer)
    for (const sub of subscribers) sub.res.end()
    subscribers.clear()
  }
}
