import React from 'react'
import { IconRefresh } from './icons.js'

/**
 * The one loading presentation for every Git page. A bare "加载中…" line reads as an
 * empty panel: this shows what is being loaded and the shape of the answer, so a slow
 * repository, log or worktree list never looks broken.
 */
export function GitLoadingState({ title, hint, rows = 3, className = '' }: {
  title: string; hint?: string; rows?: number; className?: string
}) {
  return <div className={`dsh-git-changes-loading ${className}`.trim()} role="status" aria-live="polite">
    <div className="dsh-git-loading-icon"><IconRefresh size={20} className="dsh-git-spin" /></div>
    <strong>{title}</strong>
    {hint ? <p>{hint}</p> : null}
    <div className="dsh-git-loading-preview" aria-hidden="true">
      {Array.from({ length: Math.max(1, rows) }, (_, index) => <i key={index} />)}
    </div>
  </div>
}
