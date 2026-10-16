import React, { useEffect, useState } from 'react'
import type { ComponentType, FunctionComponent } from 'react'
import type { GitGraphCommit } from '../../core/types.js'
import type { CommitDetailDialogProps } from './CommitDetailDialog.js'
import { gitApi } from '../api.js'
import { computeGraph } from '../graph.js'
import { IconHistory, IconRefresh } from '../icons.js'
import { useGitStatus } from '../hooks/use-git-status.js'
import { GitLoadingState } from '../loading-state.js'

function renderErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return String(error)
}

interface CommitDetailErrorBoundaryState {
  failed: boolean
  message: string
}

/** Isolate detail rendering failures so the surrounding graph and navigation survive. */
class CommitDetailErrorBoundary extends React.Component<{ children: React.ReactNode }, CommitDetailErrorBoundaryState> {
  state: CommitDetailErrorBoundaryState = { failed: false, message: '' }

  static getDerivedStateFromError(error: unknown): CommitDetailErrorBoundaryState {
    return { failed: true, message: renderErrorMessage(error) }
  }

  private retry = () => this.setState({ failed: false, message: '' })

  render() {
    if (this.state.failed) return <div className='dsh-git-empty-state'>
      <strong>无法显示提交详情</strong>
      <p className='dsh-git-error' role='alert'>{this.state.message}</p>
      <button type='button' className='dsh-git-btn dsh-git-btn-secondary' onClick={this.retry}>重试</button>
    </div>
    return this.props.children
  }
}

interface SelectedCommitDetailsProps {
  path: string
  commitRef: string
  DetailComponent: FunctionComponent<CommitDetailDialogProps> | null
  loadError: string | null
  onBack: () => void
  onRetry: () => void
}

/** Keep navigation independent of the lazy detail chunk and its render state. */
export function SelectedCommitDetails({ path, commitRef, DetailComponent, loadError, onBack, onRetry }: SelectedCommitDetailsProps) {
  return <div className='dsh-git-section'>
    {DetailComponent ? <CommitDetailErrorBoundary key={JSON.stringify([path, commitRef])}>
      <DetailComponent path={path} commitRef={commitRef} onClose={onBack} showBackButton={false} />
    </CommitDetailErrorBoundary>
      : loadError ? <>
        <p className='dsh-git-error' role='alert'>{loadError}</p>
        <button type='button' className='dsh-git-btn dsh-git-btn-secondary' onClick={onRetry}>重试加载详情</button>
      </>
      : <div className='dsh-git-muted'>正在加载提交详情视图…</div>}
  </div>
}

