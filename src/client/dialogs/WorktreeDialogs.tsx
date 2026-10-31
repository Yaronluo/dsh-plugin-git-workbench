import React, { useContext, useEffect, useRef, useState } from 'react'
import type { WorktreeItem } from '../../core/types.js'
import { gitApi } from '../api.js'
import { IconCheck, IconClose, IconExternalLink, IconFolderTree, IconRefresh, IconTrash, IconWorktree } from '../icons.js'
import { DialogShell } from './DialogShell.js'
import { GitPanelContext } from '../panels/panel-context.js'

const message = (error: unknown) => error instanceof Error ? error.message : typeof error === 'string' ? error : 'Operation failed'

export function CreateWorktreeDialog({ path, currentBranch, onClose, onSuccess, onOpenWorktree }: {
  path: string; currentBranch?: string; onClose: () => void; onSuccess?: (worktreePath: string) => void
  onOpenWorktree?: (path: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [base, setBase] = useState(currentBranch || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
        if (!result.ok || !result.path) throw new Error(message(result.error || 'Worktree creation failed'))
        destination = result.path
        setCreatedPath(destination)
        onSuccess?.(destination)
      }
      if (onOpenWorktree) await onOpenWorktree(destination)
      onClose()
    } catch (error) { setError(message(error)) }
    finally { setSubmitting(false) }
  }

  return <DialogShell title='Create worktree' onClose={onClose} busy={submitting}>
    <div className='dsh-git-modal-header'>
      <span><IconWorktree size={16} /> Create worktree</span>
      <button type='button' aria-label='Close' className='dsh-git-icon-btn' disabled={submitting} onClick={onClose}><IconClose size={16} /></button>
    </div>
    <form onSubmit={handleSubmit}>
      <div className='dsh-git-modal-body'>
        <div className='dsh-git-muted' style={{ fontSize: 13 }}>Separate worktrees keep parallel tasks from overwriting each other.{onOpenWorktree ? 'It will open in the workspace after creation.' : 'This entry only creates a worktree; it does not create a session automatically.'}</div>
        <label>Worktree task id<input className='dsh-git-input' value={name} onChange={event => setName(event.target.value)} disabled={submitting || !!createdPath} placeholder='e.g. feature-login' autoFocus /></label>
        <label>Base branch<input className='dsh-git-input' value={base} onChange={event => setBase(event.target.value)} disabled={submitting || !!createdPath} /></label>
        {createdPath && <div role='status'>Created: {createdPath}</div>}
        {error && <div className='dsh-git-error' role='alert'>{error}{createdPath ? '(the worktree was kept, you can retry opening it)' : ''}</div>}
      </div>
      <div className='dsh-git-modal-footer'>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={submitting} onClick={onClose}>Close</button>
        <button type='submit' className='dsh-git-btn dsh-git-btn-primary' disabled={submitting || (!createdPath && !name.trim())}>{submitting ? 'Processing…' : createdPath ? 'Retry opening workspace' : onOpenWorktree ? 'Create and open workspace' : 'Create worktree'}</button>
      </div>
    </form>
  </DialogShell>
}

