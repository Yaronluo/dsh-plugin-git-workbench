import React from 'react'
import { ChangesTab } from '../diff/ChangesTab.js'
import { GitGraphDialog } from '../dialogs/GitGraphDialog.js'
import { CreateBranchDialog } from '../dialogs/CreateBranchDialog.js'
import { CreateWorktreeDialog, WorktreeManagerDialog } from '../dialogs/WorktreeDialogs.js'
import { GitPanelContext } from './panel-context.js'
import { useGitStatus } from '../hooks/use-git-status.js'
import type { GitPanelView } from '../sidebar-actions.js'

function RepositoryForm({ view, cwd, onClose, onOpenWorktree }: any) {
  const { status, loading, error, reload } = useGitStatus(cwd)
  if (loading && !status) return <div className="dsh-git-panel-message" role="status">加载中…</div>
  if (error && !status) return <div className="dsh-git-panel-message dsh-git-error" role="alert">{error}<button type="button" className="dsh-git-selector-btn" onClick={reload}>重试</button></div>
  if (!status?.isGit) return <div className="dsh-git-panel-message">当前目录不是 Git 仓库</div>
  if (view === 'create-branch') return <CreateBranchDialog path={cwd} currentBranch={status.branch} onClose={onClose} onSuccess={reload} />
  if (view === 'create-worktree') return <CreateWorktreeDialog path={cwd} currentBranch={status.branch} onClose={onClose} onSuccess={reload} onOpenWorktree={onOpenWorktree} />
  return <WorktreeManagerDialog path={cwd} onClose={onClose} />
}

/** Content for a native, per-Session right-sidebar tab. Never creates a second window or overlay. */
export function GitSidebarPanel(props: any) {
  const cwd = props.tab?.path || props.scope?.repoRoot || props.scope?.cwd || props.cwd || ''
  const sessionId = props.scope?.sessionId || props.sessionId
  const { view, onClose } = props as { view: GitPanelView; onClose: () => void }
  return <GitPanelContext.Provider value={true}>
    <div className="dsh-git-sidebar-content" key={`${sessionId || ''}:${cwd}`}>
      {view === 'changes' ? <ChangesTab {...props} cwd={cwd} sessionId={sessionId} />
        : view === 'history' ? <GitGraphDialog path={cwd} onClose={onClose} />
        : <RepositoryForm view={view} cwd={cwd} onClose={onClose} onOpenWorktree={props.onOpenWorktree} />}
    </div>
  </GitPanelContext.Provider>
}
