import { readFile, readlink, lstat, rm, appendFile, mkdir, realpath } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { GitRunner, GitRunResult } from './git-runner.js'
import {
  mergeCommitFiles, parseBlamePorcelain, parseBranches, parseFileHistory, parseForEachRefBranches, parseLog,
  parseNameStatus, parseNumstat, parseOperation, parseReflog, parseStashList, parseStatusV2, parseTags,
  parseUnifiedDiff, parseWorktrees,
} from '../core/git-command.js'
import { buildChangeList, parseConflictContent } from '../core/changes.js'
import type { UntrackedCount } from '../core/changes.js'
import type {
  ActionResult, BlameView, BranchesView, ChangeList, CommitDetail, CommitResult, ConflictFile, DiffFile, DiffView,
  DiscardResult, FileHistoryEntry, GitGraphCommit, OperationState, ReflogEntry, RemoteItem, RepoStatus, StashEntry,
  StatusEntry, SwitchResult, SyncResult, TagItem, WorktreeItem,
} from '../core/types.js'

/** Options for one diff request; the mode is normally derived from the arguments. */
export interface DiffOptions {
  /**
   * `worktree` = HEAD against worktree (everything uncommitted), `unstaged` = index against
   * worktree (the patch `git apply --cached` consumes), `staged` = HEAD against index,
   * `range` = base...target, `single` = one commit.
   */
  mode?: 'worktree' | 'unstaged' | 'staged' | 'range' | 'single'
  /** Restrict the diff to these repository-relative paths. */
  paths?: string[]
  /** `git diff -w`: ignores all whitespace changes. */
  ignoreWhitespace?: boolean
  /** Context lines around each hunk (Git's default is 3). */
  context?: number
  /** Include the worktree content of untracked files (worktree mode only). */
  includeUntracked?: boolean
}

export interface CommitOptions {
  /** Commit message. Blank is only accepted together with `amend` (which reuses the last one). */
  message?: string
  /** Rewrite the previous commit instead of adding one. */
  amend?: boolean
  /** Add the `Signed-off-by` trailer. */
  signoff?: boolean
  /** Also commit changes to tracked files that are not staged (`git commit -a`). */
  all?: boolean
}

export interface PushOptions {
  remote?: string
  branch?: string
  /** `git push -u`, for a branch that has no upstream yet. */
  setUpstream?: boolean
  /** `false` means "never force"; `with-lease` is the only form the UI offers. */
  force?: 'with-lease' | 'force' | false
  tags?: boolean
  dryRun?: boolean
}

const NETWORK_TIMEOUT_MS = 180_000
const MAX_UNTRACKED_READ = 2_000_000
const MAX_PATCH_BYTES = 4_000_000
/** Inline image previews: big enough for a screenshot, small enough to keep in memory. */
const MAX_BLOB_BYTES = 8_000_000

const BLOB_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

