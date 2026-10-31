import React, { useEffect } from 'react'
import { useWorkspaceContext } from '../cwd-resolver.js'
import { IconBranch } from '../icons.js'
import { GitSidebarPanel } from './GitSidebarPanel.js'
import { bindGitSessionNavigator, GIT_CONVERSATION_VIEW, noteGitViewError } from './navigation.js'

/** Invisible, session-scoped bridge into the native conversation selection store. */
export function GitSessionBridge(props: any) {
  const { cwd, sessionId } = useWorkspaceContext(props)
  const view = props.useStore((state: any) => state.view)
  const blank = props.useSession((session: any) => session?.blank === true)
  useEffect(() => {
    if (!sessionId) return
    return bindGitSessionNavigator(sessionId, { cwd, select: props.selectConversationView })
  }, [sessionId, cwd, props.selectConversationView])
  useEffect(() => {
    if (!blank || view !== GIT_CONVERSATION_VIEW) return
    try { return props.mountBlankWorkbench() }
    catch (error) {
      noteGitViewError(error instanceof Error ? error.message : String(error))
      props.selectConversationView('chat')
    }
  }, [blank, view, props.mountBlankWorkbench, props.selectConversationView])
  return null
}

/** Native conversation.view content. No overlay, portal, or right-side tab. */
export function GitWorkbenchPage(props: any) {
  const { cwd, sessionId } = useWorkspaceContext(props)
  const blank = props.useSession ? props.useSession((session: any) => session?.blank === true) : false
  const back = () => {
    if (props.onReturnToConversation) props.onReturnToConversation()
    else props.openView?.('chat')
  }
  return <section className="dsh-git-workbench" aria-label="Git workbench">
    <header className="dsh-git-workbench-header">
      <div className="dsh-git-workbench-title"><IconBranch size={18} /><strong>Git workbench</strong></div>
      <span className="dsh-git-workbench-path" title={cwd}>{cwd || 'No project directory selected'}</span>
      {blank && <nav className="dsh-git-blank-nav" role="tablist" aria-label="Conversation view">
        <button type="button" role="tab" aria-selected="false" onClick={back}>Chat</button>
        <span role="tab" aria-selected="true">Git</span>
      </nav>}
    </header>
    {cwd ? <GitSidebarPanel key={`${sessionId || ''}:${cwd}`} {...props} cwd={cwd} sessionId={sessionId} onClose={back} />
      : <div className="dsh-git-empty-state"><strong>No project directory selected</strong><p>Choose a workspace for this session, then open the Git workbench.</p></div>}
  </section>
}
