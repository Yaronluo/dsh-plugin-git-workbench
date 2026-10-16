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
  return <GitLoadingState title="正在加载仓库" hint="分支和文件变更即将显示在这里" />
}

/** 进行中的 Git 操作能提供哪些收尾动作；二分查找与应用补丁没有可跳过的步骤。 */
const OPERATION_LABELS: Record<string, string> = {
  merge: '合并进行中',
  rebase: '变基进行中',
  'cherry-pick': '拣选提交进行中',
  revert: '还原提交进行中',
  am: '应用邮件补丁进行中',
  bisect: '二分查找进行中',
  apply: '应用补丁进行中',
}

const OPERATION_STEPS: Record<string, Array<'continue' | 'abort' | 'skip'>> = {
  merge: ['continue', 'abort'],
  rebase: ['continue', 'skip', 'abort'],
  'cherry-pick': ['continue', 'skip', 'abort'],
  revert: ['continue', 'skip', 'abort'],
  am: ['continue', 'skip', 'abort'],
}

const STEP_LABELS: Record<string, string> = { continue: '继续', skip: '跳过这一步', abort: '中止操作' }

type CompareScope = 'all' | 'unstaged' | 'staged'

const SCOPES: Array<{ key: CompareScope; label: string; hint: string }> = [
  { key: 'all', label: '全部', hint: '工作区与 HEAD 的全部差异' },
  { key: 'unstaged', label: '未暂存', hint: '暂存区与工作区之间（可逐段暂存）' },
  { key: 'staged', label: '已暂存', hint: 'HEAD 与暂存区之间（可逐段取消暂存）' },
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
      setResult({ key: requestKey, view: null, error: '当前分支未配置上游，无法对比。', loading: false })
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
  const sections = buildSections(files, entries, '变更文件')
  const showSectionHeaders = !(sections.length === 1 && !entries?.length)
  const query = fileQuery.trim().toLowerCase()
  const operation: string | undefined = status?.operation ?? undefined
  const operationSteps = operation ? OPERATION_STEPS[operation] ?? [] : []
  const conflictCount = summary.conflicts
  const stagedCount = summary.staged
  const amendable = amend && !commitMessage.trim()
  const commitIssue = commitAll
    ? (conflictCount > 0 ? '还有未解决的冲突，先解决冲突再提交。' : (commitMessage.trim() ? null : '请填写提交信息。'))
    : amendable ? (conflictCount > 0 ? '还有未解决的冲突，先解决冲突再提交。' : null) : commitProblem(commitMessage, summary)

  /** One place for the busy flag, the outcome notice and the refresh that follows every write. */
  const run = async (label: string, action: () => Promise<{ ok?: boolean; error?: string } | void>) => {
    if (busy) return
    setBusy(label)
    setActionNotice(null)
    try {
      const outcome = await action()
      if (outcome && outcome.ok === false) setActionNotice({ ok: false, text: outcome.error || `${label}失败` })
      else setActionNotice({ ok: true, text: `${label}完成` })
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
      if (!clipboard?.writeText) throw new Error('当前环境不支持剪贴板')
      await clipboard.writeText(text)
      setActionNotice({ ok: true, text: `${label}已复制` })
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
    summary: `${summary.staged} 个已暂存 / ${summary.unstaged} 个未暂存 / ${summary.untracked} 个未跟踪，+${summary.insertions} -${summary.deletions}`,
    staged: (entries ?? []).filter(entry => entry.section === 'staged').map(entry => entry.path),
    unstaged: (entries ?? []).filter(entry => entry.section === 'unstaged').map(entry => entry.path),
    untracked: (entries ?? []).filter(entry => entry.section === 'untracked').map(entry => entry.path),
    conflicts: (entries ?? []).filter(entry => entry.section === 'conflict').map(entry => entry.path),
    patch: files.map(file => file.rawPatch ?? '').join(''),
  })

  /** Draft only: the reader reviews/edits the side conversation before choosing Send. */
  const askAgent = async (label: string, text: string) => {
    if (!text.trim()) return
    setActionNotice({ ok: true, text: '正在打开侧边对话并填入提示词…' })
    try {
      const result = await deliverPrompt({ ...props, cwd }, props.sessionId, text)
      if (!result.ok) { setActionNotice({ ok: false, text: result.error || `${label}失败` }); return }
      setActionNotice({ ok: true, text: result.mode === 'new-conversation'
        ? `已新建对话并填入「${label}」提示词，确认后再发送`
        : `已在侧边对话填入「${label}」提示词，确认后再发送` })
    } catch (error) {
      setActionNotice({ ok: false, text: errorMessage(error) || `${label}失败` })
    }
  }

  const draftCommitPrompt = async (event?: { detail?: number }) => {
    if ((event?.detail ?? 0) > 1) return
    try {
      // A commit message must describe the index, even when the review pane is showing all changes.
      const staged = compareScope === 'staged' ? diffView : await gitApi.getDiff(cwd, 'HEAD', 'working', undefined, { mode: 'staged' })
      await askAgent('提交信息', buildCommitPrompt({ ...promptContext(), patch: staged?.files.map(file => file.rawPatch ?? '').join('') || '' }))
    } catch (error) { setActionNotice({ ok: false, text: errorMessage(error) }) }
  }

  const applyHunks = (file: DiffFile, indexes: number[], direction: 'stage' | 'unstage') => {
    const patch = buildHunkPatch(file.rawPatch ?? '', indexes)
    if (!patch) {
      setActionNotice({ ok: false, text: '这一段改动没有可用的补丁，请改用整文件操作。' })
      return
    }
    return run(direction === 'stage' ? '暂存所选行' : '取消暂存所选行', () =>
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

  const submitCommit = () => run(status?.operation ? '提交' : amend ? '修正提交' : '提交', async () => {
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
    <div className="dsh-git-state-icon"><IconDiff size={24} /></div><strong>暂时无法加载仓库</strong>
    <p className="dsh-git-state-error" role="alert">{statusError}</p>
    <button type="button" className="dsh-git-btn dsh-git-btn-secondary" onClick={reloadStatus}><IconRefresh size={14} />重新加载</button>
  </div></div>
  // Non-Git repository empty state
  if (!statusLoading && !isGit) {
    return (
      <div className="dsh-git-changes-panel"><div className="dsh-git-empty-state">
        {statusError && <div className="dsh-git-state-error" role="alert">{statusError}</div>}
        <div className="dsh-git-state-icon"><IconDiff size={24} /></div>
        <strong>当前目录不是 Git 仓库</strong>
        <p>在项目中执行 <code>git init</code> 后，即可查看分支和文件差异。</p>
        <button
          type="button"
          className="dsh-git-btn dsh-git-btn-primary"
          onClick={() => {
            reloadStatus()
          }}
        >
          重新加载
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
              <small>{row.path.includes('/') ? row.path.slice(0, row.path.lastIndexOf('/')) : '仓库根目录'}</small>
            </span>
          </span>
          <span className="dsh-git-file-stats">
            {row.file?.binary
              ? <span className="dsh-git-binary-mark">二进制</span>
              : row.insertions || row.deletions ? <><span className="dsh-git-ins">+{row.insertions}</span><span className="dsh-git-del">-{row.deletions}</span></> : null}
          </span>
        </button>
        <div className="dsh-git-file-actions">
          {row.section === 'unstaged' && <button type="button" className="dsh-git-icon-btn" title="暂存这个文件" disabled={!!busy}
            onClick={event => { event?.stopPropagation?.(); run('暂存文件', () => gitApi.stage(cwd, [row.path])) }}><IconPlus size={12} /></button>}
          {row.section === 'staged' && <button type="button" className="dsh-git-icon-btn" title="取消暂存这个文件" disabled={!!busy}
            onClick={event => { event?.stopPropagation?.(); run('取消暂存', () => gitApi.unstage(cwd, [row.path])) }}><IconMinus size={12} /></button>}
          {canDiscard && <button type="button" className="dsh-git-icon-btn" title="撤销这个文件的改动" disabled={!!busy}
            onClick={event => { event?.stopPropagation?.(); run('撤销更改', () => gitApi.discard(cwd, [row.path])) }}><IconUndo size={12} /></button>}
          {row.section === 'staged' && <button type="button" className="dsh-git-icon-btn" title="撤销暂存并丢弃这份改动" disabled={!!busy}
            onClick={event => { event?.stopPropagation?.(); run('撤销已暂存的更改', () => gitApi.discard(cwd, [row.path], true)) }}><IconTrash size={12} /></button>}
          {isUntracked && <button type="button" className="dsh-git-icon-btn" title="删除这个未跟踪文件" disabled={!!busy}
            onClick={event => { event?.stopPropagation?.(); run('删除未跟踪文件', () => gitApi.deleteUntracked(cwd, [row.path])) }}><IconTrash size={12} /></button>}
          {isUntracked && <button type="button" className="dsh-git-icon-btn" title="加入 .gitignore" disabled={!!busy}
            onClick={event => { event?.stopPropagation?.(); run('加入 .gitignore', () => gitApi.addToGitignore(cwd, [row.path])) }}><IconClose size={12} /></button>}
          {row.section === 'conflict' && <>
            <button type="button" className="dsh-git-icon-btn dsh-git-icon-btn-wide" title="保留当前分支的版本（--ours）" disabled={!!busy}
              onClick={event => { event?.stopPropagation?.(); run('采用当前版本', () => gitApi.resolveConflict(cwd, row.path, 'ours')) }}>当前</button>
            <button type="button" className="dsh-git-icon-btn dsh-git-icon-btn-wide" title="保留传入的版本（--theirs）" disabled={!!busy}
              onClick={event => { event?.stopPropagation?.(); run('采用传入版本', () => gitApi.resolveConflict(cwd, row.path, 'theirs')) }}>传入</button>
            <button type="button" className="dsh-git-icon-btn" title="查看冲突内容" onClick={event => { event?.stopPropagation?.(); showConflict(row.path) }}><IconWarning size={12} /></button>
          </>}
          <button type="button" className="dsh-git-icon-btn" title="在文件管理器中显示" disabled={!!busy}
            onClick={event => { event?.stopPropagation?.(); run('在文件管理器中显示', () => gitApi.reveal(cwd, row.path)) }}><IconFolderTree size={12} /></button>
          <button type="button" className="dsh-git-icon-btn" title="复制路径"
            onClick={event => { event?.stopPropagation?.(); copyText('路径', row.path) }}><IconCopy size={12} /></button>
        </div>
        {conflictOpen === row.path && (
          <div className="dsh-git-conflict-view">
            {conflictError ? <div className="dsh-git-conflict-line dsh-git-error" role="alert">{conflictError}</div>
              : !conflictFile ? <div className="dsh-git-conflict-line">正在读取冲突内容…</div>
                : conflictFile.binary ? <div className="dsh-git-conflict-line">二进制文件无法显示冲突两侧的内容，请用「当前 / 传入」选择一侧。</div>
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
          {!!status?.ahead && <span className="dsh-git-ahead-behind" title={`领先上游 ${status.ahead} 个提交`}><IconArrowUp size={12} />{status.ahead}</span>}
          {!!status?.behind && <span className="dsh-git-ahead-behind" title={`落后上游 ${status.behind} 个提交`}><IconArrowDown size={12} />{status.behind}</span>}
          {!!status?.stashCount && <span className="dsh-git-stash-badge" title={`有 ${status.stashCount} 条储藏`}><IconStash size={12} />{status.stashCount}</span>}
          <div className="dsh-git-change-summary">
            {diffView && <span className="dsh-git-file-count">{diffView.files.length ? `${diffView.files.length} 个文件` : '无变更'}</span>}
            {!!diffView?.files.length && <div className="dsh-git-stat-badge" aria-label={`新增 ${diffView.totalInsertions} 行，删除 ${diffView.totalDeletions} 行`}>
              <span className="dsh-git-ins">+{diffView.totalInsertions}</span><span className="dsh-git-del">−{diffView.totalDeletions}</span>
            </div>}
          </div>
          <button type="button" className="dsh-git-refresh-btn" aria-label="刷新变更" title="刷新变更" disabled={loadingDiff || statusLoading} onClick={() => { reloadStatus(); setRefresh(value => value + 1) }}>
            <IconRefresh size={15} className={loadingDiff || statusLoading ? 'dsh-git-spin' : ''} />
          </button>
        </div>
        <div className="dsh-git-compare-control" onKeyDown={event => {
          if (event.key === 'Escape') {
            event.stopPropagation(); setCompareDropdownOpen(false)
            event.currentTarget.querySelector<HTMLButtonElement>('.dsh-git-compare-trigger')?.focus()
          }
        }}>
          <button type="button" className={`dsh-git-compare-trigger ${compareDropdownOpen ? 'dsh-git-compare-trigger-open' : ''}`} onClick={() => setCompareDropdownOpen(!compareDropdownOpen)} title="切换对比基准" aria-expanded={compareDropdownOpen}>
            <IconDiff size={15} />
            <span className="dsh-git-compare-label">{compareTarget === 'working-head' ? '工作区' : (status?.branch || 'HEAD')}</span>
            <span className="dsh-git-compare-arrow" aria-hidden="true">→</span>
            <span className="dsh-git-compare-base">{compareTarget === 'working-head' ? 'HEAD' : (upstream || '未配置上游')}</span>
            <IconChevronDown size={13} />
          </button>
          {compareDropdownOpen && <>
            <div className="dsh-git-compare-backdrop" onClick={() => setCompareDropdownOpen(false)} />
            <div className="dsh-git-compare-menu" role="group" aria-label="对比基准">
              <div className="dsh-git-compare-menu-heading">对比基准</div>
              <button type="button" className="dsh-git-compare-option" aria-pressed={compareTarget === 'working-head'} onClick={event => {
                setCompareTarget('working-head'); setCompareDropdownOpen(false)
                event.currentTarget.closest('.dsh-git-compare-control')?.querySelector<HTMLButtonElement>('.dsh-git-compare-trigger')?.focus()
              }}>
                <span className="dsh-git-option-icon"><IconDiff size={17} /></span>
                <span className="dsh-git-option-copy"><strong>未提交的更改</strong><span>工作区与 HEAD 对比</span></span>
                {compareTarget === 'working-head' && <IconCheck size={16} />}
              </button>
              <button type="button" className="dsh-git-compare-option" disabled={!upstream} aria-pressed={compareTarget === 'branch-upstream'} onClick={event => {
                setCompareTarget('branch-upstream'); setCompareDropdownOpen(false)
                event.currentTarget.closest('.dsh-git-compare-control')?.querySelector<HTMLButtonElement>('.dsh-git-compare-trigger')?.focus()
              }}>
                <span className="dsh-git-option-icon"><IconBranch size={17} /></span>
                <span className="dsh-git-option-copy"><strong>与上游分支对比{!upstream && <small>未配置</small>}</strong><span>{upstream ? `${status?.branch || 'HEAD'} → ${upstream}` : '配置上游分支后可用'}</span></span>
                {compareTarget === 'branch-upstream' && <IconCheck size={16} />}
              </button>
            </div>
          </>}
        </div>
      </div>}

      {operation && <div className="dsh-git-operation-banner" role="status">
        <span className="dsh-git-operation-icon"><IconWarning size={16} /></span>
        <div className="dsh-git-operation-copy">
          <strong>{OPERATION_LABELS[operation] ?? `Git 操作进行中（${operation}）`}</strong>
          <span>{conflictCount > 0 ? `有 ${conflictCount} 个文件存在冲突，解决后即可继续。` : '没有待解决的冲突，可以继续这次操作。'}</span>
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
        <div className="dsh-git-state-icon"><IconDiff size={24} /></div><strong>无法读取差异</strong>
        <p className="dsh-git-state-error" role="alert">{diffError}</p>
        <button type="button" className="dsh-git-btn dsh-git-btn-secondary" onClick={() => { reloadStatus(); setRefresh(value => value + 1) }}><IconRefresh size={14} />重试</button>
      </div> : diffView && diffView.files.length === 0 ? <div className="dsh-git-empty-state">
        <div className="dsh-git-state-icon dsh-git-state-clean"><IconCheck size={26} /></div>
        <strong>{compareScope === 'staged' ? '暂存区是空的'
          : compareScope === 'unstaged' ? '没有未暂存的更改'
            : compareTarget === 'working-head' ? '工作区很干净' : '与上游分支一致'}</strong>
        <p>{compareScope !== 'all'
          ? '切换上方的范围可以查看另一侧的差异。'
          : compareTarget === 'working-head' ? '暂无未提交的更改，新的变更会显示在这里。' : '当前分支与上游之间没有文件差异。'}</p>
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
              <span>变更文件</span>
              <span className="dsh-git-file-list-count">
                {summary.unstaged > 0 && <button type="button" className="dsh-git-link-btn" disabled={!!busy}
                  onClick={() => run('暂存全部', () => gitApi.stageAll(cwd))}>全部暂存</button>}
                {summary.staged > 0 && <button type="button" className="dsh-git-link-btn" disabled={!!busy}
                  onClick={() => run('取消全部暂存', () => gitApi.unstageAll(cwd))}>全部取消</button>}
                <span>{diffView?.files.length || 0}</span>
              </span>
            </div>
            {files.length > 6 && <div className="dsh-git-file-filter">
              <IconFile size={13} />
              <input className="dsh-git-file-filter-input" value={fileQuery} placeholder="筛选文件" onChange={event => setFileQuery(event.currentTarget.value)} />
              {fileQuery && <button type="button" className="dsh-git-icon-btn" title="清除筛选" onClick={() => setFileQuery('')}><IconClose size={12} /></button>}
            </div>}
            {focusPath && <div className="dsh-git-dirty-warning">
              <IconFile size={13} />
              <span>只加载了 <span className="dsh-git-mono">{focusPath}</span> 的补丁</span>
              <button type="button" className="dsh-git-link-btn" onClick={() => setFocusedFile(null)}>显示全部文件</button>
            </div>}
            {!diffView || diffView.files.length === 0 ? (
              <div className="dsh-git-file-list-empty">当前无可对比的更改</div>
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
                  {activeFile.status === 'untracked' && <button type="button" className="dsh-git-btn dsh-git-btn-secondary" title="把这个文件加入暂存区"
                    disabled={!!busy} onClick={() => run('暂存文件', () => gitApi.stage(cwd, [activeFile.path]))}><IconPlus size={13} /><span>暂存</span></button>}
                  {activeFile.status === 'deleted' && <button type="button" className="dsh-git-btn dsh-git-btn-secondary" title="恢复这个被删除的文件"
                    disabled={!!busy} onClick={() => run('恢复文件', () => gitApi.discard(cwd, [activeFile.path]))}><IconUndo size={13} /><span>恢复</span></button>}
                  {canPreviewImage(activeFile) && <span className="dsh-git-image-hint"><IconImage size={13} />图片</span>}
                  <details className="dsh-git-file-menu">
                    <summary className="dsh-git-btn dsh-git-btn-secondary">更多操作<IconChevronDown size={12} /></summary>
                    <div className="dsh-git-file-menu-items">
                  <button type="button" className="dsh-git-btn dsh-git-btn-secondary" title="查看这个文件的历史与逐行责任"
                    onClick={() => setInspectFile(activeFile.path)}><IconHistory size={13} /><span>历史</span></button>
                  {/* Focusing narrows the request to this one path, so a huge tree does not
                      have to travel to render a single file. */}
                  {focusPath === activeFile.path
                    ? <button type="button" className="dsh-git-btn dsh-git-btn-secondary dsh-git-tool-btn-active" title="重新载入全部文件的补丁"
                      onClick={() => setFocusedFile(null)}><IconRefresh size={13} /><span>全部文件</span></button>
                    : <button type="button" className="dsh-git-btn dsh-git-btn-secondary" title="只向 Git 请求这个文件的补丁"
                      onClick={() => setFocusedFile({ cwd, path: activeFile.path })}><IconFile size={13} /><span>只加载此文件</span></button>}
                  <button type="button" className="dsh-git-btn dsh-git-btn-secondary dsh-git-ai-btn" title="打开侧边对话，填入解释当前文件改动的提示词（不自动发送）"
                    onClick={event => (event?.detail ?? 0) > 1 ? undefined : askAgent('解释这个文件', buildExplainPrompt({ path: activeFile.path, patch: activeFile.rawPatch ?? '', statusLabel: statusTone(activeFile.status) === 'added' ? '新增' : statusTone(activeFile.status) === 'deleted' ? '删除' : '修改' }))}>
                    <IconSparkle size={13} /><span>解释改动</span>
                  </button>
                  <button type="button" className="dsh-git-btn dsh-git-btn-secondary" title="复制这个文件的路径"
                    onClick={() => copyText('路径', activeFile.path)}><IconCopy size={13} /><span>复制路径</span></button>
                  <button type="button" className="dsh-git-btn dsh-git-btn-secondary" title="在文件管理器中显示"
                    disabled={!!busy} onClick={() => run('在文件管理器中显示', () => gitApi.reveal(cwd, activeFile.path))}><IconFolderTree size={13} /><span>在文件管理器中显示</span></button>
                  <button type="button" className="dsh-git-btn dsh-git-btn-secondary" title="复制这个文件的补丁"
                    onClick={() => copyText('补丁', activeFile.rawPatch ?? '')}><IconDiff size={13} /><span>复制补丁</span></button>
                    </div>
                  </details>
                  {activeFile.status !== 'deleted' && <OpenInEditorMenu repo={cwd} file={activeFile.path} onNotice={setEditorNotice} />}
                </div>
              </div>

              <div className="dsh-git-diff-toolbar">
                <div className="dsh-git-scope-group" role="group" aria-label="对比范围">
                  {SCOPES.map(scope => (
                    <button key={scope.key} type="button" title={scope.hint} aria-pressed={compareScope === scope.key}
                      className={`dsh-git-scope-option ${compareScope === scope.key ? 'dsh-git-scope-option-active' : ''}`}
                      disabled={compareTarget === 'branch-upstream' && scope.key !== 'all' && scope.key !== 'unstaged'}
                      onClick={() => setCompareScope(scope.key)}>{scope.label}</button>
                  ))}
                </div>
                <div className="dsh-git-tool-group">
                  <button type="button" className="dsh-git-tool-btn" title="显示更少或更多上下文行"
                    onClick={() => setContextLines(CONTEXT_CHOICES[(CONTEXT_CHOICES.indexOf(contextLines) + 1) % CONTEXT_CHOICES.length])}>
                    <IconColumns size={13} />上下文 {contextLines}
                  </button>
                  <button type="button" className={`dsh-git-tool-btn ${wordLevel ? 'dsh-git-tool-btn-active' : ''}`} aria-pressed={wordLevel}
                    title="高亮行内改动的词" onClick={() => setWordLevel(value => !value)}><span className="dsh-git-tool-glyph" aria-hidden="true">a</span>词级</button>
                  <button type="button" className={`dsh-git-tool-btn ${ignoreWhitespace ? 'dsh-git-tool-btn-active' : ''}`} aria-pressed={ignoreWhitespace}
                    title="忽略空白差异（git diff -w）" onClick={() => setIgnoreWhitespace(value => !value)}>忽略空白</button>
                  <button type="button" className={`dsh-git-tool-btn ${splitView ? 'dsh-git-tool-btn-active' : ''}`} aria-pressed={splitView}
                    title="并排显示改动前后的两栏" onClick={() => setSplitView(value => !value)}><IconColumns size={13} />并排</button>
                </div>
                <div className="dsh-git-tool-group">
                  <button type="button" className="dsh-git-tool-btn" title="上一处改动" disabled={!activeFile.hunks.length}
                    onClick={() => jumpHunk(-1)}><IconChevronUp size={13} /></button>
                  <span className="dsh-git-hunk-position">{activeFile.hunks.length ? `${Math.min(activeHunk + 1, activeFile.hunks.length)}/${activeFile.hunks.length}` : '—'}</span>
                  <button type="button" className="dsh-git-tool-btn" title="下一处改动" disabled={!activeFile.hunks.length}
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
                    {activeFile.status === 'deleted' ? '文件已被删除'
                      : activeFile.binary ? '二进制文件没有可显示的差异行。'
                        : '文件未包含差异行，或这个范围内没有改动。'}
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
                            {canStageHunk && <button type="button" className="dsh-git-hunk-action" title="只暂存这一段改动" disabled={!!busy}
                              onClick={() => applyHunks(activeFile, [hunkIndex], 'stage')}><IconPlus size={11} />暂存这些行</button>}
                            {canUnstageHunk && <button type="button" className="dsh-git-hunk-action" title="只取消暂存这一段改动" disabled={!!busy}
                              onClick={() => applyHunks(activeFile, [hunkIndex], 'unstage')}><IconMinus size={11} />取消暂存这些行</button>}
                            <button type="button" className="dsh-git-hunk-action" title="复制这一段补丁"
                              onClick={() => copyText('补丁', buildHunkPatch(activeFile.rawPatch ?? '', [hunkIndex]) || activeFile.rawPatch || '')}><IconCopy size={11} /></button>
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
            <div className="dsh-git-diff-placeholder">选择左侧文件以查看代码差异</div>
          )}
        </div>
        </>}
      </div>}

      {diffView && diffView.files.length > 0 && <section className="dsh-git-commit-box" aria-label="提交更改">
        <div className="dsh-git-commit-editor">
        <div className="dsh-git-commit-head">
          <span className="dsh-git-commit-title"><IconCommit size={14} />提交</span>
          <span className="dsh-git-commit-count">{stagedCount ? `${stagedCount} 个文件已暂存` : '暂存区为空'}</span>
        </div>
        <textarea
          className="dsh-git-commit-input"
          rows={3}
          placeholder={amend ? '留空则沿用上一条提交信息' : '提交信息：第一行是标题，空行之后是正文'}
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
          <label className="dsh-git-checkbox" title="改写最后一次提交，而不是新建一个">
            <input type="checkbox" checked={amend} disabled={!!busy} onChange={() => setAmend(value => !value)} />修正上次提交
          </label>
          <label className="dsh-git-checkbox" title="给提交信息加上 Signed-off-by 尾注">
            <input type="checkbox" checked={signoff} disabled={!!busy} onChange={() => setSignoff(value => !value)} />签名
          </label>
          <label className="dsh-git-checkbox" title="连同未暂存的改动一起提交（-a）">
            <input type="checkbox" checked={commitAll} disabled={!!busy} onChange={() => setCommitAll(value => !value)} />全部改动
          </label>
        </div>
        {commitIssue && <div className="dsh-git-commit-hint">{commitIssue}</div>}
        <div className="dsh-git-commit-actions">
          <button type="button" className="dsh-git-btn dsh-git-btn-primary" disabled={!!busy || !!commitIssue} onClick={submitCommit}>
            <IconCheck size={13} />{amend ? '修正提交' : '提交'}
          </button>
          <button type="button" className="dsh-git-btn dsh-git-btn-secondary" disabled={!!busy} title="撤销上一次提交，改动退回暂存区"
            onClick={() => run('撤销上一次提交', () => gitApi.undoCommit(cwd))}><IconUndo size={13} />撤销提交</button>
          <button type="button" className="dsh-git-btn dsh-git-btn-secondary dsh-git-ai-btn" disabled={!!busy}
            title="打开侧边对话，填入根据暂存区编写提交信息的提示词（不自动发送）"
            onClick={draftCommitPrompt}>
            <IconSparkle size={13} />AI 写信息
          </button>
        </div>
        {/* These actions share the commit form's repository context. */}
        <div className="dsh-git-ai-row">
          <button type="button" className="dsh-git-ai-btn" disabled={!!busy}
            title="打开侧边对话，填入当前 Git 上下文（不自动发送）"
            onClick={event => (event?.detail ?? 0) > 1 ? undefined : askAgent('Git 上下文', buildContextText(promptContext()))}>
            <IconSparkle size={12} />注入 Git 上下文
          </button>
          <button type="button" className="dsh-git-ai-btn" disabled={!!busy}
            title="打开侧边对话，填入审查当前改动的提示词（不自动发送）"
            onClick={event => (event?.detail ?? 0) > 1 ? undefined : askAgent('审查改动', buildReviewPrompt(promptContext()))}>
            <IconSparkle size={12} />AI 审查改动
          </button>
        </div>
        </div>
      </section>}
    </div>
  )
}
