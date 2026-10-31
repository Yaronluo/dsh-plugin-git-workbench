import React, { useState, useEffect, useMemo, useRef } from 'react'
import type { ConflictFile, DiffFile, DiffView } from '../../core/types.js'
import { gitApi, errorMessage, blobUrl } from '../api.js'
import {
  IconArrowDown, IconArrowUp, IconBranch, IconCheck, IconChevronDown, IconChevronUp, IconClose, IconColumns,
  IconCommit, IconCopy, IconDiff, IconFile, IconFolderTree, IconHistory, IconImage, IconMinus,
  IconPlus, IconRefresh, IconSparkle, IconStash, IconTrash, IconUndo, IconWarning,
} from '../icons.js'
import { buildCommitPrompt, buildContextText, buildExplainPrompt, buildReviewPrompt, deliverPrompt } from '../agent-bridge.js'
import type { PromptContext } from '../agent-bridge.js'
import { useWorkspaceCwd } from '../cwd-resolver.js'
import { useGitStatus } from '../hooks/use-git-status.js'
import { GitLoadingState } from '../loading-state.js'
import { OpenInEditorMenu } from '../editor-menu.js'
import { FileInspectDialog } from '../dialogs/FileInspectDialog.js'
import { buildSections, canPreviewImage, commitProblem, indexSummary, statusLetter, statusTone, toChangeEntries } from './change-sections.js'
import type { ChangeRow } from './change-sections.js'
import { buildHunkPatch, splitRows, wordHighlight } from './patch.js'
import { readWorkbenchUiState, writeWorkbenchUiState } from './workbench-state.js'
import type { WorkbenchUiState } from './workbench-state.js'

/** 仓库状态与文件差异是两个请求，对用户却是一次等待，因此共用一个加载画面。 */
function ChangesLoading() {
  return <GitLoadingState title="Loading repository" hint="Branches and file changes will appear here shortly" />
}

/** 进行中的 Git 操作能提供哪些收尾动作；二分查找与应用补丁没有可跳过的步骤。 */
const OPERATION_LABELS: Record<string, string> = {
  merge: 'Merge in progress',
  rebase: 'Rebase in progress',
  'cherry-pick': 'Cherry-pick in progress',
  revert: 'Revert in progress',
  am: 'Applying mail patch in progress',
  bisect: 'Bisect in progress',
  apply: 'Patch application in progress',
}

const OPERATION_STEPS: Record<string, Array<'continue' | 'abort' | 'skip'>> = {
  merge: ['continue', 'abort'],
  rebase: ['continue', 'skip', 'abort'],
  'cherry-pick': ['continue', 'skip', 'abort'],
  revert: ['continue', 'skip', 'abort'],
  am: ['continue', 'skip', 'abort'],
}

const STEP_LABELS: Record<string, string> = { continue: 'Continue', skip: 'Skip this step', abort: 'Abort operation' }

type CompareScope = 'all' | 'unstaged' | 'staged'

const SCOPES: Array<{ key: CompareScope; label: string; hint: string }> = [
  { key: 'all', label: 'All', hint: 'All differences between the working tree and HEAD' },
  { key: 'unstaged', label: 'Unstaged', hint: 'Between the index and the working tree (stage hunk by hunk is available)' },
  { key: 'staged', label: 'Staged', hint: 'Between HEAD and the index (unstage hunk by hunk is available)' },
]

const CONTEXT_CHOICES = [0, 3, 10]

interface Notice {
  ok: boolean
  text: string
}

