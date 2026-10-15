import React, { useEffect, useState } from 'react'
import type { GitGraphCommit } from '../../core/types.js'
import { gitApi } from '../api.js'
import { IconHistory, IconRefresh } from '../icons.js'
import { useGitStatus } from '../hooks/use-git-status.js'

/** Legacy export name retained; this is now ordinary native-sidebar content. */
export function GitGraphDialog({ path }: { path: string; onClose?: () => void }) {
  const { status } = useGitStatus(path)
  const [commits, setCommits] = useState<GitGraphCommit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
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
  }, [path, refresh, status?.head, status?.branch])

  return <section className="dsh-git-history-panel" aria-label="提交记录">
    <div className="dsh-git-changes-header">
      <span className="dsh-git-panel-heading"><IconHistory size={17} />提交记录</span>
      <button type="button" aria-label="刷新提交记录" title="刷新" className="dsh-git-selector-btn" onClick={() => setRefresh(value => value + 1)}><IconRefresh size={16} /></button>
    </div>
    <div className="dsh-git-history-list">
      {error ? <div className="dsh-git-error dsh-git-panel-message" role="alert">{error} <button type="button" className="dsh-git-selector-btn" onClick={() => setRefresh(value => value + 1)}>重试</button></div>
        : loading ? <div className="dsh-git-panel-message" role="status">加载中…</div>
        : commits.length === 0 ? <div className="dsh-git-empty-state"><IconHistory size={40} /><strong>暂无提交记录</strong></div>
        : commits.map(commit => <article key={commit.hash} className="dsh-git-history-item">
          <div className="dsh-git-history-subject">{commit.subject}</div>
          {commit.refs.length > 0 && <div className="dsh-git-history-refs">{commit.refs.map(ref => <span key={ref} className="dsh-git-ref">{ref}</span>)}</div>}
          <div className="dsh-git-history-meta"><code title={commit.hash}>{commit.shortHash}</code><span>{commit.author}</span><time>{commit.date}</time></div>
        </article>)}
    </div>
  </section>
}
