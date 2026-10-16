import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './helpers/load-ts.mjs'

const { remoteCheckoutName, selectableBranches } = await loadTs('src/client/chips/branch-list.ts')

const local = (name, current = false) => ({ name, current, isRemote: false })
const remote = name => ({ name, current: false, isRemote: true })

test('a remote row is named after the segment past the remote', () => {
  assert.equal(remoteCheckoutName('origin/master'), 'master')
  assert.equal(remoteCheckoutName('origin/feature/lane'), 'feature/lane')
})

test('a remote row duplicating a local branch is dropped', () => {
  const rows = selectableBranches([local('master', true), remote('origin/master')])
  assert.deepEqual(rows.map(row => row.name), ['master'])
})

test('any remote whose short name is taken locally is dropped', () => {
  const rows = selectableBranches([local('master'), remote('upstream/master')])
  assert.deepEqual(rows.map(row => row.name), ['master'])
})

test('a remote row with no local counterpart stays selectable', () => {
  const rows = selectableBranches([local('master', true), remote('origin/feature/lane')])
  assert.deepEqual(rows.map(row => row.name), ['master', 'origin/feature/lane'])
})

test('a local branch legitimately named like a remote ref keeps its own row', () => {
  const rows = selectableBranches([local('origin/topic'), remote('origin/topic'), remote('origin/other')])
  assert.deepEqual(rows.map(row => row.name), ['origin/topic', 'origin/other'])
})

test('locals, order and the current marker survive filtering', () => {
  const rows = selectableBranches([
    local('master', true), local('dev'), remote('origin/master'), remote('origin/dev'), remote('origin/release'),
  ])
  assert.deepEqual(rows.map(row => row.name), ['master', 'dev', 'origin/release'])
  assert.equal(rows[0].current, true)
  assert.deepEqual(rows.filter(row => row.isRemote).map(row => row.name), ['origin/release'])
})

test('a list of locals only is returned unchanged', () => {
  const branches = [local('master', true), local('dev')]
  assert.deepEqual(selectableBranches(branches), branches)
})
