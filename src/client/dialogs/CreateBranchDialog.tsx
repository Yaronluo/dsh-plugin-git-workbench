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
        setError(res.error?.message || 'Failed to create branch')
      }
    } catch (err: any) {
      setError(err?.message || 'Error creating branch')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogShell title="Create and check out new branch" busy={submitting} onClose={onClose}>
        <div className="dsh-git-modal-header">
          <span>Create and check out new branch</span>
          <button type="button" aria-label="Close" className="dsh-git-icon-btn" disabled={submitting} onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dsh-git-modal-body">
            <div>
              <label htmlFor="dsh-git-branch-name" style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>New branch name</label>
              <input
                className="dsh-git-input"
                id="dsh-git-branch-name"
                disabled={submitting}
                placeholder="e.g.: feature/awesome-ui"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="dsh-git-branch-base" style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>From branch / commit (optional)</label>
              <input
                className="dsh-git-input"
                id="dsh-git-branch-base"
                disabled={submitting}
                placeholder="Defaults to the current branch HEAD"
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
              Cancel
            </button>
            <button
              type="submit"
              className="dsh-git-btn dsh-git-btn-primary"
              disabled={submitting || !name.trim()}
            >
              {submitting ? 'Creating...' : 'Create and checkout'}
            </button>
          </div>
        </form>
    </DialogShell>
  )
}
