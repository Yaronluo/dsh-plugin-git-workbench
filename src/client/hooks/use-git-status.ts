import { useState, useEffect, useCallback, useRef } from 'react'
import type { RepoStatus } from '../../core/types.js'
import { gitApi } from '../api.js'
import { createLatestRequestScope } from './latest-request.js'

/** A request may publish only while its cwd, request and SSE generation are current. */
export function useGitStatus(path?: string) {
  const [snapshot, setSnapshot] = useState<{ path?: string; status: RepoStatus | null; loading: boolean; error: string | null }>({ path, status: null, loading: !!path, error: null })
  const active = useRef<ReturnType<typeof createLatestRequestScope> | null>(null)

  const reload = useCallback(() => {
    const scope = active.current
    if (!scope || scope.disposed || scope.path !== path || !path) return
    const request = scope.begin()
    // Background refresh must not unmount dialogs or reset forms.
    setSnapshot(previous => ({ ...previous, loading: !previous.status, error: null }))
    gitApi.getStatus(path, request.signal).then(status => {
      if (request.isCurrent()) {
        setSnapshot({ path, status, loading: false, error: null })
      }
    }).catch(error => {
      if (request.isCurrent()) {
        setSnapshot(previous => ({ ...previous, loading: false, error: error instanceof Error ? error.message : String(error) }))
      }
    })
  }, [path])

  useEffect(() => {
    const scope = createLatestRequestScope(path)
    active.current = scope
    setSnapshot({ path, status: null, loading: !!path, error: null })
    if (!path) return () => scope.dispose()
    reload()
    const unsubscribe = gitApi.subscribeEvents(path, status => {
      if (scope.disposed) return
      // An SSE snapshot is newer than any pending HTTP reload.
      scope.invalidate()
      setSnapshot({ path, status, loading: false, error: null })
    }, error => {
      if (!scope.disposed) setSnapshot(previous => ({ ...previous, error: error instanceof Error ? error.message : String(error) }))
    })
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => {
      scope.dispose()
      unsubscribe()
      window.removeEventListener('focus', onFocus)
    }
  }, [path, reload])

  // Never expose the previous cwd's state even during the render before effect cleanup.
  const current = snapshot.path === path ? snapshot : { status: null, loading: !!path, error: null }
  return { status: current.status, isGit: current.status?.isGit ?? false, loading: current.loading, error: current.error, reload }
}
