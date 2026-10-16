import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './helpers/load-ts.mjs'
const { gitApi } = await loadTs('src/client/api.ts')
const { resolveWorkspaceCwd } = await loadTs('src/client/cwd-resolver.ts')
const { createWorktreeOpener } = await loadTs('src/client/workspace-actions.ts')

const snapshots = {
  sessions: { byId: { a: { id: 'a', cwd: 'D:/first', retainedBy: {} }, b: { id: 'b', cwd: 'D:/linked-worktree', retainedBy: { mainView: 1 } } } },
  workspaces: { items: [{ workspaceId: 'first', path: 'D:/first', sessionIds: ['a'] }, { workspaceId: 'second', path: 'D:/second', sessionIds: ['b'] }] },
}
test('cwd belongs to the exact session, not the first workspace', () => {
  assert.equal(resolveWorkspaceCwd({ sessionId: 'b' }, snapshots), 'D:/linked-worktree')
  assert.equal(resolveWorkspaceCwd({ sessionId: 'missing' }, snapshots), '')
  assert.equal(resolveWorkspaceCwd({ cwd: 'D:/explicit', sessionId: 'b' }, snapshots), 'D:/explicit')
  assert.equal(resolveWorkspaceCwd({ session: { cwd: 'D:/override', workspaceId: 'first' } }, snapshots), 'D:/override')
  assert.equal(resolveWorkspaceCwd({}, snapshots), 'D:/linked-worktree')
  assert.equal(resolveWorkspaceCwd({}, { workspaces: snapshots.workspaces }), '')
  assert.equal(resolveWorkspaceCwd({ workspaceId: 'second' }, { workspaces: snapshots.workspaces }), 'D:/second')
})

test('API preserves structured Git errors and never retries mutations', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(JSON.stringify({ ok: false, error: { code: 'switch-failed', message: '真实冲突错误' } }), { status: 200 }) })
  await assert.rejects(gitApi.switchBranch('D:/repo', 'feature'), error => error.message === '真实冲突错误' && error.code === 'switch-failed')
  assert.equal(calls, 1)
})

test('API surfaces HTTP JSON errors and passes AbortSignal', async t => {
  const controller = new AbortController()
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/dsh-git/diff')
    assert.equal(options.signal, controller.signal)
    return new Response(JSON.stringify({ ok: false, error: 'Invalid reference' }), { status: 500 })
  })
  await assert.rejects(gitApi.getDiff('D:/repo', 'bad', undefined, controller.signal), /Invalid reference/)
})

test('API network failure does not repeat a possibly completed operation', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('Network unavailable') })
  await assert.rejects(gitApi.createWorktree('D:/repo', 'task'), /Network unavailable/)
  assert.equal(calls, 1)
})

test('the editor picker asks the host for real editors and sends the chosen one', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push([url, JSON.parse(options.body)])
    if (url === '/dsh-git/editors') return new Response(JSON.stringify({ ok: true, value: [{ command: 'code', label: 'VS Code', goto: true }] }), { status: 200 })
    return new Response(JSON.stringify({ ok: true, editor: 'VS Code', target: 'src/a.ts' }), { status: 200 })
  })
  assert.deepEqual(await gitApi.listEditors(), [{ command: 'code', label: 'VS Code', goto: true }])
  assert.deepEqual(await gitApi.openInEditor('D:/repo', 'src/a.ts', 12, 'code'), { ok: true, editor: 'VS Code', target: 'src/a.ts' })
  assert.deepEqual(await gitApi.openInEditor('D:/repo', 'src/a.ts', undefined, 'system'), { ok: true, editor: 'VS Code', target: 'src/a.ts' })
  assert.deepEqual(calls, [
    ['/dsh-git/editors', {}],
    ['/dsh-git/open-in-editor', { path: 'D:/repo', file: 'src/a.ts', line: 12, editor: 'code' }],
    ['/dsh-git/open-in-editor', { path: 'D:/repo', file: 'src/a.ts', editor: 'system' }], // JSON omits the undefined line
  ])
})

test('without a chosen editor the request keeps probing on the host', async t => {
  const bodies = []
  t.mock.method(globalThis, 'fetch', async (url, options) => { bodies.push(JSON.parse(options.body)); return new Response(JSON.stringify({ ok: true, editor: 'VS Code', target: 'src/a.ts' }), { status: 200 }) })
  await gitApi.openInEditor('D:/repo', 'src/a.ts')
  assert.deepEqual(bodies, [{ path: 'D:/repo', file: 'src/a.ts' }])
})

test('EventSource construction failure is reported without crashing the component effect', t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'EventSource')
  Object.defineProperty(globalThis, 'EventSource', { configurable: true, value: class { constructor() { throw new Error('SSE unavailable') } } })
  t.after(() => { if (original) Object.defineProperty(globalThis, 'EventSource', original); else Reflect.deleteProperty(globalThis, 'EventSource') })
  let error
  const dispose = gitApi.subscribeEvents('D:/repo', () => {}, value => { error = value })
  assert.equal(error.message, 'SSE unavailable')
  assert.doesNotThrow(dispose)
})

test('opening a Worktree really adopts its path and opens the returned workspace', async () => {
  const calls = []
  const open = createWorktreeOpener({
    workspaces: { create: async payload => { calls.push(['create', payload]); return { workspaceId: 'worktree-id' } } },
    uiWorkspace: { openWorkspace: async id => calls.push(['open', id]) },
  })
  await open('D:/worktree')
  assert.deepEqual(calls, [['create', { path: 'D:/worktree' }], ['open', 'worktree-id']])
  await assert.rejects(createWorktreeOpener({})('D:/worktree'), /无法打开/)
})
