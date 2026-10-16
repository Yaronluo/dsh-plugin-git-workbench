import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './helpers/load-ts.mjs'

const { createAppIcons, iconSource } = await loadTs('src/host/app-icons.ts')

const PNG = 'iVBORw0KGgoAAAANSUhEUg=='

test('an executable is its own icon source, a shim points at the application it starts', () => {
  assert.equal(iconSource('C:\\apps\\Code.exe', { fileExists: () => true }), 'C:\\apps\\Code.exe')
  assert.equal(iconSource('C:\\apps\\Code.exe', { fileExists: () => false }), undefined)
  // VS Code's user install ships a shim in bin\ and keeps the application one level up.
  assert.equal(
    iconSource('C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd', {
      fileExists: () => true,
      listDirectory: directory => directory.endsWith('Microsoft VS Code') ? ['Code.exe', 'unins000.exe'] : [],
    }),
    'C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
  )
  // JetBrains shims do not exist, but a deep layout still has to be found within reach.
  assert.equal(
    iconSource('C:\\tools\\bin\\nested\\webstorm.cmd', {
      fileExists: () => true,
      listDirectory: directory => directory === 'C:\\tools' ? ['WebStorm64.exe'] : [],
    }),
    'C:\\tools\\WebStorm64.exe',
  )
  // A console script with no application behind it must not borrow the console's icon.
  assert.equal(iconSource('C:\\tools\\build.ps1', { fileExists: () => true }), undefined)
  assert.equal(iconSource('C:\\tools\\code.cmd', { fileExists: () => true, listDirectory: () => [] }), undefined)
})

test('one shell call serves the whole batch, and the result is reused', async () => {
  const scripts = []
  const icons = createAppIcons({
    platform: 'win32',
    fileExists: () => true,
    listDirectory: () => [],
    runShell: async script => {
      scripts.push(script)
      return [PNG, PNG]
    },
  })
  const commands = ['C:\\bin\\code.exe', 'C:\\bin\\zed.exe', 'C:\\bin\\code.exe']
  const first = await icons.lookup(commands)
  assert.equal(scripts.length, 1)
  // The duplicated command is asked for once, and each path is a quoted PowerShell literal.
  assert.ok(scripts[0].includes("@('C:\\bin\\code.exe','C:\\bin\\zed.exe')"), scripts[0])
  assert.deepEqual(first, [1, 2, 1].map(() => `data:image/png;base64,${PNG}`))
  const second = await icons.lookup(commands)
  assert.equal(scripts.length, 1, 'a cached icon must not spawn the shell again')
  assert.deepEqual(second, first)
  // A blank line means "this one has no icon", and only that one loses it.
  const partial = createAppIcons({ platform: 'win32', fileExists: () => true, runShell: async () => [PNG, ''] })
  assert.deepEqual(await partial.lookup(['C:\\bin\\code.exe', 'C:\\bin\\zed.exe']), [
    `data:image/png;base64,${PNG}`,
    undefined,
  ])
})

test('an unreadable or failing shell costs the icon, never the entry', async () => {
  const failing = createAppIcons({ platform: 'win32', fileExists: () => true, runShell: async () => { throw new Error('no shell') } })
  assert.deepEqual(await failing.lookup(['C:\\bin\\code.exe']), [undefined])
  // A miss is not cached: the next opening may still get the icon.
  let calls = 0
  const retrying = createAppIcons({ platform: 'win32', fileExists: () => true, runShell: async () => { calls += 1; return calls === 1 ? [''] : [PNG] } })
  assert.deepEqual(await retrying.lookup(['C:\\bin\\code.exe']), [undefined])
  assert.deepEqual(await retrying.lookup(['C:\\bin\\code.exe']), [`data:image/png;base64,${PNG}`])
  // Commands we cannot turn into a file are never sent to the shell at all.
  let shells = 0
  const off = createAppIcons({ platform: 'win32', fileExists: () => true, runShell: async () => { shells += 1; return [] } })
  assert.deepEqual(await off.lookup(['code', 'notafile.ps1']), [undefined, undefined])
  assert.equal(shells, 0)
  // Windows-only by nature: elsewhere the client keeps its own mark.
  const mac = createAppIcons({ platform: 'darwin', fileExists: () => true, runShell: async () => { shells += 1; return [PNG] } })
  assert.deepEqual(await mac.lookup(['/usr/local/bin/code']), [undefined])
  assert.equal(shells, 0)
})
