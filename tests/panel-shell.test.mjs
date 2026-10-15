import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'
import { loadTs } from './helpers/load-ts.mjs'
registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith('/dialogs/DialogShell.tsx')) return { format: 'module', shortCircuit: true, source: transformSync(readFileSync(new URL(url), 'utf8'), { loader: 'tsx', format: 'esm' }).code }
  return nextLoad(url, context)
} })
const { DialogShell } = await loadTs('src/client/dialogs/DialogShell.tsx')
const { GitPanelContext } = await loadTs('src/client/panels/panel-context.ts')

test('native panel presentation retains form content without overlay, modal focus trap or fixed dimensions', () => {
  const markup = renderToStaticMarkup(React.createElement(GitPanelContext.Provider, { value: true },
    React.createElement(DialogShell, { title: '创建分支', onClose() {}, style: { width: 720, height: 520 } }, React.createElement('button', null, '提交')),
  ))
  assert.match(markup, /dsh-git-panel-form/)
  assert.match(markup, /提交/)
  assert.doesNotMatch(markup, /modal-overlay|aria-modal|role="dialog"|width:720|height:520/)
})
