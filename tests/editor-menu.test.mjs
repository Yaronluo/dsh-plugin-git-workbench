import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import ts from 'typescript'
import { loadTs } from './helpers/load-ts.mjs'

// The picker and the tiles it draws are plain functions, so this file drives both with the
// hooks stubbed (see client-diff-state for the same pattern).
const editorIconsUrl = new URL('../src/client/editor-icons.tsx', import.meta.url).href

const virtual = source => `data:text/javascript,${encodeURIComponent(source)}`

const reactStub = `
export const useState = (...args) => globalThis.__editorMenuHarness.useState(...args)
export const useEffect = (...args) => globalThis.__editorMenuHarness.useEffect(...args)
export default { useState, useEffect }
`
const jsxStub = `
export const jsx = (type, props) => ({ type, props })
export const jsxs = jsx
export const Fragment = 'fragment'
`
const iconsStub = `
export const IconExternalLink = () => null
export const IconChevronDown = () => null
export const IconFile = () => null
export const IconFolderTree = () => null
`
const apiStub = `
const api = () => globalThis.__editorMenuHarness.api
export const gitApi = {
  listEditors: (...args) => api().listEditors(...args),
  openInEditor: (...args) => api().openInEditor(...args),
  reveal: (...args) => api().reveal(...args),
}
export const errorMessage = error => (error && error.message) || String(error)
`

