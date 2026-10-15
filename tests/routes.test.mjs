import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { loadTs } from './helpers/load-ts.mjs'
const { registerRoutes } = await loadTs('src/host/routes.ts')

class Response extends EventEmitter {
  destroyed = false
  writableEnded = false
  writableLength = 0
  status = 0
  chunks = []
  writeHead(status, headers) { this.status = status; this.headers = headers }
  write(chunk) { this.chunks.push(chunk); this.emit('write'); return true }
  end(chunk) { if (chunk) this.chunks.push(chunk); this.writableEnded = true; this.emit('close') }
  destroy() { this.destroyed = true; this.emit('close') }
  events(name) { return this.chunks.filter(chunk => chunk.startsWith(`event: ${name}\n`)) }
}
function setup(service, options = {}) {
  let handler
  let removed = false
  const dispose = registerRoutes({ webServer: { register: route => { handler = route.handler; return () => { removed = true } } } }, service, options)
  return { handler, dispose, get removed() { return removed } }
}
async function request(handler, path, payload, method = 'POST') {
  const req = new EventEmitter()
  req.url = path; req.method = method
  const res = new Response()
  const running = handler(req, res)
  if (method === 'POST') { req.emit('data', Buffer.from(JSON.stringify(payload))); req.emit('end') }
  await running
  return res
}
function nextEvent(res, name, total = 1) {
  if (res.events(name).length >= total) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { res.off('write', changed); reject(new Error(`Timed out waiting for ${name}`)) }, 2000)
    function changed() { if (res.events(name).length >= total) { clearTimeout(timeout); res.off('write', changed); resolve() } }
    res.on('write', changed)
  })
}
const baseline = { isGit: true, root: 'R', branch: 'main', head: 'abc', dirtyFiles: 1, untrackedFiles: 1, conflicts: 0, operationInProgress: false, revision: 'one' }

test('routes reject missing cwd and malformed field types without calling Git', async t => {
  let calls = 0
  const runtime = setup({ status: async () => { calls++; return baseline } })
  t.after(runtime.dispose)
  for (const payload of [{}, { path: '' }, null, [], { path: 123 }]) {
    const res = await request(runtime.handler, '/dsh-git/status', payload)
    assert.equal(res.status, 400)
  }
  assert.equal((await request(runtime.handler, '/dsh-git/switch', { path: 'R', branch: ['--force'] })).status, 400)
  assert.equal(calls, 0)
})

test('routes preserve meaningful Git failures', async t => {
  const runtime = setup({ diff: async () => { throw new Error('Unknown upstream ref') } })
  t.after(runtime.dispose)
  const res = await request(runtime.handler, '/dsh-git/diff', { path: 'R', base: 'bad' })
  assert.equal(res.status, 500)
  assert.equal(JSON.parse(res.chunks.join('')).error, 'Unknown upstream ref')
})

test('SSE sends content-only and conflict-only changes and closes cleanly', async t => {
  let value = { ...baseline }
  const runtime = setup({ status: async () => ({ ...value }) }, { pollIntervalMs: 10 })
  t.after(runtime.dispose)
  const res = await request(runtime.handler, '/dsh-git/events?path=R', undefined, 'GET')
  await nextEvent(res, 'status')
  value = { ...value, revision: 'two' }
  await nextEvent(res, 'status', 2)
  value = { ...value, conflicts: 1, untrackedFiles: 0, operationInProgress: true }
  await nextEvent(res, 'status', 3)
  assert.match(res.events('status')[2], /"conflicts":1/)
  runtime.dispose()
  assert.equal(res.writableEnded, true)
  assert.equal(runtime.removed, true)
})

test('SSE coalesces same-path work, blocks overlap and ignores completion after disposal', async () => {
  let calls = 0, release
  const pending = new Promise(resolve => { release = resolve })
  const runtime = setup({ status: async () => { calls++; return pending } }, { pollIntervalMs: 10 })
  const first = await request(runtime.handler, '/dsh-git/events?path=R', undefined, 'GET')
  const second = await request(runtime.handler, '/dsh-git/events?path=R', undefined, 'GET')
  assert.equal(calls, 1)
  runtime.dispose()
  release(baseline)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(first.events('status').length, 0)
  assert.equal(second.events('status').length, 0)
})

test('SSE reports poll errors and republishes a recovery snapshot', async t => {
  let failed = true
  const runtime = setup({ status: async () => { if (failed) throw new Error('Git locked'); return baseline } }, { pollIntervalMs: 10 })
  t.after(runtime.dispose)
  const res = await request(runtime.handler, '/dsh-git/events?path=R', undefined, 'GET')
  await nextEvent(res, 'status-error')
  failed = false
  await nextEvent(res, 'status')
  assert.match(res.events('status-error')[0], /Git locked/)
})
