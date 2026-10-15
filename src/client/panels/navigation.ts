/**
 * The one native sidebar tab every Git page lives in. One tab, one launcher entry.
 *
 * The id must stay namespaced and unique: `betterSidebar.registerTab` throws
 * `tab type "..." already registered` on a duplicate, and the sidebar already owns
 * the plain ids `editor`, `git`, `subagent`, `sidechat`, `terminal-bottom` and
 * `diff` (its built-in `git` tab is the unified 变更 page). Registering as `git`
 * silently lost this tab and left the launcher with no Git entry at all.
 */
export const GIT_SIDEBAR_TYPE = 'dsh-plugin-git'
export const GIT_SIDEBAR_TITLE = 'Git'

/**
 * The pages inside that single tab. `changes`, `history` and `worktrees` are the
 * persistent pages of the navigation strip; `create-branch` / `create-worktree`
 * are inline forms the strip's action buttons switch to.
 */
export const GIT_PANEL_VIEWS = ['changes', 'history', 'create-branch', 'create-worktree', 'worktrees'] as const
export type GitPanelView = (typeof GIT_PANEL_VIEWS)[number]

export const GIT_PANEL_TITLES: Record<GitPanelView, string> = {
  changes: '变更', history: '提交记录', 'create-branch': '创建分支',
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

/**
 * Why `registerTab` refused this tab, when it did. The launcher would simply show
 * no Git entry at all otherwise, which reads as "the plugin is not installed".
 */
let registrationError = ''

export function noteGitSidebarError(message: string): void {
  registrationError = message
}

export function gitSidebarError(): string {
  return registrationError
}