function blobType(path: string): string {
  const name = path.split('/').pop() ?? path
  const extension = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  return BLOB_TYPES[extension] ?? 'application/octet-stream'
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export class GitService {
  /**
   * Content digests of dirty files, keyed by the path's stat signature. Polling
   * reuses a digest while the signature is unchanged, so a 3s SSE tick stops
   * re-reading every dirty file while still noticing an edit that keeps size and
   * mtime (the signature includes the change time and the inode).
   */
  private readonly digests = new Map<string, { signature: string; digest: string }>()

  constructor(private readonly runner: GitRunner) {}

  // ---------------------------------------------------------------- internals

  private checked(result: GitRunResult, operation: string): GitRunResult {
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `${operation} failed (exit ${result.exitCode})`)
    return result
  }

  private safeRef(value: string): string {
    if (typeof value !== 'string' || !value || value.startsWith('-') || /[\s\x00-\x1f\x7f]/.test(value)) throw new Error('Invalid Git reference')
    return value
  }

  /** Resolves a ref-ish string (branch, tag, `HEAD~2`, hash) to a full commit id. */
  private async resolveCommit(root: string, value: string): Promise<string> {
    this.safeRef(value)
    const result = this.checked(await this.runner.run(['rev-parse', '--verify', '--end-of-options', `${value}^{commit}`], root), 'Resolve reference')
    const hash = result.stdout.trim()
    if (!/^[0-9a-f]{40,64}$/i.test(hash)) throw new Error('Invalid resolved commit')
    return hash
  }

  private async branchName(root: string, name: string): Promise<string> {
    this.safeRef(name)
    this.checked(await this.runner.run(['check-ref-format', '--branch', name], root), 'Validate branch')
    // check-ref-format --branch expands @{-N}; never allow expansion to choose a different branch.
    if (name.startsWith('@{')) throw new Error('Invalid branch name')
    return name
  }

  private async refName(root: string, name: string, prefix: string): Promise<string> {
    this.safeRef(name)
    this.checked(await this.runner.run(['check-ref-format', `${prefix}${name}`], root), 'Validate reference name')
    return name
  }

  /** Repository root, or a throw for callers whose operation only makes sense inside one. */
  private async requireRepo(cwd: string): Promise<string> {
    const root = await this.getRepoRoot(cwd)
    if (!root) throw new Error('当前目录不是 Git 仓库')
    return root
  }

  /**
   * A repository-relative path, validated. Git commands that take paths use `--`,
   * but a value like `../../elsewhere` would still reach outside the worktree.
   */
  private repoPath(root: string, value: string): string {
    if (typeof value !== 'string' || !value) throw new Error('Invalid path')
    if (/[\0\r\n]/.test(value)) throw new Error('Invalid path')
    const normalized = value.replace(/\\/g, '/')
    if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) throw new Error('路径必须是仓库内的相对路径')
    const resolved = resolve(root, normalized)
    const rel = relative(root, resolved)
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('路径超出仓库范围')
    return rel.replace(/\\/g, '/')
  }

  /** File-list requests name literal files, never Git wildcard/pathspec patterns. */
  private literalPathspec(path: string): string {
    return `:(literal)${path}`
  }

  /** The paths Git actually knows about, so a request cannot name an arbitrary file. */
  private async knownPaths(root: string): Promise<{ tracked: Set<string>; untracked: Set<string> }> {
    const [tracked, untracked] = await Promise.all([
      this.runner.run(['ls-files', '-z'], root),
      this.runner.run(['ls-files', '--others', '--exclude-standard', '-z'], root),
    ])
    return {
      tracked: new Set(tracked.stdout.split('\0').filter(Boolean)),
      untracked: new Set(untracked.stdout.split('\0').filter(Boolean)),
    }
  }

  private async assertPaths(root: string, values: unknown, allowUntracked: boolean): Promise<string[]> {
    if (!Array.isArray(values) || values.length === 0) throw new Error('未选择任何文件')
    if (values.length > 2000) throw new Error('一次操作的文件过多')
    const paths = values.map(value => this.repoPath(root, String(value)))
    const known = await this.knownPaths(root)
    for (const path of paths) {
      if (known.tracked.has(path)) continue
      if (allowUntracked && known.untracked.has(path)) continue
      throw new Error(`Git 不认识这个路径：${path}`)
    }
    return [...new Set(paths)]
  }

  private async gitDir(root: string): Promise<string> {
    return this.checked(await this.runner.run(['rev-parse', '--absolute-git-dir'], root), 'Resolve git directory').stdout.trim()
  }

  /** Runs a mutating command and reports Git's own message instead of throwing. */
  private async action(args: string[], root: string, options: { timeoutMs?: number; stdin?: string; includeStderr?: boolean } = {}): Promise<ActionResult> {
    const result = await this.runner.run(args, root, undefined, { timeoutMs: options.timeoutMs, stdin: options.stdin })
    if (result.exitCode === 0) {
      // `git worktree prune --verbose` prints what it removed on stderr, so some
      // callers need that stream as the report instead of stdout.
      const output = [result.stdout, options.includeStderr ? result.stderr : ''].join('\n').trim()
      return { ok: true, output: output || undefined }
    }
    return { ok: false, error: (result.stderr.trim() || result.stdout.trim()) || `git ${args[0]} 失败（退出码 ${result.exitCode}）` }
  }

  /** Wraps a mutation so a validation failure becomes a reported error, not a throw. */
  private async guarded<T extends ActionResult>(run: () => Promise<T>): Promise<T> {
    try { return await run() } catch (error) { return { ok: false, error: message(error) } as T }
  }

  // ------------------------------------------------------------------- reads

  async isGitRepo(cwd: string): Promise<boolean> {
    try {
      if (!cwd || typeof cwd !== 'string') return false
      const dir = resolve(cwd.trim().replace(/^["']|["']$/g, ''))
      if (!existsSync(dir)) return false
      const result = await this.runner.run(['rev-parse', '--is-inside-work-tree'], dir)
      return result.exitCode === 0 && result.stdout.trim() === 'true'
    } catch { return false }
  }

  async getRepoRoot(cwd: string): Promise<string | null> {
    try {
      if (!cwd || typeof cwd !== 'string') return null
      const dir = resolve(cwd.trim().replace(/^["']|["']$/g, ''))
      const result = await this.runner.run(['rev-parse', '--show-toplevel'], dir)
      return result.exitCode === 0 && result.stdout.trim() ? resolve(result.stdout.trim()) : null
    } catch { return null }
  }

  async status(cwd: string): Promise<RepoStatus> {
    if (!await this.isGitRepo(cwd)) return { isGit: false, root: '', branch: '', head: '', dirtyFiles: 0, untrackedFiles: 0, conflicts: 0, operationInProgress: false, stashCount: 0, detached: false, operation: null, entries: [], revision: 'not-git' }
    const root = (await this.getRepoRoot(cwd)) || cwd
    const result = this.checked(await this.runner.run(['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'], root), 'Status')
    const status = parseStatusV2(result.stdout, root)
    const gitDir = await this.gitDir(root)
    const markers = ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'sequencer', 'BISECT_LOG', 'applying']
    const activeMarkers = markers.filter(marker => existsSync(join(gitDir, marker)))
    status.operation = parseOperation(activeMarkers)
    status.operationInProgress = status.operation !== null

    // Counts and mtimes are not sufficient: a second edit to an already-dirty file must refresh clients.
    // Include staged object IDs, dirty/untracked file digests, refs/status, worktrees and operation markers.
    // Do not scan every clean tracked file on each SSE poll.
    const hash = createHash('sha256').update(result.stdout).update(JSON.stringify(activeMarkers))
    const paths = this.checked(await this.runner.run(['ls-files', '-z', '--modified', '--deleted', '--others', '--exclude-standard'], root), 'List files')
    const dirtyPaths = [...new Set(paths.stdout.split('\0').filter(Boolean))].sort()
    for (const path of dirtyPaths) hash.update(JSON.stringify(path)).update(await this.fileDigest(root, path))
    for (const stale of [...this.digests.keys()]) if (!dirtyPaths.includes(stale)) this.digests.delete(stale)
    const index = this.checked(await this.runner.run(['ls-files', '--stage', '-z'], root), 'Read index')
    hash.update(index.stdout)
    const refs = this.checked(await this.runner.run(['for-each-ref', '--format=%(refname)%00%(objectname)%00%(upstream)', 'refs/heads', 'refs/remotes'], root), 'Read refs')
    hash.update(refs.stdout)
    const worktrees = this.checked(await this.runner.run(['worktree', 'list', '--porcelain', '-z'], root), 'List worktrees')
    hash.update(worktrees.stdout)
    status.revision = hash.digest('hex')
    return status
  }

  /** Content-sensitive digest, memoized on the file's stat signature. */
  private async fileDigest(root: string, path: string): Promise<string> {
    const fullPath = join(root, path)
    try {
      const info = await lstat(fullPath, { bigint: true })
      const signature = `${info.mode}:${info.size}:${info.mtimeNs}:${info.ctimeNs}:${info.ino}`
      const cached = this.digests.get(path)
      if (cached?.signature === signature) return cached.digest
      const hash = createHash('sha256').update(signature)
      if (info.isSymbolicLink()) hash.update(await readlink(fullPath))
      else if (info.isFile()) hash.update(await readFile(fullPath))
      const digest = hash.digest('hex')
      if (this.digests.size < 5000) this.digests.set(path, { signature, digest })
      return digest
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      return 'missing'
    }
  }

  async branches(cwd: string): Promise<BranchesView> {
    if (!await this.isGitRepo(cwd)) return { current: '', dirtyFiles: 0, branches: [] }
    const root = (await this.getRepoRoot(cwd)) || cwd
    const [result, status] = await Promise.all([
      this.runner.run(['for-each-ref', '--format=%(refname)%00%(objectname)%00%(upstream:short)%00%(upstream:track)%00%(HEAD)%00%(contents:subject)', 'refs/heads', 'refs/remotes'], root),
      this.status(root),
    ])
    if (result.exitCode !== 0) {
      // Older Git builds may not know a format atom; fall back to the plain listing.
      const plain = this.checked(await this.runner.run(['branch', '-a', '--no-color'], root), 'List branches')
      return { current: status.branch, dirtyFiles: status.dirtyFiles, branches: parseBranches(plain.stdout) }
    }
    return { current: status.branch, dirtyFiles: status.dirtyFiles, branches: parseForEachRefBranches(result.stdout, status.branch) }
  }

  async switchBranch(cwd: string, branch: string): Promise<SwitchResult> {
    if (!await this.isGitRepo(cwd)) return { ok: false, error: { code: 'not-git', message: 'Not a git repository' } }
    const root = (await this.getRepoRoot(cwd)) || cwd
    try {
      await this.branchName(root, branch)
      const refsResult = this.checked(await this.runner.run(['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes'], root), 'Resolve branch')
      const refs = new Set(refsResult.stdout.split('\n').filter(Boolean))
      let name = branch
      let args: string[]
      // Exact local name wins (including a legitimate local branch named origin/topic).
      if (refs.has(`refs/heads/${branch}`)) args = ['switch', '--', branch]
      else if (refs.has(`refs/remotes/${branch}`)) {
        name = await this.branchName(root, branch.slice(branch.indexOf('/') + 1))
        if (refs.has(`refs/heads/${name}`)) throw new Error(`Local branch "${name}" already exists; select it explicitly instead of remote "${branch}"`)
        args = ['switch', '--track', '-c', name, '--', `refs/remotes/${branch}`]
      } else throw new Error(`Branch not found: ${branch}`)
      const result = await this.runner.run(args, root)
      // Never fall back to checkout: checkout interprets a failed branch name as a path and restores it.
      return result.exitCode === 0 ? { ok: true, branch: name } : { ok: false, error: { code: 'switch-failed', message: result.stderr.trim() || 'Failed to switch branch' } }
    } catch (error) { return { ok: false, error: { code: 'switch-failed', message: message(error) } } }
  }

  async createBranch(cwd: string, name: string, base?: string): Promise<SwitchResult> {
    if (!await this.isGitRepo(cwd)) return { ok: false, error: { code: 'not-git', message: 'Not a git repository' } }
    const root = (await this.getRepoRoot(cwd)) || cwd
    try {
      await this.branchName(root, name)
      const args = ['switch', '-c', name]
      if (base !== undefined && base !== '') args.push(await this.resolveCommit(root, base))
      const result = await this.runner.run(args, root)
      return result.exitCode === 0 ? { ok: true, branch: name } : { ok: false, error: { code: 'create-failed', message: result.stderr.trim() || 'Failed to create branch' } }
    } catch (error) { return { ok: false, error: { code: 'create-failed', message: message(error) } } }
  }

  /** Deletes a local branch. `force` maps to `-D`, which discards unmerged commits. */
  async deleteBranch(cwd: string, name: string, force = false): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      await this.branchName(root, name)
      const current = (await this.status(root)).branch
      if (current === name) return { ok: false, error: '不能删除当前所在的分支' }
      return this.action(['branch', force ? '-D' : '-d', '--', name], root)
    })
  }

  async diff(cwd: string, base?: string, target?: string, options: DiffOptions = {}): Promise<DiffView> {
    if (!await this.isGitRepo(cwd)) return { base: '', target: '', totalInsertions: 0, totalDeletions: 0, files: [] }
    const root = (await this.getRepoRoot(cwd)) || cwd
    const context = clamp(Number.isFinite(options.context) ? Number(options.context) : 3, 0, 50)
    const common = ['--no-ext-diff', '--no-textconv', '--no-color', '--src-prefix=a/', '--dst-prefix=b/']
    if (options.ignoreWhitespace) common.push('-w')
    const paths = options.paths?.length ? options.paths.map(path => this.repoPath(root, path)) : []

    const mode = options.mode ?? (target && target !== 'working-tree' ? 'range' : 'worktree')
    let label: { base: string; target: string }
    /** Revision arguments shared by the patch and the numstat call. */
    let revisions: string[]
    let includeUntracked = false

    if (mode === 'single') {
      const hash = await this.resolveCommit(root, target || base || 'HEAD')
      // `<commit>^!` is the commit against its first parent, and against the empty tree at a root.
      revisions = [`${hash}^!`]
      label = { base: `${hash.slice(0, 7)}^`, target: hash }
    } else if (mode === 'range') {
      const baseHash = await this.resolveCommit(root, base && base !== 'HEAD' ? base : 'HEAD')
      const targetHash = await this.resolveCommit(root, target!)
      revisions = [`${baseHash}...${targetHash}`]
      label = { base: base || 'HEAD', target: target! }
    } else if (mode === 'staged') {
      revisions = ['--cached', await this.headOrEmptyTree(root)]
      label = { base: 'HEAD', target: 'index' }
    } else if (mode === 'unstaged') {
      // No revision arguments means index against worktree, which is the exact patch
      // `git apply --cached` (and `--reverse`) expects for hunk-level staging.
      revisions = []
      label = { base: 'index', target: 'working-tree' }
      includeUntracked = options.includeUntracked !== false && paths.length === 0
    } else {
      // No explicit base means "everything not in the last commit": the index is
      // included, and a repository without a commit yet compares against the empty tree.
      const defaultComparison = base === undefined || base === '' || base === 'HEAD'
      const revision = defaultComparison ? await this.headOrEmptyTree(root) : await this.resolveCommit(root, base!)
      revisions = [revision]
      label = { base: base || 'HEAD', target: 'working-tree' }
      // Untracked files are not part of any commit or the index, so they only belong in
      // the default comparison, and only when the whole tree was asked for.
      includeUntracked = options.includeUntracked !== false && defaultComparison && paths.length === 0
    }

    const pathspec = ['--', ...paths.map(path => this.literalPathspec(path))]
    const [patch, stats] = await Promise.all([
      this.runner.run(['diff', ...common, `-U${context}`, ...revisions, ...pathspec], root),
      this.runner.run(['diff', ...common, '--numstat', '-z', ...revisions, ...pathspec], root),
    ])
    this.checked(patch, 'Diff')
    // A numstat failure still leaves the patch usable; the panel then shows counts it can trust.
    const parsed = parseUnifiedDiff(patch.stdout, stats.exitCode === 0 ? stats.stdout : '')
    parsed.base = label.base
    parsed.target = label.target
    if (includeUntracked) await this.appendUntracked(root, parsed, paths)
    return parsed
  }

  /** HEAD's commit, or the empty tree when the branch has no commit yet. */
  private async headOrEmptyTree(root: string): Promise<string> {
    const head = await this.runner.run(['rev-parse', '--verify', '--end-of-options', 'HEAD^{commit}'], root)
    if (head.exitCode === 0) return head.stdout.trim()
    return this.checked(await this.runner.run(['hash-object', '-t', 'tree', '--stdin'], root), 'Empty tree').stdout.trim()
  }

  private async appendUntracked(root: string, parsed: DiffView, paths: string[]): Promise<void> {
    const listed = this.checked(await this.runner.run(['ls-files', '--others', '--exclude-standard', '-z'], root), 'List untracked files')
    const wanted = new Set(paths)
    for (const path of listed.stdout.split('\0').filter(Boolean)) {
      if (wanted.size > 0 && !wanted.has(path)) continue
      const fullPath = join(root, path)
      const info = await lstat(fullPath)
      // `ls-files --others` can return FIFOs and other special files. Reading one
      // can block forever (or stream unbounded data); only regular files and links
      // have meaningful inline diff content.
      if (!info.isFile() && !info.isSymbolicLink()) continue
      if (info.size > MAX_UNTRACKED_READ) {
        parsed.files.push({ path, status: 'untracked', insertions: 0, deletions: 0, binary: true, hunks: [], rawPatch: `Binary file ${path}\n` })
        continue
      }
      const bytes = info.isSymbolicLink() ? Buffer.from(await readlink(fullPath)) : await readFile(fullPath)
      const binary = bytes.subarray(0, 8000).includes(0)
      const content = bytes.toString('utf8')
      const lines = binary || bytes.length === 0 ? [] : content.replace(/\n$/, '').split('\n')
      const count = lines.length
      parsed.totalInsertions += count
      parsed.files.push({
        path, status: 'untracked', insertions: count, deletions: 0, binary,
        hunks: count ? [{ header: `@@ -0,0 +1,${count} @@`, oldStart: 0, oldLines: 0, newStart: 1, newLines: count, lines: lines.map((content, index) => ({ type: 'add', newNum: index + 1, content })) }] : [],
        rawPatch: binary ? `Binary file ${path}\n` : content,
      })
    }
  }

  /** The four lists the changes panel renders, with per-file line counts. */
  async changes(cwd: string): Promise<ChangeList> {
    const empty: ChangeList = { entries: [], staged: 0, unstaged: 0, conflicts: 0, untracked: 0, totalInsertions: 0, totalDeletions: 0 }
    if (!await this.isGitRepo(cwd)) return empty
    const root = (await this.getRepoRoot(cwd)) || cwd
    const status = await this.status(root)
    const entries = status.entries ?? []
    const [staged, worktree] = await Promise.all([
      this.runner.run(['diff', '--numstat', '-z', '--no-ext-diff', '--no-color', '--cached', '--'], root),
      this.runner.run(['diff', '--numstat', '-z', '--no-ext-diff', '--no-color', '--'], root),
    ])
    const untracked = await this.untrackedCounts(root, entries.filter(entry => entry.untracked).map(entry => entry.path))
    return buildChangeList({
      entries,
      stagedNumstat: staged.exitCode === 0 ? staged.stdout : '',
      worktreeNumstat: worktree.exitCode === 0 ? worktree.stdout : '',
      untracked,
    })
  }

  private async untrackedCounts(root: string, paths: string[]): Promise<Map<string, UntrackedCount>> {
    const counts = new Map<string, UntrackedCount>()
    for (const path of paths.slice(0, 1000)) {
      try {
        const fullPath = join(root, path)
        const info = await lstat(fullPath)
        if (!info.isFile() && !info.isSymbolicLink()) continue
        if (info.size > MAX_UNTRACKED_READ) { counts.set(path, { insertions: 0, deletions: 0, binary: true }); continue }
        const bytes = info.isSymbolicLink() ? Buffer.from(await readlink(fullPath)) : await readFile(fullPath)
        if (bytes.subarray(0, 8000).includes(0)) { counts.set(path, { insertions: 0, deletions: 0, binary: true }); continue }
        const text = bytes.toString('utf8')
        // A file containing exactly `\n` is one empty line, not zero lines.
        const insertions = bytes.length === 0 ? 0 : text.split('\n').length - Number(text.endsWith('\n'))
        counts.set(path, { insertions, deletions: 0, binary: false })
      } catch {
        // The file disappeared between the status call and this read.
      }
    }
    return counts
  }

  async worktrees(cwd: string): Promise<WorktreeItem[]> {
    if (!await this.isGitRepo(cwd)) return []
    const root = (await this.getRepoRoot(cwd)) || cwd
    return parseWorktrees(this.checked(await this.runner.run(['worktree', 'list', '--porcelain', '-z'], root), 'List worktrees').stdout, root)
  }

  async log(cwd: string, maxCount = 50, options: { path?: string; all?: boolean; skip?: number } = {}): Promise<GitGraphCommit[]> {
    if (!await this.isGitRepo(cwd)) return []
    if (!Number.isSafeInteger(maxCount) || maxCount < 1 || maxCount > 10000) throw new Error('Invalid log limit')
    const root = (await this.getRepoRoot(cwd)) || cwd
    const args = ['log', `-n${maxCount}`, '-z', '--format=%H%x00%h%x00%s%x00%an%x00%cr%x00%P%x00%D', '--no-color']
    if (options.all) args.push('--all')
    if (options.skip) args.push(`--skip=${Math.max(0, Math.trunc(options.skip))}`)
    if (options.path) args.push('--follow', '--', this.repoPath(root, options.path))
    const result = await this.runner.run(args, root)
    if (result.exitCode !== 0) {
      const head = await this.runner.run(['rev-parse', '--verify', 'HEAD'], root)
      if (head.exitCode !== 0) return []
      this.checked(result, 'Log')
    }
    return parseLog(result.stdout)
  }

  async commitDetail(cwd: string, ref: string): Promise<CommitDetail> {
    const root = await this.requireRepo(cwd)
    const hash = await this.resolveCommit(root, ref)
    const format = '%H%x00%h%x00%s%x00%an%x00%ae%x00%cn%x00%cr%x00%cI%x00%P%x00%D%x00%b'
    const [meta, names, numstat] = await Promise.all([
      this.runner.run(['show', '-s', '-z', `--format=${format}`, '--no-color', hash], root),
      this.runner.run(['show', '-z', '--format=', '--name-status', '-m', '--first-parent', '--no-color', hash], root),
      this.runner.run(['show', '-z', '--format=', '--numstat', '-m', '--first-parent', '--no-color', hash], root),
    ])
    this.checked(meta, 'Read commit')
    const fields = meta.stdout.split('\0').map(field => field.replace(/^\n+/, ''))
    const [fullHash = hash, shortHash = hash.slice(0, 7), subject = '', author = '', authorEmail = '', committer = '', date = '', commitDate = '', parents = '', refs = '', body = ''] = fields
    const files = mergeCommitFiles(parseNameStatus(names.exitCode === 0 ? names.stdout : ''), numstat.exitCode === 0 ? numstat.stdout : '')
    return {
      hash: fullHash || hash, shortHash, subject, author, authorEmail, committer, commitDate,
      date, parents: parents.split(' ').filter(Boolean), refs: refs.split(',').map(value => value.trim()).filter(Boolean),
      body: body.trim(), files,
      totalInsertions: files.reduce((total, file) => total + file.insertions, 0),
      totalDeletions: files.reduce((total, file) => total + file.deletions, 0),
    }
  }

  async fileHistory(cwd: string, path: string, maxCount = 50): Promise<FileHistoryEntry[]> {
    const root = await this.requireRepo(cwd)
    const relativePath = this.repoPath(root, path)
    const limit = clamp(Math.trunc(maxCount) || 50, 1, 500)
    const result = await this.runner.run(['log', `-n${limit}`, '-z', '--format=%H%x00%h%x00%s%x00%an%x00%cr', '--no-color', '--follow', '--', this.literalPathspec(relativePath)], root)
    if (result.exitCode !== 0) return []
    return parseFileHistory(result.stdout)
  }

  async blame(cwd: string, path: string, maxLines = 5000): Promise<BlameView> {
    const root = await this.requireRepo(cwd)
    const relativePath = this.repoPath(root, path)
    const limit = clamp(Math.trunc(maxLines) || 5000, 1, 20000)
    // Porcelain output is color-free by definition; `--no-color` is ambiguous in some Git builds.
    // `blame` takes a single filename (not pathspec magic), so keep the validated path literal.
    const result = await this.runner.run(['blame', '--line-porcelain', '--', relativePath], root)
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || '无法读取该文件的逐行归属')
    const all = parseBlamePorcelain(result.stdout)
    return { path: relativePath, lines: all.slice(0, limit), truncated: all.length > limit, totalLines: all.length }
  }

  async reflog(cwd: string, maxCount = 100): Promise<ReflogEntry[]> {
    if (!await this.isGitRepo(cwd)) return []
    const root = (await this.getRepoRoot(cwd)) || cwd
    const limit = clamp(Math.trunc(maxCount) || 100, 1, 1000)
    // The format must not end with `%x00`: `-z` already terminates the record, and a
    // trailing field separator would put an empty field between records.
    const result = await this.runner.run(['reflog', `-n${limit}`, '-z', '--format=%H%x00%h%x00%gd%x00%gs%x00%cr', '--no-color'], root)
    if (result.exitCode !== 0) return []
    return parseReflog(result.stdout)
  }

  async stashes(cwd: string): Promise<StashEntry[]> {
    if (!await this.isGitRepo(cwd)) return []
    const root = (await this.getRepoRoot(cwd)) || cwd
    // As in `reflog()`: no trailing `%x00` before the `-z` terminator.
    const result = await this.runner.run(['stash', 'list', '-z', '--format=%gd%x00%H%x00%h%x00%gs%x00%cr'], root)
    if (result.exitCode !== 0) return []
    return parseStashList(result.stdout)
  }

  async stashShow(cwd: string, index: number): Promise<DiffView> {
    const root = await this.requireRepo(cwd)
    const selector = this.stashSelector(index)
    const hash = await this.resolveCommit(root, selector)
    const common = ['--no-ext-diff', '--no-textconv', '--no-color', '--src-prefix=a/', '--dst-prefix=b/']
    // `stash@{n}^1` is the commit the stash was taken from; untracked files in an
    // `-u` stash live in a third parent and are deliberately not part of this view.
    const [patch, stats] = await Promise.all([
      this.runner.run(['diff', ...common, '-U3', `${hash}^1`, hash, '--'], root),
      this.runner.run(['diff', ...common, '--numstat', '-z', `${hash}^1`, hash, '--'], root),
    ])
    this.checked(patch, 'Show stash')
    const parsed = parseUnifiedDiff(patch.stdout, stats.exitCode === 0 ? stats.stdout : '')
    parsed.base = `${selector}^1`
    parsed.target = selector
    return parsed
  }

  private stashSelector(index: number): string {
    if (!Number.isSafeInteger(index) || index < 0 || index > 999) throw new Error('Invalid stash index')
    return `stash@{${index}}`
  }

  async tags(cwd: string): Promise<TagItem[]> {
    if (!await this.isGitRepo(cwd)) return []
    const root = (await this.getRepoRoot(cwd)) || cwd
    const format = '%(refname:short)%00%(objectname)%00%(objecttype)%00%(*objectname)%00%(contents:subject)%00%(creatordate:relative)'
    const result = await this.runner.run(['tag', '--list', `--format=${format}`], root)
    if (result.exitCode !== 0) return []
    return parseTags(result.stdout)
  }

  async remotes(cwd: string): Promise<RemoteItem[]> {
    if (!await this.isGitRepo(cwd)) return []
    const root = (await this.getRepoRoot(cwd)) || cwd
    const result = await this.runner.run(['remote', '-v'], root)
    if (result.exitCode !== 0) return []
    const remotes = new Map<string, RemoteItem>()
    for (const line of result.stdout.split('\n')) {
      const match = line.match(/^(\S+)\t(\S+)\s+\((fetch|push)\)$/)
      if (!match) continue
      const existing = remotes.get(match[1])
      // The fetch URL is the canonical one; a push URL only matters when it differs.
      if (!existing) remotes.set(match[1], { name: match[1], url: match[2], kind: match[3] })
      else if (match[2] !== existing.url) existing.url = `${existing.url} → ${match[2]}`
    }
    return [...remotes.values()]
  }

  /** The operation left half-applied, with the paths that still conflict. */
  async operationState(cwd: string): Promise<OperationState> {
    const root = await this.requireRepo(cwd)
    const gitDir = await this.gitDir(root)
    const markers = ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'sequencer', 'BISECT_LOG', 'applying']
    const kind = parseOperation(markers.filter(marker => existsSync(join(gitDir, marker))))
    const unmerged = await this.runner.run(['ls-files', '-u', '-z'], root)
    const conflicts = [...new Set(unmerged.stdout.split('\0').filter(Boolean).map(record => record.slice(record.indexOf('\t') + 1)).filter(Boolean))].sort()
    const message = kind ? await this.operationMessage(gitDir, kind) : undefined
    let detail: string | undefined
    try {
      if (kind === 'rebase') detail = (await readFile(join(gitDir, 'rebase-merge', 'head-name'), 'utf8')).trim().replace('refs/heads/', '')
      else if (kind === 'am') detail = (await readFile(join(gitDir, 'rebase-apply', 'head-name'), 'utf8')).trim().replace('refs/heads/', '')
      else if (kind === 'bisect') detail = (await readFile(join(gitDir, 'BISECT_LOG'), 'utf8')).trim().split('\n').pop()?.trim()
      else if (kind === 'merge') detail = (await readFile(join(gitDir, 'MERGE_HEAD'), 'utf8')).trim().slice(0, 7)
      else if (kind === 'cherry-pick' || kind === 'revert') detail = (await readFile(join(gitDir, kind === 'cherry-pick' ? 'CHERRY_PICK_HEAD' : 'REVERT_HEAD'), 'utf8')).trim().slice(0, 7)
    } catch { detail = undefined }
    return { kind, conflicts, message, canContinue: kind !== null && conflicts.length === 0, detail }
  }

  private async operationMessage(gitDir: string, kind: OperationState['kind']): Promise<string | undefined> {
    const candidates = kind === 'rebase' ? [join(gitDir, 'rebase-merge', 'message'), join(gitDir, 'MERGE_MSG')]
      : kind === 'am' ? [join(gitDir, 'rebase-apply', 'final-commit')]
        : [join(gitDir, 'MERGE_MSG')]
    for (const candidate of candidates) {
      try {
        const text = (await readFile(candidate, 'utf8')).trim()
        // Git's own comments start with '#'; they are not part of the message.
        const message = text.split('\n').filter(line => !line.startsWith('#')).join('\n').trim()
        if (message) return message
      } catch { /* the marker for this candidate is absent */ }
    }
    return undefined
  }

  /** Conflict markers for every unmerged path, so both sides can be compared and resolved. */
  async conflicts(cwd: string): Promise<ConflictFile[]> {
    const root = await this.requireRepo(cwd)
    const unmerged = await this.runner.run(['ls-files', '-u', '-z'], root)
    const stages = new Map<string, string[]>()
    for (const record of unmerged.stdout.split('\0').filter(Boolean)) {
      const tab = record.indexOf('\t')
      if (tab < 0) continue
      const stage = record.slice(0, tab).split(' ')[2]?.trim()
      const path = record.slice(tab + 1)
      stages.set(path, [...(stages.get(path) ?? []), stage].filter(Boolean))
    }
    const files: ConflictFile[] = []
    for (const [path, pathStages] of [...stages.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      let hasMarkers = false
      let binary = false
      let lines: ConflictFile['lines'] = []
      try {
        const bytes = await readFile(join(root, path))
        binary = bytes.subarray(0, 8000).includes(0)
        if (!binary) {
          const parsed = parseConflictContent(bytes.toString('utf8'))
          hasMarkers = parsed.hasMarkers
          lines = parsed.lines
        }
      } catch {
        // Deleted on one side, or unreadable: the stage list still tells the story.
      }
      files.push({ path, hasMarkers, lines, stages: pathStages, binary: binary || undefined })
    }
    return files
  }

  // --------------------------------------------------------------- mutations

  async stage(cwd: string, paths: unknown): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      const safe = await this.assertPaths(root, paths, true)
      // `-A` records deletions and additions alike, so one call covers every status letter.
      return this.action(['add', '-A', '--', ...safe.map(path => this.literalPathspec(path))], root)
    })
  }

  async stageAll(cwd: string): Promise<ActionResult> {
    return this.guarded(async () => this.action(['add', '-A', '--'], await this.requireRepo(cwd)))
  }

  async unstage(cwd: string, paths: unknown): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      const safe = await this.assertPaths(root, paths, false)
      const head = await this.runner.run(['rev-parse', '--verify', 'HEAD'], root)
      // `restore --staged` needs a HEAD to restore from; on an unborn branch the
      // index entry is removed instead.
      const pathspec = safe.map(path => this.literalPathspec(path))
      return head.exitCode === 0
        ? this.action(['restore', '--staged', '--', ...pathspec], root)
        : this.action(['rm', '--cached', '-r', '--quiet', '--', ...pathspec], root)
    })
  }

  async unstageAll(cwd: string): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      const head = await this.runner.run(['rev-parse', '--verify', 'HEAD'], root)
      return head.exitCode === 0
        ? this.action(['reset', '--quiet', 'HEAD', '--'], root)
        : this.action(['rm', '--cached', '-r', '--quiet', '--', '.'], root)
    })
  }

  /** Throws away worktree changes; `staged` also resets the index entry to HEAD. */
  async discard(cwd: string, paths: unknown, options: { staged?: boolean } = {}): Promise<DiscardResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      const safe = await this.assertPaths(root, paths, false)
      const staged = options.staged === true
      const pathspec = safe.map(path => this.literalPathspec(path))
      const args = staged
        ? ['restore', '--source=HEAD', '--staged', '--worktree', '--', ...pathspec]
        : ['restore', '--worktree', '--', ...pathspec]
      const result = await this.action(args, root)
      return result.ok ? { ...result, discarded: safe } : result
    })
  }

  /** Deletes untracked files (which `git restore` cannot undo). */
  async deleteUntracked(cwd: string, paths: unknown): Promise<DiscardResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      const safe = await this.assertPaths(root, paths, true)
      const known = await this.knownPaths(root)
      const discarded: string[] = []
      for (const path of safe) {
        if (known.tracked.has(path)) return { ok: false, error: `该文件已被 Git 跟踪，请使用「撤销更改」：${path}` }
        await rm(join(root, path), { recursive: true, force: true })
        discarded.push(path)
      }
      return { ok: true, discarded }
    })
  }

  /**
   * Appends paths to `.gitignore` (or `.git/info/exclude` when `local`), which is the
   * only way to make an untracked file stop reappearing. Existing entries are left
   * alone so a second click is a no-op rather than a duplicate line.
   */
  async addToIgnore(cwd: string, paths: unknown, options: { local?: boolean } = {}): Promise<ActionResult & { added?: string[]; skipped?: string[] }> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      const safe = await this.assertPaths(root, paths, true)
      const target = options.local ? join(await this.gitDir(root), 'info', 'exclude') : join(root, '.gitignore')
      let existing = ''
      try { existing = await readFile(target, 'utf8') } catch { existing = '' }
      const lines = new Set(existing.split(/\r?\n/).map(line => line.trim()))
      const added = safe.filter(path => !lines.has(path) && !lines.has(`/${path}`))
      const skipped = safe.filter(path => !added.includes(path))
      if (!added.length) return { ok: true, added, skipped }
      const prefix = existing && !existing.endsWith('\n') ? '\n' : ''
      const header = existing ? '' : '# 由 DSH Git 面板添加\n'
      await mkdir(dirname(target), { recursive: true })
      await appendFile(target, `${prefix}${header}${added.join('\n')}\n`, 'utf8')
      return { ok: true, added, skipped }
    })
  }

  /**
   * Applies a patch to the index (or reverse-applies it), which is how a single
   * hunk is staged or unstaged. `git apply` refuses paths outside the worktree.
   */
  async applyPatch(cwd: string, patch: unknown, options: { reverse?: boolean; cached?: boolean } = {}): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      if (typeof patch !== 'string' || !patch.trim()) throw new Error('补丁内容为空')
      if (Buffer.byteLength(patch, 'utf8') > MAX_PATCH_BYTES) throw new Error('补丁过大')
      if (!/^diff --git /m.test(patch)) throw new Error('补丁格式无法识别')
      const args = ['apply', '--recount', '--whitespace=nowarn']
      if (options.cached !== false) args.push('--cached')
      if (options.reverse) args.push('--reverse')
      args.push('-')
      return this.action(args, root, { stdin: patch })
    })
  }

  async createCommit(cwd: string, options: CommitOptions): Promise<CommitResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      const amend = options.amend === true
      const text = typeof options.message === 'string' ? options.message : ''
      if (!amend && !text.trim()) throw new Error('提交信息不能为空')
      // Reusing the previous message means `--amend --no-edit`; there is no way to
      // keep it while also piping an empty message through `-F -`.
      const keepMessage = amend && !text.trim()
      const args = ['commit']
      if (keepMessage) args.push('--amend', '--no-edit')
      else {
        args.push('-F', '-')
        if (amend) args.push('--amend')
      }
      if (options.signoff) args.push('--signoff')
      if (options.all) args.push('--all')
      const result = await this.action(args, root, { stdin: keepMessage ? undefined : `${text.replace(/\r\n/g, '\n').trimEnd()}\n` })
      if (!result.ok) return result
      const head = await this.runner.run(['log', '-1', '-z', '--format=%H%x00%h%x00%s', '--no-color'], root)
      const [hash, shortHash, summary] = head.exitCode === 0 ? head.stdout.split('\0') : []
      return { ...result, hash: hash || undefined, shortHash: shortHash || undefined, summary: summary || undefined }
    })
  }

  /** The message of the last commit, used to prefill an amend. */
  async lastCommitMessage(cwd: string): Promise<string> {
    const root = await this.requireRepo(cwd)
    const result = await this.runner.run(['log', '-1', '--format=%B', '--no-color'], root)
    return result.exitCode === 0 ? result.stdout.trim() : ''
  }

  /**
   * One file's bytes from the worktree, for the inline image preview.
   *
   * Read-only, size-bounded, and restricted to paths Git already knows about, so a crafted
   * request cannot turn this into a way to read arbitrary files off the disk.
   */
  async readBlob(cwd: string, file: unknown): Promise<{ ok: boolean; bytes?: Buffer; type?: string; error?: string }> {
    try {
      const root = await this.requireRepo(cwd)
      const [safe] = await this.assertPaths(root, [file], true)
      const fullPath = join(root, ...safe.split('/'))
      const info = await lstat(fullPath)
      if (!info.isFile()) return { ok: false, error: '这个路径不是一个文件' }
      const [realRoot, realFile] = await Promise.all([realpath(root), realpath(fullPath)])
      const resolvedPath = relative(realRoot, realFile)
      if (!resolvedPath || resolvedPath === '..' || resolvedPath.startsWith(`..${sep}`) || isAbsolute(resolvedPath)) {
        return { ok: false, error: '路径超出仓库范围' }
      }
      if (info.size > MAX_BLOB_BYTES) return { ok: false, error: `文件超过 ${Math.round(MAX_BLOB_BYTES / 1_000_000)}MB，无法内联预览` }
      return { ok: true, bytes: await readFile(realFile), type: blobType(safe) }
    } catch (error) {
      return { ok: false, error: message(error) }
    }
  }

  async resolveConflict(cwd: string, path: unknown, side: 'ours' | 'theirs'): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      if (side !== 'ours' && side !== 'theirs') throw new Error('Invalid conflict side')
      const safe = await this.assertPaths(root, [path], false)
      const pathspec = safe.map(path => this.literalPathspec(path))
      const checkout = await this.action(['checkout', `--${side}`, '--', ...pathspec], root)
      if (!checkout.ok) return checkout
      return this.action(['add', '-A', '--', ...safe.map(path => this.literalPathspec(path))], root)
    })
  }

  // ------------------------------------------------------- history rewriting

  async merge(cwd: string, ref: string): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      return this.action(['merge', '--no-edit', await this.resolveCommit(root, ref)], root)
    })
  }

  async rebase(cwd: string, ref: string): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      return this.action(['rebase', await this.resolveCommit(root, ref)], root)
    })
  }

  async cherryPick(cwd: string, ref: string): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      return this.action(['cherry-pick', await this.resolveCommit(root, ref)], root)
    })
  }

  async revert(cwd: string, ref: string): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      return this.action(['revert', '--no-edit', await this.resolveCommit(root, ref)], root)
    })
  }

  /** `continue` / `abort` / `skip` for whichever operation is in progress. */
  async operationStep(cwd: string, step: 'continue' | 'abort' | 'skip'): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      const state = await this.operationState(root)
      if (!state.kind) return { ok: false, error: '当前没有进行中的操作' }
      const command = state.kind === 'am' ? 'am' : state.kind
      if (command === 'apply' || command === 'bisect') return { ok: false, error: `不支持对 ${state.kind} 执行该操作` }
      if (step === 'skip' && command === 'merge') return { ok: false, error: '合并无法跳过，请继续或中止' }
      if (step === 'continue' && state.conflicts.length > 0) return { ok: false, error: '仍有未解决的冲突文件' }
      const flag = step === 'continue' ? '--continue' : step === 'abort' ? '--abort' : '--skip'
      return this.action([command, flag], root)
    })
  }

  /** Moves the branch back to a previous point, keeping the worktree (soft/mixed only). */
  async reset(cwd: string, ref: string, mode: 'soft' | 'mixed' = 'soft'): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      if (mode !== 'soft' && mode !== 'mixed') throw new Error('Unsupported reset mode')
      return this.action(['reset', `--${mode}`, await this.resolveCommit(root, ref)], root)
    })
  }

  /** Undoes the last commit, leaving its content staged. */
  async undoLastCommit(cwd: string): Promise<CommitResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      const parent = await this.runner.run(['rev-parse', '--verify', '--quiet', 'HEAD~1^{commit}'], root)
      if (parent.exitCode !== 0) throw new Error('没有可撤销的上一次提交（当前是第一个提交）')
      const undone = await this.runner.run(['log', '-1', '-z', '--format=%h%x00%s', '--no-color'], root)
      const [shortHash, summary] = undone.stdout.split('\0')
      const result = await this.action(['reset', '--soft', 'HEAD~1'], root)
      return result.ok ? { ...result, shortHash, summary, output: result.output || `已撤销提交 ${shortHash}` } : result
    })
  }

  // ------------------------------------------------------------------ remotes

  async fetch(cwd: string, options: { remote?: string; prune?: boolean } = {}): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      const remotes = await this.remotes(root)
      if (remotes.length === 0) return { ok: false, error: '没有配置任何远程仓库' }
      if (options.remote) {
        this.safeRef(options.remote)
        if (!remotes.some(remote => remote.name === options.remote)) throw new Error(`未知的远程仓库：${options.remote}`)
      }
      const args = ['fetch', ...(options.prune !== false ? ['--prune'] : []), ...(options.remote ? [options.remote] : [])]
      return this.action(args, root, { timeoutMs: NETWORK_TIMEOUT_MS })
    })
  }

  async pull(cwd: string, options: { mode?: 'ff-only' | 'rebase' | 'merge'; remote?: string; branch?: string } = {}): Promise<SyncResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      const remotes = await this.remotes(root)
      if (remotes.length === 0) return { ok: false, error: '没有配置任何远程仓库' }
      if (options.remote) {
        this.safeRef(options.remote)
        if (!remotes.some(remote => remote.name === options.remote)) throw new Error(`未知的远程仓库：${options.remote}`)
      }
      if (options.branch) await this.branchName(root, options.branch)
      const mode = options.mode ?? 'ff-only'
      const args = ['pull', mode === 'ff-only' ? '--ff-only' : mode === 'rebase' ? '--rebase' : '--no-rebase']
      if (options.remote) args.push(options.remote)
      if (options.branch) args.push(options.branch)
      const result = await this.action(args, root, { timeoutMs: NETWORK_TIMEOUT_MS })
      return this.withDivergence(root, result)
    })
  }

  async push(cwd: string, options: PushOptions = {}): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      const remotes = await this.remotes(root)
      if (remotes.length === 0) return { ok: false, error: '没有配置任何远程仓库' }
      const status = await this.status(root)
      const branch = options.branch || (status.detached ? '' : status.branch)
      if (!branch) return { ok: false, error: 'HEAD 处于分离状态，请先指定要推送的分支' }
      await this.branchName(root, branch)
      if (options.remote) {
        this.safeRef(options.remote)
        if (!remotes.some(remote => remote.name === options.remote)) throw new Error(`未知的远程仓库：${options.remote}`)
      }
      const remote = options.remote || await this.defaultRemote(root, branch, remotes.map(item => item.name))
      this.safeRef(remote)
      const args = ['push']
      if (options.force === 'with-lease') args.push('--force-with-lease')
      else if (options.force === 'force') args.push('--force')
      if (options.setUpstream) args.push('--set-upstream')
      if (options.tags) args.push('--tags')
      if (options.dryRun) args.push('--dry-run')
      args.push(remote, branch)
      return this.action(args, root, { timeoutMs: NETWORK_TIMEOUT_MS })
    })
  }

  /** The configured upstream's remote, else `origin`, else the only remote there is. */
  private async defaultRemote(root: string, branch: string, names: string[]): Promise<string> {
    const configured = await this.runner.run(['config', '--get', `branch.${branch}.remote`], root)
    const name = configured.stdout.trim()
    if (name && names.includes(name)) return name
    if (names.includes('origin')) return 'origin'
    return names[0]
  }

  private async withDivergence(root: string, result: ActionResult): Promise<SyncResult> {
    const status = await this.status(root)
    return { ...result, ahead: status.ahead, behind: status.behind }
  }

  // ------------------------------------------------------------------- stash

  async stashPush(cwd: string, options: { message?: string; includeUntracked?: boolean; keepIndex?: boolean } = {}): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      const args = ['stash', 'push']
      if (options.includeUntracked) args.push('--include-untracked')
      if (options.keepIndex) args.push('--keep-index')
      if (options.message?.trim()) args.push('-m', options.message.trim())
      const result = await this.action(args, root)
      const text = `${result.output ?? ''}${result.error ?? ''}`
      if (result.ok && /No local changes to save/i.test(text)) return { ok: false, error: '没有可以储藏的改动' }
      return result
    })
  }

  async stashApply(cwd: string, index: number, options: { pop?: boolean } = {}): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      return this.action(['stash', options.pop ? 'pop' : 'apply', this.stashSelector(index)], root)
    })
  }

  async stashDrop(cwd: string, index: number): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      return this.action(['stash', 'drop', this.stashSelector(index)], root)
    })
  }

  // -------------------------------------------------------------------- tags

  async tagCreate(cwd: string, name: string, options: { ref?: string; message?: string } = {}): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      await this.refName(root, name, 'refs/tags/')
      const args = ['tag']
      if (options.message?.trim()) args.push('-a', '-m', options.message.trim())
      args.push('--', name)
      if (options.ref) args.push(await this.resolveCommit(root, options.ref))
      return this.action(args, root)
    })
  }

  async tagDelete(cwd: string, name: string): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      await this.refName(root, name, 'refs/tags/')
      return this.action(['tag', '-d', '--', name], root)
    })
  }

  // ---------------------------------------------------------------- worktree

  async createWorktree(cwd: string, name: string, baseBranch?: string): Promise<{ ok: boolean; path?: string; error?: string }> {
    const root = await this.getRepoRoot(cwd)
    if (!root) return { ok: false, error: 'Not a git repository' }
    try {
      if (typeof name !== 'string' || !name.trim()) throw new Error('Invalid worktree name')
      const sanitizedName = name.replace(/[^a-zA-Z0-9_\-.]/g, '-').toLowerCase()
      const branch = await this.branchName(root, `wt/${sanitizedName}`)
      const targetDir = resolve(root, '..', `.dsh-wt-${sanitizedName}`)
      const args = ['worktree', 'add', '-b', branch, '--', targetDir]
      if (baseBranch !== undefined) args.push(await this.resolveCommit(root, baseBranch))
      const result = await this.runner.run(args, root)
      return result.exitCode === 0 ? { ok: true, path: targetDir } : { ok: false, error: result.stderr.trim() || 'Failed to create worktree' }
    } catch (error) { return { ok: false, error: message(error) } }
  }

  /** Resolves a worktree argument against the registered worktrees only. */
  private async registeredWorktree(root: string, worktreePath: string): Promise<string> {
    if (typeof worktreePath !== 'string' || !worktreePath) throw new Error('Invalid worktree path')
    const wanted = resolve(root, worktreePath)
    const items = await this.worktrees(root)
    const match = items.find(item => resolve(item.path) === wanted)
    if (!match) throw new Error('该路径不是当前仓库登记的工作树')
    return match.path
  }

  async removeWorktree(cwd: string, worktreePath: string, options: { force?: boolean } = {}): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      const path = await this.registeredWorktree(root, worktreePath)
      return this.action(['worktree', 'remove', ...(options.force ? ['--force'] : []), '--', path], root)
    })
  }

  async lockWorktree(cwd: string, worktreePath: string, reason?: string): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      const path = await this.registeredWorktree(root, worktreePath)
      const args = ['worktree', 'lock']
      if (reason?.trim()) args.push('--reason', reason.trim())
      args.push('--', path)
      return this.action(args, root)
    })
  }

  async unlockWorktree(cwd: string, worktreePath: string): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      const path = await this.registeredWorktree(root, worktreePath)
      return this.action(['worktree', 'unlock', '--', path], root)
    })
  }

  async pruneWorktrees(cwd: string, options: { dryRun?: boolean } = {}): Promise<ActionResult> {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd)
      return this.action(['worktree', 'prune', ...(options.dryRun ? ['--dry-run'] : []), '--verbose'], root, { includeStderr: true })
    })
  }

  /** Status of every registered worktree, for the manager list. */
  async worktreesWithStatus(cwd: string): Promise<WorktreeItem[]> {
    const items = await this.worktrees(cwd)
    for (const item of items) {
      try {
        const result = await this.runner.run(['status', '--porcelain', '-z', '--untracked-files=no'], item.path)
        if (result.exitCode === 0) item.dirtyFiles = result.stdout.split('\0').filter(Boolean).length
      } catch {
        // A removed directory still listed by Git: leave the count unknown.
      }
    }
    return items
  }
}

/** Re-exported so route handlers can build a status-shaped payload for tests. */
export type { StatusEntry, DiffFile }
