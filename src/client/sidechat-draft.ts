export interface SidechatDraft {
  id: string
  text: string
  inserted?: { element: HTMLTextAreaElement; value: string }
}

/** Compatibility adapter scoped to OUR tab wrapper, never a global composer selector.
 * The sidebar exposes tab rendering but not a draft setter. Dispatch the same input
 * event as typing, bypassing React's value tracker via the native property setter.
 * No key/send event is synthesized. Keep the marker across StrictMode effect replay.
 */
export function pasteSidechatDraft(root: HTMLElement, draft: SidechatDraft, signal: AbortSignal, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false
    let frame = 0
    const view = root.ownerDocument.defaultView!
    // The textarea value setter normalizes CRLF and bare CR to LF. Compare and
    // replay the normalized draft, otherwise valid Windows patches look refused.
    const text = draft.text.replace(/\r\n?/g, '\n')
    const finish = (error?: Error) => {
      if (done) return
      done = true
      observer.disconnect()
      clearTimeout(timer)
      if (frame) view.cancelAnimationFrame(frame)
      signal.removeEventListener('abort', abort)
      error ? reject(error) : resolve()
    }
    const abort = () => finish(new Error('侧边对话已关闭或切换'))
    const observer = new view.MutationObserver(() => insert())
    const timer = setTimeout(() => finish(new Error('侧边对话输入框尚未就绪，请检查侧边对话后重试')), timeoutMs)
    const insert = () => {
      if (done || signal.aborted) return
      const input = root.querySelector('textarea')
      if (!input || input.disabled || input.readOnly) return
      const previous = draft.inserted
      const replay = previous?.element === input
      if (replay && !input.value.startsWith(previous.value)) {
        finish(new Error('先前填入的提示词已被编辑或未被接受，请检查侧边对话；未重复追加'))
        return
      }
      const value = replay ? input.value : (input.value ? `${input.value}\n\n${text}` : text)
      if (!replay) {
        const setter = Object.getOwnPropertyDescriptor(view.HTMLTextAreaElement.prototype, 'value')?.set
        if (!setter) { finish(new Error('当前侧边对话不支持自动填入提示词')); return }
        draft.inserted = { element: input, value }
        setter.call(input, value)
        input.dispatchEvent(new view.Event('input', { bubbles: true }))
      }
      observer.disconnect()
      frame = view.requestAnimationFrame(() => {
        if (signal.aborted || done) return
        if (!input.value.startsWith(value)) { finish(new Error('侧边对话未接受提示词或草稿已被编辑，请检查输入框')); return }
        input.focus()
        input.setSelectionRange(input.value.length, input.value.length)
        finish()
      })
    }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) { abort(); return }
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'readonly'] })
    insert()
  })
}
