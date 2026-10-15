import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { setImmediate } from 'node:timers/promises'
import { loadTs } from './helpers/load-ts.mjs'

// Hook-only harness. This exercises lifetimes/async ordering, not a DOM or visual acceptance test.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'react' && context.parentURL?.endsWith('/hooks/use-git-status.ts')) {
      const source = ['useState', 'useRef', 'useEffect', 'useCallback'].map(name => `export const ${name} = (...args) => globalThis.__gitHookHarness.${name}(...args);`).join('\n')
      return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})
const { useGitStatus } = await loadTs('src/client/hooks/use-git-status.ts')
const { gitApi } = await loadTs('src/client/api.ts')
const { createLatestRequestScope } = await loadTs('src/client/hooks/latest-request.ts')
const status = (branch, revision = branch) => ({ isGit: true, root: '/repo', branch, head: branch, revision, dirtyFiles: 0, untrackedFiles: 0, conflicts: 0, operationInProgress: false })
const same = (a, b) => a && b && a.length === b.length && a.every((item, i) => Object.is(item, b[i]))

function fixture(path = '/a') {
  const slots = []
  let cursor = 0
  let effects = []
  let dirty = false
  let output
  const requests = []
  const streams = []
  const original = { getStatus: gitApi.getStatus, subscribeEvents: gitApi.subscribeEvents, window: globalThis.window }
  globalThis.window = new EventTarget()
  gitApi.getStatus = (path, signal) => new Promise((resolve, reject) => { requests.push({ path, signal, resolve, reject }) }) // Deliberately ignores AbortSignal.
  gitApi.subscribeEvents = (path, onStatus, onError) => {
    const stream = { path, onStatus, onError, closed: false }
    streams.push(stream)
    return () => { stream.closed = true }
  }
  globalThis.__gitHookHarness = {
    useState(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, update => {
        slots[index].value = typeof update === 'function' ? update(slots[index].value) : update
        dirty = true
      }]
    },
    useRef(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { current: initial }
      return slots[index]
    },
    useCallback(callback, deps) {
      const index = cursor++
      if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { deps, callback }
      return slots[index].callback
    },
    useEffect(effect, deps) {
      const index = cursor++
      if (!slots[index] || !same(slots[index].deps, deps)) {
        const previous = slots[index]
        slots[index] = { deps, cleanup: previous?.cleanup }
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect() })
      }
    },
  }
  const render = () => { cursor = 0; dirty = false; output = useGitStatus(path); return output }
  const flush = () => {
    for (let iteration = 0; iteration < 20; iteration++) {
      const pending = effects
      effects = []
      pending.forEach(effect => effect())
      if (dirty) render()
      else if (!effects.length) return output
    }
    throw new Error('Hook harness did not settle')
  }
  render()
  flush()
  return {
    requests, streams,
    get current() { return output },
    async settle() { await setImmediate(); return flush() },
    switchPath(next) { path = next; const beforeEffects = render(); flush(); return beforeEffects },
    focus() { globalThis.window.dispatchEvent(new Event('focus')); flush() },
    reload() { output.reload(); flush() },
    dispose() {
      slots.forEach(slot => slot?.cleanup?.())
      gitApi.getStatus = original.getStatus
      gitApi.subscribeEvents = original.subscribeEvents
      if (original.window === undefined) delete globalThis.window
      else globalThis.window = original.window
      delete globalThis.__gitHookHarness
    },
  }
}

test('request scope rejects superseded and disposed tickets even if transport ignores abort', () => {
  const scope = createLatestRequestScope('/a')
  const old = scope.begin()
  const latest = scope.begin()
  assert.equal(old.signal.aborted, true)
  assert.equal(old.isCurrent(), false)
  assert.equal(latest.isCurrent(), true)
  scope.invalidate() // SSE publishes a newer status.
  assert.equal(latest.isCurrent(), false)
  const pending = scope.begin()
  scope.dispose()
  assert.equal(pending.isCurrent(), false)
  assert.equal(scope.begin().isCurrent(), false)
})

test('cwd switch immediately masks old state and ignores old HTTP, SSE and errors', async () => {
  const f = fixture()
  try {
    f.requests[0].resolve(status('a'))
    await f.settle()
    assert.equal(f.current.status.branch, 'a')
    const beforeEffects = f.switchPath('/b')
    assert.equal(beforeEffects.status, null)
    assert.equal(beforeEffects.loading, true)
    assert.equal(f.streams[0].closed, true)
    f.streams[0].onStatus(status('stale-a'))
    f.streams[0].onError(new Error('old stream'))
    f.requests[1].resolve(status('b'))
    await f.settle()
    assert.equal(f.current.status.branch, 'b')
    assert.equal(f.current.error, null)
    f.reload()
    const obsolete = f.requests[2]
    f.switchPath('/c')
    obsolete.reject(new Error('old cwd error'))
    await f.settle()
    assert.equal(f.current.error, null)
    assert.equal(f.current.status, null)
  } finally { f.dispose() }
})

test('SSE invalidates pending reload so a late HTTP snapshot cannot overwrite it', async () => {
  const f = fixture()
  try {
    f.streams[0].onStatus(status('live', '2'))
    await f.settle()
    assert.equal(f.requests[0].signal.aborted, true)
    f.requests[0].resolve(status('old', '1'))
    await f.settle()
    assert.equal(f.current.status.revision, '2')
    f.reload()
    f.streams[0].onStatus(status('live-new', '3'))
    f.requests[1].reject(new Error('late reload error'))
    await f.settle()
    assert.equal(f.current.status.revision, '3')
    assert.equal(f.current.error, null)
  } finally { f.dispose() }
})

test('multiple reloads commit only latest result; focus keeps ready state used by open dialogs', async () => {
  const f = fixture()
  try {
    f.requests[0].resolve(status('ready'))
    await f.settle()
    const ready = f.current.status
    f.focus()
    assert.equal(f.current.loading, false, 'background focus refresh must not enter the initial-loading branch')
    assert.equal(f.current.status, ready)
    assert.equal(f.current.isGit, true)
    f.reload()
    assert.equal(f.requests[1].signal.aborted, true)
    f.requests[2].resolve(status('latest'))
    f.requests[1].resolve(status('obsolete'))
    await f.settle()
    assert.equal(f.current.status.branch, 'latest')
    f.focus()
    f.requests[3].reject(new Error('offline'))
    await f.settle()
    assert.equal(f.current.loading, false)
    assert.equal(f.current.status.branch, 'latest')
    assert.equal(f.current.error, 'offline')
  } finally { f.dispose() }
})

test('stream errors are explicit and successful SSE clears them; unmount cancels resources', async () => {
  const f = fixture()
  f.streams[0].onError(new Error('stream interrupted'))
  await f.settle()
  assert.equal(f.current.error, 'stream interrupted')
  f.streams[0].onStatus(status('reconnected'))
  await f.settle()
  assert.equal(f.current.error, null)
  f.reload()
  const pending = f.requests.at(-1)
  f.dispose()
  assert.equal(pending.signal.aborted, true)
  assert.equal(f.streams[0].closed, true)
})
