export interface RepoStatus {
  isGit: boolean
  root: string
  branch: string
  head: string
  upstream?: string
  /** Stable content fingerprint for polling/SSE; changes even when dirty counts do not. */
  revision?: string
  dirtyFiles: number
  untrackedFiles: number
  conflicts: number
  operationInProgress: boolean
}

export interface BranchItem {
  name: string
  current: boolean
  isRemote: boolean
  upstream?: string
  ahead?: number
  behind?: number
}

export interface BranchesView {
  current: string
  dirtyFiles: number
  branches: BranchItem[]
}

export interface DiffLine {
  type: 'add' | 'del' | 'normal'
  oldNum?: number
  newNum?: number
  content: string
}

export interface DiffHunk {
  header: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

export interface DiffFile {
  path: string
  oldPath?: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflict'
  insertions: number
  deletions: number
  hunks: DiffHunk[]
  rawPatch: string
}

export interface DiffView {
  base: string
  target: string
  totalInsertions: number
  totalDeletions: number
  files: DiffFile[]
}

export interface WorktreeItem {
  path: string
  branch: string
  head: string
  isCurrent: boolean
  locked?: boolean
  lockedReason?: string
}

export interface GitGraphCommit {
  hash: string
  shortHash: string
  subject: string
  author: string
  date: string
  parents: string[]
  refs: string[]
}

export interface SwitchResult {
  ok: boolean
  branch?: string
  error?: {
    code: string
    message: string
  }
}
