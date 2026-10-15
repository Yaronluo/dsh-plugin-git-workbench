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

/**
 * The panel used to land on a Song-style serif for every Chinese character, because the
 * families our sheet named (`Microsoft YaHei`, `PingFang SC`, …) are not installed on
 * Windows 11 and the -apple-system chain carries no CJK glyphs at all.
 */
test('the body font names installed CJK faces before the app token chain', async () => {
  const { UI_FONT, appUiFont, runtimeFontRule } = await loadTs('src/client/styles.ts')

  assert.ok(UI_FONT.startsWith('"Noto Sans SC"'), 'an installed CJK sans face leads the chain')
  assert.ok(UI_FONT.includes('"Microsoft YaHei UI"'), 'the Windows 11 spelling is present')
  const cjk = UI_FONT.indexOf('"Noto Sans SC"')
  const token = UI_FONT.indexOf('var(--dsw-font-family')
  assert.ok(cjk >= 0 && token > cjk, 'the app token stays behind the installed faces')
  assert.equal(appUiFont(), UI_FONT, 'without a document the chain is used as-is')
  assert.match(runtimeFontRule(), /^\.dsh-git-sidebar-content/)
  assert.ok(runtimeFontRule().includes(UI_FONT))
})

test('the injected sheet mirrors the font the app renders itself in', async () => {
  const { sheetText, UI_FONT } = await loadTs('src/client/styles.ts')
  const originalDocument = globalThis.document
  const originalComputed = globalThis.getComputedStyle
  globalThis.document = { documentElement: {} }
  globalThis.getComputedStyle = () => ({ fontFamily: ' "Noto Sans SC" ' })
  try {
    const sheet = sheetText()
    assert.ok(sheet.includes('font-family: "Noto Sans SC", '), 'the root font leads the rule')
    assert.ok(sheet.endsWith('\n'), 'the runtime rule closes the sheet')
  } finally {
    globalThis.document = originalDocument
    globalThis.getComputedStyle = originalComputed
  }
  assert.ok(UI_FONT.startsWith('"Noto Sans SC"'))
})
