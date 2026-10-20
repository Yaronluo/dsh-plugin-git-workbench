import { strict as assert } from 'node:assert'
import test from 'node:test'
import { loadTs } from './helpers/load-ts.mjs'

/**
 * A document that already carries an older copy of our sheet is the exact situation that
 * made rebuilt bundles look unchanged: the panel kept rendering through stale CSS.
 */
function fakeDocument() {
  const elements = new Map()
  const appended = []
  const document = {
    getElementById: (id) => elements.get(id) ?? null,
    createElement: () => {
      const element = { id: '', textContent: '' }
      element.remove = () => elements.delete(element.id)
      return element
    },
    head: {
      appendChild: (element) => {
        appended.push(element)
        elements.set(element.id, element)
      },
    },
  }
  return { elements, appended, document }
}

async function withFakeDocument(run) {
  const fake = fakeDocument()
  const original = globalThis.document
  globalThis.document = fake.document
  try {
    return await run(fake)
  } finally {
    globalThis.document = original
  }
}

test('an existing stylesheet element is refreshed, never left pinned to stale CSS', async () => {
  const { injectStyles, sheetText } = await loadTs('src/client/styles.ts')
  await withFakeDocument(({ elements, appended }) => {
    const stale = { id: 'dsh-plugin-git-styles', textContent: '/* an older build */' }
    elements.set(stale.id, stale)

    injectStyles()

    assert.equal(appended.length, 0, 'an existing element is reused instead of duplicated')
    assert.equal(stale.textContent, sheetText(), 'the newest sheet replaces the stale one')

    injectStyles()

    assert.equal(appended.length, 0, 'repeated injection still does not duplicate')
    assert.equal(stale.textContent, sheetText())
  })
})

test('a missing stylesheet element is created once and disposed by id', async () => {
  const { injectStyles, disposeStyles, sheetText, STYLES } = await loadTs('src/client/styles.ts')
  await withFakeDocument(({ elements, appended }) => {
    injectStyles()
    injectStyles()

    assert.equal(appended.length, 1)
    assert.equal(appended[0].id, 'dsh-plugin-git-styles')
    assert.equal(appended[0].textContent, sheetText())
    assert.ok(STYLES.includes('dsw-font-family'), 'the sheet names the app body font')

    disposeStyles()
    assert.equal(elements.has('dsh-plugin-git-styles'), false)
  })
})

test('the body font follows the host token without prioritizing other installed fonts', async () => {
  const { UI_FONT, appUiFont, runtimeFontRule } = await loadTs('src/client/styles.ts')

  assert.equal(UI_FONT, 'var(--dsw-font-family, system-ui, sans-serif)')
  assert.equal(appUiFont(), UI_FONT)
  assert.match(runtimeFontRule(), /^\.dsh-git-sidebar-content/)
  assert.ok(runtimeFontRule().includes(UI_FONT))
})

test('a browser default serif on html cannot override the host UI font', async () => {
  const { sheetText, UI_FONT } = await loadTs('src/client/styles.ts')
  const originalDocument = globalThis.document
  const originalComputed = globalThis.getComputedStyle
  globalThis.document = { documentElement: {} }
  globalThis.getComputedStyle = () => ({ fontFamily: '"Times New Roman"' })
  try {
    const sheet = sheetText()
    assert.ok(sheet.includes(`font-family: ${UI_FONT};`))
    assert.ok(!sheet.includes('Times New Roman'), 'html is not a UI font reference')
    assert.ok(sheet.endsWith('\n'), 'the runtime rule closes the sheet')
  } finally {
    globalThis.document = originalDocument
    globalThis.getComputedStyle = originalComputed
  }
  assert.ok(UI_FONT.startsWith('var(--dsw-font-family'))
})

test('an explicitly configured CJK root font follows the surrounding app UI', async () => {
  const { appUiFont, runtimeFontRule } = await loadTs('src/client/styles.ts')
  const originalDocument = globalThis.document
  const originalComputed = globalThis.getComputedStyle
  globalThis.document = { documentElement: {} }
  globalThis.getComputedStyle = () => ({ fontFamily: '"Noto Sans SC"' })
  try {
    assert.equal(appUiFont(), '"Noto Sans SC"')
    assert.ok(runtimeFontRule().includes('font-family: "Noto Sans SC"'))
  } finally { globalThis.document = originalDocument; globalThis.getComputedStyle = originalComputed }
})

