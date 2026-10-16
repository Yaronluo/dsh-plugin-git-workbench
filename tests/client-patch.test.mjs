import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './helpers/load-ts.mjs'

const { buildHunkPatch, isHunklessPatch, splitHunks } = await loadTs('src/client/diff/patch.ts')

const preamble = [
  'diff --git a/file.txt b/file.txt',
  'index 1111111..2222222 100644',
  '--- a/file.txt',
  '+++ b/file.txt',
].join('\n')
const firstHunk = ['@@ -1,2 +1,2 @@', ' old one', '-old two', '+new two'].join('\n')
const secondHunk = ['@@ -10 +10 @@', '-before', '+after', '\\ No newline at end of file'].join('\n')
const patch = `${preamble}\n${firstHunk}\n${secondHunk}\n`

test('buildHunkPatch keeps exactly the selected hunk and patch preamble', () => {
  assert.equal(splitHunks(patch).length, 2)
  assert.equal(buildHunkPatch(patch, [1]), `${preamble}\n${secondHunk}\n`)
})

test('buildHunkPatch canonicalizes order and removes duplicate hunk selections', () => {
  assert.equal(buildHunkPatch(patch, [1, 0, 1]), `${preamble}\n${firstHunk}\n${secondHunk}\n`)
})

test('buildHunkPatch rejects malformed selections instead of building a partial patch', () => {
  assert.equal(buildHunkPatch(patch, [-1]), '')
  assert.equal(buildHunkPatch(patch, [2]), '')
  assert.equal(buildHunkPatch(patch, [0.5]), '')
  assert.equal(buildHunkPatch(patch, [0, Number.NaN]), '')
})

test('empty selection means all hunks, but never adds hunks to a hunkless patch', () => {
  assert.equal(buildHunkPatch(patch, []), patch)
  const modeOnly = `${preamble}\nold mode 100644\nnew mode 100755\n`
  assert.equal(isHunklessPatch(modeOnly), true)
  assert.equal(buildHunkPatch(modeOnly, []), modeOnly)
  assert.equal(buildHunkPatch(modeOnly, [0]), '')
})
