import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import ts from 'typescript'
import { loadTs } from './helpers/load-ts.mjs'

// A file's history rows were buttons whose only handler was an optional callback nobody
// passed, so clicking one did nothing at all. The drill-in now belongs to the dialog, so
// this file drives the real component as a plain function with the hooks stubbed
// (the same pattern as client-diff-state and editor-menu).

const virtual = source => `data:text/javascript,${encodeURIComponent(source)}`

const reactStub = `
export const useState = (...args) => globalThis.__fileHistoryHarness.useState(...args)
export const useEffect = (...args) => globalThis.__fileHistoryHarness.useEffect(...args)
export default { useState, useEffect }
`
const jsxStub = `
export const jsx = (type, props) => ({ type, props })
export const jsxs = jsx
export const Fragment = 'fragment'
`
const iconsStub = `
export const IconClose = () => null
export const IconCopy = () => null
export const IconFile = () => null
export const IconFolderTree = () => null
export const IconRefresh = () => null
`
const apiStub = `
const api = () => globalThis.__fileHistoryHarness.api
export const gitApi = {
  getFileHistory: (...args) => api().getFileHistory(...args),
  getBlame: (...args) => api().getBlame(...args),
  reveal: (...args) => api().reveal(...args),
}
export const errorMessage = error => (error && error.message) || String(error)
`
const shellStub = `export const DialogShell = props => ({ type: 'DialogShell', props })`
const editorMenuStub = `export const OpenInEditorMenu = () => null`
const commitDetailsStub = `export const SelectedCommitDetails = props => ({ type: 'SelectedCommitDetails', props })`
const detailChunkStub = `export const CommitDetailDialog = () => null`
// A distinct module URL: the successful chunk is already cached by then, and re-importing
// the same data: URL would just hand back the module that loaded fine.
const failingChunkStub = `throw new Error('chunk unavailable')`

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes('FileInspectDialog.tsx') || context.parentURL?.includes('file-history-drill')) {
      if (specifier === 'react') return { url: virtual(reactStub), shortCircuit: true }
      if (specifier === 'react/jsx-runtime') return { url: virtual(jsxStub), shortCircuit: true }
      if (specifier.endsWith('api.js')) return { url: virtual(apiStub), shortCircuit: true }
      if (specifier.endsWith('icons.js')) return { url: virtual(iconsStub), shortCircuit: true }
      if (specifier.endsWith('editor-menu.js')) return { url: virtual(editorMenuStub), shortCircuit: true }
      if (specifier.endsWith('DialogShell.js')) return { url: virtual(shellStub), shortCircuit: true }
      if (specifier.endsWith('GitGraphDialog.js')) return { url: virtual(commitDetailsStub), shortCircuit: true }
      if (specifier.endsWith('CommitDetailDialog.js')) return { url: virtual(globalThis.__fileHistoryHarness.failDetailChunk ? failingChunkStub : detailChunkStub), shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.endsWith('/FileInspectDialog.tsx')) {
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

const { FileInspectDialog } = await loadTs('src/client/dialogs/FileInspectDialog.tsx')

/** Minimal hooks runtime: state slots and effects, in call order. */
const harness = globalThis.__fileHistoryHarness = {
  api: null,
  failDetailChunk: false,
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

const historyEntries = [
  { hash: 'aaaa1111', shortHash: 'aaaa111', subject: 'feat: first', author: 'Yaron', date: '2 hours ago' },
  { hash: 'bbbb2222', shortHash: 'bbbb222', subject: 'fix: second', author: 'Yaron', date: '3 hours ago' },
]

function fixture({ history = historyEntries, onOpenCommit } = {}) {
  const calls = { fileHistory: [], blame: [] }
  const opened = []
  const closed = []
  harness.api = {
    getFileHistory: async (path, file, limit) => { calls.fileHistory.push([path, file, limit]); return history },
    getBlame: async (path, file) => { calls.blame.push([path, file]); return { totalLines: 2, truncated: false, lines: [] } },
    reveal: async () => ({ ok: true }),
  }
  harness.slots = []
  harness.cursor = 0
  harness.dirty = false
  harness.pending.length = 0
  harness.failDetailChunk = false

  const props = {
    path: 'D:/repo', file: 'src/a.ts',
    onClose: () => closed.push(true),
    onOpenCommit: hash => { opened.push(hash); onOpenCommit?.(hash) },
  }
  let tree = null
  const render = () => {
    harness.cursor = 0
    harness.dirty = false
    tree = FileInspectDialog({ ...props })
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
    throw new Error('the file inspector did not settle')
  }
  render()
  return {
    get tree() { return tree },
    calls,
    opened,
    closed,
    settle,
    reuse(patch) { Object.assign(props, patch); render() },
    async click(node) { node.props.onClick({ currentTarget: { closest: () => null } }); await settle() },
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

const rowButtons = tree => nodes(tree, node => node.type === 'button' && node.props?.className === 'dsh-git-reflog-row')
const detailViews = tree => nodes(tree, node => node.type?.name === 'SelectedCommitDetails')
const tabButton = (tree, label) => nodes(tree, node => node.type === 'button' && node.props?.children === label)[0]
const blameRows = tree => nodes(tree, node => node.type === 'button' && String(node.props?.className || '').includes('dsh-git-blame-row'))

test('the file history lists its commits before anything is drilled into', async () => {
  const f = fixture()
  await f.settle()
  assert.equal(rowButtons(f.tree).length, 2)
  assert.deepEqual(detailViews(f.tree), [])
  assert.deepEqual(f.calls.fileHistory, [['D:/repo', 'src/a.ts', 50]])
})

test('choosing a commit replaces the history list with that commit detail', async () => {
  const f = fixture()
  await f.settle()
  await f.click(rowButtons(f.tree)[1])

  const [detail] = detailViews(f.tree)
  assert.ok(detail, 'the detail view should be rendered')
  assert.equal(detail.props.commitRef, 'bbbb2222')
  assert.equal(detail.props.path, 'D:/repo')
  assert.equal(detail.props.showBackButton, true)
  assert.equal(typeof detail.props.DetailComponent, 'function', 'the lazy chunk should have loaded')
  assert.deepEqual(detail.props.loadError, null)
  assert.deepEqual(rowButtons(f.tree), [], 'the list gives way to the detail instead of stacking below it')
  assert.deepEqual(f.opened, ['bbbb2222'], 'an embedder still learns which commit was chosen')
})

test('returning from the detail goes back to the same file history', async () => {
  const f = fixture()
  await f.settle()
  await f.click(rowButtons(f.tree)[0])
  const [detail] = detailViews(f.tree)
  detail.props.onBack()
  await f.settle()

  assert.deepEqual(detailViews(f.tree), [])
  assert.equal(rowButtons(f.tree).length, 2)
})

test('switching tabs leaves the drilled-in commit behind', async () => {
  const f = fixture()
  await f.settle()
  await f.click(rowButtons(f.tree)[0])
  assert.equal(detailViews(f.tree).length, 1)

  await f.click(tabButton(f.tree, '责任'))
  assert.deepEqual(detailViews(f.tree), [])
  assert.deepEqual(f.calls.blame, [['D:/repo', 'src/a.ts']])
})

test('reusing the dialog for another file never shows the previous file commit', async () => {
  const f = fixture()
  await f.settle()
  await f.click(rowButtons(f.tree)[0])
  assert.equal(detailViews(f.tree).length, 1)

  f.reuse({ file: 'src/b.ts' })
  await f.settle()
  assert.deepEqual(detailViews(f.tree), [])
  assert.deepEqual(f.calls.fileHistory.at(-1), ['D:/repo', 'src/b.ts', 50])
})

test('a detail chunk that cannot load reports it with a retry instead of a blank view', async () => {
  const f = fixture()
  harness.failDetailChunk = true
  await f.settle()
  await f.click(rowButtons(f.tree)[0])

  const [detail] = detailViews(f.tree)
  assert.ok(detail)
  assert.equal(detail.props.DetailComponent, null)
  assert.equal(detail.props.loadError, 'chunk unavailable')
  assert.equal(typeof detail.props.onRetry, 'function')
})
