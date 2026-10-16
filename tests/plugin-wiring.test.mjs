/**
 * Entry wiring regression: real plugin/Git service/repository, simulated Cordis context.
 * The simulation rejects undeclared tools access; it is NOT an end-to-end GUI test.
 * host-cordis.test.mjs additionally exercises actual Cordis and HTTP routing.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadTs } from './helpers/load-ts.mjs'

const entry = await loadTs('src/index.ts')

class Response extends EventEmitter {
  destroyed = false
  writableEnded = false
  writableLength = 0
  status = 0
  chunks = []
  writeHead(status, headers) { this.status = status; this.headers = headers }
  write(chunk) { this.chunks.push(chunk); return true }
  end(chunk) { if (chunk) this.chunks.push(chunk); this.writableEnded = true; this.emit('close') }
  destroy() { this.destroyed = true; this.emit('close') }
  json() { return JSON.parse(Buffer.concat(this.chunks.map(chunk => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))).toString('utf-8')) }
}

function repository() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-git-wiring-'))
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_AUTHOR_NAME: 'Wiring Test', GIT_AUTHOR_EMAIL: 'wiring@example.com', GIT_COMMITTER_NAME: 'Wiring Test', GIT_COMMITTER_EMAIL: 'wiring@example.com' } })
  git('init', '-b', 'main')
  git('config', 'core.autocrlf', 'false')
  writeFileSync(join(root, 'a.txt'), 'one\n')
  git('add', '-A')
  git('commit', '-m', 'first commit')
  return { root, git }
}

/** A stand-in for the Cordis context: records what the plugin registers, nothing more. */
function context({ toolsAvailable = true } = {}) {
  const registered = []
  const tools = []
  const hooks = []
  let handler
  const disposers = []
  const ctx = {
    webServer: { register: route => { handler = route.handler; return () => { handler = undefined } } },
    workspaceRegistry: {},
    get tools() { throw new Error('cannot get property "tools" without inject') },
    inject(names, callback) {
      assert.deepEqual(names, ['tools'])
      if (!toolsAvailable) return
      const scoped = Object.create(ctx, {
        tools: { value: { register: definition => { tools.push(definition); return () => { tools.splice(tools.indexOf(definition), 1) } } } },
      })
      callback(scoped)
    },
    on: (name, callback) => { hooks.push({ name, callback }); return () => { hooks.splice(hooks.findIndex(entry => entry.callback === callback), 1) } },
    effect: (run, label) => { const dispose = run(); disposers.push({ label, dispose }) },
    get: () => undefined,
  }
  return { ctx, registered, tools, hooks, disposers, get handler() { return handler } }
}

async function request(handler, path, payload, method = 'POST') {
  const req = new EventEmitter()
  req.url = path
  req.method = method
  const res = new Response()
  const running = handler(req, res)
  if (method === 'POST') { req.emit('data', Buffer.from(JSON.stringify(payload))); req.emit('end') }
  await running
  return res
}

test('HTTP routes mount even when the optional tools service is unavailable', t => {
  const runtime = context({ toolsAvailable: false })
  entry.apply(runtime.ctx)
  t.after(() => { for (const { dispose } of runtime.disposers.reverse()) dispose?.() })
  assert.equal(typeof runtime.handler, 'function')
  assert.equal(runtime.tools.length, 0)
})

test('the plugin entry mounts its routes, its tools and its approval hook', async t => {
  const { root, git } = repository()
  t.after(() => { try { execFileSync('git', ['worktree', 'prune'], { cwd: root }) } catch { /* nothing to prune */ } })

  const runtime = context()
  entry.apply(runtime.ctx)
  t.after(() => { for (const { dispose } of runtime.disposers.reverse()) dispose?.() })

  // Parent owns HTTP dependencies; optional tools must be accessed only in a child injection.
  assert.deepEqual([...entry.inject].sort(), ['webServer', 'workspaceRegistry'])
  assert.equal(typeof runtime.handler, 'function')
  assert.equal(runtime.tools.length, 8)
  assert.deepEqual(runtime.tools.map(tool => tool.name).sort(), [
    'git_branch', 'git_commit', 'git_diff', 'git_log', 'git_stage', 'git_stash', 'git_status', 'git_unstage',
  ])
  assert.ok(runtime.hooks.some(hook => hook.name === 'tools/pre-execute'))

  const status = await request(runtime.handler, '/dsh-git/status', { path: root })
  assert.equal(status.status, 200)
  const statusBody = status.json()
  assert.equal(statusBody.ok, true)
  assert.equal(statusBody.value.branch, 'main')
  assert.equal(statusBody.value.isGit, true)

  // An edit shows up as an unstaged change, and the changes endpoint reports it as a row.
  writeFileSync(join(root, 'a.txt'), 'two\n')
  const changes = (await request(runtime.handler, '/dsh-git/changes', { path: root })).json()
  assert.equal(changes.ok, true)
  assert.ok(changes.value.entries.some(entry => entry.path === 'a.txt' && entry.section === 'unstaged'))

  // …and the diff endpoint returns a patch the UI can render and stage from.
  const diff = (await request(runtime.handler, '/dsh-git/diff', { path: root })).json()
  assert.equal(diff.ok, true)
  assert.equal(diff.value.files.length, 1)
  assert.match(diff.value.files[0].rawPatch, /\+two/)

  // The image preview route reads real bytes through the mounted service.
  const blob = await request(runtime.handler, `/dsh-git/blob?path=${encodeURIComponent(root)}&file=a.txt`, null, 'GET')
  assert.equal(blob.status, 200)
  assert.equal(blob.headers['Content-Type'], 'application/octet-stream')
  assert.equal(Buffer.concat(blob.chunks).toString('utf-8'), 'two\n')

  // Staging and committing through the HTTP surface really moves the repository forward.
  assert.equal((await request(runtime.handler, '/dsh-git/stage', { path: root, files: ['a.txt'] })).json().ok, true)
  const commit = (await request(runtime.handler, '/dsh-git/commit', { path: root, message: 'second commit' })).json()
  assert.equal(commit.ok, true)
  assert.equal(git('log', '-1', '--format=%s').toString().trim(), 'second commit')
  const clean = (await request(runtime.handler, '/dsh-git/status', { path: root })).json()
  assert.equal(clean.value.dirtyFiles, 0)
  assert.equal(clean.value.entries.length, 0)
})
