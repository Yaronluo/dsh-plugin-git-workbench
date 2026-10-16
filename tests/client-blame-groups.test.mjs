import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './helpers/load-ts.mjs'

const { groupBlameLines } = await loadTs('src/client/dialogs/blame-groups.ts')

function line(shortHash, uncommitted = false) {
  return { shortHash, ...(uncommitted ? { uncommitted: true } : {}) }
}

test('consecutive identical hashes share a group', () => {
  const grouped = groupBlameLines([line('aaa'), line('aaa')])
  assert.deepEqual(grouped.map(item => item.continuation), [false, true])
})

test('a new hash starts a new group', () => {
  const grouped = groupBlameLines([line('aaa'), line('bbb')])
  assert.deepEqual(grouped.map(item => item.continuation), [false, false])
})

test('uncommitted lines are grouped by their own marker', () => {
  const grouped = groupBlameLines([line('aaa'), line('aaa', true), line('aaa', true), line('aaa')])
  assert.deepEqual(grouped.map(item => item.continuation), [false, false, true, false])
})
