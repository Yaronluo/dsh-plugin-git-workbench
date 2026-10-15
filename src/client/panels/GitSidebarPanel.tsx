import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ChangesTab } from '../diff/ChangesTab.js'
import { GitGraphDialog } from '../dialogs/GitGraphDialog.js'
import { CreateBranchDialog } from '../dialogs/CreateBranchDialog.js'
import { CreateWorktreeDialog, WorktreeManagerDialog } from '../dialogs/WorktreeDialogs.js'
import { GitPanelContext } from './panel-context.js'
import { useGitStatus } from '../hooks/use-git-status.js'
import { IconBranchPlus, IconDiff, IconFolderTree, IconHistory } from '../icons.js'
import { GitLoadingState } from '../loading-state.js'
import { collectPanelDiagnostics, reportClientState } from '../diagnostics.js'
import {
  GIT_PANEL_TITLES, GIT_VIEW_ENTRIES, activeGitView, isGitPanelView, setActiveGitView, subscribeGitView,
  type GitPanelView,
} from './navigation.js'

const VIEW_ICONS: Record<GitPanelView, (props: { size?: number }) => React.ReactElement> = {
  changes: IconDiff,
  history: IconHistory,
  worktrees: IconFolderTree,
  'create-branch': IconBranchPlus,
  'create-worktree': IconFolderTree,
}

/**
 * The panel's own navigation: the three pages are tabs, the two creation flows are
 * compact actions beside them. This is what replaced the five launcher entries.
 */
function GitViewStrip({ view, onSelect }: { view: GitPanelView; onSelect: (next: GitPanelView) => void }) {
  const pages = GIT_VIEW_ENTRIES.filter(entry => entry.primary)
  const actions = GIT_VIEW_ENTRIES.filter(entry => !entry.primary)
  return <div className="dsh-git-view-nav" aria-label="Git 导航">
    <div className="dsh-git-view-pages" role="tablist" aria-label="Git 页面">
      {pages.map(({ view: target }) => {
        const Icon = VIEW_ICONS[target]
        return <button key={target} type="button" role="tab" aria-selected={view === target}
          className={`dsh-git-view-tab ${view === target ? 'dsh-git-view-tab-active' : ''}`}
          onClick={() => onSelect(target)}>
          <Icon size={15} /><span>{GIT_PANEL_TITLES[target]}</span>
        </button>
      })}
    </div>
    <div className="dsh-git-view-actions">
      {actions.map(({ view: target }) => {
        const Icon = VIEW_ICONS[target]
        return <button key={target} type="button" title={GIT_PANEL_TITLES[target]} aria-label={GIT_PANEL_TITLES[target]}
          aria-pressed={view === target}
          className={`dsh-git-view-action ${view === target ? 'dsh-git-view-tab-active' : ''}`}
          onClick={() => onSelect(target)}>
          <Icon size={15} /><span>{GIT_PANEL_TITLES[target]}</span>
        </button>
      })}
    </div>
  </div>
}

/** Branch / worktree creation and worktree management: inline content, never an overlay. */
function RepositoryForm({ view, cwd, branch, onFinish, onClose, onOpenWorktree }: {
  view: GitPanelView; cwd: string; branch: string
  onFinish: (next: GitPanelView) => void; onClose: () => void
  onOpenWorktree?: (path: string) => Promise<void>
}) {
  if (view === 'create-branch') {
    // A new branch is the checked-out one, so land back on the changes page.
    return <CreateBranchDialog path={cwd} currentBranch={branch} onClose={() => onFinish('changes')}
      onSuccess={() => onFinish('changes')} />
  }
  if (view === 'create-worktree') {
    // Land on the list that now contains the new worktree.
    return <CreateWorktreeDialog path={cwd} currentBranch={branch} onClose={() => onFinish('worktrees')}
      onSuccess={() => onFinish('worktrees')} onOpenWorktree={onOpenWorktree} />
  }
  return <WorktreeManagerDialog path={cwd} onClose={onClose} />
}

/** Content for the Session's native right sidebar. One tab hosts every Git page. */
export function GitSidebarPanel(props: any) {
  const cwd = props.tab?.path || props.scope?.repoRoot || props.scope?.cwd || props.cwd || ''
  const sessionId = props.scope?.sessionId || props.sessionId
  // A caller's explicit page (or the restored tab meta) is only the FALLBACK: the
  // live store wins, because focusing an already-open tab must still re-navigate it.
  const requested = props.view ?? props.tab?.meta?.gitView
  const fallback: GitPanelView = isGitPanelView(requested) ? requested : 'changes'
  const view = useSyncExternalStore(subscribeGitView, () => activeGitView(sessionId, cwd, fallback), () => fallback)
  const select = useCallback((next: GitPanelView) => setActiveGitView(sessionId, cwd, next), [sessionId, cwd])
  const { status, error, reload } = useGitStatus(cwd || undefined)
  const [reloadKey, setReloadKey] = useState(0)
  const onClose = () => props.onClose?.()
  const finish = (next: GitPanelView) => { select(next); setReloadKey(value => value + 1) }

  // The panel is the only place the font cascade can be observed as the user sees it, so it
  // reports its own measurement once per rendered page (see diagnostics.ts).
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const timer = setTimeout(() => reportClientState('panel', collectPanelDiagnostics(rootRef.current)), 300)
    return () => clearTimeout(timer)
  }, [view, cwd])

  const page = (() => {
    // The changes page owns its loading/empty/error presentation; keep it.
    if (view === 'changes') return <ChangesTab {...props} cwd={cwd} sessionId={sessionId} />
    if (error && !status) return <div className="dsh-git-empty-state">
      <div className="dsh-git-state-icon"><IconBranchPlus size={24} /></div><strong>暂时无法读取仓库</strong>
      <p className="dsh-git-state-error" role="alert">{error}</p>
      <button type="button" className="dsh-git-btn dsh-git-btn-secondary" onClick={reload}>重新加载</button>
    </div>
    if (status && !status.isGit) return <div className="dsh-git-empty-state">
      <div className="dsh-git-state-icon"><IconFolderTree size={24} /></div><strong>当前目录不是 Git 仓库</strong>
      <p>在项目中执行 <code>git init</code> 后即可在这里管理分支与工作树。</p>
      <button type="button" className="dsh-git-btn dsh-git-btn-primary" onClick={reload}>重新加载</button>
    </div>
    // 提交记录 / 工作树 自带加载态：这里再放一个占位加载，就会先看到“检测仓库”再看到
    // 页面自己的加载，变成连续两个加载画面。只有两个创建表单需要已解析的分支名，
    // 因此只有它们等在探测之后。
    const needsBranch = view === 'create-branch' || view === 'create-worktree'
    if (needsBranch && !status) return <GitLoadingState title="正在检测 Git 仓库" hint="分支信息即将显示" />
    if (view === 'history') return <GitGraphDialog key={reloadKey} path={cwd} onClose={onClose} />
    return <RepositoryForm view={view} cwd={cwd} branch={status?.branch ?? ''} onFinish={finish} onClose={onClose}
      onOpenWorktree={props.onOpenWorktree} />
  })()

  return <GitPanelContext.Provider value={true}>
    <div className="dsh-git-sidebar-content" ref={rootRef} key={`${sessionId || ''}:${cwd}`}>
      <GitViewStrip view={view} onSelect={select} />
      <div className="dsh-git-view-content">{page}</div>
    </div>
  </GitPanelContext.Provider>
}
