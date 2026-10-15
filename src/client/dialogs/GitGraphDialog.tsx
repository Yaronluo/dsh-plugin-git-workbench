import React, { useEffect, useState } from 'react'
import type { GitGraphCommit } from '../../core/types.js'
import { gitApi } from '../api.js'
import { IconClose, IconGraph } from '../icons.js'

export function GitGraphDialog({ path, onClose }: { path: string; onClose: () => void }) {
  const [commits, setCommits] = useState<GitGraphCommit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    gitApi
      .getLog(path, 60)
      .then(res => setCommits(res))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [path])

  return (
    <div className="dsh-git-modal-overlay" onClick={onClose}>
      <div className="dsh-git-modal-card" style={{ width: 720, height: 520 }} onClick={e => e.stopPropagation()}>
        <div className="dsh-git-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconGraph size={18} />
            <span>Git 提交图谱</span>
          </div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}>
            <IconClose size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>正在加载提交图谱...</div>
          ) : commits.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>暂无提交记录</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {commits.map((c, i) => (
                <div
                  key={c.hash}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: i % 2 === 0 ? '#fafafa' : '#ffffff',
                    border: '1px solid #f3f4f6',
                    fontSize: 13,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: '#3b82f6',
                      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.2)',
                    }}
                  />
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>{c.shortHash}</span>

                  {c.refs.length > 0 && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {c.refs.map(r => (
                        <span
                          key={r}
                          style={{
                            fontSize: 11,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: r.includes('HEAD') ? '#dbeafe' : '#f3f4f6',
                            color: r.includes('HEAD') ? '#1e40af' : '#4b5563',
                            fontWeight: 500,
                          }}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  )}

                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {c.subject}
                  </span>

                  <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{c.author}</span>
                  <span style={{ fontSize: 11.5, color: '#9ca3af', whiteSpace: 'nowrap' }}>{c.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dsh-git-modal-footer">
          <button type="button" className="dsh-git-btn dsh-git-btn-secondary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
