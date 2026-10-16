/**
 * Pure patch and text helpers the diff panes share: rebuilding a one-hunk patch for
 * hunk-level staging, and the token diff behind word-level highlighting. No DOM, no
 * network — everything here is unit-testable on its own.
 */

import type { DiffLine } from '../../core/types.js'

/** Everything before the first `@@` of a per-file patch: `diff --git`, `index`, `---`, `+++`. */
export function patchPreamble(rawPatch: string): string {
  const lines = trimmedLines(rawPatch)
  const firstHunk = lines.findIndex(line => line.startsWith('@@'))
  return firstHunk < 0 ? lines.join('\n') : lines.slice(0, firstHunk).join('\n')
}

/** True when the patch carries no hunks at all (binary or mode-only change). */
export function isHunklessPatch(rawPatch: string): boolean {
  return !trimmedLines(rawPatch).some(line => line.startsWith('@@'))
}

/** Splits the hunk body into one array per hunk, each starting with its `@@` header. */
export function splitHunks(rawPatch: string): string[][] {
  const lines = trimmedLines(rawPatch)
  const firstHunk = lines.findIndex(line => line.startsWith('@@'))
  if (firstHunk < 0) return []
  const hunks: string[][] = []
  for (const line of lines.slice(firstHunk)) {
    if (line.startsWith('@@')) hunks.push([line])
    else hunks[hunks.length - 1]?.push(line)
  }
  return hunks
}

export function countHunks(rawPatch: string): number {
  return splitHunks(rawPatch).length
}

/**
 * Rebuilds a patch holding only the selected hunks so `git apply --cached` can stage (or
 * reverse-unstage) exactly those lines. An empty selection means "every hunk".
 */
export function buildHunkPatch(rawPatch: string, indexes: readonly number[]): string {
  if (isHunklessPatch(rawPatch)) return indexes.length ? '' : rawPatch
  const hunks = splitHunks(rawPatch)
  if (indexes.length && indexes.some(index => !Number.isInteger(index) || index < 0 || index >= hunks.length)) return ''
  // Normalize selection order and duplicates so callers cannot emit duplicate or
  // descending hunks (which can make git apply reject or mis-handle the patch).
  const wanted = indexes.length
    ? [...new Set(indexes)].sort((left, right) => left - right)
    : hunks.map((_, index) => index)
  if (!wanted.length) return ''
  const body = wanted.map(index => hunks[index].join('\n')).join('\n')
  return `${patchPreamble(rawPatch)}\n${body}\n`
}

function trimmedLines(rawPatch: string): string[] {
  const lines = rawPatch.split('\n')
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines
}

export interface TokenSegment {
  text: string
  changed: boolean
}

const TOKEN_PATTERN = /[A-Za-z0-9_]+|\p{Script=Han}|[^\s]|\s+/gu

/** Splits a line into word/whitespace tokens; Han characters stay one token each. */
export function tokenizeLine(line: string): string[] {
  return line.match(TOKEN_PATTERN) ?? []
}

export interface WordDiff {
  old: TokenSegment[]
  new: TokenSegment[]
}

/**
 * Token-level diff between two lines of a hunk (an added line against its deleted
 * counterpart). Falls back to positional pairing for very long lines so a pathological
 * input cannot make the panel allocate a huge table.
 */
export function diffWords(oldLine: string, newLine: string): WordDiff {
  const left = tokenizeLine(oldLine)
  const right = tokenizeLine(newLine)
  if (left.length * right.length > 160_000) return positionalDiff(left, right)
  // Longest common subsequence over tokens: everything outside it is what changed.
  const table: number[][] = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0))
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      table[i][j] = left[i] === right[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const oldTokens: TokenSegment[] = []
  const newTokens: TokenSegment[] = []
  let i = 0
  let j = 0
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      oldTokens.push({ text: left[i], changed: false })
      newTokens.push({ text: right[j], changed: false })
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      oldTokens.push({ text: left[i], changed: true })
      i++
    } else {
      newTokens.push({ text: right[j], changed: true })
      j++
    }
  }
  for (; i < left.length; i++) oldTokens.push({ text: left[i], changed: true })
  for (; j < right.length; j++) newTokens.push({ text: right[j], changed: true })
  return { old: mergeSegments(oldTokens), new: mergeSegments(newTokens) }
}

