import { posix, win32 } from 'node:path'
import type {
  BlameLine, BranchItem, CommitFile, DiffFile, DiffHunk, DiffView, FileHistoryEntry, GitGraphCommit, GitOperationKind,
  ReflogEntry, RepoStatus, StashEntry, StatusEntry, TagItem, WorktreeItem,
} from './types.js'

/** One `# branch.ab +N -M` line carries the divergence the status capsule shows. */
function applyAheadBehind(status: RepoStatus, value: string): void {
  const match = value.match(/^\+(\d+)\s+-(\d+)$/)
  if (!match) return
  status.ahead = Number(match[1])
  status.behind = Number(match[2])
}

export function parseStatusV2(stdout: string, root: string): RepoStatus {
  const status: RepoStatus = { isGit: true, root, branch: 'HEAD', head: '', dirtyFiles: 0, untrackedFiles: 0, conflicts: 0, operationInProgress: false, stashCount: 0, detached: false, operation: null, entries: [] }
  const nul = stdout.includes('\0')
  const records = stdout.split(nul ? '\0' : '\n')
  for (let i = 0; i < records.length; i++) {
    const line = records[i]
    if (line.startsWith('# branch.head ')) {
      const name = line.slice(14)
      status.detached = name === '(detached)'
      status.branch = status.detached ? 'HEAD' : name
    }
    else if (line.startsWith('# branch.oid ')) status.head = line.slice(13) === '(initial)' ? '' : line.slice(13, 20)
    else if (line.startsWith('# branch.upstream ')) status.upstream = line.slice(18)
    else if (line.startsWith('# branch.ab ')) applyAheadBehind(status, line.slice(12))
    else if (line.startsWith('# stash ')) status.stashCount = Number(line.slice(8)) || 0
    else if (/^[12u?] /.test(line)) {
      status.dirtyFiles++
      const entry = parseStatusEntry(line)
      if (entry) {
        if (entry.untracked) status.untrackedFiles++
        if (entry.conflict) status.conflicts++
        if (line.startsWith('2 ') && nul) { entry.origPath = records[i + 1] || undefined; i++ } // original rename path
        status.entries!.push(entry)
      }
    }
  }
  return status
}

/**
 * Porcelain v2 record fields are space-separated and the path is LAST, so a path
 * containing spaces survives the split while the fixed fields are counted by index.
 * Types: `1 XY sub mH mI mW hH hI path`, `2 ... Xscore path`, `u ... path`.
 */
export function parseStatusEntry(line: string): StatusEntry | null {
  if (line.startsWith('? ')) return { path: line.slice(2), index: '?', worktree: '?', conflict: false, untracked: true }
  if (line.startsWith('u ')) {
    const parts = line.split(' ')
    const xy = parts[1] || ''
    return { path: parts.slice(10).join(' '), index: xy[0] || 'U', worktree: xy[1] || 'U', conflict: true, untracked: false }
  }
  if (line.startsWith('1 ') || line.startsWith('2 ')) {
    const parts = line.split(' ')
    const xy = parts[1] || ''
    // A `2` record carries `<X><score>` before the path, so its path starts one field later.
    const path = parts.slice(line.startsWith('2 ') ? 9 : 8).join(' ')
    return { path, index: xy[0] || '.', worktree: xy[1] || '.', conflict: false, untracked: false }
  }
  return null
}

/**
 * Which multi-step operation is mid-flight, from the marker files Git leaves in its
 * directory. Pure: the caller supplies the marker names that exist.
 */
export function parseOperation(existing: readonly string[]): GitOperationKind | null {
  const has = (name: string) => existing.includes(name)
  // `rebase-apply` is shared with `git am`; only the `applying` file tells them apart.
  if (has('rebase-apply')) return has('applying') ? 'am' : 'rebase'
  if (has('rebase-merge')) return 'rebase'
  if (has('MERGE_HEAD')) return 'merge'
  if (has('CHERRY_PICK_HEAD')) return 'cherry-pick'
  if (has('REVERT_HEAD')) return 'revert'
  if (has('BISECT_LOG')) return 'bisect'
  if (has('sequencer')) return 'cherry-pick'
  return null
}

