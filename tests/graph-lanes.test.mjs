import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './helpers/load-ts.mjs'

const { computeGraph } = await loadTs('src/client/graph.ts')

const commit = (hash, ...parents) => ({ hash, shortHash: hash, subject: hash, author: 'a', date: 'now', parents, refs: [] })

const liveHashes = row => row.columns.filter(Boolean)

test('a linear history keeps one lane and reserves one column per row', () => {
  const rows = computeGraph([commit('a', 'b'), commit('b', 'c'), commit('c')])
  assert.deepEqual(rows.map(row => row.column), [0, 0, 0])
  assert.deepEqual(rows.map(row => row.width), [1, 1, 1])
  assert.deepEqual(rows[0].parents, [{ hash: 'b', column: 0 }])
  assert.deepEqual(rows[2].parents, [])
})

test('a merge opens the side lane at the merge row and keeps it alive until it lands', () => {
  const rows = computeGraph([
    commit('m', 'm1', 'f1'), commit('m1', 'm2'), commit('m2', 'base'),
    commit('f1', 'f2'), commit('f2', 'base'), commit('base'),
  ])
  assert.deepEqual(rows[0].parents, [{ hash: 'm1', column: 0 }, { hash: 'f1', column: 1 }], 'the merge must fan out to two columns')
  assert.equal(rows[3].column, 1, 'the side branch keeps its own lane')
  assert.equal(rows[5].column, 0, 'the shared ancestor lands back on the trunk')
  // A column that is still open draws a pass-through, which is what makes the lane continuous.
  assert.deepEqual(liveHashes(rows[1]), ['m1', 'f1'])
  assert.equal(rows[5].width, 1, 'the canvas narrows again once both lanes have landed')
})

test('a branch that rejoins an already tracked commit closes its lane instead of duplicating it', () => {
  const rows = computeGraph([commit('m', 'm1', 'f1'), commit('m1', 'base'), commit('f1', 'base'), commit('base')])
  assert.deepEqual(rows[2].parents, [{ hash: 'base', column: 0 }], 'the edge must point at the lane that already tracks the parent')
  for (const row of rows) {
    assert.equal(new Set(liveHashes(row)).size, liveHashes(row).length, `row ${row.commit.hash} repeats a commit in two lanes`)
  }
  assert.deepEqual(liveHashes(rows[3]), ['base'], 'the closed lane must not survive into the last row')
  assert.equal(rows[3].width, 1)
})

test('the lane count stays inside the requested maximum', () => {
  const history = []
  for (let index = 0; index < 10; index++) history.push(commit(`c${index}`, `c${index + 1}`, `s${index}`))
  const rows = computeGraph(history, 3)
  for (const row of rows) {
    assert.ok(row.width <= 3, `row ${row.commit.hash} reserves ${row.width} columns`)
    assert.ok(row.column >= 0 && row.column < 3)
  }
})
