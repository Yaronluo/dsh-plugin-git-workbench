import test from 'node:test'
import assert from 'node:assert/strict'
import { join, resolve } from 'node:path'
import childProcess from 'node:child_process'
import { EventEmitter } from 'node:events'
import { syncBuiltinESMExports } from 'node:module'
import { loadTs } from './helpers/load-ts.mjs'

const { createEditorLauncher: createLauncher, findOnPath } = await loadTs('src/host/editor-launcher.ts')

/** No application icon: extraction spawns the shell, which no test should do. */
const noIcons = { lookup: async () => [] }
const createEditorLauncher = options => createLauncher({ appIcons: noIcons, ...options })

const repo = resolve('D:/repo')

/** A launcher with no real process: detection, arguments and refusals are all visible. */
function fixture({ available = ['code'], env = {}, fileExists = () => true, isDirectory = () => false, pathExists = () => false, listDirectory = () => [], platform = 'win32', appIcons = noIcons } = {}) {
  const launched = []
  const probed = []
  const launcher = createEditorLauncher({
    env, platform,
    resolveCommand: async command => {
      probed.push(command)
      return available.includes(command) ? `C:\\bin\\${command}.exe` : undefined
    },
    launch: (command, args) => launched.push([command, args]),
    fileExists,
    isDirectory,
    // Detection falls back to the well-known install locations; keep that hermetic.
    pathExists,
    // …and then to the version-dependent install roots, which must not touch the real disk.
    listDirectory,
    appIcons,
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
  // Path resolution uses the host OS; backslashes are literal filename characters on POSIX.
  const outside = ['../secret.txt', resolve('D:/other/secret.txt')]
  if (process.platform === 'win32') outside.push('..\\secret.txt')
  for (const file of outside) {
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
    pathExists: () => false,
    listDirectory: () => [],
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
    pathExists: () => false,
    listDirectory: () => [],
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
    pathExists: () => false,
    listDirectory: () => [],
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
  const launcher = createEditorLauncher({ env: {}, fileExists: () => true,
    pathExists: () => false,
    listDirectory: () => [], resolveCommand: async () => command })
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
    pathExists: () => false,
    listDirectory: () => [],
    openNatively: async () => { throw new Error('当前环境无法打开本地文件') },
  })
  const result = await launcher.open({ repo, file: 'src/a.ts' })
  assert.equal(result.ok, true)
  assert.deepEqual(launched, [['cmd.exe', ['/d', '/s', '/c', 'start', '', resolve(repo, 'src/a.ts')]]])
})

test('the picker lists only editors that really resolve, in preference order', async () => {
  const f = fixture({ available: ['subl', 'zed'] })
  assert.deepEqual(await f.launcher.listEditors(), [
    { command: 'zed', label: 'Zed', goto: false },
    { command: 'subl', label: 'Sublime Text', goto: false },
  ])
})

test('an empty picker list is honest about a machine without editor CLIs', async () => {
  const f = fixture({ available: [] })
  assert.deepEqual(await f.launcher.listEditors(), [])
})

test('a configured DSH_GIT_EDITOR is the only editor the picker may offer', async () => {
  const f = fixture({ available: ['code', 'myedit'], env: { DSH_GIT_EDITOR: 'myedit' } })
  assert.deepEqual(await f.launcher.listEditors(), [{ command: 'myedit', label: 'myedit', goto: false }])
})

test('a chosen editor opens that editor and never falls back to another one', async () => {
  const f = fixture({ available: ['subl', 'code'] })
  const chosen = await f.launcher.open({ repo, file: 'src/a.ts', line: 12 }, 'subl')
  assert.deepEqual(chosen, { ok: true, editor: 'Sublime Text', target: 'src/a.ts' })
  assert.deepEqual(f.launched, [['C:\\bin\\subl.exe', [`${resolve(repo, 'src/a.ts')}:12`]]])
})

test('an unknown editor name is refused instead of opening a different editor', async () => {
  const f = fixture({ available: ['code'] })
  const result = await f.launcher.open({ repo, file: 'src/a.ts' }, 'not-an-editor')
  assert.equal(result.ok, false)
  assert.match(result.error, /找不到编辑器：not-an-editor/)
  assert.deepEqual(f.launched, [])
})