test('management pages share clear headers and the workspace has an actual vertical scroll owner', async () => {
  const { STYLES } = await loadTs('src/client/styles.ts')
  assert.match(STYLES, /\.dsh-git-workbench \.dsh-git-view-content \{[^}]*overflow: auto;/)
  assert.match(STYLES, /\.dsh-git-workbench \.dsh-git-changes-body \{[^}]*min-height: 360px;/)
  assert.match(STYLES, /\.dsh-git-page-header \{[^}]*display: flex;[^}]*justify-content: space-between;/)
  assert.match(STYLES, /\.dsh-git-file-menu-items \{[^}]*flex-direction: column;/)
  assert.match(STYLES, /\.dsh-git-commit-controls \{[^}]*flex-direction: column;/)
})

test('worktree labels share the panel size and form controls inherit the UI family', async () => {
  const { STYLES } = await loadTs('src/client/styles.ts')
  assert.match(STYLES, /\.dsh-git-panel-form, \.dsh-git-modal-card \{ font-size: 13px; line-height: 1\.5; \}/)
  assert.match(STYLES, /:where\(\.dsh-git-sidebar-content, \.dsh-git-modal-card, \.dsh-git-popover\) :where\(button, input, select, textarea\) \{ font-family: inherit; \}/)
})

test('the chat column width handle is disabled over the workbench pane', async () => {
  const { STYLES } = await loadTs('src/client/styles.ts')
  assert.match(
    STYLES,
    /:root:has\(\.dsh-git-workbench\) \[class\*='_widthHandle'\] \{ pointer-events: none !important; \}/,
    'the drag must not start and the resize cursor must not appear over the panel',
  )
  assert.match(
    STYLES,
    /:root:has\(\.dsh-git-workbench\) \[class\*='_widthHandle'\]::after \{ opacity: 0 !important; transition: none !important; \}/,
    'nor may its 2px gray bar paint over the panel',
  )
  assert.doesNotMatch(STYLES, /data-dockkit-divider/, 'the dock never renders those attributes in the live DOM')
})

test('the full-page workbench fills only its conversation and leaves a wide diff above the commit footer', async () => {
  const { STYLES, runtimeFontRule } = await loadTs('src/client/styles.ts')

  assert.match(runtimeFontRule(), /\.dsh-git-workbench/)
  assert.match(STYLES, /\[data-conversation-content\]:has\(\.dsh-git-workbench\) > \[data-conversation-scroll\] > \[data-composer-seat\]:not\(:has\(\.dsh-git-workbench\)\) \{ display: none; \}/)
  assert.match(STYLES, /\[data-conversation-content\]:has\(\.dsh-git-workbench\) > \[data-conversation-scroll\] \{[^}]*flex: 1 1 auto;[^}]*height: 100%;[^}]*overflow: hidden;/)
  assert.match(STYLES, /\[data-conversation-content\]:has\(\.dsh-git-workbench\) > \[data-conversation-scroll\] > :has\(\.dsh-git-workbench\) \{[^}]*flex: 1 1 auto;[^}]*height: 100%;[^}]*overflow: hidden;/)
  assert.match(STYLES, /\[data-conversation-content\] > \[data-conversation-scroll\]:has\(> \[data-composer-seat\] \.dsh-git-workbench\) > :not\(\[data-composer-seat\]\) \{ display: none; \}/)
  assert.match(STYLES, /\.dsh-git-workbench-header \{[^}]*flex: 0 0 48px;[^}]*height: 48px;[^}]*var\(--dsw-alias-border-l1\)/)
  assert.match(STYLES, /\.dsh-git-workbench \.dsh-git-sidebar-content \{[^}]*flex: 1 1 auto;[^}]*height: auto;/)
  assert.match(STYLES, /\.dsh-git-changes-side \{[^}]*width: clamp\(260px, 24vw, 360px\);[^}]*max-width: 40%;/)
  assert.match(STYLES, /\.dsh-git-changes-panel > \.dsh-git-commit-box \{[^}]*border-top: 1px solid var\(--dsw-alias-border-l1\);/)
  assert.match(STYLES, /@container \(max-width: 600px\) \{\s+\.dsh-git-changes-body \{ flex-direction: column; \}/)
  assert.match(STYLES, /\.dsh-git-changes-side \.dsh-git-file-list \{ flex: 1 1 auto; max-height: none; border-bottom: 0; \}/)
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(STYLES.slice(STYLES.indexOf('/* The full-page workbench'), STYLES.indexOf('.dsh-git-view-nav'))), 'workbench rules must use theme tokens rather than literal colors')
})