/** Legacy export name retained; this is ordinary native-sidebar content. */
export function GitGraphDialog({ path }: { path: string; onClose?: () => void }) {
  const { status, error: statusError } = useGitStatus(path)
  const [commits, setCommits] = useState<GitGraphCommit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [requestedRevision, setRequestedRevision] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'commits' | 'reflog'>('commits')
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)
  const [CommitDetailDialog, setCommitDetailDialog] = useState<FunctionComponent<CommitDetailDialogProps> | null>(null)
  const [ReflogPanel, setReflogPanel] = useState<ComponentType<{ path: string }> | null>(null)
  const [commitLoadError, setCommitLoadError] = useState<string | null>(null)
  const [reflogLoadError, setReflogLoadError] = useState<string | null>(null)
  const [commitLoadAttempt, setCommitLoadAttempt] = useState(0)
  const [reflogLoadAttempt, setReflogLoadAttempt] = useState(0)
  const statusRevision = status?.head ?? (statusError ? '__status-error__' : null)

  useEffect(() => {
    if (!selectedCommit || CommitDetailDialog) return
    let active = true
    setCommitLoadError(null)
    import('./CommitDetailDialog.js').then(module => {
      if (active) setCommitDetailDialog(() => module.CommitDetailDialog)
    }).catch(reason => {
      if (active) setCommitLoadError(reason instanceof Error ? reason.message : String(reason))
    })
    return () => { active = false }
  }, [selectedCommit, CommitDetailDialog, commitLoadAttempt])

  useEffect(() => {
    if (activeTab !== 'reflog' || ReflogPanel) return
    let active = true
    setReflogLoadError(null)
    import('./ReflogPanel.js').then(module => {
      if (active) setReflogPanel(() => module.ReflogPanel)
    }).catch(reason => {
      if (active) setReflogLoadError(reason instanceof Error ? reason.message : String(reason))
    })
    return () => { active = false }
  }, [activeTab, ReflogPanel, reflogLoadAttempt])

  useEffect(() => {
    // Wait for repository status so the first log request is keyed by the actual HEAD.
    if (!status && !statusError) return
    const revision = statusRevision ?? '__status-error__'
    const requestKey = `${path}\u0000${revision}`
    if (requestedRevision === requestKey) return

    const controller = new AbortController()
    setRequestedRevision(requestKey)
    setCommits([])
    setLoading(true)
    setError(null)
    gitApi.getLog(path, 60, controller.signal).then(result => {
      if (!controller.signal.aborted) setCommits(result)
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : String(error))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  // `requestedRevision` is intentionally not an effect dependency: changing it records the
  // in-flight request without aborting that request during the resulting render.
  }, [path, refresh, statusRevision])

  const refreshLog = () => {
    setRequestedRevision(null)
    setRefresh(value => value + 1)
  }

  const graphRows = computeGraph(commits.map(commit => ({ ...commit, parents: commit.parents ?? [] })))

  return <section className='dsh-git-history-panel' aria-label='提交记录'>
    <div className='dsh-git-changes-header'>
      <div className='dsh-git-repo-row'>
        <span className='dsh-git-panel-heading'><IconHistory size={17} />提交记录</span>
        <div className='dsh-git-head-actions'>
          {!loading && !error && commits.length > 0 && <span className='dsh-git-file-count'>最近 {commits.length} 条</span>}
          <button type='button' aria-label='刷新提交记录' title='刷新' className='dsh-git-refresh-btn'
            disabled={loading} onClick={refreshLog}>
            <IconRefresh size={15} className={loading ? 'dsh-git-spin' : ''} />
          </button>
        </div>
      </div>
      <div className='dsh-git-tab-strip' role='tablist' aria-label='历史记录类型'>
        <button type='button' role='tab' aria-selected={activeTab === 'commits'}
          className={`dsh-git-tab${activeTab === 'commits' ? ' dsh-git-tab-active' : ''}`}
          onClick={() => { setActiveTab('commits'); setSelectedCommit(null) }}>提交</button>
        <button type='button' role='tab' aria-selected={activeTab === 'reflog'}
          className={`dsh-git-tab${activeTab === 'reflog' ? ' dsh-git-tab-active' : ''}`}
          onClick={() => { setActiveTab('reflog'); setSelectedCommit(null) }}>引用日志</button>
      </div>
    </div>
    <div className='dsh-git-history-list'>
      {activeTab === 'reflog' ? ReflogPanel ? <ReflogPanel path={path} />
        : reflogLoadError ? <>
          <p className='dsh-git-error' role='alert'>{reflogLoadError}</p>
          <button type='button' className='dsh-git-btn dsh-git-btn-secondary'
            onClick={() => setReflogLoadAttempt(value => value + 1)}>重试加载引用日志</button>
        </>
        : <div className='dsh-git-muted'>正在加载引用日志视图…</div> : <>
      <div hidden={selectedCommit !== null}>
        {error ? <div className='dsh-git-empty-state'>
          <div className='dsh-git-state-icon'><IconHistory size={24} /></div><strong>无法读取提交记录</strong>
          <p className='dsh-git-state-error' role='alert'>{error}</p>
          <button type='button' className='dsh-git-btn dsh-git-btn-secondary' onClick={refreshLog}><IconRefresh size={14} />重试</button>
        </div>
          : loading ? <GitLoadingState title='正在读取提交记录' hint='最近的提交、作者与分支引用即将显示' rows={4} />
          : commits.length === 0 ? <div className='dsh-git-empty-state'>
            <div className='dsh-git-state-icon'><IconHistory size={24} /></div><strong>暂无提交记录</strong>
            <p>这个仓库还没有提交，第一次提交后会显示在这里。</p>
          </div>
          : graphRows.map(row => {
            const commit = row.commit
            const graphWidth = row.width * 14 + 14
            return <div key={commit.hash} className='dsh-git-graph-row' role='button' tabIndex={0}
              aria-label={`查看提交 ${commit.shortHash} ${commit.subject}`}
              onClick={() => setSelectedCommit(commit.hash)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setSelectedCommit(commit.hash)
                }
              }}>
              <article className='dsh-git-history-item' style={{ display: 'flex', alignItems: 'stretch', gap: 8, flex: 1, minWidth: 0 }}>
                <svg className='dsh-git-graph-canvas' width={graphWidth} height={34}
                  viewBox={`0 0 ${graphWidth} 34`} style={{ width: graphWidth }} aria-hidden='true'>
                  {row.columns.map((_, lane) => <g key={`lane-${lane}`} className={'dsh-git-lane-' + (lane % 8)}>
                    <line x1={lane * 14 + 7} y1={0} x2={lane * 14 + 7} y2={34} stroke='currentColor' strokeWidth={2} />
                  </g>)}
                  {row.parents.map((parent, index) => <g key={`parent-${parent.hash}-${index}`}
                    className={'dsh-git-lane-' + (parent.column % 8)}>
                    <path d={`M ${row.column * 14 + 7} 17 L ${parent.column * 14 + 7} 34`}
                      fill='none' stroke='currentColor' strokeWidth={2} />
                  </g>)}
                  <g className={'dsh-git-lane-' + (row.column % 8)}>
                    <circle className='dsh-git-graph-dot' r={3.5} cx={row.column * 14 + 7} cy={17} />
                  </g>
                </svg>
                <div className='dsh-git-graph-copy'>
                  <div className='dsh-git-graph-subject'>{commit.subject}</div>
                  <div className='dsh-git-graph-meta'>
                    <code title={commit.hash}>{commit.shortHash}</code>
                    <span>{commit.author}</span>
                    <time>{commit.date}</time>
                    {commit.refs.map(ref => <span key={ref} className='dsh-git-ref'>{ref}</span>)}
                  </div>
                </div>
              </article>
            </div>
          })}
      </div>
      {selectedCommit && <SelectedCommitDetails path={path} commitRef={selectedCommit}
        DetailComponent={CommitDetailDialog} loadError={commitLoadError}
        onBack={() => setSelectedCommit(null)}
        onRetry={() => setCommitLoadAttempt(value => value + 1)} />}
        </>}
    </div>
  </section>
}
