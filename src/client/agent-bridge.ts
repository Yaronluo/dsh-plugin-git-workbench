/** Git prompts are drafted in the owning session's side conversation.
 * Never auto-send, invoke an LLM, or silently fall back to the clipboard.
 */

/** Everything the prompt builders need. All fields are optional; absence is reported honestly. */
export interface PromptContext {
  cwd?: string
  branch?: string
  upstream?: string
  ahead?: number
  behind?: number
  /** Paths by section, already formatted for a prompt. */
  staged?: readonly string[]
  unstaged?: readonly string[]
  untracked?: readonly string[]
  conflicts?: readonly string[]
  /** One-line summary such as `3 个文件 +12 -2`. */
  summary?: string
  /** Unified diff text. Bounded by `truncatePatch`. */
  patch?: string
}

export const PATCH_LIMIT = 12_000
export const TRUNCATION_NOTE = '\n…（补丁过长，已截断；如需完整内容请让我逐个文件查看）'

/** An inline fence would break out of our own code block, so a longer fence is used. */
export function fence(text: string): string {
  const longest = (text.match(/`{3,}/g) ?? []).reduce((max, run) => Math.max(max, run.length), 2)
  const marker = '`'.repeat(Math.max(3, longest + 1))
  return `${marker}diff\n${text}\n${marker}`
}

export function truncatePatch(patch: string, limit = PATCH_LIMIT): string {
  if (patch.length <= limit) return patch
  return patch.slice(0, limit) + TRUNCATION_NOTE
}

function pathList(label: string, paths: readonly string[] | undefined, empty: string): string {
  if (!paths || paths.length === 0) return `- ${label}：${empty}`
  const shown = paths.slice(0, 40).map(path => `  - ${path}`)
  if (paths.length > shown.length) shown.push(`  - …共 ${paths.length} 个文件`)
  return `- ${label}（${paths.length}）：\n${shown.join('\n')}`
}

/** The repository state on its own: this is what "注入 Git 上下文" sends. */
export function buildContextText(context: PromptContext): string {
  const branch = context.branch || '（未知分支）'
  const tracking = context.upstream
    ? `，跟踪 ${context.upstream}${context.ahead ? `，领先 ${context.ahead} 个提交` : ''}${context.behind ? `，落后 ${context.behind} 个提交` : ''}`
    : '，没有上游分支'
  return [
    '以下是我当前 Git 仓库的状态，请先阅读它，然后等我的问题：',
    '',
    ...(context.cwd ? [`- 仓库目录：${context.cwd}`] : []),
    `- 当前分支：${branch}${tracking}`,
    context.summary ? `- 变更概况：${context.summary}` : '- 变更概况：（未知）',
    pathList('已暂存', context.staged, '（空）'),
    pathList('未暂存', context.unstaged, '（空）'),
    pathList('未跟踪', context.untracked, '（空）'),
    pathList('冲突', context.conflicts, '（无）'),
  ].join('\n')
}

function stagedPatchBlock(context: PromptContext): string {
  if (!context.patch) return '（暂存区没有可展示的补丁）'
  return fence(truncatePatch(context.patch))
}

export function buildCommitPrompt(context: PromptContext): string {
  return [
    buildContextText(context),
    '',
    '请根据上面**已暂存**的改动写一条提交信息。要求：',
    '1. 第一行是简洁的祈使句标题，不超过 72 个字符，不要以句号结尾；',
    '2. 如果有必要，空一行后写正文，说明「为什么」而不是逐条复述改了什么；',
    '3. 使用与仓库现有提交信息一致的语言（我会在下面附上最近几条提交信息）。',
    '4. 只输出提交信息本身，不要解释、不要加代码块、不要用引号包起来。',
    '',
    '暂存区的补丁：',
    stagedPatchBlock(context),
  ].join('\n')
}

export function buildReviewPrompt(context: PromptContext): string {
  return [
    buildContextText(context),
    '',
    '请审查这些改动，重点看：正确性缺陷、边界条件、可能的数据丢失或安全问题、',
    '以及是否漏了测试或文档。按严重程度排序，给出文件与行号，并说明给出建议的理由。',
    '如果某个改动看起来没问题，直接说没问题，不要为了凑数提建议。',
    '',
    '当前比较范围的补丁：',
    context.patch ? fence(truncatePatch(context.patch)) : '（当前范围没有可展示的补丁）',
  ].join('\n')
}

export function buildExplainPrompt(file: { path: string; patch: string; statusLabel?: string }): string {
  const status = file.statusLabel ? `（${file.statusLabel}）` : ''
  return [
    `请解释 \`${file.path}\`${status} 的这些改动：改了什么、为什么可能这样改、有哪些影响面。`,
    '用中文回答，先给一句话结论，再逐块说明。如果补丁里有需要我注意的风险，请指出来。',
    '',
    '补丁：',
    fence(truncatePatch(file.patch)),
  ].join('\n')
}

export interface DeliveryResult {
  ok: boolean
  mode?: 'drafted' | 'new-conversation'
  error?: string
}

/** Resolve only after the right-side conversation has accepted the draft. */
export async function deliverPrompt(scope: any, sessionId: string | undefined, text: string): Promise<DeliveryResult> {
  if (!sessionId) return { ok: false, error: '当前没有可用的会话，无法打开侧边对话' }
  if (typeof scope?.onOpenGitSidechat !== 'function') return { ok: false, error: 'Git 侧边对话尚未就绪，请启用侧边栏插件后刷新页面' }
  try {
    const destination = await scope.onOpenGitSidechat(sessionId, scope.cwd || '', text)
    return { ok: true, mode: destination === 'conversation' ? 'new-conversation' : 'drafted' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '无法打开侧边对话或填入提示词' }
  }
}