export function ChangesTab(props: any) {
  const cwd = useWorkspaceCwd(props)
  const sessionId = props.sessionId == null ? null : String(props.sessionId)
  const restoredUiState = readWorkbenchUiState(sessionId, cwd)
  const { status, isGit, loading: statusLoading, error: statusError, reload: reloadStatus } = useGitStatus(cwd)
  const [selectedFile, setSelectedFile] = useState<string | null>(() => restoredUiState?.selectedFile ?? null)
  const [compareTarget, setCompareTarget] = useState<'working-head' | 'branch-upstream'>(() => restoredUiState?.compareTarget ?? 'working-head')
  const [compareDropdownOpen, setCompareDropdownOpen] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [editorNotice, setEditorNotice] = useState<Notice | null>(null)
  const branch = status?.branch
  const head = status?.head
  const revision = status?.revision
  const upstream = status?.upstream
  const dirtyFiles = status?.dirtyFiles
  const requestKey = JSON.stringify([sessionId, cwd, isGit, compareTarget, branch, head, revision, upstream, dirtyFiles, refresh])
  const [result, setResult] = useState<{ key: string; view: DiffView | null; error: string | null; loading: boolean } | null>(null)
  // Everything below this line is additive: the states above keep their identity because
  // the hook order is part of the panel's contract with its tests and its own past renders.
  const [compareScope, setCompareScope] = useState<CompareScope>(() => restoredUiState?.compareScope ?? 'all')
  const [contextLines, setContextLines] = useState(3)
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  const [wordLevel, setWordLevel] = useState(true)
  const [splitView, setSplitView] = useState(false)
  const [activeHunk, setActiveHunk] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<Notice | null>(null)
  const [commitMessage, setCommitMessage] = useState(() => restoredUiState?.commitMessage ?? '')
  const [amend, setAmend] = useState(false)
  const [signoff, setSignoff] = useState(false)
  const [commitAll, setCommitAll] = useState(false)
  const [conflictOpen, setConflictOpen] = useState<string | null>(null)
  const [conflictFile, setConflictFile] = useState<ConflictFile | null>(null)
  const [conflictError, setConflictError] = useState<string | null>(null)
  const conflictRequest = useRef(0)
  const [inspectFile, setInspectFile] = useState<string | null>(null)
  const [fileQuery, setFileQuery] = useState('')
  const current = result?.key === requestKey ? result : null
  const diffView = current?.view ?? null
  /**
   * Set while the panel is narrowed to one file's patch. The list then contains only that
   * file, which is the point: a repository-wide diff of a large tree is the one payload that
   * is worth not asking for when the user is looking at a single file.
   */
  const [focusedFile, setFocusedFile] = useState<{ cwd: string; path: string } | null>(() => restoredUiState?.focusedFile ?? null)
  const cacheIdentityRef = useRef<{ sessionId: string | null; cwd: string }>({ sessionId, cwd })
  // A focused path belongs to its cached session and repository; never use it during an identity transition.
  const focusPath = cacheIdentityRef.current.sessionId === sessionId && focusedFile?.cwd === cwd ? focusedFile.path : null
  const fileListElement = useRef<HTMLDivElement | null>(null)
  const diffLinesElement = useRef<HTMLDivElement | null>(null)
  const uiStateRef = useRef<WorkbenchUiState>({
    selectedFile,
    compareTarget,
    compareScope,
    focusedFile,
    commitMessage,
    fileListScrollTop: restoredUiState?.fileListScrollTop ?? 0,
    diffScrollTop: restoredUiState?.diffScrollTop ?? 0,
  })
  // Keep the UI snapshot current without caching transient requests, errors or commit options.
  uiStateRef.current = { ...uiStateRef.current, selectedFile, compareTarget, compareScope, focusedFile, commitMessage }
  const saveUiState = (identity: { sessionId: string | null; cwd: string }) => {
    const state = uiStateRef.current
    writeWorkbenchUiState(identity.sessionId, identity.cwd, {
      ...state,
      fileListScrollTop: fileListElement.current?.scrollTop ?? state.fileListScrollTop,
      diffScrollTop: diffLinesElement.current?.scrollTop ?? state.diffScrollTop,
    })
  }
  const loadingDiff = !!cwd && isGit && (!current || current.loading)
  const diffError = current?.error

  useEffect(() => {
    const previous = cacheIdentityRef.current
    if (previous.sessionId === sessionId && previous.cwd === cwd) return

    // Preserve the previous workspace before selecting the next session/repository snapshot.
    saveUiState(previous)
    cacheIdentityRef.current = { sessionId, cwd }
    const restored = readWorkbenchUiState(sessionId, cwd)
    const restoredFocus = restored?.focusedFile?.cwd === cwd ? restored.focusedFile : null
    const nextState: WorkbenchUiState = {
      selectedFile: restored?.selectedFile ?? null,
      compareTarget: restored?.compareTarget ?? 'working-head',
      compareScope: restored?.compareScope ?? 'all',
      focusedFile: restoredFocus,
      commitMessage: restored?.commitMessage ?? '',
      fileListScrollTop: restored?.fileListScrollTop ?? 0,
      diffScrollTop: restored?.diffScrollTop ?? 0,
    }
    uiStateRef.current = nextState
    setSelectedFile(nextState.selectedFile)
    setCompareTarget(nextState.compareTarget)
    setCompareScope(nextState.compareScope)
    setFocusedFile(nextState.focusedFile)
    setCommitMessage(nextState.commitMessage)
    if (fileListElement.current) fileListElement.current.scrollTop = nextState.fileListScrollTop
    if (diffLinesElement.current) diffLinesElement.current.scrollTop = nextState.diffScrollTop

    setCompareDropdownOpen(false)
    setFileQuery('')
    setConflictOpen(null)
    setConflictFile(null)
    setConflictError(null)
    setInspectFile(null)
    conflictRequest.current += 1
    setActionNotice(null)
    setEditorNotice(null)
  }, [sessionId, cwd])

  // A slot unmount is not a user reset: retain only the allow-listed UI state in memory.
  useEffect(() => () => saveUiState(cacheIdentityRef.current), [])

  // Scroll nodes are recreated after the diff request; restore their independent offsets then.
  useEffect(() => {
    if (!diffView) return
    if (fileListElement.current) fileListElement.current.scrollTop = uiStateRef.current.fileListScrollTop
    if (diffLinesElement.current) diffLinesElement.current.scrollTop = uiStateRef.current.diffScrollTop
  }, [diffView])

  // The editor result is a transient confirmation, not a state of the repository.
  useEffect(() => {
    if (!editorNotice) return
    const timer = setTimeout(() => setEditorNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [editorNotice])

  useEffect(() => {
    if (!actionNotice) return
    const timer = setTimeout(() => setActionNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [actionNotice])

  // Amending rewrites the message that is already there, so it starts from that message
  // instead of from an empty box that would silently erase it.
  useEffect(() => {
    if (!amend || !cwd) return
    let cancelled = false
    gitApi.getLastCommitMessage(cwd).then(message => {
      if (!cancelled && message) setCommitMessage(previous => previous || message)
    }).catch(() => { /* an empty box is a usable fallback */ })
    return () => { cancelled = true }
  }, [amend, cwd])

  useEffect(() => {
    const controller = new AbortController()
    if (!cwd || !isGit) { setResult(null); return () => controller.abort() }
    if (compareScope === 'all' && compareTarget === 'branch-upstream' && !upstream) {
      setResult({ key: requestKey, view: null, error: 'The current branch has no upstream configured; cannot compare.', loading: false })
      return () => controller.abort()
    }
    setResult({ key: requestKey, view: null, error: null, loading: true })
    setActiveHunk(0)
    // `all` compares the index AND the worktree against HEAD; the two scoped views are the
    // index boundaries themselves, which is also what makes hunk-level staging exact.
    const base = compareScope === 'all' ? (compareTarget === 'branch-upstream' ? upstream : 'HEAD') : undefined
    const target = compareScope === 'all' && compareTarget === 'branch-upstream' ? 'HEAD' : undefined
    const options: { mode?: 'staged' | 'unstaged'; context: number; ignoreWhitespace: boolean; files?: string[] } = {
      context: contextLines,
      ignoreWhitespace,
    }
    if (compareScope !== 'all') options.mode = compareScope
    // A focused request asks Git for one path, so a 2000-file tree never travels to render one.
    if (focusPath) options.files = [focusPath]
    gitApi.getDiff(cwd, base, target, controller.signal, options).then(view => {
      if (controller.signal.aborted) return
      setResult({ key: requestKey, view, error: null, loading: false })
      setSelectedFile(previous => view.files.some(file => file.path === previous) ? previous : view.files[0]?.path ?? null)
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key: requestKey, view: null, error: error instanceof Error ? error.message : String(error), loading: false })
    })
    return () => controller.abort()
  }, [cwd, isGit, compareTarget, compareScope, contextLines, ignoreWhitespace, branch, head, revision, upstream, dirtyFiles, refresh, focusPath, requestKey])

  const activeFile = useMemo(() => {
    if (!diffView || !selectedFile) return diffView?.files[0] || null
    return diffView.files.find(f => f.path === selectedFile) || diffView.files[0] || null
  }, [diffView, selectedFile])

  const highlighted = useMemo(() => {
    if (!wordLevel || splitView || !activeFile) return null
    const byHunk = new Map<number, ReturnType<typeof wordHighlight>>()
    activeFile.hunks.forEach((hunk, index) => byHunk.set(index, wordHighlight(hunk.lines)))
    return byHunk
  }, [wordLevel, splitView, activeFile])

  const files = diffView?.files ?? []
  const entries = status?.entries ? toChangeEntries(status.entries) : undefined
  const summary = indexSummary(entries)
  const sections = buildSections(files, entries, 'Changed files')
  const showSectionHeaders = !(sections.length === 1 && !entries?.length)
  const query = fileQuery.trim().toLowerCase()
  const operation: string | undefined = status?.operation ?? undefined
  const operationSteps = operation ? OPERATION_STEPS[operation] ?? [] : []
  const conflictCount = summary.conflicts
  const stagedCount = summary.staged
  const amendable = amend && !commitMessage.trim()
  const commitIssue = commitAll
    ? (conflictCount > 0 ? 'There are unresolved conflicts, resolve them before committing.' : (commitMessage.trim() ? null : 'Please fill in the commit message.'))
    : amendable ? (conflictCount > 0 ? 'There are unresolved conflicts, resolve them before committing.' : null) : commitProblem(commitMessage, summary)

  /** One place for the busy flag, the outcome notice and the refresh that follows every write. */
  const run = async (label: string, action: () => Promise<{ ok?: boolean; error?: string } | void>) => {
    if (busy) return
    setBusy(label)
    setActionNotice(null)
    try {
      const outcome = await action()
      if (outcome && outcome.ok === false) setActionNotice({ ok: false, text: outcome.error || `${label}Failed` })
      else setActionNotice({ ok: true, text: `${label}Done` })
      reloadStatus()
      setRefresh(value => value + 1)
    } catch (error) {
      setActionNotice({ ok: false, text: errorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  const copyText = async (label: string, text: string) => {
    try {
      const clipboard = (globalThis as any).navigator?.clipboard
      if (!clipboard?.writeText) throw new Error('The current environment does not support the clipboard')
      await clipboard.writeText(text)
      setActionNotice({ ok: true, text: `${label}Copied` })
    } catch (error) {
      setActionNotice({ ok: false, text: errorMessage(error) })
    }
  }

  /**
   * The Git state handed to the session's agent. Only the half the user is looking at is
   * sent as a patch: the agent can fetch the rest itself, and a 100k-line diff would just
   * crowd out the conversation.
   */
  const promptContext = (): PromptContext => ({
    cwd,
    branch,
    upstream,
    ahead: status?.ahead,
    behind: status?.behind,
    summary: `${summary.staged} staged / ${summary.unstaged} unstaged / ${summary.untracked} untracked, +${summary.insertions} -${summary.deletions}`,
    staged: (entries ?? []).filter(entry => entry.section === 'staged').map(entry => entry.path),
    unstaged: (entries ?? []).filter(entry => entry.section === 'unstaged').map(entry => entry.path),
    untracked: (entries ?? []).filter(entry => entry.section === 'untracked').map(entry => entry.path),
    conflicts: (entries ?? []).filter(entry => entry.section === 'conflict').map(entry => entry.path),
    patch: files.map(file => file.rawPatch ?? '').join(''),
  })

  /** Draft only: the reader reviews/edits the side conversation before choosing Send. */
  const askAgent = async (label: string, text: string) => {
    if (!text.trim()) return
    setActionNotice({ ok: true, text: 'Opening the side chat and filling in the prompt…' })
    try {
      const result = await deliverPrompt({ ...props, cwd }, props.sessionId, text)
      if (!result.ok) { setActionNotice({ ok: false, text: result.error || `${label}Failed` }); return }
      setActionNotice({ ok: true, text: result.mode === 'new-conversation'
        ? `Created a new chat and filled in "${label}" prompt, confirm before sending`
        : `Filled in the side chat "${label}" prompt, confirm before sending` })
    } catch (error) {
      setActionNotice({ ok: false, text: errorMessage(error) || `${label}Failed` })
    }
  }

  const draftCommitPrompt = async (event?: { detail?: number }) => {
    if ((event?.detail ?? 0) > 1) return
    try {
      // A commit message must describe the index, even when the review pane is showing all changes.
      const staged = compareScope === 'staged' ? diffView : await gitApi.getDiff(cwd, 'HEAD', 'working', undefined, { mode: 'staged' })
      await askAgent('Commit message', buildCommitPrompt({ ...promptContext(), patch: staged?.files.map(file => file.rawPatch ?? '').join('') || '' }))
    } catch (error) { setActionNotice({ ok: false, text: errorMessage(error) }) }
  }

  const applyHunks = (file: DiffFile, indexes: number[], direction: 'stage' | 'unstage') => {
    const patch = buildHunkPatch(file.rawPatch ?? '', indexes)
    if (!patch) {
      setActionNotice({ ok: false, text: 'No patch is available for this hunk, use a whole-file action instead.' })
      return
    }
    return run(direction === 'stage' ? 'Stage selected lines' : 'Unstage selected lines', () =>
      gitApi.applyPatch(cwd, patch, direction === 'unstage' ? { cached: true, reverse: true } : { cached: true }))
  }

  /** Walks the hunks of the open file; scrolling is a best-effort extra for real browsers. */
  const jumpHunk = (delta: number) => {
    const total = activeFile?.hunks.length ?? 0
    if (!total) return
    const next = (activeHunk + delta + total) % total
    setActiveHunk(next)
    const element = (globalThis as any).document?.getElementById(`dsh-git-hunk-${next}`)
    element?.scrollIntoView?.({ block: 'center' })
  }

  const showConflict = async (path: string) => {
    const request = ++conflictRequest.current
    if (conflictOpen === path) {
      setConflictOpen(null)
      setConflictFile(null)
      setConflictError(null)
      return
    }
    setConflictOpen(path)
    setConflictFile(null)
    setConflictError(null)
    try {
      const files = await gitApi.getConflicts(cwd)
      if (conflictRequest.current !== request) return
      setConflictFile(files.find(file => file.path === path) ?? null)
    } catch (error) {
      if (conflictRequest.current !== request) return
      setConflictError(errorMessage(error))
    }
  }

  const submitCommit = () => run(status?.operation ? 'Commit' : amend ? 'Amend commit' : 'Commit', async () => {
    const outcome = await gitApi.commit(cwd, { message: commitMessage, amend, signoff, all: commitAll })
    if (!outcome.ok) return outcome
    setCommitMessage('')
    setAmend(false)
    return outcome
  })

  // 等仓库状态和等差异是同一次等待，因此共用下面同一个加载画面：此前两者各有文案，
  // 于是先显示「正在加载仓库」再被换成「正在读取文件差异」，看起来像加载了两次。
  const firstLoad = statusLoading && !status && !statusError
  if (statusError && !status) return <div className="dsh-git-changes-panel"><div className="dsh-git-empty-state">
    <div className="dsh-git-state-icon"><IconDiff size={24} /></div><strong>Cannot load the repository right now</strong>
    <p className="dsh-git-state-error" role="alert">{statusError}</p>
    <button type="button" className="dsh-git-btn dsh-git-btn-secondary" onClick={reloadStatus}><IconRefresh size={14} />Reload</button>
  </div></div>
  // Non-Git repository empty state
  if (!statusLoading && !isGit) {
    return (
      <div className="dsh-git-changes-panel"><div className="dsh-git-empty-state">
        {statusError && <div className="dsh-git-state-error" role="alert">{statusError}</div>}
        <div className="dsh-git-state-icon"><IconDiff size={24} /></div>
        <strong>The current directory is not a Git repository</strong>
        <p>Run in project <code>git init</code> , then you can see branches and file diffs.</p>
        <button
          type="button"
          className="dsh-git-btn dsh-git-btn-primary"
          onClick={() => {
            reloadStatus()
          }}
        >
          Reload
        </button>
      </div></div>
    )
  }

  const renderRow = (row: ChangeRow) => {
    const isSelected = row.path === activeFile?.path
    const isUntracked = row.status === 'untracked'
    const canDiscard = row.section === 'unstaged' && !isUntracked
    return (
      <div key={row.key} className={`dsh-git-file-row ${isSelected ? 'dsh-git-file-row-active' : ''}`}>
        <button
          type="button"
          aria-pressed={isSelected}
          className={`dsh-git-file-item ${isSelected ? 'dsh-git-file-item-active' : ''}`}
          onClick={() => setSelectedFile(row.path)}
          title={row.path}
        >
          <span className={`dsh-git-file-status dsh-git-tone-${statusTone(row.status)}`}>{statusLetter(row.status)}</span>
          <span className="dsh-git-file-name">
            <IconFile size={13} />
            <span className="dsh-git-file-copy">
              <span>{row.path.split('/').pop() || row.path}</span>
              <small>{row.path.includes('/') ? row.path.slice(0, row.path.lastIndexOf('/')) : 'Repository root'}</small>
            </span>
          </span>
          <span className="dsh-git-file-stats">
            {row.file?.binary
              ? <span className="dsh-git-binary-mark">Binary</span>
              : row.insertions || row.deletions ? <><span className="dsh-git-ins">+{row.insertions}</span><span className="dsh-git-del">-{row.deletions}</span></> : null}
          </span>
        </button>
        <div className="dsh-git-file-actions">
          {row.section === 'unstaged' && <button type="button" className="dsh-git-icon-btn" title="Stage this file" disabled={!!busy}
            onClick={event => { event?.stopPropagation?.(); run('Stage file', () => gitApi.stage(cwd, [row.path])) }}><IconPlus size={12} /></button>}
          {row.section === 'staged' && <button type="button" className="dsh-git-icon-btn" title="Unstage this file" disabled={!!busy}
            onClick={event => { event?.stopPropagation?.(); run('Unstage', () => gitApi.unstage(cwd, [row.path])) }}><IconMinus size={12} /></button>}
          {canDiscard && <button type="button" className="dsh-git-icon-btn" title="Revert changes to this file" disabled={!!busy}
            onClick={event => { event?.stopPropagation?.(); run('Discard changes', () => gitApi.discard(cwd, [row.path])) }}><IconUndo size={12} /></button>}
          {row.section === 'staged' && <button type="button" className="dsh-git-icon-btn" title="Unstage and discard these changes" disabled={!!busy}
            onClick={event => { event?.stopPropagation?.(); run('Discard staged changes', () => gitApi.discard(cwd, [row.path], true)) }}><IconTrash size={12} /></button>}
          {isUntracked && <button type="button" className="dsh-git-icon-btn" title="Delete this untracked file" disabled={!!busy}
            onClick={event => { event?.stopPropagation?.(); run('Delete untracked files', () => gitApi.deleteUntracked(cwd, [row.path])) }}><IconTrash size={12} /></button>}
          {isUntracked && <button type="button" className="dsh-git-icon-btn" title="Add to .gitignore" disabled={!!busy}
            onClick={event => { event?.stopPropagation?.(); run('Add to .gitignore', () => gitApi.addToGitignore(cwd, [row.path])) }}><IconClose size={12} /></button>}
          {row.section === 'conflict' && <>
            <button type="button" className="dsh-git-icon-btn dsh-git-icon-btn-wide" title="Keep the current branch version (--ours)" disabled={!!busy}
              onClick={event => { event?.stopPropagation?.(); run('Use current version', () => gitApi.resolveConflict(cwd, row.path, 'ours')) }}>Current</button>
            <button type="button" className="dsh-git-icon-btn dsh-git-icon-btn-wide" title="Keep the incoming version (--theirs)" disabled={!!busy}
              onClick={event => { event?.stopPropagation?.(); run('Use incoming version', () => gitApi.resolveConflict(cwd, row.path, 'theirs')) }}>Incoming</button>
            <button type="button" className="dsh-git-icon-btn" title="View conflict" onClick={event => { event?.stopPropagation?.(); showConflict(row.path) }}><IconWarning size={12} /></button>
          </>}
          <button type="button" className="dsh-git-icon-btn" title="Reveal in file manager" disabled={!!busy}
            onClick={event => { event?.stopPropagation?.(); run('Reveal in file manager', () => gitApi.reveal(cwd, row.path)) }}><IconFolderTree size={12} /></button>
          <button type="button" className="dsh-git-icon-btn" title="Copy path"
            onClick={event => { event?.stopPropagation?.(); copyText('Path', row.path) }}><IconCopy size={12} /></button>
        </div>
        {conflictOpen === row.path && (
          <div className="dsh-git-conflict-view">
            {conflictError ? <div className="dsh-git-conflict-line dsh-git-error" role="alert">{conflictError}</div>
              : !conflictFile ? <div className="dsh-git-conflict-line">Reading conflict content…</div>
                : conflictFile.binary ? <div className="dsh-git-conflict-line">A binary file cannot show both conflict sides; choose a side with "Current / Incoming".</div>
                  : conflictFile.lines.map((line, index) => (
                    <div key={index} className={`dsh-git-conflict-line dsh-git-conflict-${line.type}`}>{line.content}</div>
                  ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="dsh-git-changes-panel" aria-busy={firstLoad ? 'true' : undefined}>
      {firstLoad ? <div className="dsh-git-toolbar-skeleton" aria-hidden="true"><i /><i /></div>
        : <div className="dsh-git-changes-header">
        <div className="dsh-git-repo-row">
          <span className="dsh-git-current-branch" title={status?.branch || 'HEAD'}><IconBranch size={15} /><span>{status?.branch || 'HEAD'}</span></span>
          {!!status?.ahead && <span className="dsh-git-ahead-behind dsh-git-ahead" title={` ahead of upstream ${status.ahead} commits`}><IconArrowUp size={12} />{status.ahead}</span>}
          {!!status?.behind && <span className="dsh-git-ahead-behind dsh-git-behind" title={` behind upstream ${status.behind} commits`}><IconArrowDown size={12} />{status.behind}</span>}
          {!!status?.stashCount && <span className="dsh-git-stash-badge" title={`has ${status.stashCount} stash entries`}><IconStash size={12} />{status.stashCount}</span>}
          <div className="dsh-git-change-summary">
            {diffView && <span className="dsh-git-file-count">{diffView.files.length ? `${diffView.files.length} files` : 'No changes'}</span>}
            {!!diffView?.files.length && <div className="dsh-git-stat-badge" aria-label={`Added ${diffView.totalInsertions} lines, deleted ${diffView.totalDeletions} lines`}>
              <span className="dsh-git-ins">+{diffView.totalInsertions}</span><span className="dsh-git-del">−{diffView.totalDeletions}</span>
            </div>}
          </div>
          <button type="button" className="dsh-git-refresh-btn" aria-label="Refresh changes" title="Refresh changes" disabled={loadingDiff || statusLoading} onClick={() => { reloadStatus(); setRefresh(value => value + 1) }}>
            <IconRefresh size={15} className={loadingDiff || statusLoading ? 'dsh-git-spin' : ''} />
          </button>
        </div>
        <div className="dsh-git-compare-control" onKeyDown={event => {
          if (event.key === 'Escape') {
            event.stopPropagation(); setCompareDropdownOpen(false)
            event.currentTarget.querySelector<HTMLButtonElement>('.dsh-git-compare-trigger')?.focus()
          }
        }}>
          <button type="button" className={`dsh-git-compare-trigger ${compareDropdownOpen ? 'dsh-git-compare-trigger-open' : ''}`} onClick={() => setCompareDropdownOpen(!compareDropdownOpen)} title="Switch diff base" aria-expanded={compareDropdownOpen}>
            <IconDiff size={15} />
            <span className="dsh-git-compare-label">{compareTarget === 'working-head' ? 'Workspace' : (status?.branch || 'HEAD')}</span>
            <span className="dsh-git-compare-arrow" aria-hidden="true">→</span>
            <span className="dsh-git-compare-base">{compareTarget === 'working-head' ? 'HEAD' : (upstream || 'No upstream configured')}</span>
            <IconChevronDown size={13} />
          </button>
          {compareDropdownOpen && <>
            <div className="dsh-git-compare-backdrop" onClick={() => setCompareDropdownOpen(false)} />
            <div className="dsh-git-compare-menu" role="group" aria-label="Compare against">
              <div className="dsh-git-compare-menu-heading">Compare against</div>
              <button type="button" className="dsh-git-compare-option" aria-pressed={compareTarget === 'working-head'} onClick={event => {
                setCompareTarget('working-head'); setCompareDropdownOpen(false)
                event.currentTarget.closest('.dsh-git-compare-control')?.querySelector<HTMLButtonElement>('.dsh-git-compare-trigger')?.focus()
              }}>
                <span className="dsh-git-option-icon"><IconDiff size={17} /></span>
                <span className="dsh-git-option-copy"><strong>Uncommitted changes</strong><span>Working tree vs HEAD</span></span>
                {compareTarget === 'working-head' && <IconCheck size={16} />}
              </button>
              <button type="button" className="dsh-git-compare-option" disabled={!upstream} aria-pressed={compareTarget === 'branch-upstream'} onClick={event => {
                setCompareTarget('branch-upstream'); setCompareDropdownOpen(false)
                event.currentTarget.closest('.dsh-git-compare-control')?.querySelector<HTMLButtonElement>('.dsh-git-compare-trigger')?.focus()
              }}>
                <span className="dsh-git-option-icon"><IconBranch size={17} /></span>
                <span className="dsh-git-option-copy"><strong>Compare with upstream{!upstream && <small>Not configured</small>}</strong><span>{upstream ? `${status?.branch || 'HEAD'} → ${upstream}` : 'Available after configuring an upstream branch'}</span></span>
                {compareTarget === 'branch-upstream' && <IconCheck size={16} />}
              </button>
            </div>
          </>}
        </div>
      </div>}

      {operation && <div className="dsh-git-operation-banner" role="status">
        <span className="dsh-git-operation-icon"><IconWarning size={16} /></span>
        <div className="dsh-git-operation-copy">
          <strong>{OPERATION_LABELS[operation] ?? `Git operation in progress (${operation})`}</strong>
          <span>{conflictCount > 0 ? `has ${conflictCount} files have conflicts; resolve them to continue.` : 'There are no conflicts to resolve; you can continue this operation.'}</span>
        </div>
        <div className="dsh-git-operation-actions">
          {operationSteps.map(step => (
            <button key={step} type="button" className={`dsh-git-btn dsh-git-btn-secondary ${step === 'abort' ? 'dsh-git-btn-danger' : ''}`}
              disabled={!!busy} onClick={() => run(STEP_LABELS[step], () => gitApi.operationStep(cwd, step))}>{STEP_LABELS[step]}</button>
          ))}
        </div>
      </div>}

      {statusError && <div className="dsh-git-changes-notice dsh-git-error" role="alert">{statusError}</div>}
      {editorNotice && <div className={`dsh-git-changes-notice ${editorNotice.ok ? 'dsh-git-editor-notice' : 'dsh-git-error'}`} role="status">{editorNotice.text}</div>}
      {actionNotice && <div className={`dsh-git-changes-notice ${actionNotice.ok ? 'dsh-git-action-notice' : 'dsh-git-error'}`} role="status">{actionNotice.text}</div>}
      {busy && <div className="dsh-git-changes-notice dsh-git-busy-notice" role="status">{busy}…</div>}
      {firstLoad || loadingDiff ? <ChangesLoading /> : diffError ? <div className="dsh-git-empty-state">
        <div className="dsh-git-state-icon"><IconDiff size={24} /></div><strong>Cannot read the diff</strong>
        <p className="dsh-git-state-error" role="alert">{diffError}</p>
        <button type="button" className="dsh-git-btn dsh-git-btn-secondary" onClick={() => { reloadStatus(); setRefresh(value => value + 1) }}><IconRefresh size={14} />Retry</button>
      </div> : diffView && diffView.files.length === 0 ? <div className="dsh-git-empty-state">
        <div className="dsh-git-state-icon dsh-git-state-clean"><IconCheck size={26} /></div>
        <strong>{compareScope === 'staged' ? 'The staging area is empty'
          : compareScope === 'unstaged' ? 'No unstaged changes'
            : compareTarget === 'working-head' ? 'Working tree is clean' : 'Up to date with upstream branch'}</strong>
        <p>{compareScope !== 'all'
          ? 'Switch the range above to view the other side of the diff.'
          : compareTarget === 'working-head' ? 'No uncommitted changes yet, new changes will appear here.' : 'There are no file differences between the current branch and its upstream.'}</p>
      </div> : <div className="dsh-git-changes-body">
        {/* File history/blame takes over both columns: appended below the commit form it
            landed outside the visible area of the workbench, which read as "no reaction". */}
        {inspectFile ? <FileInspectDialog path={cwd} file={inspectFile} onClose={() => setInspectFile(null)} /> : <>
        {/* Left column: grouped changes stay beside the wide diff viewer. */}
        <div className="dsh-git-changes-side">
          <div
            className="dsh-git-file-list"
            ref={fileListElement}
            onScroll={event => { uiStateRef.current.fileListScrollTop = event.currentTarget.scrollTop }}
          >
            <div className="dsh-git-file-list-heading">
              <span>Changed files</span>
              <span className="dsh-git-file-list-count">
                {summary.unstaged > 0 && <button type="button" className="dsh-git-link-btn" disabled={!!busy}
                  onClick={() => run('Stage all', () => gitApi.stageAll(cwd))}>Stage all</button>}
                {summary.staged > 0 && <button type="button" className="dsh-git-link-btn" disabled={!!busy}
                  onClick={() => run('Unstage all', () => gitApi.unstageAll(cwd))}>Unstage all</button>}
                <span>{diffView?.files.length || 0}</span>
              </span>
            </div>
            {files.length > 6 && <div className="dsh-git-file-filter">
              <IconFile size={13} />
              <input className="dsh-git-file-filter-input" value={fileQuery} placeholder="Filter files" onChange={event => setFileQuery(event.currentTarget.value)} />
              {fileQuery && <button type="button" className="dsh-git-icon-btn" title="Clear filter" onClick={() => setFileQuery('')}><IconClose size={12} /></button>}
            </div>}
            {focusPath && <div className="dsh-git-dirty-warning">
              <IconFile size={13} />
              <span>Loaded only <span className="dsh-git-mono">{focusPath}</span> patch</span>
              <button type="button" className="dsh-git-link-btn" onClick={() => setFocusedFile(null)}>Show all files</button>
            </div>}
            {!diffView || diffView.files.length === 0 ? (
              <div className="dsh-git-file-list-empty">No changes to compare</div>
            ) : (
              sections.map(section => {
                const rows = query
                  ? section.rows.filter(row => row.path.toLowerCase().includes(query))
                  : section.rows
                if (rows.length === 0) return null
                return (
                  <div key={section.key} className="dsh-git-file-section">
                    {showSectionHeaders && <div className={`dsh-git-file-section-heading dsh-git-section-${section.key}`}>
                      <span>{section.label}</span><span>{rows.length}</span>
                    </div>}
                    {rows.map(renderRow)}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right column: the inline diff viewer */}
        <div className="dsh-git-diff-view">
          {activeFile ? (
            <>
              {/* Diff File Header */}
              <div className="dsh-git-diff-header">
                {/* One row: the path ellipsizes instead of wrapping the stats and the
                    button onto separate lines. */}
                <div className="dsh-git-diff-file" title={activeFile.path}>
                  <IconFile size={14} />
                  <span className="dsh-git-diff-path">{activeFile.path}</span>
                  <span className="dsh-git-diff-stats">
                    <span className="dsh-git-ins">+{activeFile.insertions}</span>
                    <span className="dsh-git-del"> -{activeFile.deletions}</span>
                  </span>
                </div>
                <div className="dsh-git-head-actions">
                  {activeFile.status === 'untracked' && <button type="button" className="dsh-git-btn dsh-git-btn-secondary" title="Add this file to the index"
                    disabled={!!busy} onClick={() => run('Stage file', () => gitApi.stage(cwd, [activeFile.path]))}><IconPlus size={13} /><span>Stage</span></button>}
                  {activeFile.status === 'deleted' && <button type="button" className="dsh-git-btn dsh-git-btn-secondary" title="Restore this deleted file"
                    disabled={!!busy} onClick={() => run('Restore file', () => gitApi.discard(cwd, [activeFile.path]))}><IconUndo size={13} /><span>Restore</span></button>}
                  {canPreviewImage(activeFile) && <span className="dsh-git-image-hint"><IconImage size={13} />Image</span>}
                  <details className="dsh-git-file-menu">
                    <summary className="dsh-git-btn dsh-git-btn-secondary">More actions<IconChevronDown size={12} /></summary>
                    <div className="dsh-git-file-menu-items">
                  <button type="button" className="dsh-git-btn dsh-git-btn-secondary" title="View this file's history and line-by-line blame"
                    onClick={() => setInspectFile(activeFile.path)}><IconHistory size={13} /><span>History</span></button>
                  {/* Focusing narrows the request to this one path, so a huge tree does not
                      have to travel to render a single file. */}
                  {focusPath === activeFile.path
                    ? <button type="button" className="dsh-git-btn dsh-git-btn-secondary dsh-git-tool-btn-active" title="Reload the patches for all files"
                      onClick={() => setFocusedFile(null)}><IconRefresh size={13} /><span>All files</span></button>
                    : <button type="button" className="dsh-git-btn dsh-git-btn-secondary" title="Only request the patch for this file from Git"
                      onClick={() => setFocusedFile({ cwd, path: activeFile.path })}><IconFile size={13} /><span>Load this file only</span></button>}
                  <button type="button" className="dsh-git-btn dsh-git-btn-secondary dsh-git-ai-btn" title="Open the side chat and fill in the prompt explaining the current file's changes (does not send automatically)"
                    onClick={event => (event?.detail ?? 0) > 1 ? undefined : askAgent('Explain this file', buildExplainPrompt({ path: activeFile.path, patch: activeFile.rawPatch ?? '', statusLabel: statusTone(activeFile.status) === 'added' ? 'Added' : statusTone(activeFile.status) === 'deleted' ? 'Deleted' : 'Modified' }))}>
                    <IconSparkle size={13} /><span>Explain changes</span>
                  </button>
                  <button type="button" className="dsh-git-btn dsh-git-btn-secondary" title="Copy this file's path"
                    onClick={() => copyText('Path', activeFile.path)}><IconCopy size={13} /><span>Copy path</span></button>
                  <button type="button" className="dsh-git-btn dsh-git-btn-secondary" title="Reveal in file manager"
                    disabled={!!busy} onClick={() => run('Reveal in file manager', () => gitApi.reveal(cwd, activeFile.path))}><IconFolderTree size={13} /><span>Reveal in file manager</span></button>
                  <button type="button" className="dsh-git-btn dsh-git-btn-secondary" title="Copy this file's patch"
                    onClick={() => copyText('Patch', activeFile.rawPatch ?? '')}><IconDiff size={13} /><span>Copy patch</span></button>
                    </div>
                  </details>
                  {activeFile.status !== 'deleted' && <OpenInEditorMenu repo={cwd} file={activeFile.path} onNotice={setEditorNotice} />}
                </div>
              </div>

              <div className="dsh-git-diff-toolbar">
                <div className="dsh-git-scope-group" role="group" aria-label="Diff range">
                  {SCOPES.map(scope => (
                    <button key={scope.key} type="button" title={scope.hint} aria-pressed={compareScope === scope.key}
                      className={`dsh-git-scope-option ${compareScope === scope.key ? 'dsh-git-scope-option-active' : ''}`}
                      disabled={compareTarget === 'branch-upstream' && scope.key !== 'all' && scope.key !== 'unstaged'}
                      onClick={() => setCompareScope(scope.key)}>{scope.label}</button>
                  ))}
                </div>
                <div className="dsh-git-tool-group">
                  <button type="button" className="dsh-git-tool-btn" title="Show fewer or more context lines"
                    onClick={() => setContextLines(CONTEXT_CHOICES[(CONTEXT_CHOICES.indexOf(contextLines) + 1) % CONTEXT_CHOICES.length])}>
                    <IconColumns size={13} />Context {contextLines}
                  </button>
                  <button type="button" className={`dsh-git-tool-btn ${wordLevel ? 'dsh-git-tool-btn-active' : ''}`} aria-pressed={wordLevel}
                    title="Highlight changed words inline" onClick={() => setWordLevel(value => !value)}><span className="dsh-git-tool-glyph" aria-hidden="true">a</span>Word level</button>
                  <button type="button" className={`dsh-git-tool-btn ${ignoreWhitespace ? 'dsh-git-tool-btn-active' : ''}`} aria-pressed={ignoreWhitespace}
                    title="Ignore whitespace differences (git diff -w)" onClick={() => setIgnoreWhitespace(value => !value)}>Ignore whitespace</button>
                  <button type="button" className={`dsh-git-tool-btn ${splitView ? 'dsh-git-tool-btn-active' : ''}`} aria-pressed={splitView}
                    title="Show the before and after in two side-by-side columns" onClick={() => setSplitView(value => !value)}><IconColumns size={13} />Side by side</button>
                </div>
                <div className="dsh-git-tool-group">
                  <button type="button" className="dsh-git-tool-btn" title="Previous change" disabled={!activeFile.hunks.length}
                    onClick={() => jumpHunk(-1)}><IconChevronUp size={13} /></button>
                  <span className="dsh-git-hunk-position">{activeFile.hunks.length ? `${Math.min(activeHunk + 1, activeFile.hunks.length)}/${activeFile.hunks.length}` : '—'}</span>
                  <button type="button" className="dsh-git-tool-btn" title="Next change" disabled={!activeFile.hunks.length}
                    onClick={() => jumpHunk(1)}><IconChevronDown size={13} /></button>
                </div>
              </div>

              {/* Code Diff Lines */}
              <div
                className="dsh-git-diff-lines"
                ref={diffLinesElement}
                onScroll={event => { uiStateRef.current.diffScrollTop = event.currentTarget.scrollTop }}
              >
                {activeFile.hunks.length === 0 ? (
                  canPreviewImage(activeFile) ? <div className="dsh-git-image-preview-wrap">
                    <img className="dsh-git-image-preview" alt={activeFile.path} src={blobUrl(cwd, activeFile.path, status?.revision)} />
                    <span className="dsh-git-image-caption">{activeFile.path}</span>
                  </div> : <div className="dsh-git-diff-note">
                    {activeFile.status === 'deleted' ? 'File has been deleted'
                      : activeFile.binary ? 'Binary files have no diff lines to display.'
                        : 'The file contains no diff lines, or there are no changes in this range.'}
                  </div>
                ) : (
                  activeFile.hunks.map((hunk, hunkIndex) => {
                    const segments = highlighted?.get(hunkIndex)
                    const canStageHunk = compareScope === 'unstaged' && !activeFile.binary
                    const canUnstageHunk = compareScope === 'staged' && !activeFile.binary
                    return (
                      <div key={hunkIndex} id={`dsh-git-hunk-${hunkIndex}`}
                        className={`dsh-git-hunk ${hunkIndex === activeHunk ? 'dsh-git-hunk-current' : ''}`}>
                        <div className="dsh-git-hunk-header">
                          <span className="dsh-git-hunk-title">{hunk.header}</span>
                          <span className="dsh-git-hunk-actions">
                            {canStageHunk && <button type="button" className="dsh-git-hunk-action" title="Stage only this hunk" disabled={!!busy}
                              onClick={() => applyHunks(activeFile, [hunkIndex], 'stage')}><IconPlus size={11} />Stage these lines</button>}
                            {canUnstageHunk && <button type="button" className="dsh-git-hunk-action" title="Unstage only this hunk" disabled={!!busy}
                              onClick={() => applyHunks(activeFile, [hunkIndex], 'unstage')}><IconMinus size={11} />Unstage these lines</button>}
                            <button type="button" className="dsh-git-hunk-action" title="Copy this hunk"
                              onClick={() => copyText('Patch', buildHunkPatch(activeFile.rawPatch ?? '', [hunkIndex]) || activeFile.rawPatch || '')}><IconCopy size={11} /></button>
                          </span>
                        </div>
                        {splitView ? (
                          <div className="dsh-git-split">
                            {splitRows(hunk.lines).map((row, rowIndex) => (
                              <div className="dsh-git-split-row" key={rowIndex}>
                                <div className={`dsh-git-split-cell ${row.left ? `dsh-git-split-${row.left.type}` : 'dsh-git-split-blank'}`}>
                                  <span className="dsh-git-line-num">{row.left?.num ?? ''}</span>
                                  <span className="dsh-git-split-text">{row.left?.content ?? ''}</span>
                                </div>
                                <div className={`dsh-git-split-cell ${row.right ? `dsh-git-split-${row.right.type}` : 'dsh-git-split-blank'}`}>
                                  <span className="dsh-git-line-num">{row.right?.num ?? ''}</span>
                                  <span className="dsh-git-split-text">{row.right?.content ?? ''}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : hunk.lines.map((line, lineIndex) => (
                          <div
                            key={lineIndex}
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
                              <span className="dsh-git-line-sign">{line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}</span>
                              {segments?.get(lineIndex)
                                ? segments.get(lineIndex)!.map((segment, index) => segment.changed
                                  ? <span key={index} className={line.type === 'add' ? 'dsh-git-word-add' : 'dsh-git-word-del'}>{segment.text}</span>
                                  : <span key={index}>{segment.text}</span>)
                                : line.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })
                )}
              </div>
            </>
          ) : (
            <div className="dsh-git-diff-placeholder">Select a file on the left to see the diff</div>
          )}
        </div>
        </>}
      </div>}

      {diffView && diffView.files.length > 0 && <section className="dsh-git-commit-box" aria-label="Commit changes">
        <div className="dsh-git-commit-editor">
        <div className="dsh-git-commit-head">
          <span className="dsh-git-commit-title"><IconCommit size={14} />Commit</span>
          <span className="dsh-git-commit-count">{stagedCount ? `${stagedCount} files staged` : 'Staging area is empty'}</span>
        </div>
        <textarea
          className="dsh-git-commit-input"
          rows={3}
          placeholder={amend ? 'Leave blank to reuse the previous commit message' : 'Commit message: the first line is the subject, the body follows after a blank line'}
          value={commitMessage}
          disabled={!!busy}
          onChange={event => setCommitMessage(event.currentTarget.value)}
          // The usual commit-box habit: Ctrl/Cmd+Enter commits, and it still respects the
          // same guards as the button so a shortcut can never bypass the empty-index check.
          onKeyDown={event => {
            if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return
            event.preventDefault?.()
            if (busy || commitIssue) return
            void submitCommit()
          }}
        />
        </div>
        <div className="dsh-git-commit-controls">
        <div className="dsh-git-commit-options">
          <label className="dsh-git-checkbox" title="Rewrite the last commit instead of creating a new one">
            <input type="checkbox" checked={amend} disabled={!!busy} onChange={() => setAmend(value => !value)} />Amend last commit
          </label>
          <label className="dsh-git-checkbox" title="Add a Signed-off-by trailer to the commit message">
            <input type="checkbox" checked={signoff} disabled={!!busy} onChange={() => setSignoff(value => !value)} />Signature
          </label>
          <label className="dsh-git-checkbox" title="Commit unstaged changes as well (-a)">
            <input type="checkbox" checked={commitAll} disabled={!!busy} onChange={() => setCommitAll(value => !value)} />All changes
          </label>
        </div>
        {commitIssue && <div className="dsh-git-commit-hint">{commitIssue}</div>}
        <div className="dsh-git-commit-actions">
          <button type="button" className="dsh-git-btn dsh-git-btn-primary" disabled={!!busy || !!commitIssue} onClick={submitCommit}>
            <IconCheck size={13} />{amend ? 'Amend commit' : 'Commit'}
          </button>
          <button type="button" className="dsh-git-btn dsh-git-btn-secondary" disabled={!!busy} title="Undo the last commit, returning the changes to the index"
            onClick={() => run('Undo last commit', () => gitApi.undoCommit(cwd))}><IconUndo size={13} />Revert commit</button>
          <button type="button" className="dsh-git-btn dsh-git-btn-secondary dsh-git-ai-btn" disabled={!!busy}
            title="Open the side chat and fill in the prompt for writing a commit message from the staged changes (does not send automatically)"
            onClick={draftCommitPrompt}>
            <IconSparkle size={13} />AI write message
          </button>
        </div>
        {/* These actions share the commit form's repository context. */}
        <div className="dsh-git-ai-row">
          <button type="button" className="dsh-git-ai-btn" disabled={!!busy}
            title="Open the side chat and fill in the current Git context (does not send automatically)"
            onClick={event => (event?.detail ?? 0) > 1 ? undefined : askAgent('Git context', buildContextText(promptContext()))}>
            <IconSparkle size={12} />Inject Git context
          </button>
          <button type="button" className="dsh-git-ai-btn" disabled={!!busy}
            title="Open the side chat and fill in the prompt for reviewing the current changes (does not send automatically)"
            onClick={event => (event?.detail ?? 0) > 1 ? undefined : askAgent('Review changes', buildReviewPrompt(promptContext()))}>
            <IconSparkle size={12} />AI review changes
          </button>
        </div>
        </div>
      </section>}
    </div>
  )
}
