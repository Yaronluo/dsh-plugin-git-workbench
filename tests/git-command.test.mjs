import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './helpers/load-ts.mjs'
const {
  parseUnifiedDiff, parseStatusV2, parseWorktrees, parseLog, decodeGitPath, parseStatusEntry, parseOperation,
  parseForEachRefBranches, parseReflog, parseStashList, parseTags, parseBlamePorcelain, parseNameStatus,
  mergeCommitFiles, parseFileHistory, applyTimezone,
} = await loadTs('src/core/git-command.ts')

test('quoted UTF-8 and escaped path decoding', () => {
  assert.equal(decodeGitPath('"a/\\344\\270\\255\\346\\226\\207\\t\\\".txt"'), 'a/中文\t".txt')
})

test('patch metadata is read only from headers; terminal LF adds no fake line', () => {
  const view = parseUnifiedDiff('diff --git a/a b/a\nindex 123..456 100644\n--- a/a\n+++ b/a\n@@ -1 +1,3 @@\n-old\n+new file mode 100644\n+deleted file mode 100644\n+similarity index 100%\n')
  assert.equal(view.files[0].status, 'modified')
  assert.equal(view.files[0].hunks[0].lines.length, 4)
  assert.equal(view.totalInsertions, 3)
})

test('NUL numstat preserves whitespace, tabs and rename destination', () => {
  const patch = 'diff --git "a/old name" "b/new\\tname"\nsimilarity index 100%\nrename from old name\nrename to "new\\tname"\n'
  const view = parseUnifiedDiff(patch, '2\t3\t\0old name\0new\tname\0')
  assert.equal(view.files[0].path, 'new\tname')
  assert.equal(view.files[0].oldPath, 'old name')
  assert.equal(view.files[0].status, 'renamed')
  assert.equal(view.totalInsertions, 2)
  assert.equal(view.totalDeletions, 3)
})

test('quoted patch and textual numstat paths decode consistently', () => {
  const patch = 'diff --git "a/\\344\\270\\255.txt" "b/\\344\\270\\255.txt"\n--- "a/\\344\\270\\255.txt"\n+++ "b/\\344\\270\\255.txt"\n@@ -1 +1 @@\n-a\n+b\n'
  const file = parseUnifiedDiff(patch, '1\t1\t"\\344\\270\\255.txt"\n').files[0]
  assert.equal(file.path, '中.txt')
  assert.equal(file.insertions, 1)
  assert.equal(file.hunks[0].lines.length, 2)
})

test('binary patch ambiguous unquoted path retains embedded b/ segment', () => {
  const file = parseUnifiedDiff('diff --git a/folder b/file.bin b/folder b/file.bin\nindex 123..456 100644\nBinary files a/folder b/file.bin and b/folder b/file.bin differ\n', '0\t0\tfolder b/file.bin\0').files[0]
  assert.equal(file.path, 'folder b/file.bin')
  assert.equal(file.oldPath, file.path)
})

test('NUL status counts rename once and resolves upstream and unborn HEAD', () => {
  const result = parseStatusV2('# branch.oid (initial)\0# branch.head main\0# branch.upstream fork/topic\x002 R. N... 100644 100644 100644 aaa bbb R100 new\0? deceptive-original\0? folder/中文\n.txt\0', '/repo')
  assert.equal(result.head, '')
  assert.equal(result.upstream, 'fork/topic')
  assert.equal(result.dirtyFiles, 2)
  assert.equal(result.untrackedFiles, 1)
})

test('worktree paths normalize Windows separators/case but preserve POSIX case; locked reason', () => {
  const windows = parseWorktrees('worktree C:/Work/repo/\0HEAD abcdef123\0locked maintenance window\0\0', 'c:\\work\\repo')
  assert.equal(windows[0].isCurrent, true)
  assert.equal(windows[0].locked, true)
  assert.equal(windows[0].lockedReason, 'maintenance window')
  assert.equal(parseWorktrees('worktree /Repo\nHEAD abcdef123\n\n', '/repo')[0].isCurrent, false)
})

