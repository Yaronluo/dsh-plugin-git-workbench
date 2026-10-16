import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync, rmSync } from 'node:fs'
import { loadTs } from './helpers/load-ts.mjs'
const { registerRoutes, clientReportPath } = await loadTs('src/host/routes.ts')

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
  // Without an editor stand-in the real launcher is built, and the real one warms an icon cache
  // by spawning the shell. Route tests care about routing, so keep the machine out of it.
  const withEditor = { editorLauncher: { open: async () => ({ ok: true }), listEditors: async () => [], reveal: async () => ({ ok: true }) }, ...options }
  const dispose = registerRoutes({ webServer: { register: route => { handler = route.handler; return () => { removed = true } } } }, service, withEditor)
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

test('mutation routes require an explicit conflict side and operation step', async t => {
  const calls = []
  const runtime = setup({
    resolveConflict: async (...args) => { calls.push(args); return { ok: true } },
    operationStep: async (...args) => { calls.push(args); return { ok: true } },
  })
  t.after(runtime.dispose)
  for (const value of [undefined, null, '', 'invalid', true]) {
    assert.equal((await request(runtime.handler, '/dsh-git/conflict-resolve', { path: 'R', file: 'a', side: value })).status, 400)
    assert.equal((await request(runtime.handler, '/dsh-git/operation-step', { path: 'R', step: value })).status, 400)
  }
  assert.deepEqual(calls, [])
  assert.equal((await request(runtime.handler, '/dsh-git/conflict-resolve', { path: 'R', file: 'a', side: 'ours' })).status, 200)
  assert.equal((await request(runtime.handler, '/dsh-git/operation-step', { path: 'R', step: 'abort' })).status, 200)
  assert.deepEqual(calls, [['R', 'a', 'ours'], ['R', 'abort']])
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

test('the editor route validates its payload before touching the filesystem', async t => {
  const opened = []
  const runtime = setup({}, { editorLauncher: { open: async target => { opened.push(target); return { ok: true, editor: 'VS Code', target: target.file } } } })
  t.after(runtime.dispose)
  for (const payload of [{}, { path: '' }, { path: 'R', line: 0 }, { path: 'R', line: 1.5 }, { path: 'R', file: 42 }]) {
    const res = await request(runtime.handler, '/dsh-git/open-in-editor', payload)
    assert.equal(res.status, 400, JSON.stringify(payload))
  }
  assert.deepEqual(opened, [])
  const ok = await request(runtime.handler, '/dsh-git/open-in-editor', { path: 'R', file: 'src/a.ts', line: 12 })
  assert.equal(ok.status, 200)
  assert.deepEqual(opened, [{ repo: 'R', file: 'src/a.ts', line: 12 }])
  assert.equal(JSON.parse(ok.chunks.join('')).editor, 'VS Code')
})

test('the editor route forwards a refusal instead of inventing success', async t => {
  const runtime = setup({}, { editorLauncher: { open: async () => ({ ok: false, error: '该文件已不存在，可能已被删除。' }) } })
  t.after(runtime.dispose)
  const res = await request(runtime.handler, '/dsh-git/open-in-editor', { path: 'R', file: 'gone.ts' })
  assert.equal(res.status, 200)
  assert.deepEqual(JSON.parse(res.chunks.join('')), { ok: false, error: '该文件已不存在，可能已被删除。' })
})

test('the editors route answers without a repository, because the picker runs before one is chosen', async t => {
  const listed = []
  const runtime = setup({}, { editorLauncher: { listEditors: async () => { listed.push('probe'); return [{ command: 'code', label: 'VS Code', goto: true }] } } })
  t.after(runtime.dispose)
  const res = await request(runtime.handler, '/dsh-git/editors', {})
  assert.equal(res.status, 200)
  assert.deepEqual(JSON.parse(res.chunks.join('')), { ok: true, value: [{ command: 'code', label: 'VS Code', goto: true }] })
  assert.deepEqual(listed, ['probe'])
})

test('the editor route forwards the picker choice, including the system default', async t => {
  const opened = []
  const runtime = setup({}, { editorLauncher: { open: async (target, editor) => { opened.push([target, editor]); return { ok: true, target: target.file } } } })
  t.after(runtime.dispose)
  const chosen = await request(runtime.handler, '/dsh-git/open-in-editor', { path: 'R', file: 'src/a.ts', editor: 'code' })
  assert.equal(chosen.status, 200)
  const system = await request(runtime.handler, '/dsh-git/open-in-editor', { path: 'R', file: 'src/a.ts', editor: 'system' })
  assert.equal(system.status, 200)
  assert.deepEqual(opened, [
    [{ repo: 'R', file: 'src/a.ts', line: undefined }, 'code'],
    [{ repo: 'R', file: 'src/a.ts', line: undefined }, 'system'],
  ])
})

test('an editor choice that is not a string is rejected before the launcher sees it', async t => {
  const opened = []
  const runtime = setup({}, { editorLauncher: { open: async target => { opened.push(target); return { ok: true } } } })
  t.after(runtime.dispose)
  for (const editor of [42, ['code'], { command: 'code' }]) {
    const res = await request(runtime.handler, '/dsh-git/open-in-editor', { path: 'R', file: 'src/a.ts', editor })
    assert.equal(res.status, 400, JSON.stringify(editor))
  }
  assert.deepEqual(opened, [])
})

test('a failing editor probe is reported instead of an empty picker that looks installed', async t => {
  const runtime = setup({}, { editorLauncher: { listEditors: async () => { throw new Error('PATH 读取失败') } } })
  t.after(runtime.dispose)
  const res = await request(runtime.handler, '/dsh-git/editors', {})
  assert.equal(res.status, 500)
  assert.equal(JSON.parse(res.chunks.join('')).error, 'PATH 读取失败')
})

test('the blob route streams image bytes and refuses everything else', async t => {
  const seen = []
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])
  const runtime = setup({
    readBlob: async (path, file) => {
      seen.push([path, file])
      if (file === 'ok.png') return { ok: true, bytes, type: 'image/png' }
      return { ok: false, error: '这个路径不是一个文件' }
    },
  })
  t.after(runtime.dispose)

  const ok = await request(runtime.handler, '/dsh-git/blob?path=R&file=ok.png', null, 'GET')
  assert.equal(ok.status, 200)
  assert.equal(ok.headers['Content-Type'], 'image/png')
  assert.deepEqual(Buffer.concat(ok.chunks), bytes)

  const refused = await request(runtime.handler, '/dsh-git/blob?path=R&file=nope.png', null, 'GET')
  assert.equal(refused.status, 404)
  assert.equal(JSON.parse(refused.chunks.join('')).error, '这个路径不是一个文件')

  // The URL must never be able to ask for a file without naming a repository.
  assert.equal((await request(runtime.handler, '/dsh-git/blob?file=ok.png', null, 'GET')).status, 400)
  assert.equal((await request(runtime.handler, '/dsh-git/blob?path=R&file=', null, 'GET')).status, 400)
  assert.deepEqual(seen, [['R', 'ok.png'], ['R', 'nope.png']])
  assert.equal((await request(runtime.handler, '/dsh-git/blob?path=R&file=ok.png', { path: 'R' })).status, 405)
})

