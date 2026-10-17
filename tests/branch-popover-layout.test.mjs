import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTs } from './helpers/load-ts.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const sourceRoot = pathToFileURL(resolve(root, 'src') + '/').href
const popoverUrl = pathToFileURL(resolve(root, 'src/client/chips/BranchPopover.tsx')).href
const virtual = source => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true })

// The popover is rendered for real (React, hooks, the production component); only the network and
// the icon set are replaced, because neither is what this file is about.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((context.parentURL ?? '').endsWith('/chips/BranchPopover.tsx')) {
      if (specifier.endsWith('/api.js')) return virtual('export const gitApi = { fetch: async () => ({ ok: true }), pull: async () => ({ ok: true }), push: async () => ({ ok: true }) };')
      if (specifier.endsWith('/branch-list.js')) return virtual('export const selectableBranches = branches => branches.filter(branch => !branch.isRemote);')
      if (specifier.endsWith('/icons.js')) {
        const names = ['IconArrowDown', 'IconArrowUp', 'IconBranch', 'IconBranchPlus', 'IconCheck', 'IconCloudRefresh', 'IconHistory', 'IconPull', 'IconPush', 'IconSearch', 'IconFolderTree']
        return virtual(names.map(name => `export const ${name}=()=>null;`).join(''))
      }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith(sourceRoot) && url.endsWith('/chips/BranchPopover.tsx')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
        }).outputText,
      }
    }
    return nextLoad(url, context)
  },
})

const { BranchPopover } = await import(popoverUrl)

const props = {
  view: {
    current: 'master',
    branches: [
      { name: 'master', current: true },
      { name: 'origin/master', isRemote: true },
      { name: 'feature/in-progress', current: false },
    ],
    dirtyFiles: 0,
  },
  path: '/repo',
  status: {},
  onSwitch: async () => {},
  onCreateBranch() {},
  onOpenGraph() {},
  onCreateWorktree() {},
  onManageWorktrees() {},
  onClose() {},
}

test('the sync buttons keep the sync result out of their own row', () => {
  const markup = renderToStaticMarkup(React.createElement(BranchPopover, props))

  assert.match(markup, /role="dialog"/)
  assert.match(markup, /dsh-git-popover-actions/)
  assert.match(markup, /title="获取远程更新"/)
  assert.match(markup, /title="拉取远程更新"/)
  assert.match(markup, /title="推送本地提交"/)
  assert.match(markup, /管理工作树/)
})

test('the popover markup and sheet keep the two layout fixes', async () => {
  const source = readFileSync(new URL('../src/client/chips/BranchPopover.tsx', import.meta.url), 'utf8')
  const actions = source.slice(source.indexOf("className='dsh-git-popover-actions'"), source.indexOf("className='dsh-git-footer'"))
  // The result text was a sibling of the three buttons, so it wrapped one character per line.
  assert.doesNotMatch(actions, /notice/, '同步结果必须留在按钮行之外')
  assert.match(source, /className='dsh-git-popover-notice'/)

  const { sheetText } = await loadTs('src/client/styles.ts')
  const sheet = sheetText()
  // A single branch must not reserve a 240px empty box, and the notice must own a full row.
  assert.match(sheet, /\.dsh-git-branch-list \{[^}]*flex: 0 1 auto/)
  assert.match(sheet, /\.dsh-git-popover-notice \{[^}]*margin: 6px 10px 0/)
  assert.match(sheet, /\.dsh-git-popover-notice \{[^}]*overflow-wrap: anywhere/)
})
