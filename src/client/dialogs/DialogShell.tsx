import React, { useContext, useEffect, useRef } from 'react'
import { GitPanelContext } from '../panels/panel-context.js'

/** Focus management is restricted to this plugin's own dialog subtree. */
export function DialogShell({ title, onClose, busy = false, children, style }: {
  title: string; onClose: () => void; busy?: boolean; children: React.ReactNode; style?: React.CSSProperties
}) {
  const inline = useContext(GitPanelContext)
  const card = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null)
  const close = useRef(onClose)
  close.current = onClose
  const busyRef = useRef(busy)
  busyRef.current = busy
  useEffect(() => {
    if (inline) return
    const previous = restoreFocus.current
    const node = card.current
    if (!node) return
    if (!node.contains(document.activeElement)) {
      const first = node.querySelector<HTMLElement>('input, button:not(:disabled), [tabindex="0"]')
      ;(first ?? node).focus()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (!busyRef.current) close.current()
      } else if (event.key === 'Tab') {
        const targets = Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'))
        const first = targets[0]
        const last = targets[targets.length - 1]
        if (!first) { event.preventDefault(); node.focus() }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === node)) { event.preventDefault(); first.focus() }
      }
    }
    node.addEventListener('keydown', onKey)
    return () => { node.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus() }
  }, [inline])
  if (inline) return <section ref={card} className="dsh-git-panel-form" aria-label={title} aria-busy={busy}>{children}</section>
  return <div className="dsh-git-modal-overlay" onClick={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <div ref={card} className="dsh-git-modal-card" role="dialog" aria-modal="true" aria-label={title} aria-busy={busy} tabIndex={-1} style={style}>
      {children}
    </div>
  </div>
}
