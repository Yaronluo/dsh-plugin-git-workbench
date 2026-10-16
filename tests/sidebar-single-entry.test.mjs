import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { loadTs } from './helpers/load-ts.mjs'

// Component sources import sibling `.js` specifiers that only exist as .ts/.tsx.
const root = fileURLToPath(new URL('../', import.meta.url))
const sourceRoot = pathToFileURL(resolve(root, 'src') + '/').href
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith(sourceRoot) && specifier.endsWith('.js')) {
      for (const extension of ['.ts', '.tsx']) {
        const candidate = new URL(specifier.slice(0, -3) + extension, context.parentURL)
        if (existsSync(candidate)) return { url: candidate.href, shortCircuit: true }
      }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith(sourceRoot) && url.endsWith('.tsx')) {
      return { format: 'module', shortCircuit: true, source: transformSync(readFileSync(new URL(url), 'utf8'), { loader: 'tsx', format: 'esm' }).code }
    }
    return nextLoad(url, context)
  },
})

const { GitSidebarPanel } = await import(pathToFileURL(resolve(root, 'src/client/panels/GitSidebarPanel.tsx')).href)
const { GitWorkbenchPage } = await import(pathToFileURL(resolve(root, 'src/client/panels/GitWorkbenchPage.tsx')).href)
const navigation = await loadTs('src/client/panels/navigation.ts')
const { createGitPanelOpener, GIT_PANEL_TYPES, GIT_CONVERSATION_VIEW, GIT_WORKBENCH_TITLE } = await loadTs('src/client/sidebar-actions.ts')

const render = (props = {}) => renderToStaticMarkup(React.createElement(GitSidebarPanel, {
  tab: { path: '/repo' }, scope: { sessionId: 'session-1' }, ...props,
}))

test('Git registers a native conversation view, not a right-sidebar launcher entry', async () => {
  const index = await readFile(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
  const registration = await readFile(new URL('../src/client/conversation-registration.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(index, /registerTab\(/)
  assert.match(index, /installGitSidechat/, 'optional sidebar integration is only for AI draft conversations')
  assert.match(index, /installGitConversationView/)
  assert.match(registration, /name: 'conversation.view', id: GIT_CONVERSATION_VIEW/)
  assert.match(registration, /label: \(\) => GIT_WORKBENCH_TITLE, order: 40/)
})

test('every reachable Git page resolves to the single namespaced conversation view', () => {
  assert.equal(GIT_CONVERSATION_VIEW, 'dsh-plugin-git')
  assert.match(GIT_CONVERSATION_VIEW, /^dsh-plugin-git/)
  assert.equal(GIT_WORKBENCH_TITLE, 'Git')
  const views = Object.keys(GIT_PANEL_TYPES)
  assert.deepEqual(views.sort(), [...navigation.GIT_PANEL_VIEWS].sort())
  assert.equal(new Set(Object.values(GIT_PANEL_TYPES)).size, 1)
  assert.equal(Object.values(GIT_PANEL_TYPES)[0], GIT_CONVERSATION_VIEW)
})

test('only blank-session workbench renders a small conversation/Git tab escape path', () => {
  const blank = renderToStaticMarkup(React.createElement(GitWorkbenchPage, {
    cwd: '/repo', useSession: select => select({ blank: true }), onReturnToConversation() {},
  }))
  assert.match(blank, /class="dsh-git-workbench" aria-label="Git 工作台"/)
  assert.match(blank, /title="\/repo"/)
  assert.match(blank, /role="tablist" aria-label="会话视图"/)
  assert.match(blank, /role="tab" aria-selected="false"[^>]*>对话<\/button>/)
  assert.match(blank, /role="tab" aria-selected="true">Git<\/span>/)
  assert.doesNotMatch(blank, /返回对话/)
  assert.doesNotMatch(blank, /aria-modal|modal-overlay|position:fixed/)

  const normal = renderToStaticMarkup(React.createElement(GitWorkbenchPage, {
    cwd: '/repo', useSession: select => select({ blank: false }),
  }))
  assert.doesNotMatch(normal, /dsh-git-blank-nav|返回对话/)
})

test('one panel hosts the pages as tabs and the creation flows as actions', () => {
  const markup = render({ tab: { path: '/repo', meta: { gitView: 'changes' } } })
  assert.equal(markup.match(/role="tab"/g)?.length, 4)
  for (const label of ['变更', '提交记录', '储藏', '工作树']) assert.match(markup, new RegExp(`>${label}<`))
  for (const label of ['创建分支', '创建工作树']) assert.match(markup, new RegExp(`aria-label="${label}"`))
  assert.match(markup, /dsh-git-view-nav/)
  // Exactly one page body: the requested view, not five stacked panels.
  assert.equal(markup.match(/dsh-git-view-content/g)?.length, 1)
  assert.match(markup, /role="tab" aria-selected="true"[^>]*>[^<]*<svg/)
})

test('an explicit page selects its tab; each repository keeps its own remembered page', () => {
  const history = render({ tab: { path: '/repo', meta: { gitView: 'history' } } })
  assert.match(history, /role="tab" aria-selected="true"[^>]*>[\s\S]{0,400}?提交记录/)
  const branchForm = render({ tab: { path: '/repo', meta: { gitView: 'create-branch' } } })
  assert.match(branchForm, /aria-pressed="true"/)
  assert.doesNotMatch(branchForm, /aria-modal|modal-overlay/)

  assert.equal(navigation.activeGitView('session-a', '/repo'), 'changes')
  navigation.setActiveGitView('session-a', '/repo', 'worktrees')
  navigation.setActiveGitView('session-b', '/repo', 'history')
  assert.equal(navigation.activeGitView('session-a', '/repo'), 'worktrees')
  assert.equal(navigation.activeGitView('session-b', '/repo'), 'history')
  assert.equal(navigation.activeGitView('session-a', '/other'), 'changes')
  // Only an unset page falls back to the tab's restored meta.
  assert.equal(navigation.activeGitView('session-c', '/repo', 'history'), 'history')
  assert.equal(navigation.activeGitView('session-a', '/repo', 'history'), 'worktrees')
})

test('a page that owns its loading state is never wrapped in a second placeholder', () => {
  // 提交记录 / 工作树 自带加载态。面板若在它们前面再放一个“正在检测 Git 仓库”占位，
  // 用户就会先看到一个加载画面、随即又被换成页面自己的加载画面。
  const history = render({ tab: { path: '/repo', meta: { gitView: 'history' } } })
  assert.equal(history.match(/dsh-git-changes-loading/g)?.length, 1)
  assert.match(history, /正在读取提交记录/)
  assert.doesNotMatch(history, /正在检测 Git 仓库/)
  const worktrees = render({ tab: { path: '/repo', meta: { gitView: 'worktrees' } } })
  assert.doesNotMatch(worktrees, /正在检测 Git 仓库/)
})

test('a refused conversation view registration reports its real reason', async () => {
  const open = createGitPanelOpener({})
  navigation.noteGitViewError('native conversation store missing')
  await assert.rejects(() => open('changes', { sessionId: 'session-1', cwd: '/repo' }), /注册失败：native conversation store missing/)
  navigation.noteGitViewError('')
  await assert.rejects(() => navigation.openGitSessionView('unmounted-session', '/repo', 5), /尚未就绪/)
})
