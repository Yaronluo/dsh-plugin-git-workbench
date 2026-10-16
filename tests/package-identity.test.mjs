import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const manifest = JSON.parse(read('package.json'))

test('published repository metadata matches the unified GitHub and npm name', () => {
  const repository = new URL(manifest.repository.url.replace(/^git\+/, ''))
  assert.equal(repository.hostname, 'github.com')
  const repoPath = repository.pathname.replace(/\.git$/, '').replace(/\/$/, '')
  assert.equal(repoPath.split('/').at(-1), manifest.name)
  assert.equal(new URL(manifest.homepage).pathname, repoPath)
  assert.equal(new URL(manifest.bugs.url).pathname, `${repoPath}/issues`)
})

test('client bundle registers the package identity expected by the client loader', () => {
  const registrations = []
  // Observe the real built wrapper, without invoking the plugin factory or
  // mounting any UI. Desktop waits for this exact package name to register.
  runInNewContext(read('lib/client.js'), {
    window: { __ModuleLoader__: { load: entry => registrations.push(entry) } },
  }, { timeout: 5000, filename: 'lib/client.js' })
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].id, manifest.name)
  assert.equal(typeof registrations[0].factory, 'function')
})

test('bundle patch resolves the same package identity as package.json', () => {
  const names = [...read('cordis.patch.yml').matchAll(/^\s+name:\s*(\S+)\s*$/gm)]
    .map(match => match[1])
  assert.deepEqual(names, [manifest.name])
})
