import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './helpers/load-ts.mjs'
const { parseUnifiedDiff, parseStatusV2, parseWorktrees, parseLog, decodeGitPath } = await loadTs('src/core/git-command.ts')

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
