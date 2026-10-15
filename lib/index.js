// src/host/git-runner.ts
import { spawn } from "node:child_process";
function createGitRunner() {
  const gitBin = process.platform === "win32" ? "git.exe" : "git";
  return {
    run(argv, cwd, signal) {
      return new Promise((resolve2, reject) => {
        let child;
        try {
          child = spawn(gitBin, argv, {
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
            signal
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
          resolve2({
            stdout: Buffer.concat(outChunks).toString("utf-8"),
            stderr: Buffer.concat(errChunks).toString("utf-8"),
            exitCode: code ?? 0
          });
        });
      });
    }
  };
}

// src/host/git-service.ts
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

// src/core/git-command.ts
function parseStatusV2(stdout, root) {
  let branch = "HEAD";
  let head = "";
  let dirtyFiles = 0;
  let untrackedFiles = 0;
  let conflicts = 0;
  const lines = stdout.split("\n");
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith("# branch.head ")) {
      branch = line.slice(14).trim();
      if (branch === "(detached)") branch = "HEAD";
    } else if (line.startsWith("# branch.oid ")) {
      head = line.slice(13).trim().slice(0, 7);
    } else if (line.startsWith("1 ") || line.startsWith("2 ")) {
      dirtyFiles++;
    } else if (line.startsWith("u ")) {
      conflicts++;
      dirtyFiles++;
    } else if (line.startsWith("? ")) {
      untrackedFiles++;
      dirtyFiles++;
    }
  }
  return {
    isGit: true,
    root,
    branch,
    head,
    dirtyFiles,
    untrackedFiles,
    conflicts,
    operationInProgress: false
  };
}
function parseBranches(stdout) {
  const branches = [];
  const lines = stdout.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const current = line.startsWith("*");
    const cleanLine = line.replace(/^[\*\+\s]+/, "").trim();
    if (!cleanLine || cleanLine.includes("->")) continue;
    const isRemote = cleanLine.startsWith("remotes/") || cleanLine.startsWith("origin/");
    const name = cleanLine.replace(/^remotes\//, "");
    branches.push({
      name,
      current,
      isRemote
    });
  }
  return branches.sort((a, b) => {
    if (a.current) return -1;
    if (b.current) return 1;
    if (!a.isRemote && b.isRemote) return -1;
    if (a.isRemote && !b.isRemote) return 1;
    return a.name.localeCompare(b.name);
  });
}
function parseUnifiedDiff(diffOutput, numstatOutput) {
  const numstatMap = /* @__PURE__ */ new Map();
  let totalIns = 0;
  let totalDel = 0;
  if (numstatOutput) {
    for (const line of numstatOutput.split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        const ins = parts[0] === "-" ? 0 : parseInt(parts[0], 10) || 0;
        const del = parts[1] === "-" ? 0 : parseInt(parts[1], 10) || 0;
        const filePath = parts.slice(2).join(" ");
        numstatMap.set(filePath, { ins, del });
        totalIns += ins;
        totalDel += del;
      }
    }
  }
  const files = [];
  const rawFileChunks = diffOutput.split(/^diff --git /m);
  for (const chunk of rawFileChunks) {
    if (!chunk.trim()) continue;
    const lines = chunk.split("\n");
    const headerLine = lines[0];
    const match = headerLine.match(/a\/(.+?)\s+b\/(.+)/);
    const filePath = match ? match[2] : lines.find((l) => l.startsWith("+++ b/"))?.slice(6) || "unknown";
    const oldPath = match ? match[1] : void 0;
    let status = "modified";
    if (chunk.includes("new file mode")) status = "added";
    else if (chunk.includes("deleted file mode")) status = "deleted";
    else if (chunk.includes("similarity index") && oldPath !== filePath) status = "renamed";
    const stat = numstatMap.get(filePath) || { ins: 0, del: 0 };
    const hunks = [];
    let currentHunk = null;
    let oldLine = 0;
    let newLine = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("@@ ")) {
        const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
        if (hunkMatch) {
          const oldStart = parseInt(hunkMatch[1], 10);
          const oldLines = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
          const newStart = parseInt(hunkMatch[3], 10);
          const newLines = hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1;
          oldLine = oldStart;
          newLine = newStart;
          currentHunk = {
            header: line,
            oldStart,
            oldLines,
            newStart,
            newLines,
            lines: []
          };
          hunks.push(currentHunk);
          continue;
        }
      }
      if (currentHunk) {
        if (line.startsWith("+")) {
          currentHunk.lines.push({
            type: "add",
            newNum: newLine++,
            content: line.slice(1)
          });
        } else if (line.startsWith("-")) {
          currentHunk.lines.push({
            type: "del",
            oldNum: oldLine++,
            content: line.slice(1)
          });
        } else if (line.startsWith(" ") || line === "") {
          currentHunk.lines.push({
            type: "normal",
            oldNum: oldLine++,
            newNum: newLine++,
            content: line.startsWith(" ") ? line.slice(1) : line
          });
        }
      }
    }
    files.push({
      path: filePath,
      oldPath,
      status,
      insertions: stat.ins,
      deletions: stat.del,
      hunks,
      rawPatch: chunk
    });
  }
  return {
    base: "HEAD",
    target: "working-tree",
    totalInsertions: totalIns,
    totalDeletions: totalDel,
    files
  };
}
function parseWorktrees(stdout, currentPath) {
  const items = [];
  const blocks = stdout.trim().split("\n\n");
  for (const block of blocks) {
    if (!block.trim()) continue;
    let path = "";
    let head = "";
    let branch = "";
    let locked = false;
    for (const line of block.split("\n")) {
      if (line.startsWith("worktree ")) path = line.slice(9).trim();
      else if (line.startsWith("HEAD ")) head = line.slice(5).trim().slice(0, 7);
      else if (line.startsWith("branch refs/heads/")) branch = line.slice(18).trim();
      else if (line === "locked") locked = true;
    }
    if (path) {
      items.push({
        path,
        head,
        branch: branch || "(detached)",
        isCurrent: path.toLowerCase() === currentPath.toLowerCase(),
        locked
      });
    }
  }
  return items;
}
function parseLog(stdout) {
  const commits = [];
  const lines = stdout.split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const [hash, shortHash, subject, author, date, parentsStr, refsStr] = line.split("|");
    if (hash && shortHash) {
      commits.push({
        hash,
        shortHash,
        subject: subject || "",
        author: author || "",
        date: date || "",
        parents: parentsStr ? parentsStr.split(" ") : [],
        refs: refsStr ? refsStr.split(",").map((s) => s.trim()).filter(Boolean) : []
      });
    }
  }
  return commits;
}

