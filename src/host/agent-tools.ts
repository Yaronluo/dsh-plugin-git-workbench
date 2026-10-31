import type { GitService } from './git-service.js'
import { defineTool } from './tool-defs.js'
import type { ToolDefinition, ToolParameter } from './tool-defs.js'

const cwdDescription = 'Absolute path of the repository (must be a path inside a Git working tree)'
const toolNames = new Set([
  'git_status',
  'git_diff',
  'git_log',
  'git_stage',
  'git_unstage',
  'git_commit',
  'git_stash',
  'git_branch',
])

function parameter(type: ToolParameter['type'], description: string, required = false, extra: Partial<ToolParameter> = {}): ToolParameter {
  return { type, description, ...(required ? { required: true } : {}), ...extra }
}

function textResult(text: string): Array<{ type: 'text'; text: string }> {
  return [{ type: 'text', text }]
}

function errorText(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message)
  return String(error)
}

function actionSummary(action: string, value: any): string {
  if (value?.ok) return value.output || `Completed${action}`
  const error = typeof value?.error === 'string' ? value.error : value?.error?.message
  return `${action}Failed${error ? `:${error}` : ''}`
}

function gitStatusTool(service: GitService): ToolDefinition {
  return defineTool({
    name: 'git_status',
    description: 'Read-only: view Git working tree status, branches, and changed files of every kind, without modifying the repository.',
    parameters: {
      cwd: parameter('string', cwdDescription, true),
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          isGit: { type: 'boolean', required: true },
          root: { type: 'string', required: true },
          branch: { type: 'string', required: true },
          head: { type: 'string', required: true },
          upstream: { type: 'string' },
          ahead: { type: 'number' },
          behind: { type: 'number' },
          stashCount: { type: 'number' },
          operation: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          detached: { type: 'boolean', required: true },
          staged: { type: 'number', required: true },
          unstaged: { type: 'number', required: true },
          conflicts: { type: 'number', required: true },
          untracked: { type: 'number', required: true },
          clean: { type: 'boolean', required: true },
          truncated: { type: 'boolean', required: true },
          files: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                path: { type: 'string', required: true },
                section: { type: 'string', enum: ['staged', 'unstaged', 'conflict', 'untracked'], required: true },
                status: { type: 'string', required: true },
                insertions: { type: 'number', required: true },
                deletions: { type: 'number', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => textResult(value.clean
        ? 'The Git working tree is clean.'
        : `The Git working tree has ${value.files.length}${value.truncated ? ' or more' : ''} changed files.`),
    },
    async execute(args) {
      try {
        const [status, changes] = await Promise.all([service.status(args.cwd), service.changes(args.cwd)])
        const entries = changes.entries
        const files = entries.slice(0, 200).map(entry => ({
          path: entry.path,
          section: entry.section,
          status: entry.status,
          insertions: entry.insertions,
          deletions: entry.deletions,
        }))
        return {
          isGit: status.isGit,
          root: status.root,
          branch: status.branch,
          head: status.head,
          ...(status.upstream !== undefined ? { upstream: status.upstream } : {}),
          ...(status.ahead !== undefined ? { ahead: status.ahead } : {}),
          ...(status.behind !== undefined ? { behind: status.behind } : {}),
          ...(status.stashCount !== undefined ? { stashCount: status.stashCount } : {}),
          operation: status.operation ?? null,
          detached: status.detached ?? false,
          staged: changes.staged,
          unstaged: changes.unstaged,
          conflicts: changes.conflicts,
          untracked: changes.untracked,
          clean: status.isGit && entries.length === 0 && !status.operationInProgress,
          truncated: entries.length > 200,
          files,
        }
      } catch (error) {
        throw error
      }
    },
  })
}

function gitDiffTool(service: GitService): ToolDefinition {
  return defineTool({
    name: 'git_diff',
    description: 'Read-only: view code diffs for the working tree, the index, or a commit range, without modifying the repository.',
    parameters: {
      cwd: parameter('string', cwdDescription, true),
      base: parameter('string', 'Base revision or branch for the diff.'),
      target: parameter('string', 'Target revision or branch for the diff.'),
      mode: parameter('string', 'Diff mode.', false, { enum: ['worktree', 'staged', 'range', 'single'] }),
      files: parameter('array', 'Only view history for these repository-relative paths.', false, { items: { type: 'string' } }),
      context: parameter('number', 'Number of context lines displayed for each diff hunk.'),
      ignoreWhitespace: parameter('boolean', 'Whether to ignore whitespace differences.'),
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          base: { type: 'string', required: true },
          target: { type: 'string', required: true },
          totalInsertions: { type: 'number', required: true },
          totalDeletions: { type: 'number', required: true },
          truncated: { type: 'boolean', required: true },
          files: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                path: { type: 'string', required: true },
                oldPath: { type: 'string' },
                status: { type: 'string', required: true },
                insertions: { type: 'number', required: true },
                deletions: { type: 'number', required: true },
                binary: { type: 'boolean', required: true },
                patch: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => textResult(`Diff: ${value.files.length} files, +${value.totalInsertions} lines, -${value.totalDeletions} lines${value.truncated ? ' (patch truncated)' : ''}.`),
    },
    async execute(args) {
      try {
        const diff = await service.diff(args.cwd, args.base, args.target, {
          mode: args.mode,
          paths: args.files,
          context: args.context,
          ignoreWhitespace: args.ignoreWhitespace,
        })
        let truncated = false
        const files = diff.files.map(file => {
          if (file.rawPatch.length > 8000) truncated = true
          return {
            path: file.path,
            ...(file.oldPath !== undefined ? { oldPath: file.oldPath } : {}),
            status: file.status,
            insertions: file.insertions,
            deletions: file.deletions,
            binary: file.binary === true,
            patch: file.rawPatch.slice(0, 8000),
          }
        })
        return {
          base: diff.base,
          target: diff.target,
          totalInsertions: diff.totalInsertions,
          totalDeletions: diff.totalDeletions,
          truncated,
          files,
        }
      } catch (error) {
        throw error
      }
    },
  })
}

function gitLogTool(service: GitService): ToolDefinition {
  return defineTool({
    name: 'git_log',
    description: 'Read-only: view recent commits or the commit history of specific files, without modifying the repository.',
    parameters: {
      cwd: parameter('string', cwdDescription, true),
      limit: parameter('number', 'Maximum number of commits to return, from 1 to 100.'),
      file: parameter('string', 'Only view history for this repository-relative path.'),
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          commits: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                hash: { type: 'string', required: true },
                shortHash: { type: 'string', required: true },
                subject: { type: 'string', required: true },
                author: { type: 'string', required: true },
                date: { type: 'string', required: true },
                parents: { type: 'array', items: { type: 'string' }, required: true },
                refs: { type: 'array', items: { type: 'string' }, required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => textResult(`Commit log: ${value.commits.length} entries${value.commits[0] ? `, latest is ${value.commits[0].shortHash} ${value.commits[0].subject}` : ''}.`),
    },
    async execute(args) {
      try {
        const rawLimit = typeof args.limit === 'number' && Number.isFinite(args.limit) ? Math.trunc(args.limit) : 20
        const limit = Math.min(100, Math.max(1, rawLimit))
        const commits = await service.log(args.cwd, limit, { path: args.file })
        return {
          commits: commits.map(commit => ({
            hash: commit.hash,
            shortHash: commit.shortHash,
            subject: commit.subject,
            author: commit.author,
            date: commit.date,
            parents: commit.parents,
            refs: commit.refs,
          })),
        }
      } catch (error) {
        throw error
      }
    },
  })
}

function actionResultSchema(extraProperties: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      ok: { type: 'boolean', required: true },
      output: { type: 'string' },
      error: { type: 'string' },
      ...extraProperties,
    },
  }
}

