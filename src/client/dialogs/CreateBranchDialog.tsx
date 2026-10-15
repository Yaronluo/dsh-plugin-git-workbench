import React, { useState } from 'react'
import { IconClose } from '../icons.js'
import { gitApi } from '../api.js'
import { DialogShell } from './DialogShell.js'

export interface CreateBranchDialogProps {
  path: string
  currentBranch: string
  onClose: () => void
  onSuccess: (newBranch: string) => void
}

export function CreateBranchDialog({ path, currentBranch, onClose, onSuccess }: CreateBranchDialogProps) {
  const [name, setName] = useState('')
  const [base, setBase] = useState(currentBranch)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || submitting) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await gitApi.createBranch(path, name.trim(), base.trim() || undefined)
      if (res.ok && res.branch) {
        onSuccess(res.branch)
        onClose()
      } else {
        setError(res.error?.message || '创建分支失败')
      }
    } catch (err: any) {
      setError(err?.message || '创建分支发生错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogShell title="创建并检出新分支" busy={submitting} onClose={onClose}>
        <div className="dsh-git-modal-header">
          <span>创建并检出新分支</span>
          <button type="button" aria-label="关闭" className="dsh-git-icon-btn" disabled={submitting} onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dsh-git-modal-body">
            <div>
              <label htmlFor="dsh-git-branch-name" style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>新分支名称</label>
              <input
                className="dsh-git-input"
                id="dsh-git-branch-name"
                disabled={submitting}
                placeholder="例如：feature/awesome-ui"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="dsh-git-branch-base" style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>基于分支 / Commit (可选)</label>
              <input
                className="dsh-git-input"
                id="dsh-git-branch-base"
                disabled={submitting}
                placeholder="默认为当前分支 HEAD"
                value={base}
                onChange={e => setBase(e.target.value)}
              />
            </div>

            {error && (
              <div role="alert" className="dsh-git-error" style={{ fontSize: 12.5, padding: '6px 10px', borderRadius: 6 }}>
                {error}
              </div>
            )}
          </div>

          <div className="dsh-git-modal-footer">
            <button type="button" className="dsh-git-btn dsh-git-btn-secondary" disabled={submitting} onClick={onClose}>
              取消
            </button>
            <button
              type="submit"
              className="dsh-git-btn dsh-git-btn-primary"
              disabled={submitting || !name.trim()}
            >
              {submitting ? '创建中...' : '创建并检出'}
            </button>
          </div>
        </form>
    </DialogShell>
  )
}
