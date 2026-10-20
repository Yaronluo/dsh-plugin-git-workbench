/**
 * Lays a commit list out as graph lanes. Pure: given the commits `git log` already
 * reports (each with its parent hashes) it decides which column every commit's dot sits
 * in and where its parents continue, so the renderer only has to draw lines.
 */
import type { GitGraphCommit } from '../core/types.js'

export interface GraphParent {
  hash: string
  /** Column the parent's edge points at in the next row. */
  column: number
}

export interface GraphRow {
  commit: GitGraphCommit
  /** Column of this commit's dot. */
  column: number
  /** Every column that is still live at this row, so the renderer can draw pass-throughs. */
  columns: string[]
  /** Columns the parent edges leave towards (the first parent stays in `column`). */
  parents: GraphParent[]
  /** Columns to reserve for this row, including parent columns that just appeared. */
  width: number
}

/**
 * Walks the commits newest first, keeping a column slot per still-open branch. A commit
 * whose hash is not yet tracked opens a column; the first parent then inherits that
 * column while merge parents take (or open) one of their own.
 */
export function computeGraph(commits: readonly GitGraphCommit[], maxColumns = 8): GraphRow[] {
  const rows: GraphRow[] = []
  let columns: string[] = []
  for (const commit of commits) {
    let column = columns.indexOf(commit.hash)
    if (column < 0) {
      column = columns.indexOf('')
      if (column < 0) {
        columns = columns.length >= maxColumns ? columns : [...columns, commit.hash]
        column = columns.length - 1
      } else columns[column] = commit.hash
    }
    const parents: GraphParent[] = []
    const next = columns.slice()
    next[column] = ''
    const [first, ...mergeParents] = commit.parents
    if (first) {
      // A first parent that another lane already tracks is a merge back into that lane:
      // this column closes and the edge points at the existing one. Keeping both would
      // paint an extra lane that never ends and leave a stub after the last commit.
      const existing = next.indexOf(first)
      if (existing >= 0) parents.push({ hash: first, column: existing })
      else {
        next[column] = first
        parents.push({ hash: first, column })
      }
    }
    for (const parent of mergeParents) {
      let target = next.indexOf(parent)
      if (target < 0) {
        target = next.indexOf('')
        if (target < 0) {
          if (next.length < maxColumns) { next.push(parent); target = next.length - 1 }
          else target = next.length - 1
        } else next[target] = parent
      }
      parents.push({ hash: parent, column: target })
    }
    const width = Math.min(maxColumns, Math.max(columns.length, ...parents.map(parent => parent.column + 1), 1))
    rows.push({ commit, column: Math.min(column, width - 1), columns: columns.slice(0, width), parents, width })
    while (next.length && next[next.length - 1] === '') next.pop()
    columns = next
  }
  return rows
}