function gitStageTool(service: GitService): ToolDefinition {
  return defineTool({
    name: 'git_stage',
    description: 'Modifies the repository index: stages the given files; when no files are provided or the list is empty, stages all changes.',
    parameters: {
      cwd: parameter('string', cwdDescription, true),
      files: parameter('array', 'Repository-relative paths to stage; omit them or pass an empty array to stage all changes.', false, { items: { type: 'string' } }),
    },
    output: {
      schema: actionResultSchema(),
      render: (_args, value) => textResult(actionSummary('Stage', value)),
    },
    async execute(args) {
      try {
        const files = args.files
        return files === undefined || (Array.isArray(files) && files.length === 0)
          ? await service.stageAll(args.cwd)
          : await service.stage(args.cwd, files)
      } catch (error) {
        return { ok: false, error: errorText(error) }
      }
    },
  })
}

function gitUnstageTool(service: GitService): ToolDefinition {
  return defineTool({
    name: 'git_unstage',
    description: 'Modifies the repository index: unstages the given files; when no files are provided or the list is empty, unstages all changes.',
    parameters: {
      cwd: parameter('string', cwdDescription, true),
      files: parameter('array', 'Repository-relative paths to unstage; omit them or pass an empty array to unstage all changes.', false, { items: { type: 'string' } }),
    },
    output: {
      schema: actionResultSchema(),
      render: (_args, value) => textResult(actionSummary('Unstage', value)),
    },
    async execute(args) {
      try {
        const files = args.files
        return files === undefined || (Array.isArray(files) && files.length === 0)
          ? await service.unstageAll(args.cwd)
          : await service.unstage(args.cwd, files)
      } catch (error) {
        return { ok: false, error: errorText(error) }
      }
    },
  })
}

