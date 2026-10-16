import React, { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { DiffView, StashEntry } from '../../core/types.js'
import { gitApi } from '../api.js'
import { IconCheck, IconClose, IconDiff, IconRefresh, IconStash, IconTrash, IconUndo } from '../icons.js'

const errorMessage = (error: unknown) => error instanceof Error ? error.message : typeof error === 'string' ? error : '操作失败'

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
        setActionError(result.error || '操作失败')
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
    }), '已储藏当前改动')
    if (!created) return
    setShowForm(false)
    setStashMessage('')
    setIncludeUntracked(false)
    setKeepIndex(false)
  }

  const renderDiff = (stash: StashEntry) => {
    if (diff?.index !== stash.index) return null
    if (diff.loading) return <div className='dsh-git-section'><div className='dsh-git-panel-message'>正在读取储藏差异…</div></div>
    if (diff.error) return <div className='dsh-git-section'><div className='dsh-git-error' role='alert'>{diff.error}</div></div>
    if (!diff.view?.files.length) return <div className='dsh-git-section'><div className='dsh-git-muted'>没有可显示的差异</div></div>
    return diff.view.files.map(file => <div className='dsh-git-section' key={`${stash.index}:${file.path}`}>
      <div className='dsh-git-section-head'>{file.path}</div>
      {file.binary
        ? <div className='dsh-git-binary-note'>二进制文件，无法显示文本补丁</div>
        : <pre className='dsh-git-code-box'>{file.rawPatch || '没有可显示的文本补丁'}</pre>}
    </div>)
  }

  return <div className='dsh-git-page'>
    <header className='dsh-git-page-header'>
      <div className='dsh-git-page-title'>
        <h2 className='dsh-git-panel-heading'>储藏</h2>
        <p>保存当前未提交的改动，之后可以查看差异并重新应用。</p>
      </div>
      <div className='dsh-git-page-actions'>
        <button type='button' className={`dsh-git-btn ${showForm ? 'dsh-git-btn-secondary' : 'dsh-git-btn-primary'}`} disabled={!!busy} aria-expanded={showForm} onClick={() => setShowForm(value => !value)}>
          <IconStash size={15} />{showForm ? '取消创建' : '创建储藏'}
        </button>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' title='刷新储藏' aria-label='刷新储藏' disabled={loading || !!busy} onClick={() => setRefreshKey(value => value + 1)}>
          <IconRefresh size={15} className={loading ? 'dsh-git-spin' : ''} />刷新
        </button>
        {onClose && <button type='button' className='dsh-git-btn dsh-git-btn-secondary' onClick={onClose}>关闭</button>}
      </div>
    </header>

    <div className='dsh-git-page-body'>
      {notice && <div className='dsh-git-changes-notice' role='status'>{notice}</div>}
      {actionError && <div className='dsh-git-error' role='alert'>{actionError}</div>}
      {loadError && <div className='dsh-git-error' role='alert'>{loadError}</div>}

      {showForm && <form className='dsh-git-section' onSubmit={createStash}>
        <div className='dsh-git-section-head'>创建储藏</div>
        <input className='dsh-git-input' aria-label='储藏说明' placeholder='储藏说明（可选）' value={stashMessage} onChange={event => setStashMessage(event.target.value)} disabled={!!busy} />
        <label><input className='dsh-git-checkbox' type='checkbox' checked={includeUntracked} onChange={event => setIncludeUntracked(event.target.checked)} disabled={!!busy} />包含未跟踪文件</label>
        <label><input className='dsh-git-checkbox' type='checkbox' checked={keepIndex} onChange={event => setKeepIndex(event.target.checked)} disabled={!!busy} />保留暂存区</label>
        <div className='dsh-git-panel-toolbar'>
          <button type='submit' className='dsh-git-btn dsh-git-btn-primary' disabled={!!busy}>{busy === 'push' ? '正在创建储藏…' : '确认创建储藏'}</button>
          <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => setShowForm(false)}>取消</button>
        </div>
      </form>}

      <section className='dsh-git-section' aria-label='储藏列表'>
        <div className='dsh-git-section-head'>
          <span>储藏列表</span>
          <span className='dsh-git-badge' aria-label={`共 ${stashes.length} 个储藏`}>{stashes.length} 个</span>
        </div>
        <div className='dsh-git-scroll-list' aria-busy={loading}>
          {loading ? <div className='dsh-git-panel-message'>正在加载储藏…</div>
            : loadError ? null
              : stashes.length === 0 ? <div className='dsh-git-empty-state'>
                <div className='dsh-git-state-icon'><IconStash size={24} /></div>
                <strong>没有储藏</strong>
                <p>创建储藏后，改动会保存在这里；你可以预览差异、应用或弹出储藏。</p>
              </div>
                : stashes.map(stash => <div className='dsh-git-section' key={`${stash.index}:${stash.hash}`}>
                  <div className='dsh-git-stash-row'>
                    <div className='dsh-git-stash-copy'>
                      <strong className='dsh-git-stash-subject'>{stash.subject}</strong>
                      <div className='dsh-git-stash-meta'>{[stash.selector, stash.shortHash || stash.hash, stash.branch, stash.date].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div className='dsh-git-stash-actions'>
                      <button type='button' className='dsh-git-btn dsh-git-btn-secondary' aria-expanded={diff?.index === stash.index} disabled={!!busy} onClick={() => { if (diff?.index === stash.index) { diffRequest.current?.abort(); setDiff(null) } else void showDiff(stash) }}>
                        <IconDiff size={15} />{diff?.index === stash.index ? '收起差异' : '查看差异'}
                      </button>
                      <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => void runMutation(`apply:${stash.index}`, () => gitApi.stashApply(path, stash.index, false), '已应用储藏')}>
                        <IconCheck size={15} />应用
                      </button>
                      <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => void runMutation(`pop:${stash.index}`, () => gitApi.stashApply(path, stash.index, true), '已弹出储藏')}>
                        <IconUndo size={15} />弹出并移除
                      </button>
                      {pendingDrop === stash.index ? <>
                        <button type='button' className='dsh-git-btn dsh-git-btn-danger' disabled={!!busy} onClick={() => void runMutation(`drop:${stash.index}`, () => gitApi.stashDrop(path, stash.index), '已删除储藏')}>
                          <IconCheck size={15} />确认删除
                        </button>
                        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => setPendingDrop(null)}><IconClose size={15} />取消</button>
                      </> : <button type='button' className='dsh-git-btn dsh-git-btn-danger' disabled={!!busy} onClick={() => setPendingDrop(stash.index)}>
                        <IconTrash size={15} />删除储藏
                      </button>}
                    </div>
                  </div>
                  {pendingDrop === stash.index && <div className='dsh-git-muted' role='alert'>再次确认后会永久删除此储藏，或取消此操作。</div>}
                  {renderDiff(stash)}
                </div>)}
        </div>
      </section>
    </div>
  </div>
}
