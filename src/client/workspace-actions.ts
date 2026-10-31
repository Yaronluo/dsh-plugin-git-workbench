/** Shared Worktree navigation: adopt the new path, then open its actual Session. */
export function createWorktreeOpener(scope: any): (path: string) => Promise<void> {
  return async (path: string) => {
    if (!scope.workspaces?.create || !scope.uiWorkspace?.openWorkspace) {
      throw new Error('The current environment cannot open a Worktree session; please open that directory manually')
    }
    const workspace = await scope.workspaces.create({ path })
    if (!workspace?.workspaceId) throw new Error('Failed to create workspace: no workspace identifier was returned')
    await scope.uiWorkspace.openWorkspace(workspace.workspaceId)
  }
}
