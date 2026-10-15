import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, isAbsolute, sep } from 'node:path'
import { execFileSync } from 'node:child_process'
import { loadTs } from './helpers/load-ts.mjs'
const { GitService } = await loadTs('src/host/git-service.ts')
const { createGitRunner } = await loadTs('src/host/git-runner.ts')

// Only isolated temporary repositories are mutated. No dependency installation or user Git state.
const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: 'Author | test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'Committer', GIT_COMMITTER_EMAIL: 'test@example.invalid' }
function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'core.hooksPath=/nonexistent-dsh-test-hooks', ...args], { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
async function fixture(t, committed = true) {
  const base = await mkdtemp(join(tmpdir(), 'dsh-git-service-test-'))
  const root = join(base, 'repo')
  await mkdir(root)
  git(root, 'init', '-b', 'main')
  git(root, 'config', 'core.fsmonitor', 'false')
  git(root, 'config', 'core.autocrlf', 'false')
  git(root, 'config', 'core.quotePath', 'true')
  if (committed) { await writeFile(join(root, 'tracked.txt'), 'initial\n'); git(root, 'add', '.'); git(root, 'commit', '-m', 'initial | subject') }
  t.after(async () => {
    const absolute = resolve(base)
    const parent = resolve(tmpdir()) + sep
    assert.ok(isAbsolute(absolute) && absolute.startsWith(parent) && absolute.includes('dsh-git-service-test-'))
    await rm(absolute, { recursive: true, force: true })
  })
  return { root, base, service: new GitService(createGitRunner()) }
}

test('failed branch switch cannot checkout and restore same-named tracked path', async t => {
  const { root, service } = await fixture(t)
  await writeFile(join(root, 'tracked.txt'), 'valuable local changes\n')
  const result = await service.switchBranch(root, 'tracked.txt')
  assert.equal(result.ok, false)
  assert.equal(await readFile(join(root, 'tracked.txt'), 'utf8'), 'valuable local changes\n')
})

test('option injection rejected in switch/create/base/diff/worktree base', async t => {
  const { root, service } = await fixture(t)
  await writeFile(join(root, 'tracked.txt'), 'local changes\n')
  assert.equal((await service.switchBranch(root, '--discard-changes')).ok, false)
  assert.equal((await service.createBranch(root, '--force')).ok, false)
  assert.equal((await service.createBranch(root, 'new', '--force')).ok, false)
  assert.equal((await service.createWorktree(root, 'bad', '--force')).ok, false)
  await assert.rejects(service.diff(root, '--output=oops'), /Invalid Git reference/)
  await assert.rejects(service.diff(root, 'HEAD', '--output=oops'), /Invalid Git reference/)
  assert.equal(git(root, 'branch', '--show-current'), 'main')
  assert.equal(await readFile(join(root, 'tracked.txt'), 'utf8'), 'local changes\n')
})

test('normal branch create and switch succeeds with validated refs', async t => {
  const { root, service } = await fixture(t)
  assert.equal((await service.createBranch(root, 'topic', 'HEAD')).ok, true)
  assert.equal((await service.switchBranch(root, 'main')).ok, true)
})

test('switch resolves exact local names and explicit remote without guessing another remote', async t => {
  const { root, service } = await fixture(t)
  git(root, 'config', 'remote.fork.url', '.')
  git(root, 'config', 'remote.fork.fetch', '+refs/heads/*:refs/remotes/fork/*')
  git(root, 'update-ref', 'refs/remotes/fork/topic', 'HEAD')
  assert.equal((await service.switchBranch(root, 'fork/topic')).ok, true)
  assert.equal(git(root, 'rev-parse', '--abbrev-ref', '@{upstream}'), 'fork/topic')
  assert.equal((await service.switchBranch(root, 'main')).ok, true)
  const exists = await service.switchBranch(root, 'fork/topic')
  assert.equal(exists.ok, false)
  assert.match(exists.error.message, /select it explicitly/)
  assert.equal(git(root, 'branch', '--show-current'), 'main')
  git(root, 'branch', 'origin/topic')
  assert.equal((await service.switchBranch(root, 'origin/topic')).ok, true)
  assert.equal(git(root, 'branch', '--show-current'), 'origin/topic')
})

test('dirty worktree removal is protected; locked reason and real worktree gitdir operations', async t => {
  const { root, service } = await fixture(t)
  const added = await service.createWorktree(root, 'test', 'HEAD')
  assert.equal(added.ok, true, added.error)
  await writeFile(join(added.path, 'tracked.txt'), 'worktree changes\n')
  await writeFile(join(added.path, 'untracked.txt'), 'valuable untracked\n')
  assert.equal((await service.removeWorktree(root, added.path)).ok, false)
  assert.equal(await readFile(join(added.path, 'tracked.txt'), 'utf8'), 'worktree changes\n')
  assert.equal(await readFile(join(added.path, 'untracked.txt'), 'utf8'), 'valuable untracked\n')
  git(root, 'worktree', 'lock', '--reason', 'review in progress', added.path)
  const worktree = (await service.worktrees(root)).find(item => resolve(item.path) === resolve(added.path))
  assert.equal(worktree.lockedReason, 'review in progress')
  const gitDir = git(added.path, 'rev-parse', '--absolute-git-dir')
  await writeFile(join(gitDir, 'CHERRY_PICK_HEAD'), git(root, 'rev-parse', 'HEAD') + '\n')
  assert.equal((await service.status(added.path)).operationInProgress, true)
  assert.equal((await service.status(root)).operationInProgress, false)
})

test('clean worktree removal succeeds but untracked-only worktree removal is refused', async t => {
  const { root, service } = await fixture(t)
  const clean = await service.createWorktree(root, 'clean', 'HEAD')
  assert.equal(clean.ok, true, clean.error)
  assert.equal((await service.removeWorktree(root, clean.path)).ok, true)
  const untracked = await service.createWorktree(root, 'untracked', 'HEAD')
  assert.equal(untracked.ok, true, untracked.error)
  await writeFile(join(untracked.path, 'only-local.txt'), 'must survive\n')
  assert.equal((await service.removeWorktree(root, untracked.path)).ok, false)
  assert.equal(await readFile(join(untracked.path, 'only-local.txt'), 'utf8'), 'must survive\n')
})

test('unborn HEAD diff includes staged and recursive untracked UTF-8/binary/empty files accurately', async t => {
  const { root, service } = await fixture(t, false)
  await writeFile(join(root, 'staged.txt'), 'staged\n')
  git(root, 'add', 'staged.txt')
  await mkdir(join(root, 'folder'))
  await writeFile(join(root, 'folder', '中文 file.txt'), 'first\nsecond\n')
  await writeFile(join(root, 'folder', 'binary.bin'), Buffer.from([0, 255, 10]))
  await writeFile(join(root, 'empty.txt'), '')
  await writeFile(join(root, 'no-newline.txt'), 'one')
  const view = await service.diff(root)
  const byPath = new Map(view.files.map(file => [file.path, file]))
  assert.equal(byPath.get('staged.txt').insertions, 1)
  assert.equal(byPath.get('folder/中文 file.txt').insertions, 2)
  assert.equal(byPath.get('folder/中文 file.txt').hunks[0].lines.length, 2)
  assert.equal(byPath.get('folder/binary.bin').insertions, 0)
  assert.deepEqual(byPath.get('folder/binary.bin').hunks, [])
  assert.equal(byPath.get('empty.txt').insertions, 0)
  assert.equal(byPath.get('no-newline.txt').insertions, 1)
  assert.equal(view.totalInsertions, 4)
  assert.equal((await service.status(root)).head, '')
})

test('real Git rename paths and numstat support Chinese spaces and tabs', async t => {
  const { root, service } = await fixture(t)
  const old = '中文 old name.txt', next = '中文 new name.txt'
  await writeFile(join(root, old), 'keep\n'.repeat(10))
  git(root, 'add', old); git(root, 'commit', '-m', 'file')
  git(root, 'mv', old, next)
  await writeFile(join(root, next), 'keep\n'.repeat(10) + 'extra\n')
  const view = await service.diff(root)
  const file = view.files.find(file => file.path === next)
  assert.ok(file, JSON.stringify(view))
  assert.equal(file.oldPath, old)
  assert.equal(file.status, 'renamed')
  assert.equal(file.insertions, 1)
  assert.equal(file.hunks[0].lines.at(-1).type, 'add')
})

test('diff errors surface instead of returning an empty successful view', async t => {
  const { root } = await fixture(t)
  const native = createGitRunner()
  const service = new GitService({ async run(args, cwd) { return args[0] === 'diff' ? { exitCode: 128, stdout: '', stderr: 'forced diff failure' } : native.run(args, cwd) } })
  await assert.rejects(service.diff(root), /forced diff failure/)
  await assert.rejects(new GitService(native).diff(root, 'missing-ref'), /unknown revision|Needed a single revision|ambiguous argument/i)
})

test('status revision detects same-size same-mtime edits and upstream uses actual remote', async t => {
  const { root, service } = await fixture(t)
  git(root, 'config', 'remote.fork.url', '.')
  git(root, 'config', 'remote.fork.fetch', '+refs/heads/*:refs/remotes/fork/*')
  git(root, 'update-ref', 'refs/remotes/fork/topic', 'HEAD')
  git(root, 'config', 'branch.main.remote', 'fork')
  git(root, 'config', 'branch.main.merge', 'refs/heads/topic')
  await writeFile(join(root, 'tracked.txt'), 'dirty-one\n')
  const fixed = new Date('2020-01-01T00:00:00Z')
  await utimes(join(root, 'tracked.txt'), fixed, fixed)
  const first = await service.status(root)
  assert.equal(first.upstream, 'fork/topic')
  const same = await service.status(root)
  assert.equal(first.revision, same.revision)
  await writeFile(join(root, 'tracked.txt'), 'dirty-two\n')
  await utimes(join(root, 'tracked.txt'), fixed, fixed)
  const second = await service.status(root)
  assert.equal(first.dirtyFiles, second.dirtyFiles)
  assert.notEqual(first.revision, second.revision)
})

test('real git log preserves pipe in subject and author', async t => {
  const { root, service } = await fixture(t)
  await writeFile(join(root, 'tracked.txt'), 'second\n')
  git(root, 'add', '.'); git(root, 'commit', '-m', 'second | commit')
  const commits = await service.log(root)
  assert.equal(commits.length, 2)
  assert.equal(commits[0].subject, 'second | commit')
  assert.equal(commits[0].author, 'Author | test')
})