test('a chosen editor that is not installed at all is reported, not silently replaced', async () => {
  const f = fixture({ available: [] })
  const result = await f.launcher.open({ repo, file: 'src/a.ts' }, 'code')
  assert.equal(result.ok, false)
  assert.match(result.error, /找不到编辑器：VS Code（命令不在 PATH 中，也不在常见安装位置）/)
  assert.deepEqual(f.launched, [])
})

test('DSH_GIT_EDITOR refuses another editor instead of quietly ignoring the choice', async () => {
  const f = fixture({ available: ['code', 'myedit'], env: { DSH_GIT_EDITOR: 'myedit' } })
  const result = await f.launcher.open({ repo, file: 'src/a.ts' }, 'code')
  assert.equal(result.ok, false)
  assert.match(result.error, /DSH_GIT_EDITOR=myedit/)
  assert.deepEqual(f.launched, [])
})

test('the system default entry probes no editor at all', async () => {
  const f = fixture({ available: ['code'] })
  const result = await f.launcher.open({ repo, file: 'src/a.ts' }, 'system')
  assert.equal(result.ok, true)
  assert.equal(result.editor, undefined)
  assert.deepEqual(f.probed, [])
  assert.deepEqual(f.launched, [['cmd.exe', ['/d', '/s', '/c', 'start', '', resolve(repo, 'src/a.ts')]]])
})

test('a chosen editor is refused for a path outside the repository before launching', async () => {
  const f = fixture({ available: ['code'] })
  const result = await f.launcher.open({ repo, file: resolve('D:/other/secret.txt') }, 'code')
  assert.equal(result.ok, false)
  assert.match(result.error, /仓库内/)
  assert.deepEqual(f.launched, [])
})

// A GUI installer may never touch PATH; the VS Code user installer is the common case, and
// a PATH-only probe used to answer "没有检测到编辑器命令行" on a machine that has one.
const vscodeShim = 'C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd'

