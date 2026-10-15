import { useState, useEffect, useCallback } from 'react'
import type { RepoStatus } from '../../core/types.js'
import { gitApi } from '../api.js'

export function useGitStatus(path?: string) {
  const [status, setStatus] = useState<RepoStatus | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const reload = useCallback(() => {
    if (!path) {
      setStatus(null)
      setLoading(false)
      return
    }

    setLoading(true)
    gitApi
      .getStatus(path)
      .then(res => {
        setStatus(res)
      })
      .catch(() => {
        setStatus(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [path])

  useEffect(() => {
    reload()

    if (!path) return

    // Live SSE stream
    const unsubscribe = gitApi.subscribeEvents(path, updatedStatus => {
      setStatus(updatedStatus)
    })

    // Window focus refresh
    const onFocus = () => {
      reload()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      unsubscribe()
      window.removeEventListener('focus', onFocus)
    }
  }, [path, reload])

  return {
    status,
    isGit: status?.isGit ?? false,
    loading,
    reload,
  }
}
