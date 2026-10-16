import type {
  ActionResult, BlameView, BranchesView, ChangeList, CommitDetail, CommitResult, ConflictFile, DiscardResult,
  DiffView, FileHistoryEntry, GitGraphCommit, OperationState, ReflogEntry, RemoteItem, RepoStatus, StashEntry,
  SwitchResult, SyncResult, TagItem, WorktreeItem,
} from '../core/types.js'

export function getEndpointUrl(endpoint: string): string {
  return `/dsh-git/${endpoint.replace(/^\/+/, '')}`
}

export function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return 'Git 请求失败'
}

async function postJson<T>(endpoint: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  // Never retry mutations: a lost response does not mean Git did not execute them.
  const res = await fetch(getEndpointUrl(endpoint), {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal,
  })
  let json: any
  try { json = await res.json() } catch {
    throw new Error(`HTTP ${res.status}: ${res.statusText || '服务器返回了无效响应'}`)
  }
  if (!res.ok || json?.ok === false) {
    const error = new Error(json?.error ? errorMessage(json.error) : `HTTP ${res.status}: ${res.statusText}`)
    if (json?.error?.code) Object.assign(error, { code: json.error.code })
    throw error
  }
  if (json === null || typeof json !== 'object') throw new Error('Git 服务器返回了无效响应')
  return json.value !== undefined ? json.value : json
}

/** One diff request, mirroring the host's `DiffOptions` without importing host types. */
export interface DiffRequest {
  base?: string
  target?: string
  /** `worktree` (default) | `staged` | `range` | `single` (one commit against its parent). */
  mode?: 'worktree' | 'unstaged' | 'staged' | 'range' | 'single'
  /** Repository-relative paths, for lazily loading a single file's diff. */
  files?: string[]
  context?: number
  ignoreWhitespace?: boolean
  includeUntracked?: boolean
}

export interface CommitRequest {
  message?: string
  amend?: boolean
  signoff?: boolean
  all?: boolean
}

export interface PushRequest {
  remote?: string
  branch?: string
  setUpstream?: boolean
  force?: boolean
}

/** Absolute URL of one file's bytes, for inline previews (`<img src>`). */
export function blobUrl(path: string, file: string, stamp?: string): string {
  const params = new URLSearchParams({ path, file })
  if (stamp) params.set('v', stamp)
  return `${getEndpointUrl('blob')}?${params.toString()}`
}

