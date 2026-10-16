import React, { useEffect, useState } from 'react'
import type { FunctionComponent } from 'react'
import type { BlameLine, BlameView, FileHistoryEntry } from '../../core/types.js'
import { errorMessage, gitApi } from '../api.js'
import { IconClose, IconCopy, IconFile, IconFolderTree, IconRefresh } from '../icons.js'
import { OpenInEditorMenu } from '../editor-menu.js'
import { groupBlameLines } from './blame-groups.js'
import type { CommitDetailDialogProps } from './CommitDetailDialog.js'
import { DialogShell } from './DialogShell.js'
import { SelectedCommitDetails } from './GitGraphDialog.js'

type DialogTab = 'history' | 'blame'
type InspectionResult = {
  key: string
  loading: boolean
  history: FileHistoryEntry[] | null
  blame: BlameView | null
  error: string | null
}
type Notice = { ok: boolean; text: string }

export function FileInspectDialog({ path, file, onClose, onOpenCommit }: {
  path: string; file: string; onClose?: () => void; onOpenCommit?: (hash: string) => void
}) {
  const [tab, setTab] = useState<DialogTab>('history')
  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState<InspectionResult | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  // Which commit the user drilled into from this file's history. Keyed by file so a
  // reused dialog never shows the previous file's commit.
  const [drilled, setDrilled] = useState<{ file: string; hash: string } | null>(null)
  const [DetailComponent, setDetailComponent] = useState<FunctionComponent<CommitDetailDialogProps> | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailAttempt, setDetailAttempt] = useState(0)
  const requestKey = JSON.stringify([path, file, tab, refresh])
  const currentResult = result?.key === requestKey ? result : null
  const loading = currentResult?.loading ?? true
  const close = () => onClose?.()
  const commitRef = drilled && drilled.file === file ? drilled.hash : null

  const openCommit = (hash: string) => {
    onOpenCommit?.(hash)
    setDrilled({ file, hash })
  }

  // The detail view is a lazy chunk; the history list stays usable if it cannot load.
  useEffect(() => {
    if (!commitRef || DetailComponent) return
    let active = true
    setDetailError(null)
    import('./CommitDetailDialog.js').then(module => {
      if (active) setDetailComponent(() => module.CommitDetailDialog)
    }).catch(error => {
      if (active) setDetailError(errorMessage(error))
    })
    return () => { active = false }
  }, [commitRef, DetailComponent, detailAttempt])

  useEffect(() => {
    const controller = new AbortController()
    setResult({ key: requestKey, loading: true, history: null, blame: null, error: null })
    const load = async () => {
      try {
        if (tab === 'history') {
          const history = await gitApi.getFileHistory(path, file, 50, controller.signal)
          if (!controller.signal.aborted) setResult({ key: requestKey, loading: false, history, blame: null, error: null })
        } else {
          const blame = await gitApi.getBlame(path, file, 5000, controller.signal)
          if (!controller.signal.aborted) setResult({ key: requestKey, loading: false, history: null, blame, error: null })
        }
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key: requestKey, loading: false, history: null, blame: null, error: errorMessage(error) })
      }
    }
    void load()
    return () => controller.abort()
  }, [path, file, tab, refresh, requestKey])

  const runApiAction = async (action: () => Promise<{ ok: boolean; error?: string }>, successText: string) => {
    setActionBusy(true)
    setNotice(null)
    try {
      const response = await action()
      setNotice(response.ok
        ? { ok: true, text: successText }
        : { ok: false, text: response.error ?? '操作失败' })
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) })
    } finally {
      setActionBusy(false)
    }
  }

  const copyPath = async () => {
    setActionBusy(true)
    setNotice(null)
    try {
      await navigator.clipboard.writeText(file)
      setNotice({ ok: true, text: '已复制文件路径' })
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) })
    } finally {
      setActionBusy(false)
    }
  }

  const copyBlameHash = async (line: BlameLine) => {
    if (!line.uncommitted) onOpenCommit?.(line.hash)
    setNotice(null)
    try {
      await navigator.clipboard.writeText(line.hash)
      setNotice({ ok: true, text: `已复制提交哈希：${line.shortHash}` })
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) })
    }
  }

  const history = currentResult?.history ?? null
  const blame = currentResult?.blame ?? null
  const requestError = currentResult?.error ?? null

  return <DialogShell title={'文件 · ' + file} onClose={close} style={{ width: 820, maxWidth: '94vw', maxHeight: '90vh' }}>
    <div className="dsh-git-modal-header">
      <span><IconFile size={16} />文件 · {file}</span>
      <button type="button" aria-label="关闭" className="dsh-git-icon-btn" onClick={close}><IconClose size={16} /></button>
    </div>
    <div className="dsh-git-modal-body" style={{ padding: 0, gap: 0, flex: 1, minHeight: 0, overflow: 'auto' }}>
      <div className="dsh-git-tab-strip" role="tablist" aria-label="文件检查视图" style={{ margin: '10px 12px 0' }}>
        <button type="button" role="tab" aria-selected={tab === 'history'} className={`dsh-git-tab ${tab === 'history' ? 'dsh-git-tab-active' : ''}`} onClick={() => { setNotice(null); setTab('history'); setDrilled(null) }}>历史</button>
        <button type="button" role="tab" aria-selected={tab === 'blame'} className={`dsh-git-tab ${tab === 'blame' ? 'dsh-git-tab-active' : ''}`} onClick={() => { setNotice(null); setTab('blame'); setDrilled(null) }}>责任</button>
      </div>

      {tab === 'history' ? <>
        <div className="dsh-git-panel-toolbar">
          <span className="dsh-git-section-head">提交历史 <span className="dsh-git-badge">{history?.length ?? 0}</span></span>
          <span className="dsh-git-spacer" />
          <button type="button" className="dsh-git-btn dsh-git-btn-secondary" disabled={actionBusy} onClick={() => { void copyPath() }}><IconCopy size={14} />复制路径</button>
          <OpenInEditorMenu repo={path} file={file} onNotice={setNotice} />
          <button type="button" className="dsh-git-btn dsh-git-btn-secondary" disabled={actionBusy} onClick={() => { void runApiAction(() => gitApi.reveal(path, file), '已在文件管理器中打开') }}><IconFolderTree size={14} />打开文件管理器</button>
          <button type="button" className="dsh-git-btn dsh-git-btn-secondary" aria-label="刷新文件历史" title="刷新" disabled={loading} onClick={() => setRefresh(value => value + 1)}><IconRefresh size={14} className={loading ? 'dsh-git-spin' : ''} />刷新</button>
        </div>
        {notice && <div className={`dsh-git-changes-notice ${notice.ok ? '' : 'dsh-git-error'}`} role={notice.ok ? 'status' : 'alert'}>{notice.text}</div>}
        {commitRef ? <SelectedCommitDetails path={path} commitRef={commitRef}
          DetailComponent={DetailComponent} loadError={detailError} showBackButton
          onBack={() => setDrilled(null)}
          onRetry={() => setDetailAttempt(value => value + 1)} />
          : <div className="dsh-git-scroll-list">
            {loading ? <div className="dsh-git-panel-message" role="status">正在读取文件历史…</div>
              : requestError ? <div className="dsh-git-empty-state"><div className="dsh-git-error" role="alert">{requestError}</div></div>
                : !history?.length ? <div className="dsh-git-empty-state">暂无文件历史</div>
                  : history.map(entry => <button type="button" key={entry.hash} className="dsh-git-reflog-row" title={entry.hash} onClick={() => openCommit(entry.hash)}>
                    <code>{entry.shortHash}</code>
                    <span>{entry.subject}</span>
                    <span className="dsh-git-muted" style={{ flex: '0 1 auto' }}>{entry.author}</span>
                    <time className="dsh-git-muted">{entry.date}</time>
                  </button>)}
          </div>}
      </> : <>
        <div className="dsh-git-panel-toolbar">
          <span className="dsh-git-mono" title={file}>{file}</span>
          <span className="dsh-git-spacer" />
          {blame && <span className="dsh-git-muted">共 {blame.totalLines} 行</span>}
          <button type="button" className="dsh-git-btn dsh-git-btn-secondary" aria-label="刷新责任信息" title="刷新" disabled={loading} onClick={() => setRefresh(value => value + 1)}><IconRefresh size={14} className={loading ? 'dsh-git-spin' : ''} />刷新</button>
        </div>
        {notice && <div className={`dsh-git-changes-notice ${notice.ok ? '' : 'dsh-git-error'}`} role={notice.ok ? 'status' : 'alert'}>{notice.text}</div>}
        {blame?.truncated && <div className="dsh-git-muted" role="status" style={{ padding: '6px 12px' }}>只显示了前 5000 行，文件共 {blame.totalLines} 行</div>}
        <div className="dsh-git-scroll-list">
          {loading ? <div className="dsh-git-panel-message" role="status">正在读取责任信息…</div>
            : requestError ? <div className="dsh-git-empty-state"><div className="dsh-git-error" role="alert">{requestError}</div></div>
              : !blame?.lines.length ? <div className="dsh-git-empty-state">暂无责任信息</div>
                : groupBlameLines(blame.lines).map(({ line, continuation }) => <button type="button" key={`${line.lineNumber}-${line.hash}`} className="dsh-git-blame-row" title={line.uncommitted ? '未提交' : line.hash} onClick={() => { void copyBlameHash(line) }} style={{ width: '100%', border: 0, background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
                  <span className={`dsh-git-blame-meta ${continuation ? 'dsh-git-same-commit' : ''}`}>
                    <code>{continuation || line.uncommitted ? '' : line.shortHash}</code>
                    <span>{continuation ? '' : line.uncommitted ? '未提交' : line.author}</span>
                    <time>{continuation || line.uncommitted ? '' : line.date}</time>
                  </span>
                  <span className="dsh-git-blame-num">{line.lineNumber}</span>
                  <span style={{ whiteSpace: 'pre' }}>{line.content}</span>
                </button>)}
        </div>
      </>}
    </div>
  </DialogShell>
}
