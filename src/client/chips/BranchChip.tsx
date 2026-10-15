import React, { useState } from 'react'
import type { BranchesView } from '../../core/types.js'
import { gitApi } from '../api.js'
import { IconBranch, IconChevronDown } from '../icons.js'
import { useGitStatus } from '../hooks/use-git-status.js'
import { BranchPopover } from './BranchPopover.js'
import { CreateBranchDialog } from '../dialogs/CreateBranchDialog.js'
import { GitGraphDialog } from '../dialogs/GitGraphDialog.js'
import { CreateWorktreeDialog, WorktreeManagerDialog } from '../dialogs/WorktreeDialogs.js'
import { injectStyles } from '../styles.js'

export function BranchChip(props: any) {
  // Inject component styles
  injectStyles()

  // Resolve cwd from props or active workspace
  const cwd = props?.cwd || props?.workspace?.path || props?.session?.cwd || ''
  const { status, isGit, loading, reload } = useGitStatus(cwd)

  const [open, setOpen] = useState(false)
  const [branchesView, setBranchesView] = useState<BranchesView | null>(null)
  const [fetchingBranches, setFetchingBranches] = useState(false)

  // Dialog states
  const [showCreateBranch, setShowCreateBranch] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
  const [showCreateWorktree, setShowCreateWorktree] = useState(false)
  const [showManageWorktrees, setShowManageWorktrees] = useState(false)

  // Requirement: Auto-detect if it's a Git repo. If not, hide completely!
  if (loading || !isGit || !status) {
    return null
  }

  const handleTogglePopover = async () => {
    if (open) {
      setOpen(false)
      return
    }

    setFetchingBranches(true)
    try {
      const view = await gitApi.getBranches(cwd)
      setBranchesView(view)
      setOpen(true)
    } catch {
      // Fallback with just current branch if listing fails
      setBranchesView({
        current: status.branch,
        dirtyFiles: status.dirtyFiles,
        branches: [{ name: status.branch, current: true, isRemote: false }],
      })
      setOpen(true)
    } finally {
      setFetchingBranches(false)
    }
  }

  const handleSwitchBranch = async (targetBranch: string) => {
    const res = await gitApi.switchBranch(cwd, targetBranch)
    if (!res.ok) {
      throw new Error(res.error?.message || '切换分支失败')
    }
    reload()
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className={`dsh-git-chip ${open ? 'dsh-git-chip-active' : ''}`}
        onClick={handleTogglePopover}
        title={`当前 Git 分支: ${status.branch}${status.dirtyFiles > 0 ? ` (${status.dirtyFiles} 个修改文件)` : ''}`}
      >
        <IconBranch size={13} />
        <span>{status.branch || 'HEAD'}</span>
        <IconChevronDown size={11} />
      </button>

      {open && branchesView && (
        <BranchPopover
          view={branchesView}
          onSwitch={handleSwitchBranch}
          onCreateBranch={() => {
            setOpen(false)
            setShowCreateBranch(true)
          }}
          onOpenGraph={() => {
            setOpen(false)
            setShowGraph(true)
          }}
          onCreateWorktree={() => {
            setOpen(false)
            setShowCreateWorktree(true)
          }}
          onManageWorktrees={() => {
            setOpen(false)
            setShowManageWorktrees(true)
          }}
          onClose={() => setOpen(false)}
        />
      )}

      {showCreateBranch && (
        <CreateBranchDialog
          path={cwd}
          currentBranch={status.branch}
          onClose={() => setShowCreateBranch(false)}
          onSuccess={newBranch => {
            reload()
          }}
        />
      )}

      {showGraph && (
        <GitGraphDialog path={cwd} onClose={() => setShowGraph(false)} />
      )}

      {showCreateWorktree && (
        <CreateWorktreeDialog
          path={cwd}
          currentBranch={status.branch}
          onClose={() => setShowCreateWorktree(false)}
          onSuccess={wtPath => {
            reload()
            // Optional: notify user or switch workspace
            alert(`已在独立工作树创建分支并在目录打开:\n${wtPath}`)
          }}
        />
      )}

      {showManageWorktrees && (
        <WorktreeManagerDialog path={cwd} onClose={() => setShowManageWorktrees(false)} />
      )}
    </div>
  )
}
