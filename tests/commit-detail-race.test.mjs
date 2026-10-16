import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { setImmediate } from 'node:timers/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { transformSync } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const sourceRoot = pathToFileURL(resolve(root, 'src') + '/').href
const virtual = source => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true })
const apiStub = `export const gitApi = {
  getCommitDetail: (...args) => globalThis.__commitDetailHarness.getCommitDetail(...args),
  requestDiff: (...args) => globalThis.__commitDetailHarness.requestDiff(...args),
  tagCreate: async () => ({ ok: true }), createBranch: async () => ({ ok: true }),
  revert: async () => ({ ok: true }), cherryPick: async () => ({ ok: true }),
}`
const hooksStub = `export default {};
  export const useState = initial => globalThis.__commitDetailHarness.useState(initial);
  export const useEffect = (effect, deps) => globalThis.__commitDetailHarness.useEffect(effect, deps);`
const jsxStub = `export const jsx=(type,props)=>({type,props}); export const jsxs=jsx; export const Fragment='fragment';`
const iconsStub = ['IconClose', 'IconCopy', 'IconExternalLink', 'IconFile', 'IconFolderTree', 'IconRefresh']
  .map(name => `export const ${name}=()=>null;`).join(' ')

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/dialogs/CommitDetailDialog.tsx')) {
      if (specifier === 'react') return virtual(hooksStub)
      if (specifier === 'react/jsx-runtime') return virtual(jsxStub)
      if (specifier.endsWith('/api.js')) return virtual(apiStub)
      if (specifier.endsWith('/icons.js')) return virtual(iconsStub)
      if (specifier.endsWith('/DialogShell.js')) return virtual('export const DialogShell=props=>props.children;')
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith(sourceRoot) && url.endsWith('/dialogs/CommitDetailDialog.tsx')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: transformSync(readFileSync(new URL(url), 'utf8'), { loader: 'tsx', format: 'esm', jsx: 'automatic' }).code,
      }
    }
    return nextLoad(url, context)
  },
})

const { CommitDetailDialog } = await import(pathToFileURL(resolve(root, 'src/client/dialogs/CommitDetailDialog.tsx')).href)
const same = (left, right) => left && right && left.length === right.length && left.every((item, index) => Object.is(item, right[index]))

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function fixture() {
  const slots = []
  const detailRequests = []
  const diffRequests = []
  let cursor = 0
  let effects = []
  let dirty = false
  let tree
  let props = { path: '/repo', commitRef: 'commit-1', onClose() {} }
  const state = globalThis.__commitDetailHarness = {
    getCommitDetail(path, ref, signal) {
      const request = deferred()
      detailRequests.push({ path, ref, signal, ...request })
      return request.promise
    },
    requestDiff(path, options, signal) {
      const request = deferred()
      diffRequests.push({ path, options, signal, ...request })
      return request.promise
    },
    useState(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, update => {
        slots[index].value = typeof update === 'function' ? update(slots[index].value) : update
        dirty = true
      }]
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
  const render = () => {
    cursor = 0
    dirty = false
    tree = CommitDetailDialog(props)
    return tree
  }
  const flush = () => {
    for (let count = 0; count < 20; count++) {
      const pending = effects
      effects = []
      pending.forEach(effect => effect())
      if (dirty) render()
      else if (!effects.length) return
    }
    throw new Error('Commit detail hook harness did not settle')
  }
  render()
  flush()
  return {
    detailRequests,
    diffRequests,
    get tree() { return tree },
    updateProps(next) { props = { ...props, ...next }; return render() },
    flush,
    async settle() { await setImmediate(); flush() },
    dispose() { slots.forEach(slot => slot?.cleanup?.()); delete globalThis.__commitDetailHarness },
  }
}

function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate))
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
}

function text(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree)
  if (!tree || typeof tree !== 'object') return ''
  if (Array.isArray(tree)) return tree.map(text).join('')
  return text(tree.props?.children)
}

const commitDetail = () => ({
  subject: 'Add two files', body: '', author: 'A', authorEmail: 'a@example.test', committer: 'A',
  commitDate: 'today', date: 'today', hash: 'commit-1', parents: [], totalInsertions: 2, totalDeletions: 0,
  files: [
    { path: 'a.txt', status: 'added', insertions: 1, deletions: 0 },
    { path: 'b.txt', status: 'added', insertions: 1, deletions: 0 },
  ],
})

const diffView = marker => ({ files: [{ path: marker, binary: false, hunks: [], rawPatch: `PATCH_${marker}` }] })

test('selecting another commit file never renders the previous file patch under its name', async () => {
  const f = fixture()
  try {
    f.detailRequests[0].resolve(commitDetail())
    await f.settle()

    const fileButtons = nodes(f.tree, node => node.props?.className === 'dsh-git-detail-file')
    fileButtons[0].props.onClick()
    f.flush()
    assert.equal(f.diffRequests.length, 1)
    f.diffRequests[0].resolve(diffView('a.txt'))
    await f.settle()
    assert.match(text(f.tree), /PATCH_a\.txt/)

    nodes(f.tree, node => node.props?.className === 'dsh-git-detail-file')[1].props.onClick()
    const immediateTree = f.updateProps({})
    assert.doesNotMatch(text(immediateTree), /PATCH_a\.txt/)
    assert.match(text(immediateTree), /正在读取文件差异/)
    f.flush()
    assert.equal(f.diffRequests.length, 2)
  } finally { f.dispose() }
})

test('changing repository/commit identity masks the previous commit before effects run', async () => {
  const f = fixture()
  try {
    f.detailRequests[0].resolve(commitDetail())
    await f.settle()
    assert.match(text(f.tree), /Add two files/)

    const next = f.updateProps({ path: '/other-repo', commitRef: 'commit-2' })
    assert.doesNotMatch(text(next), /Add two files/)
    assert.match(text(next), /正在读取提交详情/)
  } finally { f.dispose() }
})
