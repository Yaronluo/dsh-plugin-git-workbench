import React, { useState, useMemo, useEffect, useRef } from 'react'
import type { BranchesView } from '../../core/types.js'
import { IconBranch, IconBranchPlus, IconCheck, IconHistory, IconSearch, IconFolderTree } from '../icons.js'

export interface BranchPopoverProps {
  view: BranchesView
  onSwitch: (branch: string) => Promise<void>
  onCreateBranch: () => void
  onOpenGraph: () => void
  onCreateWorktree: () => void
  onManageWorktrees: () => void
  onClose: () => void
}

export function BranchPopover({
  view,
  onSwitch,
  onCreateBranch,
  onOpenGraph,
  onCreateWorktree,
  onManageWorktrees,
  onClose,
}: BranchPopoverProps) {
  const restoreFocus = useRef(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null)
  useEffect(() => () => { if (restoreFocus.current?.isConnected) restoreFocus.current.focus() }, [])
  const [query, setQuery] = useState('')
  const [switching, setSwitching] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return view.branches
    return view.branches.filter(b => b.name.toLowerCase().includes(q))
  }, [view.branches, query])

  const handleSwitch = async (branchName: string) => {
    if (branchName === view.current || switching) return
    setSwitching(branchName)
    setError(null)
    try {
      await onSwitch(branchName)
      onClose()
    } catch (err: any) {
      setError(err?.message || '切换分支失败')
    } finally {
      setSwitching(null)
    }
  }

  return (
    <>
      <div className="dsh-git-popover-backdrop" onClick={() => { if (!switching) onClose() }} />
      <div className="dsh-git-popover" role="dialog" aria-label="Git 分支" aria-busy={!!switching} onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); if (!switching) onClose() }
      }} onClick={e => e.stopPropagation()}>
        {/* Search Input */}
        <div className="dsh-git-search-box">
          <IconSearch size={14} />
          <input
            className="dsh-git-search-input"
            placeholder="搜索分支"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {/* Dirty files warning */}
        {view.dirtyFiles > 0 && (
          <div className="dsh-git-dirty-warning">
            未提交的更改: {view.dirtyFiles} 个文件
          </div>
        )}

        {/* Error message */}
        {error && (
          <div role="alert" className="dsh-git-error" style={{ fontSize: 12, padding: '4px 12px' }}>
            {error}
          </div>
        )}

        {/* Branch List */}
        <div className="dsh-git-branch-list">
          {filtered.length === 0 ? (
            <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)', fontSize: 13 }}>
              未匹配到分支
            </div>
          ) : (
            filtered.map(b => {
              const isCur = b.name === view.current
              const isSw = switching === b.name
              return (
                <button
                  type="button"
                  key={b.name}
                  className={`dsh-git-branch-item ${isCur ? 'dsh-git-branch-item-active' : ''}`}
                  onClick={() => handleSwitch(b.name)}
                  disabled={switching !== null}
                >
                  <div className="dsh-git-branch-item-left">
                    <IconBranch size={14} className={isCur ? 'text-primary' : ''} />
                    <span title={b.name}>{b.name}</span>
                  </div>
                  {isCur && <IconCheck size={14} />}
                  {isSw && <span style={{ fontSize: 11, color: 'var(--dsw-alias-label-secondary)' }}>切换中...</span>}
                </button>
              )
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="dsh-git-footer">
          <button type="button" className="dsh-git-footer-btn" disabled={!!switching} onClick={onCreateBranch}>
            <IconBranchPlus size={17} />
            <span>创建并检出新分支…</span>
          </button>
          <button type="button" className="dsh-git-footer-btn" disabled={!!switching} onClick={onOpenGraph}>
            <IconHistory size={17} />
            <span>提交记录</span>
          </button>
          <button type="button" className="dsh-git-footer-btn" disabled={!!switching} onClick={onCreateWorktree}>
            <IconFolderTree size={17} />
            <span>创建并打开 worktree...</span>
          </button>
          <button type="button" className="dsh-git-footer-btn" disabled={!!switching} onClick={onManageWorktrees}>
            <IconFolderTree size={17} />
            <span>管理 worktree...</span>
          </button>
        </div>
      </div>
    </>
  )
}
