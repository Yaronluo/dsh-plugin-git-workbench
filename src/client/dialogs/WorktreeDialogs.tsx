import React, { useContext, useEffect, useRef, useState } from 'react'
import type { WorktreeItem } from '../../core/types.js'
import { gitApi } from '../api.js'
import { IconCheck, IconClose, IconExternalLink, IconFolderTree, IconRefresh, IconTrash, IconWorktree } from '../icons.js'
import { DialogShell } from './DialogShell.js'
import { GitPanelContext } from '../panels/panel-context.js'

const message = (error: unknown) => error instanceof Error ? error.message : typeof error === 'string' ? error : '操作失败'

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
        if (!result.ok || !result.path) throw new Error(message(result.error || '创建工作树 失败'))
        destination = result.path
        setCreatedPath(destination)
        onSuccess?.(destination)
      }
      if (onOpenWorktree) await onOpenWorktree(destination)
      onClose()
    } catch (error) { setError(message(error)) }
    finally { setSubmitting(false) }
  }

  return <DialogShell title='创建工作树' onClose={onClose} busy={submitting}>
    <div className='dsh-git-modal-header'>
      <span><IconWorktree size={16} /> 创建工作树</span>
      <button type='button' aria-label='关闭' className='dsh-git-icon-btn' disabled={submitting} onClick={onClose}><IconClose size={16} /></button>
    </div>
    <form onSubmit={handleSubmit}>
      <div className='dsh-git-modal-body'>
        <div className='dsh-git-muted' style={{ fontSize: 13 }}>独立工作树可避免并行任务相互覆盖。{onOpenWorktree ? '创建后将在工作区中打开。' : '当前入口仅创建工作树，不自动创建会话。'}</div>
        <label>工作树任务标识<input className='dsh-git-input' value={name} onChange={event => setName(event.target.value)} disabled={submitting || !!createdPath} placeholder='例如 feature-login' autoFocus /></label>
        <label>基线分支<input className='dsh-git-input' value={base} onChange={event => setBase(event.target.value)} disabled={submitting || !!createdPath} /></label>
        {createdPath && <div role='status'>已创建：{createdPath}</div>}
        {error && <div className='dsh-git-error' role='alert'>{error}{createdPath ? '（工作树已保留，可重试打开）' : ''}</div>}
      </div>
      <div className='dsh-git-modal-footer'>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={submitting} onClick={onClose}>关闭</button>
        <button type='submit' className='dsh-git-btn dsh-git-btn-primary' disabled={submitting || (!createdPath && !name.trim())}>{submitting ? '处理中…' : createdPath ? '重试打开工作区' : onOpenWorktree ? '创建并打开工作区' : '创建工作树'}</button>
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
        setActionError(result.error || '操作失败')
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
      if (!result.ok) setActionError(result.error || '无法在文件管理器中显示工作树')
      else setNotice(`已在文件管理器中显示：${result.target || worktreePath}`)
    } catch (revealError) { setActionError(message(revealError)) }
  }

  const handleOpen = async (worktreePath: string) => {
    if (!onOpenWorktree) return
    setActionError(null)
    setNotice(null)
    try {
      await onOpenWorktree(worktreePath)
      setNotice(`已打开工作树：${worktreePath}`)
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
        setActionError(result.error || '清理预览失败')
        return
      }
      setPruneOutput(result.output || '没有可清理的失效工作树。')
      setPruneReady(true)
    } catch (pruneError) { setActionError(message(pruneError)) }
    finally { if (alive.current) setBusy(null) }
  }

  const confirmPrune = async () => {
    const completed = await mutate('prune', () => gitApi.pruneWorktrees(path, false), '已清理失效工作树', () => setPruneReady(false))
    if (completed) setPruneOutput(null)
  }

  const confirmDelete = (worktreePath: string) => {
    if (pendingDelete !== worktreePath) return
    void mutate(
      `remove:${worktreePath}`,
      () => gitApi.removeWorktree(path, worktreePath, forceDelete),
      '已删除工作树',
      () => { setPendingDelete(null); setForceDelete(false) },
    )
  }

  const closeDialog = () => { if (!busy) close() }
  const renderManagerBody = () => <>
    {notice && <div className='dsh-git-changes-notice' role='status'>{notice}</div>}
    {actionError && <div className='dsh-git-error' role='alert'>{actionError}</div>}
    {loadError && <div className='dsh-git-error' role='alert'>{loadError}</div>}

    {pruneOutput !== null && <div className='dsh-git-section'>
      <div className='dsh-git-section-head'>清理预览</div>
      <pre className='dsh-git-code-box'>{pruneOutput}</pre>
      {pruneReady && <div className='dsh-git-panel-toolbar'>
        <button type='button' className='dsh-git-btn dsh-git-btn-primary' disabled={!!busy} onClick={() => void confirmPrune()}>{busy === 'prune' ? '正在清理…' : '确认清理失效工作树'}</button>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => { setPruneOutput(null); setPruneReady(false) }}>取消</button>
      </div>}
    </div>}

    <section className='dsh-git-section' aria-label='工作树列表'>
      <div className='dsh-git-section-head'>
        <span>工作树列表</span>
        <span className='dsh-git-badge' aria-label={`共 ${list.length} 棵工作树`}>{list.length} 棵</span>
      </div>
      <div className='dsh-git-scroll-list' aria-busy={loading}>
        {loading ? <div className='dsh-git-panel-message'>正在读取工作树…</div>
          : loadError && list.length === 0 ? null
            : list.length === 0 ? <div className='dsh-git-empty-state'>
              <div className='dsh-git-state-icon'><IconWorktree size={24} /></div>
              <strong>暂无工作树</strong>
              <p>创建工作树后，它会在独立目录检出分支，便于并行处理任务。</p>
            </div>
              : list.map(worktree => <article className='dsh-git-section' key={worktree.path}>
                <div className='dsh-git-worktree-row'>
                  <div className='dsh-git-worktree-copy'>
                    <strong>{worktree.branch || 'HEAD'}</strong>{worktree.isCurrent && '（当前检出）'}
                    <div className='dsh-git-muted dsh-git-worktree-path'>{worktree.path}</div>
                    <div>
                      {(worktree.dirtyFiles || 0) > 0 && <span className='dsh-git-badge-warn'>{worktree.dirtyFiles} 个未提交改动</span>}
                      {worktree.locked && <span className='dsh-git-badge' title={worktree.lockedReason || '工作树已锁定'}>已锁定{worktree.lockedReason ? ` · ${worktree.lockedReason}` : ''}</span>}
                      {worktree.detached && <span className='dsh-git-badge'>已分离</span>}
                      {worktree.prunable && <span className='dsh-git-badge-warn'>可清理</span>}
                    </div>
                  </div>
                  <div className='dsh-git-stash-actions'>
                    {onOpenWorktree && <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => void handleOpen(worktree.path)}><IconExternalLink size={15} />打开会话</button>}
                    <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => void handleReveal(worktree.path)}><IconFolderTree size={15} />在文件管理器中显示</button>
                    {!worktree.locked && <button type='button' className='dsh-git-btn dsh-git-btn-secondary' aria-expanded={lockTarget === worktree.path} disabled={!!busy} onClick={() => { setLockTarget(lockTarget === worktree.path ? null : worktree.path); setLockReason('') }}><IconWorktree size={15} />锁定</button>}
                    {worktree.locked && <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => void mutate(`unlock:${worktree.path}`, () => gitApi.unlockWorktree(path, worktree.path), '已解锁工作树')}><IconCheck size={15} />解锁</button>}
                    {!worktree.isCurrent && pendingDelete !== worktree.path && <button type='button' className='dsh-git-btn dsh-git-btn-danger' disabled={!!busy} onClick={() => { setForceDelete(false); setPendingDelete(worktree.path) }}><IconTrash size={15} />移除工作树</button>}
                  </div>
                </div>
                {lockTarget === worktree.path && <div className='dsh-git-panel-toolbar'>
                  <input className='dsh-git-input' aria-label='锁定原因' placeholder='锁定原因（可选）' value={lockReason} onChange={event => setLockReason(event.target.value)} disabled={!!busy} />
                  <button type='button' className='dsh-git-btn dsh-git-btn-primary' disabled={!!busy} onClick={() => void mutate(`lock:${worktree.path}`, () => gitApi.lockWorktree(path, worktree.path, lockReason.trim() || undefined), '已锁定工作树', () => setLockTarget(null))}>{busy === `lock:${worktree.path}` ? '正在锁定…' : '确认锁定工作树'}</button>
                  <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => setLockTarget(null)}>取消</button>
                </div>}
                {pendingDelete === worktree.path && <div className='dsh-git-section' role='group' aria-label='确认移除工作树'>
                  <div className='dsh-git-section-head'>确认移除工作树</div>
                  <p>普通移除会拒绝含未提交改动的工作树。强制移除可能丢弃改动，请谨慎确认。</p>
                  <label><input className='dsh-git-checkbox' type='checkbox' checked={forceDelete} onChange={event => setForceDelete(event.target.checked)} disabled={!!busy} />强制移除（可能丢弃未提交改动）</label>
                  <div className='dsh-git-panel-toolbar'>
                    <button type='button' className='dsh-git-btn dsh-git-btn-danger' disabled={!!busy} onClick={() => confirmDelete(worktree.path)}>{forceDelete ? '确认强制移除工作树' : '确认移除工作树'}</button>
                    <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => { setPendingDelete(null); setForceDelete(false) }}>取消</button>
                  </div>
                </div>}
              </article>)}
      </div>
    </section>
  </>

  if (inline) return <div className='dsh-git-page'>
    <header className='dsh-git-page-header'>
      <div className='dsh-git-page-title'>
        <h2>管理 Git 工作树</h2>
        <p>查看独立工作目录的状态，并安全地打开、锁定或移除工作树。</p>
      </div>
      <div className='dsh-git-page-actions'>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={loading || !!busy} onClick={() => setRefreshKey(value => value + 1)}><IconRefresh size={15} />刷新</button>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => void previewPrune()}>{busy === 'prune-preview' ? '正在检查…' : '预览清理失效工作树'}</button>
      </div>
    </header>
    <div className='dsh-git-page-body'>{renderManagerBody()}</div>
  </div>

  return <DialogShell title='管理 Git 工作树' onClose={closeDialog} busy={!!busy} style={{ width: 640 }}>
    <div className='dsh-git-modal-header'>
      <span><IconWorktree size={16} /> 管理 Git 工作树</span>
      <button type='button' aria-label='关闭' className='dsh-git-icon-btn' disabled={!!busy} onClick={closeDialog}><IconClose size={16} /></button>
    </div>
    <div className='dsh-git-modal-body'>
      <div className='dsh-git-panel-toolbar'>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={loading || !!busy} onClick={() => setRefreshKey(value => value + 1)}><IconRefresh size={14} />刷新</button>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={() => void previewPrune()}>{busy === 'prune-preview' ? '正在检查…' : '预览清理失效工作树'}</button>
      </div>
      {renderManagerBody()}
    </div>
    <div className='dsh-git-modal-footer'><button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={!!busy} onClick={closeDialog}>完成</button></div>
  </DialogShell>
}
