import { GIT_CONVERSATION_VIEW, GIT_WORKBENCH_TITLE, noteGitViewError } from './panels/navigation.js'

export const GIT_SESSION_BRIDGE_SLOT = 'dsh-plugin-git.session-navigation'

/**
 * Use the same public store handle as the native Session header. Cordis/Slots then
 * supply scoped actions; no global storage writes, DOM clicks, or host DOM moves.
 */
export function conversationViewStore(slots: any): any {
  const entry = slots.entries('conversation.session.header').find((item: any) => item.store)
  if (!entry?.store) throw new Error('当前宿主未提供会话标签状态，无法挂载 Git 工作台')
  return entry.store
}

export function installGitConversationView(scope: any, components: { Page: any; Bridge: any }, shared: any): () => void {
  const slots = scope.slots
  const disposers: Array<() => void> = []
  const failures = new Map<string, string>()
  const publishErrors = () => noteGitViewError([...failures.values()].join('；'))
  const guarded = (key: string, register: () => (() => void)) => {
    try {
      const dispose = register()
      failures.delete(key)
      publishErrors()
      return dispose
    } catch (error) {
      failures.set(key, error instanceof Error ? error.message : String(error))
      publishErrors()
      console.error('[dsh-plugin-git] Git 工作台挂载失败：', error)
      return () => { failures.delete(key); publishErrors() }
    }
  }
  disposers.push(slots.inject('conversation.view', () => guarded('conversation.view', () => slots.register({
    name: 'conversation.view', id: GIT_CONVERSATION_VIEW, label: () => GIT_WORKBENCH_TITLE, order: 40,
    inject: () => shared,
  }, components.Page))))
  for (const name of ['conversation.session.header.utilities', GIT_SESSION_BRIDGE_SLOT]) {
    disposers.push(slots.inject(name, () => guarded(name, () => {
      const store = conversationViewStore(slots)
      return slots.register({
        name, id: 'dsh-plugin-git-navigation', order: 40, store,
        inject: (sessionId: string, actions: any) => ({
          ...shared,
          selectConversationView: (view: string) => actions.setView(view),
          // The native views area intentionally renders null in a blank Session.
          // Use the sanctioned composer chain only while Git is selected there;
          // its overlay fallback keeps the original draft/composer mounted.
          mountBlankWorkbench: () => slots.inject('conversation.composer', () => slots.register({
            name: 'conversation.composer', priority: -100,
            select: (owner: any) => owner.sessionId === sessionId && owner.session?.blank === true ? {} : null,
            inject: () => ({ ...shared, onReturnToConversation: () => actions.setView('chat') }),
          }, components.Page)),
        }),
      }, components.Bridge)
    })))
  }
  return () => { for (const dispose of disposers.reverse()) dispose() }
}
