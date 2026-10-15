export const GIT_PANEL_TYPES = {
  changes: 'git-changes',
  history: 'git-history',
  'create-branch': 'git-create-branch',
  'create-worktree': 'git-create-worktree',
  worktrees: 'git-worktrees',
} as const
export type GitPanelView = keyof typeof GIT_PANEL_TYPES
export const GIT_PANEL_TITLES: Record<GitPanelView, string> = {
  changes: '变更', history: '提交记录', 'create-branch': '创建分支',
  'create-worktree': '创建工作树', worktrees: '工作树',
}

/** All Git navigation uses the session-owned native right sidebar, never a modal/window. */
export function createGitPanelOpener(scope: any) {
  return async (view: GitPanelView, target: { sessionId?: string; cwd: string }): Promise<void> => {
    const type = GIT_PANEL_TYPES[view]
    if (!type) throw new Error('未知的 Git 面板')
    if (!target.cwd) throw new Error('请先选择项目目录')
    const sidebar = scope.get?.('betterSidebar') || scope.betterSidebar
    if (!sidebar?.openTab || !sidebar.getTab?.(type)) throw new Error('右侧 Git 面板尚未就绪，请启用侧边栏插件后重试')
    if (sidebar.isTabEnabled && !sidebar.isTabEnabled(type)) throw new Error('此 Git 面板已在侧边栏设置中停用')
    let sessionId = target.sessionId
    if (!sessionId) {
      // A blank workspace can be selected before a Session exists. Adopt that
      // explicit path; never redirect a click to an unrelated active Session.
      const workspace = await scope.workspaces.create({ path: target.cwd })
      sessionId = await scope.uiWorkspace.connectWorkspace(workspace.workspaceId)
      await scope.uiWorkspace.openWorkspace(workspace.workspaceId)
    }
    sidebar.openTab({ type, id: type, path: target.cwd, title: GIT_PANEL_TITLES[view], target: 'right', reveal: true }, { sessionId, cwd: target.cwd })
  }
}