/** `git for-each-ref --format=%(refname)%00%(objectname)%00%(upstream:short)%00%(upstream:track)%00%(HEAD)%00%(contents:subject)` */
export function parseForEachRefBranches(stdout: string, head: string): BranchItem[] {
  const items: BranchItem[] = []
  for (const record of stdout.split('\n')) {
    if (!record.trim()) continue
    const [refname, hash, upstream, track, headMark, subject] = record.split('\0')
    if (!refname) continue
    const isRemote = refname.startsWith('refs/remotes/')
    if (isRemote && refname.endsWith('/HEAD')) continue
    const name = isRemote ? refname.slice('refs/remotes/'.length) : refname.slice('refs/heads/'.length)
    const item: BranchItem = {
      name, current: !isRemote && !!headMark?.trim(), isRemote,
      upstream: upstream || undefined, subject: subject || undefined, hash: hash || undefined,
    }
    if (upstream) {
      // `[ahead 2, behind 1]`, `[gone]`, or empty when in sync.
      const ahead = track?.match(/ahead (\d+)/)
      const behind = track?.match(/behind (\d+)/)
      item.ahead = ahead ? Number(ahead[1]) : 0
      item.behind = behind ? Number(behind[1]) : 0
      if (track?.includes('gone')) item.upstream = `${upstream} (已删除)`
    }
    items.push(item)
  }
  return items.sort((a, b) => Number(b.current) - Number(a.current) || Number(a.isRemote) - Number(b.isRemote) || a.name.localeCompare(b.name))
}

/** Legacy plain `git branch -a` parser, kept for callers that still pass that output. */
export function parseBranches(stdout: string): BranchItem[] {
  return stdout.split('\n').map(line => line.trim()).filter(line => line && !line.includes('->')).map(line => {
    const name = line.replace(/^[*+\s]+/, '').replace(/^remotes\//, '')
    const ab = line.match(/\[(?:ahead (\d+))?(?:, )?(?:behind (\d+))?\]/)
    return {
      name, current: line.startsWith('*'), isRemote: line.replace(/^[*+\s]+/, '').startsWith('remotes/'),
      ahead: ab?.[1] ? Number(ab[1]) : undefined, behind: ab?.[2] ? Number(ab[2]) : undefined,
    }
  }).sort((a, b) => Number(b.current) - Number(a.current) || Number(a.isRemote) - Number(b.isRemote) || a.name.localeCompare(b.name))
}

/** Decode Git's C-style quoted UTF-8 path, including octal byte escapes. */
export function decodeGitPath(value: string): string {
  if (!value.startsWith('"') || !value.endsWith('"')) return value
  const bytes: number[] = []
  const escapes: Record<string, number> = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '\\': 92, '"': 34 }
  const text = value.slice(1, -1)
  for (let i = 0; i < text.length;) {
    if (text[i] === '\\') {
      const octal = text.slice(i + 1).match(/^[0-7]{1,3}/)?.[0]
      if (octal) { bytes.push(parseInt(octal, 8)); i += octal.length + 1 }
      else { bytes.push(escapes[text[i + 1]] ?? text.charCodeAt(i + 1)); i += 2 }
    } else {
      const point = text.codePointAt(i)!
      bytes.push(...Buffer.from(String.fromCodePoint(point))); i += point > 0xffff ? 2 : 1
    }
  }
  return Buffer.from(bytes).toString('utf8')
}

export interface NumstatEntry {
  insertions: number
  deletions: number
  /** Git prints `-` for both counts when the file is binary. */
  binary: boolean
}

/**
 * `git diff --numstat` in both its plain and `-z` forms. With `-z` a rename is
 * `<ins>\t<del>\t\0<old>\0<new>\0`, so the empty third field means "read on".
 */
export function parseNumstat(numstatOutput: string): Map<string, NumstatEntry> {
  const stats = new Map<string, NumstatEntry>()
  const put = (insertions: string, deletions: string, path: string) => {
    if (!path) return
    const binary = insertions === '-' || deletions === '-'
    stats.set(path, { insertions: binary ? 0 : Number(insertions) || 0, deletions: binary ? 0 : Number(deletions) || 0, binary })
  }
  if (numstatOutput.includes('\0')) {
    const records = numstatOutput.split('\0')
    for (let i = 0; i < records.length; i++) {
      const match = records[i].match(/^([^\t]+)\t([^\t]+)\t(.*)$/s)
      if (!match) continue
      let path = match[3]
      if (!path) { i++; path = records[++i] ?? '' }
      put(match[1], match[2], path)
    }
  } else {
    for (const line of numstatOutput.split('\n')) {
      const match = line.match(/^([^\t]+)\t([^\t]+)\t(.*)$/)
      if (!match) continue
      // `dir/{old => new}/file` and `old => new` both collapse to the destination.
      const path = decodeGitPath(match[3]).replace(/\{[^{}]* => ([^{}]*)\}/, '$1').replace(/^.* => /, '')
      put(match[1], match[2], path)
    }
  }
  return stats
}

