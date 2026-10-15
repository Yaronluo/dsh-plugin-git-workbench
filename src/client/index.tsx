import React, { useState } from 'react'
import { BranchChip } from './chips/BranchChip.js'
import { ChangesTab } from './diff/ChangesTab.js'
import { IconDiff, IconClose } from './icons.js'
import { injectStyles } from './styles.js'
import { resolveWorkspaceCwd } from './cwd-resolver.js'

export const inject = ['slots', 'conversation', 'sessions', 'workspaces', 'uiWorkspace']

/**
 * Floating / Modal Changes Panel Toggle for direct access
 */
function ChangesToggleBtn(props: any) {
  const [open, setOpen] = useState(false)
  const cwd = resolveWorkspaceCwd(props)

  return (
    <>
      <button
        type="button"
        className="dsh-git-selector-btn"
        onClick={() => setOpen(!open)}
        title="查看代码变更 (Diff)"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <IconDiff size={14} />
        <span style={{ fontSize: 12 }}>变更</span>
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            top: 60,
            right: 20,
            bottom: 20,
            width: 760,
            maxWidth: '90vw',
            background: '#ffffff',
            borderRadius: 12,
            boxShadow: '0 20px 30px rgba(0,0,0,0.18)',
            border: '1px solid #e5e7eb',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: '1px solid #e5e7eb',
              background: '#fafafa',
              fontWeight: 600,
            }}
          >
            <span>工作区代码变更 (Git Diff)</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}
            >
              <IconClose size={16} />
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ChangesTab cwd={cwd} />
          </div>
        </div>
      )}
    </>
  )
}

export function apply(ctx: any): void {
  injectStyles()

  ctx.inject(['slots', 'conversation', 'sessions', 'workspaces', 'uiWorkspace'], (scope: any) => {
    // Store scope globally for subcomponents/dialogs
    if (typeof window !== 'undefined') {
      ;(window as any).__dsh_scope__ = scope
    }

    const cwdOf = (sessionId?: string): string => {
      if (sessionId && scope.sessions?.list) {
        const snap = scope.sessions.list.getSnapshot()
        if (snap?.byId?.[sessionId]?.cwd) return snap.byId[sessionId].cwd
      }
      if (scope.uiWorkspace?.activeWorkspace?.path) {
        return scope.uiWorkspace.activeWorkspace.path
      }
      const items = scope.workspaces?.list?.getSnapshot()?.items || []
      return items[0]?.path || ''
    }

    const chipEntry = {
      id: 'dsh-plugin-git',
      order: 100,
      inject: () => ({
        cwdOf,
      }),
    }

    // 1. Register branch chip into conversation input context slot
    let mounted = false
    const disposeContext = scope.slots.inject('conversation.input.selector.context', () => {
      mounted = true
      try {
        return scope.slots.register(
          {
            name: 'conversation.input.selector.context',
            ...chipEntry,
          },
          BranchChip
        )
      } catch {
        return () => {}
      }
    })

    // Fallback to conversation.input.dock
    setTimeout(() => {
      if (mounted) return
      disposeContext?.()
      scope.slots.inject('conversation.input.dock', () => {
        try {
          return scope.slots.register(
            {
              name: 'conversation.input.dock',
              ...chipEntry,
            },
            BranchChip
          )
        } catch {
          return () => {}
        }
      })
    }, 400)

    // 2. Register Changes toggle button in session utilities
    scope.slots.inject('conversation.session.header.utilities', () => {
      try {
        return scope.slots.register(
          {
            name: 'conversation.session.header.utilities',
            order: 15,
            ...chipEntry,
          },
          ChangesToggleBtn
        )
      } catch {
        return () => {}
      }
    })
  })

  // 3. Register into betterSidebar if available
  try {
    ctx.inject(['betterSidebar'], (sideCtx: any) => {
      sideCtx.betterSidebar.registerTab({
        id: 'git-changes',
        title: () => '变更',
        description: () => '查看 Git 工作区差异与分支对比',
        icon: () => React.createElement(IconDiff, { size: 16 }),
        order: 15,
        single: true,
        component: (props: any) => React.createElement(ChangesTab, props),
      })
    })
  } catch {
    // betterSidebar not present
  }
}

export { BranchChip, ChangesTab }
