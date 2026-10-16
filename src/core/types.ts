/** A multi-step Git operation that leaves the repository mid-flight. */
export type GitOperationKind = 'merge' | 'rebase' | 'cherry-pick' | 'revert' | 'am' | 'bisect' | 'apply'

/**
 * One changed path from `git status --porcelain=v2`, with both halves of the
 * index/worktree pair. The UI needs them separately: "暂存" and "未暂存" are two
 * different lists even when they name the same file.
 */
export interface StatusEntry {
  path: string
  /** Previous path of a rename/copy. */
  origPath?: string
  /** Staged status letter (`M`, `A`, `D`, `R`, `C`, `T`, or `.`). */
  index: string
  /** Worktree status letter, or `.` when the worktree matches the index. */
  worktree: string
  conflict: boolean
  untracked: boolean
}

export interface RepoStatus {
  isGit: boolean
  root: string
  branch: string
  head: string
  upstream?: string
  /** Commits the local branch has that its upstream does not. */
  ahead?: number
  /** Commits the upstream has that the local branch does not. */
  behind?: number
  /** Entries in the stash, as reported by `# stash N`. */
  stashCount?: number
  /** True when HEAD is not on a branch. */
  detached?: boolean
  /** The operation left half-applied, when one is. */
  operation?: GitOperationKind | null
  /** Stable content fingerprint for polling/SSE; changes even when dirty counts do not. */
  revision?: string
  dirtyFiles: number
  untrackedFiles: number
  conflicts: number
  operationInProgress: boolean
  /** Per-path state, used by the staged/unstaged lists. */
  entries?: StatusEntry[]
}

export interface BranchItem {
  name: string
  current: boolean
  isRemote: boolean
  upstream?: string
  ahead?: number
  behind?: number
  /** Tip commit subject, shown as the branch's last activity. */
  subject?: string
  hash?: string
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
  /** True when Git reported the file as binary instead of emitting hunks. */
  binary?: boolean
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
  /** Number of changed files inside that worktree, when it was scanned. */
  dirtyFiles?: number
  /** The worktree's HEAD commit is not reachable from any branch. */
  detached?: boolean
  prunable?: boolean
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

export interface CommitFile {
  path: string
  oldPath?: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'typechange' | 'unknown'
  insertions: number
  deletions: number
}

export interface CommitDetail extends GitGraphCommit {
  body: string
  authorEmail: string
  /** `Name <email>`, the form Git prints for a commit. */
  committer: string
  commitDate: string
  files: CommitFile[]
  totalInsertions: number
  totalDeletions: number
}

export interface ReflogEntry {
  hash: string
  shortHash: string
  /** `HEAD@{2}`. */
  selector: string
  /** The reflog message, e.g. `commit: fix parser`. */
  subject: string
  date: string
  action: string
}

export interface StashEntry {
  /** Position in the stash stack; 0 is the newest. */
  index: number
  selector: string
  hash: string
  shortHash: string
  subject: string
  /** Branch the stash was created on, parsed from its message. */
  branch?: string
  date: string
}

export interface BlameLine {
  lineNumber: number
  hash: string
  shortHash: string
  author: string
  authorEmail: string
  /** Author time, ISO-8601 in the author's own timezone offset. */
  date: string
  summary: string
  content: string
  /** True when the line came from a commit that is not in the current branch's history. */
  uncommitted?: boolean
}

export interface BlameView {
  path: string
  lines: BlameLine[]
  /** True when the file was longer than the requested line budget. */
  truncated: boolean
  totalLines: number
}

export interface FileHistoryEntry {
  hash: string
  shortHash: string
  subject: string
  author: string
  date: string
}

export interface TagItem {
  name: string
  hash: string
  annotated: boolean
  /** Message of an annotated tag. */
  subject?: string
  date?: string
}

export interface SwitchResult {
  ok: boolean
  branch?: string
  error?: {
    code: string
    message: string
  }
}

/** Result of a mutating Git action that reports Git's own output. */
export interface ActionResult {
  ok: boolean
  error?: string
  /** Trimmed stdout, shown when Git succeeded but said something (e.g. `Everything up-to-date`). */
  output?: string
}

export interface CommitResult extends ActionResult {
  hash?: string
  shortHash?: string
  /** The subject Git recorded, so the UI can confirm what was committed. */
  summary?: string
}

export interface SyncResult extends ActionResult {
  ahead?: number
  behind?: number
}

export interface DiscardResult extends ActionResult {
  /** Paths that were actually discarded or deleted. */
  discarded?: string[]
}

/** Which list a changed path belongs to in the panel. */
export type ChangeSection = 'staged' | 'unstaged' | 'conflict' | 'untracked'

export interface ChangeEntry {
  path: string
  origPath?: string
  section: ChangeSection
  status: DiffFile['status']
  insertions: number
  deletions: number
  binary?: boolean
  /** Status letter as Git printed it (`M`, `A`, `D`, `R`, `?`, `U`). */
  code: string
}

export interface ChangeList {
  entries: ChangeEntry[]
  staged: number
  unstaged: number
  conflicts: number
  untracked: number
  totalInsertions: number
  totalDeletions: number
}

export type ConflictLineType = 'normal' | 'ours' | 'theirs' | 'base' | 'marker'

export interface ConflictLine {
  type: ConflictLineType
  content: string
}

export interface ConflictFile {
  path: string
  /** False for a binary file, or one deleted on the other side. */
  hasMarkers: boolean
  lines: ConflictLine[]
  /** Unmerged index stages present, e.g. `['1', '2', '3']`. */
  stages: string[]
  binary?: boolean
}

export interface OperationState {
  kind: GitOperationKind | null
  /** Paths still carrying unmerged index stages. */
  conflicts: string[]
  /** Message Git prepared for the operation (`MERGE_MSG`, `rebase-merge/message`). */
  message?: string
  /** True once every conflict is resolved, so the operation can be continued. */
  canContinue: boolean
  /** Branch or commit the operation is working against, when Git recorded it. */
  detail?: string
}

export interface RemoteItem {
  name: string
  url: string
  /** `fetch` or `push`. */
  kind: string
}

/**
 * One external editor the panel can offer. The list is what this machine actually has,
 * so the picker never offers a command that would fail after the click.
 */
export interface EditorChoice {
  /** Bare command name, echoed back when the user picks this editor. */
  command: string
  /** Human-readable name shown in the picker. */
  label: string
  /** `true` when this editor's CLI accepts `-g <file>[:line]`. */
  goto: boolean
  /**
   * The application's own icon as a PNG data URL, read from the executable by the host.
   * Absent when the host cannot read one (non-Windows, or an unknown binary); the picker
   * then falls back to its own mark.
   */
  icon?: string
}
