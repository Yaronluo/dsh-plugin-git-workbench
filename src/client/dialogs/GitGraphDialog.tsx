import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ComponentType, CSSProperties, FunctionComponent } from 'react'
import type { GitGraphCommit } from '../../core/types.js'
import type { CommitDetailDialogProps } from './CommitDetailDialog.js'
import { gitApi } from '../api.js'
import { computeGraph } from '../graph.js'
import { IconHistory, IconRefresh } from '../icons.js'
import { useGitStatus } from '../hooks/use-git-status.js'
import { GitLoadingState } from '../loading-state.js'

/** Horizontal distance between two lane centres, and from the left edge to the first one. */
const LANE_STEP = 14
const LANE_INSET = 7
/** Diameter of the commit dot; it is a CSS circle so it stays round at any zoom. */
const NODE_SIZE = 8

const laneCenter = (column: number): number => LANE_INSET + column * LANE_STEP
const laneClass = (column: number): string => `dsh-git-lane-${column % 8}`

/** Compare measured row centres so a resize observer that reports the same layout stops. */
function sameCentres(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => Math.abs(value - right[index]) < 0.5)
}

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
  /**
   * `false` in the commit list, which keeps its own selected row visible. A nested view
   * (a file's history) needs the "返回" affordance, or it traps the user in the detail.
   */
  showBackButton?: boolean
}

/** Keep navigation independent of the lazy detail chunk and its render state. */
export function SelectedCommitDetails({ path, commitRef, DetailComponent, loadError, onBack, onRetry, showBackButton = false }: SelectedCommitDetailsProps) {
  return <div className='dsh-git-section'>
    {DetailComponent ? <CommitDetailErrorBoundary key={JSON.stringify([path, commitRef])}>
      <DetailComponent path={path} commitRef={commitRef} onClose={onBack} showBackButton={showBackButton} />
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

  // Every row reserves the widest lane count so the subjects line up in one column, and a
  // single canvas draws the whole graph. Drawing one canvas per row used to stop each lane
  // at its own row edge, which is what turned a branch into a column of short dashes.
  const gutter = graphRows.reduce((widest, row) => Math.max(widest, row.width), 1) * LANE_STEP + LANE_STEP
  const viewRef = useRef<HTMLDivElement | null>(null)
  const [graphLayout, setGraphLayout] = useState<{ centres: number[]; height: number }>({ centres: [], height: 0 })

  useLayoutEffect(() => {
    const view = viewRef.current
    if (!view) return
    let frame = 0
    const measure = () => {
      const rows = Array.from(view.querySelectorAll<HTMLElement>('.dsh-git-graph-row'))
      // Measure against the canvas container, not the scrolling list: both the rows and the
      // overlay live in the same content box, so the result does not move when the list scrolls.
      const origin = view.getBoundingClientRect()
      const rects = rows.map(row => row.getBoundingClientRect())
      // A hidden list (commit detail open) measures as zero: keep the previous canvas.
      if (rects.length === 0 || rects.some(rect => rect.height === 0)) return
      const centres = rects.map(rect => rect.top - origin.top + rect.height / 2)
      const height = rects[rects.length - 1].bottom - origin.top
      setGraphLayout(previous => sameCentres(previous.centres, centres) && Math.abs(previous.height - height) < 0.5
        ? previous
        : { centres, height })
    }
    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(() => { frame = 0; measure() })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(schedule)
    observer.observe(view)
    for (const row of Array.from(view.querySelectorAll<HTMLElement>('.dsh-git-graph-row'))) observer.observe(row)
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [commits, activeTab, selectedCommit])

  const lanes: Array<{ key: string; className: string; path: string }> = []
  if (graphLayout.centres.length === graphRows.length) {
    graphRows.forEach((row, index) => {
      const centre = graphLayout.centres[index]
      const next = graphLayout.centres[index + 1]
      const nextColumns = graphRows[index + 1]?.columns ?? []
      const last = index === graphRows.length - 1
      row.columns.forEach((hash, column) => {
        if (!hash) return
        const x = laneCenter(column)
        // Lanes enter the list from above on the first row, and leave it at the last row,
        // so the graph reads as one continuous picture instead of per-row stubs.
        const start = index === 0 ? 0 : centre
        const end = last ? graphLayout.height : nextColumns[column] ? next : centre
        if (end > start) lanes.push({ key: `lane-${index}-${column}`, className: laneClass(column), path: `M${x} ${start}L${x} ${end}` })
      })
      for (const parent of row.parents) {
        if (parent.column === row.column || next === undefined) continue
        const from = laneCenter(row.column)
        const to = laneCenter(parent.column)
        const middle = (centre + next) / 2
        lanes.push({
          key: `edge-${index}-${parent.column}-${parent.hash}`, className: laneClass(parent.column),
          path: `M${from} ${centre}C${from} ${middle} ${to} ${middle} ${to} ${next}`,
        })
      }
    })
  }

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
    <div className='dsh-git-history-list'
      style={{ '--dsh-git-graph-gutter': `${gutter}px` } as CSSProperties}>
      {activeTab === 'reflog' ? ReflogPanel ? <ReflogPanel path={path} />
        : reflogLoadError ? <>
          <p className='dsh-git-error' role='alert'>{reflogLoadError}</p>
          <button type='button' className='dsh-git-btn dsh-git-btn-secondary'
            onClick={() => setReflogLoadAttempt(value => value + 1)}>重试加载引用日志</button>
        </>
        : <div className='dsh-git-muted'>正在加载引用日志视图…</div> : <>
      <div className='dsh-git-graph-view' ref={viewRef} hidden={selectedCommit !== null}>
        {lanes.length > 0 && <svg className='dsh-git-graph-backdrop' width={gutter} height={graphLayout.height}
          viewBox={`0 0 ${gutter} ${graphLayout.height}`} aria-hidden='true'>
          {lanes.map(lane => <g key={lane.key} className={lane.className}>
            <path d={lane.path} fill='none' stroke='currentColor' strokeWidth={2} strokeLinecap='round' />
          </g>)}
        </svg>}
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
            return <div key={commit.hash} className='dsh-git-graph-row' role='button' tabIndex={0}
              aria-label={`查看提交 ${commit.shortHash} ${commit.subject}`}
              onClick={() => setSelectedCommit(commit.hash)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setSelectedCommit(commit.hash)
                }
              }}>
              <span className={`dsh-git-graph-node ${laneClass(row.column)}`}
                style={{ left: laneCenter(row.column) - NODE_SIZE / 2 }} aria-hidden='true' />
              <article className='dsh-git-history-item'>
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
