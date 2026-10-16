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
      if (!controller.signal.aborted) setError(errorText(reason, '读取引用日志失败'))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [path, refresh])

  const copyHash = async () => {
    if (!pending) return
    try {
      await navigator.clipboard.writeText(pending.hash)
      setNotice('已复制提交 hash')
      setError(null)
    } catch (reason) {
      setError(errorText(reason, '复制 hash 失败'))
    }
  }

  const resetToEntry = async () => {
    if (!pending || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await gitApi.resetTo(path, pending.selector, 'soft')
      if (!result.ok) {
        setError(result.error || '软重置失败')
        return
      }
      setNotice(`已软重置到 ${pending.selector}`)
      setPending(null)
      setRefresh(value => value + 1)
    } catch (reason) {
      setError(errorText(reason, '软重置失败'))
    } finally {
      setBusy(false)
    }
  }

  return <div className='dsh-git-scroll-list'>
    {notice && <p className='dsh-git-muted' role='status'>{notice}</p>}
    {error && <p className='dsh-git-error' role='alert'>{error}</p>}
    {loading ? <div className='dsh-git-muted'>正在读取引用日志…</div>
      : entries.length === 0 ? <div className='dsh-git-empty-state'>暂无引用日志</div>
      : entries.map(entry => <button type='button' key={`${entry.selector}-${entry.hash}`}
        className='dsh-git-reflog-row' aria-pressed={pending?.selector === entry.selector}
        onClick={() => { setPending(entry); setError(null); setNotice(null) }}>
        <code>{entry.selector}</code>
        <span>{entry.subject}</span>
        <code>{entry.shortHash}</code>
        <time>{entry.date}</time>
      </button>)}
    {pending && <section className='dsh-git-section' aria-label='确认软重置'>
      <div className='dsh-git-section-head'>软重置确认</div>
      <p>将当前分支软重置到 {pending.selector}（{pending.shortHash}），保留工作区和暂存区的文件内容。此操作会移动当前分支指针。</p>
      <div className='dsh-git-inline-form'>
        <button type='button' className='dsh-git-btn dsh-git-btn-primary' disabled={busy} onClick={resetToEntry}>软重置到此处</button>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={busy} onClick={() => setPending(null)}>取消</button>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' onClick={copyHash}>复制 hash</button>
      </div>
    </section>}
  </div>
}
