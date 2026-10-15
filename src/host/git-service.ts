import { readFile, readlink, lstat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import type { GitRunner, GitRunResult } from './git-runner.js'
import { parseBranches, parseLog, parseStatusV2, parseUnifiedDiff, parseWorktrees } from '../core/git-command.js'
import type { BranchesView, DiffView, GitGraphCommit, RepoStatus, SwitchResult, WorktreeItem } from '../core/types.js'

export class GitService {
  constructor(private readonly runner: GitRunner) {}

  private checked(result: GitRunResult, operation: string): GitRunResult {
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `${operation} failed (exit ${result.exitCode})`)
    return result
  }

  private safeRef(value: string): string {
    if (typeof value !== 'string' || !value || value.startsWith('-') || /[\s\x00-\x1f\x7f]/.test(value)) throw new Error('Invalid Git reference')
    return value
  }

  private async commit(root: string, value: string): Promise<string> {
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
    if (!await this.isGitRepo(cwd)) return { isGit: false, root: '', branch: '', head: '', dirtyFiles: 0, untrackedFiles: 0, conflicts: 0, operationInProgress: false, revision: 'not-git' }
    const root = (await this.getRepoRoot(cwd)) || cwd
    const result = this.checked(await this.runner.run(['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'], root), 'Status')
    const status = parseStatusV2(result.stdout, root)
    const gitDirResult = this.checked(await this.runner.run(['rev-parse', '--absolute-git-dir'], root), 'Resolve git directory')
    const gitDir = gitDirResult.stdout.trim()
    const markers = ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'sequencer']
    const activeMarkers = markers.filter(marker => existsSync(join(gitDir, marker)))
    status.operationInProgress = activeMarkers.length > 0

    // Counts and mtimes are not sufficient: a second edit to an already-dirty file must refresh clients.
    // Include staged object IDs, dirty/untracked file bytes, refs/status, worktrees and operation markers.
    // Do not scan every clean tracked file on each SSE poll.
    const hash = createHash('sha256').update(result.stdout).update(JSON.stringify(activeMarkers))
    const paths = this.checked(await this.runner.run(['ls-files', '-z', '--modified', '--deleted', '--others', '--exclude-standard'], root), 'List files')
    for (const path of [...new Set(paths.stdout.split('\0').filter(Boolean))].sort()) {
      hash.update(JSON.stringify(path))
      try {
        const fullPath = join(root, path)
        const stat = await lstat(fullPath)
        hash.update(String(stat.mode))
        if (stat.isSymbolicLink()) hash.update(await readlink(fullPath))
        else if (stat.isFile()) hash.update(await readFile(fullPath))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        hash.update('missing')
      }
    }
    const index = this.checked(await this.runner.run(['ls-files', '--stage', '-z'], root), 'Read index')
    hash.update(index.stdout)
    const refs = this.checked(await this.runner.run(['for-each-ref', '--format=%(refname)%00%(objectname)%00%(upstream)', 'refs/heads', 'refs/remotes'], root), 'Read refs')
    hash.update(refs.stdout)
    const worktrees = this.checked(await this.runner.run(['worktree', 'list', '--porcelain', '-z'], root), 'List worktrees')
    hash.update(worktrees.stdout)
    status.revision = hash.digest('hex')
    return status
  }

  async branches(cwd: string): Promise<BranchesView> {
    if (!await this.isGitRepo(cwd)) return { current: '', dirtyFiles: 0, branches: [] }
    const root = (await this.getRepoRoot(cwd)) || cwd
    const [result, status] = await Promise.all([this.runner.run(['branch', '-a', '--no-color'], root), this.status(root)])
    this.checked(result, 'List branches')
    return { current: status.branch, dirtyFiles: status.dirtyFiles, branches: parseBranches(result.stdout) }
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
    } catch (error) { return { ok: false, error: { code: 'switch-failed', message: (error as Error).message } } }
  }

  async createBranch(cwd: string, name: string, base?: string): Promise<SwitchResult> {
    if (!await this.isGitRepo(cwd)) return { ok: false, error: { code: 'not-git', message: 'Not a git repository' } }
    const root = (await this.getRepoRoot(cwd)) || cwd
    try {
      await this.branchName(root, name)
      const args = ['switch', '-c', name]
      if (base !== undefined) args.push(await this.commit(root, base))
      const result = await this.runner.run(args, root)
      return result.exitCode === 0 ? { ok: true, branch: name } : { ok: false, error: { code: 'create-failed', message: result.stderr.trim() || 'Failed to create branch' } }
    } catch (error) { return { ok: false, error: { code: 'create-failed', message: (error as Error).message } } }
  }

  async diff(cwd: string, base?: string, target?: string): Promise<DiffView> {
    if (!await this.isGitRepo(cwd)) return { base: '', target: '', totalInsertions: 0, totalDeletions: 0, files: [] }
    const root = (await this.getRepoRoot(cwd)) || cwd
    const workingTree = !target || target === 'working-tree'
    let baseHash: string
    if (base === undefined || base === 'HEAD') {
      const head = await this.runner.run(['rev-parse', '--verify', '--end-of-options', 'HEAD^{commit}'], root)
      if (head.exitCode === 0) baseHash = head.stdout.trim()
      else {
        // Only a genuinely unborn symbolic HEAD gets the empty-tree comparison; other failures surface.
        const symbolic = this.checked(await this.runner.run(['symbolic-ref', '-q', 'HEAD'], root), 'Resolve HEAD')
        const existing = await this.runner.run(['show-ref', '--verify', '--quiet', symbolic.stdout.trim()], root)
        if (existing.exitCode !== 1 || !workingTree) this.checked(head, 'Resolve HEAD')
        baseHash = this.checked(await this.runner.run(['hash-object', '-t', 'tree', '--stdin'], root), 'Empty tree').stdout.trim()
      }
    } else baseHash = await this.commit(root, base)
    const revisions = workingTree ? [baseHash] : [`${baseHash}...${await this.commit(root, target!)}`]
    const common = ['--no-ext-diff', '--no-textconv', '--no-color', '--src-prefix=a/', '--dst-prefix=b/']
    const [patch, stats] = await Promise.all([
      this.runner.run(['diff', ...common, '-U3', ...revisions, '--'], root),
      this.runner.run(['diff', ...common, '--numstat', '-z', ...revisions, '--'], root),
    ])
    this.checked(patch, 'Diff'); this.checked(stats, 'Diff numstat')
    const parsed = parseUnifiedDiff(patch.stdout, stats.stdout)
    parsed.base = base || 'HEAD'; parsed.target = target || 'working-tree'
    if (workingTree) {
      const untracked = this.checked(await this.runner.run(['ls-files', '--others', '--exclude-standard', '-z'], root), 'List untracked files')
      for (const path of untracked.stdout.split('\0').filter(Boolean)) {
        const fullPath = join(root, path)
        const stat = await lstat(fullPath)
        const bytes = stat.isSymbolicLink() ? Buffer.from(await readlink(fullPath)) : await readFile(fullPath)
        const binary = bytes.subarray(0, 8000).includes(0)
        const content = bytes.toString('utf8')
        const lines = binary || bytes.length === 0 ? [] : content.replace(/\n$/, '').split('\n')
        const count = lines.length
        parsed.totalInsertions += count
        parsed.files.push({ path, status: 'untracked', insertions: count, deletions: 0, hunks: count ? [{ header: `@@ -0,0 +1,${count} @@`, oldStart: 0, oldLines: 0, newStart: 1, newLines: count, lines: lines.map((content, i) => ({ type: 'add', newNum: i + 1, content })) }] : [], rawPatch: binary ? `Binary file ${path}\n` : content })
      }
    }
    return parsed
  }

  async worktrees(cwd: string): Promise<WorktreeItem[]> {
    if (!await this.isGitRepo(cwd)) return []
    const root = (await this.getRepoRoot(cwd)) || cwd
    return parseWorktrees(this.checked(await this.runner.run(['worktree', 'list', '--porcelain', '-z'], root), 'List worktrees').stdout, root)
  }

  async createWorktree(cwd: string, name: string, baseBranch?: string): Promise<{ ok: boolean; path?: string; error?: string }> {
    const root = await this.getRepoRoot(cwd)
    if (!root) return { ok: false, error: 'Not a git repository' }
    try {
      if (typeof name !== 'string' || !name.trim()) throw new Error('Invalid worktree name')
      const sanitizedName = name.replace(/[^a-zA-Z0-9_\-.]/g, '-').toLowerCase()
      const branch = await this.branchName(root, `wt/${sanitizedName}`)
      const targetDir = resolve(root, '..', `.dsh-wt-${sanitizedName}`)
      const args = ['worktree', 'add', '-b', branch, '--', targetDir]
      if (baseBranch !== undefined) args.push(await this.commit(root, baseBranch))
      const result = await this.runner.run(args, root)
      return result.exitCode === 0 ? { ok: true, path: targetDir } : { ok: false, error: result.stderr.trim() || 'Failed to create worktree' }
    } catch (error) { return { ok: false, error: (error as Error).message } }
  }

  async removeWorktree(cwd: string, worktreePath: string): Promise<{ ok: boolean; error?: string }> {
    const root = await this.getRepoRoot(cwd)
    if (!root) return { ok: false, error: 'Not a git repository' }
    if (typeof worktreePath !== 'string' || !worktreePath) return { ok: false, error: 'Invalid worktree path' }
    const result = await this.runner.run(['worktree', 'remove', '--', resolve(root, worktreePath)], root)
    return result.exitCode === 0 ? { ok: true } : { ok: false, error: result.stderr.trim() || 'Failed to remove worktree' }
  }

  async log(cwd: string, maxCount = 50): Promise<GitGraphCommit[]> {
    if (!await this.isGitRepo(cwd)) return []
    if (!Number.isSafeInteger(maxCount) || maxCount < 1 || maxCount > 10000) throw new Error('Invalid log limit')
    const root = (await this.getRepoRoot(cwd)) || cwd
    const result = await this.runner.run(['log', `-n${maxCount}`, '-z', '--format=%H%x00%h%x00%s%x00%an%x00%cr%x00%P%x00%D', '--no-color'], root)
    if (result.exitCode !== 0) {
      const head = await this.runner.run(['rev-parse', '--verify', 'HEAD'], root)
      if (head.exitCode !== 0) return []
      this.checked(result, 'Log')
    }
    return parseLog(result.stdout)
  }
}
