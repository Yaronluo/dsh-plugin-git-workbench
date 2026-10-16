import React, { useState, useRef, useEffect } from 'react'
import type { BranchesView } from '../../core/types.js'
import { gitApi } from '../api.js'
import { IconBranch, IconChevronDown } from '../icons.js'
import { useGitStatus } from '../hooks/use-git-status.js'
import { BranchPopover } from './BranchPopover.js'
import { useWorkspaceContext } from '../cwd-resolver.js'
import type { GitPanelView } from '../sidebar-actions.js'

export function BranchChip(props: any) {
  const { cwd, sessionId } = useWorkspaceContext(props)
  return <RepositoryChip key={`${sessionId || ''}:${cwd}`} cwd={cwd} sessionId={sessionId} onOpenGitPanel={props.onOpenGitPanel} />
}

function RepositoryChip({ cwd, sessionId, onOpenGitPanel }: {
  cwd: string; sessionId?: string
  onOpenGitPanel?: (view: GitPanelView, target: { cwd: string; sessionId?: string }) => Promise<void>
}) {
  const { status, isGit, loading, error, reload } = useGitStatus(cwd)
  const [open, setOpen] = useState(false)
  const [branchesView, setBranchesView] = useState<BranchesView | null>(null)
  const [fetchingBranches, setFetchingBranches] = useState(false)
  const [branchError, setBranchError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  const handleTogglePopover = async () => {
    if (fetchingBranches) return
    if (open) { setOpen(false); return }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setFetchingBranches(true)
    setBranchError(null)
    try {
      const view = await gitApi.getBranches(cwd, controller.signal)
      if (!controller.signal.aborted) { setBranchesView(view); setOpen(true) }
    } catch (error) {
      if (!controller.signal.aborted) setBranchError(error instanceof Error ? error.message : String(error))
    } finally { if (!controller.signal.aborted) setFetchingBranches(false) }
  }
  const openPanel = async (view: GitPanelView) => {
    setOpen(false)
    setBranchError(null)
    try {
      if (!onOpenGitPanel) throw new Error('Git 工作台尚未就绪')
      await onOpenGitPanel(view, { cwd, sessionId })
    } catch (error) { setBranchError(error instanceof Error ? error.message : String(error)) }
  }

  if (loading && !status && !error) return <span className="dsh-git-muted dsh-git-loading" role="status">加载中…</span>
  if (!status || !isGit) return error ? <span className="dsh-git-error" role="alert">{error} <button type="button" onClick={reload}>重试</button></span> : null
  return <div className="dsh-git-branch-control">
    <button type="button" className={`dsh-git-chip ${open ? 'dsh-git-chip-active' : ''}`} onClick={handleTogglePopover}
      disabled={fetchingBranches} aria-haspopup="dialog" aria-expanded={open} aria-busy={fetchingBranches}
      title={`当前分支: ${status.branch}${status.dirtyFiles > 0 ? ` (${status.dirtyFiles} 个修改文件)` : ''}`}>
      <IconBranch size={16} /><span>{status.branch || 'HEAD'}</span>
      {(status.ahead || 0) > 0 && <span className='dsh-git-ahead'>↑{status.ahead}</span>}
      {(status.behind || 0) > 0 && <span className='dsh-git-behind'>↓{status.behind}</span>}
      {(status.stashCount || 0) > 0 && <span className='dsh-git-badge'>储藏 {status.stashCount}</span>}
      <IconChevronDown size={12} />
    </button>
    {(branchError || error) && <span className="dsh-git-error" role="alert">{branchError || error}</span>}
    {open && branchesView && <BranchPopover view={branchesView} path={cwd} status={status || undefined} onReloadStatus={reload}
      onSwitch={async target => {
        const result = await gitApi.switchBranch(cwd, target)
        if (!result.ok) throw new Error(result.error?.message || '切换分支失败')
        reload()
      }}
      onCreateBranch={() => { void openPanel('create-branch') }} onOpenGraph={() => { void openPanel('history') }}
      onCreateWorktree={() => { void openPanel('create-worktree') }} onManageWorktrees={() => { void openPanel('worktrees') }}
      onClose={() => setOpen(false)} />}
  </div>
}
