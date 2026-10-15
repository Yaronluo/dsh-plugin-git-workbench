import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { loadTs } from './helpers/load-ts.mjs'
const { STYLES } = await loadTs('src/client/styles.ts')
const allowed = new Set(['bg-base', 'bg-layer-1', 'bg-layer-2', 'bg-overlay', 'border-l1', 'border-l2', 'brand-primary', 'label-primary', 'label-secondary', 'state-error-primary', 'state-idle-primary', 'state-success-primary', 'state-warn-primary'].map(name => `--dsw-alias-${name}`))

test('plugin CSS and inline styles reference declared host theme tokens only', async () => {
  const contents = [STYLES]
  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory)
      if (entry.isDirectory()) await scan(url)
      else if (/\.tsx?$/.test(entry.name)) contents.push(await readFile(url, 'utf8'))
    }
  }
  await scan(new URL('../src/client/', import.meta.url))
  const source = contents.join('\n')
  assert.doesNotMatch(source, /#[\da-f]{3,8}\b|rgba?\(/i)
  for (const [, variable] of source.matchAll(/var\((--[\w-]+)/g)) assert.ok(allowed.has(variable), `Unknown theme token ${variable}`)
  assert.doesNotMatch(source, /__dsh_scope__|findHeroRow|createPortal/)
})
