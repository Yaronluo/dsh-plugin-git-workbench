import { useMemo, useSyncExternalStore } from 'react'

const EMPTY_SESSIONS = { byId: {} as Record<string, any> }
const EMPTY_WORKSPACES = { items: [] as any[] }
const noSubscribe = (_listener: () => void) => () => {}
const emptySessions = () => EMPTY_SESSIONS
const emptyWorkspaces = () => EMPTY_WORKSPACES
const identity = (value: any) => value

function text(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : ''
}

/** Resolve only an explicitly identified session/workspace; never guess the first repo. */
export function resolveWorkspaceCwd(props: any = {}, snapshots: any = {}): string {
  const direct = text(props.cwd) || text(props.session?.cwd) || text(props.workspace?.path)
  if (direct) return direct
  const sessions = snapshots.sessions || EMPTY_SESSIONS
  const workspaces = snapshots.workspaces?.items || []
  const requestedSession = text(props.sessionId) || text(props.session?.sessionId) || text(props.session?.id)
  // A root/sidebar entry can follow the one main-view owner. An explicit session
  // that has not loaded must NOT fall through to some other retained session.
  const mainSessions = Object.values(sessions.byId || {}).filter((s: any) => (s.retainedBy?.mainView || 0) > 0) as any[]
  const sessionId = requestedSession || (mainSessions.length === 1 ? text(mainSessions[0].id) : '')
  if (sessionId) {
    const cwd = text(sessions.byId?.[sessionId]?.cwd)
    if (cwd) return cwd
    const owners = workspaces.filter((w: any) => w.sessionIds?.includes(sessionId))
    if (owners.length === 1) return text(owners[0].path)
    // Unknown explicit sessions fail closed, rather than targeting the main repo.
    if (requestedSession) return ''
  }
  const workspaceId = text(props.workspaceId) || text(props.session?.workspaceId) || text(props.workspace?.workspaceId)
  if (workspaceId) return text(workspaces.find((w: any) => w.workspaceId === workspaceId)?.path)
  return ''
}

/** React invokes callbacks without their receiver. Host sources may use class methods. */
export function bindSnapshotSource(source: any, fallback: () => any) {
  return {
    subscribe: source ? (listener: () => void) => source.subscribe(listener) : noSubscribe,
    getSnapshot: source ? () => source.getSnapshot() : fallback,
    getServerSnapshot: fallback,
  }
}

/** Use the Slot's reactive standard sources (also supports betterSidebar source injection). */
export function useWorkspaceContext(props: any = {}): { cwd: string; sessionId?: string } {
  const sessionSource = useMemo(() => bindSnapshotSource(props.gitSessionsSource, emptySessions), [props.gitSessionsSource])
  const workspaceSource = useMemo(() => bindSnapshotSource(props.gitWorkspacesSource, emptyWorkspaces), [props.gitWorkspacesSource])
  const fallbackSessions = useSyncExternalStore(sessionSource.subscribe, sessionSource.getSnapshot, sessionSource.getServerSnapshot)
  const fallbackWorkspaces = useSyncExternalStore(workspaceSource.subscribe, workspaceSource.getSnapshot, workspaceSource.getServerSnapshot)
  // Hook capabilities are stable for a mounted Slot entry. Keep calls unconditional
  // with respect to current session, loading state, or the presence of a cwd.
  const sessions = props.useSessions ? props.useSessions(identity) : fallbackSessions
  const workspaces = props.useWorkspaces ? props.useWorkspaces(identity) : fallbackWorkspaces
  const explicitId = text(props.sessionId) || text(props.session?.sessionId) || text(props.session?.id)
  const main = Object.values(sessions?.byId || {}).filter((session: any) => (session.retainedBy?.mainView || 0) > 0) as any[]
  const candidateId = explicitId || (main.length === 1 ? text(main[0].id) : '')
  const cwd = resolveWorkspaceCwd(props, { sessions, workspaces })
  // A root control may explicitly pick a different workspace than the retained
  // Session. Do not open that repo's panel in the unrelated Session's sidebar.
  const candidateCwd = candidateId ? resolveWorkspaceCwd({ sessionId: candidateId }, { sessions, workspaces }) : ''
  const normalize = (path: string) => {
    const value = path.replace(/\\/g, '/').replace(/\/$/, '')
    return /^[a-z]:\//i.test(value) || value.startsWith('//') ? value.toLowerCase() : value
  }
  return { cwd, sessionId: candidateId && candidateCwd && normalize(candidateCwd) === normalize(cwd) ? candidateId : undefined }
}

export function useWorkspaceCwd(props: any = {}): string {
  return useWorkspaceContext(props).cwd
}