function diffRequest(path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<DiffView> {
  return postJson('diff', body, signal)
}

export const gitApi = {
  getStatus(path: string, signal?: AbortSignal): Promise<RepoStatus> {
    return postJson('status', { path }, signal)
  },
  getBranches(path: string, signal?: AbortSignal): Promise<BranchesView> {
    return postJson('branches', { path }, signal)
  },
  switchBranch(path: string, branch: string): Promise<SwitchResult> {
    return postJson('switch', { path, branch })
  },
  createBranch(path: string, name: string, base?: string): Promise<SwitchResult> {
    return postJson('create-branch', { path, name, base })
  },
  deleteBranch(path: string, name: string, force = false): Promise<ActionResult> {
    return postJson('delete-branch', { path, name, force })
  },
  /**
   * The diff of the whole comparison. The extra `options` keep this call site testable and
   * backwards compatible: the panel asks for one comparison, not one request per section.
   */
  getDiff(path: string, base?: string, target?: string, signal?: AbortSignal, options: Omit<DiffRequest, 'base' | 'target'> = {}): Promise<DiffView> {
    return diffRequest(path, { path, base, target, ...options }, signal)
  },
  /** The same endpoint as {@link getDiff}, with the full option set. */
  requestDiff(path: string, request: DiffRequest = {}, signal?: AbortSignal): Promise<DiffView> {
    return diffRequest(path, { path, ...request }, signal)
  },
  getWorktrees(path: string, signal?: AbortSignal): Promise<WorktreeItem[]> {
    return postJson('worktrees', { path }, signal)
  },
  getWorktreesWithStatus(path: string, signal?: AbortSignal): Promise<WorktreeItem[]> {
    return postJson('worktrees-status', { path }, signal)
  },
  createWorktree(path: string, name: string, base?: string): Promise<{ ok: boolean; path?: string; error?: string }> {
    return postJson('create-worktree', { path, name, base })
  },
  removeWorktree(path: string, worktreePath: string, force = false): Promise<ActionResult> {
    return postJson('remove-worktree', { path, worktreePath, force })
  },
  lockWorktree(path: string, worktreePath: string, reason?: string): Promise<ActionResult> {
    return postJson('lock-worktree', { path, worktreePath, reason })
  },
  unlockWorktree(path: string, worktreePath: string): Promise<ActionResult> {
    return postJson('unlock-worktree', { path, worktreePath })
  },
  pruneWorktrees(path: string, dryRun = false): Promise<ActionResult> {
    return postJson('prune-worktrees', { path, dryRun })
  },
  getLog(path: string, limit = 50, signal?: AbortSignal): Promise<GitGraphCommit[]> {
    return postJson('log', { path, limit }, signal)
  },
  getFileLog(path: string, file: string, limit = 50, signal?: AbortSignal): Promise<GitGraphCommit[]> {
    return postJson('log', { path, file, limit }, signal)
  },
  getCommitDetail(path: string, ref: string, signal?: AbortSignal): Promise<CommitDetail> {
    return postJson('commit-detail', { path, ref }, signal)
  },
  getFileHistory(path: string, file: string, limit = 50, signal?: AbortSignal): Promise<FileHistoryEntry[]> {
    return postJson('file-history', { path, file, limit }, signal)
  },
  getBlame(path: string, file: string, maxLines = 5000, signal?: AbortSignal): Promise<BlameView> {
    return postJson('blame', { path, file, maxLines }, signal)
  },
  getReflog(path: string, limit = 100, signal?: AbortSignal): Promise<ReflogEntry[]> {
    return postJson('reflog', { path, limit }, signal)
  },
  getStashes(path: string, signal?: AbortSignal): Promise<StashEntry[]> {
    return postJson('stashes', { path }, signal)
  },
  getStashDiff(path: string, index: number, signal?: AbortSignal): Promise<DiffView> {
    return postJson('stash-show', { path, index }, signal)
  },
  getTags(path: string, signal?: AbortSignal): Promise<TagItem[]> {
    return postJson('tags', { path }, signal)
  },
  getRemotes(path: string, signal?: AbortSignal): Promise<RemoteItem[]> {
    return postJson('remotes', { path }, signal)
  },
  getOperation(path: string, signal?: AbortSignal): Promise<OperationState> {
    return postJson('operation', { path }, signal)
  },
  getConflicts(path: string, signal?: AbortSignal): Promise<ConflictFile[]> {
    return postJson('conflicts', { path }, signal)
  },
  getChanges(path: string, signal?: AbortSignal): Promise<ChangeList> {
    return postJson('changes', { path }, signal)
  },
  getLastCommitMessage(path: string, signal?: AbortSignal): Promise<string> {
    return postJson('last-commit-message', { path }, signal)
  },

  // ---- working tree ---------------------------------------------------------------
  stage(path: string, files: string[]): Promise<ActionResult> {
    return postJson('stage', { path, files })
  },
  stageAll(path: string): Promise<ActionResult> {
    return postJson('stage-all', { path })
  },
  unstage(path: string, files: string[]): Promise<ActionResult> {
    return postJson('unstage', { path, files })
  },
  unstageAll(path: string): Promise<ActionResult> {
    return postJson('unstage-all', { path })
  },
  discard(path: string, files: string[], staged = false): Promise<DiscardResult> {
    return postJson('discard', { path, files, staged })
  },
  deleteUntracked(path: string, files: string[]): Promise<DiscardResult> {
    return postJson('delete-untracked', { path, files })
  },
  applyPatch(path: string, patch: string, options: { reverse?: boolean; cached?: boolean } = {}): Promise<ActionResult> {
    return postJson('apply-patch', { path, patch, ...options })
  },
  addToGitignore(path: string, files: string[], local = false): Promise<ActionResult & { added?: string[]; skipped?: string[] }> {
    return postJson('write-gitignore', { path, files, local })
  },

  // ---- commit ---------------------------------------------------------------------
  commit(path: string, request: CommitRequest): Promise<CommitResult> {
    return postJson('commit', { path, ...request })
  },
  undoCommit(path: string): Promise<CommitResult> {
    return postJson('undo-commit', { path })
  },
  resetTo(path: string, ref: string, mode: 'soft' | 'mixed' = 'soft'): Promise<ActionResult> {
    return postJson('reset', { path, ref, mode })
  },
  resolveConflict(path: string, file: string, side: 'ours' | 'theirs'): Promise<ActionResult> {
    return postJson('conflict-resolve', { path, file, side })
  },

  // ---- sequencing operations ------------------------------------------------------
  merge(path: string, ref: string): Promise<ActionResult> {
    return postJson('merge', { path, ref })
  },
  rebase(path: string, ref: string): Promise<ActionResult> {
    return postJson('rebase', { path, ref })
  },
  cherryPick(path: string, ref: string): Promise<ActionResult> {
    return postJson('cherry-pick', { path, ref })
  },
  revert(path: string, ref: string): Promise<ActionResult> {
    return postJson('revert', { path, ref })
  },
  operationStep(path: string, step: 'continue' | 'abort' | 'skip'): Promise<ActionResult> {
    return postJson('operation-step', { path, step })
  },

  // ---- remotes --------------------------------------------------------------------
  fetch(path: string, options: { remote?: string; prune?: boolean } = {}): Promise<ActionResult> {
    return postJson('fetch', { path, ...options })
  },
  pull(path: string, options: { mode?: 'ff-only' | 'rebase' | 'merge'; remote?: string; branch?: string } = {}): Promise<SyncResult> {
    return postJson('pull', { path, ...options })
  },
  push(path: string, request: PushRequest = {}): Promise<ActionResult> {
    return postJson('push', { path, ...request })
  },

  // ---- stash and tags --------------------------------------------------------------
  stashPush(path: string, options: { message?: string; includeUntracked?: boolean; keepIndex?: boolean } = {}): Promise<ActionResult> {
    return postJson('stash-push', { path, ...options })
  },
  stashApply(path: string, index: number, pop = false): Promise<ActionResult> {
    return postJson('stash-apply', { path, index, pop })
  },
  stashDrop(path: string, index: number): Promise<ActionResult> {
    return postJson('stash-drop', { path, index })
  },
  tagCreate(path: string, name: string, options: { ref?: string; message?: string } = {}): Promise<ActionResult> {
    return postJson('tag-create', { path, name, ...options })
  },
  tagDelete(path: string, name: string): Promise<ActionResult> {
    return postJson('tag-delete', { path, name })
  },

  /** Opens a repository-relative file (or the repository itself) in the user's editor. */
  openInEditor(path: string, file?: string, line?: number): Promise<{ ok: boolean; editor?: string; target?: string; error?: string }> {
    return postJson('open-in-editor', { path, file, line })
  },
  /** Shows the file (or the repository folder) in the platform file manager. */
  reveal(path: string, file?: string): Promise<{ ok: boolean; target?: string; error?: string }> {
    return postJson('reveal', { path, file })
  },
  subscribeEvents(path: string, onStatus: (status: RepoStatus) => void, onError?: (error: Error) => void): () => void {
    if (typeof EventSource === 'undefined') return () => {}
    let source: EventSource
    try {
      source = new EventSource(`${getEndpointUrl('events')}?path=${encodeURIComponent(path)}`)
    } catch (error) {
      onError?.(new Error(errorMessage(error)))
      return () => {}
    }
    source.addEventListener('status', (event: MessageEvent) => {
      try { onStatus(JSON.parse(event.data)) } catch (error) { onError?.(new Error(errorMessage(error))) }
    })
    source.addEventListener('status-error', (event: MessageEvent) => {
      try { onError?.(new Error(errorMessage(JSON.parse(event.data).error))) }
      catch { onError?.(new Error('Git 状态更新失败')) }
    })
    source.onerror = () => onError?.(new Error('Git 实时连接中断，正在重连'))
    return () => source.close()
  },
}