test('NUL log protocol preserves pipes and record boundaries', () => {
  const commits = parseLog(['a'.repeat(40), 'aaaaaaa', 'subject | pipe', 'author | name', '2 days ago', '', 'HEAD -> main', 'b'.repeat(40), 'bbbbbbb', 'second', 'person', 'now', 'a'.repeat(40), '', ''].join('\0'))
  assert.equal(commits.length, 2)
  assert.equal(commits[0].subject, 'subject | pipe')
  assert.equal(commits[0].author, 'author | name')
  assert.equal(commits[1].parents[0], 'a'.repeat(40))
})

test('status capsules read ahead/behind, the stash count and a detached HEAD', () => {
  const status = parseStatusV2('# branch.oid abcdef1234567890\0# branch.head (detached)\0# branch.ab +2 -3\0# stash 4\0', '/repo')
  assert.equal(status.ahead, 2)
  assert.equal(status.behind, 3)
  assert.equal(status.stashCount, 4)
  assert.equal(status.detached, true)
  assert.equal(status.branch, 'HEAD')
  assert.equal(status.head, 'abcdef1')
})

test('status entries separate staged, unstaged, conflicted and untracked work', () => {
  const staged = parseStatusEntry('1 M. N... 100644 100644 100644 aaa bbb src/已暂存.ts')
  assert.deepEqual([staged.path, staged.index, staged.worktree, staged.conflict, staged.untracked], ['src/已暂存.ts', 'M', '.', false, false])
  const both = parseStatusEntry('1 MM N... 100644 100644 100644 aaa bbb a b/c.txt')
  assert.deepEqual([both.path, both.index, both.worktree], ['a b/c.txt', 'M', 'M'])
  const conflicted = parseStatusEntry('u UU N... 100644 100644 100644 100644 aaa bbb ccc 冲突.txt')
  assert.deepEqual([conflicted.path, conflicted.conflict, conflicted.index, conflicted.worktree], ['冲突.txt', true, 'U', 'U'])
  const untracked = parseStatusEntry('? 未跟踪/新.txt')
  assert.deepEqual([untracked.path, untracked.untracked, untracked.index], ['未跟踪/新.txt', true, '?'])
  const rename = parseStatusV2('2 .M N... 100644 100644 100644 aaa bbb R100 new name.txt\0新 name2.txt\0', '/repo')
  assert.equal(rename.entries[0].origPath, '新 name2.txt')
  assert.equal(rename.entries[0].path, 'new name.txt')
})

test('operation markers tell merge, rebase and am apart by what Git left behind', () => {
  assert.equal(parseOperation(['MERGE_HEAD']), 'merge')
  assert.equal(parseOperation(['rebase-merge']), 'rebase')
  assert.equal(parseOperation(['rebase-apply', 'applying']), 'am')
  assert.equal(parseOperation(['rebase-apply']), 'rebase')
  assert.equal(parseOperation(['CHERRY_PICK_HEAD']), 'cherry-pick')
  assert.equal(parseOperation(['REVERT_HEAD']), 'revert')
  assert.equal(parseOperation([]), null)
})

test('for-each-ref branches carry upstream tracking and drop the remote HEAD alias', () => {
  const branches = parseForEachRefBranches([
    ['refs/heads/main', 'a'.repeat(40), 'origin/main', '[ahead 2, behind 1]', '*', '最新提交'].join('\0'),
    ['refs/remotes/origin/main', 'a'.repeat(40), '', '', ' ', '最新提交'].join('\0'),
    ['refs/remotes/origin/HEAD', 'a'.repeat(40), '', '', ' ', ''].join('\0'),
    ['refs/heads/gone', 'b'.repeat(40), 'origin/gone', '[gone]', '', ''].join('\0'),
  ].join('\n'), 'main')
  assert.deepEqual(branches.map(branch => branch.name), ['main', 'gone', 'origin/main'])
  assert.equal(branches[0].current, true)
  assert.deepEqual([branches[0].ahead, branches[0].behind], [2, 1])
  assert.equal(branches[1].upstream, 'origin/gone (已删除)')
})

test('reflog records carry the action and survive the -z record terminator', () => {
  const entries = parseReflog(['a'.repeat(40), 'aaaaaaa', 'HEAD@{0}', 'reset: moving to HEAD~1', '1 second ago', 'b'.repeat(40), 'bbbbbbb', 'HEAD@{1}', 'commit (initial): one', '2 minutes ago', ''].join('\0'))
  assert.equal(entries.length, 2)
  assert.equal(entries[0].action, 'reset')
  assert.equal(entries[0].selector, 'HEAD@{0}')
  assert.equal(entries[1].subject, 'commit (initial): one')
  assert.equal(entries[1].action, 'commit')
})

