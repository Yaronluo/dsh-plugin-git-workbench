import React, { useState, useEffect, useMemo } from 'react'
import type { DiffView } from '../../core/types.js'
import { gitApi, errorMessage } from '../api.js'
import { IconBranch, IconCheck, IconChevronDown, IconDiff, IconExternalLink, IconFile, IconRefresh } from '../icons.js'
import { useWorkspaceCwd } from '../cwd-resolver.js'
import { useGitStatus } from '../hooks/use-git-status.js'
import { GitLoadingState } from '../loading-state.js'

/** 仓库状态与文件差异是两个请求，对用户却是一次等待，因此共用一个加载画面。 */
function ChangesLoading() {
  return <GitLoadingState title="正在加载仓库" hint="分支和文件变更即将显示在这里" />
}

export function ChangesTab(props: any) {
  const cwd = useWorkspaceCwd(props)
  const { status, isGit, loading: statusLoading, error: statusError, reload: reloadStatus } = useGitStatus(cwd)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [compareTarget, setCompareTarget] = useState<'working-head' | 'branch-upstream'>('working-head')
  const [compareDropdownOpen, setCompareDropdownOpen] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [editorNotice, setEditorNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const branch = status?.branch
  const head = status?.head
  const revision = status?.revision
  const upstream = status?.upstream
  const dirtyFiles = status?.dirtyFiles
  const requestKey = JSON.stringify([cwd, isGit, compareTarget, branch, head, revision, upstream, dirtyFiles, refresh])
  const [result, setResult] = useState<{ key: string; view: DiffView | null; error: string | null; loading: boolean } | null>(null)
  const current = result?.key === requestKey ? result : null
  const diffView = current?.view ?? null
  const loadingDiff = !!cwd && isGit && (!current || current.loading)
  const diffError = current?.error

  useEffect(() => {
    setSelectedFile(null)
    setCompareDropdownOpen(false)
  }, [cwd])

  // The editor result is a transient confirmation, not a state of the repository.
  useEffect(() => {
    if (!editorNotice) return
    const timer = setTimeout(() => setEditorNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [editorNotice])

  const openInEditor = async (file: string) => {
    setEditorNotice(null)
    try {
      const result = await gitApi.openInEditor(cwd, file)
      setEditorNotice(result.ok
        ? { ok: true, text: `${result.editor ? `已用 ${result.editor} 打开` : '已用系统默认应用打开'}：${result.target || file}` }
        : { ok: false, text: result.error || '无法打开外部编辑器' })
    } catch (error) {
      setEditorNotice({ ok: false, text: errorMessage(error) })
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    if (!cwd || !isGit) { setResult(null); return () => controller.abort() }
    if (compareTarget === 'branch-upstream' && !upstream) {
      setResult({ key: requestKey, view: null, error: '当前分支未配置上游，无法对比。', loading: false })
      return () => controller.abort()
    }
    setResult({ key: requestKey, view: null, error: null, loading: true })
    const base = compareTarget === 'branch-upstream' ? upstream : 'HEAD'
    const target = compareTarget === 'branch-upstream' ? 'HEAD' : undefined
    gitApi.getDiff(cwd, base, target, controller.signal).then(view => {
      if (controller.signal.aborted) return
      setResult({ key: requestKey, view, error: null, loading: false })
      setSelectedFile(previous => view.files.some(file => file.path === previous) ? previous : view.files[0]?.path ?? null)
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key: requestKey, view: null, error: error instanceof Error ? error.message : String(error), loading: false })
    })
    return () => controller.abort()
  }, [cwd, isGit, compareTarget, branch, head, revision, upstream, dirtyFiles, refresh, requestKey])

  const activeFile = useMemo(() => {
    if (!diffView || !selectedFile) return diffView?.files[0] || null
    return diffView.files.find(f => f.path === selectedFile) || diffView.files[0] || null
  }, [diffView, selectedFile])

  // 等仓库状态和等差异是同一次等待，因此共用下面同一个加载画面：此前两者各有文案，
  // 于是先显示「正在加载仓库」再被换成「正在读取文件差异」，看起来像加载了两次。
  const firstLoad = statusLoading && !status && !statusError
  if (statusError && !status) return <div className="dsh-git-changes-panel"><div className="dsh-git-empty-state">
    <div className="dsh-git-state-icon"><IconDiff size={24} /></div><strong>暂时无法加载仓库</strong>
    <p className="dsh-git-state-error" role="alert">{statusError}</p>
    <button type="button" className="dsh-git-btn dsh-git-btn-secondary" onClick={reloadStatus}><IconRefresh size={14} />重新加载</button>
  </div></div>
  // Non-Git repository empty state
  if (!statusLoading && !isGit) {
    return (
      <div className="dsh-git-changes-panel"><div className="dsh-git-empty-state">
        {statusError && <div className="dsh-git-state-error" role="alert">{statusError}</div>}
        <div className="dsh-git-state-icon"><IconDiff size={24} /></div>
        <strong>当前目录不是 Git 仓库</strong>
        <p>在项目中执行 <code>git init</code> 后，即可查看分支和文件差异。</p>
        <button
          type="button"
          className="dsh-git-btn dsh-git-btn-primary"
          onClick={() => {
            reloadStatus()
          }}
        >
          重新加载
        </button>
      </div></div>
    )
  }

  return (
    <div className="dsh-git-changes-panel" aria-busy={firstLoad ? 'true' : undefined}>
      {firstLoad ? <div className="dsh-git-toolbar-skeleton" aria-hidden="true"><i /><i /></div>
        : <div className="dsh-git-changes-header">
        <div className="dsh-git-repo-row">
          <span className="dsh-git-current-branch" title={status?.branch || 'HEAD'}><IconBranch size={15} /><span>{status?.branch || 'HEAD'}</span></span>
          <div className="dsh-git-change-summary">
            {diffView && <span className="dsh-git-file-count">{diffView.files.length ? `${diffView.files.length} 个文件` : '无变更'}</span>}
            {!!diffView?.files.length && <div className="dsh-git-stat-badge" aria-label={`新增 ${diffView.totalInsertions} 行，删除 ${diffView.totalDeletions} 行`}>
              <span className="dsh-git-ins">+{diffView.totalInsertions}</span><span className="dsh-git-del">−{diffView.totalDeletions}</span>
            </div>}
          </div>
          <button type="button" className="dsh-git-refresh-btn" aria-label="刷新变更" title="刷新变更" disabled={loadingDiff || statusLoading} onClick={() => { reloadStatus(); setRefresh(value => value + 1) }}>
            <IconRefresh size={15} className={loadingDiff || statusLoading ? 'dsh-git-spin' : ''} />
          </button>
        </div>
        <div className="dsh-git-compare-control" onKeyDown={event => {
          if (event.key === 'Escape') {
            event.stopPropagation(); setCompareDropdownOpen(false)
            event.currentTarget.querySelector<HTMLButtonElement>('.dsh-git-compare-trigger')?.focus()
          }
        }}>
          <button type="button" className={`dsh-git-compare-trigger ${compareDropdownOpen ? 'dsh-git-compare-trigger-open' : ''}`} onClick={() => setCompareDropdownOpen(!compareDropdownOpen)} title="切换对比基准" aria-expanded={compareDropdownOpen}>
            <IconDiff size={15} />
            <span className="dsh-git-compare-label">{compareTarget === 'working-head' ? '工作区' : (status?.branch || 'HEAD')}</span>
            <span className="dsh-git-compare-arrow" aria-hidden="true">→</span>
            <span className="dsh-git-compare-base">{compareTarget === 'working-head' ? 'HEAD' : (upstream || '未配置上游')}</span>
            <IconChevronDown size={13} />
          </button>
          {compareDropdownOpen && <>
            <div className="dsh-git-compare-backdrop" onClick={() => setCompareDropdownOpen(false)} />
            <div className="dsh-git-compare-menu" role="group" aria-label="对比基准">
              <div className="dsh-git-compare-menu-heading">对比基准</div>
              <button type="button" className="dsh-git-compare-option" aria-pressed={compareTarget === 'working-head'} onClick={event => {
                setCompareTarget('working-head'); setCompareDropdownOpen(false)
                event.currentTarget.closest('.dsh-git-compare-control')?.querySelector<HTMLButtonElement>('.dsh-git-compare-trigger')?.focus()
              }}>
                <span className="dsh-git-option-icon"><IconDiff size={17} /></span>
                <span className="dsh-git-option-copy"><strong>未提交的更改</strong><span>工作区与 HEAD 对比</span></span>
                {compareTarget === 'working-head' && <IconCheck size={16} />}
              </button>
              <button type="button" className="dsh-git-compare-option" disabled={!upstream} aria-pressed={compareTarget === 'branch-upstream'} onClick={event => {
                setCompareTarget('branch-upstream'); setCompareDropdownOpen(false)
                event.currentTarget.closest('.dsh-git-compare-control')?.querySelector<HTMLButtonElement>('.dsh-git-compare-trigger')?.focus()
              }}>
                <span className="dsh-git-option-icon"><IconBranch size={17} /></span>
                <span className="dsh-git-option-copy"><strong>与上游分支对比{!upstream && <small>未配置</small>}</strong><span>{upstream ? `${status?.branch || 'HEAD'} → ${upstream}` : '配置上游分支后可用'}</span></span>
                {compareTarget === 'branch-upstream' && <IconCheck size={16} />}
              </button>
            </div>
          </>}
        </div>
      </div>}

      {statusError && <div className="dsh-git-changes-notice dsh-git-error" role="alert">{statusError}</div>}
      {editorNotice && <div className={`dsh-git-changes-notice ${editorNotice.ok ? 'dsh-git-editor-notice' : 'dsh-git-error'}`} role="status">{editorNotice.text}</div>}
      {firstLoad || loadingDiff ? <ChangesLoading /> : diffError ? <div className="dsh-git-empty-state">
        <div className="dsh-git-state-icon"><IconDiff size={24} /></div><strong>无法读取差异</strong>
        <p className="dsh-git-state-error" role="alert">{diffError}</p>
        <button type="button" className="dsh-git-btn dsh-git-btn-secondary" onClick={() => { reloadStatus(); setRefresh(value => value + 1) }}><IconRefresh size={14} />重试</button>
      </div> : diffView && diffView.files.length === 0 ? <div className="dsh-git-empty-state">
        <div className="dsh-git-state-icon dsh-git-state-clean"><IconCheck size={26} /></div>
        <strong>{compareTarget === 'working-head' ? '工作区很干净' : '与上游分支一致'}</strong>
        <p>{compareTarget === 'working-head' ? '暂无未提交的更改，新的变更会显示在这里。' : '当前分支与上游之间没有文件差异。'}</p>
      </div> : <div className="dsh-git-changes-body">
        {/* Left Changed Files List */}
        <div className="dsh-git-file-list">
          <div className="dsh-git-file-list-heading"><span>变更文件</span><span>{diffView?.files.length || 0}</span></div>

          {!diffView || diffView.files.length === 0 ? (
            <div style={{ padding: '20px 8px', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)', fontSize: 12 }}>
              当前无可对比的更改
            </div>
          ) : (
            diffView.files.map(file => {
              const isSelected = file.path === activeFile?.path
              return (
                <button
                  type="button"
                  aria-pressed={isSelected}
                  key={file.path}
                  className={`dsh-git-file-item ${isSelected ? 'dsh-git-file-item-active' : ''}`}
                  onClick={() => setSelectedFile(file.path)}
                  title={file.path}
                >
                  <div className="dsh-git-file-name">
                    <IconFile size={13} />
                    <span>{file.path.split('/').pop() || file.path}</span>
                  </div>
                  <div className="dsh-git-file-stats">
                    <span className="dsh-git-ins">+{file.insertions}</span>
                    <span className="dsh-git-del">-{file.deletions}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Right Inline Diff Viewer */}
        <div className="dsh-git-diff-view">
          {activeFile ? (
            <>
              {/* Diff File Header */}
              <div className="dsh-git-diff-header">
                {/* One row: the path ellipsizes instead of wrapping the stats and the
                    button onto separate lines. */}
                <div className="dsh-git-diff-file" title={activeFile.path}>
                  <IconFile size={14} />
                  <span className="dsh-git-diff-path">{activeFile.path}</span>
                  <span className="dsh-git-diff-stats">
                    <span className="dsh-git-ins">+{activeFile.insertions}</span>
                    <span className="dsh-git-del"> -{activeFile.deletions}</span>
                  </span>
                </div>
                <div className="dsh-git-head-actions">
                  {activeFile.status !== 'deleted' && <button type="button" className="dsh-git-btn dsh-git-btn-secondary dsh-git-open-editor"
                    title="在外部编辑器中打开这个文件" onClick={() => openInEditor(activeFile.path)}>
                    <IconExternalLink size={13} /><span>在编辑器中打开</span>
                  </button>}
                </div>
              </div>

              {/* Code Diff Lines */}
              <div className="dsh-git-diff-lines">
                {activeFile.hunks.length === 0 ? (
                  <div style={{ padding: 20, color: 'var(--dsw-alias-label-secondary)', fontStyle: 'italic' }}>
                    {activeFile.status === 'deleted' ? '文件已被删除' : '文件未包含差异行或为二进制文件'}
                  </div>
                ) : (
                  activeFile.hunks.map((hunk, hIdx) => (
                    <div key={hIdx}>
                      <div className="dsh-git-hunk-header">{hunk.header}</div>
                      {hunk.lines.map((line, lIdx) => (
                        <div
                          key={lIdx}
                          className={`dsh-git-diff-row ${
                            line.type === 'add'
                              ? 'dsh-git-row-add'
                              : line.type === 'del'
                              ? 'dsh-git-row-del'
                              : ''
                          }`}
                        >
                          <div className="dsh-git-line-num">{line.oldNum ?? ''}</div>
                          <div className="dsh-git-line-num">{line.newNum ?? ''}</div>
                          <div className="dsh-git-line-content">
                            {line.type === 'add' ? '+ ' : line.type === 'del' ? '- ' : '  '}
                            {line.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dsw-alias-label-secondary)', fontSize: 13 }}>
              选择左侧文件以查看代码差异
            </div>
          )}
        </div>
      </div>}
    </div>
  )
}
