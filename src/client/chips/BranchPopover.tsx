import React, { useState, useMemo, useEffect, useRef } from 'react'
import type { BranchesView, RepoStatus } from '../../core/types.js'
import { gitApi } from '../api.js'
import { selectableBranches } from './branch-list.js'
import { IconArrowDown, IconArrowUp, IconBranch, IconBranchPlus, IconCheck, IconCloudRefresh, IconHistory, IconPull, IconPush, IconSearch, IconFolderTree } from '../icons.js'

export interface BranchPopoverProps {
  view: BranchesView
  path: string
  status?: Pick<RepoStatus, 'ahead' | 'behind' | 'stashCount'>
  onSwitch: (branch: string) => Promise<void>
  onCreateBranch: () => void
  onOpenGraph: () => void
  onCreateWorktree: () => void
  onManageWorktrees: () => void
  onReloadStatus?: () => void
  onClose: () => void
}

type SyncAction = 'fetch' | 'pull' | 'push'

const errorMessage = (error: unknown) => error instanceof Error ? error.message : typeof error === 'string' ? error : '远程同步失败'

export function BranchPopover({
  view,
  path,
  status,
  onSwitch,
  onCreateBranch,
  onOpenGraph,
  onCreateWorktree,
  onManageWorktrees,
  onReloadStatus,
  onClose,
}: BranchPopoverProps) {
  const restoreFocus = useRef(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null)
  useEffect(() => () => { if (restoreFocus.current?.isConnected) restoreFocus.current.focus() }, [])
  const [query, setQuery] = useState('')
  const [switching, setSwitching] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<SyncAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const selectable = selectableBranches(view.branches)
    const q = query.trim().toLowerCase()
    if (!q) return selectable
    return selectable.filter(b => b.name.toLowerCase().includes(q))
  }, [view.branches, query])

  const currentBranch = view.branches.find(branch => branch.name === view.current)
  const ahead = status?.ahead ?? currentBranch?.ahead ?? 0
  const behind = status?.behind ?? currentBranch?.behind ?? 0
  const stashCount = status?.stashCount ?? 0
  // 0/0 means the branch is level with its upstream, so the row is skipped entirely. When the branch
  // does diverge, each side is drawn as its own pill and the empty side is left out: printing
  // "落后 0 个提交" next to a real count is the noise this row used to be.
  const diverged = ahead > 0 || behind > 0
  const credentialHint = error && /credential|authentication|authorization|username|password|凭据|认证|密码|登录|401|403/i.test(error)

  const handleSwitch = async (branchName: string) => {
    if (branchName === view.current || switching || syncing) return
    setSwitching(branchName)
    setError(null)
    setNotice(null)
    try {
      await onSwitch(branchName)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : typeof err === 'string' ? err : '切换分支失败')
    } finally {
      setSwitching(null)
    }
  }

  const handleSync = async (action: SyncAction) => {
    if (syncing || switching) return
    setSyncing(action)
    setError(null)
    setNotice(null)
    try {
      const result = action === 'fetch'
        ? await gitApi.fetch(path, { prune: true })
        : action === 'pull'
          ? await gitApi.pull(path, { mode: 'ff-only' })
          : await gitApi.push(path, { setUpstream: true })
      if (!result.ok) {
        setError(result.error || '远程同步失败')
        return
      }
      const success = action === 'fetch' ? '已获取远程更新' : action === 'pull' ? '已拉取' : '已推送'
      setNotice(result.output ? `${success}：${result.output}` : success)
      if (action === 'pull' || action === 'push') onReloadStatus?.()
    } catch (syncError) {
      setError(errorMessage(syncError))
    } finally {
      setSyncing(null)
    }
  }

  return (
    <>
      <div className='dsh-git-popover-backdrop' onClick={() => { if (!switching && !syncing) onClose() }} />
      <div className='dsh-git-popover' role='dialog' aria-label='Git 分支' aria-busy={!!switching || !!syncing} onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); if (!switching && !syncing) onClose() }
      }} onClick={event => event.stopPropagation()}>
        <div className='dsh-git-search-box'>
          <IconSearch size={14} />
          <input
            className='dsh-git-search-input'
            placeholder='搜索分支'
            value={query}
            onChange={event => setQuery(event.target.value)}
            autoFocus
          />
        </div>

        {(diverged || stashCount > 0) && <div className='dsh-git-diverged'>
          {ahead > 0 && <span className='dsh-git-ahead' title={`领先上游 ${ahead} 个提交`}><IconArrowUp size={12} />领先 {ahead} 个提交</span>}
          {behind > 0 && <span className='dsh-git-behind' title={`落后上游 ${behind} 个提交`}><IconArrowDown size={12} />落后 {behind} 个提交</span>}
          {stashCount > 0 && <span className='dsh-git-badge'>储藏 {stashCount}</span>}
        </div>}

        {view.dirtyFiles > 0 && <div className='dsh-git-dirty-warning'>未提交的更改: {view.dirtyFiles} 个文件</div>}

        {error && <div role='alert' className='dsh-git-error dsh-git-popover-error'>
          {error}
          {credentialHint && <div className='dsh-git-muted'>需要凭据或网络不可达时，请在终端里手动执行一次</div>}
        </div>}

        <div className='dsh-git-branch-list'>
          {filtered.length === 0 ? (
            <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)', fontSize: 13 }}>
              未匹配到分支
            </div>
          ) : (
            filtered.map(branch => {
              const isCurrent = branch.name === view.current
              const isSwitching = switching === branch.name
              return (
                <button
                  type='button'
                  key={branch.name}
                  className={`dsh-git-branch-item ${isCurrent ? 'dsh-git-branch-item-active' : ''}`}
                  onClick={() => void handleSwitch(branch.name)}
                  disabled={switching !== null || syncing !== null}
                >
                  <div className='dsh-git-branch-item-left'>
                    <IconBranch size={14} className={isCurrent ? 'text-primary' : ''} />
                    <span title={branch.name}>{branch.name}</span>
                  </div>
                  {isCurrent && <IconCheck size={14} />}
                  {isSwitching && <span style={{ fontSize: 11, color: 'var(--dsw-alias-label-secondary)' }}>切换中...</span>}
                </button>
              )
            })
          )}
        </div>

        {/* The sync result belongs to the whole popover, not to the button row: inside the row it
            was squeezed into whatever width the three buttons left over and wrapped one character
            per line. */}
        {notice && <div className='dsh-git-popover-notice' role='status'>{notice}</div>}

        <div className='dsh-git-popover-actions'>
          <button type='button' className='dsh-git-btn dsh-git-btn-secondary' title='获取远程更新' disabled={!!syncing || !!switching} aria-busy={syncing === 'fetch'} onClick={() => void handleSync('fetch')}>
            <IconCloudRefresh size={15} />{syncing === 'fetch' ? '获取中…' : '获取'}
          </button>
          <button type='button' className='dsh-git-btn dsh-git-btn-secondary' title='拉取远程更新' disabled={!!syncing || !!switching} aria-busy={syncing === 'pull'} onClick={() => void handleSync('pull')}>
            <IconPull size={15} />{syncing === 'pull' ? '拉取中…' : '拉取'}
          </button>
          <button type='button' className='dsh-git-btn dsh-git-btn-secondary' title='推送本地提交' disabled={!!syncing || !!switching} aria-busy={syncing === 'push'} onClick={() => void handleSync('push')}>
            <IconPush size={15} />{syncing === 'push' ? '推送中…' : '推送'}
          </button>
        </div>

        <div className='dsh-git-footer'>
          <button type='button' className='dsh-git-footer-btn' disabled={!!switching || !!syncing} onClick={onCreateBranch}>
            <IconBranchPlus size={17} />
            <span>创建并检出新分支…</span>
          </button>
          <button type='button' className='dsh-git-footer-btn' disabled={!!switching || !!syncing} onClick={onOpenGraph}>
            <IconHistory size={17} />
            <span>提交记录</span>
          </button>
          <button type='button' className='dsh-git-footer-btn' disabled={!!switching || !!syncing} onClick={onCreateWorktree}>
            <IconFolderTree size={17} />
            <span>创建并打开工作树…</span>
          </button>
          <button type='button' className='dsh-git-footer-btn' disabled={!!switching || !!syncing} onClick={onManageWorktrees}>
            <IconFolderTree size={17} />
            <span>管理工作树…</span>
          </button>
        </div>
      </div>
    </>
  )
}
