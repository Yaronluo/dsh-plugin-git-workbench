import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { loadTs } from './helpers/load-ts.mjs'
const { createGitPanelOpener, GIT_PANEL_TYPES, GIT_CONVERSATION_VIEW } = await loadTs('src/client/sidebar-actions.ts')
const { bindGitSessionNavigator, activeGitView, openGitSessionView } = await loadTs('src/client/panels/navigation.ts')
const { installHeroControls } = await loadTs('src/client/hero-registration.ts')

test('every Git page opens the exact Session native conversation view without a sidebar dependency', async t => {
  const calls = []
  t.after(bindGitSessionNavigator('exact-session', { cwd: 'D:/worktree', select: view => calls.push(view) }))
  const open = createGitPanelOpener({})
  for (const view of Object.keys(GIT_PANEL_TYPES)) {
    await open(view, { cwd: 'D:/worktree', sessionId: 'exact-session' })
    assert.equal(activeGitView('exact-session', 'D:/worktree'), view)
  }
  assert.deepEqual(calls, Object.keys(GIT_PANEL_TYPES).map(() => GIT_CONVERSATION_VIEW))
})

test('blank-session panel opening adopts only its explicit project before navigating', async () => {
  const calls = []
  const unbind = bindGitSessionNavigator('new-session', { cwd: 'D:/chosen', select: view => calls.push(['view', view]) })
  const open = createGitPanelOpener({
    workspaces: { create: async value => { calls.push(['workspace', value]); return { workspaceId: 'chosen-project' } } },
    uiWorkspace: { connectWorkspace: async id => { calls.push(['connect', id]); return 'new-session' }, openWorkspace: async id => calls.push(['navigate', id]) },
  })
  try { await open('changes', { cwd: 'D:/chosen' }) } finally { unbind() }
  assert.deepEqual(calls, [['workspace', { path: 'D:/chosen' }], ['connect', 'chosen-project'], ['navigate', 'chosen-project'], ['view', GIT_CONVERSATION_VIEW]])
})

test('navigation waits for mount and rejects stale repository ownership', async () => {
  await assert.rejects(openGitSessionView('missing', '/repo', 5), /尚未就绪/)
  const waiting = openGitSessionView('later', '/repo', 500)
  const calls = []
  const unbind = bindGitSessionNavigator('later', { cwd: '/repo', select: view => calls.push(view) })
  try {
    await waiting
    assert.deepEqual(calls, [GIT_CONVERSATION_VIEW])
    await assert.rejects(openGitSessionView('later', '/other'), /目录已改变/)
  } finally { unbind() }
})

function presetFixture(extra = {}) {
  const Original = () => null
  const original = { component: Original, options: { priority: 0 }, inject: () => ({ hooks: { agentPresetSeat: {} } }), locale: 'settings.agentPreset', ...extra }
  const entries = [original]
  const listeners = new Set()
  const registered = []
  const slots = {
    entries: () => [...entries],
    subscribe: (name, listener) => { assert.equal(name, 'conversation.hero.agentPreset'); listeners.add(listener); return () => listeners.delete(listener) },
    register(options, component) {
      const entry = { component, options, inject: options.inject, locale: options.locale, store: options.store }
      entries.push(entry); registered.push(entry)
      return () => { const i = entries.indexOf(entry); if (i >= 0) entries.splice(i, 1) }
    },
  }
  return { original, entries, listeners, registered, slots, changed: () => { for (const listener of listeners) listener() } }
}

test('hero decorator preserves original mode selector, injections and locale with the correct priority direction', () => {
  const f = presetFixture()
  let decorated
  const stop = installHeroControls(f.slots, original => { decorated = original; return () => null })
  const wrapper = f.registered[0]
  assert.equal(decorated, f.original.component)
  assert.equal(wrapper.inject, f.original.inject)
  assert.equal(wrapper.locale, f.original.locale)
  assert.equal(wrapper.options.priority, -1) // Host elects the LOWEST priority.
  assert.equal(wrapper.options.name, 'conversation.hero.agentPreset')
  f.changed() // Own registration must not recursively wrap itself.
  assert.equal(f.registered.length, 1)
  stop()
  assert.deepEqual(f.entries, [f.original])
  assert.equal(f.listeners.size, 0)
})

test('hero decoration follows replacement/unload and refuses unsupported child ownership', () => {
  const f = presetFixture()
  const stop = installHeroControls(f.slots, () => () => null)
  f.entries.splice(f.entries.indexOf(f.original), 1)
  f.changed()
  assert.equal(f.entries.length, 0)
  const replacement = { component: () => null, options: { priority: -5 }, inject: () => ({}) }
  f.entries.push(replacement)
  f.changed()
  assert.equal(f.registered.at(-1).options.priority, -6)
  assert.equal(f.registered.at(-1).inject, replacement.inject)
  stop()
  const children = presetFixture({ children: { nested: { kind: 'single' } } })
  const dispose = installHeroControls(children.slots, () => () => null)
  assert.equal(children.registered.length, 0)
  dispose()
})

test('UI entry uses a native whole-page Git view without modal, DOM relocation or dock controls', async () => {
  const index = await readFile(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
  const chip = await readFile(new URL('../src/client/chips/BranchChip.tsx', import.meta.url), 'utf8')
  const diff = await readFile(new URL('../src/client/diff/ChangesTab.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(index, /DialogShell|ChangesToggleBtn|conversation\.input\.dock/)
  assert.doesNotMatch(chip, /DialogShell|GitGraphDialog|CreateBranchDialog|WorktreeManagerDialog/)
  assert.doesNotMatch(chip + diff, /检测\s*Git|正在检测/)
  assert.match(index, /dsh-git-hero-controls/)
  assert.match(index, /<Original \{\.\.\.props\}/)
  assert.match(index, /onOpenGitPanel: createGitPanelOpener\(scope\)/, 'BranchChip keeps its dropdown route into the Git tab')
  assert.match(index, /<BranchChip \{\.\.\.props\} mode="header" \/>/, 'the normal session header keeps only the branch capsule')
  assert.match(index, /<BranchChip \{\.\.\.props\} \{\.\.\.sharedProps\} \/>/, 'Hero keeps the branch capsule entry point')
  assert.doesNotMatch(index, /ChangesButton|dsh-git-selector-btn|Git 工作台/)
})
