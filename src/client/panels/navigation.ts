/** Native conversation.view identity, displayed beside Chat / Trajectory / Context. */
export const GIT_CONVERSATION_VIEW = 'dsh-plugin-git'
export const GIT_WORKBENCH_TITLE = 'Git'

/**
 * The pages inside that single tab. `changes`, `history`, `stashes` and `worktrees`
 * are the persistent pages of the navigation strip; `create-branch` /
 * `create-worktree` are inline forms the strip's action buttons switch to.
 */
export const GIT_PANEL_VIEWS = ['changes', 'history', 'stashes', 'create-branch', 'create-worktree', 'worktrees'] as const
export type GitPanelView = (typeof GIT_PANEL_VIEWS)[number]

export const GIT_PANEL_TITLES: Record<GitPanelView, string> = {
  changes: '变更', history: '提交记录', stashes: '储藏', 'create-branch': '创建分支',
  'create-worktree': '创建工作树', worktrees: '工作树',
}

export function isGitPanelView(value: unknown): value is GitPanelView {
  return typeof value === 'string' && (GIT_PANEL_VIEWS as readonly string[]).includes(value)
}

/**
 * The strip's landings, in order. `primary` entries are pages; the rest are
 * actions that open an inline form (and return to `primary` while submitting).
 */
export const GIT_VIEW_ENTRIES: readonly { view: GitPanelView; primary: boolean }[] = [
  { view: 'changes', primary: true },
  { view: 'history', primary: true },
  { view: 'stashes', primary: true },
  { view: 'worktrees', primary: true },
  { view: 'create-branch', primary: false },
  { view: 'create-worktree', primary: false },
]

/** `mapKey` identifies one panel instance: a session may sit in several repositories. */
const VIEW_BY_KEY = new Map<string, GitPanelView>()
const listeners = new Set<() => void>()

function mapKey(sessionId?: string, cwd?: string): string {
  return `${sessionId || ''}\u0000${cwd || ''}`
}

/**
 * The view is held per (session, repository) in a store the panel OBSERVES, not
 * in tab meta alone: focusing an already-open tab does not re-navigate it, so a
 * meta-only restore could not switch the page of a panel the user is looking at.
 */
export function activeGitView(sessionId?: string, cwd?: string, fallback: GitPanelView = 'changes'): GitPanelView {
  return VIEW_BY_KEY.get(mapKey(sessionId, cwd)) ?? fallback
}

export function setActiveGitView(sessionId: string | undefined, cwd: string | undefined, view: GitPanelView): void {
  const key = mapKey(sessionId, cwd)
  if (VIEW_BY_KEY.get(key) === view) return
  VIEW_BY_KEY.set(key, view)
  for (const listener of [...listeners]) listener()
}

export function subscribeGitView(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Registration failures must be visible to shortcut buttons, not silently ignored. */
let registrationError = ''
export function noteGitViewError(message: string): void { registrationError = message }
export function gitViewError(): string { return registrationError }

type SessionNavigator = { cwd: string; select: (view: string) => void }
const navigators = new Map<string, SessionNavigator>()
const navigationListeners = new Set<() => void>()

function samePath(left: string, right: string): boolean {
  const normalize = (path: string) => {
    const value = path.replace(/\\/g, '/').replace(/\/$/, '')
    return /^[a-z]:\//i.test(value) || value.startsWith('//') ? value.toLowerCase() : value
  }
  return normalize(left) === normalize(right)
}

/** The native header's scoped store is shared, not copied or replaced. */
export function bindGitSessionNavigator(sessionId: string, navigator: SessionNavigator): () => void {
  navigators.set(sessionId, navigator)
  for (const listener of [...navigationListeners]) listener()
  return () => { if (navigators.get(sessionId) === navigator) navigators.delete(sessionId) }
}

/** Wait for a just-created workspace's native Session header to mount. No DOM polling. */
export function openGitSessionView(sessionId: string, cwd: string, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (error?: Error) => {
      if (timer) clearTimeout(timer)
      navigationListeners.delete(check)
      if (error) reject(error)
      else resolve()
    }
    const check = () => {
      const navigator = navigators.get(sessionId)
      if (!navigator) return
      if (!samePath(navigator.cwd, cwd)) { finish(new Error('会话的仓库目录已改变，请重新打开 Git 工作台')); return }
      try { navigator.select(GIT_CONVERSATION_VIEW); finish() }
      catch (error) { finish(error instanceof Error ? error : new Error(String(error))) }
    }
    navigationListeners.add(check)
    timer = setTimeout(() => finish(new Error(gitViewError() || 'Git 会话标签尚未就绪，请重新打开会话后重试')), timeoutMs)
    check()
  })
}
