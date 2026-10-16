import React, { useEffect, useRef, useSyncExternalStore } from 'react'
import { pasteSidechatDraft, type SidechatDraft } from './sidechat-draft.js'
import { openNewConversationDraft } from './new-conversation-draft.js'

export const GIT_SIDECHAT_TYPE = 'dsh-plugin-git:sidechat'
interface DraftRequest extends SidechatDraft {
  sessionId: string
  finish: (error?: Error) => void
}
interface BridgeRecord {
  open: (sessionId: string, cwd: string, text: string) => Promise<void>
}
const bridges = new WeakMap<object, BridgeRecord>()

/** Mount the existing sidebar's real side conversation, not a second chat implementation. */
export function installGitSidechat(sidebar: any, onReady?: (open: BridgeRecord['open'] | undefined) => void): () => void {
  const queues = new Map<string, DraftRequest[]>()
  const listeners = new Set<() => void>()
  const emit = () => { for (const listener of [...listeners]) listener() }
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
  let unregister: (() => void) | undefined
  let disposed = false
  let installing = false
  let original: any
  let requestSequence = 0

  function DraftedSidechat(props: any) {
    const root = useRef<HTMLDivElement | null>(null)
    const sessionId = props.scope?.sessionId
    const request = useSyncExternalStore(subscribe, () => queues.get(sessionId)?.[0] ?? null, () => null)
    useEffect(() => {
      if (!request || !root.current || !props.visible) return
      const controller = new AbortController()
      pasteSidechatDraft(root.current, request, controller.signal).then(() => request.finish()).catch(error => {
        if (!controller.signal.aborted) request.finish(error instanceof Error ? error : new Error(String(error)))
      })
      return () => controller.abort()
    }, [request, props.visible])
    const Original = original?.component
    return <div className="dsh-git-sidechat-root" ref={root} style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {Original && <Original {...props} />}
    </div>
  }

  const failSession = (sessionId: string, message: string) => {
    for (const request of [...(queues.get(sessionId) ?? [])]) request.finish(new Error(message))
  }
  const sync = () => {
    if (disposed || installing || unregister) return
    original = sidebar.getTab?.('sidechat')
    if (typeof original?.component !== 'function') return
    installing = true
    try {
      unregister = sidebar.registerTab({
        id: GIT_SIDECHAT_TYPE, title: () => 'Git 侧边对话', description: () => 'Git 提示词草稿，不自动发送',
        icon: original.icon, hidden: true, single: true,
        component: DraftedSidechat,
        onClose: (tab: any, scope: any) => {
          failSession(scope.sessionId, '侧边对话已关闭，提示词未发送')
          original.onClose?.(tab, scope)
        },
      })
    } finally { installing = false }
  }
  const unsubscribe = sidebar.subscribe(sync)
  sync()
  const record: BridgeRecord = {
    open(sessionId, cwd, text) {
      if (!unregister || !sidebar.getTab?.(GIT_SIDECHAT_TYPE)) return Promise.reject(new Error('侧边对话组件尚未就绪'))
      if (sidebar.isTabEnabled?.('sidechat') === false || sidebar.isTabEnabled?.(GIT_SIDECHAT_TYPE) === false) return Promise.reject(new Error('侧边对话已在设置中停用'))
      return new Promise<void>((resolve, reject) => {
        let completed = false
        const timer = setTimeout(() => request.finish(new Error('打开侧边对话或填入提示词超时，请检查侧边对话后重试')), 15000)
        const request: DraftRequest = {
          id: globalThis.crypto?.randomUUID?.() ?? `git-draft-${Date.now()}-${++requestSequence}`, text, sessionId,
          finish(error) {
            if (completed) return
            completed = true
            clearTimeout(timer)
            const queue = queues.get(sessionId)
            if (queue) {
              const index = queue.indexOf(request)
              if (index >= 0) queue.splice(index, 1)
              if (!queue.length) queues.delete(sessionId)
            }
            emit()
            error ? reject(error) : resolve()
          },
        }
        const queue = queues.get(sessionId) ?? []
        queue.push(request)
        queues.set(sessionId, queue)
        try {
          // Raw prompts stay in memory, never tab.meta/localStorage. A deterministic
          // tab per parent reuses its draft; opening it cannot submit or interrupt a turn.
          sidebar.openTab({ type: GIT_SIDECHAT_TYPE, id: GIT_SIDECHAT_TYPE, title: 'Git 侧边对话',
            meta: { autoCreate: true }, target: 'right', reveal: true }, { sessionId, cwd })
          emit()
        } catch (error) { request.finish(error instanceof Error ? error : new Error(String(error))) }
      })
    },
  }
  bridges.set(sidebar, record)
  onReady?.(record.open)
  return () => {
    onReady?.(undefined)
    disposed = true
    unsubscribe()
    if (bridges.get(sidebar) === record) bridges.delete(sidebar)
    for (const sessionId of [...queues.keys()]) failSession(sessionId, 'Git 侧边对话接入已卸载')
    unregister?.()
    listeners.clear()
  }
}

export function createGitSidechatOpener(scope: any, resolveOpen?: () => BridgeRecord['open'] | undefined) {
  const openDestination = async (sessionId: string | undefined, cwd: string, text: string): Promise<'sidechat' | 'conversation'> => {
    if (!sessionId || !cwd) throw new Error('请先为当前会话选择项目目录')
    const sidebar = scope.get?.('betterSidebar')
    // Cordis may return a different traceable service proxy in the parent and
    // injected child; production uses a closure, not cross-context object identity.
    const open = resolveOpen ? resolveOpen() : sidebar ? bridges.get(sidebar)?.open : undefined
    const available = sidebar && typeof sidebar.getTab?.('sidechat')?.component === 'function'
      && sidebar.isTabEnabled?.('sidechat') !== false && sidebar.isTabEnabled?.(GIT_SIDECHAT_TYPE) !== false && open
    if (!available) {
      await openNewConversationDraft(scope, cwd, text)
      return 'conversation'
    }
    // Do not create another conversation after opening/pasting has begun: an
    // uncertain failure could otherwise duplicate the reader's prompt.
    await open!(sessionId, cwd, text)
    return 'sidechat'
  }
  const inFlight = new Map<string, Promise<'sidechat' | 'conversation'>>()
  return (sessionId: string | undefined, cwd: string, text: string) => {
    // A double click must not create two sessions or append the same prompt twice.
    // Forget the entry on completion so a later intentional action still works.
    const key = JSON.stringify([sessionId, cwd, text])
    const existing = inFlight.get(key)
    if (existing) return existing
    const pending = openDestination(sessionId, cwd, text).finally(() => {
      if (inFlight.get(key) === pending) inFlight.delete(key)
    })
    inFlight.set(key, pending)
    return pending
  }
}