registerHooks({
  resolve(specifier, context, nextResolve) {
    const owner = context.parentURL
    if (owner?.endsWith('/editor-menu.tsx') || owner?.endsWith('/editor-icons.tsx')) {
      if (specifier === 'react') return { url: virtual(reactStub), shortCircuit: true }
      if (specifier === 'react/jsx-runtime') return { url: virtual(jsxStub), shortCircuit: true }
      if (specifier.endsWith('api.js')) return { url: virtual(apiStub), shortCircuit: true }
      // Before `icons.js`: `editor-icons.js` also ends with that name.
      if (specifier.endsWith('editor-icons.js')) return { url: editorIconsUrl, shortCircuit: true }
      if (specifier.endsWith('icons.js')) return { url: virtual(iconsStub), shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.endsWith('/editor-menu.tsx') || url.endsWith('/editor-icons.tsx')) {
      const source = readFileSync(new URL(url), 'utf8')
      return {
        format: 'module',
        source: ts.transpileModule(source, {
          compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
        }).outputText,
        shortCircuit: true,
      }
    }
    return nextLoad(url, context)
  },
})

const { OpenInEditorMenu } = await loadTs('src/client/editor-menu.tsx')
const { EditorMark, editorKey, editorMark } = await loadTs('src/client/editor-icons.tsx')

/** Minimal hooks runtime: state slots and effects, in call order. */
const harness = globalThis.__editorMenuHarness = {
  api: null,
  slots: [],
  cursor: 0,
  dirty: false,
  pending: [],
  useState(initial) {
    const index = this.cursor++
    const slot = this.slots[index] ?? (this.slots[index] = {})
    if (!('value' in slot)) slot.value = typeof initial === 'function' ? initial() : initial
    return [slot.value, next => {
      const value = typeof next === 'function' ? next(slot.value) : next
      if (!Object.is(value, slot.value)) { slot.value = value; this.dirty = true }
    }]
  },
  useEffect(effect, deps) {
    const index = this.cursor++
    const slot = this.slots[index] ?? (this.slots[index] = {})
    const unchanged = Array.isArray(slot.deps) && Array.isArray(deps)
      && slot.deps.length === deps.length && deps.every((value, i) => Object.is(value, slot.deps[i]))
    if (unchanged) return
    slot.deps = deps
    pending.push({ index, effect })
  },
}
const pending = harness.pending

const tick = () => new Promise(resolve => setImmediate(resolve))

function fixture({ editors = [{ command: 'code', label: 'VS Code', goto: true }, { command: 'zed', label: 'Zed', goto: false }], listEditors, open, reveal } = {}) {
  const calls = { listEditors: 0, openInEditor: [], reveal: [] }
  const notices = []
  harness.api = {
    listEditors: async () => listEditors ? listEditors() : (calls.listEditors++, editors),
    openInEditor: async (repo, file, line, editor) => {
      calls.openInEditor.push([repo, file, line, editor])
      if (open) return open(repo, file, line, editor)
      return { ok: true, editor: editor === 'system' ? undefined : editor === 'zed' ? 'Zed' : 'VS Code', target: file }
    },
    reveal: async (repo, file) => {
      calls.reveal.push([repo, file])
      if (reveal) return reveal(repo, file)
      return { ok: true, target: file }
    },
  }
  harness.slots = []
  harness.cursor = 0
  harness.dirty = false
  harness.pending.length = 0

  let tree = null
  const render = () => {
    harness.cursor = 0
    harness.dirty = false
    tree = OpenInEditorMenu({ repo: 'D:/repo', file: 'src/a.ts', line: 12, onNotice: notice => notices.push(notice) })
  }
  const runEffects = () => {
    while (harness.pending.length) {
      const { index, effect } = harness.pending.shift()
      const slot = harness.slots[index]
      if (typeof slot.cleanup === 'function') slot.cleanup()
      const cleanup = effect()
      slot.cleanup = typeof cleanup === 'function' ? cleanup : undefined
    }
  }
  const settle = async () => {
    for (let round = 0; round < 30; round++) {
      runEffects()
      if (harness.dirty) { render(); continue }
      await tick()
      if (harness.dirty) { render(); continue }
      return
    }
    throw new Error('the editor menu did not settle')
  }
  render()
  return {
    get tree() { return tree },
    calls,
    notices,
    settle,
    setApi(patch) { Object.assign(harness.api, patch) },
    async click(node) { node.props.onClick({ currentTarget: { closest: () => null } }); await settle() },
    async keyDown(node, key) { node.props.onKeyDown({ key, stopPropagation() {} }); await settle() },
  }
}

function nodes(root, predicate) {
  const found = []
  const visit = node => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { for (const child of node) visit(child); return }
    if (predicate(node)) found.push(node)
    visit(node.props?.children)
  }
  visit(root)
  return found
}
function textOf(node) {
  const parts = []
  const visit = value => {
    if (typeof value === 'string' || typeof value === 'number') parts.push(String(value))
    else if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === 'object') visit(value.props?.children)
  }
  visit(node.props?.children)
  return parts.join('')
}
const triggerOf = tree => nodes(tree, node => String(node.props?.className || '').includes('dsh-git-open-editor'))[0]
const optionsOf = tree => nodes(tree, node => String(node.props?.className || '').includes('dsh-git-editor-option'))
const optionByLabel = (tree, label) => optionsOf(tree).find(option => nodes(option, node => node.type === 'span')[0]?.props.children === label)
const labelOf = option => nodes(option, node => node.type === 'span')[0].props.children
const menuCount = tree => nodes(tree, node => node.props?.role === 'menu').length

test('the editor button is a chooser, not a bet on whatever the host happens to find', async () => {
  const f = fixture()
  const trigger = triggerOf(f.tree)
  assert.equal(trigger.props['aria-haspopup'], 'menu')
  assert.equal(trigger.props['aria-expanded'], false)
  assert.match(trigger.props.title, /点击选择/)
  assert.equal(menuCount(f.tree), 0)
  assert.equal(f.calls.listEditors, 0)
})

test('opening the menu lists the editors the host really found, plus the system default', async () => {
  const f = fixture()
  await f.click(triggerOf(f.tree))
  const options = optionsOf(f.tree)
  assert.deepEqual(options.map(labelOf), ['系统默认应用', 'VS Code', 'Zed', '显示文件位置'])
  // The OS association leads, tagged the way Windows 11 tags the double-click handler.
  assert.deepEqual(nodes(options[0], node => node.type === 'span').map(node => node.props.children), ['系统默认应用', '（默认）'])
  // The command is no longer a second column of the row; it waits in the tooltip.
  assert.deepEqual(options.slice(1, 3).map(option => option.props.title), ['code', 'zed'])
  assert.equal(f.calls.listEditors, 1)
  assert.equal(nodes(f.tree, node => node.props?.role === 'status').length, 0)
  assert.equal(triggerOf(f.tree).props['aria-expanded'], true)
})

