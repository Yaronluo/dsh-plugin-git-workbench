export type WorkbenchCompareTarget = 'working-head' | 'branch-upstream'
export type WorkbenchCompareScope = 'all' | 'unstaged' | 'staged'

/** Only non-dangerous, lightweight UI state survives an unmount. Diff payloads and actions do not. */
export interface WorkbenchUiState {
  selectedFile: string | null
  compareTarget: WorkbenchCompareTarget
  compareScope: WorkbenchCompareScope
  focusedFile: { cwd: string; path: string } | null
  commitMessage: string
  fileListScrollTop: number
  diffScrollTop: number
}

export const MAX_WORKBENCH_UI_STATES = 32

const cache = new Map<string, WorkbenchUiState>()

type SessionId = string | number | null | undefined

function cacheKey(sessionId: SessionId, cwd: string): string | null {
  if (!cwd || sessionId == null || sessionId === '') return null
  return JSON.stringify([String(sessionId), cwd])
}

/** Copy just the allow-listed UI fields; runtime extras such as busy/amend/diff never enter the cache. */
function copyUiState(state: WorkbenchUiState): WorkbenchUiState {
  return {
    selectedFile: typeof state.selectedFile === 'string' ? state.selectedFile : null,
    compareTarget: state.compareTarget === 'branch-upstream' ? 'branch-upstream' : 'working-head',
    compareScope: state.compareScope === 'staged' || state.compareScope === 'unstaged' ? state.compareScope : 'all',
    focusedFile: state.focusedFile && typeof state.focusedFile.cwd === 'string' && typeof state.focusedFile.path === 'string'
      ? { cwd: state.focusedFile.cwd, path: state.focusedFile.path }
      : null,
    commitMessage: typeof state.commitMessage === 'string' ? state.commitMessage : '',
    fileListScrollTop: Number.isFinite(state.fileListScrollTop) ? Math.max(0, state.fileListScrollTop) : 0,
    diffScrollTop: Number.isFinite(state.diffScrollTop) ? Math.max(0, state.diffScrollTop) : 0,
  }
}

/** Reads and promotes a snapshot in the bounded in-memory LRU. */
export function readWorkbenchUiState(sessionId: SessionId, cwd: string): WorkbenchUiState | null {
  const key = cacheKey(sessionId, cwd)
  if (!key) return null
  const state = cache.get(key)
  if (!state) return null
  cache.delete(key)
  cache.set(key, state)
  return copyUiState(state)
}

/** Stores no more than the allow-listed UI fields for one session/repository pair. */
export function writeWorkbenchUiState(sessionId: SessionId, cwd: string, state: WorkbenchUiState): void {
  const key = cacheKey(sessionId, cwd)
  if (!key) return
  cache.delete(key)
  cache.set(key, copyUiState(state))
  while (cache.size > MAX_WORKBENCH_UI_STATES) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}
