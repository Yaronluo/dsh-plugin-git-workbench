import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { setImmediate } from 'node:timers/promises'
import ts from 'typescript'
import { loadTs } from './helpers/load-ts.mjs'

// Only execute GitGraphDialog's hooks/effects. JSX is inert data here — this proves the
// request schedule, not the visual result.
const virtual = source => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true })
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/dialogs/GitGraphDialog.tsx')) {
      if (specifier === 'react') return virtual(`export default {}; ${['useState', 'useEffect'].map(name => `export const ${name}=(...args)=>globalThis.__graphHookHarness.${name}(...args);`).join(' ')}`)
      if (specifier === 'react/jsx-runtime') return virtual('export const jsx=(type,props)=>({type,props}); export const jsxs=jsx; export const Fragment="fragment";')
      if (specifier.endsWith('/icons.js')) return virtual(['IconHistory', 'IconRefresh'].map(name => `export const ${name}=()=>null;`).join(' '))
      if (specifier.endsWith('/use-git-status.js')) return virtual('export const useGitStatus=()=>globalThis.__graphHookHarness.status;')
      if (specifier.endsWith('/loading-state.js')) return virtual('export const GitLoadingState=()=>null;')
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.endsWith('/dialogs/GitGraphDialog.tsx')) return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText,
    }
    return nextLoad(url, context)
  },
})
const { GitGraphDialog } = await loadTs('src/client/dialogs/GitGraphDialog.tsx')
const { gitApi } = await loadTs('src/client/api.ts')
const same = (a, b) => a && b && a.length === b.length && a.every((item, i) => Object.is(item, b[i]))
const commit = hash => ({ hash, shortHash: hash, subject: `提交 ${hash}`, author: 'me', date: '刚刚', refs: [] })

function fixture() {
  const original = gitApi.getLog
  const requests = []
  const slots = []
  let cursor = 0
  let effects = []
  let dirty = false
  let tree
  const state = globalThis.__graphHookHarness = {
    status: { status: null, error: null },
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
  }
  gitApi.getLog = (path, limit, signal) => new Promise((resolve, reject) => requests.push({ path, limit, signal, resolve, reject }))
  const render = () => { cursor = 0; dirty = false; tree = GitGraphDialog({ path: '/repo' }); return tree }
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
    get tree() { return tree },
    statusState(patch) { state.status = { ...state.status, ...patch }; render(); flush() },
    async settle() { await setImmediate(); flush() },
    dispose() { slots.forEach(slot => slot?.cleanup?.()); gitApi.getLog = original; delete globalThis.__graphHookHarness },
  }
}

function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate))
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
}

test('提交记录 waits for the repository status, then requests the log exactly once', async () => {
  const f = fixture()
  try {
    // 状态未就绪时不请求日志：否则会用「未知分支」先请求一次，状态到位后再请求一次，
    // 列表先显示又被清空重载——那正是用户看到的两次加载画面。
    assert.equal(f.requests.length, 0)
    f.statusState({ status: { isGit: true, branch: 'main', head: 'head-1' } })
    assert.equal(f.requests.length, 1)
    assert.equal(f.requests[0].path, '/repo')
    assert.equal(f.requests[0].limit, 60)

    f.requests[0].resolve([commit('aaa')])
    await f.settle()
    assert.equal(nodes(f.tree, node => node.props?.className === 'dsh-git-history-item').length, 1)

    // 同一 revision 的状态重新到达（例如事件推送）不会再次请求。
    f.statusState({ status: { isGit: true, branch: 'main', head: 'head-1' } })
    assert.equal(f.requests.length, 1)

    // 真正换了 revision 才重新请求。
    f.statusState({ status: { isGit: true, branch: 'main', head: 'head-2' } })
    assert.equal(f.requests.length, 2)
  } finally { f.dispose() }
})

test('提交记录 does not wait forever when the repository status itself fails', async () => {
  const f = fixture()
  try {
    f.statusState({ status: null, error: 'git 不可用' })
    assert.equal(f.requests.length, 1)
    f.requests[0].reject(new Error('日志读取失败'))
    await f.settle()
    assert.equal(nodes(f.tree, node => node.props?.children === '日志读取失败').length, 1)
  } finally { f.dispose() }
})
