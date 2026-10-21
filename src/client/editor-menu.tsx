import React, { useEffect, useState } from 'react'
import type { EditorChoice } from '../core/types.js'
import { errorMessage, gitApi } from './api.js'
import { EditorMark } from './editor-icons.js'
import { IconChevronDown, IconExternalLink, IconFile, IconFolderTree } from './icons.js'

/** Same shape the panels already render in their notice bars. */
export interface EditorNotice { ok: boolean; text: string }

/** Matches the host's marker for "let the OS decide" (see `SYSTEM_EDITOR` in editor-launcher). */
export const SYSTEM_EDITOR = 'system'

/**
 * "Open in editor" with the choice kept in the panel.
 *
 * The host probes for editor CLIs, and on a machine without one the plain button fell
 * through to the Windows "Open with" dialog. Listing what was actually found means the
 * click never surprises the user, and the system default stays an explicit entry.
 *
 * The menu borrows the shape of Windows 11's "Open with": the association a plain double
 * click would use leads the list and carries the "（默认）" tag, every row is the
 * application's own icon and name (the command behind it waits in the tooltip), and the
 * footer reveals the file in the OS file manager instead of opening it.
 */
export function OpenInEditorMenu({ repo, file, line, onNotice, label = '在编辑器中打开', size = 13, disabled = false, className = '' }: {
  repo: string
  file: string
  line?: number
  onNotice?: (notice: EditorNotice | null) => void
  label?: string
  size?: number
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [editors, setEditors] = useState<EditorChoice[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Ask the host once per opening: the answer only changes when the machine does. The probe
  // must not be a dependency of its own effect — its state change would cancel the request
  // that is still in flight and the list would never arrive. A failure keeps `editors` null,
  // so closing and reopening the menu retries.
  useEffect(() => {
    if (!open || editors) return
    let cancelled = false
    setLoadError(null)
    gitApi.listEditors()
      .then(list => { if (!cancelled) setEditors(list) })
      .catch(error => { if (!cancelled) setLoadError(errorMessage(error)) })
    return () => { cancelled = true }
  }, [open, editors])

  const choose = async (editor: string) => {
    setOpen(false)
    setBusy(true)
    onNotice?.(null)
    try {
      const outcome = await gitApi.openInEditor(repo, file, line, editor)
      onNotice?.(outcome.ok
        ? { ok: true, text: `${outcome.editor ? `已用 ${outcome.editor} 打开` : '已用系统默认应用打开'}：${outcome.target || file}` }
        : { ok: false, text: outcome.error || '无法打开外部编辑器' })
    } catch (error) {
      onNotice?.({ ok: false, text: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const reveal = async () => {
    setOpen(false)
    setBusy(true)
    onNotice?.(null)
    try {
      const outcome = await gitApi.reveal(repo, file)
      onNotice?.(outcome.ok
        ? { ok: true, text: `已在文件管理器中显示：${outcome.target || file}` }
        : { ok: false, text: outcome.error || '无法在文件管理器中显示这个文件' })
    } catch (error) {
      onNotice?.({ ok: false, text: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return <div className={`dsh-git-editor-control ${className}`.trim()}
    onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false) } }}>
    <button type="button" className="dsh-git-btn dsh-git-btn-secondary dsh-git-open-editor"
      title="在外部编辑器中打开这个文件（点击选择用哪个）" aria-haspopup="menu" aria-expanded={open}
      disabled={disabled || busy} onClick={() => setOpen(value => !value)}>
      <IconExternalLink size={size} /><span>{label}</span><IconChevronDown size={12} />
    </button>
    {open && <>
      <div className="dsh-git-editor-backdrop" onClick={() => setOpen(false)} />
      <div className="dsh-git-editor-menu" role="menu" aria-label="选择外部编辑器">
        {/* The OS association is what a plain double click would use, so it leads the list. */}
        <button type="button" role="menuitem" className="dsh-git-editor-option"
          title="用系统当前关联的默认应用打开" onClick={() => { void choose(SYSTEM_EDITOR) }}>
          <IconFile size={15} /><span className="dsh-git-editor-label">系统默认应用</span>
          <span className="dsh-git-editor-tag">（默认）</span>
        </button>
        {!editors && !loadError && <div className="dsh-git-editor-hint" role="status">
          <span className="dsh-git-editor-spinner" aria-hidden="true" />正在检测已安装的编辑器…
        </div>}
        {loadError && <div className="dsh-git-editor-hint dsh-git-error" role="alert">{loadError}</div>}
        {editors?.length === 0 && <div className="dsh-git-editor-hint">没有检测到编辑器命令行</div>}
        {editors?.map(choice => <button key={choice.command} type="button" role="menuitem" className="dsh-git-editor-option"
          title={choice.command} onClick={() => { void choose(choice.command) }}>
          {/* The host reads the application's real icon; only when it has none do we draw one. */}
          {choice.icon
            ? <img className="dsh-git-editor-mark dsh-git-editor-mark-image" src={choice.icon} alt="" width={16} height={16} />
            : <EditorMark command={choice.command} label={choice.label} />}
          <span className="dsh-git-editor-label">{choice.label}</span>
        </button>)}
        <button type="button" role="menuitem" className="dsh-git-editor-option dsh-git-editor-option-split"
          title="在系统文件管理器中选中这个文件" onClick={() => { void reveal() }}>
          <IconFolderTree size={14} /><span className="dsh-git-editor-label">显示文件位置</span>
        </button>
      </div>
    </>}
  </div>
}
