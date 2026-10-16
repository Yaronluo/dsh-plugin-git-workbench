import test from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import childProcess from 'node:child_process'
import { EventEmitter } from 'node:events'
import { syncBuiltinESMExports } from 'node:module'
import { loadTs } from './helpers/load-ts.mjs'

const { createEditorLauncher } = await loadTs('src/host/editor-launcher.ts')

const repo = resolve('D:/repo')

/** A launcher with no real process: detection, arguments and refusals are all visible. */
function fixture({ available = ['code'], env = {}, fileExists = () => true, isDirectory = () => false } = {}) {
  const launched = []
  const probed = []
  const launcher = createEditorLauncher({
    env, platform: 'win32',
    resolveCommand: async command => {
      probed.push(command)
      return available.includes(command) ? `C:\\bin\\${command}.exe` : undefined
    },
    launch: (command, args) => launched.push([command, args]),
    fileExists,
    isDirectory,
  })
  return { launcher, launched, probed }
}

test('a file opens in the first available editor CLI, as an argument and never a shell string', async () => {
  const f = fixture()
  const result = await f.launcher.open({ repo, file: 'src/a.ts' })
  assert.deepEqual(result, { ok: true, editor: 'VS Code', target: 'src/a.ts' })
  assert.deepEqual(f.launched, [['C:\\bin\\code.exe', ['-g', resolve(repo, 'src/a.ts')]]])
})

test('detection follows the documented preference order, not the PATH order', async () => {
  const f = fixture({ available: ['subl', 'code'] })
  await f.launcher.open({ repo, file: 'README.md' })
  assert.equal(f.probed[0], 'code')
  assert.deepEqual(f.launched, [['C:\\bin\\code.exe', ['-g', resolve(repo, 'README.md')]]])
})

test('an editor without goto support receives a plain path', async () => {
  const f = fixture({ available: ['subl'] })
  const result = await f.launcher.open({ repo, file: 'src/a.ts', line: 12 })
  assert.equal(result.editor, 'Sublime Text')
  assert.deepEqual(f.launched, [['C:\\bin\\subl.exe', [`${resolve(repo, 'src/a.ts')}:12`]]])
})

test('DSH_GIT_EDITOR overrides detection so an unusual editor still works', async () => {
  const f = fixture({ available: ['myedit'], env: { DSH_GIT_EDITOR: 'myedit' } })
  const result = await f.launcher.open({ repo, file: 'src/a.ts' })
  assert.equal(result.editor, 'myedit')
  assert.deepEqual(f.launched, [['C:\\bin\\myedit.exe', [resolve(repo, 'src/a.ts')]]])
})

test('without a known editor CLI the path goes to the OS default application', async () => {
  const f = fixture({ available: [] })
  const result = await f.launcher.open({ repo, file: 'src/a.ts' })
  assert.equal(result.ok, true)
  assert.equal(result.editor, undefined)
  assert.deepEqual(f.launched, [['cmd.exe', ['/d', '/s', '/c', 'start', '', resolve(repo, 'src/a.ts')]]])
})

test('opening the repository itself passes the directory, never a goto argument', async () => {
  const f = fixture({ isDirectory: () => true })
  const result = await f.launcher.open({ repo })
  assert.equal(result.ok, true)
  assert.deepEqual(f.launched, [['C:\\bin\\code.exe', [repo]]])
})

test('a path outside the repository is refused instead of opening anything', async () => {
  const f = fixture()
  for (const file of ['../secret.txt', '..\\secret.txt', resolve('D:/other/secret.txt')]) {
    const result = await f.launcher.open({ repo, file })
    assert.equal(result.ok, false, file)
    assert.match(result.error, /仓库内/)
  }
  assert.deepEqual(f.launched, [])
})

test('shell metacharacters in a file name are refused, not escaped', async () => {
  const f = fixture()
  for (const file of ['a&b.txt', 'a"b.txt', 'a%b.txt', 'a|b.txt', 'a^b.txt']) {
    const result = await f.launcher.open({ repo, file })
    assert.equal(result.ok, false, file)
    assert.match(result.error, /不支持/)
  }
  assert.deepEqual(f.launched, [])
})

