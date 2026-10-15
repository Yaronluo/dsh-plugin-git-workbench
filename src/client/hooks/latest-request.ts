/** Repository-local request lifetime. Cancellation alone is insufficient when a transport ignores it. */
export function createLatestRequestScope(path?: string) {
  let disposed = false
  let generation = 0
  let controller: AbortController | undefined
  const invalidate = () => {
    ++generation
    controller?.abort()
  }
  return {
    path,
    get disposed() { return disposed },
    invalidate,
    begin() {
      invalidate()
      controller = new AbortController()
      const request = controller
      const version = generation
      if (disposed) request.abort()
      return {
        signal: request.signal,
        isCurrent: () => !disposed && version === generation && !request.signal.aborted,
      }
    },
    dispose() { disposed = true; invalidate() },
  }
}
