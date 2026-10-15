import { posix, win32 } from 'node:path'
import type { BranchItem, DiffFile, DiffHunk, DiffView, GitGraphCommit, RepoStatus, WorktreeItem } from './types.js'

export function parseStatusV2(stdout: string, root: string): RepoStatus {
  const status: RepoStatus = { isGit: true, root, branch: 'HEAD', head: '', dirtyFiles: 0, untrackedFiles: 0, conflicts: 0, operationInProgress: false }
  const records = stdout.split(stdout.includes('\0') ? '\0' : '\n')
  for (let i = 0; i < records.length; i++) {
    const line = records[i]
    if (line.startsWith('# branch.head ')) status.branch = line.slice(14) === '(detached)' ? 'HEAD' : line.slice(14)
    else if (line.startsWith('# branch.oid ')) status.head = line.slice(13) === '(initial)' ? '' : line.slice(13, 20)
    else if (line.startsWith('# branch.upstream ')) status.upstream = line.slice(18)
    else if (/^[12u?] /.test(line)) {
      status.dirtyFiles++
      if (line.startsWith('? ')) status.untrackedFiles++
      if (line.startsWith('u ')) status.conflicts++
      if (line.startsWith('2 ') && stdout.includes('\0')) i++ // original rename path
    }
  }
  return status
}

export function parseBranches(stdout: string): BranchItem[] {
  return stdout.split('\n').map(line => line.trim()).filter(line => line && !line.includes('->')).map(line => {
    const name = line.replace(/^[*+\s]+/, '').replace(/^remotes\//, '')
    return { name, current: line.startsWith('*'), isRemote: line.replace(/^[*+\s]+/, '').startsWith('remotes/') }
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

export function parseUnifiedDiff(diffOutput: string, numstatOutput = ''): DiffView {
  const stats = new Map<string, { ins: number; del: number }>()
  const put = (ins: string, del: string, path: string) => stats.set(path, { ins: Number(ins) || 0, del: Number(del) || 0 })
  if (numstatOutput.includes('\0')) {
    const records = numstatOutput.split('\0')
    for (let i = 0; i < records.length; i++) {
      const match = records[i].match(/^([^\t]+)\t([^\t]+)\t(.*)$/s)
      if (!match) continue
      let path = match[3]
      if (!path) { i++; path = records[++i] }
      put(match[1], match[2], path)
    }
  } else {
    for (const line of numstatOutput.split('\n')) {
      const match = line.match(/^([^\t]+)\t([^\t]+)\t(.*)$/)
      if (match) {
        let path = decodeGitPath(match[3])
        path = path.replace(/\{[^{}]* => ([^{}]*)\}/, '$1').replace(/^.* => /, '')
        put(match[1], match[2], path)
      }
    }
  }
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
    const stat = stats.get(path) ?? { ins, del }
    files.push({ path, oldPath: oldPath || undefined, status, insertions: stat.ins, deletions: stat.del, hunks, rawPatch: chunk })
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
