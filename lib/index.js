// src/host/git-runner.ts
import { spawn } from "node:child_process";
function createGitRunner() {
  const gitBin = process.platform === "win32" ? "git.exe" : "git";
  return {
    run(argv, cwd, signal) {
      return new Promise((resolve3, reject) => {
        let child;
        try {
          child = spawn(gitBin, argv, {
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
            signal,
            env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }
          });
        } catch (err) {
          return reject(err);
        }
        const outChunks = [];
        const errChunks = [];
        child.stdout?.on("data", (chunk) => outChunks.push(Buffer.from(chunk)));
        child.stderr?.on("data", (chunk) => errChunks.push(Buffer.from(chunk)));
        child.on("error", (err) => reject(err));
        child.on("close", (code) => {
          resolve3({
            stdout: Buffer.concat(outChunks).toString("utf-8"),
            stderr: Buffer.concat(errChunks).toString("utf-8"),
            // A signal-terminated child is never a successful Git command.
            exitCode: code ?? -1
          });
        });
      });
    }
  };
}

// src/host/git-service.ts
import { readFile, readlink, lstat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

// src/core/git-command.ts
import { posix, win32 } from "node:path";
function parseStatusV2(stdout, root) {
  const status = { isGit: true, root, branch: "HEAD", head: "", dirtyFiles: 0, untrackedFiles: 0, conflicts: 0, operationInProgress: false };
  const records = stdout.split(stdout.includes("\0") ? "\0" : "\n");
  for (let i = 0; i < records.length; i++) {
    const line = records[i];
    if (line.startsWith("# branch.head ")) status.branch = line.slice(14) === "(detached)" ? "HEAD" : line.slice(14);
    else if (line.startsWith("# branch.oid ")) status.head = line.slice(13) === "(initial)" ? "" : line.slice(13, 20);
    else if (line.startsWith("# branch.upstream ")) status.upstream = line.slice(18);
    else if (/^[12u?] /.test(line)) {
      status.dirtyFiles++;
      if (line.startsWith("? ")) status.untrackedFiles++;
      if (line.startsWith("u ")) status.conflicts++;
      if (line.startsWith("2 ") && stdout.includes("\0")) i++;
    }
  }
  return status;
}
function parseBranches(stdout) {
  return stdout.split("\n").map((line) => line.trim()).filter((line) => line && !line.includes("->")).map((line) => {
    const name = line.replace(/^[*+\s]+/, "").replace(/^remotes\//, "");
    return { name, current: line.startsWith("*"), isRemote: line.replace(/^[*+\s]+/, "").startsWith("remotes/") };
  }).sort((a, b) => Number(b.current) - Number(a.current) || Number(a.isRemote) - Number(b.isRemote) || a.name.localeCompare(b.name));
}
function decodeGitPath(value) {
  if (!value.startsWith('"') || !value.endsWith('"')) return value;
  const bytes = [];
  const escapes = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, "\\": 92, '"': 34 };
  const text = value.slice(1, -1);
  for (let i = 0; i < text.length; ) {
    if (text[i] === "\\") {
      const octal = text.slice(i + 1).match(/^[0-7]{1,3}/)?.[0];
      if (octal) {
        bytes.push(parseInt(octal, 8));
        i += octal.length + 1;
      } else {
        bytes.push(escapes[text[i + 1]] ?? text.charCodeAt(i + 1));
        i += 2;
      }
    } else {
      const point = text.codePointAt(i);
      bytes.push(...Buffer.from(String.fromCodePoint(point)));
      i += point > 65535 ? 2 : 1;
    }
  }
  return Buffer.from(bytes).toString("utf8");
}
function parseUnifiedDiff(diffOutput, numstatOutput = "") {
  const stats = /* @__PURE__ */ new Map();
  const put = (ins, del, path) => stats.set(path, { ins: Number(ins) || 0, del: Number(del) || 0 });
  if (numstatOutput.includes("\0")) {
    const records = numstatOutput.split("\0");
    for (let i = 0; i < records.length; i++) {
      const match = records[i].match(/^([^\t]+)\t([^\t]+)\t(.*)$/s);
      if (!match) continue;
      let path = match[3];
      if (!path) {
        i++;
        path = records[++i];
      }
      put(match[1], match[2], path);
    }
  } else {
    for (const line of numstatOutput.split("\n")) {
      const match = line.match(/^([^\t]+)\t([^\t]+)\t(.*)$/);
      if (match) {
        let path = decodeGitPath(match[3]);
        path = path.replace(/\{[^{}]* => ([^{}]*)\}/, "$1").replace(/^.* => /, "");
        put(match[1], match[2], path);
      }
    }
  }
  const files = [];
  for (const chunk of diffOutput.split(/(?=^diff --git )/m)) {
    if (!chunk.startsWith("diff --git ")) continue;
    const lines = chunk.split("\n");
    const firstHunk = lines.findIndex((line) => line.startsWith("@@ "));
    const header = lines.slice(1, firstHunk < 0 ? void 0 : firstHunk);
    const tokens = lines[0].slice(11).match(/^("(?:\\.|[^"\\])*"|a\/.*?) ("(?:\\.|[^"\\])*"|b\/.*)$/);
    let oldPath = tokens ? decodeGitPath(tokens[1]).replace(/^a\//, "") : "";
    let path = tokens ? decodeGitPath(tokens[2]).replace(/^b\//, "") : "";
    const names = lines[0].slice(11);
    if (names.startsWith("a/")) {
      for (let boundary = names.indexOf(" b/"); boundary >= 0; boundary = names.indexOf(" b/", boundary + 1)) {
        if (names.slice(2, boundary) === names.slice(boundary + 3)) {
          oldPath = path = names.slice(2, boundary);
          break;
        }
      }
    }
    let status = "modified";
    for (const line of header) {
      if (line.startsWith("--- ") && line.slice(4) !== "/dev/null") oldPath = decodeGitPath(line.slice(4).split("	")[0]).replace(/^a\//, "");
      if (line.startsWith("+++ ") && line.slice(4) !== "/dev/null") path = decodeGitPath(line.slice(4).split("	")[0]).replace(/^b\//, "");
      if (line.startsWith("new file mode ")) status = "added";
      if (line.startsWith("deleted file mode ")) status = "deleted";
      if (line.startsWith("rename from ")) {
        oldPath = decodeGitPath(line.slice(12));
        status = "renamed";
      }
      if (line.startsWith("rename to ")) path = decodeGitPath(line.slice(10));
    }
    const hunks = [];
    let hunk;
    let oldNum = 0, newNum = 0, ins = 0, del = 0;
    for (const line of lines.slice(1)) {
      const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        oldNum = Number(match[1]);
        newNum = Number(match[3]);
        hunk = { header: line, oldStart: oldNum, oldLines: Number(match[2] ?? 1), newStart: newNum, newLines: Number(match[4] ?? 1), lines: [] };
        hunks.push(hunk);
      } else if (hunk && line.startsWith("+")) {
        ins++;
        hunk.lines.push({ type: "add", newNum: newNum++, content: line.slice(1) });
      } else if (hunk && line.startsWith("-")) {
        del++;
        hunk.lines.push({ type: "del", oldNum: oldNum++, content: line.slice(1) });
      } else if (hunk && line.startsWith(" ")) hunk.lines.push({ type: "normal", oldNum: oldNum++, newNum: newNum++, content: line.slice(1) });
    }
    const stat = stats.get(path) ?? { ins, del };
    files.push({ path, oldPath: oldPath || void 0, status, insertions: stat.ins, deletions: stat.del, hunks, rawPatch: chunk });
  }
  return { base: "HEAD", target: "working-tree", totalInsertions: files.reduce((n, f) => n + f.insertions, 0), totalDeletions: files.reduce((n, f) => n + f.deletions, 0), files };
}
function normalizeWorktreePath(value) {
  if (/^[a-z]:[\\/]/i.test(value) || value.startsWith("\\\\")) return win32.normalize(value).replace(/[\\/]+$/, "").toLowerCase();
  return posix.normalize(value).replace(/\/$/, "") || "/";
}
function parseWorktrees(stdout, currentPath) {
  const items = [];
  let item;
  for (const line of stdout.split(stdout.includes("\0") ? "\0" : "\n")) {
    if (line.startsWith("worktree ")) {
      const path = stdout.includes("\0") ? line.slice(9) : decodeGitPath(line.slice(9));
      item = { path, head: "", branch: "(detached)", isCurrent: normalizeWorktreePath(path) === normalizeWorktreePath(currentPath), locked: false };
      items.push(item);
    } else if (item) {
      if (line.startsWith("HEAD ")) item.head = line.slice(5, 12);
      else if (line.startsWith("branch refs/heads/")) item.branch = line.slice(18);
      else if (line === "locked" || line.startsWith("locked ")) {
        item.locked = true;
        item.lockedReason = line.slice(7) || void 0;
      }
    }
  }
  return items;
}
function parseLog(stdout) {
  const fields = stdout.split("\0");
  const commits = [];
  for (let i = 0; i + 6 < fields.length; i += 7) {
    const [hash, shortHash, subject, author, date, parents, refs] = fields.slice(i, i + 7);
    if (!hash || !shortHash) continue;
    commits.push({ hash, shortHash, subject, author, date, parents: parents.split(" ").filter(Boolean), refs: refs.split(",").map((s) => s.trim()).filter(Boolean) });
  }
  return commits;
}

// src/host/git-service.ts
var GitService = class {
  constructor(runner) {
    this.runner = runner;
  }
  runner;
  checked(result, operation) {
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `${operation} failed (exit ${result.exitCode})`);
    return result;
  }
  safeRef(value) {
    if (typeof value !== "string" || !value || value.startsWith("-") || /[\s\x00-\x1f\x7f]/.test(value)) throw new Error("Invalid Git reference");
    return value;
  }
  async commit(root, value) {
    this.safeRef(value);
    const result = this.checked(await this.runner.run(["rev-parse", "--verify", "--end-of-options", `${value}^{commit}`], root), "Resolve reference");
    const hash = result.stdout.trim();
    if (!/^[0-9a-f]{40,64}$/i.test(hash)) throw new Error("Invalid resolved commit");
    return hash;
  }
  async branchName(root, name) {
    this.safeRef(name);
    this.checked(await this.runner.run(["check-ref-format", "--branch", name], root), "Validate branch");
    if (name.startsWith("@{")) throw new Error("Invalid branch name");
    return name;
  }
  async isGitRepo(cwd) {
    try {
      if (!cwd || typeof cwd !== "string") return false;
      const dir = resolve(cwd.trim().replace(/^["']|["']$/g, ""));
      if (!existsSync(dir)) return false;
      const result = await this.runner.run(["rev-parse", "--is-inside-work-tree"], dir);
      return result.exitCode === 0 && result.stdout.trim() === "true";
    } catch {
      return false;
    }
  }
  async getRepoRoot(cwd) {
    try {
      if (!cwd || typeof cwd !== "string") return null;
      const dir = resolve(cwd.trim().replace(/^["']|["']$/g, ""));
      const result = await this.runner.run(["rev-parse", "--show-toplevel"], dir);
      return result.exitCode === 0 && result.stdout.trim() ? resolve(result.stdout.trim()) : null;
    } catch {
      return null;
    }
  }
  async status(cwd) {
    if (!await this.isGitRepo(cwd)) return { isGit: false, root: "", branch: "", head: "", dirtyFiles: 0, untrackedFiles: 0, conflicts: 0, operationInProgress: false, revision: "not-git" };
    const root = await this.getRepoRoot(cwd) || cwd;
    const result = this.checked(await this.runner.run(["status", "--porcelain=v2", "--branch", "-z", "--untracked-files=all"], root), "Status");
    const status = parseStatusV2(result.stdout, root);
    const gitDirResult = this.checked(await this.runner.run(["rev-parse", "--absolute-git-dir"], root), "Resolve git directory");
    const gitDir = gitDirResult.stdout.trim();
    const markers = ["MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD", "REVERT_HEAD", "sequencer"];
    const activeMarkers = markers.filter((marker) => existsSync(join(gitDir, marker)));
    status.operationInProgress = activeMarkers.length > 0;
    const hash = createHash("sha256").update(result.stdout).update(JSON.stringify(activeMarkers));
    const paths = this.checked(await this.runner.run(["ls-files", "-z", "--modified", "--deleted", "--others", "--exclude-standard"], root), "List files");
    for (const path of [...new Set(paths.stdout.split("\0").filter(Boolean))].sort()) {
      hash.update(JSON.stringify(path));
      try {
        const fullPath = join(root, path);
        const stat = await lstat(fullPath);
        hash.update(String(stat.mode));
        if (stat.isSymbolicLink()) hash.update(await readlink(fullPath));
        else if (stat.isFile()) hash.update(await readFile(fullPath));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        hash.update("missing");
      }
    }
    const index = this.checked(await this.runner.run(["ls-files", "--stage", "-z"], root), "Read index");
    hash.update(index.stdout);
    const refs = this.checked(await this.runner.run(["for-each-ref", "--format=%(refname)%00%(objectname)%00%(upstream)", "refs/heads", "refs/remotes"], root), "Read refs");
    hash.update(refs.stdout);
    const worktrees = this.checked(await this.runner.run(["worktree", "list", "--porcelain", "-z"], root), "List worktrees");
    hash.update(worktrees.stdout);
    status.revision = hash.digest("hex");
    return status;
  }
  async branches(cwd) {
    if (!await this.isGitRepo(cwd)) return { current: "", dirtyFiles: 0, branches: [] };
    const root = await this.getRepoRoot(cwd) || cwd;
    const [result, status] = await Promise.all([this.runner.run(["branch", "-a", "--no-color"], root), this.status(root)]);
    this.checked(result, "List branches");
    return { current: status.branch, dirtyFiles: status.dirtyFiles, branches: parseBranches(result.stdout) };
  }
  async switchBranch(cwd, branch) {
    if (!await this.isGitRepo(cwd)) return { ok: false, error: { code: "not-git", message: "Not a git repository" } };
    const root = await this.getRepoRoot(cwd) || cwd;
    try {
      await this.branchName(root, branch);
      const refsResult = this.checked(await this.runner.run(["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes"], root), "Resolve branch");
      const refs = new Set(refsResult.stdout.split("\n").filter(Boolean));
      let name = branch;
      let args;
      if (refs.has(`refs/heads/${branch}`)) args = ["switch", "--", branch];
      else if (refs.has(`refs/remotes/${branch}`)) {
        name = await this.branchName(root, branch.slice(branch.indexOf("/") + 1));
        if (refs.has(`refs/heads/${name}`)) throw new Error(`Local branch "${name}" already exists; select it explicitly instead of remote "${branch}"`);
        args = ["switch", "--track", "-c", name, "--", `refs/remotes/${branch}`];
      } else throw new Error(`Branch not found: ${branch}`);
      const result = await this.runner.run(args, root);
      return result.exitCode === 0 ? { ok: true, branch: name } : { ok: false, error: { code: "switch-failed", message: result.stderr.trim() || "Failed to switch branch" } };
    } catch (error) {
      return { ok: false, error: { code: "switch-failed", message: error.message } };
    }
  }
  async createBranch(cwd, name, base) {
    if (!await this.isGitRepo(cwd)) return { ok: false, error: { code: "not-git", message: "Not a git repository" } };
    const root = await this.getRepoRoot(cwd) || cwd;
    try {
      await this.branchName(root, name);
      const args = ["switch", "-c", name];
      if (base !== void 0) args.push(await this.commit(root, base));
      const result = await this.runner.run(args, root);
      return result.exitCode === 0 ? { ok: true, branch: name } : { ok: false, error: { code: "create-failed", message: result.stderr.trim() || "Failed to create branch" } };
    } catch (error) {
      return { ok: false, error: { code: "create-failed", message: error.message } };
    }
  }
  async diff(cwd, base, target) {
    if (!await this.isGitRepo(cwd)) return { base: "", target: "", totalInsertions: 0, totalDeletions: 0, files: [] };
    const root = await this.getRepoRoot(cwd) || cwd;
    const workingTree = !target || target === "working-tree";
    let baseHash;
    if (base === void 0 || base === "HEAD") {
      const head = await this.runner.run(["rev-parse", "--verify", "--end-of-options", "HEAD^{commit}"], root);
      if (head.exitCode === 0) baseHash = head.stdout.trim();
      else {
        const symbolic = this.checked(await this.runner.run(["symbolic-ref", "-q", "HEAD"], root), "Resolve HEAD");
        const existing = await this.runner.run(["show-ref", "--verify", "--quiet", symbolic.stdout.trim()], root);
        if (existing.exitCode !== 1 || !workingTree) this.checked(head, "Resolve HEAD");
        baseHash = this.checked(await this.runner.run(["hash-object", "-t", "tree", "--stdin"], root), "Empty tree").stdout.trim();
      }
    } else baseHash = await this.commit(root, base);
    const revisions = workingTree ? [baseHash] : [`${baseHash}...${await this.commit(root, target)}`];
    const common = ["--no-ext-diff", "--no-textconv", "--no-color", "--src-prefix=a/", "--dst-prefix=b/"];
    const [patch, stats] = await Promise.all([
      this.runner.run(["diff", ...common, "-U3", ...revisions, "--"], root),
      this.runner.run(["diff", ...common, "--numstat", "-z", ...revisions, "--"], root)
    ]);
    this.checked(patch, "Diff");
    this.checked(stats, "Diff numstat");
    const parsed = parseUnifiedDiff(patch.stdout, stats.stdout);
    parsed.base = base || "HEAD";
    parsed.target = target || "working-tree";
    if (workingTree) {
      const untracked = this.checked(await this.runner.run(["ls-files", "--others", "--exclude-standard", "-z"], root), "List untracked files");
      for (const path of untracked.stdout.split("\0").filter(Boolean)) {
        const fullPath = join(root, path);
        const stat = await lstat(fullPath);
        const bytes = stat.isSymbolicLink() ? Buffer.from(await readlink(fullPath)) : await readFile(fullPath);
        const binary = bytes.subarray(0, 8e3).includes(0);
        const content = bytes.toString("utf8");
        const lines = binary || bytes.length === 0 ? [] : content.replace(/\n$/, "").split("\n");
        const count = lines.length;
        parsed.totalInsertions += count;
        parsed.files.push({ path, status: "untracked", insertions: count, deletions: 0, hunks: count ? [{ header: `@@ -0,0 +1,${count} @@`, oldStart: 0, oldLines: 0, newStart: 1, newLines: count, lines: lines.map((content2, i) => ({ type: "add", newNum: i + 1, content: content2 })) }] : [], rawPatch: binary ? `Binary file ${path}
` : content });
      }
    }
    return parsed;
  }
  async worktrees(cwd) {
    if (!await this.isGitRepo(cwd)) return [];
    const root = await this.getRepoRoot(cwd) || cwd;
    return parseWorktrees(this.checked(await this.runner.run(["worktree", "list", "--porcelain", "-z"], root), "List worktrees").stdout, root);
  }
  async createWorktree(cwd, name, baseBranch) {
    const root = await this.getRepoRoot(cwd);
    if (!root) return { ok: false, error: "Not a git repository" };
    try {
      if (typeof name !== "string" || !name.trim()) throw new Error("Invalid worktree name");
      const sanitizedName = name.replace(/[^a-zA-Z0-9_\-.]/g, "-").toLowerCase();
      const branch = await this.branchName(root, `wt/${sanitizedName}`);
      const targetDir = resolve(root, "..", `.dsh-wt-${sanitizedName}`);
      const args = ["worktree", "add", "-b", branch, "--", targetDir];
      if (baseBranch !== void 0) args.push(await this.commit(root, baseBranch));
      const result = await this.runner.run(args, root);
      return result.exitCode === 0 ? { ok: true, path: targetDir } : { ok: false, error: result.stderr.trim() || "Failed to create worktree" };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }
  async removeWorktree(cwd, worktreePath) {
    const root = await this.getRepoRoot(cwd);
    if (!root) return { ok: false, error: "Not a git repository" };
    if (typeof worktreePath !== "string" || !worktreePath) return { ok: false, error: "Invalid worktree path" };
    const result = await this.runner.run(["worktree", "remove", "--", resolve(root, worktreePath)], root);
    return result.exitCode === 0 ? { ok: true } : { ok: false, error: result.stderr.trim() || "Failed to remove worktree" };
  }
  async log(cwd, maxCount = 50) {
    if (!await this.isGitRepo(cwd)) return [];
    if (!Number.isSafeInteger(maxCount) || maxCount < 1 || maxCount > 1e4) throw new Error("Invalid log limit");
    const root = await this.getRepoRoot(cwd) || cwd;
    const result = await this.runner.run(["log", `-n${maxCount}`, "-z", "--format=%H%x00%h%x00%s%x00%an%x00%cr%x00%P%x00%D", "--no-color"], root);
    if (result.exitCode !== 0) {
      const head = await this.runner.run(["rev-parse", "--verify", "HEAD"], root);
      if (head.exitCode !== 0) return [];
      this.checked(result, "Log");
    }
    return parseLog(result.stdout);
  }
};

// src/host/routes.ts
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as join2 } from "node:path";

// src/host/editor-launcher.ts
import { execFile, spawn as spawn2 } from "node:child_process";
import { existsSync as existsSync2, statSync } from "node:fs";
import { isAbsolute, relative, resolve as resolve2 } from "node:path";
import { promisify } from "node:util";
var execFileAsync = promisify(execFile);
var EDITOR_CANDIDATES = [
  { command: "code", label: "VS Code", goto: true },
  { command: "cursor", label: "Cursor", goto: true },
  { command: "code-insiders", label: "VS Code Insiders", goto: true },
  { command: "windsurf", label: "Windsurf", goto: true },
  { command: "zed", label: "Zed", goto: false },
  { command: "subl", label: "Sublime Text", goto: false }
];
var UNSAFE_TARGET = /["'`%^&|<>()\r\n\t\0]/;
async function whichCommand(command) {
  const finder = process.platform === "win32" ? "where" : "which";
  try {
    const { stdout } = await execFileAsync(finder, [command], { windowsHide: true, timeout: 5e3 });
    const hits = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return hits.find((hit) => /\.exe$/i.test(hit)) ?? hits[0];
  } catch {
    return void 0;
  }
}
function spawnDetached(command, args) {
  const child = spawn2(command, args, {
    detached: true,
    stdio: "ignore",
    shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(command)
  });
  child.on("error", () => {
  });
  child.unref();
}
function createEditorLauncher(options = {}) {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const resolveCommand = options.resolveCommand ?? whichCommand;
  const launch = options.launch ?? spawnDetached;
  const fileExists = options.fileExists ?? existsSync2;
  const isDirectory = options.isDirectory ?? ((target) => {
    try {
      return statSync(target).isDirectory();
    } catch {
      return false;
    }
  });
  const resolveTarget = (target) => {
    if (!target.repo?.trim()) return { error: "\u7F3A\u5C11\u4ED3\u5E93\u8DEF\u5F84" };
    if (target.file && UNSAFE_TARGET.test(target.file)) return { error: "\u6587\u4EF6\u8DEF\u5F84\u5305\u542B\u4E0D\u652F\u6301\u7528\u4E8E\u5916\u90E8\u7F16\u8F91\u5668\u7684\u5B57\u7B26" };
    const repo = resolve2(target.repo);
    if (!target.file) return { absolutePath: repo, display: repo };
    const absolutePath = resolve2(repo, target.file);
    const rel = relative(repo, absolutePath);
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) return { error: "\u53EA\u80FD\u6253\u5F00\u5F53\u524D\u4ED3\u5E93\u5185\u7684\u6587\u4EF6" };
    if (!fileExists(absolutePath)) return { error: "\u6587\u4EF6\u5DF2\u4E0D\u5B58\u5728\uFF0C\u53EF\u80FD\u5DF2\u88AB\u5220\u9664\u6216\u91CD\u547D\u540D" };
    return { absolutePath, display: target.file };
  };
  const editorArguments = (candidate, absolutePath, line) => {
    if (isDirectory(absolutePath)) return [absolutePath];
    if (!candidate.goto) return [line ? `${absolutePath}:${line}` : absolutePath];
    return line ? ["-g", `${absolutePath}:${line}`] : ["-g", absolutePath];
  };
  const openWithSystemDefault = (absolutePath) => {
    if (platform === "win32") launch(env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "start", "", absolutePath]);
    else if (platform === "darwin") launch("open", [absolutePath]);
    else launch("xdg-open", [absolutePath]);
  };
  return {
    async open(target) {
      const resolved = resolveTarget(target);
      if ("error" in resolved) return { ok: false, error: resolved.error };
      const { absolutePath, display } = resolved;
      const override = env.DSH_GIT_EDITOR?.trim();
      const candidates = override ? [{ command: override, label: override, goto: false }] : [...EDITOR_CANDIDATES];
      for (const candidate of candidates) {
        const command = await resolveCommand(candidate.command);
        if (!command) continue;
        launch(command, editorArguments(candidate, absolutePath, target.line));
        return { ok: true, editor: candidate.label, target: display };
      }
      if (options.openNatively) {
        try {
          await options.openNatively(absolutePath);
          return { ok: true, target: display };
        } catch {
        }
      }
      openWithSystemDefault(absolutePath);
      return { ok: true, target: display };
    }
  };
}

// src/host/routes.ts
function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}
function readJsonBody(req) {
  return new Promise((resolve3, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > 64 * 1024) {
        failed = true;
        reject(badRequest("Request body is too large"));
        return;
      }
      if (!failed) chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => {
      if (failed) return;
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}");
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
        resolve3(payload);
      } catch {
        reject(badRequest("A JSON object is required"));
      }
    });
    req.on("error", reject);
    req.on("aborted", () => reject(badRequest("Request aborted")));
  });
}
function writeJson(res, status, body) {
  if (res.destroyed || res.writableEnded) return;
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store"
  });
  res.end(payload);
}
function stringField(payload, key, optional = false) {
  const value = payload[key];
  if (optional && value === void 0) return void 0;
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw badRequest(`${key} must be a non-empty string`);
  return value;
}
function nativePathOpener(ctx) {
  return async (absolutePath) => {
    const controller = ctx?.get?.("sessionController");
    if (!controller?.openWorkspacePath) throw new Error("DSH \u672A\u63D0\u4F9B\u7CFB\u7EDF\u6253\u5F00\u80FD\u529B");
    if (typeof controller.canOpenWorkspacePath === "function" && !await controller.canOpenWorkspacePath()) {
      throw new Error("\u5F53\u524D\u73AF\u5883\u65E0\u6CD5\u6253\u5F00\u672C\u5730\u6587\u4EF6");
    }
    await controller.openWorkspacePath({ path: absolutePath });
  };
}
function clientReportPath(source = "client") {
  const safe = String(source).replace(/[^a-z0-9_-]/gi, "") || "client";
  return join2(tmpdir(), `dsh-plugin-git-client-report-${safe}.json`);
}
function registerRoutes(ctx, service, options = {}) {
  const editor = options.editorLauncher ?? createEditorLauncher({ openNatively: nativePathOpener(ctx) });
  const groups = /* @__PURE__ */ new Map();
  const lastSent = /* @__PURE__ */ new WeakMap();
  let stopped = false;
  let heartbeatTimer;
  let pollTimer;
  const send = (res, event, payload) => {
    if (stopped || res.destroyed || res.writableEnded) return;
    if (res.writableLength > 1024 * 1024) {
      res.destroy();
      return;
    }
    res.write(`event: ${event}
data: ${JSON.stringify(payload)}

`);
  };
  const pollGroup = async (group) => {
    if (stopped || group.inFlight || !group.subscribers.size) return;
    group.inFlight = true;
    try {
      const status = await service.status(group.path);
      const key = JSON.stringify(status);
      for (const res of group.subscribers) {
        if (lastSent.get(res) === key) continue;
        send(res, "status", status);
        lastSent.set(res, key);
      }
    } catch (error) {
      for (const res of group.subscribers) {
        send(res, "status-error", { error: error?.message || "Git status failed" });
        lastSent.delete(res);
      }
    } finally {
      group.inFlight = false;
    }
  };
  const poll = () => {
    for (const group of groups.values()) void pollGroup(group);
  };
  const stopTimersWhenEmpty = () => {
    if (groups.size) return;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (pollTimer) clearInterval(pollTimer);
    heartbeatTimer = pollTimer = void 0;
  };
  const sseHandler = (req, res, url) => {
    if (req.method !== "GET") {
      writeJson(res, 405, { ok: false, error: "Method Not Allowed" });
      return;
    }
    const path = stringField({ path: url.searchParams.get("path") }, "path");
    const count = [...groups.values()].reduce((n, g) => n + g.subscribers.size, 0);
    if (count >= 100) {
      writeJson(res, 503, { ok: false, error: "Too many Git subscribers" });
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });
    res.write(": connected\n\n");
    let group = groups.get(path);
    if (!group) {
      group = { path, subscribers: /* @__PURE__ */ new Set(), inFlight: false };
      groups.set(path, group);
    }
    group.subscribers.add(res);
    const currentGroup = group;
    res.once("close", () => {
      currentGroup.subscribers.delete(res);
      if (!currentGroup.subscribers.size && groups.get(path) === currentGroup) groups.delete(path);
      stopTimersWhenEmpty();
    });
    void pollGroup(group);
    if (!heartbeatTimer) heartbeatTimer = setInterval(() => {
      for (const g of groups.values()) for (const target of g.subscribers) {
        if (!target.destroyed && !target.writableEnded) target.write(": ping\n\n");
      }
    }, 15e3);
    if (!pollTimer) pollTimer = setInterval(poll, options.pollIntervalMs ?? 3e3);
  };
  const apiHandler = async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname === "/dsh-git/events") {
        sseHandler(req, res, url);
        return;
      }
      if (req.method !== "POST") {
        writeJson(res, 405, { ok: false, error: "Method Not Allowed" });
        return;
      }
      const payload = await readJsonBody(req);
      if (url.pathname === "/dsh-git/client-report") {
        const source = stringField(payload, "source", true) || "client";
        try {
          writeFileSync(clientReportPath(source), JSON.stringify(payload, null, 2), "utf-8");
          ctx.logger?.info?.(`[dsh-plugin-git] client report (${source}): ${JSON.stringify(payload)}`);
        } catch {
        }
        writeJson(res, 200, { ok: true });
        return;
      }
      const path = stringField(payload, "path");
      const required = (name) => stringField(payload, name);
      const optional = (name) => stringField(payload, name, true);
      switch (url.pathname) {
        case "/dsh-git/status":
          writeJson(res, 200, { ok: true, value: await service.status(path) });
          return;
        case "/dsh-git/branches":
          writeJson(res, 200, { ok: true, value: await service.branches(path) });
          return;
        case "/dsh-git/switch":
          writeJson(res, 200, await service.switchBranch(path, required("branch")));
          return;
        case "/dsh-git/create-branch":
          writeJson(res, 200, await service.createBranch(path, required("name"), optional("base")));
          return;
        case "/dsh-git/diff":
          writeJson(res, 200, { ok: true, value: await service.diff(path, optional("base"), optional("target")) });
          return;
        case "/dsh-git/worktrees":
          writeJson(res, 200, { ok: true, value: await service.worktrees(path) });
          return;
        case "/dsh-git/create-worktree":
          writeJson(res, 200, await service.createWorktree(path, required("name"), optional("base")));
          return;
        case "/dsh-git/remove-worktree":
          writeJson(res, 200, await service.removeWorktree(path, required("worktreePath")));
          return;
        case "/dsh-git/log": {
          if (payload.limit !== void 0 && (!Number.isInteger(payload.limit) || payload.limit < 1 || payload.limit > 500)) throw badRequest("limit must be between 1 and 500");
          writeJson(res, 200, { ok: true, value: await service.log(path, payload.limit) });
          return;
        }
        case "/dsh-git/open-in-editor": {
          if (payload.line !== void 0 && (!Number.isInteger(payload.line) || payload.line < 1)) throw badRequest("line must be a positive integer");
          writeJson(res, 200, await editor.open({ repo: path, file: optional("file"), line: payload.line }));
          return;
        }
        default:
          writeJson(res, 404, { ok: false, error: "Not found" });
      }
    } catch (error) {
      writeJson(res, error?.statusCode === 400 ? 400 : 500, { ok: false, error: error?.message || "Internal Error" });
    }
  };
  if (!ctx.webServer?.register) throw new Error("Git plugin requires webServer.register");
  const unregister = ctx.webServer.register({ kind: "prefix", path: "/dsh-git", handler: apiHandler });
  return () => {
    stopped = true;
    unregister();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (pollTimer) clearInterval(pollTimer);
    for (const group of groups.values()) for (const res of group.subscribers) res.end();
    groups.clear();
  };
}

// src/index.ts
var inject = ["webServer", "workspaceRegistry"];
function apply(ctx) {
  const runner = createGitRunner();
  const service = new GitService(runner);
  let disposeRoutes;
  ctx.effect(() => {
    disposeRoutes = registerRoutes(ctx, service);
    return () => {
      disposeRoutes?.();
    };
  }, "dsh-plugin-git: routes");
}
export {
  apply,
  inject
};
//# sourceMappingURL=index.js.map
