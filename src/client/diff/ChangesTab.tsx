import React, { useState, useEffect, useMemo } from 'react'
import type { DiffView } from '../../core/types.js'
import { gitApi } from '../api.js'
import { IconBranch, IconChevronDown, IconDiff, IconFile, IconRefresh } from '../icons.js'
import { useWorkspaceCwd } from '../cwd-resolver.js'
import { useGitStatus } from '../hooks/use-git-status.js'

export function ChangesTab(props: any) {
  const cwd = useWorkspaceCwd(props)
  const { status, isGit, loading: statusLoading, error: statusError, reload: reloadStatus } = useGitStatus(cwd)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [compareTarget, setCompareTarget] = useState<'working-head' | 'branch-upstream'>('working-head')
  const [compareDropdownOpen, setCompareDropdownOpen] = useState(false)
  const [refresh, setRefresh] = useState(0)
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

  if (statusLoading && !status && !statusError) return <div className="dsh-git-changes-panel" role="status">加载中…</div>
  if (statusError && !status) return <div className="dsh-git-changes-panel"><div className="dsh-git-error" role="alert">{statusError}</div><button type="button" className="dsh-git-btn dsh-git-btn-secondary" onClick={reloadStatus}>重试</button></div>
  // Non-Git repository empty state
  if (!statusLoading && !isGit) {
    return (
      <div className="dsh-git-changes-panel" style={{ alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        {statusError && <div className="dsh-git-error" role="alert">{statusError}</div>}
        <IconDiff size={40} style={{ color: 'var(--dsw-alias-label-secondary)', marginBottom: 12 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--dsw-alias-label-primary)', marginBottom: 6 }}>
          当前目录不是 Git 仓库
        </div>
        <div style={{ fontSize: 13, color: 'var(--dsw-alias-label-secondary)', textAlign: 'center', maxWidth: 280, marginBottom: 16 }}>
          在项目中执行 <code>git init</code> 后即可在此查看分支、未提交更改以及代码差异对比。
        </div>
        <button
          type="button"
          className="dsh-git-btn dsh-git-btn-primary"
          onClick={() => {
            reloadStatus()
          }}
        >
          重新加载
        </button>
      </div>
    )
  }

  return (
    <div className="dsh-git-changes-panel">
      {/* Top Header Bar */}
      <div className="dsh-git-changes-header">
        <div className="dsh-git-header-left">
          {/* Branch Mode Dropdown */}
          <span className="dsh-git-muted">{status?.branch || 'HEAD'}</span>

          {/* Ins / Del Summary Badge */}
          {diffView && (
            <div className="dsh-git-stat-badge">
              <span className="dsh-git-ins">+{diffView.totalInsertions}</span>
              <span className="dsh-git-del">-{diffView.totalDeletions}</span>
            </div>
          )}

          {/* Comparison target dropdown */}
          <div style={{ position: 'relative' }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setCompareDropdownOpen(false) } }}>
            <button
              type="button"
              className="dsh-git-selector-btn"
              onClick={() => setCompareDropdownOpen(!compareDropdownOpen)}
              title="切换对比基准"
              aria-expanded={compareDropdownOpen}
              aria-controls="dsh-git-compare-options"
            >
              <IconBranch size={12} />
              <span>
                {compareTarget === 'branch-upstream'
                  ? `${status?.branch || 'HEAD'} → ${upstream || '未配置上游'}`
                  : '工作区 → HEAD'}
              </span>
              <IconChevronDown size={11} />
            </button>

            {compareDropdownOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                  onClick={() => setCompareDropdownOpen(false)}
                />
                <div
                  id="dsh-git-compare-options"
                  role="group"
                  aria-label="对比基准"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    width: 220,
                    background: 'var(--dsw-alias-bg-layer-1)',
                    border: '1px solid var(--dsw-alias-border-l1)',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px var(--dsw-alias-bg-overlay)',
                    zIndex: 1000,
                    padding: 4,
                  }}
                >
                  <button
                    type="button"
                    className="dsh-git-branch-item"
                    onClick={() => {
                      setCompareTarget('working-head')
                      setCompareDropdownOpen(false)
                    }}
                  >
                    工作区 vs HEAD (未提交更改)
                  </button>
                  <button
                    type="button"
                    className="dsh-git-branch-item"
                    onClick={() => {
                      setCompareTarget('branch-upstream')
                      setCompareDropdownOpen(false)
                    }}
                  >
                    {status?.branch || 'HEAD'} vs {upstream || '未配置上游'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Action Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="dsh-git-selector-btn"
            onClick={() => {
              reloadStatus()
              setRefresh(value => value + 1)
            }}
            title="刷新"
            style={{ padding: '4px 6px' }}
          >
            <IconRefresh size={13} className={loadingDiff ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {(statusError || diffError) && <div className="dsh-git-error" role="alert" style={{ padding: 12 }}>{statusError || diffError}</div>}
      {/* Main Body: a native-sidebar empty state, or the file/diff browser. */}
      {!loadingDiff && !diffError && diffView && diffView.files.length === 0 ? <div className="dsh-git-empty-state">
        <IconDiff size={48} /><strong>暂无文件更改</strong><p>此项目中的更改将显示在此处。</p>
      </div> : <div className="dsh-git-changes-body">
        {/* Left Changed Files List */}
        <div className="dsh-git-file-list">
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--dsw-alias-label-secondary)', padding: '4px 8px 8px 8px', textTransform: 'uppercase' }}>
            变更文件 ({diffView?.files.length || 0})
          </div>

          {loadingDiff && !diffView ? (
            <div style={{ padding: '20px 8px', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)', fontSize: 12 }}>
              加载中…
            </div>
          ) : diffError ? <div className="dsh-git-muted" style={{ padding: 12 }}>差异加载失败，请刷新重试。</div> : !diffView || diffView.files.length === 0 ? (
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <IconFile size={13} />
                    <span>{file.path.split('/').pop() || file.path}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace', fontSize: 11 }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconFile size={14} />
                  <span style={{ fontWeight: 600 }}>{activeFile.path}</span>
                  <span style={{ fontSize: 11 }}>
                    <span className="dsh-git-ins">+{activeFile.insertions}</span>
                    <span className="dsh-git-del"> -{activeFile.deletions}</span>
                  </span>
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
