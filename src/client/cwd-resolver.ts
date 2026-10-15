export function resolveWorkspaceCwd(props: any, scope?: any): string {
  // 1. Direct props
  if (props?.cwd && typeof props.cwd === 'string' && props.cwd.trim()) {
    return props.cwd.trim()
  }
  if (props?.workspace?.path && typeof props.workspace.path === 'string') {
    return props.workspace.path.trim()
  }
  if (props?.session?.cwd && typeof props.session.cwd === 'string') {
    return props.session.cwd.trim()
  }

  // 2. Injected cwdOf resolver
  if (props?.cwdOf && typeof props.cwdOf === 'function') {
    const res = props.cwdOf(props.sessionId)
    if (res && typeof res === 'string') return res.trim()
  }

  // 3. Resolve from scope.sessions
  const targetScope = scope || (typeof window !== 'undefined' ? (window as any).__dsh_scope__ : undefined)
  if (targetScope?.sessions?.list) {
    try {
      const snap = targetScope.sessions.list.getSnapshot()
      if (props?.sessionId && snap?.byId?.[props.sessionId]?.cwd) {
        return snap.byId[props.sessionId].cwd
      }
      // MainView session
      for (const id in snap?.byId || {}) {
        const item = snap.byId[id]
        if (item?.retainedBy?.mainView && item.cwd) return item.cwd
      }
      // Any session
      for (const id in snap?.byId || {}) {
        if (snap.byId[id]?.cwd) return snap.byId[id].cwd
      }
    } catch {}
  }

  // 4. Resolve from targetScope.workspaces
  if (targetScope?.workspaces?.list) {
    try {
      const items = targetScope.workspaces.list.getSnapshot()?.items || []
      if (items.length > 0 && items[0]?.path) return items[0].path
    } catch {}
  }

  // 5. Resolve from targetScope.uiWorkspace
  if (targetScope?.uiWorkspace?.activeWorkspace?.path) {
    return targetScope.uiWorkspace.activeWorkspace.path
  }

  return ''
}
