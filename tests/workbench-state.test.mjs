import { strict as assert } from 'node:assert'
import test from 'node:test'
import { loadTs } from './helpers/load-ts.mjs'

const { MAX_WORKBENCH_UI_STATES, readWorkbenchUiState, writeWorkbenchUiState } = await loadTs('src/client/diff/workbench-state.ts')

const state = patch => ({
  selectedFile: 'src/a.ts',
  compareTarget: 'branch-upstream',
  compareScope: 'unstaged',
  focusedFile: { cwd: '/repo-a', path: 'src/a.ts' },
  commitMessage: 'Keep this draft',
  fileListScrollTop: 120,
  diffScrollTop: 450,
  ...patch,
})

test('workbench UI snapshots are allow-listed and isolated by session and cwd', () => {
  const initial = state({ busy: '提交中', amend: true, diffData: { files: ['must not persist'] }, error: 'transient' })
  writeWorkbenchUiState('resume-session', '/repo-a', initial)

  const restored = readWorkbenchUiState('resume-session', '/repo-a')
  assert.deepEqual(restored, {
    selectedFile: 'src/a.ts',
    compareTarget: 'branch-upstream',
    compareScope: 'unstaged',
    focusedFile: { cwd: '/repo-a', path: 'src/a.ts' },
    commitMessage: 'Keep this draft',
    fileListScrollTop: 120,
    diffScrollTop: 450,
  })
  assert.equal(readWorkbenchUiState('other-session', '/repo-a'), null)
  assert.equal(readWorkbenchUiState('resume-session', '/repo-b'), null)

  restored.focusedFile.path = 'mutated.ts'
  assert.equal(readWorkbenchUiState('resume-session', '/repo-a').focusedFile.path, 'src/a.ts', 'callers cannot mutate the cached snapshot')
})

test('workbench UI cache uses a bounded least-recently-used eviction policy', () => {
  assert.equal(MAX_WORKBENCH_UI_STATES, 32)
  for (let index = 0; index < MAX_WORKBENCH_UI_STATES; index++) {
    writeWorkbenchUiState(`lru-session-${index}`, '/repo', state({ selectedFile: `file-${index}.ts` }))
  }

  // Promoting the oldest entry protects it; the next-oldest entry should then be evicted.
  assert.equal(readWorkbenchUiState('lru-session-0', '/repo').selectedFile, 'file-0.ts')
  writeWorkbenchUiState('lru-session-new', '/repo', state({ selectedFile: 'new.ts' }))

  assert.equal(readWorkbenchUiState('lru-session-0', '/repo').selectedFile, 'file-0.ts')
  assert.equal(readWorkbenchUiState('lru-session-1', '/repo'), null)
  assert.equal(readWorkbenchUiState('lru-session-new', '/repo').selectedFile, 'new.ts')
})

test('entries without a session or workspace identity are not retained', () => {
  writeWorkbenchUiState(null, '/repo', state())
  writeWorkbenchUiState('session', '', state())
  assert.equal(readWorkbenchUiState(null, '/repo'), null)
  assert.equal(readWorkbenchUiState('session', ''), null)
})
