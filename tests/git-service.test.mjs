import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm, utimes, symlink } from 'node:fs/promises'
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

test('Git runner handles early stdin closure without an uncaught stream error', async () => {
  const result = await createGitRunner().run(['--version'], process.cwd(), undefined, { stdin: 'x'.repeat(2_000_000) })
  assert.equal(result.exitCode, 0)
  assert.match(result.stdout, /git version/i)
})

test('blob preview rejects a tracked path that escapes through a symlinked parent', async t => {
  const { root, base, service } = await fixture(t)
  await mkdir(join(root, 'nested'))
  await writeFile(join(root, 'nested', 'tracked.txt'), 'committed content\n')
  git(root, 'add', 'nested/tracked.txt')
  git(root, 'commit', '-m', 'nested file')

  const outside = join(base, 'outside')
  await mkdir(outside)
  await writeFile(join(outside, 'tracked.txt'), 'outside secret\n')
  await rm(join(root, 'nested'), { recursive: true, force: true })
  await symlink(outside, join(root, 'nested'), process.platform === 'win32' ? 'junction' : 'dir')

  const result = await service.readBlob(root, 'nested/tracked.txt')
  assert.equal(result.ok, false)
  assert.match(result.error, /仓库范围/)
})

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

test('untracked diff bounds large reads and counts a newline-only file consistently', async t => {
  const { root, service } = await fixture(t)
  await writeFile(join(root, 'newline-only.txt'), '\n')
  await writeFile(join(root, 'large.txt'), Buffer.alloc(2_000_001, 0x61))

  const diff = await service.diff(root)
  const newline = diff.files.find(file => file.path === 'newline-only.txt')
  const large = diff.files.find(file => file.path === 'large.txt')
  assert.equal(newline.insertions, 1)
  assert.equal(large.binary, true)
  assert.equal(large.insertions, 0)
  assert.ok(large.rawPatch.length < 100)

  const changes = await service.changes(root)
  const change = changes.entries.find(entry => entry.path === 'newline-only.txt')
  assert.equal(change.insertions, 1)
})

