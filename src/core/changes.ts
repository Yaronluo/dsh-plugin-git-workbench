import { parseNumstat } from './git-command.js'
import type { ChangeEntry, ChangeList, ChangeSection, ConflictLine, DiffFile, StatusEntry } from './types.js'

export interface UntrackedCount {
  insertions: number
  deletions: number
  binary: boolean
}

export interface ChangeInputs {
  entries: StatusEntry[]
  /** `git diff --cached --numstat -z`: HEAD against the index. */
  stagedNumstat: string
  /** `git diff --numstat -z`: the index against the worktree. */
  worktreeNumstat: string
  /** Untracked files, whose line counts `--numstat` never reports. */
  untracked: Map<string, UntrackedCount>
}

const SECTION_ORDER: Record<ChangeSection, number> = { conflict: 0, staged: 1, unstaged: 2, untracked: 3 }

function letterStatus(letter: string): DiffFile['status'] {
  if (letter === 'A') return 'added'
  if (letter === 'D') return 'deleted'
  if (letter === 'R' || letter === 'C') return 'renamed'
  return 'modified'
}

/**
 * Turns `git status --porcelain=v2` into the panel's four lists. A path that is
 * changed in both the index and the worktree appears twice on purpose: the two
 * halves are staged and unstaged separately, and merging them would hide that.
 */
export function buildChangeList(input: ChangeInputs): ChangeList {
  const stagedStats = parseNumstat(input.stagedNumstat)
  const worktreeStats = parseNumstat(input.worktreeNumstat)
  const entries: ChangeEntry[] = []

  for (const entry of input.entries) {
    if (entry.conflict) {
      entries.push({
        path: entry.path, origPath: entry.origPath, section: 'conflict', status: 'conflict',
        insertions: 0, deletions: 0, code: `${entry.index}${entry.worktree}`,
      })
      continue
    }
    if (entry.untracked) {
      const counts = input.untracked.get(entry.path) ?? { insertions: 0, deletions: 0, binary: false }
      entries.push({
        path: entry.path, section: 'untracked', status: 'untracked',
        insertions: counts.insertions, deletions: counts.deletions, binary: counts.binary || undefined, code: '?',
      })
      continue
    }
    if (entry.index !== '.') {
      const stat = stagedStats.get(entry.path)
      entries.push({
        path: entry.path, origPath: entry.origPath, section: 'staged', status: letterStatus(entry.index),
        insertions: stat?.insertions ?? 0, deletions: stat?.deletions ?? 0, binary: stat?.binary || undefined, code: entry.index,
      })
    }
    if (entry.worktree !== '.') {
      const stat = worktreeStats.get(entry.path)
      entries.push({
        path: entry.path, section: 'unstaged', status: letterStatus(entry.worktree),
        insertions: stat?.insertions ?? 0, deletions: stat?.deletions ?? 0, binary: stat?.binary || undefined, code: entry.worktree,
      })
    }
  }

  entries.sort((a, b) => SECTION_ORDER[a.section] - SECTION_ORDER[b.section] || a.path.localeCompare(b.path))
  return {
    entries,
    staged: entries.filter(entry => entry.section === 'staged').length,
    unstaged: entries.filter(entry => entry.section === 'unstaged').length,
    conflicts: entries.filter(entry => entry.section === 'conflict').length,
    untracked: entries.filter(entry => entry.section === 'untracked').length,
    totalInsertions: entries.reduce((total, entry) => total + entry.insertions, 0),
    totalDeletions: entries.reduce((total, entry) => total + entry.deletions, 0),
  }
}

/**
 * Splits a worktree file that Git left conflict markers in. The markers are the
 * only place the two sides appear side by side, so the panel shows them verbatim
 * rather than a combined diff.
 */
export function parseConflictContent(content: string): { hasMarkers: boolean; lines: ConflictLine[] } {
  const lines: ConflictLine[] = []
  let state: ConflictLine['type'] = 'normal'
  let hasMarkers = false
  for (const raw of content.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw
    if (line.startsWith('<<<<<<< ')) { hasMarkers = true; state = 'ours'; lines.push({ type: 'marker', content: line }); continue }
    if (line.startsWith('||||||| ')) { state = 'base'; lines.push({ type: 'marker', content: line }); continue }
    if (line === '=======') { state = 'theirs'; lines.push({ type: 'marker', content: line }); continue }
    if (line.startsWith('>>>>>>> ')) { state = 'normal'; lines.push({ type: 'marker', content: line }); continue }
    lines.push({ type: state, content: line })
  }
  // A trailing newline yields one empty line; it is not part of the file's content.
  if (lines.length > 0 && lines[lines.length - 1].content === '' && content.endsWith('\n')) lines.pop()
  return { hasMarkers, lines }
}