test('an editor whose installer skipped PATH is still found in its well-known location', async () => {
  const f = fixture({
    available: [],
    env: { LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local', ProgramFiles: 'C:\\Program Files' },
    pathExists: candidate => candidate === vscodeShim,
  })
  const result = await f.launcher.open({ repo, file: 'src/a.ts', line: 12 })
  assert.deepEqual(result, { ok: true, editor: 'VS Code', target: 'src/a.ts' })
  assert.deepEqual(f.launched, [[vscodeShim, ['-g', `${resolve(repo, 'src/a.ts')}:12`]]])
})

test('PATH still wins over a well-known location, so a user shim is not ignored', async () => {
  const f = fixture({ available: ['code'], pathExists: candidate => candidate === vscodeShim })
  await f.launcher.open({ repo, file: 'src/a.ts' })
  assert.deepEqual(f.launched, [['C:\\bin\\code.exe', ['-g', resolve(repo, 'src/a.ts')]]])
})

test('the picker offers an editor found by its install location, with the same choice value', async () => {
  const f = fixture({
    available: [],
    env: { LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local' },
    pathExists: candidate => candidate === vscodeShim,
  })
  assert.deepEqual(await f.launcher.listEditors(), [{ command: 'code', label: 'VS Code', goto: true }])
  const chosen = await f.launcher.open({ repo, file: 'src/a.ts' }, 'code')
  assert.deepEqual(chosen, { ok: true, editor: 'VS Code', target: 'src/a.ts' })
  assert.deepEqual(f.launched, [[vscodeShim, ['-g', resolve(repo, 'src/a.ts')]]])
})

test('a well-known location with an unresolved %PLACEHOLDER% is never taken as a path', async () => {
  const f = fixture({
    available: [],
    // No LOCALAPPDATA in the environment: the template must not turn into a literal file name.
    env: {},
    pathExists: candidate => candidate.includes('%'),
  })
  const result = await f.launcher.open({ repo, file: 'src/a.ts' })
  assert.equal(result.ok, true)
  assert.equal(result.editor, undefined)
  assert.deepEqual(f.launched, [['cmd.exe', ['/d', '/s', '/c', 'start', '', resolve(repo, 'src/a.ts')]]])
})

test('DSH_GIT_EDITOR accepts an absolute path, for an editor no installer registered', async () => {
  const editor = 'D:\\tools\\my editor\\edit.cmd'
  const f = fixture({ available: [], env: { DSH_GIT_EDITOR: editor }, pathExists: candidate => candidate === editor })
  assert.deepEqual(await f.launcher.listEditors(), [{ command: editor, label: editor, goto: false }])
  const result = await f.launcher.open({ repo, file: 'src/a.ts' })
  assert.equal(result.ok, true)
  assert.deepEqual(f.launched, [[editor, [resolve(repo, 'src/a.ts')]]])
})

test('the picker carries the application icon when the host can read one', async () => {
  const icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
  const asked = []
  const f = fixture({
    available: ['code', 'subl'],
    appIcons: { lookup: async commands => { asked.push(...commands); return commands.map(() => icon) } },
  })
  assert.deepEqual(await f.launcher.listEditors(), [
    { command: 'code', label: 'VS Code', goto: true, icon },
    { command: 'subl', label: 'Sublime Text', goto: false, icon },
  ])
  assert.deepEqual(asked, ['C:\\bin\\code.exe', 'C:\\bin\\subl.exe'])
})

test('an icon that cannot be read leaves the entry, not an empty slot', async () => {
  const f = fixture({ available: ['code'], appIcons: { lookup: async () => [undefined] } })
  assert.deepEqual(await f.launcher.listEditors(), [{ command: 'code', label: 'VS Code', goto: true }])
})

test('another platform never matches a Windows install location', async () => {
  const launched = []
  const launcher = createEditorLauncher({
    platform: 'linux',
    env: { LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local' },
    resolveCommand: async () => undefined,
    launch: (command, args) => launched.push([command, args]),
    fileExists: () => true,
    pathExists: candidate => candidate === vscodeShim,
    listDirectory: () => [],
  })
  const result = await launcher.open({ repo, file: 'src/a.ts' })
  assert.equal(result.ok, true)
  assert.equal(result.editor, undefined)
  assert.deepEqual(launched, [['xdg-open', [resolve(repo, 'src/a.ts')]]])
})

// JetBrains products install under `%LOCALAPPDATA%\Programs\<product>\bin`, a layout no
// fixed path can name: the folder is version-less, but only the installed products exist.
// The expected paths are built with `join` exactly like the walk builds them, so these cases
// hold on any host: only the separator differs.
const programsRoot = 'C:\\Users\\me\\AppData\\Local\\Programs'
const webstormBinary = join(programsRoot, 'WebStorm', 'bin', 'webstorm64.exe')
const ideaBinary = join(programsRoot, 'IntelliJ IDEA', 'bin', 'idea64.exe')

test('a JetBrains IDE installed under Programs is found by walking the install root', async () => {
  const f = fixture({
    available: [],
    env: { LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local' },
    listDirectory: directory => directory === programsRoot ? ['IntelliJ IDEA', 'Notion', 'WebStorm'] : [],
    pathExists: candidate => candidate === ideaBinary || candidate === webstormBinary,
  })
  assert.deepEqual(await f.launcher.listEditors(), [
    { command: 'idea', label: 'IntelliJ IDEA', goto: false },
    { command: 'webstorm', label: 'WebStorm', goto: false },
  ])
})

test('a Toolbox install is found through apps/<product>/<channel>/<build>', async () => {
  const toolbox = 'C:\\Users\\me\\AppData\\Local\\JetBrains\\Toolbox\\apps'
  const binary = join(toolbox, 'IntelliJ IDEA', 'ch-0', '242.20224.300', 'bin', 'idea64.exe')
  const f = fixture({
    available: [],
    env: { LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local' },
    listDirectory: directory => directory === toolbox ? ['IntelliJ IDEA']
      : directory === join(toolbox, 'IntelliJ IDEA') ? ['ch-0']
        : directory === join(toolbox, 'IntelliJ IDEA', 'ch-0') ? ['242.20224.300'] : [],
    pathExists: candidate => candidate === binary,
  })
  assert.deepEqual(await f.launcher.listEditors(), [{ command: 'idea', label: 'IntelliJ IDEA', goto: false }])
})

test('a JetBrains choice receives --line and the plain path, never the file:line suffix', async () => {
  const f = fixture({
    available: [],
    env: { LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local' },
    listDirectory: directory => directory === programsRoot ? ['IntelliJ IDEA'] : [],
    pathExists: candidate => candidate === ideaBinary,
  })
  const result = await f.launcher.open({ repo, file: 'src/a.ts', line: 12 }, 'idea')
  assert.equal(result.ok, true)
  assert.equal(result.editor, 'IntelliJ IDEA')
  assert.deepEqual(f.launched, [[ideaBinary, ['--line', '12', resolve(repo, 'src/a.ts')]]])
})

test('a macOS app bundle is found without guessing the product folder spelling', async () => {
  const bundle = '/Applications/WebStorm.app/Contents/MacOS/webstorm'
  const f = fixture({
    available: [],
    platform: 'darwin',
    listDirectory: directory => directory === '/Applications' ? ['WebStorm.app', 'Xcode.app'] : [],
    // The walk joins with the host separator; the stub compares the POSIX shape it stands for.
    pathExists: candidate => candidate.replace(/\\/g, '/') === bundle,
  })
  assert.deepEqual(await f.launcher.listEditors(), [{ command: 'webstorm', label: 'WebStorm', goto: false }])
})

test('DSH_GIT_EDITOR pointing straight at a JetBrains binary keeps its line syntax', async () => {
  const override = 'C:\\tools\\bin\\idea64.exe'
  const f = fixture({ available: [], env: { DSH_GIT_EDITOR: override }, pathExists: candidate => candidate === override })
  assert.deepEqual(await f.launcher.listEditors(), [{ command: override, label: override, goto: false }])
  const result = await f.launcher.open({ repo, file: 'src/a.ts', line: 7 }, override)
  assert.equal(result.ok, true)
  assert.deepEqual(f.launched, [[override, ['--line', '7', resolve(repo, 'src/a.ts')]]])
})

// PATH lookups scan directories instead of spawning `where`/`which`: one process per candidate
// cost ~150ms, which is what left the picker on "detecting…" for seconds.

test('a PATH lookup prefers a real executable over a batch shim, wherever they sit', () => {
  const found = findOnPath('code', {
    platform: 'win32',
    env: { PATH: 'C:\\shims;C:\\apps' },
    listDirectory: directory => directory === 'C:\\shims' ? ['code', 'code.cmd'] : ['code.exe'],
  })
  assert.equal(found, join('C:\\apps', 'code.exe'))
})

test('an earlier PATH directory wins among equals, so a user shim is not shadowed', () => {
  const found = findOnPath('code', {
    platform: 'win32',
    env: { PATH: 'C:\\shims;C:\\apps' },
    listDirectory: () => ['code.cmd'],
  })
  assert.equal(found, join('C:\\shims', 'code.cmd'))
})

test('a command that is already a path is not looked up on PATH', () => {
  const found = findOnPath('C:\\tools\\code.exe', {
    platform: 'win32',
    env: { PATH: 'C:\\tools' },
    listDirectory: () => ['code.exe'],
  })
  assert.equal(found, undefined)
})

test('on POSIX only a file with the executable bit counts as found', () => {
  const options = {
    platform: 'linux',
    env: { PATH: '/usr/local/bin:/usr/bin' },
    listDirectory: directory => /[\\/]usr[\\/]bin$/.test(directory) ? ['code'] : [],
  }
  const posix = value => value?.replace(/\\/g, '/')
  assert.equal(posix(findOnPath('code', { ...options, isExecutable: () => false })), undefined)
  assert.equal(posix(findOnPath('code', { ...options, isExecutable: () => true })), '/usr/bin/code')
})

test('the launcher finds an editor through PATH without spawning a finder process', async () => {
  const launched = []
  const launcher = createEditorLauncher({
    platform: 'win32',
    env: { PATH: 'C:\\tools' },
    listDirectory: directory => directory === 'C:\\tools' ? ['code.cmd'] : [],
    launch: (command, args) => { launched.push([command, args]) },
    fileExists: () => true,
    isDirectory: () => false,
    pathExists: () => false,
  })
  const result = await launcher.open({ repo, file: 'src/a.ts', line: 4 })
  assert.equal(result.editor, 'VS Code')
  assert.deepEqual(launched, [[join('C:\\tools', 'code.cmd'), ['-g', `${resolve(repo, 'src/a.ts')}:4`]]])
  assert.deepEqual(await launcher.listEditors(), [{ command: 'code', label: 'VS Code', goto: true }])
})
