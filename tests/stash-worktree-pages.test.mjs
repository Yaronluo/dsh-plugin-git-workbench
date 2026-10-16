import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformSync } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const sourceRoot = pathToFileURL(resolve(root, 'src') + '/').href
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith(sourceRoot) && specifier.endsWith('.js')) {
      const base = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL)
      if (existsSync(base)) return { url: base.href, shortCircuit: true }
      const tsx = new URL(`${specifier.slice(0, -3)}.tsx`, context.parentURL)
      if (existsSync(tsx)) return { url: tsx.href, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith(sourceRoot) && url.endsWith('.tsx')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: transformSync(readFileSync(new URL(url), 'utf8'), { loader: 'tsx', format: 'esm', jsx: 'automatic' }).code,
      }
    }
    if (url.startsWith(sourceRoot) && url.endsWith('.ts')) {
      return { format: 'module', shortCircuit: true, source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }) }
    }
    return nextLoad(url, context)
  },
})

const { StashPanel } = await import(pathToFileURL(resolve(root, 'src/client/dialogs/StashPanel.tsx')).href)
const { WorktreeManagerDialog } = await import(pathToFileURL(resolve(root, 'src/client/dialogs/WorktreeDialogs.tsx')).href)
const { GitPanelContext } = await import(pathToFileURL(resolve(root, 'src/client/panels/panel-context.ts')).href)
const stashSource = readFileSync(resolve(root, 'src/client/dialogs/StashPanel.tsx'), 'utf8')
const worktreeSource = readFileSync(resolve(root, 'src/client/dialogs/WorktreeDialogs.tsx'), 'utf8')
const panelSource = readFileSync(resolve(root, 'src/client/panels/GitSidebarPanel.tsx'), 'utf8')

const renderInline = component => renderToStaticMarkup(React.createElement(
  GitPanelContext.Provider,
  { value: true },
  component,
))

test('储藏页 SSR 使用统一整页结构、主操作和计数', () => {
  const markup = renderToStaticMarkup(React.createElement(StashPanel, { path: '/repo', onClose() {} }))
  assert.match(markup, /class="dsh-git-page"/)
  assert.match(markup, /class="dsh-git-page-header"/)
  assert.match(markup, /class="dsh-git-page-title"[\s\S]*?储藏[\s\S]*?保存当前未提交的改动/)
  assert.match(markup, /class="dsh-git-page-actions"[\s\S]*?dsh-git-btn-primary[\s\S]*?创建储藏[\s\S]*?刷新[\s\S]*?关闭/)
  assert.match(markup, /class="dsh-git-page-body"/)
  assert.match(markup, /储藏列表/)
  assert.match(markup, /共 0 个储藏/)
  assert.match(stashSource, /<div className='dsh-git-empty-state'>\s*<div className='dsh-git-state-icon'><IconStash/)
  assert.match(stashSource, /<strong>没有储藏<\/strong>[\s\S]*?创建储藏后/)
})

test('工作树管理在 Git 工作台中以整页呈现且不显示弹窗关闭/完成控件', () => {
  const markup = renderInline(React.createElement(WorktreeManagerDialog, { path: '/repo', onClose() {}, onOpenWorktree: async () => {} }))
  assert.match(markup, /class="dsh-git-page"/)
  assert.match(markup, /class="dsh-git-page-header"/)
  assert.match(markup, /class="dsh-git-page-title"[\s\S]*?管理 Git 工作树[\s\S]*?查看独立工作目录/)
  assert.match(markup, /class="dsh-git-page-actions"[\s\S]*?刷新[\s\S]*?预览清理失效工作树/)
  assert.match(markup, /class="dsh-git-page-body"/)
  assert.match(markup, /工作树列表/)
  assert.match(markup, /共 0 棵工作树/)
  assert.doesNotMatch(markup, /modal-header|modal-footer|关闭|完成|强制移除/)
  assert.match(worktreeSource, /<strong>暂无工作树<\/strong>[\s\S]*?创建工作树后/)
})

test('创建并打开工作树时，打开失败会保留表单供用户重试', () => {
  assert.match(panelSource, /onSuccess=\{onOpenWorktree \? undefined : \(\) => onFinish\('worktrees'\)\}/)
  assert.match(worktreeSource, /if \(onOpenWorktree\) await onOpenWorktree\(destination\)[\s\S]*?onClose\(\)/)
  assert.match(worktreeSource, /catch \(error\) \{ setError\(message\(error\)\) \}/)
})

test('工作树强制移除只在二次确认区显式启用且默认关闭', () => {
  assert.match(worktreeSource, /const \[forceDelete, setForceDelete\] = useState\(false\)/)
  assert.match(worktreeSource, /if \(pendingDelete !== worktreePath\) return/)
  assert.match(worktreeSource, /gitApi\.removeWorktree\(path, worktreePath, forceDelete\)/)
  assert.match(worktreeSource, /pendingDelete !== worktree\.path && <button[^>]*onClick=\{\(\) => \{ setForceDelete\(false\); setPendingDelete\(worktree\.path\) \}\}/)
  assert.match(worktreeSource, /pendingDelete === worktree\.path && <div className='dsh-git-section' role='group' aria-label='确认移除工作树'>[\s\S]*?checked=\{forceDelete\}[\s\S]*?可能丢弃未提交改动[\s\S]*?确认强制移除工作树/)
  assert.equal(worktreeSource.match(/checked=\{forceDelete\}/g)?.length, 1)
  assert.match(worktreeSource, /pruneOutput !== null[\s\S]*?确认清理失效工作树/)
})

test('储藏删除仍需二次确认，预览与应用操作保留具名按钮', () => {
  assert.match(stashSource, /pendingDrop === stash\.index \? <>[\s\S]*?确认删除[\s\S]*?取消/)
  assert.match(stashSource, /setPendingDrop\(stash\.index\)/)
  assert.match(stashSource, /查看差异/)
  assert.match(stashSource, /\/>应用/)
  assert.match(stashSource, /弹出并移除/)
})
