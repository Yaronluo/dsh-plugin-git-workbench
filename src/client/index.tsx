import React, { useState } from 'react'
import { BranchChip } from './chips/BranchChip.js'
import { ChangesTab } from './diff/ChangesTab.js'
import { IconDiff, IconHistory, IconBranchPlus, IconFolderTree } from './icons.js'
import { injectStyles, disposeStyles } from './styles.js'
import { useWorkspaceContext } from './cwd-resolver.js'
import { createWorktreeOpener } from './workspace-actions.js'
import { createGitPanelOpener, GIT_PANEL_TYPES, GIT_PANEL_TITLES, type GitPanelView } from './sidebar-actions.js'
import { GitSidebarPanel } from './panels/GitSidebarPanel.js'
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
  ctx.effect(() => { injectStyles(); return disposeStyles }, 'dsh-plugin-git: styles')
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
      const icons = { changes: IconDiff, history: IconHistory, 'create-branch': IconBranchPlus, 'create-worktree': IconFolderTree, worktrees: IconFolderTree }
      for (const view of Object.keys(GIT_PANEL_TYPES) as GitPanelView[]) {
        sideCtx.effect(() => sideCtx.betterSidebar.registerTab({
          id: GIT_PANEL_TYPES[view], title: () => GIT_PANEL_TITLES[view],
          description: () => view === 'changes' ? '查看工作区与上游差异' : GIT_PANEL_TITLES[view],
          icon: (size = 16) => React.createElement(icons[view], { size }),
          order: view === 'changes' ? 15 : 16, single: true,
          component: (props: any) => React.createElement(GitSidebarPanel, {
            ...sharedProps, ...props, view,
            sessionId: props.scope?.sessionId || props.sessionId,
            onClose: () => sideCtx.betterSidebar.closeTab(props.tab.id, props.scope),
          }),
        }), `dsh-plugin-git: sidebar ${view}`)
      }
    })
  })
}

export { BranchChip, ChangesTab }