export function parseUnifiedDiff(diffOutput: string, numstatOutput = ''): DiffView {
  const stats = parseNumstat(numstatOutput)
  const files: DiffFile[] = []
  for (const chunk of diffOutput.split(/(?=^diff --git )/m)) {
    if (!chunk.startsWith('diff --git ')) continue
    const lines = chunk.split('\n')
    const firstHunk = lines.findIndex(line => line.startsWith('@@ '))
    const header = lines.slice(1, firstHunk < 0 ? undefined : firstHunk)
    const tokens = lines[0].slice(11).match(/^("(?:\\.|[^"\\])*"|a\/.*?) ("(?:\\.|[^"\\])*"|b\/.*)$/)
    let oldPath = tokens ? decodeGitPath(tokens[1]).replace(/^a\//, '') : ''
    let path = tokens ? decodeGitPath(tokens[2]).replace(/^b\//, '') : ''
    // Unquoted names may themselves contain " b/". Binary patches have no ---/+++ fallback.
    const names = lines[0].slice(11)
    if (names.startsWith('a/')) {
      for (let boundary = names.indexOf(' b/'); boundary >= 0; boundary = names.indexOf(' b/', boundary + 1)) {
        if (names.slice(2, boundary) === names.slice(boundary + 3)) { oldPath = path = names.slice(2, boundary); break }
      }
    }
    let status: DiffFile['status'] = 'modified'
    for (const line of header) {
      if (line.startsWith('--- ') && line.slice(4) !== '/dev/null') oldPath = decodeGitPath(line.slice(4).split('\t')[0]).replace(/^a\//, '')
      if (line.startsWith('+++ ') && line.slice(4) !== '/dev/null') path = decodeGitPath(line.slice(4).split('\t')[0]).replace(/^b\//, '')
      if (line.startsWith('new file mode ')) status = 'added'
      if (line.startsWith('deleted file mode ')) status = 'deleted'
      if (line.startsWith('rename from ')) { oldPath = decodeGitPath(line.slice(12)); status = 'renamed' }
      if (line.startsWith('rename to ')) path = decodeGitPath(line.slice(10))
    }
    const hunks: DiffHunk[] = []
    let hunk: DiffHunk | undefined
    let oldNum = 0, newNum = 0, ins = 0, del = 0
    for (const line of lines.slice(1)) {
      const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
      if (match) {
        oldNum = Number(match[1]); newNum = Number(match[3])
        hunk = { header: line, oldStart: oldNum, oldLines: Number(match[2] ?? 1), newStart: newNum, newLines: Number(match[4] ?? 1), lines: [] }
        hunks.push(hunk)
      } else if (hunk && line.startsWith('+')) { ins++; hunk.lines.push({ type: 'add', newNum: newNum++, content: line.slice(1) }) }
      else if (hunk && line.startsWith('-')) { del++; hunk.lines.push({ type: 'del', oldNum: oldNum++, content: line.slice(1) }) }
      else if (hunk && line.startsWith(' ')) hunk.lines.push({ type: 'normal', oldNum: oldNum++, newNum: newNum++, content: line.slice(1) })
    }
    const stat = stats.get(path) ?? { insertions: ins, deletions: del, binary: false }
    // A binary file reports no hunks and no numbers; saying so beats "未包含差异行".
    const binary = hunks.length === 0 && /^(Binary files |GIT binary patch)/m.test(chunk)
    files.push({ path, oldPath: oldPath || undefined, status, insertions: stat.insertions, deletions: stat.deletions, hunks, rawPatch: chunk, binary: binary || stat.binary })
  }
  return { base: 'HEAD', target: 'working-tree', totalInsertions: files.reduce((n, f) => n + f.insertions, 0), totalDeletions: files.reduce((n, f) => n + f.deletions, 0), files }
}

export function normalizeWorktreePath(value: string): string {
  if (/^[a-z]:[\\/]/i.test(value) || value.startsWith('\\\\')) return win32.normalize(value).replace(/[\\/]+$/, '').toLowerCase()
  return posix.normalize(value).replace(/\/$/, '') || '/'
}

export function parseWorktrees(stdout: string, currentPath: string): WorktreeItem[] {
  const items: WorktreeItem[] = []
  let item: WorktreeItem | undefined
  for (const line of stdout.split(stdout.includes('\0') ? '\0' : '\n')) {
    if (line.startsWith('worktree ')) {
      const path = stdout.includes('\0') ? line.slice(9) : decodeGitPath(line.slice(9))
      item = { path, head: '', branch: '(detached)', isCurrent: normalizeWorktreePath(path) === normalizeWorktreePath(currentPath), locked: false }
      items.push(item)
    } else if (item) {
      if (line.startsWith('HEAD ')) item.head = line.slice(5, 12)
      else if (line.startsWith('branch refs/heads/')) item.branch = line.slice(18)
      else if (line === 'locked' || line.startsWith('locked ')) { item.locked = true; item.lockedReason = line.slice(7) || undefined }
      else if (line === 'detached') item.detached = true
      else if (line === 'prunable' || line.startsWith('prunable ')) item.prunable = true
    }
  }
  return items
}

/** git log -z --format=%H%x00%h%x00%s%x00%an%x00%cr%x00%P%x00%D */
export function parseLog(stdout: string): GitGraphCommit[] {
  const fields = stdout.split('\0')
  const commits: GitGraphCommit[] = []
  for (let i = 0; i + 6 < fields.length; i += 7) {
    const [hash, shortHash, subject, author, date, parents, refs] = fields.slice(i, i + 7)
    if (!hash || !shortHash) continue
    commits.push({ hash, shortHash, subject, author, date, parents: parents.split(' ').filter(Boolean), refs: refs.split(',').map(s => s.trim()).filter(Boolean) })
  }
  return commits
}

/** `git reflog --format=%H%x00%h%x00%gd%x00%gs%x00%cr%x00` */
export function parseReflog(stdout: string): ReflogEntry[] {
  const fields = stdout.split('\0')
  const entries: ReflogEntry[] = []
  for (let i = 0; i + 4 < fields.length; i += 5) {
    const [hash, shortHash, selector, subject, date] = fields.slice(i, i + 5)
    if (!hash || !selector) continue
    // `commit: message`, `checkout: moving from a to b`, `reset: moving to HEAD~1`.
    // Reflog subjects look like `commit (initial): message` or `reset: moving to HEAD~1`;
    // the leading verb is the action the UI labels the entry with.
    const action = subject?.match(/^([a-z][a-z-]*)/)?.[1] ?? ''
    entries.push({ hash, shortHash, selector, subject: subject || '', date: date || '', action })
  }
  return entries
}

/** `git stash list --format=%gd%x00%H%x00%h%x00%gs%x00%cr%x00` */
export function parseStashList(stdout: string): StashEntry[] {
  const fields = stdout.split('\0')
  const entries: StashEntry[] = []
  for (let i = 0; i + 4 < fields.length; i += 5) {
    const [selector, hash, shortHash, subject, date] = fields.slice(i, i + 5)
    if (!selector || !hash) continue
    const index = Number(selector.match(/^stash@\{(\d+)\}$/)?.[1] ?? entries.length)
    // `WIP on main: 1a2b3c subject` or `On main: message` for `stash push -m`.
    const branch = subject.match(/^(?:WIP on|On) ([^:]+):/)?.[1]
    entries.push({ index, selector, hash, shortHash, subject: subject || '', branch: branch || undefined, date: date || '' })
  }
  return entries
}

/** `git tag --list --format=%(refname:short)%00%(objectname)%00%(objecttype)%00%(*objectname)%00%(contents:subject)%00%(creatordate:relative)` */
export function parseTags(stdout: string): TagItem[] {
  const tags: TagItem[] = []
  for (const record of stdout.split('\n')) {
    if (!record.trim()) continue
    const [name, hash, objectType, peeled, subject, date] = record.split('\0')
    if (!name) continue
    const annotated = objectType === 'tag'
    tags.push({
      name, hash: (annotated && peeled) ? peeled : hash, annotated,
      // An annotated tag carries its own message; a lightweight tag shows the commit subject.
      subject: subject || undefined, date: date || undefined,
    })
  }
  return tags
}

/**
 * `git blame --line-porcelain`: a header line per group, then metadata, then the
 * tab-prefixed content. The group header only repeats the hash for later lines of
 * the same commit, so the previous author values carry over.
 */
export function parseBlamePorcelain(stdout: string): BlameLine[] {
  const lines: BlameLine[] = []
  let current: BlameLine | undefined
  for (const raw of stdout.split('\n')) {
    const header = raw.match(/^([0-9a-f]{7,64}) \d+ (\d+)(?: (\d+))?$/)
    if (header) {
      current = {
        lineNumber: Number(header[2]), hash: header[1], shortHash: header[1].slice(0, 7),
        author: current?.author ?? '', authorEmail: current?.authorEmail ?? '', date: current?.date ?? '',
        summary: current?.summary ?? '', content: '',
        uncommitted: /^0{7,}$/.test(header[1]),
      }
      lines.push(current)
      continue
    }
    if (!current) continue
    if (raw.startsWith('\t')) { current.content = raw.slice(1); continue }
    if (raw.startsWith('author ')) current.author = raw.slice(7)
    else if (raw.startsWith('author-mail ')) current.authorEmail = raw.slice(12).replace(/^<|>$/g, '')
    else if (raw.startsWith('author-time ')) {
      const seconds = Number(raw.slice(12))
      // The `author-tz` line follows; keep the ISO form until it arrives and offset it then.
      current.date = Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : ''
    } else if (raw.startsWith('author-tz ')) {
      current.date = applyTimezone(current.date, raw.slice(10))
    } else if (raw.startsWith('summary ')) current.summary = raw.slice(8)
  }
  return lines
}

/** Rewrites an ISO instant into the author's own offset, e.g. `2024-05-01T10:00:00+08:00`. */
export function applyTimezone(iso: string, zone: string): string {
  const match = zone.match(/^([+-])(\d{2})(\d{2})$/)
  if (!iso || !match) return iso
  const instant = new Date(iso).getTime()
  if (!Number.isFinite(instant)) return iso
  const offsetMinutes = (Number(match[2]) * 60 + Number(match[3])) * (match[1] === '-' ? -1 : 1)
  const shifted = new Date(instant + offsetMinutes * 60_000).toISOString().slice(0, 19)
  return `${shifted}${match[1]}${match[2]}:${match[3]}`
}

/** `git diff-tree -r -z --no-commit-id --name-status`: status and path as separate NUL fields. */
export function parseNameStatus(stdout: string): { path: string; oldPath?: string; status: CommitFile['status'] }[] {
  const records = stdout.split('\0').filter((value, index, all) => value !== '' || index < all.length - 1)
  const files: { path: string; oldPath?: string; status: CommitFile['status'] }[] = []
  for (let i = 0; i < records.length; i++) {
    const code = records[i]
    if (!/^[A-Z]\d*$/.test(code)) continue
    const letter = code[0]
    const status: CommitFile['status'] = letter === 'A' ? 'added' : letter === 'D' ? 'deleted' : letter === 'R' ? 'renamed' : letter === 'C' ? 'copied' : letter === 'T' ? 'typechange' : letter === 'M' ? 'modified' : 'unknown'
    if (letter === 'R' || letter === 'C') {
      const oldPath = records[++i]
      const path = records[++i]
      if (path) files.push({ path, oldPath: oldPath || undefined, status })
    } else {
      const path = records[++i]
      if (path) files.push({ path, status })
    }
  }
  return files
}

/** Merges `--name-status` entries with `--numstat -z` counts, keyed by new path. */
export function mergeCommitFiles(entries: { path: string; oldPath?: string; status: CommitFile['status'] }[], numstat: string): CommitFile[] {
  const stats = parseNumstat(numstat)
  return entries.map(entry => ({ ...entry, insertions: stats.get(entry.path)?.insertions ?? 0, deletions: stats.get(entry.path)?.deletions ?? 0 }))
}

/** `git log -z --format=%H%x00%h%x00%s%x00%an%x00%cr%x00 --follow -- <path>` */
export function parseFileHistory(stdout: string): FileHistoryEntry[] {
  const fields = stdout.split('\0')
  const entries: FileHistoryEntry[] = []
  for (let i = 0; i + 4 < fields.length; i += 5) {
    const [hash, shortHash, subject, author, date] = fields.slice(i, i + 5)
    if (!hash || !shortHash) continue
    entries.push({ hash, shortHash, subject, author, date })
  }
  return entries
}
