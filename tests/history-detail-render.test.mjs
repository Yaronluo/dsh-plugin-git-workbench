import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import ts from 'typescript'
import React from 'react'
import { renderToString } from 'react-dom/server'

const root = fileURLToPath(new URL('../', import.meta.url))
const sourceRoot = pathToFileURL(resolve(root, 'src') + '/').href
const virtual = source => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true })
const apiStub = `export const gitApi = {
  getCommitDetail: async () => null,
  requestDiff: async () => null,
  getLog: async () => [],
  getReflog: async () => [],
}`

// Transpile the production TSX modules, but leave React/JSX and the component under test real.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL ?? ''
    if (parent.endsWith('/dialogs/GitGraphDialog.tsx')) {
      if (specifier.endsWith('/api.js')) return virtual(apiStub)
      if (specifier.endsWith('/graph.js')) return virtual('export const computeGraph=()=>[];')
      if (specifier.endsWith('/icons.js')) return virtual('export const IconHistory=()=>null; export const IconRefresh=()=>null;')
      if (specifier.endsWith('/use-git-status.js')) return virtual('export const useGitStatus=()=>({status:null,error:null});')
      if (specifier.endsWith('/loading-state.js')) return virtual('export const GitLoadingState=()=>null;')
    }
    if (parent.endsWith('/dialogs/CommitDetailDialog.tsx') && specifier.endsWith('/api.js')) return virtual(apiStub)
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith(sourceRoot) && /\/dialogs\/(GitGraphDialog|CommitDetailDialog)\.tsx$/.test(url)) {
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

const graphUrl = pathToFileURL(resolve(root, 'src/client/dialogs/GitGraphDialog.tsx')).href
const detailUrl = pathToFileURL(resolve(root, 'src/client/dialogs/CommitDetailDialog.tsx')).href
const [{ SelectedCommitDetails }, { CommitDetailDialog }] = await Promise.all([import(graphUrl), import(detailUrl)])

test('selected commit production region renders detail without a redundant return button', () => {
  const html = renderToString(React.createElement(SelectedCommitDetails, {
    path: '/repo',
    commitRef: 'deadbeef',
    DetailComponent: CommitDetailDialog,
    loadError: null,
    onBack() {},
    onRetry() {},
  }))

  assert.doesNotMatch(html, /返回提交记录|>返回<\/button>/)
  assert.match(html, /正在读取提交详情/)
})

test('selected commit chunk failure keeps its alert and retry action without a back button', () => {
  const html = renderToString(React.createElement(SelectedCommitDetails, {
    path: '/repo',
    commitRef: 'deadbeef',
    DetailComponent: null,
    loadError: 'chunk unavailable',
    onBack() {},
    onRetry() {},
  }))

  assert.doesNotMatch(html, /返回提交记录|>返回<\/button>/)
  assert.match(html, /role="alert"/)
  assert.match(html, /chunk unavailable/)
  assert.match(html, /重试加载详情/)
})
