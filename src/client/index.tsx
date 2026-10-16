import React from 'react'
import { BranchChip } from './chips/BranchChip.js'
import { ChangesTab } from './diff/ChangesTab.js'
import { injectStyles, disposeStyles } from './styles.js'
import { reportClientState } from './diagnostics.js'
import { createWorktreeOpener } from './workspace-actions.js'
import { createGitPanelOpener } from './sidebar-actions.js'
import { GitSessionBridge, GitWorkbenchPage } from './panels/GitWorkbenchPage.js'
import { GIT_SESSION_BRIDGE_SLOT, installGitConversationView } from './conversation-registration.js'
import { installHeroControls } from './hero-registration.js'
import { createGitSidechatOpener, installGitSidechat } from './sidechat-integration.js'

export const inject = ['slots', 'sessions', 'workspaces', 'uiWorkspace']

function SessionHeaderGitControls(props: any) {
  const blank = props.useSession ? props.useSession((session: any) => session?.blank) : false
  return <div className="dsh-git-header-controls">
    {!blank && <BranchChip {...props} mode="header" />}
  </div>
}

export function apply(ctx: any): void {
  ctx.effect(() => { injectStyles(); reportClientState(); return disposeStyles }, 'dsh-plugin-git: styles')
  ctx.inject(['slots', 'sessions', 'workspaces', 'uiWorkspace'], (scope: any) => {
    let openSidechat: ((sessionId: string, cwd: string, text: string) => Promise<void>) | undefined
    const sharedProps = {
      gitSessionsSource: scope.sessions.list,
      gitWorkspacesSource: scope.workspaces.list,
      onOpenWorktree: createWorktreeOpener(scope),
      onOpenGitPanel: createGitPanelOpener(scope),
      onOpenGitSidechat: createGitSidechatOpener(scope, () => openSidechat),
    }
    scope.effect(() => installGitConversationView(scope, { Page: GitWorkbenchPage, Bridge: GitSessionBridge }, sharedProps), 'dsh-plugin-git: conversation workbench')
    scope.inject(['betterSidebar'], (sideCtx: any) => {
      sideCtx.effect(() => installGitSidechat(sideCtx.betterSidebar, open => { openSidechat = open }), 'dsh-plugin-git: side conversation drafts')
    })
    // Keep the host mode picker intact; the child bridge uses its own strict
    // Session scope so it can share the native header store even in the Hero.
    scope.slots.inject('conversation.hero.agentPreset', () => installHeroControls(scope.slots, Original => {
      return function InlineHeroGitControls(props: any) {
        return <div className="dsh-git-hero-controls">
          <Original {...props} />
          {props.sessionId && props.renderSlot(GIT_SESSION_BRIDGE_SLOT, {})}
          {props.sessionId && <BranchChip {...props} {...sharedProps} />}
        </div>
      }
    }, { [GIT_SESSION_BRIDGE_SLOT]: { kind: 'single', scope: 'session' } }))
    scope.slots.inject('conversation.session.header.utilities', () => scope.slots.register({
      id: 'dsh-plugin-git', name: 'conversation.session.header.utilities', order: 15,
      inject: () => sharedProps,
    }, SessionHeaderGitControls))
  })
}

export { BranchChip, ChangesTab }
