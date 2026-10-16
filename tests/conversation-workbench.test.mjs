import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadTs } from './helpers/load-ts.mjs'

const { installGitConversationView, GIT_SESSION_BRIDGE_SLOT } = await loadTs('src/client/conversation-registration.ts')
const { installHeroControls } = await loadTs('src/client/hero-registration.ts')
const { GIT_CONVERSATION_VIEW } = await loadTs('src/client/panels/navigation.ts')
const app = process.env.DSH_DESKTOP_APP_ROOT || (process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Programs', 'DSH Desktop', 'resources', 'app') : '')
const slotsModule = app && join(app, 'node_modules', '@deepseek-ai', 'dsh-client-ui-slots', 'lib', 'index.js')

test('actual host SlotCore accepts the native Git tab, scoped store, Hero bridge and blank composer lifecycle', {
  skip: (!slotsModule || !existsSync(slotsModule)) && 'Set DSH_DESKTOP_APP_ROOT to run the real host SlotCore integration',
}, async () => {
  const { SlotCore } = await import(pathToFileURL(slotsModule).href)
  const core = new SlotCore()
  // Adapter implements declaration lifetime only; the host's actual SlotCore
  // enforces ownership, duplicate cells and shared-store scope constraints.
  const slots = {
    entries: key => core.entries(key),
    register: (options, component) => core.register(options, component),
    subscribe: (key, listener) => core.subscribe(key, listener),
    inject(key, callback) {
      let dispose
      const sync = () => { dispose?.(); dispose = core.spec(key) ? callback() : undefined }
      const unsubscribe = core.subscribeDeclaration(key, sync)
      sync()
      return () => { unsubscribe(); dispose?.() }
    },
  }
  const root = core.register({ name: 'root', children: {
    'conversation.view': { kind: 'list', scope: 'session' },
    'conversation.session.header': { kind: 'single', scope: 'session' },
    'conversation.session.header.utilities': { kind: 'list', scope: 'session' },
    'conversation.session.header.corner': { kind: 'single', scope: 'session' },
    'conversation.hero.agentPreset': { kind: 'single', scope: 'session-maybe' },
    'conversation.composer': { kind: 'chain', scope: 'session' },
  } }, () => null)
  const nativeStore = {}
  const nativeHeader = core.register({ name: 'conversation.session.header', store: nativeStore }, () => null)
  const nativeCorner = () => null
  const corner = core.register({ name: 'conversation.session.header.corner' }, nativeCorner)
  const originalHero = () => null
  const presetInject = () => ({ originalPreset: true })
  const hero = core.register({ name: 'conversation.hero.agentPreset', inject: presetInject }, originalHero)
  const Page = () => null
  const Bridge = () => null
  const shared = { gitSessionsSource: {}, gitWorkspacesSource: {} }
  const stopGit = installGitConversationView({ slots }, { Page, Bridge }, shared)
  const stopHero = installHeroControls(slots, () => () => null, { [GIT_SESSION_BRIDGE_SLOT]: { kind: 'single', scope: 'session' } })
  try {
    const views = core.entriesOfSlot('conversation.view')
    assert.equal(views.length, 1)
    assert.equal(views[0].component, Page)
    assert.equal(views[0].options.id, GIT_CONVERSATION_VIEW)
    assert.equal(views[0].options.label(), 'Git')
    assert.equal(views[0].options.order, 40)
    assert.deepEqual(views[0].inject(), shared)
    assert.equal(core.entriesOfSlot('conversation.session.header.corner')[0].component, nativeCorner, 'native sidebar toggle must not be replaced')
    assert.equal(core.entriesOfSlot('conversation.hero.agentPreset')[0].inject, presetInject, 'keep mode picker injection')
    for (const key of ['conversation.session.header.utilities', GIT_SESSION_BRIDGE_SLOT]) {
      const entry = core.entriesOfSlot(key)[0]
      assert.equal(entry.component, Bridge)
      assert.equal(entry.store, nativeStore, 'selection must use the actual native store handle')
      const calls = []
      const injected = entry.inject('exact-session', { setView: view => calls.push(view) })
      injected.selectConversationView(GIT_CONVERSATION_VIEW)
      assert.deepEqual(calls, [GIT_CONVERSATION_VIEW])
      const unmountBlank = injected.mountBlankWorkbench()
      const blank = core.entriesOfSlot('conversation.composer')[0]
      assert.equal(blank.component, Page)
      assert.deepEqual(blank.select({ sessionId: 'exact-session', session: { blank: true } }), {})
      assert.equal(blank.select({ sessionId: 'other-session', session: { blank: true } }), null)
      assert.equal(blank.select({ sessionId: 'exact-session', session: { blank: false } }), null)
      blank.inject().onReturnToConversation()
      assert.deepEqual(calls, [GIT_CONVERSATION_VIEW, 'chat'])
      unmountBlank()
      assert.equal(core.entriesOfSlot('conversation.composer').length, 0)
    }
  } finally {
    stopHero(); stopGit(); hero(); corner(); nativeHeader(); root()
  }
  assert.equal(core.entries('conversation.view').length, 0)
  assert.equal(core.entries(GIT_SESSION_BRIDGE_SLOT).length, 0)
})
