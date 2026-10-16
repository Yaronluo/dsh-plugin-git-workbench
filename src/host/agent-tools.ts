import type { GitService } from './git-service.js'
import { defineTool } from './tool-defs.js'
import type { ToolDefinition, ToolParameter } from './tool-defs.js'

const cwdDescription = '仓库所在的绝对路径（必须是 Git 工作树内的路径）'
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
  if (value?.ok) return value.output || `已完成${action}`
  const error = typeof value?.error === 'string' ? value.error : value?.error?.message
  return `${action}失败${error ? `：${error}` : ''}`
}

function gitStatusTool(service: GitService): ToolDefinition {
  return defineTool({
    name: 'git_status',
    description: '只读：查看 Git 工作树状态、分支与各类变更文件，不会修改仓库。',
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
        ? 'Git 工作树干净。'
        : `Git 工作树有 ${value.files.length}${value.truncated ? ' 个以上' : ''} 个变更文件。`),
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
    description: '只读：查看工作区、暂存区或提交范围的代码差异，不会修改仓库。',
    parameters: {
      cwd: parameter('string', cwdDescription, true),
      base: parameter('string', '差异基准版本或分支。'),
      target: parameter('string', '差异目标版本或分支。'),
      mode: parameter('string', '差异模式。', false, { enum: ['worktree', 'staged', 'range', 'single'] }),
      files: parameter('array', '仅查看这些仓库相对路径。', false, { items: { type: 'string' } }),
      context: parameter('number', '每个差异块显示的上下文行数。'),
      ignoreWhitespace: parameter('boolean', '是否忽略空白差异。'),
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
      render: (_args, value) => textResult(`差异共 ${value.files.length} 个文件，增加 ${value.totalInsertions} 行、删除 ${value.totalDeletions} 行${value.truncated ? '（补丁已截断）' : ''}。`),
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
    description: '只读：查看最近提交记录或指定文件的提交历史，不会修改仓库。',
    parameters: {
      cwd: parameter('string', cwdDescription, true),
      limit: parameter('number', '最多返回的提交数量，范围为 1 到 100。'),
      file: parameter('string', '仅查看此仓库相对路径的历史。'),
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
      render: (_args, value) => textResult(`提交记录：${value.commits.length} 条${value.commits[0] ? `，最近一条为 ${value.commits[0].shortHash} ${value.commits[0].subject}` : ''}。`),
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
    description: '会修改仓库暂存区：暂存指定文件；未提供文件或列表为空时暂存全部改动。',
    parameters: {
      cwd: parameter('string', cwdDescription, true),
      files: parameter('array', '要暂存的仓库相对路径；省略或空数组表示暂存全部改动。', false, { items: { type: 'string' } }),
    },
    output: {
      schema: actionResultSchema(),
      render: (_args, value) => textResult(actionSummary('暂存', value)),
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
    description: '会修改仓库暂存区：取消暂存指定文件；未提供文件或列表为空时取消暂存全部改动。',
    parameters: {
      cwd: parameter('string', cwdDescription, true),
      files: parameter('array', '要取消暂存的仓库相对路径；省略或空数组表示取消暂存全部改动。', false, { items: { type: 'string' } }),
    },
    output: {
      schema: actionResultSchema(),
      render: (_args, value) => textResult(actionSummary('取消暂存', value)),
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
    description: '会修改仓库历史：创建提交；amend 会改写最近一次提交，受安全限制需在人类 Git 面板中执行。',
    parameters: {
      cwd: parameter('string', cwdDescription, true),
      message: parameter('string', '提交说明。'),
      all: parameter('boolean', '是否同时暂存并提交所有已跟踪文件的改动。'),
      amend: parameter('boolean', '是否改写最近一次提交。'),
    },
    output: {
      schema: actionResultSchema({
        hash: { type: 'string' },
        shortHash: { type: 'string' },
        summary: { type: 'string' },
      }),
      render: (_args, value) => textResult(value.ok
        ? `提交成功${value.shortHash ? `：${value.shortHash}` : ''}${value.summary ? ` ${value.summary}` : ''}。`
        : actionSummary('提交', value)),
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
    description: '列出储藏内容为只读；push、pop、apply 会修改工作区，drop 会删除储藏且仅可在人类 Git 面板中执行。',
    parameters: {
      cwd: parameter('string', cwdDescription, true),
      action: parameter('string', '储藏操作。', true, { enum: ['list', 'push', 'pop', 'apply', 'drop'] }),
      message: parameter('string', '创建储藏时使用的说明。'),
      index: parameter('number', '要恢复或删除的储藏序号，默认 0。'),
    },
    output: {
      schema: {
        oneOf: [
          stashListSchema(),
          actionResultSchema(),
        ],
      },
      render: (args, value) => textResult(Array.isArray(value)
        ? `储藏列表：${value.length} 条。`
        : actionSummary(args.action === 'push' ? '创建储藏' : args.action === 'pop' ? '恢复并删除储藏' : args.action === 'apply' ? '应用储藏' : '删除储藏', value)),
    },
    async execute(args) {
      try {
        if (args.action === 'list') return await service.stashes(args.cwd)
        const index = args.index ?? 0
        if (args.action === 'push') return await service.stashPush(args.cwd, { message: args.message })
        if (args.action === 'pop') return await service.stashApply(args.cwd, index, { pop: true })
        if (args.action === 'apply') return await service.stashApply(args.cwd, index, { pop: false })
        if (args.action === 'drop') return await service.stashDrop(args.cwd, index)
        return { ok: false, error: '不支持的储藏操作' }
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
    description: 'list 为只读；create 和 switch 会修改仓库当前分支或创建新分支。',
    parameters: {
      cwd: parameter('string', cwdDescription, true),
      action: parameter('string', '分支操作。', true, { enum: ['list', 'create', 'switch'] }),
      name: parameter('string', '要创建或切换到的分支名。'),
      base: parameter('string', '创建分支时使用的起点版本或分支。'),
    },
    output: {
      schema: { oneOf: [branchListSchema(), switchResultSchema()] },
      render: (args, value) => textResult(args.action === 'list'
        ? `分支列表：${value.branches.length} 个，当前分支为 ${value.current || '无'}。`
        : actionSummary(args.action === 'create' ? '创建分支' : '切换分支', value)),
    },
    async execute(args) {
      try {
        if (args.action === 'list') return await service.branches(args.cwd)
        if (args.action === 'create') return await service.createBranch(args.cwd, args.name, args.base)
        if (args.action === 'switch') return await service.switchBranch(args.cwd, args.name)
        return { ok: false, error: { code: 'invalid-action', message: '不支持的分支操作' } }
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
    console.warn('dsh-plugin-git: 当前 DSH 版本不支持工具注册，已跳过 Git 工具')
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
      console.warn(`dsh-plugin-git: Git 工具定义或注册失败：${errorText(error)}`)
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
          return { kind: 'deny', reason: '改写最近一次提交会重写提交历史，请改由你在 Git 面板中执行。' }
        }
        if (name === 'git_stash' && args.action === 'drop') {
          return { kind: 'deny', reason: '删除储藏记录可能无法恢复，请改由你在 Git 面板中执行。' }
        }
        return next()
      })
      if (typeof dispose === 'function') disposers.push(dispose)
    } catch (error) {
      console.warn(`dsh-plugin-git: Git 工具审批钩子注册失败：${errorText(error)}`)
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
        console.warn(`dsh-plugin-git: Git 工具清理失败：${errorText(error)}`)
      }
    }
  }
}
