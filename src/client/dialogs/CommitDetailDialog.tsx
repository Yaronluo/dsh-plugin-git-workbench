import React, { useEffect, useState } from 'react'
import type { CommitDetail, CommitFile, DiffFile, DiffView } from '../../core/types.js'
import { gitApi } from '../api.js'

export interface CommitDetailDialogProps {
  path: string
  /** Commit hash; `ref` is reserved by React and never arrives as a function-component prop. */
  commitRef: string
  onClose: () => void
  showBackButton?: boolean
}

type CommitAction = 'tag' | 'branch' | 'revert' | 'cherry-pick'

function errorText(error: unknown, fallback: string): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return fallback
}

function statusLetter(status: CommitFile['status']): string {
  if (status === 'added') return 'A'
  if (status === 'deleted') return 'D'
  if (status === 'renamed') return 'R'
  if (status === 'copied') return 'C'
  if (status === 'typechange') return 'T'
  if (status === 'modified') return 'M'
  return '?'
}

export function CommitDetailDialog({ path, commitRef, onClose, showBackButton = true }: CommitDetailDialogProps) {
  const selectedRef = commitRef
  const [detail, setDetail] = useState<CommitDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<CommitFile | null>(null)
  const [diffView, setDiffView] = useState<DiffView | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffError, setDiffError] = useState<string | null>(null)
  const [action, setAction] = useState<CommitAction | null>(null)
  const [actionName, setActionName] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const detailRequestKey = JSON.stringify([path, selectedRef])
  const [detailLoadedFor, setDetailLoadedFor] = useState<string | null>(null)
  const diffRequestKey = JSON.stringify([path, selectedRef, selectedFile?.path ?? null])
  const [diffLoadedFor, setDiffLoadedFor] = useState<string | null>(null)
  // Effects run after render. Mask the previous commit/file immediately while the new
  // request is being scheduled, rather than briefly pairing its metadata with old data.
  const currentDetail = detailLoadedFor === detailRequestKey ? detail : null
  const currentError = detailLoadedFor === detailRequestKey ? error : null
  const currentLoading = detailLoadedFor !== detailRequestKey || loading
  const currentDiffView = diffLoadedFor === diffRequestKey ? diffView : null
  const currentDiffError = diffLoadedFor === diffRequestKey ? diffError : null
  const currentDiffLoading = !!selectedFile && (diffLoadedFor !== diffRequestKey || diffLoading)

  useEffect(() => {
    if (!selectedRef) {
      setError('Invalid commit reference')
      setLoading(false)
      setDetailLoadedFor(detailRequestKey)
      return
    }
    const controller = new AbortController()
    setDetail(null)
    setSelectedFile(null)
    setLoading(true)
    setError(null)
    setDetailLoadedFor(null)
    gitApi.getCommitDetail(path, selectedRef, controller.signal).then(result => {
      if (!controller.signal.aborted) {
        setDetail(result)
        setDetailLoadedFor(detailRequestKey)
      }
    }).catch(reason => {
      if (!controller.signal.aborted) {
        setError(errorText(reason, 'Failed to read commit details'))
        setDetailLoadedFor(detailRequestKey)
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [path, selectedRef])

  useEffect(() => {
    if (!selectedFile) {
      setDiffView(null)
      setDiffError(null)
      setDiffLoading(false)
      setDiffLoadedFor(diffRequestKey)
      return
    }
    const controller = new AbortController()
    setDiffView(null)
    setDiffError(null)
    setDiffLoading(true)
    setDiffLoadedFor(null)
    gitApi.requestDiff(path, { mode: 'single', base: selectedRef, files: [selectedFile.path] }, controller.signal).then(result => {
      if (!controller.signal.aborted) {
        setDiffView(result)
        setDiffLoadedFor(diffRequestKey)
      }
    }).catch(reason => {
      if (!controller.signal.aborted) {
        setDiffError(errorText(reason, 'Failed to read file diff'))
        setDiffLoadedFor(diffRequestKey)
      }
    }).finally(() => { if (!controller.signal.aborted) setDiffLoading(false) })
    return () => controller.abort()
  }, [path, selectedRef, selectedFile])

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(selectedRef)
      setNotice('Copied commit hash')
      setError(null)
    } catch (reason) {
      setError(errorText(reason, 'Failed to copy hash'))
    }
  }

  const beginAction = (next: CommitAction) => {
    setAction(next)
    setActionName('')
    setError(null)
    setNotice(null)
  }

  const runAction = async () => {
    if (!action || actionBusy) return
    const name = actionName.trim()
    if ((action === 'tag' || action === 'branch') && !name) {
      setError(action === 'tag' ? 'Please enter a tag name' : 'Please enter a branch name')
      return
    }
    setActionBusy(true)
    setError(null)
    setNotice(null)
    try {
      let result
      let successNotice = ''
      if (action === 'tag') {
        result = await gitApi.tagCreate(path, name, { ref: selectedRef })
        successNotice = `Created tag at this commit: ${name}`
      } else if (action === 'branch') {
        result = await gitApi.createBranch(path, name, selectedRef)
        successNotice = `Created branch from this commit: ${name}`
      } else if (action === 'revert') {
        result = await gitApi.revert(path, selectedRef)
        successNotice = 'Reverted this commit'
      } else {
        result = await gitApi.cherryPick(path, selectedRef)
        successNotice = 'Cherry-picked this commit onto the current branch'
      }
      if (!result.ok) {
        setError(errorText(result.error, 'Operation failed'))
        return
      }
      setNotice(successNotice)
      setAction(null)
      setActionName('')
    } catch (reason) {
      setError(errorText(reason, 'Operation failed'))
    } finally {
      setActionBusy(false)
    }
  }

  const activeDiff: DiffFile | undefined = currentDiffView?.files[0]
  const actionLabel = action === 'tag' ? 'Tag' : action === 'branch' ? 'Create branch here' : action === 'revert' ? 'Revert this commit' : 'Cherry-pick onto current branch'

  return <div className='dsh-git-section'>
    {showBackButton && <div className='dsh-git-panel-toolbar'>
      <button type='button' className='dsh-git-btn dsh-git-btn-secondary' onClick={onClose}>Back</button>
      <span className='dsh-git-muted'>Commit details</span>
    </div>}
    {currentLoading ? <div className='dsh-git-muted'>Reading commit details…</div>
      : currentError && !currentDetail ? <p className='dsh-git-error' role='alert'>{currentError}</p>
      : currentDetail && <>
        <pre className='dsh-git-detail-message'>{currentDetail.subject}{currentDetail.body ? `\n\n${currentDetail.body}` : ''}</pre>
        <div className='dsh-git-detail-meta'>
          <span>Commit</span><span>{currentDetail.subject}</span>
          <span>Author</span><span>{currentDetail.author}</span>
          <span>Email</span><span>{currentDetail.authorEmail}</span>
          <span>Committer</span><span>{currentDetail.committer}</span>
          <span>Date</span><span>{currentDetail.commitDate || currentDetail.date}</span>
          <span>hash</span><code>{currentDetail.hash}</code>
          <span>Parent commit</span><span>{currentDetail.parents.join(', ') || 'None'}</span>
        </div>

        <section className='dsh-git-section'>
          <div className='dsh-git-section-head'>
            <span>Changed files ({currentDetail.files.length})</span>
            <span className='dsh-git-spacer' />
            <span><span className='dsh-git-ins'>+{currentDetail.totalInsertions}</span> <span className='dsh-git-del'>-{currentDetail.totalDeletions}</span></span>
          </div>
          <div className='dsh-git-scroll-list'>
            {currentDetail.files.length === 0 ? <div className='dsh-git-muted'>This commit has no file changes</div>
              : currentDetail.files.map(file => <button type='button' key={`${file.path}-${file.status}`}
                className='dsh-git-detail-file' aria-pressed={selectedFile?.path === file.path}
                onClick={() => setSelectedFile(file)}>
                <span className='dsh-git-badge'>{statusLetter(file.status)}</span>
                <code>{file.path}</code>
                <span className='dsh-git-ins'>+{file.insertions}</span>
                <span className='dsh-git-del'>-{file.deletions}</span>
              </button>)}
          </div>
        </section>

        {selectedFile && <section className='dsh-git-section'>
          <div className='dsh-git-section-head'><code>{selectedFile.path}</code></div>
          {currentDiffError && <p className='dsh-git-error' role='alert'>{currentDiffError}</p>}
          {currentDiffLoading ? <div className='dsh-git-muted'>Reading file diff…</div>
            : activeDiff?.binary ? <div className='dsh-git-binary-note'>The file is binary; the diff was not expanded</div>
            : activeDiff && activeDiff.hunks.length === 0 ? <pre className='dsh-git-code-box'>{activeDiff.rawPatch}</pre>
            : activeDiff && <div className='dsh-git-diff-lines'>
              {activeDiff.hunks.map((hunk, hunkIndex) => <div key={`${hunk.oldStart}-${hunk.newStart}-${hunkIndex}`}>
                <div className='dsh-git-hunk-header'>+{hunk.newStart} {hunk.oldStart} {hunk.header}</div>
                {hunk.lines.map((line, lineIndex) => <div key={`${line.oldNum}-${line.newNum}-${lineIndex}`}
                  className={`dsh-git-diff-row${line.type === 'add' ? ' dsh-git-row-add' : line.type === 'del' ? ' dsh-git-row-del' : ''}`}>
                  <span className='dsh-git-line-num'>{line.oldNum ?? ''}</span>
                  <span className='dsh-git-line-num'>{line.newNum ?? ''}</span>
                  <span className='dsh-git-line-content'>{line.type === 'add' ? '+ ' : line.type === 'del' ? '- ' : '  '}{line.content}</span>
                </div>)}
              </div>)}
            </div>}
        </section>}

        <section className='dsh-git-section'>
          <div className='dsh-git-section-head'>Commit actions</div>
          <div className='dsh-git-inline-form'>
            <button type='button' className='dsh-git-btn dsh-git-btn-secondary' onClick={copyHash}>Copy hash</button>
            <button type='button' className='dsh-git-btn dsh-git-btn-secondary' onClick={() => beginAction('tag')}>Tag</button>
            <button type='button' className='dsh-git-btn dsh-git-btn-secondary' onClick={() => beginAction('branch')}>Create branch here</button>
            <button type='button' className='dsh-git-btn dsh-git-btn-secondary' onClick={() => beginAction('revert')}>Revert this commit</button>
            <button type='button' className='dsh-git-btn dsh-git-btn-secondary' onClick={() => beginAction('cherry-pick')}>Cherry-pick onto current branch</button>
          </div>
          {notice && <p className='dsh-git-muted' role='status'>{notice}</p>}
          {currentError && currentDetail && <p className='dsh-git-error' role='alert'>{currentError}</p>}
          {action && <div className='dsh-git-section' role='group' aria-label={`${actionLabel}Confirm`}>
            <div className='dsh-git-section-head'>Confirm{actionLabel}</div>
            <p>{action === 'tag' ? 'Creates a new tag at this commit.' : action === 'branch' ? 'Creates a new branch from this commit and switches to it.' : action === 'revert' ? 'Creates a new commit that undoes the changes of this commit.' : 'Applies this commit to the current branch; may cause conflicts.'}</p>
            {(action === 'tag' || action === 'branch') && <input className='dsh-git-input' value={actionName}
              placeholder={action === 'tag' ? 'Tag name' : 'Branch name'} aria-label={action === 'tag' ? 'Tag name' : 'Branch name'}
              onChange={event => setActionName(event.target.value)} />}
            <div className='dsh-git-inline-form'>
              <button type='button' className='dsh-git-btn dsh-git-btn-primary' disabled={actionBusy} onClick={runAction}>Confirm{actionLabel}</button>
              <button type='button' className='dsh-git-btn dsh-git-btn-secondary' disabled={actionBusy} onClick={() => setAction(null)}>Cancel</button>
            </div>
          </div>}
        </section>
      </>}
  </div>
}