test('choosing an editor sends exactly that command and reports what opened', async () => {
  const f = fixture()
  await f.click(triggerOf(f.tree))
  await f.click(optionByLabel(f.tree, 'Zed'))
  assert.deepEqual(f.calls.openInEditor, [['D:/repo', 'src/a.ts', 12, 'zed']])
  assert.deepEqual(f.notices.at(-1), { ok: true, text: '已用 Zed 打开：src/a.ts' })
  assert.equal(menuCount(f.tree), 0)
  assert.equal(triggerOf(f.tree).props['aria-expanded'], false)
})

test('the system default application is an explicit entry that asks for no editor', async () => {
  const f = fixture()
  await f.click(triggerOf(f.tree))
  await f.click(optionByLabel(f.tree, '系统默认应用'))
  assert.deepEqual(f.calls.openInEditor, [['D:/repo', 'src/a.ts', 12, 'system']])
  assert.deepEqual(f.notices.at(-1), { ok: true, text: '已用系统默认应用打开：src/a.ts' })
})

test('the footer reveals the file in the file manager instead of opening it in an editor', async () => {
  const f = fixture()
  await f.click(triggerOf(f.tree))
  await f.click(optionByLabel(f.tree, '显示文件位置'))
  assert.deepEqual(f.calls.reveal, [['D:/repo', 'src/a.ts']])
  assert.deepEqual(f.calls.openInEditor, [])
  assert.deepEqual(f.notices.at(-1), { ok: true, text: '已在文件管理器中显示：src/a.ts' })
  assert.equal(menuCount(f.tree), 0)
})

test('a refused reveal shows the host reason instead of pretending it opened', async () => {
  const f = fixture({ reveal: async () => ({ ok: false, error: '无法打开文件管理器' }) })
  await f.click(triggerOf(f.tree))
  await f.click(optionByLabel(f.tree, '显示文件位置'))
  assert.deepEqual(f.notices.at(-1), { ok: false, text: '无法打开文件管理器' })
})

test('a machine without editor CLIs still opens something and says so', async () => {
  const f = fixture({ editors: [] })
  await f.click(triggerOf(f.tree))
  const hint = nodes(f.tree, node => String(node.props?.className || '').includes('dsh-git-editor-hint'))[0]
  assert.match(textOf(hint), /没有检测到编辑器命令行/)
  assert.deepEqual(optionsOf(f.tree).map(labelOf), ['系统默认应用', '显示文件位置'])
})

test('a refused open shows the host reason instead of pretending it opened', async () => {
  const f = fixture({ open: async () => ({ ok: false, error: '找不到编辑器：Zed（命令行不在 PATH 中）' }) })
  await f.click(triggerOf(f.tree))
  await f.click(optionByLabel(f.tree, 'Zed'))
  assert.deepEqual(f.notices.at(-1), { ok: false, text: '找不到编辑器：Zed（命令行不在 PATH 中）' })
})

test('a request that fails outright is reported in the notice bar', async () => {
  const f = fixture({ open: async () => { throw new Error('Network unavailable') } })
  await f.click(triggerOf(f.tree))
  await f.click(optionByLabel(f.tree, 'Zed'))
  assert.deepEqual(f.notices.at(-1), { ok: false, text: 'Network unavailable' })
})

test('a failing probe is shown, keeps the usable entry, and is retried on reopen', async () => {
  const f = fixture({ listEditors: async () => { throw new Error('PATH 读取失败') } })
  await f.click(triggerOf(f.tree))
  const alert = nodes(f.tree, node => node.props?.role === 'alert')
  assert.equal(alert.length, 1)
  assert.match(textOf(alert[0]), /PATH 读取失败/)
  assert.deepEqual(optionsOf(f.tree).map(labelOf), ['系统默认应用', '显示文件位置'])

  await f.keyDown(f.tree, 'Escape')
  assert.equal(menuCount(f.tree), 0)

  f.setApi({ listEditors: async () => [{ command: 'zed', label: 'Zed', goto: false }] })
  await f.click(triggerOf(f.tree))
  assert.deepEqual(optionsOf(f.tree).map(labelOf), ['系统默认应用', 'Zed', '显示文件位置'])
})

