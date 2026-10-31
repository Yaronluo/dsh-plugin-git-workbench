import React, { useEffect, useState } from 'react'
import type { ReflogEntry } from '../../core/types.js'
import { gitApi } from '../api.js'

function errorText(error: unknown, fallback: string): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return fallback
}

export function ReflogPanel({ path }: { path: string }) {
  const [entries, setEntries] = useState<ReflogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [pending, setPending] = useState<ReflogEntry | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    gitApi.getReflog(path, 100, controller.signal).then(result => {
      if (!controller.signal.aborted) setEntries(result)
    }).catch(reason => {
      if (!controller.signal.aborted) setError(errorText(reason, 'Failed to read reflog'))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [path, refresh])

  const copyHash = async () => {
    if (!pending) return
    try {
      await navigator.clipboard.writeText(pending.hash)
      setNotice('Copied commit hash')
      setError(null)
    } catch (reason) {
      setError(errorText(reason, 'Failed to copy hash'))
    }
  }

  const resetToEntry = async () => {
    if (!pending || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await gitApi.resetTo(path, pending.selector, 'soft')
      if (!result.ok) {
        setError(result.error || 'Soft reset failed')
        return
      }
      setNotice(`Soft reset to ${pending.selector}`)
      setPending(null)
      setRefresh(value => value + 1)
    } catch (reason) {
      setError(errorText(reason, 'Soft reset failed'))
    } finally {
      setBusy(false)
    }
  }

  return <div className='dsh-git-scroll-list'>
    {notice && <p className='dsh-git-muted' role='status'>{notice}</p>}
    {error && <p className='dsh-git-error' role='alert'>{error}</p>}
    {loading ? <div className='dsh-git-muted'>Reading reflog…</div>
      : entries.length === 0 ? <div className='dsh-git-empty-state'>No reflog entries</div>
      : entries.map(entry => <button type='button' key={`${entry.selector}-${entry.hash}`}
        className='dsh-git-reflog-row' aria-pressed={pending?.selector === entry.selector}
        onClick={() => { setPending(entry); setError(null); setNotice(null) }}>
        <code>{entry.selector}</code>
        <span>{entry.subject}</span>
        <code>{entry.shortHash}</code>
        <time>{entry.date}</time>
      </button>)}
    {pending && <section className='dsh-git-section' aria-label='Confirm soft reset'>
      <div className='dsh-git-section-head'>Confirm soft reset</div>
      <p>Soft reset the current branch to {pending.selector}({pending.shortHash}), keeping the working tree and staged file contents. This moves the current branch pointer.</p>
      <div className='dsh-git-inline-form'>
        <button type='button' className='dsh-git-btn dsh-git-btn-primary' disabled={busy} onClick={resetToEntry}>Soft reset to here</button>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={busy} onClick={() => setPending(null)}>Cancel</button>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' onClick={copyHash}>Copy hash</button>
      </div>
    </section>}
  </div>
}
