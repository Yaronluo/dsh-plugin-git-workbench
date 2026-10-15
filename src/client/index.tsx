import React, { useState } from 'react'
import { BranchChip } from './chips/BranchChip.js'
import { ChangesTab } from './diff/ChangesTab.js'
import { IconDiff } from './icons.js'
import { injectStyles, disposeStyles } from './styles.js'
import { reportClientState } from './diagnostics.js'
import { useWorkspaceContext } from './cwd-resolver.js'
import { createWorktreeOpener } from './workspace-actions.js'
import { createGitPanelOpener, GIT_SIDEBAR_TITLE, GIT_SIDEBAR_TYPE } from './sidebar-actions.js'
import { GitSidebarPanel } from './panels/GitSidebarPanel.js'
import { noteGitSidebarError } from './panels/navigation.js'
import { installHeroControls } from './hero-registration.js'

export const inject = ['slots', 'sessions', 'workspaces', 'uiWorkspace']

function ChangesButton(props: any) {
  const target = useWorkspaceContext(props)
  const [error, setError] = useState<string | null>(null)
  return <>
    <button type="button" className="dsh-git-selector-btn" title="在右侧查看变更" onClick={() => {
      setError(null)
      props.onOpenGitPanel('changes', target).catch((error: Error) => setError(error.message))
    }}><IconDiff size={16} /><span>变更</span></button>
    {error && <span className="dsh-git-error" role="alert">{error}</span>}
  </>
}

function SessionHeaderGitControls(props: any) {
  const blank = props.useSession ? props.useSession((session: any) => session?.blank) : false
  return <div className="dsh-git-header-controls">
    {!blank && <BranchChip {...props} mode="header" />}<ChangesButton {...props} />
  </div>
}

export function apply(ctx: any): void {
  ctx.effect(() => { injectStyles(); reportClientState(); return disposeStyles }, 'dsh-plugin-git: styles')
  ctx.inject(['slots', 'sessions', 'workspaces', 'uiWorkspace'], (scope: any) => {
    const sharedProps = {
      gitSessionsSource: scope.sessions.list,
      gitWorkspacesSource: scope.workspaces.list,
      onOpenWorktree: createWorktreeOpener(scope),
      onOpenGitPanel: createGitPanelOpener(scope),
    }
    // The Host has no additive hero-row seat. Intentionally decorate its preset
    // seat, preserving the original picker/locale/inject rather than moving DOM.
    scope.slots.inject('conversation.hero.agentPreset', () => installHeroControls(scope.slots, Original => {
      return function InlineHeroGitControls(props: any) {
        return <div className="dsh-git-hero-controls">
          <Original {...props} />
          {props.sessionId && <BranchChip {...props} {...sharedProps} />}
        </div>
      }
    }))
    scope.slots.inject('conversation.session.header.utilities', () => scope.slots.register({
      id: 'dsh-plugin-git', name: 'conversation.session.header.utilities', order: 15,
      inject: () => sharedProps,
    }, SessionHeaderGitControls))

    scope.inject(['betterSidebar'], (sideCtx: any) => {
      // ONE launcher entry. Every Git page (changes / history / worktrees, plus the
      // two creation forms) is a tab INSIDE this single native sidebar tab.
      sideCtx.effect(() => {
        try {
          return sideCtx.betterSidebar.registerTab({
            id: GIT_SIDEBAR_TYPE, title: () => GIT_SIDEBAR_TITLE,
            description: () => '变更、提交记录与工作树',
            icon: (size = 16) => React.createElement(IconDiff, { size }),
            order: 15, single: true,
            component: (props: any) => React.createElement(GitSidebarPanel, {
              ...sharedProps, ...props,
              sessionId: props.scope?.sessionId || props.sessionId,
              onClose: () => sideCtx.betterSidebar.closeTab(props.tab.id, props.scope),
            }),
          })
        } catch (error) {
          // A refused registration means no Git entry at all: keep the reason so the
          // header button can report it instead of blaming a missing sidebar plugin.
          const message = error instanceof Error ? error.message : String(error)
          noteGitSidebarError(message)
          console.error('[dsh-plugin-git] 侧栏 Git 入口注册失败：' + message)
          return () => {}
        }
      }, 'dsh-plugin-git: sidebar')
    })
  })
}

export { BranchChip, ChangesTab }
