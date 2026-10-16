const HERO_SLOT = 'conversation.hero.agentPreset'

/** Deliberately decorate the existing preset seat, retaining its original UI and injections. */
export function installHeroControls(slots: any, decorate: (component: any) => any, children?: Record<string, { kind: string; scope: string }>): () => void {
  let original: any
  let unregister: (() => void) | undefined
  const ownComponents = new Set<any>()
  let disposed = false
  const sync = () => {
    if (disposed) return
    const next = slots.entries(HERO_SLOT)
      .filter((entry: any) => !ownComponents.has(entry.component))
      .sort((a: any, b: any) => (a.options?.priority ?? 0) - (b.options?.priority ?? 0))[0]
    if (next === original) return
    unregister?.()
    unregister = undefined
    original = next
    if (!next) return
    // Redeclaring another entry's owned children is not legal. This seat currently
    // has no children; fail explicitly if a future Host changes that contract.
    if (next.children && Object.keys(next.children).length) {
      console.warn('Git inline controls: preset seat now owns child slots; leaving the original unchanged')
      return
    }
    const component = decorate(next.component)
    ownComponents.add(component)
    unregister = slots.register({
      ...next.options,
      name: HERO_SLOT,
      priority: (next.options?.priority ?? 0) - 1,
      inject: next.inject,
      locale: next.locale,
      store: next.store,
      ...(children ? { children } : {}),
    }, component)
  }
  const unsubscribe = slots.subscribe(HERO_SLOT, sync)
  sync()
  return () => { disposed = true; unsubscribe(); unregister?.(); ownComponents.clear() }
}
