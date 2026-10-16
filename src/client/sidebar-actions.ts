import {
  GIT_PANEL_TITLES, GIT_PANEL_VIEWS, GIT_CONVERSATION_VIEW, GIT_WORKBENCH_TITLE, gitViewError, isGitPanelView,
  openGitSessionView, setActiveGitView, type GitPanelView,
} from './panels/navigation.js'

export { GIT_PANEL_TITLES, GIT_PANEL_VIEWS, GIT_CONVERSATION_VIEW, GIT_WORKBENCH_TITLE, isGitPanelView }
export type { GitPanelView }

/** All pages share one native conversation tab; no right-sidebar tab is registered. */
export const GIT_PANEL_TYPES: Record<GitPanelView, string> = Object.fromEntries(
  GIT_PANEL_VIEWS.map(view => [view, GIT_CONVERSATION_VIEW]),
) as Record<GitPanelView, string>

/** Kept under its original module name so branch/popover callers keep one navigation API. */
export function createGitPanelOpener(scope: any) {
  return async (view: GitPanelView, target: { sessionId?: string; cwd: string }): Promise<void> => {
    if (!isGitPanelView(view)) throw new Error('未知的 Git 页面')
    if (!target.cwd) throw new Error('请先选择项目目录')
    const refused = gitViewError()
    if (refused) throw new Error(`Git 工作台注册失败：${refused}`)
    let sessionId = target.sessionId
    if (!sessionId) {
      const workspace = await scope.workspaces.create({ path: target.cwd })
      sessionId = await scope.uiWorkspace.connectWorkspace(workspace.workspaceId)
      await scope.uiWorkspace.openWorkspace(workspace.workspaceId)
    }
    if (!sessionId) throw new Error('工作区未返回可用的会话')
    setActiveGitView(sessionId, target.cwd, view)
    await openGitSessionView(sessionId, target.cwd)
  }
}