export function WorktreeManagerDialog({ path, onClose, onOpenWorktree }: {
  path: string; onClose?: () => void; onOpenWorktree?: (path: string) => Promise<void>
}) {
  const inline = useContext(GitPanelContext)
  const [list, setList] = useState<WorktreeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [forceDelete, setForceDelete] = useState(false)
  const [lockTarget, setLockTarget] = useState<string | null>(null)
  const [lockReason, setLockReason] = useState('')
  const [pruneOutput, setPruneOutput] = useState<string | null>(null)
  const [pruneReady, setPruneReady] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const alive = useRef(true)
  const close = onClose || (() => {})

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setList([])
    setLoading(true)
    setLoadError(null)
    const load = async () => {
      try {
        const result = await gitApi.getWorktreesWithStatus(path, controller.signal)
        if (!controller.signal.aborted) setList(result)
      } catch {
        if (controller.signal.aborted) return
        try {
          const result = await gitApi.getWorktrees(path, controller.signal)
          if (!controller.signal.aborted) setList(result)
        } catch (fallbackError) {
          if (!controller.signal.aborted) setLoadError(message(fallbackError))
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [path, refreshKey])

  const mutate = async (key: string, action: () => Promise<{ ok: boolean; error?: string }>, success: string, afterSuccess?: () => void) => {
    if (busy) return false
    setBusy(key)
    setActionError(null)
    setNotice(null)
    try {
      const result = await action()
      if (!result.ok) {
        setActionError(result.error || 'Operation failed')
        return false
      }
      setNotice(success)
      afterSuccess?.()
      return true
    } catch (actionError) {
      setActionError(message(actionError))
      return false
    } finally {
      if (alive.current) {
        setBusy(null)
        setRefreshKey(value => value + 1)
      }
    }
  }

  const handleReveal = async (worktreePath: string) => {
    setActionError(null)
    setNotice(null)
    try {
      const result = await gitApi.reveal(path, worktreePath)
      if (!result.ok) setActionError(result.error || 'Cannot reveal the worktree in the file manager')
      else setNotice(`Revealed in the file manager: ${result.target || worktreePath}`)
    } catch (revealError) { setActionError(message(revealError)) }
  }

  const handleOpen = async (worktreePath: string) => {
    if (!onOpenWorktree) return
    setActionError(null)
    setNotice(null)
    try {
      await onOpenWorktree(worktreePath)
      setNotice(`Opened worktree:${worktreePath}`)
    } catch (openError) { setActionError(message(openError)) }
  }

  const previewPrune = async () => {
    if (busy) return
    setBusy('prune-preview')
    setActionError(null)
    setNotice(null)
    setPruneOutput(null)
    setPruneReady(false)
    try {
      const result = await gitApi.pruneWorktrees(path, true)
      if (!result.ok) {
        setActionError(result.error || 'Cleanup preview failed')
        return
      }
      const output = result.output?.trim() || ''
      setPruneOutput(output || 'There are no stale worktrees to clean up.')
      setPruneReady(!!output)
    } catch (pruneError) { setActionError(message(pruneError)) }
    finally { if (alive.current) setBusy(null) }
  }

  const confirmPrune = async () => {
    const completed = await mutate('prune', () => gitApi.pruneWorktrees(path, false), 'Cleaned up stale worktrees', () => setPruneReady(false))
    if (completed) setPruneOutput(null)
  }

  const confirmDelete = (worktreePath: string) => {
    if (pendingDelete !== worktreePath) return
    void mutate(
      `remove:${worktreePath}`,
      () => gitApi.removeWorktree(path, worktreePath, forceDelete),
      'Worktree deleted',
      () => { setPendingDelete(null); setForceDelete(false) },
    )
  }

  const closeDialog = () => { if (!busy) close() }
  const renderManagerBody = () => <>
    {notice && <div className='dsh-git-changes-notice' role='status'>{notice}</div>}
    {actionError && <div className='dsh-git-error' role='alert'>{actionError}</div>}
    {loadError && <div className='dsh-git-error' role='alert'>{loadError}</div>}

    {pruneOutput !== null && <div className='dsh-git-section'>
      <div className='dsh-git-section-head'>Prune preview</div>
      <pre className='dsh-git-code-box'>{pruneOutput}</pre>
      {!pruneReady && <div className='dsh-git-muted' style={{ fontSize: 13 }}>Git leaves a stale entry only when a worktree directory is deleted or moved by hand; removing from this page leaves nothing behind.</div>}
      {pruneReady && <div className='dsh-git-panel-toolbar'>
        <button type='button' className='dsh-git-btn dsh-git-btn-primary' disabled={!!busy} onClick={() => void confirmPrune()}>{busy === 'prune' ? 'Cleaning up…' : 'Confirm cleaning up stale worktrees'}</button>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => { setPruneOutput(null); setPruneReady(false) }}>Cancel</button>
      </div>}
    </div>}

    <section className='dsh-git-section' aria-label='Worktree list'>
      <div className='dsh-git-section-head'>
        <span>Worktree list</span>
        <span className='dsh-git-badge' aria-label={`Total ${list.length} worktrees`}>{list.length} trees</span>
      </div>
      <div className='dsh-git-scroll-list' aria-busy={loading}>
        {loading ? <div className='dsh-git-panel-message'>Reading worktrees…</div>
          : loadError && list.length === 0 ? null
            : list.length === 0 ? <div className='dsh-git-empty-state'>
              <div className='dsh-git-state-icon'><IconWorktree size={24} /></div>
              <strong>No worktrees</strong>
              <p>A worktree checks the branch out into its own directory, which helps with parallel tasks.</p>
            </div>
              : list.map(worktree => <article className='dsh-git-section' key={worktree.path}>
                <div className='dsh-git-worktree-row'>
                  <div className='dsh-git-worktree-copy'>
                    <strong>{worktree.branch || 'HEAD'}</strong>{worktree.isCurrent && '(current checkout)'}
                    <div className='dsh-git-muted dsh-git-worktree-path'>{worktree.path}</div>
                    <div>
                      {(worktree.dirtyFiles || 0) > 0 && <span className='dsh-git-badge-warn'>{worktree.dirtyFiles} uncommitted changes</span>}
                      {worktree.locked && <span className='dsh-git-badge' title={worktree.lockedReason || 'Worktree is locked'}>Locked{worktree.lockedReason ? ` · ${worktree.lockedReason}` : ''}</span>}
                      {worktree.detached && <span className='dsh-git-badge'>Detached</span>}
                      {worktree.prunable && <span className='dsh-git-badge-warn'>Removable</span>}
                    </div>
                  </div>
                  <div className='dsh-git-stash-actions'>
                    {onOpenWorktree && <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => void handleOpen(worktree.path)}><IconExternalLink size={15} />Open session</button>}
                    <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => void handleReveal(worktree.path)}><IconFolderTree size={15} />Reveal in file manager</button>
                    {!worktree.locked && <button type='button' className='dsh-git-btn dsh-git-btn-secondary' aria-expanded={lockTarget === worktree.path} disabled={!!busy} onClick={() => { setLockTarget(lockTarget === worktree.path ? null : worktree.path); setLockReason('') }}><IconWorktree size={15} />Lock</button>}
                    {worktree.locked && <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => void mutate(`unlock:${worktree.path}`, () => gitApi.unlockWorktree(path, worktree.path), 'Worktree unlocked')}><IconCheck size={15} />Unlock</button>}
                    {!worktree.isCurrent && pendingDelete !== worktree.path && <button type='button' className='dsh-git-btn dsh-git-btn-danger' disabled={!!busy || !!worktree.locked} title={worktree.locked ? 'A locked worktree must be unlocked before it can be removed' : undefined} onClick={() => { setForceDelete(false); setPendingDelete(worktree.path) }}><IconTrash size={15} />Remove worktree</button>}
                  </div>
                </div>
                {lockTarget === worktree.path && <div className='dsh-git-panel-toolbar'>
                  <input className='dsh-git-input' aria-label='Lock reason' placeholder='Lock reason (optional)' value={lockReason} onChange={event => setLockReason(event.target.value)} disabled={!!busy} />
                  <button type='button' className='dsh-git-btn dsh-git-btn-primary' disabled={!!busy} onClick={() => void mutate(`lock:${worktree.path}`, () => gitApi.lockWorktree(path, worktree.path, lockReason.trim() || undefined), 'Worktree locked', () => setLockTarget(null))}>{busy === `lock:${worktree.path}` ? 'Locking…' : 'Confirm locking worktree'}</button>
                  <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => setLockTarget(null)}>Cancel</button>
                </div>}
                {pendingDelete === worktree.path && <div className='dsh-git-section' role='group' aria-label='Confirm worktree removal'>
                  <div className='dsh-git-section-head'>Confirm worktree removal</div>
                  <p>A normal removal refuses a worktree with uncommitted changes. Force removal may discard them, so confirm carefully.</p>
                  <label><input className='dsh-git-checkbox' type='checkbox' checked={forceDelete} onChange={event => setForceDelete(event.target.checked)} disabled={!!busy} />Force remove (may discard uncommitted changes)</label>
                  <div className='dsh-git-panel-toolbar'>
                    <button type='button' className='dsh-git-btn dsh-git-btn-danger' disabled={!!busy} onClick={() => confirmDelete(worktree.path)}>{forceDelete ? 'Confirm force-removing the worktree' : 'Confirm worktree removal'}</button>
                    <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => { setPendingDelete(null); setForceDelete(false) }}>Cancel</button>
                  </div>
                </div>}
              </article>)}
      </div>
    </section>
  </>

  if (inline) return <div className='dsh-git-page'>
    <header className='dsh-git-page-header'>
      <div className='dsh-git-page-title'>
        <h2>Manage Git worktrees</h2>
        <p>Inspect standalone working directories and safely open, lock, or remove worktrees.</p>
      </div>
      <div className='dsh-git-page-actions'>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={loading || !!busy} onClick={() => setRefreshKey(value => value + 1)}><IconRefresh size={15} />Refresh</button>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => void previewPrune()}>{busy === 'prune-preview' ? 'Checking…' : 'Preview cleaning up stale worktrees'}</button>
      </div>
    </header>
    <div className='dsh-git-page-body'>{renderManagerBody()}</div>
  </div>

  return <DialogShell title='Manage Git worktrees' onClose={closeDialog} busy={!!busy} style={{ width: 640 }}>
    <div className='dsh-git-modal-header'>
      <span><IconWorktree size={16} /> Manage Git worktrees</span>
      <button type='button' aria-label='Close' className='dsh-git-icon-btn' disabled={!!busy} onClick={closeDialog}><IconClose size={16} /></button>
    </div>
    <div className='dsh-git-modal-body'>
      <div className='dsh-git-panel-toolbar'>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={loading || !!busy} onClick={() => setRefreshKey(value => value + 1)}><IconRefresh size={14} />Refresh</button>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => void previewPrune()}>{busy === 'prune-preview' ? 'Checking…' : 'Preview cleaning up stale worktrees'}</button>
      </div>
      {renderManagerBody()}
    </div>
    <div className='dsh-git-modal-footer'><button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={closeDialog}>Done</button></div>
  </DialogShell>
}
