/** Shared Worktree navigation: adopt the new path, then open its actual Session. */
export function createWorktreeOpener(scope: any): (path: string) => Promise<void> {
  return async (path: string) => {
    if (!scope.workspaces?.create || !scope.uiWorkspace?.openWorkspace) {
      throw new Error('当前环境无法打开 Worktree 会话，请手动打开该目录')
    }
    const workspace = await scope.workspaces.create({ path })
    if (!workspace?.workspaceId) throw new Error('创建工作区失败：未返回工作区标识')
    await scope.uiWorkspace.openWorkspace(workspace.workspaceId)
  }
}
