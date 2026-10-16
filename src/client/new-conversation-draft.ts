/** Fallback independent of sidebar plugins. Use native Session/Input APIs, never send. */
export async function openNewConversationDraft(scope: any, cwd: string, text: string): Promise<void> {
  const sessions = scope.sessions
  const navigation = scope.uiWorkspace
  const conversation = scope.get?.('conversation')
  if (!cwd) throw new Error('缺少项目目录，无法创建 Git 对话')
  if (typeof sessions?.create !== 'function' || typeof sessions?.using !== 'function'
    || typeof navigation?.openSession !== 'function' || typeof conversation?.input?.for !== 'function') {
    throw new Error('当前宿主不支持新建对话并填入草稿，请刷新页面或升级宿主后重试')
  }
  // Do not reuse connectWorkspace's blank session: it may contain the reader's draft.
  const sessionId = await sessions.create({ cwd })
  if (typeof sessionId !== 'string' || !sessionId) throw new Error('创建新对话失败：未返回会话标识')
  try {
    await sessions.using(sessionId, { source: 'plugin' }, async (reference: any) => {
      const context = reference.binding?.ctx ?? sessions.scope?.(sessionId)
      if (!context) throw new Error('新对话尚未就绪，无法填入提示词')
      const input = conversation.input.for(context)
      if (typeof input?.setDraft !== 'function' || typeof input?.state?.getSnapshot !== 'function') throw new Error('新对话未提供草稿接口')
      const draft = input.state.getSnapshot().draft || ''
      const next = draft ? `${draft}\n\n${text}` : text
      input.setDraft(next)
      if (input.state.getSnapshot().draft !== next) throw new Error('新对话未接受提示词草稿')
      // openSession retains mainView synchronously before the temporary plugin
      // reference is released, preserving the input shell and its unsent draft.
      await navigation.openSession(sessionId)
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`新对话 ${sessionId} 已创建，但填入草稿或打开失败：${reason}。请在会话列表中打开它，避免重复新建。`)
  }
}
