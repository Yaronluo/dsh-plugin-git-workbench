import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformSync } from 'esbuild'

const source = await readFile(new URL('../src/client/icons.tsx', import.meta.url), 'utf8')
const { code } = transformSync(source, { loader: 'tsx', format: 'cjs' })
const module = { exports: {} }
new Function('require', 'module', 'exports', code)(createRequire(import.meta.url), module, module.exports)
const icons = module.exports
const render = (name, props = {}) => renderToStaticMarkup(React.createElement(icons[name], props))
const names = [
  'IconBranch', 'IconChevronDown', 'IconSearch', 'IconCheck', 'IconDiff',
  'IconFile', 'IconRefresh', 'IconClose', 'IconGraph', 'IconWorktree',
  'IconBranchPlus', 'IconHistory', 'IconFolderTree', 'IconChevronRight',
]

test('all existing and new icons share a rounded, currentColor 24px coordinate system', () => {
  assert.deepEqual(Object.keys(icons).sort(), [...names].sort())
  for (const name of names) {
    const markup = render(name)
    for (const attribute of [
      'viewBox="0 0 24 24"', 'fill="none"', 'stroke="currentColor"',
      'stroke-width="1.7"', 'stroke-linecap="round"', 'stroke-linejoin="round"',
      'aria-hidden="true"', 'focusable="false"',
    ]) assert.ok(markup.includes(attribute), `${name}: ${attribute}`)
    const defaultSize = name.startsWith('IconChevron') ? 12 : 14
    assert.ok(markup.includes(`width="${defaultSize}" height="${defaultSize}"`), name)
  }
})

test('icons preserve size, className and style props', () => {
  for (const name of names) {
    const markup = render(name, { size: 20, className: 'menu-icon', style: { opacity: 0.5 } })
    assert.match(markup, /width="20" height="20"/)
    assert.match(markup, /class="menu-icon"/)
    assert.match(markup, /style="opacity:0.5"/)
  }
})

test('legacy Graph and Worktree names render the intended history and folder/fork icons', () => {
  assert.equal(render('IconGraph'), render('IconHistory'))
  assert.equal(render('IconWorktree'), render('IconFolderTree'))
  assert.equal((render('IconHistory').match(/<circle/g) ?? []).length, 0)
  assert.equal((render('IconFolderTree').match(/<circle/g) ?? []).length, 3)
})

test('branch connections stop at the circle boundaries rather than passing through nodes', () => {
  assert.match(render('IconBranch'), /d="M6 7v10M6 14h5a7 7 0 0 0 7-7"/)
  assert.match(render('IconBranch'), /cx="6" cy="5" r="2"/)
  assert.match(render('IconBranch'), /cx="6" cy="19" r="2"/)
  assert.match(render('IconBranch'), /cx="18" cy="5" r="2"/)
  assert.match(render('IconBranchPlus'), /d="M6 7v10M6 15h4a6 6 0 0 0 6-6M17 4h4M19 2v4"/)
  assert.match(render('IconBranchPlus'), /cx="16" cy="7" r="2"/)
})
