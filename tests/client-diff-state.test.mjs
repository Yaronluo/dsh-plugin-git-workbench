import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { setImmediate } from 'node:timers/promises'
import ts from 'typescript'
import { loadTs } from './helpers/load-ts.mjs'

// Only execute ChangesTab's hooks/effects. JSX is inert data, not a DOM/visual acceptance test.
const virtual = source => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true })
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/diff/ChangesTab.tsx')) {
      if (specifier === 'react') return virtual(`export default {}; ${['useState', 'useEffect', 'useMemo'].map(name => `export const ${name}=(...args)=>globalThis.__diffHookHarness.${name}(...args);`).join(' ')}`)
      if (specifier === 'react/jsx-runtime') return virtual('export const jsx=(type,props)=>({type,props}); export const jsxs=jsx; export const Fragment="fragment";')
      if (specifier.endsWith('/icons.js')) return virtual(['IconBranch', 'IconCheck', 'IconChevronDown', 'IconDiff', 'IconFile', 'IconRefresh'].map(name => `export const ${name}=()=>null;`).join(' '))
      if (specifier.endsWith('/cwd-resolver.js')) return virtual('export const useWorkspaceCwd=()=>globalThis.__diffHookHarness.cwd;')
      if (specifier.endsWith('/use-git-status.js')) return virtual('export const useGitStatus=()=>globalThis.__diffHookHarness.status;')
    }
    if (specifier.endsWith('/ChangesTab.tsx')) return nextResolve(specifier, context)
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.endsWith('/diff/ChangesTab.tsx')) return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText,
    }
    return nextLoad(url, context)
  },
})
const { ChangesTab } = await loadTs('src/client/diff/ChangesTab.tsx')
const { gitApi } = await loadTs('src/client/api.ts')
const same = (a, b) => a && b && a.length === b.length && a.every((item, i) => Object.is(item, b[i]))
const initialStatus = () => ({ isGit: true, branch: 'topic', head: 'head-1', revision: 'rev-1', upstream: 'fork/topic', dirtyFiles: 1 })
const diff = path => ({ base: 'HEAD', target: 'working', files: [{ path, insertions: 1, deletions: 0, hunks: [] }], totalInsertions: 1, totalDeletions: 0 })

function fixture() {
  const original = gitApi.getDiff
  const requests = []
  const slots = []
  let cursor = 0
  let effects = []
  let dirty = false
  let tree
  const state = globalThis.__diffHookHarness = {
    cwd: '/a', status: { status: initialStatus(), isGit: true, loading: false, error: null, reload() {} },
    useState(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { value: initial }
      return [slots[index].value, update => { slots[index].value = typeof update === 'function' ? update(slots[index].value) : update; dirty = true }]
    },
    useEffect(effect, deps) {
      const index = cursor++
      if (!slots[index] || !same(slots[index].deps, deps)) {
        const previous = slots[index]
        slots[index] = { deps, cleanup: previous?.cleanup }
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect() })
      }
    },
    useMemo(callback, deps) {
      const index = cursor++
      if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { deps, value: callback() }
      return slots[index].value
    },
  }
  gitApi.getDiff = (cwd, base, target, signal) => new Promise((resolve, reject) => requests.push({ cwd, base, target, signal, resolve, reject })) // Ignore cancellation to prove publish guards.
  const render = () => { cursor = 0; dirty = false; tree = ChangesTab({}); return tree }
  const flush = () => {
    for (let i = 0; i < 20; i++) {
      const pending = effects; effects = []; pending.forEach(effect => effect())
      if (dirty) render()
      else if (!effects.length) return
    }
    throw new Error('Hook harness did not settle')
  }
  render(); flush()
  return {
    requests,
    get result() { return slots[4].value }, // ChangesTab: selection, comparison, dropdown, refresh, request result.
    get tree() { return tree },
    updateStatus(patch) { state.status = { ...state.status, status: { ...state.status.status, ...patch } }; render(); flush() },
    switchCwd(cwd) { state.cwd = cwd; const beforeEffects = render(); flush(); return beforeEffects },
    compare(mode) { slots[1].value = mode; render(); flush() },
    statusState(patch) { state.status = { ...state.status, ...patch }; render(); flush() },
    click(node) { node.props.onClick({ currentTarget: { closest: () => null } }); render(); flush() },
    keyDown(node, key) { node.props.onKeyDown({ key, stopPropagation() {}, currentTarget: { querySelector: () => null } }); render(); flush() },
    async settle() { await setImmediate(); flush() },
    dispose() { slots.forEach(slot => slot?.cleanup?.()); gitApi.getDiff = original; delete globalThis.__diffHookHarness },
  }
}

function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate))
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
}

