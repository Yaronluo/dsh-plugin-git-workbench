import React, { useEffect, useState, useRef } from 'react'
import type { WorktreeItem } from '../../core/types.js'
import { gitApi } from '../api.js'
import { IconClose, IconWorktree } from '../icons.js'
import { DialogShell } from './DialogShell.js'

const message = (error: unknown) => error instanceof Error ? error.message : typeof error === 'string' ? error : '操作失败'

export function CreateWorktreeDialog({ path, currentBranch, onClose, onSuccess, onOpenWorktree }: {
  path: string; currentBranch: string; onClose: () => void; onSuccess: (worktreePath: string) => void
  onOpenWorktree?: (path: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [base, setBase] = useState(currentBranch)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Preserve a successfully created worktree if opening fails: retry must not create it twice.
  const [createdPath, setCreatedPath] = useState<string | null>(null)
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting || (!createdPath && !name.trim())) return
    setSubmitting(true)
    setError(null)
    try {
      let destination = createdPath
      if (!destination) {
        const result = await gitApi.createWorktree(path, name.trim(), base.trim() || undefined)
        if (!result.ok || !result.path) throw new Error(message(result.error || '创建 Worktree 失败'))
        destination = result.path
        setCreatedPath(destination)
        onSuccess(destination)
      }
      if (onOpenWorktree) await onOpenWorktree(destination)
      onClose()
    } catch (error) { setError(message(error)) }
    finally { setSubmitting(false) }
  }
  return <DialogShell title="创建 Worktree" onClose={onClose} busy={submitting}>
    <div className="dsh-git-modal-header">
      <span><IconWorktree size={16} /> 创建 Worktree</span>
      <button type="button" aria-label="关闭" className="dsh-git-icon-btn" disabled={submitting} onClick={onClose}><IconClose size={16} /></button>
    </div>
    <form onSubmit={handleSubmit}>
      <div className="dsh-git-modal-body">
        <div className="dsh-git-muted" style={{ fontSize: 13 }}>独立工作树可避免并行任务相互覆盖。{onOpenWorktree ? '创建后将在工作区中打开。' : '当前入口仅创建工作树，不自动创建会话。'}</div>
        <label>Worktree 任务标识<input className="dsh-git-input" value={name} onChange={event => setName(event.target.value)} disabled={submitting || !!createdPath} placeholder="例如 feature-login" autoFocus /></label>
        <label>基线分支<input className="dsh-git-input" value={base} onChange={event => setBase(event.target.value)} disabled={submitting || !!createdPath} /></label>
        {createdPath && <div role="status">已创建：{createdPath}</div>}
        {error && <div className="dsh-git-error" role="alert">{error}{createdPath ? '（工作树已保留，可重试打开）' : ''}</div>}
      </div>
      <div className="dsh-git-modal-footer">
        <button type="button" className="dsh-git-btn dsh-git-btn-secondary" disabled={submitting} onClick={onClose}>关闭</button>
        <button type="submit" className="dsh-git-btn dsh-git-btn-primary" disabled={submitting || (!createdPath && !name.trim())}>{submitting ? '处理中…' : createdPath ? '重试打开工作区' : onOpenWorktree ? '创建并打开工作区' : '创建工作树'}</button>
      </div>
    </form>
  </DialogShell>
}

export function WorktreeManagerDialog({ path, onClose }: { path: string; onClose: () => void }) {
  const [list, setList] = useState<WorktreeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const controller = new AbortController()
    setList([])
    setLoading(true)
    setError(null)
    gitApi.getWorktrees(path, controller.signal).then(result => {
      if (!controller.signal.aborted) setList(result)
    }).catch(error => {
      if (!controller.signal.aborted) setError(message(error))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [path, refresh])

  const handleDelete = async (worktreePath: string) => {
    if (deleting) return
    setDeleting(worktreePath)
    setError(null)
    try {
      // Intentionally no force option: dirty or locked worktrees must be refused by Git.
      const result = await gitApi.removeWorktree(path, worktreePath)
      if (!result.ok) throw new Error(message(result.error || '删除 Worktree 失败'))
      if (alive.current) { setPendingDelete(null); setRefresh(value => value + 1) }
    } catch (error) { if (alive.current) setError(message(error)) }
    finally { if (alive.current) setDeleting(null) }
  }
  return <DialogShell title="管理 Git Worktrees" onClose={onClose} busy={!!deleting} style={{ width: 640 }}>
    <div className="dsh-git-modal-header">
      <span><IconWorktree size={16} /> 管理 Git Worktrees</span>
      <button type="button" aria-label="关闭" className="dsh-git-icon-btn" disabled={!!deleting} onClick={onClose}><IconClose size={16} /></button>
    </div>
    <div className="dsh-git-modal-body" style={{ maxHeight: 360, overflowY: 'auto' }}>
      {error && <div className="dsh-git-error" role="alert">{error}<button type="button" className="dsh-git-btn dsh-git-btn-secondary" disabled={!!deleting} onClick={() => setRefresh(value => value + 1)}>重新加载</button></div>}
      {loading ? <div className="dsh-git-muted" role="status">加载中…</div> : !error && list.length === 0 ? <div className="dsh-git-muted">暂无 Worktree</div> : list.map(worktree => <div key={worktree.path} className="dsh-git-worktree-row">
        <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}><strong>{worktree.branch || 'HEAD'}</strong>{worktree.isCurrent && '（当前检出）'}{worktree.locked && '（已锁定）'}<div className="dsh-git-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{worktree.path}</div></div>
        {!worktree.isCurrent && <button type="button" className="dsh-git-btn dsh-git-btn-secondary" disabled={!!deleting || worktree.locked} onClick={() => setPendingDelete(worktree.path)}>{deleting === worktree.path ? '删除中…' : '删除'}</button>}
      </div>)}
      {pendingDelete && <div role="group" aria-label="确认删除 Worktree">
        <p>确定删除 {pendingDelete}？有未提交更改或锁定的工作树不会强制删除。</p>
        <button type="button" className="dsh-git-btn dsh-git-btn-secondary" disabled={!!deleting} onClick={() => setPendingDelete(null)}>取消</button>
        <button type="button" className="dsh-git-btn dsh-git-btn-primary" disabled={!!deleting} onClick={() => handleDelete(pendingDelete)}>确认删除</button>
      </div>}
    </div>
    <div className="dsh-git-modal-footer"><button type="button" className="dsh-git-btn dsh-git-btn-secondary" disabled={!!deleting} onClick={onClose}>完成</button></div>
  </DialogShell>
}
