import type { IncomingMessage, ServerResponse } from 'node:http'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DiffOptions, GitService } from './git-service.js'
import { createEditorLauncher, type EditorLauncher } from './editor-launcher.js'

interface Group {
  path: string
  subscribers: Set<ServerResponse>
  inFlight: boolean
}

/** Patches can legitimately be megabytes; every other body stays small. */
const DEFAULT_BODY_LIMIT = 64 * 1024
const BODY_LIMITS: Record<string, number> = {
  '/dsh-git/apply-patch': 8 * 1024 * 1024,
  '/dsh-git/commit': 256 * 1024,
  '/dsh-git/stash-push': 256 * 1024,
  '/dsh-git/tag-create': 256 * 1024,
}
/** A path list from the UI: bounded so one request cannot enqueue unbounded work. */
const MAX_LIST_ITEMS = 5000

function badRequest(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 400 })
}

function readJsonBody(req: IncomingMessage, limit = DEFAULT_BODY_LIMIT): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let failed = false
    req.on('data', chunk => {
      size += Buffer.byteLength(chunk)
      if (size > limit) { failed = true; reject(badRequest('Request body is too large')); return }
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
  if (optional && (value === undefined || value === null || value === '')) return undefined
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw badRequest(`${key} must be a non-empty string`)
  return value
}

/** A list of non-empty strings: file paths for stage/discard, never a bare string. */
function stringList(payload: Record<string, any>, key: string, optional = false): string[] | undefined {
  const value = payload[key]
  if (value === undefined || value === null) {
    if (optional) return undefined
    throw badRequest(`${key} must be an array of strings`)
  }
  if (!Array.isArray(value) || value.length === 0) throw badRequest(`${key} must be a non-empty array of strings`)
  if (value.length > MAX_LIST_ITEMS) throw badRequest(`${key} has too many items`)
  return value.map(item => {
    if (typeof item !== 'string' || !item.trim() || item.includes('\0')) throw badRequest(`${key} must contain non-empty strings`)
    return item
  })
}

function integerField(payload: Record<string, any>, key: string, min: number, max: number): number | undefined {
  const value = payload[key]
  if (value === undefined || value === null) return undefined
  if (!Number.isInteger(value) || value < min || value > max) throw badRequest(`${key} must be an integer between ${min} and ${max}`)
  return value
}

function enumField<T extends string>(payload: Record<string, any>, key: string, allowed: readonly T[], fallback: T): T
function enumField<T extends string>(payload: Record<string, any>, key: string, allowed: readonly T[]): T | undefined
function enumField<T extends string>(payload: Record<string, any>, key: string, allowed: readonly T[], fallback?: T): T | undefined {
  const value = payload[key]
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw badRequest(`${key} must be one of ${allowed.join(', ')}`)
  return value as T
}

function requiredEnumField<T extends string>(payload: Record<string, any>, key: string, allowed: readonly T[]): T {
  const value = enumField(payload, key, allowed)
  if (value === undefined) throw badRequest(`${key} is required`)
  return value
}

function booleanField(payload: Record<string, any>, key: string): boolean | undefined {
  const value = payload[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'boolean') throw badRequest(`${key} must be a boolean`)
  return value
}

/**
 * DSH's own "open this path" capability, when the host is a desktop session.
 *
 * `sessionController` is looked up instead of injected so a headless host still loads the
 * plugin; without it the launcher falls back to the platform shell.
 */
function nativePathOpener(ctx: any): (absolutePath: string) => Promise<void> {
  return async (absolutePath: string) => {
    const controller = ctx?.get?.('sessionController')
    if (!controller?.openWorkspacePath) throw new Error('DSH 未提供系统打开能力')
    if (typeof controller.canOpenWorkspacePath === 'function' && !(await controller.canOpenWorkspacePath())) {
      throw new Error('当前环境无法打开本地文件')
    }
    await controller.openWorkspacePath({ path: absolutePath })
  }
}

/**
 * Where the client's self-report lands.
 *
 * The renderer cannot tell the host which bundle it executed, so it posts the measurable
 * facts and the host stores them for inspection. Diagnostics only; no UI depends on it.
 */
export function clientReportPath(source = 'client'): string {
  const safe = String(source).replace(/[^a-z0-9_-]/gi, '') || 'client'
  return join(tmpdir(), `dsh-plugin-git-client-report-${safe}.json`)
}

export function registerRoutes(
  ctx: any,
  service: GitService,
  options: { pollIntervalMs?: number; editorLauncher?: EditorLauncher } = {},
): () => void {
  const editor = options.editorLauncher ?? createEditorLauncher({ openNatively: nativePathOpener(ctx) })
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

  /**
   * Serves one file's bytes so the panel can show an image diff inline. Read-only, and the
   * service restricts it to paths Git already knows, so it cannot walk the disk.
   */
  const blobHandler = async (req: IncomingMessage, res: ServerResponse, url: URL) => {
    if (req.method !== 'GET') { writeJson(res, 405, { ok: false, error: 'Method Not Allowed' }); return }
    try {
      const path = stringField({ path: url.searchParams.get('path') }, 'path')!
      const file = stringField({ file: url.searchParams.get('file') }, 'file')!
      const blob = await service.readBlob(path, file)
      if (!blob.ok || !blob.bytes) { writeJson(res, 404, { ok: false, error: blob.error || 'File is not readable' }); return }
      res.writeHead(200, {
        'Content-Type': blob.type || 'application/octet-stream',
        'Content-Length': blob.bytes.byteLength,
        // Repository SVGs are untrusted active documents when opened directly. Keep
        // image previews usable without granting scripts the DSH origin's authority.
        'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'",
        'X-Content-Type-Options': 'nosniff',
        // The URL carries the repository revision, so a stale image is never reused.
        'Cache-Control': 'no-store',
      })
      res.end(blob.bytes)
    } catch (error: any) {
      writeJson(res, error?.statusCode === 400 ? 400 : 500, { ok: false, error: error?.message || 'Blob read failed' })
    }
  }

  const apiHandler = async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (url.pathname === '/dsh-git/events') { sseHandler(req, res, url); return }
      if (url.pathname === '/dsh-git/blob') { await blobHandler(req, res, url); return }
      if (req.method !== 'POST') { writeJson(res, 405, { ok: false, error: 'Method Not Allowed' }); return }
      const payload = await readJsonBody(req, BODY_LIMITS[url.pathname] ?? DEFAULT_BODY_LIMIT)
      if (url.pathname === '/dsh-git/client-report') {
        // Deliberately before the required `path`: a report arrives with no repository.
        const source = stringField(payload, 'source', true) || 'client'
        try {
          writeFileSync(clientReportPath(source), JSON.stringify(payload, null, 2), 'utf-8')
          ctx.logger?.info?.(`[dsh-plugin-git] client report (${source}): ${JSON.stringify(payload)}`)
        } catch { /* diagnostics must never fail the request */ }
        writeJson(res, 200, { ok: true })
        return
      }
      if (url.pathname === '/dsh-git/editors') {
        // Machine-level, like a report: the picker asks which editors this machine has, so
        // this deliberately runs before the required `path`.
        writeJson(res, 200, { ok: true, value: await editor.listEditors() })
        return
      }
      // A missing cwd is an error, never authority to modify the first workspace.
      const path = stringField(payload, 'path')!
      const required = (name: string) => stringField(payload, name)!
      const optional = (name: string) => stringField(payload, name, true)
      /** Reads answer with `{ ok, value }`; mutations answer with the service's own result. */
      const value = async (read: () => Promise<unknown>) => { writeJson(res, 200, { ok: true, value: await read() }) }

      switch (url.pathname) {
        // ---- reads -----------------------------------------------------------------
        case '/dsh-git/status': await value(() => service.status(path)); return
        case '/dsh-git/branches': await value(() => service.branches(path)); return
        case '/dsh-git/changes': await value(() => service.changes(path)); return
        case '/dsh-git/diff': {
          const diffOptions: DiffOptions = {
            mode: enumField(payload, 'mode', ['worktree', 'unstaged', 'staged', 'range', 'single'] as const),
            paths: stringList(payload, 'files', true),
            ignoreWhitespace: booleanField(payload, 'ignoreWhitespace'),
            context: integerField(payload, 'context', 0, 50),
            includeUntracked: booleanField(payload, 'includeUntracked'),
          }
          await value(() => service.diff(path, optional('base'), optional('target'), diffOptions)); return
        }
        case '/dsh-git/log':
          await value(() => service.log(path, integerField(payload, 'limit', 1, 500) ?? 50, {
            path: optional('file'), all: booleanField(payload, 'all'), skip: integerField(payload, 'skip', 0, 100000),
          })); return
        case '/dsh-git/commit-detail': await value(() => service.commitDetail(path, required('ref'))); return
        case '/dsh-git/file-history': await value(() => service.fileHistory(path, required('file'), integerField(payload, 'limit', 1, 500) ?? 50)); return
        case '/dsh-git/blame': await value(() => service.blame(path, required('file'), integerField(payload, 'maxLines', 1, 50000) ?? 5000)); return
        case '/dsh-git/reflog': await value(() => service.reflog(path, integerField(payload, 'limit', 1, 1000) ?? 100)); return
        case '/dsh-git/stashes': await value(() => service.stashes(path)); return
        case '/dsh-git/stash-show': await value(() => service.stashShow(path, integerField(payload, 'index', 0, 10000) ?? 0)); return
        case '/dsh-git/tags': await value(() => service.tags(path)); return
        case '/dsh-git/remotes': await value(() => service.remotes(path)); return
        case '/dsh-git/operation': await value(() => service.operationState(path)); return
        case '/dsh-git/conflicts': await value(() => service.conflicts(path)); return
        case '/dsh-git/worktrees': await value(() => service.worktrees(path)); return
        case '/dsh-git/worktrees-status': await value(() => service.worktreesWithStatus(path)); return
        case '/dsh-git/last-commit-message': await value(() => service.lastCommitMessage(path)); return

        // ---- working tree ----------------------------------------------------------
        case '/dsh-git/stage': writeJson(res, 200, await service.stage(path, stringList(payload, 'files'))); return
        case '/dsh-git/stage-all': writeJson(res, 200, await service.stageAll(path)); return
        case '/dsh-git/unstage': writeJson(res, 200, await service.unstage(path, stringList(payload, 'files'))); return
        case '/dsh-git/unstage-all': writeJson(res, 200, await service.unstageAll(path)); return
        case '/dsh-git/discard':
          writeJson(res, 200, await service.discard(path, stringList(payload, 'files'), { staged: booleanField(payload, 'staged') })); return
        case '/dsh-git/delete-untracked': writeJson(res, 200, await service.deleteUntracked(path, stringList(payload, 'files'))); return
        case '/dsh-git/apply-patch': {
          const patch = required('patch')
          writeJson(res, 200, await service.applyPatch(path, patch, {
            reverse: booleanField(payload, 'reverse'), cached: booleanField(payload, 'cached'),
          })); return
        }
        case '/dsh-git/write-gitignore':
          writeJson(res, 200, await service.addToIgnore(path, stringList(payload, 'files'), { local: booleanField(payload, 'local') })); return

        // ---- commit ----------------------------------------------------------------
        case '/dsh-git/commit':
          writeJson(res, 200, await service.createCommit(path, {
            message: optional('message'),
            amend: booleanField(payload, 'amend'),
            signoff: booleanField(payload, 'signoff'),
            all: booleanField(payload, 'all'),
          })); return
        case '/dsh-git/undo-commit': writeJson(res, 200, await service.undoLastCommit(path)); return
        case '/dsh-git/reset':
          writeJson(res, 200, await service.reset(path, required('ref'), enumField(payload, 'mode', ['soft', 'mixed'] as const, 'soft'))); return
        case '/dsh-git/conflict-resolve':
          writeJson(res, 200, await service.resolveConflict(path, required('file'), requiredEnumField(payload, 'side', ['ours', 'theirs'] as const))); return

        // ---- sequencing operations -------------------------------------------------
        case '/dsh-git/merge': writeJson(res, 200, await service.merge(path, required('ref'))); return
        case '/dsh-git/rebase': writeJson(res, 200, await service.rebase(path, required('ref'))); return
        case '/dsh-git/cherry-pick': writeJson(res, 200, await service.cherryPick(path, required('ref'))); return
        case '/dsh-git/revert': writeJson(res, 200, await service.revert(path, required('ref'))); return
        case '/dsh-git/operation-step':
          writeJson(res, 200, await service.operationStep(path, requiredEnumField(payload, 'step', ['continue', 'abort', 'skip'] as const))); return

        // ---- remotes and sync ------------------------------------------------------
        case '/dsh-git/fetch': writeJson(res, 200, await service.fetch(path, { remote: optional('remote'), prune: booleanField(payload, 'prune') })); return
        case '/dsh-git/pull':
          writeJson(res, 200, await service.pull(path, {
            mode: enumField(payload, 'mode', ['ff-only', 'rebase', 'merge'] as const),
            remote: optional('remote'), branch: optional('branch'),
          })); return
        case '/dsh-git/push': {
          const force = booleanField(payload, 'force')
          writeJson(res, 200, await service.push(path, {
            remote: optional('remote'), branch: optional('branch'),
            setUpstream: booleanField(payload, 'setUpstream'),
            // Force is always the leasing form, so a push that lost a race is rejected
            // instead of overwriting someone else's commit.
            force: force === undefined ? undefined : force ? 'with-lease' : false,
          })); return
        }

        // ---- stash, tags, branches -------------------------------------------------
        case '/dsh-git/stash-push':
          writeJson(res, 200, await service.stashPush(path, {
            message: optional('message'),
            includeUntracked: booleanField(payload, 'includeUntracked'),
            keepIndex: booleanField(payload, 'keepIndex'),
          })); return
        case '/dsh-git/stash-apply': writeJson(res, 200, await service.stashApply(path, integerField(payload, 'index', 0, 10000) ?? 0, { pop: booleanField(payload, 'pop') })); return
        case '/dsh-git/stash-drop': writeJson(res, 200, await service.stashDrop(path, integerField(payload, 'index', 0, 10000) ?? 0)); return
        case '/dsh-git/tag-create': writeJson(res, 200, await service.tagCreate(path, required('name'), { ref: optional('ref'), message: optional('message') })); return
        case '/dsh-git/tag-delete': writeJson(res, 200, await service.tagDelete(path, required('name'))); return
        case '/dsh-git/switch': writeJson(res, 200, await service.switchBranch(path, required('branch'))); return
        case '/dsh-git/create-branch': writeJson(res, 200, await service.createBranch(path, required('name'), optional('base'))); return
        case '/dsh-git/delete-branch': writeJson(res, 200, await service.deleteBranch(path, required('name'), booleanField(payload, 'force'))); return

        // ---- worktrees -------------------------------------------------------------
        case '/dsh-git/create-worktree': writeJson(res, 200, await service.createWorktree(path, required('name'), optional('base'))); return
        case '/dsh-git/remove-worktree':
          writeJson(res, 200, await service.removeWorktree(path, required('worktreePath'), { force: booleanField(payload, 'force') })); return
        case '/dsh-git/lock-worktree':
          writeJson(res, 200, await service.lockWorktree(path, required('worktreePath'), optional('reason'))); return
        case '/dsh-git/unlock-worktree': writeJson(res, 200, await service.unlockWorktree(path, required('worktreePath'))); return
        case '/dsh-git/prune-worktrees': writeJson(res, 200, await service.pruneWorktrees(path, { dryRun: booleanField(payload, 'dryRun') })); return

        // ---- opening files outside the app -----------------------------------------
        case '/dsh-git/open-in-editor': {
          // Opens the user's own editor. A refusal (path outside the repo, deleted
          // file) is reported as ok:false so the panel can show why nothing opened.
          // `editor` is the picker's choice; without it the launcher probes by itself.
          if (payload.line !== undefined && (!Number.isInteger(payload.line) || payload.line < 1)) throw badRequest('line must be a positive integer')
          writeJson(res, 200, await editor.open({ repo: path, file: optional('file'), line: payload.line }, optional('editor'))); return
        }
        case '/dsh-git/reveal': writeJson(res, 200, await editor.reveal({ repo: path, file: optional('file') })); return

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
