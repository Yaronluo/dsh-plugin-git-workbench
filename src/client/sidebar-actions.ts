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
    if (!isGitPanelView(view)) throw new Error('Unknown Git page')
    if (!target.cwd) throw new Error('Please select a project directory first')
    const refused = gitViewError()
    if (refused) throw new Error(`Failed to register the Git workbench: ${refused}`)
    let sessionId = target.sessionId
    if (!sessionId) {
      const workspace = await scope.workspaces.create({ path: target.cwd })
      sessionId = await scope.uiWorkspace.connectWorkspace(workspace.workspaceId)
      await scope.uiWorkspace.openWorkspace(workspace.workspaceId)
    }
    if (!sessionId) throw new Error('The workspace did not return a usable session')
    setActiveGitView(sessionId, target.cwd, view)
    await openGitSessionView(sessionId, target.cwd)
  }
}
