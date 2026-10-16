import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, isAbsolute, sep } from 'node:path'
import { execFileSync } from 'node:child_process'
import { loadTs } from './helpers/load-ts.mjs'

const { registerGitTools } = await loadTs('src/host/agent-tools.ts')
const { GitService } = await loadTs('src/host/git-service.ts')
const { createGitRunner } = await loadTs('src/host/git-runner.ts')

const env = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: 'Author | test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Committer',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
}

function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'core.hooksPath=/nonexistent-dsh-test-hooks', ...args], {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'dsh-git-agent-tools-test-'))
  const root = join(base, 'repo')
  await mkdir(root)
  git(root, 'init', '-b', 'main')
  git(root, 'config', 'core.fsmonitor', 'false')
  git(root, 'config', 'core.autocrlf', 'false')
  git(root, 'config', 'core.quotePath', 'true')
  git(root, 'config', 'user.name', 'Author | test')
  git(root, 'config', 'user.email', 'test@example.invalid')

  t.after(async () => {
    const absolute = resolve(base)
    const parent = resolve(tmpdir()) + sep
    assert.ok(isAbsolute(absolute) && absolute.startsWith(parent) && absolute.includes('dsh-git-agent-tools-test-'))
    await rm(absolute, { recursive: true, force: true })
  })

  const service = new GitService(createGitRunner())
  const definitions = []
  const handlers = new Map()
  let disposerCalls = 0
  const ctx = {
    tools: {
      register(definition) {
        definitions.push(definition)
        return () => { disposerCalls += 1 }
      },
    },
    on(name, handler) {
      handlers.set(name, handler)
      return () => { disposerCalls += 1 }
    },
  }
  const cleanup = registerGitTools(ctx, service)
  t.after(cleanup)

  return {
    root,
    service,
    definitions,
    handlers,
    cleanup,
    get disposerCalls() { return disposerCalls },
    tool(name) {
      const matches = definitions.filter(definition => definition.name === name)
      assert.equal(matches.length, 1, `expected exactly one ${name} tool`)
      return matches[0]
    },
  }
}

const expectedNames = [
  'git_status',
  'git_diff',
  'git_log',
  'git_stage',
  'git_unstage',
  'git_commit',
  'git_stash',
  'git_branch',
]

test('registers each Git tool once, disposes registrations, and executes core workflows', async t => {
  const state = await fixture(t)
  assert.deepEqual(state.definitions.map(definition => definition.name), expectedNames)
  for (const name of expectedNames) {
    assert.equal(state.definitions.filter(definition => definition.name === name).length, 1)
  }

  const statusTool = state.tool('git_status')
  const initial = await statusTool.execute({ cwd: state.root }, {})
  assert.equal(initial.clean, true)
  assert.deepEqual(initial.files, [])

  await writeFile(join(state.root, 'notes.txt'), 'agent-created file\n')
  const modified = await statusTool.execute({ cwd: state.root }, {})
  assert.equal(modified.clean, false)
  assert.equal(modified.files.some(file => file.path === 'notes.txt'), true)

  const staged = await state.tool('git_stage').execute({ cwd: state.root }, {})
  assert.equal(staged.ok, true, staged.error)
  const afterStage = await statusTool.execute({ cwd: state.root }, {})
  assert.equal(afterStage.files.some(file => file.path === 'notes.txt' && file.section === 'staged'), true)

  const commit = await state.tool('git_commit').execute({ cwd: state.root, message: 'agent tool commit' }, {})
  assert.equal(commit.ok, true, commit.error)
  assert.equal(typeof commit.hash, 'string')
  assert.ok(commit.hash.length > 0)
  assert.equal((await statusTool.execute({ cwd: state.root }, {})).clean, true)

  const preExecute = state.handlers.get('tools/pre-execute')
  assert.equal(typeof preExecute, 'function')
  let nextCalls = 0
  const next = async () => {
    nextCalls += 1
    return { kind: 'allow' }
  }
  const denied = await preExecute({ name: 'git_commit', arguments: { amend: true } }, next)
  assert.deepEqual(denied, {
    kind: 'deny',
    reason: '改写最近一次提交会重写提交历史，请改由你在 Git 面板中执行。',
  })
  assert.deepEqual(await preExecute({ name: 'git_commit', arguments: { amend: false } }, next), { kind: 'allow' })
  assert.deepEqual(await preExecute({ name: 'some_other_tool', arguments: {} }, next), { kind: 'allow' })
  assert.equal(nextCalls, 2)

  state.cleanup()
  assert.equal(state.disposerCalls, 9)
  state.cleanup()
  assert.equal(state.disposerCalls, 9)
})

test('truncates oversized diff patches to 8000 characters', async t => {
  const state = await fixture(t)
  await writeFile(join(state.root, 'long.txt'), '0123456789abcdef\n'.repeat(1200))
  const diff = await state.tool('git_diff').execute({ cwd: state.root }, {})
  assert.equal(diff.truncated, true)
  assert.equal(diff.files.length, 1)
  assert.equal(diff.files[0].path, 'long.txt')
  assert.equal(diff.files[0].patch.length, 8000)
})