function positionalDiff(left: string[], right: string[]): WordDiff {
  return {
    old: mergeSegments(left.map((text, index) => ({ text, changed: right[index] !== text }))),
    new: mergeSegments(right.map((text, index) => ({ text, changed: left[index] !== text }))),
  }
}

function mergeSegments(tokens: TokenSegment[]): TokenSegment[] {
  const merged: TokenSegment[] = []
  for (const token of tokens) {
    const last = merged[merged.length - 1]
    if (last && last.changed === token.changed) last.text += token.text
    else merged.push({ ...token })
  }
  return merged
}

export interface ChangedLine {
  type: string
  content: string
}

export interface LinePair {
  /** Index into the hunk's line list of the removed line, when the pair has one. */
  delIndex?: number
  /** Index into the hunk's line list of the added line, when the pair has one. */
  addIndex?: number
  oldLine?: string
  newLine?: string
}

/**
 * Pairs each removed line with the added line that replaces it, which is how a unified
 * hunk expresses a modification: a run of deletions followed by a run of additions.
 * Unbalanced runs leave the extra lines unpaired (pure removal or pure addition).
 */
export function pairChangedLines(lines: readonly ChangedLine[]): LinePair[] {
  const pairs: LinePair[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (line.type === 'del') {
      const deletions: number[] = []
      while (index < lines.length && lines[index].type === 'del') deletions.push(index++)
      const additions: number[] = []
      while (index < lines.length && lines[index].type === 'add') additions.push(index++)
      for (let k = 0; k < Math.max(deletions.length, additions.length); k++) {
        pairs.push({
          delIndex: deletions[k],
          addIndex: additions[k],
          oldLine: deletions[k] === undefined ? undefined : lines[deletions[k]].content,
          newLine: additions[k] === undefined ? undefined : lines[additions[k]].content,
        })
      }
      continue
    }
    if (line.type === 'add') pairs.push({ addIndex: index, newLine: line.content })
    index++
  }
  return pairs
}

/** Word-level highlight for every changed line of a hunk, keyed by line index. */
export function wordHighlight(lines: readonly ChangedLine[]): Map<number, TokenSegment[]> {
  const highlight = new Map<number, TokenSegment[]>()
  for (const pair of pairChangedLines(lines)) {
    if (pair.oldLine === undefined || pair.newLine === undefined) continue
    const words = diffWords(pair.oldLine, pair.newLine)
    if (pair.delIndex !== undefined) highlight.set(pair.delIndex, words.old)
    if (pair.addIndex !== undefined) highlight.set(pair.addIndex, words.new)
  }
  return highlight
}

export interface SplitCell {
  num?: number
  content: string
  type: string
}

export interface SplitRow {
  left?: SplitCell
  right?: SplitCell
}

/**
 * Lays a hunk out for the side-by-side view: a deletion run and the addition run that
 * follows it are the two halves of one change, so they share a row. A side without a
 * counterpart stays empty, which is what makes an insertion or a removal visible.
 */
export function splitRows(lines: readonly DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (line.type === 'del') {
      const removed: DiffLine[] = []
      while (index < lines.length && lines[index].type === 'del') removed.push(lines[index++])
      const added: DiffLine[] = []
      while (index < lines.length && lines[index].type === 'add') added.push(lines[index++])
      for (let k = 0; k < Math.max(removed.length, added.length); k++) {
        rows.push({
          left: removed[k] ? { num: removed[k].oldNum, content: removed[k].content, type: 'del' } : undefined,
          right: added[k] ? { num: added[k].newNum, content: added[k].content, type: 'add' } : undefined,
        })
      }
      continue
    }
    if (line.type === 'add') {
      rows.push({ right: { num: line.newNum, content: line.content, type: 'add' } })
    } else {
      rows.push({
        left: { num: line.oldNum, content: line.content, type: 'normal' },
        right: { num: line.newNum, content: line.content, type: 'normal' },
      })
    }
    index++
  }
  return rows
}