test('diff skips untracked FIFOs rather than blocking while reading them', { skip: process.platform === 'win32' }, async t => {
  const { root, service } = await fixture(t)
  execFileSync('mkfifo', [join(root, 'blocking.fifo')])
  const diff = await service.diff(root)
  assert.equal(diff.files.some(file => file.path === 'blocking.fifo'), false)
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

test('diff path filter, scopes and whitespace/context switches narrow the payload exactly', async t => {
  const { root, service } = await fixture(t)
  await writeFile(join(root, 'one.txt'), 'base\n')
  await writeFile(join(root, 'two.txt'), 'base\n')
  git(root, 'add', '.'); git(root, 'commit', '-m', 'base')
  await writeFile(join(root, 'one.txt'), 'base\nfirst change\n')
  await writeFile(join(root, 'two.txt'), 'base\nsecond change\n')

  const all = await service.diff(root)
  assert.deepEqual(all.files.map(file => file.path).sort(), ['one.txt', 'two.txt'])

  // A single-path request is what keeps a huge tree from travelling for one file.
  const only = await service.diff(root, undefined, undefined, { paths: ['one.txt'], mode: 'unstaged' })
  assert.deepEqual(only.files.map(file => file.path), ['one.txt'])
  assert.equal(only.files[0].insertions, 1)
  assert.equal(only.files[0].rawPatch.includes('two.txt'), false)

  // The index boundary is exact: a staged file leaves the unstaged view.
  git(root, 'add', 'one.txt')
  const staged = await service.diff(root, undefined, undefined, { mode: 'staged' })
  assert.deepEqual(staged.files.map(file => file.path), ['one.txt'])
  const unstaged = await service.diff(root, undefined, undefined, { mode: 'unstaged' })
  assert.deepEqual(unstaged.files.map(file => file.path), ['two.txt'])

  // Context depth travels with the request: -U0 keeps no unchanged line around the change.
  const twelve = Array.from({ length: 12 }, (_, index) => `line ${index + 1}\n`)
  await writeFile(join(root, 'three.txt'), twelve.join(''))
  git(root, 'add', 'three.txt'); git(root, 'commit', '-m', 'three')
  twelve[5] = 'line 6 changed\n'
  await writeFile(join(root, 'three.txt'), twelve.join(''))
  const wide = await service.diff(root, undefined, undefined, { paths: ['three.txt'], mode: 'unstaged', context: 3 })
  const narrow = await service.diff(root, undefined, undefined, { paths: ['three.txt'], mode: 'unstaged', context: 0 })
  assert.equal(narrow.files[0].hunks[0].lines.filter(line => line.type === 'normal').length, 0)
  assert.ok(narrow.files[0].hunks[0].lines.length < wide.files[0].hunks[0].lines.length)

  // Whitespace-only edits disappear under -w and survive without it. This has to be an
  // indent change of a committed line, otherwise the line is simply an addition and -w
  // cannot drop it.
  await writeFile(join(root, 'four.txt'), 'alpha\nbeta\n')
  git(root, 'add', 'four.txt'); git(root, 'commit', '-m', 'four')
  await writeFile(join(root, 'four.txt'), 'alpha\n    beta\n')
  const spaced = await service.diff(root, undefined, undefined, { paths: ['four.txt'], mode: 'unstaged' })
  assert.deepEqual(spaced.files.map(file => file.path), ['four.txt'])
  assert.equal(spaced.files[0].insertions + spaced.files[0].deletions, 2)
  const ignored = await service.diff(root, undefined, undefined, { paths: ['four.txt'], mode: 'unstaged', ignoreWhitespace: true })
  assert.equal(ignored.files.reduce((count, file) => count + file.hunks.length, 0), 0)
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

test('stage treats a selected glob-looking filename literally', async t => {
  const { root, service } = await fixture(t)
  await writeFile(join(root, 'a.txt'), 'base a\n')
  await writeFile(join(root, '[a].txt'), 'base bracket\n')
  git(root, 'add', '.'); git(root, 'commit', '-m', 'glob-looking paths')
  await writeFile(join(root, 'a.txt'), 'changed a\n')
  await writeFile(join(root, '[a].txt'), 'changed bracket\n')

  const result = await service.stage(root, ['[a].txt'])
  assert.equal(result.ok, true, result.error)
  assert.deepEqual(git(root, 'diff', '--cached', '--name-only').split('\n'), ['[a].txt'])
})

test('discard treats a selected glob-looking filename literally', async t => {
  const { root, service } = await fixture(t)
  await writeFile(join(root, 'a.txt'), 'base a\n')
  await writeFile(join(root, '[a].txt'), 'base bracket\n')
  git(root, 'add', '.'); git(root, 'commit', '-m', 'glob-looking paths')
  await writeFile(join(root, 'a.txt'), 'changed a\n')
  await writeFile(join(root, '[a].txt'), 'changed bracket\n')

  const result = await service.discard(root, ['[a].txt'])
  assert.equal(result.ok, true, result.error)
  assert.equal(await readFile(join(root, '[a].txt'), 'utf8'), 'base bracket\n')
  assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), 'changed a\n')
})

test('push branch input cannot inject --force and rewrite the remote branch', async t => {
  const { root, base, service } = await fixture(t)
  const remote = join(base, 'remote.git')
  git(base, 'init', '--bare', remote)
  git(root, 'remote', 'add', 'origin', remote)
  git(root, 'push', '--set-upstream', 'origin', 'main')
  const older = git(root, 'rev-parse', 'HEAD')
  await writeFile(join(root, 'tracked.txt'), 'newer commit\n')
  git(root, 'add', 'tracked.txt'); git(root, 'commit', '-m', 'newer commit')
  git(root, 'push', 'origin', 'main')
  const remoteHead = git(remote, 'rev-parse', 'refs/heads/main')
  assert.notEqual(remoteHead, older)
  git(root, 'reset', '--hard', older)

  const result = await service.push(root, { remote: 'origin', branch: '--force' })
  assert.equal(git(remote, 'rev-parse', 'refs/heads/main'), remoteHead)
  assert.equal(result.ok, false)
})

test('blame accepts normal and glob-looking repository filenames', async t => {
  const { root, service } = await fixture(t)
  await writeFile(join(root, 'README.md'), 'normal blame line\n')
  await writeFile(join(root, '[a].txt'), 'literal bracket blame line\n')
  git(root, 'add', '.'); git(root, 'commit', '-m', 'blame paths')

  const normal = await service.blame(root, 'README.md')
  const bracket = await service.blame(root, '[a].txt')
  assert.equal(normal.lines[0].content, 'normal blame line')
  assert.equal(bracket.lines[0].content, 'literal bracket blame line')
})
