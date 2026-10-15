import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './helpers/load-ts.mjs'
const { bindSnapshotSource, resolveWorkspaceCwd } = await loadTs('src/client/cwd-resolver.ts')

// Host WorkspaceController.list is a ClientWorkspaceModel instance, NOT an
// object of arrow functions. Model methods require their original receiver.
class HostWorkspaceModel {
  listeners = new Set()
  snapshotCache = { items: [{ workspaceId: 'worktree', path: 'D:/worktree', sessionIds: ['current'] }] }
  refreshSnapshot() { this.refreshed = true }
  getSnapshot() { this.refreshSnapshot(); return this.snapshotCache }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
}

test('React callback extraction preserves Host model this for getSnapshot and subscribe', () => {
  const model = new HostWorkspaceModel()
  const unsafe = model.getSnapshot
  assert.throws(() => unsafe(), TypeError)
  const adapter = bindSnapshotSource(model, () => ({ items: [] }))
  // Destructure exactly as React does: no accidental receiver from adapter.
  const { getSnapshot, subscribe } = adapter
  assert.equal(getSnapshot(), model.snapshotCache)
  assert.equal(model.refreshed, true)
  let notifications = 0
  const dispose = subscribe(() => notifications++)
  for (const listener of model.listeners) listener()
  assert.equal(notifications, 1)
  dispose()
  assert.equal(model.listeners.size, 0)
  assert.equal(resolveWorkspaceCwd({ sessionId: 'current' }, { workspaces: getSnapshot() }), 'D:/worktree')
})

test('absent sources have a stable snapshot and safe subscription', () => {
  const snapshot = { byId: {} }
  const adapter = bindSnapshotSource(undefined, () => snapshot)
  assert.equal(adapter.getSnapshot(), adapter.getSnapshot())
  assert.equal(adapter.getServerSnapshot(), snapshot)
  assert.doesNotThrow(adapter.subscribe(() => {}))
})
