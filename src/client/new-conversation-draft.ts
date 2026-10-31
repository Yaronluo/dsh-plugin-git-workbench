/** Fallback independent of sidebar plugins. Use native Session/Input APIs, never send. */
export async function openNewConversationDraft(scope: any, cwd: string, text: string): Promise<void> {
  const sessions = scope.sessions
  const navigation = scope.uiWorkspace
  const conversation = scope.get?.('conversation')
  if (!cwd) throw new Error('Missing project directory; cannot create the Git chat')
  if (typeof sessions?.create !== 'function' || typeof sessions?.using !== 'function'
    || typeof navigation?.openSession !== 'function' || typeof conversation?.input?.for !== 'function') {
    throw new Error('The current host does not support creating a new chat and filling in a draft; refresh the page or upgrade the host and try again')
  }
  // Do not reuse connectWorkspace's blank session: it may contain the reader's draft.
  const sessionId = await sessions.create({ cwd })
  if (typeof sessionId !== 'string' || !sessionId) throw new Error('Failed to create a new chat: no session identifier was returned')
  try {
    await sessions.using(sessionId, { source: 'plugin' }, async (reference: any) => {
      const context = reference.binding?.ctx ?? sessions.scope?.(sessionId)
      if (!context) throw new Error('The new chat is not ready yet; cannot fill in the prompt')
      const input = conversation.input.for(context)
      if (typeof input?.setDraft !== 'function' || typeof input?.state?.getSnapshot !== 'function') throw new Error('The new chat did not provide a draft interface')
      const draft = input.state.getSnapshot().draft || ''
      const next = draft ? `${draft}\n\n${text}` : text
      input.setDraft(next)
      if (input.state.getSnapshot().draft !== next) throw new Error('The new chat did not accept the prompt draft')
      // openSession retains mainView synchronously before the temporary plugin
      // reference is released, preserving the input shell and its unsent draft.
      await navigation.openSession(sessionId)
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`New conversation ${sessionId} was created, but filling in the draft or opening it failed: ${reason}. Open it in the session list to avoid creating it again.`)
  }
}