test('repository SVG blobs cannot execute scripts with the GUI origin', async t => {
  const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>')
  const runtime = setup({ readBlob: async () => ({ ok: true, bytes, type: 'image/svg+xml' }) })
  t.after(runtime.dispose)
  const res = await request(runtime.handler, '/dsh-git/blob?path=R&file=untrusted.svg', null, 'GET')
  assert.equal(res.status, 200)
  assert.equal(res.headers['Content-Type'], 'image/svg+xml')
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff')
  assert.match(res.headers['Content-Security-Policy'], /(?:^|;\s*)sandbox(?:;|$)/)
  assert.match(res.headers['Content-Security-Policy'], /default-src 'none'/)
  assert.doesNotMatch(res.headers['Content-Security-Policy'], /allow-scripts|allow-same-origin/)
  assert.deepEqual(Buffer.concat(res.chunks), bytes)
})

test('the client report route stores what the renderer reported and needs no repository', async t => {
  let gitCalls = 0
  const runtime = setup({ status: async () => { gitCalls++; return baseline } })
  t.after(runtime.dispose)
  t.after(() => { try { rmSync(clientReportPath(), { force: true }) } catch { /* already gone */ } })
  const report = { build: 'test-build', stylesElement: true, stylesLength: 42, probeUiFont: 'Microsoft YaHei' }
  const res = await request(runtime.handler, '/dsh-git/client-report', report)
  assert.equal(res.status, 200)
  assert.deepEqual(JSON.parse(readFileSync(clientReportPath(), 'utf-8')), report)
  assert.equal(gitCalls, 0)
})