test('a file that no longer exists reports that instead of opening a stale path', async () => {
  const f = fixture({ fileExists: () => false })
  const result = await f.launcher.open({ repo, file: 'gone.ts' })
  assert.equal(result.ok, false)
  assert.match(result.error, /已不存在/)
  assert.deepEqual(f.launched, [])
})

test('without an editor CLI the host opener is preferred over spawning a shell', async () => {
  const opened = []
  const launched = []
  const launcher = createEditorLauncher({
    platform: 'win32', env: {},
    resolveCommand: async () => undefined,
    launch: (command, args) => launched.push([command, args]),
    fileExists: () => true,
    openNatively: async absolutePath => { opened.push(absolutePath) },
  })
  const result = await launcher.open({ repo, file: 'src/a.ts' })
  assert.equal(result.ok, true)
  assert.deepEqual(opened, [resolve(repo, 'src/a.ts')])
  assert.deepEqual(launched, [])
})

test('paths beginning with two dots are ordinary in-repository names', async () => {
  const f = fixture()
  assert.equal((await f.launcher.open({ repo, file: '..notes.txt' })).ok, true)
  assert.equal(f.launched.length, 1)
})

test('unsafe characters in the repository path are refused before launching', async () => {
  const f = fixture()
  for (const file of [undefined, 'src/a.ts']) {
    const result = await f.launcher.open({ repo: resolve('repo&command'), file })
    assert.equal(result.ok, false)
    assert.match(result.error, /不支持/)
  }
  assert.deepEqual(f.launched, [])
})

test('asynchronous process start failures are reported for all external launch paths', async () => {
  for (const available of [true, false]) {
    const launcher = createEditorLauncher({
      platform: 'win32', env: {}, fileExists: () => true,
      resolveCommand: async () => available ? 'missing.exe' : undefined,
      launch: async () => { throw new Error('spawn ENOENT') },
    })
    const result = await launcher.open({ repo, file: 'src/a.ts' })
    assert.equal(result.ok, false)
    assert.match(result.error, /ENOENT/)
    const revealed = await launcher.reveal({ repo, file: 'src/a.ts' })
    assert.equal(revealed.ok, false)
    assert.match(revealed.error, /ENOENT/)
  }
})

test('the real detached spawner reports a missing executable instead of swallowing its error', async () => {
  const launcher = createEditorLauncher({
    env: {}, fileExists: () => true,
    resolveCommand: async () => resolve(repo, 'definitely-missing-editor.exe'),
  })
  const result = await launcher.open({ repo, file: 'src/a.ts' })
  assert.equal(result.ok, false)
  assert.match(result.error, /ENOENT/)
})

test('Windows batch editor shims quote executable and file paths containing spaces', { skip: process.platform !== 'win32' }, async t => {
  const spawned = []
  t.mock.method(childProcess, 'spawn', (...args) => {
    spawned.push(args)
    const child = new EventEmitter()
    child.unref = () => {}
    queueMicrotask(() => child.emit('spawn'))
    return child
  })
  syncBuiltinESMExports()
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports() })
  const command = 'C:\\Program Files\\VS Code\\bin\\code.cmd'
  const launcher = createEditorLauncher({ env: {}, fileExists: () => true, resolveCommand: async () => command })
  const result = await launcher.open({ repo, file: 'src/my file.ts', line: 12 })
  assert.equal(result.ok, true)
  assert.deepEqual(spawned, [[`"${command}"`, ['"-g"', `"${resolve(repo, 'src/my file.ts')}:12"`], { detached: true, stdio: 'ignore', shell: true }]])
})

test('a refused host opener still ends in the platform default instead of failing the click', async () => {
  const launched = []
  const launcher = createEditorLauncher({
    platform: 'win32', env: {},
    resolveCommand: async () => undefined,
    launch: (command, args) => launched.push([command, args]),
    fileExists: () => true,
    openNatively: async () => { throw new Error('当前环境无法打开本地文件') },
  })
  const result = await launcher.open({ repo, file: 'src/a.ts' })
  assert.equal(result.ok, true)
  assert.deepEqual(launched, [['cmd.exe', ['/d', '/s', '/c', 'start', '', resolve(repo, 'src/a.ts')]]])
})
