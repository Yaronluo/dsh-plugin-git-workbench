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
  assert.match(markup, /class="dsh-git-page-title"[\s\S]*?Stashes[\s\S]*?Save the current uncommitted changes/)
  assert.match(markup, /class="dsh-git-page-actions"[\s\S]*?dsh-git-btn-primary[\s\S]*?Create stash[\s\S]*?Refresh[\s\S]*?Close/)
  assert.match(markup, /class="dsh-git-page-body"/)
  assert.match(markup, /Stash list/)
  assert.match(markup, /Total 0 stashes/)
  assert.match(stashSource, /<div className='dsh-git-empty-state'>\s*<div className='dsh-git-state-icon'><IconStash/)
  assert.match(stashSource, /<strong>No stashes<\/strong>[\s\S]*?After you create a stash/)
})

test('工作树管理在 Git 工作台中以整页呈现且不显示弹窗关闭/完成控件', () => {
  const markup = renderInline(React.createElement(WorktreeManagerDialog, { path: '/repo', onClose() {}, onOpenWorktree: async () => {} }))
  assert.match(markup, /class="dsh-git-page"/)
  assert.match(markup, /class="dsh-git-page-header"/)
  assert.match(markup, /class="dsh-git-page-title"[\s\S]*?Manage Git worktrees[\s\S]*?Inspect standalone working directories/)
  assert.match(markup, /class="dsh-git-page-actions"[\s\S]*?Refresh[\s\S]*?Preview cleaning up stale worktrees/)
  assert.match(markup, /class="dsh-git-page-body"/)
  assert.match(markup, /Worktree list/)
  assert.match(markup, /Total 0 worktrees/)
  assert.doesNotMatch(markup, /modal-header|modal-footer|Close|Done|Force remove/)
  assert.match(worktreeSource, /<strong>No worktrees<\/strong>[\s\S]*?A worktree checks the branch out/)
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
  assert.match(worktreeSource, /pendingDelete === worktree\.path && <div className='dsh-git-section' role='group' aria-label='Confirm worktree removal'>[\s\S]*?checked=\{forceDelete\}[\s\S]*?may discard uncommitted changes[\s\S]*?Confirm force-removing the worktree/)
  assert.equal(worktreeSource.match(/checked=\{forceDelete\}/g)?.length, 1)
  assert.match(worktreeSource, /pruneOutput !== null[\s\S]*?Confirm cleaning up stale worktrees/)
  assert.match(worktreeSource, /setPruneReady\(!!output\)/)
  assert.match(worktreeSource, /only when a worktree directory is deleted or moved by hand/)
})

test('储藏删除仍需二次确认，预览与应用操作保留具名按钮', () => {
  assert.match(stashSource, /pendingDrop === stash\.index \? <>[\s\S]*?Confirm delete[\s\S]*?Cancel/)
  assert.match(stashSource, /setPendingDrop\(stash\.index\)/)
  assert.match(stashSource, /View diff/)
  assert.match(stashSource, /\/>Apply/)
  assert.match(stashSource, /Pop and remove/)
})