function gitCommitTool(service: GitService): ToolDefinition {
  return defineTool({
    name: 'git_commit',
    description: 'Modifies repository history: creates a commit; amend rewrites the most recent commit and, due to safety restrictions, must be run in the human Git panel.',
    parameters: {
      cwd: parameter('string', cwdDescription, true),
      message: parameter('string', 'Commit description.'),
      all: parameter('boolean', 'Whether to stage and commit changes to all tracked files at once.'),
      amend: parameter('boolean', 'Whether to rewrite the most recent commit.'),
    },
    output: {
      schema: actionResultSchema({
        hash: { type: 'string' },
        shortHash: { type: 'string' },
        summary: { type: 'string' },
      }),
      render: (_args, value) => textResult(value.ok
        ? `Commit succeeded${value.shortHash ? `: ${value.shortHash}` : ''}${value.summary ? ` ${value.summary}` : ''}.`
        : actionSummary('Commit', value)),
    },
    async execute(args) {
      try {
        return await service.createCommit(args.cwd, {
          message: args.message,
          all: args.all,
          amend: args.amend,
        })
      } catch (error) {
        return { ok: false, error: errorText(error) }
      }
    },
  })
}

function stashListSchema(): Record<string, unknown> {
  return {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        index: { type: 'number', required: true },
        selector: { type: 'string', required: true },
        hash: { type: 'string', required: true },
        shortHash: { type: 'string', required: true },
        subject: { type: 'string', required: true },
        branch: { type: 'string' },
        date: { type: 'string', required: true },
      },
    },
  }
}

function gitStashTool(service: GitService): ToolDefinition {
  return defineTool({
    name: 'git_stash',
    description: 'Listing stash entries is read-only; push, pop, and apply modify the working tree, drop deletes the stash and can only be run in the human Git panel.',
    parameters: {
      cwd: parameter('string', cwdDescription, true),
      action: parameter('string', 'Stash operations.', true, { enum: ['list', 'push', 'pop', 'apply', 'drop'] }),
      message: parameter('string', 'Message used when creating the stash.'),
      index: parameter('number', 'Index of the stash entry to restore or drop, defaults to 0.'),
    },
    output: {
      schema: {
        oneOf: [
          stashListSchema(),
          actionResultSchema(),
        ],
      },
      render: (args, value) => textResult(Array.isArray(value)
        ? `Stash list:${value.length} entries.`
        : actionSummary(args.action === 'push' ? 'Create stash' : args.action === 'pop' ? 'Restore and drop stash' : args.action === 'apply' ? 'Apply stash' : 'Delete stash', value)),
    },
    async execute(args) {
      try {
        if (args.action === 'list') return await service.stashes(args.cwd)
        const index = args.index ?? 0
        if (args.action === 'push') return await service.stashPush(args.cwd, { message: args.message })
        if (args.action === 'pop') return await service.stashApply(args.cwd, index, { pop: true })
        if (args.action === 'apply') return await service.stashApply(args.cwd, index, { pop: false })
        if (args.action === 'drop') return await service.stashDrop(args.cwd, index)
        return { ok: false, error: 'Unsupported stash operation' }
      } catch (error) {
        if (args.action === 'list') throw error
        return { ok: false, error: errorText(error) }
      }
    },
  })
}

function branchListSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      current: { type: 'string', required: true },
      dirtyFiles: { type: 'number', required: true },
      branches: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', required: true },
            current: { type: 'boolean', required: true },
            isRemote: { type: 'boolean', required: true },
            upstream: { type: 'string' },
            ahead: { type: 'number' },
            behind: { type: 'number' },
            subject: { type: 'string' },
            hash: { type: 'string' },
          },
        },
      },
    },
  }
}

function switchResultSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      ok: { type: 'boolean', required: true },
      branch: { type: 'string' },
      error: {
        type: 'object',
        additionalProperties: false,
        properties: {
          code: { type: 'string', required: true },
          message: { type: 'string', required: true },
        },
      },
    },
  }
}

function gitBranchTool(service: GitService): ToolDefinition {
  return defineTool({
    name: 'git_branch',
    description: 'list is read-only; create and switch modify the repository\'s current branch or create a new branch.',
    parameters: {
      cwd: parameter('string', cwdDescription, true),
      action: parameter('string', 'Branch operations.', true, { enum: ['list', 'create', 'switch'] }),
      name: parameter('string', 'Name of the branch to create or switch to.'),
      base: parameter('string', 'Starting revision or branch used to create the branch.'),
    },
    output: {
      schema: { oneOf: [branchListSchema(), switchResultSchema()] },
      render: (args, value) => textResult(args.action === 'list'
        ? `Branch list: ${value.branches.length} branches, current branch is ${value.current || 'None'}.`
        : actionSummary(args.action === 'create' ? 'Create branch' : 'Switch branch', value)),
    },
    async execute(args) {
      try {
        if (args.action === 'list') return await service.branches(args.cwd)
        if (args.action === 'create') return await service.createBranch(args.cwd, args.name, args.base)
        if (args.action === 'switch') return await service.switchBranch(args.cwd, args.name)
        return { ok: false, error: { code: 'invalid-action', message: 'Unsupported branch operation' } }
      } catch (error) {
        if (args.action === 'list') throw error
        return { ok: false, error: { code: 'git-tool-error', message: errorText(error) } }
      }
    },
  })
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function registerGitTools(ctx: any, service: GitService): () => void {
  if (typeof ctx?.tools?.register !== 'function') {
    console.warn('dsh-plugin-git: the current DSH version does not support tool registration; Git tools were skipped')
    return () => {}
  }

  const disposers: Array<() => void> = []
  const factories: Array<() => ToolDefinition> = [
    () => gitStatusTool(service),
    () => gitDiffTool(service),
    () => gitLogTool(service),
    () => gitStageTool(service),
    () => gitUnstageTool(service),
    () => gitCommitTool(service),
    () => gitStashTool(service),
    () => gitBranchTool(service),
  ]

  for (const createDefinition of factories) {
    try {
      const definition = createDefinition()
      const dispose = ctx.tools.register(definition)
      if (typeof dispose === 'function') disposers.push(dispose)
    } catch (error) {
      console.warn(`dsh-plugin-git: failed to define or register Git tools: ${errorText(error)}`)
    }
  }

  if (typeof ctx?.on === 'function') {
    try {
      const dispose = ctx.on('tools/pre-execute', async (exec: any, next: () => Promise<unknown>) => {
        let name: unknown
        let args: unknown
        try {
          if (!isRecord(exec) || typeof exec.name !== 'string') return next()
          name = exec.name
          args = exec.arguments
        } catch {
          return next()
        }
        if (!toolNames.has(name as string) || !isRecord(args)) return next()
        if (name === 'git_commit' && args.amend === true) {
          return { kind: 'deny', reason: 'Rewriting the most recent commit rewrites commit history; please run it yourself in the Git panel.' }
        }
        if (name === 'git_stash' && args.action === 'drop') {
          return { kind: 'deny', reason: 'Deleting a stash entry may be unrecoverable; please run it yourself in the Git panel.' }
        }
        return next()
      })
      if (typeof dispose === 'function') disposers.push(dispose)
    } catch (error) {
      console.warn(`dsh-plugin-git: failed to register the Git tool approval hook: ${errorText(error)}`)
    }
  }

  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    for (const dispose of disposers.reverse()) {
      try {
        dispose()
      } catch (error) {
        console.warn(`dsh-plugin-git: failed to clean up Git tools: ${errorText(error)}`)
      }
    }
  }
}
