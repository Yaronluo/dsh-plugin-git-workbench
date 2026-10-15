import {
  GIT_PANEL_TITLES, GIT_PANEL_VIEWS, GIT_SIDEBAR_TITLE, GIT_SIDEBAR_TYPE, gitSidebarError, isGitPanelView,
  setActiveGitView, type GitPanelView,
} from './panels/navigation.js'

export { GIT_PANEL_TITLES, GIT_PANEL_VIEWS, GIT_SIDEBAR_TITLE, GIT_SIDEBAR_TYPE, isGitPanelView }
export type { GitPanelView }

/**
 * Every view used to own a sidebar tab of its own, which put five near-identical
 * entries in the launcher. They now share ONE tab: this map is kept so callers
 * (and the single-entry regression test) still enumerate the reachable views.
 */
export const GIT_PANEL_TYPES: Record<GitPanelView, string> = Object.fromEntries(
  GIT_PANEL_VIEWS.map(view => [view, GIT_SIDEBAR_TYPE]),
) as Record<GitPanelView, string>

/** All Git navigation uses the session-owned native right sidebar, never a modal/window. */
export function createGitPanelOpener(scope: any) {
  return async (view: GitPanelView, target: { sessionId?: string; cwd: string }): Promise<void> => {
    if (!isGitPanelView(view)) throw new Error('未知的 Git 面板')
    if (!target.cwd) throw new Error('请先选择项目目录')
    const sidebar = scope.get?.('betterSidebar') || scope.betterSidebar
    if (!sidebar?.openTab || !sidebar.getTab?.(GIT_SIDEBAR_TYPE)) {
      // A refused registration is not a missing plugin: say which one it was.
      const refused = gitSidebarError()
      if (refused) throw new Error(`Git 侧栏入口注册失败：${refused}`)
      throw new Error('右侧 Git 面板尚未就绪，请启用侧边栏插件后重试')
    }
    if (sidebar.isTabEnabled && !sidebar.isTabEnabled(GIT_SIDEBAR_TYPE)) throw new Error('Git 面板已在侧边栏设置中停用')
    let sessionId = target.sessionId
    if (!sessionId) {
      // A blank workspace can be selected before a Session exists. Adopt that
      // explicit path; never redirect a click to an unrelated active Session.
      const workspace = await scope.workspaces.create({ path: target.cwd })
      sessionId = await scope.uiWorkspace.connectWorkspace(workspace.workspaceId)
      await scope.uiWorkspace.openWorkspace(workspace.workspaceId)
    }
    // Set the page BEFORE opening: focusing a tab that is already open does not
    // re-navigate it, and the panel must still land on the requested view. The tab
    // title stays the stable "Git" — the panel's own tab strip names the page, so a
    // dynamically renamed title would contradict whatever the user navigates to next.
    setActiveGitView(sessionId, target.cwd, view)
    sidebar.openTab({
      type: GIT_SIDEBAR_TYPE, id: GIT_SIDEBAR_TYPE, path: target.cwd, title: GIT_SIDEBAR_TITLE,
      meta: { gitView: view }, target: 'right', reveal: true,
    }, { sessionId, cwd: target.cwd })
  }
}
