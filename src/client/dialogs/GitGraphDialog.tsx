import React, { useEffect, useState } from 'react'
import type { GitGraphCommit } from '../../core/types.js'
import { gitApi } from '../api.js'
import { IconHistory, IconRefresh } from '../icons.js'
import { useGitStatus } from '../hooks/use-git-status.js'
import { GitLoadingState } from '../loading-state.js'

/** Legacy export name retained; this is now ordinary native-sidebar content. */
export function GitGraphDialog({ path }: { path: string; onClose?: () => void }) {
  const { status, error: statusError } = useGitStatus(path)
  const [commits, setCommits] = useState<GitGraphCommit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    // 仓库状态比日志晚一步到位。若不等待它，日志会先用「未知分支」请求一次，
    // 状态到位后依赖变化再请求一次：列表显示出来又被清空重载，就是那两次加载画面。
    // 状态已经出错时不再等待，让日志请求自己给出真实原因。
    if (!status && !statusError) return
    const controller = new AbortController()
    setCommits([])
    setLoading(true)
    setError(null)
    gitApi.getLog(path, 60, controller.signal).then(result => {
      if (!controller.signal.aborted) setCommits(result)
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : String(error))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [path, refresh, status?.head, status?.branch, statusError])

  return <section className="dsh-git-history-panel" aria-label="提交记录">
    <div className="dsh-git-changes-header">
      {/* The header is a column; heading and action must share one row, or the
          button stretches into a full-width empty bar. */}
      <div className="dsh-git-repo-row">
        <span className="dsh-git-panel-heading"><IconHistory size={17} />提交记录</span>
        <div className="dsh-git-head-actions">
          {!loading && !error && commits.length > 0 && <span className="dsh-git-file-count">最近 {commits.length} 条</span>}
          <button type="button" aria-label="刷新提交记录" title="刷新" className="dsh-git-refresh-btn"
            disabled={loading} onClick={() => setRefresh(value => value + 1)}>
            <IconRefresh size={15} className={loading ? 'dsh-git-spin' : ''} />
          </button>
        </div>
      </div>
    </div>
    <div className="dsh-git-history-list">
      {error ? <div className="dsh-git-empty-state">
        <div className="dsh-git-state-icon"><IconHistory size={24} /></div><strong>无法读取提交记录</strong>
        <p className="dsh-git-state-error" role="alert">{error}</p>
        <button type="button" className="dsh-git-btn dsh-git-btn-secondary" onClick={() => setRefresh(value => value + 1)}><IconRefresh size={14} />重试</button>
      </div>
        : loading ? <GitLoadingState title="正在读取提交记录" hint="最近的提交、作者与分支引用即将显示" rows={4} />
        : commits.length === 0 ? <div className="dsh-git-empty-state">
          <div className="dsh-git-state-icon"><IconHistory size={24} /></div><strong>暂无提交记录</strong>
          <p>这个仓库还没有提交，第一次提交后会显示在这里。</p>
        </div>
        : commits.map(commit => <article key={commit.hash} className="dsh-git-history-item">
          <div className="dsh-git-history-subject">{commit.subject}</div>
          {commit.refs.length > 0 && <div className="dsh-git-history-refs">{commit.refs.map(ref => <span key={ref} className="dsh-git-ref">{ref}</span>)}</div>}
          <div className="dsh-git-history-meta"><code title={commit.hash}>{commit.shortHash}</code><span>{commit.author}</span><time>{commit.date}</time></div>
        </article>)}
    </div>
  </section>
}
