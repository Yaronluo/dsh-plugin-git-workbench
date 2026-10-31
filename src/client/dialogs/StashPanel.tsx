import React, { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { DiffView, StashEntry } from '../../core/types.js'
import { gitApi } from '../api.js'
import { IconCheck, IconClose, IconDiff, IconRefresh, IconStash, IconTrash, IconUndo } from '../icons.js'

const errorMessage = (error: unknown) => error instanceof Error ? error.message : typeof error === 'string' ? error : 'Operation failed'

interface StashDiffState {
  index: number
  loading: boolean
  view?: DiffView
  error?: string
}

export function StashPanel({ path, onClose }: { path: string; onClose?: () => void }) {
  const [stashes, setStashes] = useState<StashEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [stashMessage, setStashMessage] = useState('')
  const [includeUntracked, setIncludeUntracked] = useState(false)
  const [keepIndex, setKeepIndex] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [pendingDrop, setPendingDrop] = useState<number | null>(null)
  const [diff, setDiff] = useState<StashDiffState | null>(null)
  const diffRequest = useRef<AbortController | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      diffRequest.current?.abort()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError(null)
    gitApi.getStashes(path, controller.signal).then(result => {
      if (!controller.signal.aborted) setStashes(result)
    }).catch(error => {
      if (!controller.signal.aborted) setLoadError(errorMessage(error))
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [path, refreshKey])

  useEffect(() => {
    diffRequest.current?.abort()
    setDiff(null)
    return () => diffRequest.current?.abort()
  }, [path])

  const runMutation = async (key: string, action: () => Promise<{ ok: boolean; error?: string }>, success: string): Promise<boolean> => {
    if (busy) return false
    diffRequest.current?.abort()
    setDiff(null)
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
      setDiff(null)
      setPendingDrop(null)
      return true
    } catch (error) {
      setActionError(errorMessage(error))
      return false
    } finally {
      if (alive.current) {
        setBusy(null)
        setRefreshKey(value => value + 1)
      }
    }
  }

  const showDiff = async (stash: StashEntry) => {
    if (busy) return
    diffRequest.current?.abort()
    const controller = new AbortController()
    diffRequest.current = controller
    setDiff({ index: stash.index, loading: true })
    setActionError(null)
    try {
      const view = await gitApi.getStashDiff(path, stash.index, controller.signal)
      if (!controller.signal.aborted) setDiff({ index: stash.index, loading: false, view })
    } catch (error) {
      if (!controller.signal.aborted) setDiff({ index: stash.index, loading: false, error: errorMessage(error) })
    }
  }

  const createStash = async (event: FormEvent) => {
    event.preventDefault()
    const created = await runMutation('push', () => gitApi.stashPush(path, {
      message: stashMessage.trim() || undefined,
      includeUntracked,
      keepIndex,
    }), 'Current changes stashed')
    if (!created) return
    setShowForm(false)
    setStashMessage('')
    setIncludeUntracked(false)
    setKeepIndex(false)
  }

  const renderDiff = (stash: StashEntry) => {
    if (diff?.index !== stash.index) return null
    if (diff.loading) return <div className='dsh-git-section'><div className='dsh-git-panel-message'>Reading stash diff…</div></div>
    if (diff.error) return <div className='dsh-git-section'><div className='dsh-git-error' role='alert'>{diff.error}</div></div>
    if (!diff.view?.files.length) return <div className='dsh-git-section'><div className='dsh-git-muted'>No diff to display</div></div>
    return diff.view.files.map(file => <div className='dsh-git-section' key={`${stash.index}:${file.path}`}>
      <div className='dsh-git-section-head'>{file.path}</div>
      {file.binary
        ? <div className='dsh-git-binary-note'>Binary file; no text patch to display</div>
        : <pre className='dsh-git-code-box'>{file.rawPatch || 'No text patch to display'}</pre>}
    </div>)
  }

  return <div className='dsh-git-page'>
    <header className='dsh-git-page-header'>
      <div className='dsh-git-page-title'>
        <h2 className='dsh-git-panel-heading'>Stashes</h2>
        <p>Save the current uncommitted changes; you can review the diff and reapply them later.</p>
      </div>
      <div className='dsh-git-page-actions'>
        <button type='button' className={`dsh-git-btn ${showForm ? 'dsh-git-btn-secondary' : 'dsh-git-btn-primary'}`} disabled={!!busy} aria-expanded={showForm} onClick={() => setShowForm(value => !value)}>
          <IconStash size={15} />{showForm ? 'Cancel creation' : 'Create stash'}
        </button>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' title='Refresh stashes' aria-label='Refresh stashes' disabled={loading || !!busy} onClick={() => setRefreshKey(value => value + 1)}>
          <IconRefresh size={15} className={loading ? 'dsh-git-spin' : ''} />Refresh
        </button>
        {onClose && <button type='button' className='dsh-git-btn dsh-git-btn-secondary' onClick={onClose}>Close</button>}
      </div>
    </header>

    <div className='dsh-git-page-body'>
      {notice && <div className='dsh-git-changes-notice' role='status'>{notice}</div>}
      {actionError && <div className='dsh-git-error' role='alert'>{actionError}</div>}
      {loadError && <div className='dsh-git-error' role='alert'>{loadError}</div>}

      {showForm && <form className='dsh-git-section' onSubmit={createStash}>
        <div className='dsh-git-section-head'>Create stash</div>
        <input className='dsh-git-input' aria-label='Stash description' placeholder='Stash message (optional)' value={stashMessage} onChange={event => setStashMessage(event.target.value)} disabled={!!busy} />
        <label><input className='dsh-git-checkbox' type='checkbox' checked={includeUntracked} onChange={event => setIncludeUntracked(event.target.checked)} disabled={!!busy} />Include untracked files</label>
        <label><input className='dsh-git-checkbox' type='checkbox' checked={keepIndex} onChange={event => setKeepIndex(event.target.checked)} disabled={!!busy} />Keep staged changes</label>
        <div className='dsh-git-panel-toolbar'>
          <button type='submit' className='dsh-git-btn dsh-git-btn-primary' disabled={!!busy}>{busy === 'push' ? 'Creating stash…' : 'Confirm creating stash'}</button>
          <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      </form>}

      <section className='dsh-git-section' aria-label='Stash list'>
        <div className='dsh-git-section-head'>
          <span>Stash list</span>
          <span className='dsh-git-badge' aria-label={`Total ${stashes.length} stashes`}>{stashes.length} </span>
        </div>
        <div className='dsh-git-scroll-list' aria-busy={loading}>
          {loading ? <div className='dsh-git-panel-message'>Loading stashes…</div>
            : loadError ? null
              : stashes.length === 0 ? <div className='dsh-git-empty-state'>
                <div className='dsh-git-state-icon'><IconStash size={24} /></div>
                <strong>No stashes</strong>
                <p>After you create a stash, the changes live here; you can preview the diff, apply, or pop the stash.</p>
              </div>
                : stashes.map(stash => <div className='dsh-git-section' key={`${stash.index}:${stash.hash}`}>
                  <div className='dsh-git-stash-row'>
                    <div className='dsh-git-stash-copy'>
                      <strong className='dsh-git-stash-subject'>{stash.subject}</strong>
                      <div className='dsh-git-stash-meta'>{[stash.selector, stash.shortHash || stash.hash, stash.branch, stash.date].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div className='dsh-git-stash-actions'>
                      <button type='button' className='dsh-git-btn dsh-git-btn-secondary' aria-expanded={diff?.index === stash.index} disabled={!!busy} onClick={() => { if (diff?.index === stash.index) { diffRequest.current?.abort(); setDiff(null) } else void showDiff(stash) }}>
                        <IconDiff size={15} />{diff?.index === stash.index ? 'Collapse diff' : 'View diff'}
                      </button>
                      <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => void runMutation(`apply:${stash.index}`, () => gitApi.stashApply(path, stash.index, false), 'Stash applied')}>
                        <IconCheck size={15} />Apply
                      </button>
                      <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => void runMutation(`pop:${stash.index}`, () => gitApi.stashApply(path, stash.index, true), 'Stash popped')}>
                        <IconUndo size={15} />Pop and remove
                      </button>
                      {pendingDrop === stash.index ? <>
                        <button type='button' className='dsh-git-btn dsh-git-btn-danger' disabled={!!busy} onClick={() => void runMutation(`drop:${stash.index}`, () => gitApi.stashDrop(path, stash.index), 'Stash dropped')}>
                          <IconCheck size={15} />Confirm delete
                        </button>
                        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => setPendingDrop(null)}><IconClose size={15} />Cancel</button>
                      </> : <button type='button' className='dsh-git-btn dsh-git-btn-danger' disabled={!!busy} onClick={() => setPendingDrop(stash.index)}>
                        <IconTrash size={15} />Delete stash
                      </button>}
                    </div>
                  </div>
                  {pendingDrop === stash.index && <div className='dsh-git-muted' role='alert'>Confirming again deletes this stash permanently; otherwise cancel.</div>}
                  {renderDiff(stash)}
                </div>)}
        </div>
      </section>
    </div>
  </div>
}
