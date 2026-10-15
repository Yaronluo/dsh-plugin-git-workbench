import { realpath, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { GitRunner } from './git-runner.js'
import {
  parseBranches,
  parseLog,
  parseStatusV2,
  parseUnifiedDiff,
  parseWorktrees,
} from '../core/git-command.js'
import type {
  BranchItem,
  BranchesView,
  DiffFile,
  DiffView,
  GitGraphCommit,
  RepoStatus,
  SwitchResult,
  WorktreeItem,
} from '../core/types.js'

export class GitService {
  constructor(private readonly runner: GitRunner) {}

  /**
   * Check if a directory is inside a Git repository
   */
  async isGitRepo(cwd: string): Promise<boolean> {
    try {
      if (!cwd || typeof cwd !== 'string') return false
      const targetDir = resolve(cwd.trim().replace(/^["']|["']$/g, ''))
      if (!existsSync(targetDir)) return false
      const result = await this.runner.run(['rev-parse', '--is-inside-work-tree'], targetDir)
      return result.exitCode === 0 && result.stdout.trim() === 'true'
    } catch {
      return false
    }
  }

  /**
   * Get the root directory of the Git repository
   */
  async getRepoRoot(cwd: string): Promise<string | null> {
    try {
      if (!cwd || typeof cwd !== 'string') return null
      const targetDir = resolve(cwd.trim().replace(/^["']|["']$/g, ''))
      const result = await this.runner.run(['rev-parse', '--show-toplevel'], targetDir)
      if (result.exitCode === 0 && result.stdout.trim()) {
        return resolve(result.stdout.trim())
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * Get overall repository status. Returns isGit: false if not a repository.
   */
  async status(cwd: string): Promise<RepoStatus> {
    const isGit = await this.isGitRepo(cwd)
    if (!isGit) {
      return {
        isGit: false,
        root: '',
        branch: '',
        head: '',
        dirtyFiles: 0,
        untrackedFiles: 0,
        conflicts: 0,
        operationInProgress: false,
      }
    }

    const root = (await this.getRepoRoot(cwd)) || cwd
    const res = await this.runner.run(['status', '--porcelain=v2', '--branch'], root)
    if (res.exitCode !== 0) {
      return {
        isGit: false,
        root,
        branch: '',
        head: '',
        dirtyFiles: 0,
        untrackedFiles: 0,
        conflicts: 0,
        operationInProgress: false,
      }
    }

    const status = parseStatusV2(res.stdout, root)

    // Check if rebase / merge in progress
    const gitDir = join(root, '.git')
    status.operationInProgress =
      existsSync(join(gitDir, 'MERGE_HEAD')) ||
      existsSync(join(gitDir, 'rebase-merge')) ||
      existsSync(join(gitDir, 'rebase-apply')) ||
      existsSync(join(gitDir, 'CHERRY_PICK_HEAD'))

    return status
  }

  /**
   * Get list of all branches
   */
  async branches(cwd: string): Promise<BranchesView> {
    const isGit = await this.isGitRepo(cwd)
    if (!isGit) {
      return { current: '', dirtyFiles: 0, branches: [] }
    }

    const root = (await this.getRepoRoot(cwd)) || cwd
    const [branchRes, status] = await Promise.all([
      this.runner.run(['branch', '-a', '--no-color'], root),
      this.status(root),
    ])

    const branches = parseBranches(branchRes.stdout)
    return {
      current: status.branch,
      dirtyFiles: status.dirtyFiles,
      branches,
    }
  }

  /**
   * Switch / checkout a branch safely
   */
  async switchBranch(cwd: string, branch: string): Promise<SwitchResult> {
    const isGit = await this.isGitRepo(cwd)
    if (!isGit) {
      return { ok: false, error: { code: 'not-git', message: 'Not a git repository' } }
    }

    const root = (await this.getRepoRoot(cwd)) || cwd

    // Try switch first
    const cleanBranch = branch.replace(/^origin\//, '')
    const result = await this.runner.run(['switch', cleanBranch], root)
    if (result.exitCode === 0) {
      return { ok: true, branch: cleanBranch }
    }

    // Fallback to checkout if switch unsupported or remote tracking needed
    const checkoutResult = await this.runner.run(['checkout', cleanBranch], root)
    if (checkoutResult.exitCode === 0) {
      return { ok: true, branch: cleanBranch }
    }

    return {
      ok: false,
      error: {
        code: 'switch-failed',
        message: checkoutResult.stderr.trim() || result.stderr.trim() || 'Failed to switch branch',
      },
    }
  }

  /**
   * Create and switch to a new branch
   */
  async createBranch(cwd: string, name: string, base?: string): Promise<SwitchResult> {
    const isGit = await this.isGitRepo(cwd)
    if (!isGit) {
      return { ok: false, error: { code: 'not-git', message: 'Not a git repository' } }
    }

    const root = (await this.getRepoRoot(cwd)) || cwd
    const args = ['checkout', '-b', name.trim()]
    if (base && base.trim()) {
      args.push(base.trim())
    }

    const result = await this.runner.run(args, root)
    if (result.exitCode === 0) {
      return { ok: true, branch: name.trim() }
    }

    return {
      ok: false,
      error: {
        code: 'create-failed',
        message: result.stderr.trim() || 'Failed to create branch',
      },
    }
  }

  /**
   * Get Diff view comparing base and target, or comparing working tree to HEAD
   */
  async diff(cwd: string, base?: string, target?: string): Promise<DiffView> {
    const isGit = await this.isGitRepo(cwd)
    if (!isGit) {
      return { base: '', target: '', totalInsertions: 0, totalDeletions: 0, files: [] }
    }

    const root = (await this.getRepoRoot(cwd)) || cwd

    let diffArgs: string[]
    let numstatArgs: string[]

    if (base && target) {
      diffArgs = ['diff', '-U3', `${base}...${target}`]
      numstatArgs = ['diff', '--numstat', `${base}...${target}`]
    } else if (base) {
      diffArgs = ['diff', '-U3', base]
      numstatArgs = ['diff', '--numstat', base]
    } else {
      // Working tree vs HEAD
      diffArgs = ['diff', '-U3', 'HEAD']
      numstatArgs = ['diff', '--numstat', 'HEAD']
    }

    const [diffRes, numstatRes] = await Promise.all([
      this.runner.run(diffArgs, root),
      this.runner.run(numstatArgs, root),
    ])

    const parsed = parseUnifiedDiff(diffRes.stdout, numstatRes.stdout)
    parsed.base = base || 'HEAD'
    parsed.target = target || 'working-tree'

    // Also include untracked files if working tree is inspected
    if (!target || target === 'working-tree') {
      try {
        const statusRes = await this.runner.run(['status', '--porcelain=v2'], root)
        for (const line of statusRes.stdout.split('\n')) {
          if (line.startsWith('? ')) {
            const untrackedPath = line.slice(2).trim()
            try {
              const fullPath = join(root, untrackedPath)
              const content = await readFile(fullPath, 'utf-8')
              const contentLines = content.split('\n')
              parsed.totalInsertions += contentLines.length

              parsed.files.push({
                path: untrackedPath,
                status: 'untracked',
                insertions: contentLines.length,
                deletions: 0,
                hunks: [
                  {
                    header: `@@ -0,0 +1,${contentLines.length} @@`,
                    oldStart: 0,
                    oldLines: 0,
                    newStart: 1,
                    newLines: contentLines.length,
                    lines: contentLines.map((l, idx) => ({
                      type: 'add',
                      newNum: idx + 1,
                      content: l,
                    })),
                  },
                ],
                rawPatch: content,
              })
            } catch {
              // Ignore binary or unreadable untracked files
            }
          }
        }
      } catch {
        // Ignore status error
      }
    }

    return parsed
  }

  /**
   * List Git worktrees
   */
  async worktrees(cwd: string): Promise<WorktreeItem[]> {
    const isGit = await this.isGitRepo(cwd)
    if (!isGit) return []

    const root = (await this.getRepoRoot(cwd)) || cwd
    const res = await this.runner.run(['worktree', 'list', '--porcelain'], root)
    if (res.exitCode !== 0) return []

    return parseWorktrees(res.stdout, root)
  }

  /**
   * Create a new worktree
   */
  async createWorktree(cwd: string, name: string, baseBranch?: string): Promise<{ ok: boolean; path?: string; error?: string }> {
    const root = (await this.getRepoRoot(cwd)) || cwd
    const sanitizedName = name.replace(/[^a-zA-Z0-9_\-\.]/g, '-').toLowerCase()
    const targetDir = resolve(root, '..', `.dsh-wt-${sanitizedName}`)
    const newBranch = `wt/${sanitizedName}`

    const args = ['worktree', 'add', '-b', newBranch, targetDir]
    if (baseBranch) args.push(baseBranch)

    const res = await this.runner.run(args, root)
    if (res.exitCode === 0) {
      return { ok: true, path: targetDir }
    }
    return { ok: false, error: res.stderr.trim() || 'Failed to create worktree' }
  }

  /**
   * Remove a worktree
   */
  async removeWorktree(cwd: string, worktreePath: string): Promise<{ ok: boolean; error?: string }> {
    const root = (await this.getRepoRoot(cwd)) || cwd
    const res = await this.runner.run(['worktree', 'remove', '--force', worktreePath], root)
    if (res.exitCode === 0) {
      return { ok: true }
    }
    return { ok: false, error: res.stderr.trim() || 'Failed to remove worktree' }
  }

  /**
   * Get Git commit history for visual graph
   */
  async log(cwd: string, maxCount: number = 50): Promise<GitGraphCommit[]> {
    const isGit = await this.isGitRepo(cwd)
    if (!isGit) return []

    const root = (await this.getRepoRoot(cwd)) || cwd
    const res = await this.runner.run(
      ['log', `-n${maxCount}`, '--format=%H|%h|%s|%an|%cr|%P|%D', '--no-color'],
      root
    )
    if (res.exitCode !== 0) return []

    return parseLog(res.stdout)
  }
}