test('the host is asked once per session, not on every render', async () => {
  const f = fixture()
  await f.click(triggerOf(f.tree))
  await f.click(triggerOf(f.tree))
  await f.click(triggerOf(f.tree))
  assert.equal(f.calls.listEditors, 1)
})

test('the trigger is disabled while an open is still in flight', async () => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  const f = fixture({ open: async () => { await pending; return { ok: true, editor: 'Zed', target: 'src/a.ts' } } })
  await f.click(triggerOf(f.tree))
  optionByLabel(f.tree, 'Zed').props.onClick({ currentTarget: { closest: () => null } })
  await f.settle()
  assert.equal(triggerOf(f.tree).props.disabled, true)
  release()
  await f.settle()
  assert.equal(triggerOf(f.tree).props.disabled, false)
})

test('the application icon from the host wins over the drawn mark', async () => {
  const icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
  const f = fixture({ editors: [
    { command: 'code', label: 'VS Code', goto: true, icon },
    { command: 'zed', label: 'Zed', goto: false },
  ] })
  await f.click(triggerOf(f.tree))
  const options = optionsOf(f.tree)
  // The default association leads the list and is not an editor, so the icons start after it.
  const image = nodes(options[1], node => node.type === 'img')[0]
  assert.equal(image.props.src, icon)
  assert.equal(image.props.className, 'dsh-git-editor-mark dsh-git-editor-mark-image')
  assert.equal(image.props.alt, '')
  assert.equal(image.props.width, 16)
  // An editor whose icon the host could not read still gets its own mark.
  assert.equal(nodes(options[1], node => node.type?.name === 'EditorMark').length, 0)
  assert.equal(nodes(options[2], node => node.type?.name === 'EditorMark').length, 1)
  assert.equal(nodes(options[2], node => node.type === 'img').length, 0)
})

test('every entry carries its own mark instead of one generic icon', async () => {
  const f = fixture({ editors: [
    { command: 'code', label: 'VS Code', goto: true },
    { command: 'C:\\Program Files\\JetBrains\\IntelliJ IDEA\\bin\\idea64.exe', label: 'IntelliJ IDEA', goto: false },
  ] })
  await f.click(triggerOf(f.tree))
  const marks = optionsOf(f.tree).map(option => nodes(option, node => node.type?.name === 'EditorMark')[0])
  const rendered = marks.map(mark => mark && EditorMark(mark.props))
  // The default association and the reveal action keep plain icons: neither is an editor.
  assert.equal(marks[0], undefined)
  assert.equal(marks[3], undefined)
  // VS Code gets its real ribbon, in its own blue…
  assert.equal(rendered[1].type, 'svg')
  assert.match(rendered[1].props.className, /dsh-git-editor-mark-glyph/)
  assert.equal(nodes(rendered[1], node => node.type === 'path')[0].props.fill, '#007ACC')
  // …while a JetBrains product gets its monogram square.
  assert.deepEqual(rendered[2].props.children, 'IJ')
  assert.equal(rendered[2].props.style.background, '#FE2858')
})

test('a command we do not know still gets stable initials and a theme-toned tile', () => {
  assert.equal(editorKey('C:\\tools\\My Editor.cmd'), 'my editor')
  assert.equal(editorKey('idea64.exe'), 'idea64')
  assert.deepEqual(editorMark('idea64.exe', 'IntelliJ IDEA').color, '#FE2858')
  const unknown = editorMark('acme-edit', 'Acme Editor')
  assert.deepEqual(unknown, editorMark('acme-edit', 'Acme Editor'))
  assert.equal(unknown.initials, 'AE')
  assert.equal(unknown.color, undefined)
  assert.match(unknown.tone, /^(quiet|outline)$/)
  const mark = EditorMark({ command: 'acme-edit', label: 'Acme Editor', size: 16 })
  assert.match(mark.props.className, /^dsh-git-editor-mark dsh-git-editor-mark-(quiet|outline)$/)
  assert.deepEqual(mark.props.children, 'AE')
  assert.equal(mark.props.style.width, 16)
  assert.equal(mark.props.style.background, undefined)
})