// src/host/git-service.ts
var GitService = class {
  constructor(runner) {
    this.runner = runner;
  }
  runner;
  /**
   * Check if a directory is inside a Git repository
   */
  async isGitRepo(cwd) {
    try {
      if (!cwd || typeof cwd !== "string") return false;
      const targetDir = resolve(cwd.trim().replace(/^["']|["']$/g, ""));
      if (!existsSync(targetDir)) return false;
      const result = await this.runner.run(["rev-parse", "--is-inside-work-tree"], targetDir);
      return result.exitCode === 0 && result.stdout.trim() === "true";
    } catch {
      return false;
    }
  }
  /**
   * Get the root directory of the Git repository
   */
  async getRepoRoot(cwd) {
    try {
      if (!cwd || typeof cwd !== "string") return null;
      const targetDir = resolve(cwd.trim().replace(/^["']|["']$/g, ""));
      const result = await this.runner.run(["rev-parse", "--show-toplevel"], targetDir);
      if (result.exitCode === 0 && result.stdout.trim()) {
        return resolve(result.stdout.trim());
      }
      return null;
    } catch {
      return null;
    }
  }
  /**
   * Get overall repository status. Returns isGit: false if not a repository.
   */
  async status(cwd) {
    const isGit = await this.isGitRepo(cwd);
    if (!isGit) {
      return {
        isGit: false,
        root: "",
        branch: "",
        head: "",
        dirtyFiles: 0,
        untrackedFiles: 0,
        conflicts: 0,
        operationInProgress: false
      };
    }
    const root = await this.getRepoRoot(cwd) || cwd;
    const res = await this.runner.run(["status", "--porcelain=v2", "--branch"], root);
    if (res.exitCode !== 0) {
      return {
        isGit: false,
        root,
        branch: "",
        head: "",
        dirtyFiles: 0,
        untrackedFiles: 0,
        conflicts: 0,
        operationInProgress: false
      };
    }
    const status = parseStatusV2(res.stdout, root);
    const gitDir = join(root, ".git");
    status.operationInProgress = existsSync(join(gitDir, "MERGE_HEAD")) || existsSync(join(gitDir, "rebase-merge")) || existsSync(join(gitDir, "rebase-apply")) || existsSync(join(gitDir, "CHERRY_PICK_HEAD"));
    return status;
  }
  /**
   * Get list of all branches
   */
  async branches(cwd) {
    const isGit = await this.isGitRepo(cwd);
    if (!isGit) {
      return { current: "", dirtyFiles: 0, branches: [] };
    }
    const root = await this.getRepoRoot(cwd) || cwd;
    const [branchRes, status] = await Promise.all([
      this.runner.run(["branch", "-a", "--no-color"], root),
      this.status(root)
    ]);
    const branches = parseBranches(branchRes.stdout);
    return {
      current: status.branch,
      dirtyFiles: status.dirtyFiles,
      branches
    };
  }
  /**
   * Switch / checkout a branch safely
   */
  async switchBranch(cwd, branch) {
    const isGit = await this.isGitRepo(cwd);
    if (!isGit) {
      return { ok: false, error: { code: "not-git", message: "Not a git repository" } };
    }
    const root = await this.getRepoRoot(cwd) || cwd;
    const cleanBranch = branch.replace(/^origin\//, "");
    const result = await this.runner.run(["switch", cleanBranch], root);
    if (result.exitCode === 0) {
      return { ok: true, branch: cleanBranch };
    }
    const checkoutResult = await this.runner.run(["checkout", cleanBranch], root);
    if (checkoutResult.exitCode === 0) {
      return { ok: true, branch: cleanBranch };
    }
    return {
      ok: false,
      error: {
        code: "switch-failed",
        message: checkoutResult.stderr.trim() || result.stderr.trim() || "Failed to switch branch"
      }
    };
  }
  /**
   * Create and switch to a new branch
   */
  async createBranch(cwd, name, base) {
    const isGit = await this.isGitRepo(cwd);
    if (!isGit) {
      return { ok: false, error: { code: "not-git", message: "Not a git repository" } };
    }
    const root = await this.getRepoRoot(cwd) || cwd;
    const args = ["checkout", "-b", name.trim()];
    if (base && base.trim()) {
      args.push(base.trim());
    }
    const result = await this.runner.run(args, root);
    if (result.exitCode === 0) {
      return { ok: true, branch: name.trim() };
    }
    return {
      ok: false,
      error: {
        code: "create-failed",
        message: result.stderr.trim() || "Failed to create branch"
      }
    };
  }
  /**
   * Get Diff view comparing base and target, or comparing working tree to HEAD
   */
  async diff(cwd, base, target) {
    const isGit = await this.isGitRepo(cwd);
    if (!isGit) {
      return { base: "", target: "", totalInsertions: 0, totalDeletions: 0, files: [] };
    }
    const root = await this.getRepoRoot(cwd) || cwd;
    let diffArgs;
    let numstatArgs;
    if (base && target) {
      diffArgs = ["diff", "-U3", `${base}...${target}`];
      numstatArgs = ["diff", "--numstat", `${base}...${target}`];
    } else if (base) {
      diffArgs = ["diff", "-U3", base];
      numstatArgs = ["diff", "--numstat", base];
    } else {
      diffArgs = ["diff", "-U3", "HEAD"];
      numstatArgs = ["diff", "--numstat", "HEAD"];
    }
    const [diffRes, numstatRes] = await Promise.all([
      this.runner.run(diffArgs, root),
      this.runner.run(numstatArgs, root)
    ]);
    const parsed = parseUnifiedDiff(diffRes.stdout, numstatRes.stdout);
    parsed.base = base || "HEAD";
    parsed.target = target || "working-tree";
    if (!target || target === "working-tree") {
      try {
        const statusRes = await this.runner.run(["status", "--porcelain=v2"], root);
        for (const line of statusRes.stdout.split("\n")) {
          if (line.startsWith("? ")) {
            const untrackedPath = line.slice(2).trim();
            try {
              const fullPath = join(root, untrackedPath);
              const content = await readFile(fullPath, "utf-8");
              const contentLines = content.split("\n");
              parsed.totalInsertions += contentLines.length;
              parsed.files.push({
                path: untrackedPath,
                status: "untracked",
                insertions: contentLines.length,
                deletions: 0,
                hunks: [
                  {
                    header: `@@ -0,0 +1,${contentLines.length} @@`,
                    oldStart: 0,
                    oldLines: 0,
                    newStart: 1,
                    newLines: contentLines.length,
                    lines: contentLines.map((l, idx) => ({
                      type: "add",
                      newNum: idx + 1,
                      content: l
                    }))
                  }
                ],
                rawPatch: content
              });
            } catch {
            }
          }
        }
      } catch {
      }
    }
    return parsed;
  }
  /**
   * List Git worktrees
   */
  async worktrees(cwd) {
    const isGit = await this.isGitRepo(cwd);
    if (!isGit) return [];
    const root = await this.getRepoRoot(cwd) || cwd;
    const res = await this.runner.run(["worktree", "list", "--porcelain"], root);
    if (res.exitCode !== 0) return [];
    return parseWorktrees(res.stdout, root);
  }
  /**
   * Create a new worktree
   */
  async createWorktree(cwd, name, baseBranch) {
    const root = await this.getRepoRoot(cwd) || cwd;
    const sanitizedName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "-").toLowerCase();
    const targetDir = resolve(root, "..", `.dsh-wt-${sanitizedName}`);
    const newBranch = `wt/${sanitizedName}`;
    const args = ["worktree", "add", "-b", newBranch, targetDir];
    if (baseBranch) args.push(baseBranch);
    const res = await this.runner.run(args, root);
    if (res.exitCode === 0) {
      return { ok: true, path: targetDir };
    }
    return { ok: false, error: res.stderr.trim() || "Failed to create worktree" };
  }
  /**
   * Remove a worktree
   */
  async removeWorktree(cwd, worktreePath) {
    const root = await this.getRepoRoot(cwd) || cwd;
    const res = await this.runner.run(["worktree", "remove", "--force", worktreePath], root);
    if (res.exitCode === 0) {
      return { ok: true };
    }
    return { ok: false, error: res.stderr.trim() || "Failed to remove worktree" };
  }
  /**
   * Get Git commit history for visual graph
   */
  async log(cwd, maxCount = 50) {
    const isGit = await this.isGitRepo(cwd);
    if (!isGit) return [];
    const root = await this.getRepoRoot(cwd) || cwd;
    const res = await this.runner.run(
      ["log", `-n${maxCount}`, "--format=%H|%h|%s|%an|%cr|%P|%D", "--no-color"],
      root
    );
    if (res.exitCode !== 0) return [];
    return parseLog(res.stdout);
  }
};

// src/host/routes.ts
function readJsonBody(req) {
  return new Promise((resolve2, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf-8");
        resolve2(text ? JSON.parse(text) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}
function writeJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store"
  });
  res.end(payload);
}
function registerRoutes(ctx, service) {
  const subscribers = /* @__PURE__ */ new Set();
  let heartbeatTimer;
  let pollTimer;
  const runPoll = async () => {
    for (const sub of subscribers) {
      try {
        const status = await service.status(sub.path);
        const key = `${status.isGit}|${status.branch}|${status.head}|${status.dirtyFiles}`;
        if (key !== sub.last) {
          sub.last = key;
          sub.res.write(`event: status
data: ${JSON.stringify(status)}

`);
        }
      } catch {
      }
    }
  };
  const sseHandler = (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.searchParams.get("path") || "";
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });
    res.write(": connected\n\n");
    const sub = { path, last: "", res };
    subscribers.add(sub);
    service.status(path).then((status) => {
      sub.last = `${status.isGit}|${status.branch}|${status.head}|${status.dirtyFiles}`;
      sub.res.write(`event: status
data: ${JSON.stringify(status)}

`);
    }).catch(() => {
    });
    if (!heartbeatTimer) {
      heartbeatTimer = setInterval(() => {
        for (const s of subscribers) s.res.write(": ping\n\n");
      }, 15e3);
    }
    if (!pollTimer) {
      pollTimer = setInterval(runPoll, 1e4);
    }
    req.on("close", () => {
      subscribers.delete(sub);
      if (subscribers.size === 0) {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = void 0;
        }
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = void 0;
        }
      }
    });
  };
  const apiHandler = async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = url.pathname;
    if (pathname === "/dsh-git/events") {
      return sseHandler(req, res);
    }
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end("Method Not Allowed");
      return;
    }
    let payload = {};
    try {
      payload = await readJsonBody(req);
    } catch {
      writeJson(res, 400, { ok: false, error: "Invalid JSON" });
      return;
    }
    let path = payload.path;
    if (!path || typeof path !== "string") {
      const list = ctx.workspaceRegistry?.list?.() || [];
      if (list.length > 0 && list[0]?.path) {
        path = list[0].path;
      }
    }
    if (!path && pathname !== "/dsh-git/health") {
      writeJson(res, 400, { ok: false, error: "Path is required" });
      return;
    }
    try {
      switch (pathname) {
        case "/dsh-git/status": {
          const status = await service.status(path);
          writeJson(res, 200, { ok: true, value: status });
          return;
        }
        case "/dsh-git/branches": {
          const branches = await service.branches(path);
          writeJson(res, 200, { ok: true, value: branches });
          return;
        }
        case "/dsh-git/switch": {
          const result = await service.switchBranch(path, payload.branch);
          writeJson(res, 200, result);
          return;
        }
        case "/dsh-git/create-branch": {
          const result = await service.createBranch(path, payload.name, payload.base);
          writeJson(res, 200, result);
          return;
        }
        case "/dsh-git/diff": {
          const diff = await service.diff(path, payload.base, payload.target);
          writeJson(res, 200, { ok: true, value: diff });
          return;
        }
        case "/dsh-git/worktrees": {
          const list = await service.worktrees(path);
          writeJson(res, 200, { ok: true, value: list });
          return;
        }
        case "/dsh-git/create-worktree": {
          const result = await service.createWorktree(path, payload.name, payload.base);
          writeJson(res, 200, result);
          return;
        }
        case "/dsh-git/remove-worktree": {
          const result = await service.removeWorktree(path, payload.worktreePath);
          writeJson(res, 200, result);
          return;
        }
        case "/dsh-git/log": {
          const list = await service.log(path, payload.limit);
          writeJson(res, 200, { ok: true, value: list });
          return;
        }
        default:
          writeJson(res, 404, { ok: false, error: "Not found" });
      }
    } catch (err) {
      writeJson(res, 500, { ok: false, error: err?.message || "Internal Error" });
    }
  };
  const disposers = [];
  if (ctx.webServer && typeof ctx.webServer.register === "function") {
    disposers.push(
      ctx.webServer.register({ kind: "prefix", path: "/dsh-git", handler: apiHandler })
    );
  }
  return () => {
    for (const d of disposers) d();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (pollTimer) clearInterval(pollTimer);
    for (const sub of subscribers) sub.res.end();
    subscribers.clear();
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
