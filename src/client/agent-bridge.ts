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
export const TRUNCATION_NOTE = '\n… (the patch is too long and was truncated; ask me to view it file by file if you need the full content)'

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
  if (!paths || paths.length === 0) return `- ${label}:${empty}`
  const shown = paths.slice(0, 40).map(path => `  - ${path}`)
  if (paths.length > shown.length) shown.push(`  - …total ${paths.length} files`)
  return `- ${label}(${paths.length}):\n${shown.join('\n')}`
}

/** The repository state on its own: this is what "注入 Git 上下文" sends. */
export function buildContextText(context: PromptContext): string {
  const branch = context.branch || '(unknown branch)'
  const tracking = context.upstream
    ? `, tracking ${context.upstream}${context.ahead ? `, ahead ${context.ahead} commits` : ''}${context.behind ? `, behind ${context.behind} commits` : ''}`
    : ', no upstream branch'
  return [
    'Below is the current state of my Git repository, please read it first, then wait for my questions:',
    '',
    ...(context.cwd ? [`- Repository directory:${context.cwd}`] : []),
    `- Current branch:${branch}${tracking}`,
    context.summary ? `- Change summary:${context.summary}` : '- Change summary: (unknown)',
    pathList('Staged', context.staged, '(empty)'),
    pathList('Unstaged', context.unstaged, '(empty)'),
    pathList('Untracked', context.untracked, '(empty)'),
    pathList('Conflict', context.conflicts, '(none)'),
  ].join('\n')
}

function stagedPatchBlock(context: PromptContext): string {
  if (!context.patch) return '(no patch to display for the index)'
  return fence(truncatePatch(context.patch))
}

export function buildCommitPrompt(context: PromptContext): string {
  return [
    buildContextText(context),
    '',
    'Please write a commit message based on the **staged** changes above. Requirements:',
    '1. The first line is a concise imperative subject, no more than 72 characters, not ending with a period;',
    '2. If necessary, leave a blank line and then write the body, explaining "why" instead of restating what changed item by item;',
    '3. Use the same language as the repository\'s existing commit messages (I will include the most recent ones below).',
    '4. Output only the commit message itself: no explanations, no code blocks, no quotes around it.',
    '',
    'Staged patch:',
    stagedPatchBlock(context),
  ].join('\n')
}

export function buildReviewPrompt(context: PromptContext): string {
  return [
    buildContextText(context),
    '',
    'Please review these changes, focusing on: correctness defects, edge cases, possible data loss or security issues,',
    'and whether tests or docs are missing. Sort by severity, give the file and line number, and explain why you are making each suggestion.',
    'If a change looks fine, just say it is fine, do not make suggestions just to fill space.',
    '',
    'Patch for the current comparison range: ',
    context.patch ? fence(truncatePatch(context.patch)) : '(no patch to display for the current range)',
  ].join('\n')
}

export function buildExplainPrompt(file: { path: string; patch: string; statusLabel?: string }): string {
  const status = file.statusLabel ? `(${file.statusLabel})` : ''
  return [
    `Please explain \`${file.path}\`${status} these changes: what changed, why it may have been changed this way, and what the impact is.`,
    'Answer in English: give a one-sentence conclusion first, then explain block by block. If the patch contains risks I should pay attention to, point them out.',
    '',
    'Patch:',
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
  if (!sessionId) return { ok: false, error: 'No session is available; cannot open the side chat' }
  if (typeof scope?.onOpenGitSidechat !== 'function') return { ok: false, error: 'The Git side chat is not ready yet; enable the sidebar plugin and refresh the page' }
  try {
    const destination = await scope.onOpenGitSidechat(sessionId, scope.cwd || '', text)
    return { ok: true, mode: destination === 'conversation' ? 'new-conversation' : 'drafted' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Cannot open the side chat or fill in the prompt' }
  }
}
