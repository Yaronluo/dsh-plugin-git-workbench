/**
 * The change list groups the diff's files into the four lists Git itself distinguishes
 * (conflicted, staged, unstaged, untracked). One file can produce two rows — a path that
 * was staged and then edited again is genuinely both — so the rows are keyed by section
 * plus path rather than by path alone. Pure data, unit-testable without React.
 */

import type { ChangeEntry, DiffFile, StatusEntry } from '../../core/types.js'

export type SectionKey = 'conflict' | 'staged' | 'unstaged' | 'untracked'

export interface ChangeRow {
  /** Unique per row: `<section>:<path>`. */
  key: string
  path: string
  origPath?: string
  section: SectionKey
  status: string
  insertions: number
  deletions: number
  /** The diff of this file, when the current comparison includes it. */
  file: DiffFile | null
}

export interface ChangeSection {
  key: SectionKey
  label: string
  rows: ChangeRow[]
}

export interface IndexSummary {
  staged: number
  unstaged: number
  conflicts: number
  untracked: number
  insertions: number
  deletions: number
  binary: number
}

const ORDER: SectionKey[] = ['conflict', 'staged', 'unstaged', 'untracked']

const LABELS: Record<SectionKey, string> = {
  conflict: '冲突',
  staged: '已暂存',
  unstaged: '未暂存',
  untracked: '未跟踪',
}

/** `A`/`D`/`R`/`M`/`U` badge text for a row, matching Git's own single-letter vocabulary. */
const LETTERS: Record<string, string> = {
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  modified: 'M',
  untracked: 'U',
  conflict: 'U',
}

export function statusLetter(status: string): string {
  return LETTERS[status] ?? 'M'
}

/** CSS modifier for the badge colour, limited to the four tones the stylesheet defines. */
export function statusTone(status: string): string {
  if (status === 'added' || status === 'untracked') return 'added'
  if (status === 'deleted') return 'deleted'
  if (status === 'renamed' || status === 'copied') return 'renamed'
  if (status === 'conflict') return 'conflict'
  return 'modified'
}

export function sectionLabel(key: SectionKey): string {
  return LABELS[key]
}

/**
 * Rows for the change list. Without status entries (an older status payload, or a
 * comparison that carries no index information) every diff file becomes one row in a
 * single neutral group, which keeps the list useful instead of empty.
 */
export function buildSections(
  files: readonly DiffFile[],
  entries?: readonly ChangeEntry[],
  fallbackLabel = '变更文件',
): ChangeSection[] {
  const byPath = new Map<string, DiffFile>()
  for (const file of files) if (!byPath.has(file.path)) byPath.set(file.path, file)

  if (!entries || entries.length === 0) {
    if (files.length === 0) return []
    return [{
      key: 'unstaged',
      label: fallbackLabel,
      rows: files.map(file => ({
        key: `unstaged:${file.path}`,
        path: file.path,
        section: 'unstaged' as SectionKey,
        status: file.status,
        insertions: file.insertions,
        deletions: file.deletions,
        file,
      })),
    }]
  }

  const grouped = new Map<SectionKey, ChangeRow[]>()
  for (const entry of entries) {
    const file = byPath.get(entry.path) ?? null
    // A row without a diff would open onto nothing, so only rows the comparison shows survive.
    if (!file) continue
    const rows = grouped.get(entry.section) ?? []
    rows.push({
      key: `${entry.section}:${entry.path}`,
      path: entry.path,
      origPath: entry.origPath,
      section: entry.section,
      status: entry.status,
      insertions: entry.insertions,
      deletions: entry.deletions,
      file,
    })
    grouped.set(entry.section, rows)
  }

  return ORDER
    .filter(key => (grouped.get(key)?.length ?? 0) > 0)
    .map(key => ({ key, label: LABELS[key], rows: grouped.get(key)! }))
}

/** Staged status letter → the vocabulary the panel and the diff share. */
const STATUS_BY_LETTER: Record<string, DiffFile['status']> = {
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'renamed',
  T: 'modified',
  M: 'modified',
  U: 'conflict',
  '?': 'untracked',
}

/**
 * Status entries → change rows. Line counts stay at zero on purpose: the numbers the panel
 * shows come from the diff it already has, so the list never argues with the diff above it.
 */
export function toChangeEntries(entries: readonly StatusEntry[]): ChangeEntry[] {
  const rows: ChangeEntry[] = []
  for (const entry of entries) {
    const status = entry.untracked
      ? 'untracked'
      : entry.conflict
        ? 'conflict'
        : STATUS_BY_LETTER[entry.index !== '.' ? entry.index : entry.worktree] ?? 'modified'
    const section: SectionKey = entry.conflict
      ? 'conflict'
      : entry.untracked
        ? 'untracked'
        : entry.index !== '.'
          ? 'staged'
          : 'unstaged'
    const row: ChangeEntry = {
      path: entry.path,
      origPath: entry.origPath,
      section,
      status,
      insertions: 0,
      deletions: 0,
      code: `${entry.index}${entry.worktree}`,
    }
    rows.push(row)
    // Staged and then edited again: each half is stageable on its own, so both get a row.
    if (!entry.conflict && !entry.untracked && entry.index !== '.' && entry.worktree !== '.') {
      rows.push({ ...row, section: 'unstaged', status: STATUS_BY_LETTER[entry.worktree] ?? 'modified' })
    }
  }
  return rows
}

/** Counts for the commit box, which acts on the index rather than on the current diff. */
export function indexSummary(entries?: readonly ChangeEntry[]): IndexSummary {
  const summary: IndexSummary = { staged: 0, unstaged: 0, conflicts: 0, untracked: 0, insertions: 0, deletions: 0, binary: 0 }
  for (const entry of entries ?? []) {
    summary[entry.section] += 1
    summary.insertions += entry.insertions
    summary.deletions += entry.deletions
    if (entry.binary) summary.binary += 1
  }
  return summary
}

/** First problem that should stop a commit, or `null` when the form is submittable. */
export function commitProblem(message: string, summary: IndexSummary): string | null {
  if (summary.conflicts > 0) return '还有未解决的冲突，先解决冲突再提交。'
  if (summary.staged === 0) return '暂存区是空的，先暂存要提交的文件。'
  if (!message.trim()) return '请填写提交信息。'
  return null
}

/** `+12 −3`, or `+12 −3 · 2 个二进制文件` when binary files carry no line counts. */
export function formatStats(insertions: number, deletions: number, binary = 0): string {
  const parts: string[] = []
  if (insertions) parts.push(`+${insertions}`)
  if (deletions) parts.push(`−${deletions}`)
  if (binary) parts.push(`${binary} 个二进制文件`)
  return parts.join(' · ')
}

/** Extensions the host is willing to stream back as an inline preview. */
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'svg'])

/** True when the panel can show this file instead of a wall of binary notice. */
export function isImagePath(path: string): boolean {
  const name = path.split('/').pop() ?? path
  if (!name.includes('.')) return false
  return IMAGE_EXTENSIONS.has(name.split('.').pop()!.toLowerCase())
}

/** Paths worth offering a preview for: added or modified, but not deleted. */
export function canPreviewImage(file: { path: string; status?: string }): boolean {
  return file.status !== 'deleted' && isImagePath(file.path)
}