function containsFile(tree, path) {
  if (!tree || typeof tree !== 'object') return false
  if (Array.isArray(tree)) return tree.some(child => containsFile(child, path))
  if (tree.props?.title === path) return true
  return containsFile(tree.props?.children, path)
}

test('comparison picker separates option copy, marks selection and disables missing upstream', () => {
  const f = fixture()
  try {
    f.updateStatus({ upstream: undefined })
    f.click(nodes(f.tree, node => node.props?.title === '切换对比基准')[0])
    const options = nodes(f.tree, node => node.props?.className === 'dsh-git-compare-option')
    assert.equal(options.length, 2)
    assert.equal(options[0].props['aria-pressed'], true)
    assert.equal(options[1].props.disabled, true)
    assert.equal(nodes(options[0], node => node.type === 'strong').length, 1)
    f.keyDown(nodes(f.tree, node => node.props?.className === 'dsh-git-compare-control')[0], 'Escape')
    assert.equal(nodes(f.tree, node => node.props?.className === 'dsh-git-compare-menu').length, 0)
  } finally { f.dispose() }
})

test('repository loading has a skeleton and dedicated status component, not bare text', () => {
  const f = fixture()
  try {
    f.statusState({ status: null, loading: true, isGit: false })
    assert.equal(f.tree.props['aria-busy'], 'true')
    assert.equal(nodes(f.tree, node => node.props?.className === 'dsh-git-toolbar-skeleton').length, 1)
    assert.equal(nodes(f.tree, node => node.props?.repository === true).length, 1)
  } finally { f.dispose() }
})

test('clean working tree omits zero line statistics and displays an intentional empty state', async () => {
  const f = fixture()
  try {
    f.requests[0].resolve({ files: [], totalInsertions: 0, totalDeletions: 0 })
    await f.settle()
    assert.equal(nodes(f.tree, node => node.props?.className === 'dsh-git-stat-badge').length, 0)
    assert.equal(nodes(f.tree, node => node.props?.children === '工作区很干净').length, 1)
    assert.equal(nodes(f.tree, node => node.props?.className === 'dsh-git-file-list').length, 0)
  } finally { f.dispose() }
})

test('ChangesTab refetches on branch, head and revision changes despite unchanged dirty count', async () => {
  const f = fixture()
  try {
    assert.equal(f.requests.length, 1)
    for (const [field, value] of [['branch', 'new-topic'], ['head', 'head-2'], ['revision', 'rev-2']]) {
      const previous = f.requests.at(-1)
      f.updateStatus({ [field]: value })
      assert.equal(previous.signal.aborted, true)
    }
    assert.equal(f.requests.length, 4)
    f.requests[3].resolve(diff('latest.txt'))
    f.requests[0].resolve(diff('stale.txt'))
    await f.settle()
    assert.equal(f.result.view.files[0].path, 'latest.txt')
  } finally { f.dispose() }
})

test('ChangesTab actual upstream comparison rejects late working-tree result and late error', async () => {
  const f = fixture()
  try {
    f.compare('branch-upstream')
    assert.equal(f.requests[1].base, 'fork/topic')
    assert.equal(f.requests[1].target, 'HEAD')
    assert.equal(f.requests[0].signal.aborted, true)
    f.requests[1].resolve(diff('upstream.txt'))
    f.requests[0].resolve(diff('old-working.txt'))
    await f.settle()
    assert.equal(f.result.view.files[0].path, 'upstream.txt')
    f.compare('working-head')
    f.compare('branch-upstream')
    f.requests[3].resolve(diff('new-upstream.txt'))
    f.requests[2].reject(new Error('late working tree error'))
    await f.settle()
    assert.equal(f.result.view.files[0].path, 'new-upstream.txt')
    assert.equal(f.result.error, null)
  } finally { f.dispose() }
})

test('ChangesTab masks previous cwd before effects and surfaces only current errors', async () => {
  const f = fixture()
  try {
    f.requests[0].resolve(diff('old-repo.txt'))
    await f.settle()
    assert.equal(containsFile(f.tree, 'old-repo.txt'), true)
    const beforeEffects = f.switchCwd('/b')
    assert.equal(containsFile(beforeEffects, 'old-repo.txt'), false)
    assert.equal(f.requests[1].cwd, '/b')
    f.requests[1].reject(new Error('new repo diff failed'))
    await f.settle()
    assert.equal(f.result.view, null)
    assert.equal(f.result.error, 'new repo diff failed')
    f.compare('branch-upstream')
    f.updateStatus({ upstream: undefined })
    assert.equal(f.requests.at(-1).signal.aborted, true)
    assert.match(f.result.error, /未配置上游/)
  } finally { f.dispose() }
})
