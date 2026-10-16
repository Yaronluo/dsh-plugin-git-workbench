import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setImmediate } from 'node:timers/promises'
import { loadTs } from './helpers/load-ts.mjs'

// Use the actual installed host, not a permissive plain-object replacement.
// Other machines can opt in with DSH_DESKTOP_APP_ROOT.
const app = process.env.DSH_DESKTOP_APP_ROOT || (process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'Programs', 'DSH Desktop', 'resources', 'app') : '')
const modulePath = name => join(app, 'node_modules', '@deepseek-ai', name, 'lib', 'index.js')
const available = app && existsSync(modulePath('cordis')) && existsSync(modulePath('dsh-host-webserver'))
const entry = await loadTs('src/index.ts')

test('real Cordis host serves POST status and SSE, with optional tools isolated', { skip: !available && 'Set DSH_DESKTOP_APP_ROOT to run against an installed DSH host' }, async t => {
  const { Context } = await import(pathToFileURL(modulePath('cordis')).href)
  const { default: WebServer } = await import(pathToFileURL(modulePath('dsh-host-webserver')).href)
  const ctx = new Context()
  t.after(async () => { await ctx.fiber.dispose() })
  ctx.provide('workspaceRegistry', {})
  await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
  const server = ctx.get('webServer')
  let fallbackHits = 0
  server.registerFallback((req, res) => { fallbackHits++; res.writeHead(405); res.end('Method Not Allowed') })
  await ctx.plugin(entry)
  const base = `http://127.0.0.1:${server.port}`
  const cwd = resolve('.')
  const readStatus = async () => {
    const res = await fetch(`${base}/dsh-git/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: cwd }),
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.ok, true)
    assert.equal(body.value.isGit, true)
  }
  // No tools provider: the Git UI must still load.
  await readStatus()

  const registered = new Set()
  const removeTools = ctx.provide('tools', { register(definition) {
    registered.add(definition.name)
    return () => registered.delete(definition.name)
  } })
  await setImmediate()
  await setImmediate()
  assert.equal(registered.size, 8)
  await readStatus()

  const abort = new AbortController()
  t.after(() => abort.abort())
  const response = await fetch(`${base}/dsh-git/events?path=${encodeURIComponent(cwd)}`, { signal: abort.signal })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /text\/event-stream/)
  const reader = response.body.getReader()
  let received = ''
  const timer = setTimeout(() => abort.abort(), 10000)
  try {
    while (!received.includes('event: status\n')) {
      const { value, done } = await reader.read()
      assert.equal(done, false, 'SSE ended without a status snapshot')
      received += new TextDecoder().decode(value)
    }
  } finally { clearTimeout(timer); await reader.cancel(); abort.abort() }
  assert.equal(fallbackHits, 0)
  removeTools()
  await setImmediate()
  assert.equal(registered.size, 0)
  // Removing agent tools must not retire the HTTP routes.
  await readStatus()
})
