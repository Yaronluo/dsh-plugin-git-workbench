import React, { useState, useEffect, useMemo } from 'react'
import type { DiffFile, DiffView } from '../../core/types.js'
import { gitApi } from '../api.js'
import { IconBranch, IconChevronDown, IconDiff, IconFile, IconRefresh } from '../icons.js'
import { injectStyles } from '../styles.js'
import { resolveWorkspaceCwd } from '../cwd-resolver.js'

export function ChangesTab(props: any) {
  injectStyles()

  const cwd = resolveWorkspaceCwd(props)
  const { status, isGit, loading: statusLoading, reload: reloadStatus } = useGitStatus(cwd)

  const [diffView, setDiffView] = useState<DiffView | null>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [compareTarget, setCompareTarget] = useState<'working-head' | 'branch-upstream' | 'staged'>('working-head')
  const [compareDropdownOpen, setCompareDropdownOpen] = useState(false)

  const loadDiff = async () => {
    if (!cwd || !isGit) return
    setLoadingDiff(true)
    try {
      let base: string | undefined
      let target: string | undefined

      if (compareTarget === 'branch-upstream') {
        base = status?.branch ? `origin/${status.branch}` : 'origin/main'
        target = status?.branch || 'HEAD'
      } else if (compareTarget === 'staged') {
        base = 'HEAD'
        target = undefined
      } else {
        // working tree vs HEAD
        base = 'HEAD'
        target = undefined
      }

      const res = await gitApi.getDiff(cwd, base, target)
      setDiffView(res)
      if (res.files.length > 0 && !selectedFile) {
        setSelectedFile(res.files[0].path)
      }
    } catch {
      // Ignore diff error
    } finally {
      setLoadingDiff(false)
    }
  }

  useEffect(() => {
    if (isGit && cwd) {
      loadDiff()
    }
  }, [cwd, isGit, compareTarget, status?.dirtyFiles])

  const activeFile = useMemo(() => {
    if (!diffView || !selectedFile) return diffView?.files[0] || null
    return diffView.files.find(f => f.path === selectedFile) || diffView.files[0] || null
  }, [diffView, selectedFile])

  // Non-Git repository empty state
  if (!statusLoading && !isGit) {
    return (
      <div className="dsh-git-changes-panel" style={{ alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <IconDiff size={40} style={{ color: '#9ca3af', marginBottom: 12 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          当前目录不是 Git 仓库
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', maxWidth: 280, marginBottom: 16 }}>
          在项目中执行 <code>git init</code> 后即可在此查看分支、未提交更改以及代码差异对比。
        </div>
        <button
          type="button"
          className="dsh-git-btn dsh-git-btn-primary"
          onClick={() => {
            reloadStatus()
          }}
        >
          重新检测
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
          <button type="button" className="dsh-git-selector-btn">
            <span>分支</span>
            <IconChevronDown size={11} />
          </button>

          {/* Ins / Del Summary Badge */}
          {diffView && (
            <div className="dsh-git-stat-badge">
              <span className="dsh-git-ins">+{diffView.totalInsertions}</span>
              <span className="dsh-git-del">-{diffView.totalDeletions}</span>
            </div>
          )}

          {/* Comparison target dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="dsh-git-selector-btn"
              onClick={() => setCompareDropdownOpen(!compareDropdownOpen)}
              title="切换对比基准"
            >
              <IconBranch size={12} />
              <span>
                {compareTarget === 'branch-upstream'
                  ? `${status?.branch || 'main'} → origin/${status?.branch || 'main'}`
                  : compareTarget === 'staged'
                  ? '已暂存变更'
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
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    width: 220,
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
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
                    {status?.branch || 'main'} vs origin/{status?.branch || 'main'}
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
              loadDiff()
            }}
            title="刷新"
            style={{ padding: '4px 6px' }}
          >
            <IconRefresh size={13} className={loadingDiff ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Body: File List + Diff View */}
      <div className="dsh-git-changes-body">
        {/* Left Changed Files List */}
        <div className="dsh-git-file-list">
          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6b7280', padding: '4px 8px 8px 8px', textTransform: 'uppercase' }}>
            变更文件 ({diffView?.files.length || 0})
          </div>

          {loadingDiff && !diffView ? (
            <div style={{ padding: '20px 8px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
              分析差异中...
            </div>
          ) : !diffView || diffView.files.length === 0 ? (
            <div style={{ padding: '20px 8px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
              当前无可对比的更改
            </div>
          ) : (
            diffView.files.map(file => {
              const isSelected = file.path === activeFile?.path
              return (
                <div
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
                </div>
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
                  <div style={{ padding: 20, color: '#9ca3af', fontStyle: 'italic' }}>
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
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
              选择左侧文件以查看代码差异
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
