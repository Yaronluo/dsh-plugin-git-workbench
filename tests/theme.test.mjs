import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { loadTs } from './helpers/load-ts.mjs'
const { STYLES } = await loadTs('src/client/styles.ts')
const allowed = new Set(['bg-base', 'bg-layer-1', 'bg-layer-2', 'bg-overlay', 'border-l1', 'border-l2', 'brand-primary', 'label-primary', 'label-secondary', 'state-error-primary', 'state-idle-primary', 'state-success-primary', 'state-warn-primary'].map(name => `--dsw-alias-${name}`))
// The UI theme also declares the body font and the code font on :root; the host's own
// packages name them explicitly instead of inheriting (see CODE_FONT / UI_FONT).
allowed.add('--ds-font-family-code')
allowed.add('--dsw-font-family')

// Editor brand marks are product identity, not a theme decision — no semantic token can say
// "VS Code blue". Exactly this one file may carry literal colours; everything else stays
// token-only, and `tests/editor-menu.test.mjs` covers what the marks render.
const BRAND_MARK_FILE = 'editor-icons.tsx'

test('plugin CSS and inline styles reference declared host theme tokens only', async () => {
  const contents = [STYLES]
  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory)
      if (entry.isDirectory()) await scan(url)
      else if (/\.tsx?$/.test(entry.name) && entry.name !== BRAND_MARK_FILE) contents.push(await readFile(url, 'utf8'))
    }
  }
  await scan(new URL('../src/client/', import.meta.url))
  const source = contents.join('\n')
  assert.doesNotMatch(source, /#[\da-f]{3,8}\b|rgba?\(/i)
  for (const [, variable] of source.matchAll(/var\((--[\w-]+)/g)) assert.ok(allowed.has(variable), `Unknown theme token ${variable}`)
  assert.doesNotMatch(source, /__dsh_scope__|findHeroRow|createPortal/)
})

test('monospace text follows the app code font, never the bare keyword', async () => {
  // `font-family: monospace` resolves to the system default fixed font, which on a
  // Chinese Windows is a thin, uneven CJK face — that is what looked wrong in the
  // worktree list. Every code-ish run must go through CODE_FONT instead.
  const contents = []
  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory)
      if (entry.isDirectory()) await scan(url)
      else if (/\.tsx?$/.test(entry.name)) contents.push(await readFile(url, 'utf8'))
    }
  }
  await scan(new URL('../src/client/', import.meta.url))
  const source = contents.join('\n')
  assert.doesNotMatch(source, /font-family:\s*monospace\b/)
  assert.doesNotMatch(source, /fontFamily:\s*'monospace'/)
  assert.match(source, /export const CODE_FONT = 'var\(--ds-font-family-code/)
})
