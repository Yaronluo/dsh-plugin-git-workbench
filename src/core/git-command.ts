import type { BranchItem, DiffFile, DiffHunk, DiffLine, DiffView, GitGraphCommit, RepoStatus, WorktreeItem } from './types.js'

/**
 * Parse `git status --porcelain=v2 --branch`
 */
export function parseStatusV2(stdout: string, root: string): RepoStatus {
  let branch = 'HEAD'
  let head = ''
  let dirtyFiles = 0
  let untrackedFiles = 0
  let conflicts = 0

  const lines = stdout.split('\n')
  for (const line of lines) {
    if (!line) continue
    if (line.startsWith('# branch.head ')) {
      branch = line.slice(14).trim()
      if (branch === '(detached)') branch = 'HEAD'
    } else if (line.startsWith('# branch.oid ')) {
      head = line.slice(13).trim().slice(0, 7)
    } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
      // 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
      // 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path><sep><origPath>
      dirtyFiles++
    } else if (line.startsWith('u ')) {
      // unmerged / conflict
      conflicts++
      dirtyFiles++
    } else if (line.startsWith('? ')) {
      // untracked
      untrackedFiles++
      dirtyFiles++
    }
  }

  return {
    isGit: true,
    root,
    branch,
    head,
    dirtyFiles,
    untrackedFiles,
    conflicts,
    operationInProgress: false,
  }
}

/**
 * Parse branch list output
 */
export function parseBranches(stdout: string): BranchItem[] {
  const branches: BranchItem[] = []
  const lines = stdout.split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const current = line.startsWith('*')
    const cleanLine = line.replace(/^[\*\+\s]+/, '').trim()
    if (!cleanLine || cleanLine.includes('->')) continue

    const isRemote = cleanLine.startsWith('remotes/') || cleanLine.startsWith('origin/')
    const name = cleanLine.replace(/^remotes\//, '')

    branches.push({
      name,
      current,
      isRemote,
    })
  }

  // Sort so current branch is first, then local branches, then remotes
  return branches.sort((a, b) => {
    if (a.current) return -1
    if (b.current) return 1
    if (!a.isRemote && b.isRemote) return -1
    if (a.isRemote && !b.isRemote) return 1
    return a.name.localeCompare(b.name)
  })
}

/**
 * Parse unified diff text into structured DiffFile array
 */
export function parseUnifiedDiff(diffOutput: string, numstatOutput?: string): DiffView {
  const numstatMap = new Map<string, { ins: number; del: number }>()
  let totalIns = 0
  let totalDel = 0

  if (numstatOutput) {
    for (const line of numstatOutput.split('\n')) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 3) {
        const ins = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0
        const del = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0
        const filePath = parts.slice(2).join(' ')
        numstatMap.set(filePath, { ins, del })
        totalIns += ins
        totalDel += del
      }
    }
  }

  const files: DiffFile[] = []
  const rawFileChunks = diffOutput.split(/^diff --git /m)

  for (const chunk of rawFileChunks) {
    if (!chunk.trim()) continue

    const lines = chunk.split('\n')
    const headerLine = lines[0] // a/foo b/foo
    const match = headerLine.match(/a\/(.+?)\s+b\/(.+)/)
    const filePath = match ? match[2] : (lines.find(l => l.startsWith('+++ b/'))?.slice(6) || 'unknown')
    const oldPath = match ? match[1] : undefined

    let status: DiffFile['status'] = 'modified'
    if (chunk.includes('new file mode')) status = 'added'
    else if (chunk.includes('deleted file mode')) status = 'deleted'
    else if (chunk.includes('similarity index') && oldPath !== filePath) status = 'renamed'

    const stat = numstatMap.get(filePath) || { ins: 0, del: 0 }
    const hunks: DiffHunk[] = []

    let currentHunk: DiffHunk | null = null
    let oldLine = 0
    let newLine = 0

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith('@@ ')) {
        // @@ -oldStart,oldLines +newStart,newLines @@
        const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/)
        if (hunkMatch) {
          const oldStart = parseInt(hunkMatch[1], 10)
          const oldLines = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1
          const newStart = parseInt(hunkMatch[3], 10)
          const newLines = hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1

          oldLine = oldStart
          newLine = newStart

          currentHunk = {
            header: line,
            oldStart,
            oldLines,
            newStart,
            newLines,
            lines: [],
          }
          hunks.push(currentHunk)
          continue
        }
      }

      if (currentHunk) {
        if (line.startsWith('+')) {
          currentHunk.lines.push({
            type: 'add',
            newNum: newLine++,
            content: line.slice(1),
          })
        } else if (line.startsWith('-')) {
          currentHunk.lines.push({
            type: 'del',
            oldNum: oldLine++,
            content: line.slice(1),
          })
        } else if (line.startsWith(' ') || line === '') {
          currentHunk.lines.push({
            type: 'normal',
            oldNum: oldLine++,
            newNum: newLine++,
            content: line.startsWith(' ') ? line.slice(1) : line,
          })
        }
      }
    }

    files.push({
      path: filePath,
      oldPath,
      status,
      insertions: stat.ins,
      deletions: stat.del,
      hunks,
      rawPatch: chunk,
    })
  }

  return {
    base: 'HEAD',
    target: 'working-tree',
    totalInsertions: totalIns,
    totalDeletions: totalDel,
    files,
  }
}

/**
 * Parse `git worktree list --porcelain`
 */
export function parseWorktrees(stdout: string, currentPath: string): WorktreeItem[] {
  const items: WorktreeItem[] = []
  const blocks = stdout.trim().split('\n\n')

  for (const block of blocks) {
    if (!block.trim()) continue
    let path = ''
    let head = ''
    let branch = ''
    let locked = false

    for (const line of block.split('\n')) {
      if (line.startsWith('worktree ')) path = line.slice(9).trim()
      else if (line.startsWith('HEAD ')) head = line.slice(5).trim().slice(0, 7)
      else if (line.startsWith('branch refs/heads/')) branch = line.slice(18).trim()
      else if (line === 'locked') locked = true
    }

    if (path) {
      items.push({
        path,
        head,
        branch: branch || '(detached)',
        isCurrent: path.toLowerCase() === currentPath.toLowerCase(),
        locked,
      })
    }
  }

  return items
}

/**
 * Parse `git log`
 */
export function parseLog(stdout: string): GitGraphCommit[] {
  const commits: GitGraphCommit[] = []
  const lines = stdout.split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    // format: %H|%h|%s|%an|%cr|%P|%D
    const [hash, shortHash, subject, author, date, parentsStr, refsStr] = line.split('|')
    if (hash && shortHash) {
      commits.push({
        hash,
        shortHash,
        subject: subject || '',
        author: author || '',
        date: date || '',
        parents: parentsStr ? parentsStr.split(' ') : [],
        refs: refsStr ? refsStr.split(',').map(s => s.trim()).filter(Boolean) : [],
      })
    }
  }
  return commits
}