test('stash list entries expose index, branch and message', () => {
  const entries = parseStashList(['stash@{0}', 'a'.repeat(40), 'aaaaaaa', 'On main: 半成品', '3 minutes ago', 'stash@{1}', 'b'.repeat(40), 'bbbbbbb', 'WIP on feature/x: 1a2b3c previous subject', 'yesterday', ''].join('\0'))
  assert.deepEqual(entries.map(entry => entry.index), [0, 1])
  assert.equal(entries[0].branch, 'main')
  assert.equal(entries[0].subject, 'On main: 半成品')
  assert.equal(entries[1].branch, 'feature/x')
})

test('annotated tags peel to their commit while lightweight tags keep the commit subject', () => {
  const tags = parseTags([
    ['v1.0', 'a'.repeat(40), 'tag', 'b'.repeat(40), '发布 1.0', '3 days ago'].join('\0'),
    ['wip', 'c'.repeat(40), 'commit', '', '修复', '5 hours ago'].join('\0'),
    '',
  ].join('\n'))
  assert.deepEqual(tags.map(tag => tag.name), ['v1.0', 'wip'])
  assert.equal(tags[0].annotated, true)
  assert.equal(tags[0].hash, 'b'.repeat(40))
  assert.equal(tags[0].subject, '发布 1.0')
  assert.equal(tags[1].annotated, false)
  assert.equal(tags[1].hash, 'c'.repeat(40))
})

test('blame porcelain carries author values across a group and marks uncommitted lines', () => {
  const lines = parseBlamePorcelain([
    'b'.repeat(40) + ' 1 1 2',
    'author 张三',
    'author-mail <z@example.com>',
    'author-time 1714556000',
    'author-tz +0800',
    'summary 初始提交',
    '\t第一行',
    'b'.repeat(40) + ' 2 2',
    '\t第二行',
    '0'.repeat(40) + ' 3 3 1',
    'author 未提交',
    'author-mail <n@example.com>',
    'author-time 1714556000',
    'author-tz +0800',
    'summary 未提交',
    '\t第三行',
  ].join('\n'))
  assert.equal(lines.length, 3)
  assert.equal(lines[1].author, '张三')
  assert.equal(lines[1].content, '第二行')
  assert.equal(lines[0].date, '2024-05-01T17:33:20+08:00')
  assert.equal(lines[2].uncommitted, true)
  assert.equal(applyTimezone('not-a-date', '+0800'), 'not-a-date')
})

test('commit file lists merge name-status with numstat counts by new path', () => {
  const entries = parseNameStatus(['M\0src/a.ts\0', 'R100\0old.ts\0new.ts\0', 'A\0新增.txt\0', 'D\0gone.txt\0'].join(''))
  assert.deepEqual(entries.map(entry => [entry.status, entry.path, entry.oldPath]), [
    ['modified', 'src/a.ts', undefined],
    ['renamed', 'new.ts', 'old.ts'],
    ['added', '新增.txt', undefined],
    ['deleted', 'gone.txt', undefined],
  ])
  const files = mergeCommitFiles(entries, [
    '3\t1\tsrc/a.ts', '0\t0\told.ts', '0\t0\tnew.ts', '5\t0\t新增.txt', '0\t7\tgone.txt', '',
  ].join('\0'))
  assert.deepEqual(files.map(file => [file.path, file.insertions, file.deletions]), [
    ['src/a.ts', 3, 1], ['new.ts', 0, 0], ['新增.txt', 5, 0], ['gone.txt', 0, 7],
  ])
})

test('file history keeps the 5-field stride the -z log format produces', () => {
  const history = parseFileHistory(['a'.repeat(40), 'aaaaaaa', '改名', '张三', '2 days ago', 'b'.repeat(40), 'bbbbbbb', '创建', '李四', '3 days ago', ''].join('\0'))
  assert.deepEqual(history.map(entry => entry.subject), ['改名', '创建'])
  assert.equal(history[0].author, '张三')
})
