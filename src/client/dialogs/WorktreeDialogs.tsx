import React, { useEffect, useState } from 'react'
import type { WorktreeItem } from '../../core/types.js'
import { gitApi } from '../api.js'
import { IconClose, IconWorktree } from '../icons.js'

export function CreateWorktreeDialog({
  path,
  currentBranch,
  onClose,
  onSuccess,
}: {
  path: string
  currentBranch: string
  onClose: () => void
  onSuccess: (worktreePath: string) => void
}) {
  const [name, setName] = useState('')
  const [base, setBase] = useState(currentBranch)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    setError(null)
    try {
      const res = await gitApi.createWorktree(path, name.trim(), base.trim() || undefined)
      if (res.ok && res.path) {
        onSuccess(res.path)
        onClose()
      } else {
        setError(res.error || '创建 Worktree 失败')
      }
    } catch (err: any) {
      setError(err?.message || '创建异常')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dsh-git-modal-overlay" onClick={onClose}>
      <div className="dsh-git-modal-card" onClick={e => e.stopPropagation()}>
        <div className="dsh-git-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconWorktree size={16} />
            <span>在 Worktree 中开始新会话</span>
          </div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}>
            <IconClose size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dsh-git-modal-body">
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
              Worktree 将为并行会话提供独立的代码工作树，避免多任务相互覆盖或切换分支影响其他操作。
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Worktree 任务标识</label>
              <input
                className="dsh-git-input"
                placeholder="例如：feature-login 或 test-exp"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>基线分支</label>
              <input
                className="dsh-git-input"
                value={base}
                onChange={e => setBase(e.target.value)}
              />
            </div>

            {error && (
              <div style={{ color: '#dc2626', fontSize: 12.5, background: '#fef2f2', padding: '6px 10px', borderRadius: 6 }}>
                {error}
              </div>
            )}
          </div>

          <div className="dsh-git-modal-footer">
            <button type="button" className="dsh-git-btn dsh-git-btn-secondary" onClick={onClose}>
              取消
            </button>
            <button
              type="submit"
              className="dsh-git-btn dsh-git-btn-primary"
              disabled={submitting || !name.trim()}
            >
              {submitting ? '创建中...' : '开始独立会话'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function WorktreeManagerDialog({ path, onClose }: { path: string; onClose: () => void }) {
  const [list, setList] = useState<WorktreeItem[]>([])
  const [loading, setLoading] = useState(true)

  const reload = () => {
    setLoading(true)
    gitApi
      .getWorktrees(path)
      .then(res => setList(res))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [path])

  const handleDelete = async (wtPath: string) => {
    if (!confirm(`确定要移除 Worktree 目录 ${wtPath} 吗？`)) return
    await gitApi.removeWorktree(path, wtPath)
    reload()
  }

  return (
    <div className="dsh-git-modal-overlay" onClick={onClose}>
      <div className="dsh-git-modal-card" style={{ width: 640 }} onClick={e => e.stopPropagation()}>
        <div className="dsh-git-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconWorktree size={16} />
            <span>管理 Git Worktrees</span>
          </div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}>
            <IconClose size={16} />
          </button>
        </div>

        <div style={{ padding: '14px 18px', maxHeight: 360, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#6b7280', padding: 20 }}>加载中...</div>
          ) : list.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6b7280', padding: 20 }}>暂无多余 Worktree</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map(wt => (
                <div
                  key={wt.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 6,
                    background: wt.isCurrent ? '#eff6ff' : '#fafafa',
                    border: wt.isCurrent ? '1px solid #bfdbfe' : '1px solid #f3f4f6',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                      <span>{wt.branch}</span>
                      {wt.isCurrent && (
                        <span style={{ fontSize: 11, background: '#3b82f6', color: '#fff', padding: '1px 6px', borderRadius: 10 }}>
                          当前检出
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>
                      {wt.path}
                    </div>
                  </div>

                  {!wt.isCurrent && (
                    <button
                      type="button"
                      className="dsh-git-btn dsh-git-btn-secondary"
                      style={{ color: '#dc2626', borderColor: '#fca5a5', padding: '4px 10px', fontSize: 12 }}
                      onClick={() => handleDelete(wt.path)}
                    >
                      删除
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dsh-git-modal-footer">
          <button type="button" className="dsh-git-btn dsh-git-btn-secondary" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
