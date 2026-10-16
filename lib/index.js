// src/host/git-runner.ts
import { spawn } from "node:child_process";
function createGitRunner() {
  const gitBin = process.platform === "win32" ? "git.exe" : "git";
  return {
    run(argv, cwd, signal, options) {
      return new Promise((resolve3, reject) => {
        let child;
        const stdin = options?.stdin;
        try {
          child = spawn(gitBin, argv, {
            cwd,
            stdio: [stdin === void 0 ? "ignore" : "pipe", "pipe", "pipe"],
            windowsHide: true,
            signal,
            env: {
              ...process.env,
              GIT_TERMINAL_PROMPT: "0",
              // `cherry-pick --continue` and friends open an editor. There is no terminal
              // here, so accept the prepared message instead of hanging on one.
              GIT_EDITOR: "true",
              GIT_SEQUENCE_EDITOR: "true",
              GIT_PAGER: "cat"
            }
          });
        } catch (err) {
          return reject(err);
        }
        const outChunks = [];
        const errChunks = [];
        let timedOut = false;
        const timer = options?.timeoutMs ? setTimeout(() => {
          timedOut = true;
          child.kill();
        }, options.timeoutMs) : void 0;
        if (timer && typeof timer === "object" && "unref" in timer) timer.unref();
        child.stdin?.on("error", (err) => {
          const code = err.code;
          if (code !== "EPIPE" && code !== "EOF") {
            if (timer) clearTimeout(timer);
            reject(err);
          }
        });
        if (stdin !== void 0) child.stdin?.end(stdin);
        child.stdout?.on("data", (chunk) => outChunks.push(Buffer.from(chunk)));
        child.stderr?.on("data", (chunk) => errChunks.push(Buffer.from(chunk)));
        child.on("error", (err) => {
          if (timer) clearTimeout(timer);
          reject(err);
        });
        child.on("close", (code) => {
          if (timer) clearTimeout(timer);
          resolve3({
            stdout: Buffer.concat(outChunks).toString("utf-8"),
            stderr: timedOut ? `${Buffer.concat(errChunks).toString("utf-8")}
\u64CD\u4F5C\u8D85\u65F6\uFF0C\u5DF2\u4E2D\u6B62\uFF08\u53EF\u80FD\u662F\u8FDC\u7A0B\u4E0D\u53EF\u8FBE\u6216\u9700\u8981\u51ED\u636E\uFF09`.trim() : Buffer.concat(errChunks).toString("utf-8"),
            // A signal-terminated child is never a successful Git command.
            exitCode: code ?? -1
          });
        });
      });
    }
  };
}

// src/host/git-service.ts
import { readFile, readlink, lstat, rm, appendFile, mkdir, realpath } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

// src/core/git-command.ts
import { posix, win32 } from "node:path";
function applyAheadBehind(status, value) {
  const match = value.match(/^\+(\d+)\s+-(\d+)$/);
  if (!match) return;
  status.ahead = Number(match[1]);
  status.behind = Number(match[2]);
}
function parseStatusV2(stdout, root) {
  const status = { isGit: true, root, branch: "HEAD", head: "", dirtyFiles: 0, untrackedFiles: 0, conflicts: 0, operationInProgress: false, stashCount: 0, detached: false, operation: null, entries: [] };
  const nul = stdout.includes("\0");
  const records = stdout.split(nul ? "\0" : "\n");
  for (let i = 0; i < records.length; i++) {
    const line = records[i];
    if (line.startsWith("# branch.head ")) {
      const name = line.slice(14);
      status.detached = name === "(detached)";
      status.branch = status.detached ? "HEAD" : name;
    } else if (line.startsWith("# branch.oid ")) status.head = line.slice(13) === "(initial)" ? "" : line.slice(13, 20);
    else if (line.startsWith("# branch.upstream ")) status.upstream = line.slice(18);
    else if (line.startsWith("# branch.ab ")) applyAheadBehind(status, line.slice(12));
    else if (line.startsWith("# stash ")) status.stashCount = Number(line.slice(8)) || 0;
    else if (/^[12u?] /.test(line)) {
      status.dirtyFiles++;
      const entry = parseStatusEntry(line);
      if (entry) {
        if (entry.untracked) status.untrackedFiles++;
        if (entry.conflict) status.conflicts++;
        if (line.startsWith("2 ") && nul) {
          entry.origPath = records[i + 1] || void 0;
          i++;
        }
        status.entries.push(entry);
      }
    }
  }
  return status;
}
function parseStatusEntry(line) {
  if (line.startsWith("? ")) return { path: line.slice(2), index: "?", worktree: "?", conflict: false, untracked: true };
  if (line.startsWith("u ")) {
    const parts = line.split(" ");
    const xy = parts[1] || "";
    return { path: parts.slice(10).join(" "), index: xy[0] || "U", worktree: xy[1] || "U", conflict: true, untracked: false };
  }
  if (line.startsWith("1 ") || line.startsWith("2 ")) {
    const parts = line.split(" ");
    const xy = parts[1] || "";
    const path = parts.slice(line.startsWith("2 ") ? 9 : 8).join(" ");
    return { path, index: xy[0] || ".", worktree: xy[1] || ".", conflict: false, untracked: false };
  }
  return null;
}
function parseOperation(existing) {
  const has = (name) => existing.includes(name);
  if (has("rebase-apply")) return has("applying") ? "am" : "rebase";
  if (has("rebase-merge")) return "rebase";
  if (has("MERGE_HEAD")) return "merge";
  if (has("CHERRY_PICK_HEAD")) return "cherry-pick";
  if (has("REVERT_HEAD")) return "revert";
  if (has("BISECT_LOG")) return "bisect";
  if (has("sequencer")) return "cherry-pick";
  return null;
}
function parseForEachRefBranches(stdout, head) {
  const items = [];
  for (const record of stdout.split("\n")) {
    if (!record.trim()) continue;
    const [refname, hash, upstream, track, headMark, subject] = record.split("\0");
    if (!refname) continue;
    const isRemote = refname.startsWith("refs/remotes/");
    if (isRemote && refname.endsWith("/HEAD")) continue;
    const name = isRemote ? refname.slice("refs/remotes/".length) : refname.slice("refs/heads/".length);
    const item = {
      name,
      current: !isRemote && !!headMark?.trim(),
      isRemote,
      upstream: upstream || void 0,
      subject: subject || void 0,
      hash: hash || void 0
    };
    if (upstream) {
      const ahead = track?.match(/ahead (\d+)/);
      const behind = track?.match(/behind (\d+)/);
      item.ahead = ahead ? Number(ahead[1]) : 0;
      item.behind = behind ? Number(behind[1]) : 0;
      if (track?.includes("gone")) item.upstream = `${upstream} (\u5DF2\u5220\u9664)`;
    }
    items.push(item);
  }
  return items.sort((a, b) => Number(b.current) - Number(a.current) || Number(a.isRemote) - Number(b.isRemote) || a.name.localeCompare(b.name));
}
function parseBranches(stdout) {
  return stdout.split("\n").map((line) => line.trim()).filter((line) => line && !line.includes("->")).map((line) => {
    const name = line.replace(/^[*+\s]+/, "").replace(/^remotes\//, "");
    const ab = line.match(/\[(?:ahead (\d+))?(?:, )?(?:behind (\d+))?\]/);
    return {
      name,
      current: line.startsWith("*"),
      isRemote: line.replace(/^[*+\s]+/, "").startsWith("remotes/"),
      ahead: ab?.[1] ? Number(ab[1]) : void 0,
      behind: ab?.[2] ? Number(ab[2]) : void 0
    };
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
function parseNumstat(numstatOutput) {
  const stats = /* @__PURE__ */ new Map();
  const put = (insertions, deletions, path) => {
    if (!path) return;
    const binary = insertions === "-" || deletions === "-";
    stats.set(path, { insertions: binary ? 0 : Number(insertions) || 0, deletions: binary ? 0 : Number(deletions) || 0, binary });
  };
  if (numstatOutput.includes("\0")) {
    const records = numstatOutput.split("\0");
    for (let i = 0; i < records.length; i++) {
      const match = records[i].match(/^([^\t]+)\t([^\t]+)\t(.*)$/s);
      if (!match) continue;
      let path = match[3];
      if (!path) {
        i++;
        path = records[++i] ?? "";
      }
      put(match[1], match[2], path);
    }
  } else {
    for (const line of numstatOutput.split("\n")) {
      const match = line.match(/^([^\t]+)\t([^\t]+)\t(.*)$/);
      if (!match) continue;
      const path = decodeGitPath(match[3]).replace(/\{[^{}]* => ([^{}]*)\}/, "$1").replace(/^.* => /, "");
      put(match[1], match[2], path);
    }
  }
  return stats;
}
function parseUnifiedDiff(diffOutput, numstatOutput = "") {
  const stats = parseNumstat(numstatOutput);
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
    const stat = stats.get(path) ?? { insertions: ins, deletions: del, binary: false };
    const binary = hunks.length === 0 && /^(Binary files |GIT binary patch)/m.test(chunk);
    files.push({ path, oldPath: oldPath || void 0, status, insertions: stat.insertions, deletions: stat.deletions, hunks, rawPatch: chunk, binary: binary || stat.binary });
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
function parseReflog(stdout) {
  const fields = stdout.split("\0");
  const entries = [];
  for (let i = 0; i + 4 < fields.length; i += 5) {
    const [hash, shortHash, selector, subject, date] = fields.slice(i, i + 5);
    if (!hash || !selector) continue;
    const action = subject?.match(/^([a-z][a-z-]*)/)?.[1] ?? "";
    entries.push({ hash, shortHash, selector, subject: subject || "", date: date || "", action });
  }
  return entries;
}
function parseStashList(stdout) {
  const fields = stdout.split("\0");
  const entries = [];
  for (let i = 0; i + 4 < fields.length; i += 5) {
    const [selector, hash, shortHash, subject, date] = fields.slice(i, i + 5);
    if (!selector || !hash) continue;
    const index = Number(selector.match(/^stash@\{(\d+)\}$/)?.[1] ?? entries.length);
    const branch = subject.match(/^(?:WIP on|On) ([^:]+):/)?.[1];
    entries.push({ index, selector, hash, shortHash, subject: subject || "", branch: branch || void 0, date: date || "" });
  }
  return entries;
}
function parseTags(stdout) {
  const tags = [];
  for (const record of stdout.split("\n")) {
    if (!record.trim()) continue;
    const [name, hash, objectType, peeled, subject, date] = record.split("\0");
    if (!name) continue;
    const annotated = objectType === "tag";
    tags.push({
      name,
      hash: annotated && peeled ? peeled : hash,
      annotated,
      // An annotated tag carries its own message; a lightweight tag shows the commit subject.
      subject: subject || void 0,
      date: date || void 0
    });
  }
  return tags;
}
function parseBlamePorcelain(stdout) {
  const lines = [];
  let current;
  for (const raw of stdout.split("\n")) {
    const header = raw.match(/^([0-9a-f]{7,64}) \d+ (\d+)(?: (\d+))?$/);
    if (header) {
      current = {
        lineNumber: Number(header[2]),
        hash: header[1],
        shortHash: header[1].slice(0, 7),
        author: current?.author ?? "",
        authorEmail: current?.authorEmail ?? "",
        date: current?.date ?? "",
        summary: current?.summary ?? "",
        content: "",
        uncommitted: /^0{7,}$/.test(header[1])
      };
      lines.push(current);
      continue;
    }
    if (!current) continue;
    if (raw.startsWith("	")) {
      current.content = raw.slice(1);
      continue;
    }
    if (raw.startsWith("author ")) current.author = raw.slice(7);
    else if (raw.startsWith("author-mail ")) current.authorEmail = raw.slice(12).replace(/^<|>$/g, "");
    else if (raw.startsWith("author-time ")) {
      const seconds = Number(raw.slice(12));
      current.date = Number.isFinite(seconds) ? new Date(seconds * 1e3).toISOString() : "";
    } else if (raw.startsWith("author-tz ")) {
      current.date = applyTimezone(current.date, raw.slice(10));
    } else if (raw.startsWith("summary ")) current.summary = raw.slice(8);
  }
  return lines;
}
function applyTimezone(iso, zone) {
  const match = zone.match(/^([+-])(\d{2})(\d{2})$/);
  if (!iso || !match) return iso;
  const instant = new Date(iso).getTime();
  if (!Number.isFinite(instant)) return iso;
  const offsetMinutes = (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "-" ? -1 : 1);
  const shifted = new Date(instant + offsetMinutes * 6e4).toISOString().slice(0, 19);
  return `${shifted}${match[1]}${match[2]}:${match[3]}`;
}
function parseNameStatus(stdout) {
  const records = stdout.split("\0").filter((value, index, all) => value !== "" || index < all.length - 1);
  const files = [];
  for (let i = 0; i < records.length; i++) {
    const code = records[i];
    if (!/^[A-Z]\d*$/.test(code)) continue;
    const letter = code[0];
    const status = letter === "A" ? "added" : letter === "D" ? "deleted" : letter === "R" ? "renamed" : letter === "C" ? "copied" : letter === "T" ? "typechange" : letter === "M" ? "modified" : "unknown";
    if (letter === "R" || letter === "C") {
      const oldPath = records[++i];
      const path = records[++i];
      if (path) files.push({ path, oldPath: oldPath || void 0, status });
    } else {
      const path = records[++i];
      if (path) files.push({ path, status });
    }
  }
  return files;
}
function mergeCommitFiles(entries, numstat) {
  const stats = parseNumstat(numstat);
  return entries.map((entry) => ({ ...entry, insertions: stats.get(entry.path)?.insertions ?? 0, deletions: stats.get(entry.path)?.deletions ?? 0 }));
}
function parseFileHistory(stdout) {
  const fields = stdout.split("\0");
  const entries = [];
  for (let i = 0; i + 4 < fields.length; i += 5) {
    const [hash, shortHash, subject, author, date] = fields.slice(i, i + 5);
    if (!hash || !shortHash) continue;
    entries.push({ hash, shortHash, subject, author, date });
  }
  return entries;
}

// src/core/changes.ts
var SECTION_ORDER = { conflict: 0, staged: 1, unstaged: 2, untracked: 3 };
function letterStatus(letter) {
  if (letter === "A") return "added";
  if (letter === "D") return "deleted";
  if (letter === "R" || letter === "C") return "renamed";
  return "modified";
}
function buildChangeList(input) {
  const stagedStats = parseNumstat(input.stagedNumstat);
  const worktreeStats = parseNumstat(input.worktreeNumstat);
  const entries = [];
  for (const entry of input.entries) {
    if (entry.conflict) {
      entries.push({
        path: entry.path,
        origPath: entry.origPath,
        section: "conflict",
        status: "conflict",
        insertions: 0,
        deletions: 0,
        code: `${entry.index}${entry.worktree}`
      });
      continue;
    }
    if (entry.untracked) {
      const counts = input.untracked.get(entry.path) ?? { insertions: 0, deletions: 0, binary: false };
      entries.push({
        path: entry.path,
        section: "untracked",
        status: "untracked",
        insertions: counts.insertions,
        deletions: counts.deletions,
        binary: counts.binary || void 0,
        code: "?"
      });
      continue;
    }
    if (entry.index !== ".") {
      const stat = stagedStats.get(entry.path);
      entries.push({
        path: entry.path,
        origPath: entry.origPath,
        section: "staged",
        status: letterStatus(entry.index),
        insertions: stat?.insertions ?? 0,
        deletions: stat?.deletions ?? 0,
        binary: stat?.binary || void 0,
        code: entry.index
      });
    }
    if (entry.worktree !== ".") {
      const stat = worktreeStats.get(entry.path);
      entries.push({
        path: entry.path,
        section: "unstaged",
        status: letterStatus(entry.worktree),
        insertions: stat?.insertions ?? 0,
        deletions: stat?.deletions ?? 0,
        binary: stat?.binary || void 0,
        code: entry.worktree
      });
    }
  }
  entries.sort((a, b) => SECTION_ORDER[a.section] - SECTION_ORDER[b.section] || a.path.localeCompare(b.path));
  return {
    entries,
    staged: entries.filter((entry) => entry.section === "staged").length,
    unstaged: entries.filter((entry) => entry.section === "unstaged").length,
    conflicts: entries.filter((entry) => entry.section === "conflict").length,
    untracked: entries.filter((entry) => entry.section === "untracked").length,
    totalInsertions: entries.reduce((total, entry) => total + entry.insertions, 0),
    totalDeletions: entries.reduce((total, entry) => total + entry.deletions, 0)
  };
}
function parseConflictContent(content) {
  const lines = [];
  let state = "normal";
  let hasMarkers = false;
  for (const raw of content.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line.startsWith("<<<<<<< ")) {
      hasMarkers = true;
      state = "ours";
      lines.push({ type: "marker", content: line });
      continue;
    }
    if (line.startsWith("||||||| ")) {
      state = "base";
      lines.push({ type: "marker", content: line });
      continue;
    }
    if (line === "=======") {
      state = "theirs";
      lines.push({ type: "marker", content: line });
      continue;
    }
    if (line.startsWith(">>>>>>> ")) {
      state = "normal";
      lines.push({ type: "marker", content: line });
      continue;
    }
    lines.push({ type: state, content: line });
  }
  if (lines.length > 0 && lines[lines.length - 1].content === "" && content.endsWith("\n")) lines.pop();
  return { hasMarkers, lines };
}

// src/host/git-service.ts
var NETWORK_TIMEOUT_MS = 18e4;
var MAX_UNTRACKED_READ = 2e6;
var MAX_PATCH_BYTES = 4e6;
var MAX_BLOB_BYTES = 8e6;
var BLOB_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
  svg: "image/svg+xml"
};
function blobType(path) {
  const name = path.split("/").pop() ?? path;
  const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  return BLOB_TYPES[extension] ?? "application/octet-stream";
}
function message(error) {
  return error instanceof Error ? error.message : String(error);
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
var GitService = class {
  constructor(runner) {
    this.runner = runner;
  }
  runner;
  /**
   * Content digests of dirty files, keyed by the path's stat signature. Polling
   * reuses a digest while the signature is unchanged, so a 3s SSE tick stops
   * re-reading every dirty file while still noticing an edit that keeps size and
   * mtime (the signature includes the change time and the inode).
   */
  digests = /* @__PURE__ */ new Map();
  // ---------------------------------------------------------------- internals
  checked(result, operation) {
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `${operation} failed (exit ${result.exitCode})`);
    return result;
  }
  safeRef(value) {
    if (typeof value !== "string" || !value || value.startsWith("-") || /[\s\x00-\x1f\x7f]/.test(value)) throw new Error("Invalid Git reference");
    return value;
  }
  /** Resolves a ref-ish string (branch, tag, `HEAD~2`, hash) to a full commit id. */
  async resolveCommit(root, value) {
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
  async refName(root, name, prefix) {
    this.safeRef(name);
    this.checked(await this.runner.run(["check-ref-format", `${prefix}${name}`], root), "Validate reference name");
    return name;
  }
  /** Repository root, or a throw for callers whose operation only makes sense inside one. */
  async requireRepo(cwd) {
    const root = await this.getRepoRoot(cwd);
    if (!root) throw new Error("\u5F53\u524D\u76EE\u5F55\u4E0D\u662F Git \u4ED3\u5E93");
    return root;
  }
  /**
   * A repository-relative path, validated. Git commands that take paths use `--`,
   * but a value like `../../elsewhere` would still reach outside the worktree.
   */
  repoPath(root, value) {
    if (typeof value !== "string" || !value) throw new Error("Invalid path");
    if (/[\0\r\n]/.test(value)) throw new Error("Invalid path");
    const normalized = value.replace(/\\/g, "/");
    if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) throw new Error("\u8DEF\u5F84\u5FC5\u987B\u662F\u4ED3\u5E93\u5185\u7684\u76F8\u5BF9\u8DEF\u5F84");
    const resolved = resolve(root, normalized);
    const rel = relative(root, resolved);
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("\u8DEF\u5F84\u8D85\u51FA\u4ED3\u5E93\u8303\u56F4");
    return rel.replace(/\\/g, "/");
  }
  /** File-list requests name literal files, never Git wildcard/pathspec patterns. */
  literalPathspec(path) {
    return `:(literal)${path}`;
  }
  /** The paths Git actually knows about, so a request cannot name an arbitrary file. */
  async knownPaths(root) {
    const [tracked, untracked] = await Promise.all([
      this.runner.run(["ls-files", "-z"], root),
      this.runner.run(["ls-files", "--others", "--exclude-standard", "-z"], root)
    ]);
    return {
      tracked: new Set(tracked.stdout.split("\0").filter(Boolean)),
      untracked: new Set(untracked.stdout.split("\0").filter(Boolean))
    };
  }
  async assertPaths(root, values, allowUntracked) {
    if (!Array.isArray(values) || values.length === 0) throw new Error("\u672A\u9009\u62E9\u4EFB\u4F55\u6587\u4EF6");
    if (values.length > 2e3) throw new Error("\u4E00\u6B21\u64CD\u4F5C\u7684\u6587\u4EF6\u8FC7\u591A");
    const paths = values.map((value) => this.repoPath(root, String(value)));
    const known = await this.knownPaths(root);
    for (const path of paths) {
      if (known.tracked.has(path)) continue;
      if (allowUntracked && known.untracked.has(path)) continue;
      throw new Error(`Git \u4E0D\u8BA4\u8BC6\u8FD9\u4E2A\u8DEF\u5F84\uFF1A${path}`);
    }
    return [...new Set(paths)];
  }
  async gitDir(root) {
    return this.checked(await this.runner.run(["rev-parse", "--absolute-git-dir"], root), "Resolve git directory").stdout.trim();
  }
  /** Runs a mutating command and reports Git's own message instead of throwing. */
  async action(args, root, options = {}) {
    const result = await this.runner.run(args, root, void 0, { timeoutMs: options.timeoutMs, stdin: options.stdin });
    if (result.exitCode === 0) return { ok: true, output: result.stdout.trim() || void 0 };
    return { ok: false, error: result.stderr.trim() || result.stdout.trim() || `git ${args[0]} \u5931\u8D25\uFF08\u9000\u51FA\u7801 ${result.exitCode}\uFF09` };
  }
  /** Wraps a mutation so a validation failure becomes a reported error, not a throw. */
  async guarded(run) {
    try {
      return await run();
    } catch (error) {
      return { ok: false, error: message(error) };
    }
  }
  // ------------------------------------------------------------------- reads
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
    if (!await this.isGitRepo(cwd)) return { isGit: false, root: "", branch: "", head: "", dirtyFiles: 0, untrackedFiles: 0, conflicts: 0, operationInProgress: false, stashCount: 0, detached: false, operation: null, entries: [], revision: "not-git" };
    const root = await this.getRepoRoot(cwd) || cwd;
    const result = this.checked(await this.runner.run(["status", "--porcelain=v2", "--branch", "-z", "--untracked-files=all"], root), "Status");
    const status = parseStatusV2(result.stdout, root);
    const gitDir = await this.gitDir(root);
    const markers = ["MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD", "REVERT_HEAD", "sequencer", "BISECT_LOG", "applying"];
    const activeMarkers = markers.filter((marker) => existsSync(join(gitDir, marker)));
    status.operation = parseOperation(activeMarkers);
    status.operationInProgress = status.operation !== null;
    const hash = createHash("sha256").update(result.stdout).update(JSON.stringify(activeMarkers));
    const paths = this.checked(await this.runner.run(["ls-files", "-z", "--modified", "--deleted", "--others", "--exclude-standard"], root), "List files");
    const dirtyPaths = [...new Set(paths.stdout.split("\0").filter(Boolean))].sort();
    for (const path of dirtyPaths) hash.update(JSON.stringify(path)).update(await this.fileDigest(root, path));
    for (const stale of [...this.digests.keys()]) if (!dirtyPaths.includes(stale)) this.digests.delete(stale);
    const index = this.checked(await this.runner.run(["ls-files", "--stage", "-z"], root), "Read index");
    hash.update(index.stdout);
    const refs = this.checked(await this.runner.run(["for-each-ref", "--format=%(refname)%00%(objectname)%00%(upstream)", "refs/heads", "refs/remotes"], root), "Read refs");
    hash.update(refs.stdout);
    const worktrees = this.checked(await this.runner.run(["worktree", "list", "--porcelain", "-z"], root), "List worktrees");
    hash.update(worktrees.stdout);
    status.revision = hash.digest("hex");
    return status;
  }
  /** Content-sensitive digest, memoized on the file's stat signature. */
  async fileDigest(root, path) {
    const fullPath = join(root, path);
    try {
      const info = await lstat(fullPath, { bigint: true });
      const signature = `${info.mode}:${info.size}:${info.mtimeNs}:${info.ctimeNs}:${info.ino}`;
      const cached = this.digests.get(path);
      if (cached?.signature === signature) return cached.digest;
      const hash = createHash("sha256").update(signature);
      if (info.isSymbolicLink()) hash.update(await readlink(fullPath));
      else if (info.isFile()) hash.update(await readFile(fullPath));
      const digest = hash.digest("hex");
      if (this.digests.size < 5e3) this.digests.set(path, { signature, digest });
      return digest;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return "missing";
    }
  }
  async branches(cwd) {
    if (!await this.isGitRepo(cwd)) return { current: "", dirtyFiles: 0, branches: [] };
    const root = await this.getRepoRoot(cwd) || cwd;
    const [result, status] = await Promise.all([
      this.runner.run(["for-each-ref", "--format=%(refname)%00%(objectname)%00%(upstream:short)%00%(upstream:track)%00%(HEAD)%00%(contents:subject)", "refs/heads", "refs/remotes"], root),
      this.status(root)
    ]);
    if (result.exitCode !== 0) {
      const plain = this.checked(await this.runner.run(["branch", "-a", "--no-color"], root), "List branches");
      return { current: status.branch, dirtyFiles: status.dirtyFiles, branches: parseBranches(plain.stdout) };
    }
    return { current: status.branch, dirtyFiles: status.dirtyFiles, branches: parseForEachRefBranches(result.stdout, status.branch) };
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
      return { ok: false, error: { code: "switch-failed", message: message(error) } };
    }
  }
  async createBranch(cwd, name, base) {
    if (!await this.isGitRepo(cwd)) return { ok: false, error: { code: "not-git", message: "Not a git repository" } };
    const root = await this.getRepoRoot(cwd) || cwd;
    try {
      await this.branchName(root, name);
      const args = ["switch", "-c", name];
      if (base !== void 0 && base !== "") args.push(await this.resolveCommit(root, base));
      const result = await this.runner.run(args, root);
      return result.exitCode === 0 ? { ok: true, branch: name } : { ok: false, error: { code: "create-failed", message: result.stderr.trim() || "Failed to create branch" } };
    } catch (error) {
      return { ok: false, error: { code: "create-failed", message: message(error) } };
    }
  }
  /** Deletes a local branch. `force` maps to `-D`, which discards unmerged commits. */
  async deleteBranch(cwd, name, force = false) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      await this.branchName(root, name);
      const current = (await this.status(root)).branch;
      if (current === name) return { ok: false, error: "\u4E0D\u80FD\u5220\u9664\u5F53\u524D\u6240\u5728\u7684\u5206\u652F" };
      return this.action(["branch", force ? "-D" : "-d", "--", name], root);
    });
  }
  async diff(cwd, base, target, options = {}) {
    if (!await this.isGitRepo(cwd)) return { base: "", target: "", totalInsertions: 0, totalDeletions: 0, files: [] };
    const root = await this.getRepoRoot(cwd) || cwd;
    const context = clamp(Number.isFinite(options.context) ? Number(options.context) : 3, 0, 50);
    const common = ["--no-ext-diff", "--no-textconv", "--no-color", "--src-prefix=a/", "--dst-prefix=b/"];
    if (options.ignoreWhitespace) common.push("-w");
    const paths = options.paths?.length ? options.paths.map((path) => this.repoPath(root, path)) : [];
    const mode = options.mode ?? (target && target !== "working-tree" ? "range" : "worktree");
    let label;
    let revisions;
    let includeUntracked = false;
    if (mode === "single") {
      const hash = await this.resolveCommit(root, target || base || "HEAD");
      revisions = [`${hash}^!`];
      label = { base: `${hash.slice(0, 7)}^`, target: hash };
    } else if (mode === "range") {
      const baseHash = await this.resolveCommit(root, base && base !== "HEAD" ? base : "HEAD");
      const targetHash = await this.resolveCommit(root, target);
      revisions = [`${baseHash}...${targetHash}`];
      label = { base: base || "HEAD", target };
    } else if (mode === "staged") {
      revisions = ["--cached", await this.headOrEmptyTree(root)];
      label = { base: "HEAD", target: "index" };
    } else if (mode === "unstaged") {
      revisions = [];
      label = { base: "index", target: "working-tree" };
      includeUntracked = options.includeUntracked !== false && paths.length === 0;
    } else {
      const defaultComparison = base === void 0 || base === "" || base === "HEAD";
      const revision = defaultComparison ? await this.headOrEmptyTree(root) : await this.resolveCommit(root, base);
      revisions = [revision];
      label = { base: base || "HEAD", target: "working-tree" };
      includeUntracked = options.includeUntracked !== false && defaultComparison && paths.length === 0;
    }
    const pathspec = ["--", ...paths.map((path) => this.literalPathspec(path))];
    const [patch, stats] = await Promise.all([
      this.runner.run(["diff", ...common, `-U${context}`, ...revisions, ...pathspec], root),
      this.runner.run(["diff", ...common, "--numstat", "-z", ...revisions, ...pathspec], root)
    ]);
    this.checked(patch, "Diff");
    const parsed = parseUnifiedDiff(patch.stdout, stats.exitCode === 0 ? stats.stdout : "");
    parsed.base = label.base;
    parsed.target = label.target;
    if (includeUntracked) await this.appendUntracked(root, parsed, paths);
    return parsed;
  }
  /** HEAD's commit, or the empty tree when the branch has no commit yet. */
  async headOrEmptyTree(root) {
    const head = await this.runner.run(["rev-parse", "--verify", "--end-of-options", "HEAD^{commit}"], root);
    if (head.exitCode === 0) return head.stdout.trim();
    return this.checked(await this.runner.run(["hash-object", "-t", "tree", "--stdin"], root), "Empty tree").stdout.trim();
  }
  async appendUntracked(root, parsed, paths) {
    const listed = this.checked(await this.runner.run(["ls-files", "--others", "--exclude-standard", "-z"], root), "List untracked files");
    const wanted = new Set(paths);
    for (const path of listed.stdout.split("\0").filter(Boolean)) {
      if (wanted.size > 0 && !wanted.has(path)) continue;
      const fullPath = join(root, path);
      const info = await lstat(fullPath);
      if (!info.isFile() && !info.isSymbolicLink()) continue;
      if (info.size > MAX_UNTRACKED_READ) {
        parsed.files.push({ path, status: "untracked", insertions: 0, deletions: 0, binary: true, hunks: [], rawPatch: `Binary file ${path}
` });
        continue;
      }
      const bytes = info.isSymbolicLink() ? Buffer.from(await readlink(fullPath)) : await readFile(fullPath);
      const binary = bytes.subarray(0, 8e3).includes(0);
      const content = bytes.toString("utf8");
      const lines = binary || bytes.length === 0 ? [] : content.replace(/\n$/, "").split("\n");
      const count = lines.length;
      parsed.totalInsertions += count;
      parsed.files.push({
        path,
        status: "untracked",
        insertions: count,
        deletions: 0,
        binary,
        hunks: count ? [{ header: `@@ -0,0 +1,${count} @@`, oldStart: 0, oldLines: 0, newStart: 1, newLines: count, lines: lines.map((content2, index) => ({ type: "add", newNum: index + 1, content: content2 })) }] : [],
        rawPatch: binary ? `Binary file ${path}
` : content
      });
    }
  }
  /** The four lists the changes panel renders, with per-file line counts. */
  async changes(cwd) {
    const empty = { entries: [], staged: 0, unstaged: 0, conflicts: 0, untracked: 0, totalInsertions: 0, totalDeletions: 0 };
    if (!await this.isGitRepo(cwd)) return empty;
    const root = await this.getRepoRoot(cwd) || cwd;
    const status = await this.status(root);
    const entries = status.entries ?? [];
    const [staged, worktree] = await Promise.all([
      this.runner.run(["diff", "--numstat", "-z", "--no-ext-diff", "--no-color", "--cached", "--"], root),
      this.runner.run(["diff", "--numstat", "-z", "--no-ext-diff", "--no-color", "--"], root)
    ]);
    const untracked = await this.untrackedCounts(root, entries.filter((entry) => entry.untracked).map((entry) => entry.path));
    return buildChangeList({
      entries,
      stagedNumstat: staged.exitCode === 0 ? staged.stdout : "",
      worktreeNumstat: worktree.exitCode === 0 ? worktree.stdout : "",
      untracked
    });
  }
  async untrackedCounts(root, paths) {
    const counts = /* @__PURE__ */ new Map();
    for (const path of paths.slice(0, 1e3)) {
      try {
        const fullPath = join(root, path);
        const info = await lstat(fullPath);
        if (!info.isFile() && !info.isSymbolicLink()) continue;
        if (info.size > MAX_UNTRACKED_READ) {
          counts.set(path, { insertions: 0, deletions: 0, binary: true });
          continue;
        }
        const bytes = info.isSymbolicLink() ? Buffer.from(await readlink(fullPath)) : await readFile(fullPath);
        if (bytes.subarray(0, 8e3).includes(0)) {
          counts.set(path, { insertions: 0, deletions: 0, binary: true });
          continue;
        }
        const text = bytes.toString("utf8");
        const insertions = bytes.length === 0 ? 0 : text.split("\n").length - Number(text.endsWith("\n"));
        counts.set(path, { insertions, deletions: 0, binary: false });
      } catch {
      }
    }
    return counts;
  }
  async worktrees(cwd) {
    if (!await this.isGitRepo(cwd)) return [];
    const root = await this.getRepoRoot(cwd) || cwd;
    return parseWorktrees(this.checked(await this.runner.run(["worktree", "list", "--porcelain", "-z"], root), "List worktrees").stdout, root);
  }
  async log(cwd, maxCount = 50, options = {}) {
    if (!await this.isGitRepo(cwd)) return [];
    if (!Number.isSafeInteger(maxCount) || maxCount < 1 || maxCount > 1e4) throw new Error("Invalid log limit");
    const root = await this.getRepoRoot(cwd) || cwd;
    const args = ["log", `-n${maxCount}`, "-z", "--format=%H%x00%h%x00%s%x00%an%x00%cr%x00%P%x00%D", "--no-color"];
    if (options.all) args.push("--all");
    if (options.skip) args.push(`--skip=${Math.max(0, Math.trunc(options.skip))}`);
    if (options.path) args.push("--follow", "--", this.repoPath(root, options.path));
    const result = await this.runner.run(args, root);
    if (result.exitCode !== 0) {
      const head = await this.runner.run(["rev-parse", "--verify", "HEAD"], root);
      if (head.exitCode !== 0) return [];
      this.checked(result, "Log");
    }
    return parseLog(result.stdout);
  }
  async commitDetail(cwd, ref) {
    const root = await this.requireRepo(cwd);
    const hash = await this.resolveCommit(root, ref);
    const format = "%H%x00%h%x00%s%x00%an%x00%ae%x00%cn%x00%cr%x00%cI%x00%P%x00%D%x00%b";
    const [meta, names, numstat] = await Promise.all([
      this.runner.run(["show", "-s", "-z", `--format=${format}`, "--no-color", hash], root),
      this.runner.run(["show", "-z", "--format=", "--name-status", "-m", "--first-parent", "--no-color", hash], root),
      this.runner.run(["show", "-z", "--format=", "--numstat", "-m", "--first-parent", "--no-color", hash], root)
    ]);
    this.checked(meta, "Read commit");
    const fields = meta.stdout.split("\0").map((field) => field.replace(/^\n+/, ""));
    const [fullHash = hash, shortHash = hash.slice(0, 7), subject = "", author = "", authorEmail = "", committer = "", date = "", commitDate = "", parents = "", refs = "", body = ""] = fields;
    const files = mergeCommitFiles(parseNameStatus(names.exitCode === 0 ? names.stdout : ""), numstat.exitCode === 0 ? numstat.stdout : "");
    return {
      hash: fullHash || hash,
      shortHash,
      subject,
      author,
      authorEmail,
      committer,
      commitDate,
      date,
      parents: parents.split(" ").filter(Boolean),
      refs: refs.split(",").map((value) => value.trim()).filter(Boolean),
      body: body.trim(),
      files,
      totalInsertions: files.reduce((total, file) => total + file.insertions, 0),
      totalDeletions: files.reduce((total, file) => total + file.deletions, 0)
    };
  }
  async fileHistory(cwd, path, maxCount = 50) {
    const root = await this.requireRepo(cwd);
    const relativePath = this.repoPath(root, path);
    const limit = clamp(Math.trunc(maxCount) || 50, 1, 500);
    const result = await this.runner.run(["log", `-n${limit}`, "-z", "--format=%H%x00%h%x00%s%x00%an%x00%cr", "--no-color", "--follow", "--", this.literalPathspec(relativePath)], root);
    if (result.exitCode !== 0) return [];
    return parseFileHistory(result.stdout);
  }
  async blame(cwd, path, maxLines = 5e3) {
    const root = await this.requireRepo(cwd);
    const relativePath = this.repoPath(root, path);
    const limit = clamp(Math.trunc(maxLines) || 5e3, 1, 2e4);
    const result = await this.runner.run(["blame", "--line-porcelain", "--", relativePath], root);
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || "\u65E0\u6CD5\u8BFB\u53D6\u8BE5\u6587\u4EF6\u7684\u9010\u884C\u5F52\u5C5E");
    const all = parseBlamePorcelain(result.stdout);
    return { path: relativePath, lines: all.slice(0, limit), truncated: all.length > limit, totalLines: all.length };
  }
  async reflog(cwd, maxCount = 100) {
    if (!await this.isGitRepo(cwd)) return [];
    const root = await this.getRepoRoot(cwd) || cwd;
    const limit = clamp(Math.trunc(maxCount) || 100, 1, 1e3);
    const result = await this.runner.run(["reflog", `-n${limit}`, "-z", "--format=%H%x00%h%x00%gd%x00%gs%x00%cr", "--no-color"], root);
    if (result.exitCode !== 0) return [];
    return parseReflog(result.stdout);
  }
  async stashes(cwd) {
    if (!await this.isGitRepo(cwd)) return [];
    const root = await this.getRepoRoot(cwd) || cwd;
    const result = await this.runner.run(["stash", "list", "-z", "--format=%gd%x00%H%x00%h%x00%gs%x00%cr"], root);
    if (result.exitCode !== 0) return [];
    return parseStashList(result.stdout);
  }
  async stashShow(cwd, index) {
    const root = await this.requireRepo(cwd);
    const selector = this.stashSelector(index);
    const hash = await this.resolveCommit(root, selector);
    const common = ["--no-ext-diff", "--no-textconv", "--no-color", "--src-prefix=a/", "--dst-prefix=b/"];
    const [patch, stats] = await Promise.all([
      this.runner.run(["diff", ...common, "-U3", `${hash}^1`, hash, "--"], root),
      this.runner.run(["diff", ...common, "--numstat", "-z", `${hash}^1`, hash, "--"], root)
    ]);
    this.checked(patch, "Show stash");
    const parsed = parseUnifiedDiff(patch.stdout, stats.exitCode === 0 ? stats.stdout : "");
    parsed.base = `${selector}^1`;
    parsed.target = selector;
    return parsed;
  }
  stashSelector(index) {
    if (!Number.isSafeInteger(index) || index < 0 || index > 999) throw new Error("Invalid stash index");
    return `stash@{${index}}`;
  }
  async tags(cwd) {
    if (!await this.isGitRepo(cwd)) return [];
    const root = await this.getRepoRoot(cwd) || cwd;
    const format = "%(refname:short)%00%(objectname)%00%(objecttype)%00%(*objectname)%00%(contents:subject)%00%(creatordate:relative)";
    const result = await this.runner.run(["tag", "--list", `--format=${format}`], root);
    if (result.exitCode !== 0) return [];
    return parseTags(result.stdout);
  }
  async remotes(cwd) {
    if (!await this.isGitRepo(cwd)) return [];
    const root = await this.getRepoRoot(cwd) || cwd;
    const result = await this.runner.run(["remote", "-v"], root);
    if (result.exitCode !== 0) return [];
    const remotes = /* @__PURE__ */ new Map();
    for (const line of result.stdout.split("\n")) {
      const match = line.match(/^(\S+)\t(\S+)\s+\((fetch|push)\)$/);
      if (!match) continue;
      const existing = remotes.get(match[1]);
      if (!existing) remotes.set(match[1], { name: match[1], url: match[2], kind: match[3] });
      else if (match[2] !== existing.url) existing.url = `${existing.url} \u2192 ${match[2]}`;
    }
    return [...remotes.values()];
  }
  /** The operation left half-applied, with the paths that still conflict. */
  async operationState(cwd) {
    const root = await this.requireRepo(cwd);
    const gitDir = await this.gitDir(root);
    const markers = ["MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD", "REVERT_HEAD", "sequencer", "BISECT_LOG", "applying"];
    const kind = parseOperation(markers.filter((marker) => existsSync(join(gitDir, marker))));
    const unmerged = await this.runner.run(["ls-files", "-u", "-z"], root);
    const conflicts = [...new Set(unmerged.stdout.split("\0").filter(Boolean).map((record) => record.slice(record.indexOf("	") + 1)).filter(Boolean))].sort();
    const message2 = kind ? await this.operationMessage(gitDir, kind) : void 0;
    let detail;
    try {
      if (kind === "rebase") detail = (await readFile(join(gitDir, "rebase-merge", "head-name"), "utf8")).trim().replace("refs/heads/", "");
      else if (kind === "am") detail = (await readFile(join(gitDir, "rebase-apply", "head-name"), "utf8")).trim().replace("refs/heads/", "");
      else if (kind === "bisect") detail = (await readFile(join(gitDir, "BISECT_LOG"), "utf8")).trim().split("\n").pop()?.trim();
      else if (kind === "merge") detail = (await readFile(join(gitDir, "MERGE_HEAD"), "utf8")).trim().slice(0, 7);
      else if (kind === "cherry-pick" || kind === "revert") detail = (await readFile(join(gitDir, kind === "cherry-pick" ? "CHERRY_PICK_HEAD" : "REVERT_HEAD"), "utf8")).trim().slice(0, 7);
    } catch {
      detail = void 0;
    }
    return { kind, conflicts, message: message2, canContinue: kind !== null && conflicts.length === 0, detail };
  }
  async operationMessage(gitDir, kind) {
    const candidates = kind === "rebase" ? [join(gitDir, "rebase-merge", "message"), join(gitDir, "MERGE_MSG")] : kind === "am" ? [join(gitDir, "rebase-apply", "final-commit")] : [join(gitDir, "MERGE_MSG")];
    for (const candidate of candidates) {
      try {
        const text = (await readFile(candidate, "utf8")).trim();
        const message2 = text.split("\n").filter((line) => !line.startsWith("#")).join("\n").trim();
        if (message2) return message2;
      } catch {
      }
    }
    return void 0;
  }
  /** Conflict markers for every unmerged path, so both sides can be compared and resolved. */
  async conflicts(cwd) {
    const root = await this.requireRepo(cwd);
    const unmerged = await this.runner.run(["ls-files", "-u", "-z"], root);
    const stages = /* @__PURE__ */ new Map();
    for (const record of unmerged.stdout.split("\0").filter(Boolean)) {
      const tab = record.indexOf("	");
      if (tab < 0) continue;
      const stage = record.slice(0, tab).split(" ")[2]?.trim();
      const path = record.slice(tab + 1);
      stages.set(path, [...stages.get(path) ?? [], stage].filter(Boolean));
    }
    const files = [];
    for (const [path, pathStages] of [...stages.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      let hasMarkers = false;
      let binary = false;
      let lines = [];
      try {
        const bytes = await readFile(join(root, path));
        binary = bytes.subarray(0, 8e3).includes(0);
        if (!binary) {
          const parsed = parseConflictContent(bytes.toString("utf8"));
          hasMarkers = parsed.hasMarkers;
          lines = parsed.lines;
        }
      } catch {
      }
      files.push({ path, hasMarkers, lines, stages: pathStages, binary: binary || void 0 });
    }
    return files;
  }
  // --------------------------------------------------------------- mutations
  async stage(cwd, paths) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      const safe = await this.assertPaths(root, paths, true);
      return this.action(["add", "-A", "--", ...safe.map((path) => this.literalPathspec(path))], root);
    });
  }
  async stageAll(cwd) {
    return this.guarded(async () => this.action(["add", "-A", "--"], await this.requireRepo(cwd)));
  }
  async unstage(cwd, paths) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      const safe = await this.assertPaths(root, paths, false);
      const head = await this.runner.run(["rev-parse", "--verify", "HEAD"], root);
      const pathspec = safe.map((path) => this.literalPathspec(path));
      return head.exitCode === 0 ? this.action(["restore", "--staged", "--", ...pathspec], root) : this.action(["rm", "--cached", "-r", "--quiet", "--", ...pathspec], root);
    });
  }
  async unstageAll(cwd) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      const head = await this.runner.run(["rev-parse", "--verify", "HEAD"], root);
      return head.exitCode === 0 ? this.action(["reset", "--quiet", "HEAD", "--"], root) : this.action(["rm", "--cached", "-r", "--quiet", "--", "."], root);
    });
  }
  /** Throws away worktree changes; `staged` also resets the index entry to HEAD. */
  async discard(cwd, paths, options = {}) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      const safe = await this.assertPaths(root, paths, false);
      const staged = options.staged === true;
      const pathspec = safe.map((path) => this.literalPathspec(path));
      const args = staged ? ["restore", "--source=HEAD", "--staged", "--worktree", "--", ...pathspec] : ["restore", "--worktree", "--", ...pathspec];
      const result = await this.action(args, root);
      return result.ok ? { ...result, discarded: safe } : result;
    });
  }
  /** Deletes untracked files (which `git restore` cannot undo). */
  async deleteUntracked(cwd, paths) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      const safe = await this.assertPaths(root, paths, true);
      const known = await this.knownPaths(root);
      const discarded = [];
      for (const path of safe) {
        if (known.tracked.has(path)) return { ok: false, error: `\u8BE5\u6587\u4EF6\u5DF2\u88AB Git \u8DDF\u8E2A\uFF0C\u8BF7\u4F7F\u7528\u300C\u64A4\u9500\u66F4\u6539\u300D\uFF1A${path}` };
        await rm(join(root, path), { recursive: true, force: true });
        discarded.push(path);
      }
      return { ok: true, discarded };
    });
  }
  /**
   * Appends paths to `.gitignore` (or `.git/info/exclude` when `local`), which is the
   * only way to make an untracked file stop reappearing. Existing entries are left
   * alone so a second click is a no-op rather than a duplicate line.
   */
  async addToIgnore(cwd, paths, options = {}) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      const safe = await this.assertPaths(root, paths, true);
      const target = options.local ? join(await this.gitDir(root), "info", "exclude") : join(root, ".gitignore");
      let existing = "";
      try {
        existing = await readFile(target, "utf8");
      } catch {
        existing = "";
      }
      const lines = new Set(existing.split(/\r?\n/).map((line) => line.trim()));
      const added = safe.filter((path) => !lines.has(path) && !lines.has(`/${path}`));
      const skipped = safe.filter((path) => !added.includes(path));
      if (!added.length) return { ok: true, added, skipped };
      const prefix = existing && !existing.endsWith("\n") ? "\n" : "";
      const header = existing ? "" : "# \u7531 DSH Git \u9762\u677F\u6DFB\u52A0\n";
      await mkdir(dirname(target), { recursive: true });
      await appendFile(target, `${prefix}${header}${added.join("\n")}
`, "utf8");
      return { ok: true, added, skipped };
    });
  }
  /**
   * Applies a patch to the index (or reverse-applies it), which is how a single
   * hunk is staged or unstaged. `git apply` refuses paths outside the worktree.
   */
  async applyPatch(cwd, patch, options = {}) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      if (typeof patch !== "string" || !patch.trim()) throw new Error("\u8865\u4E01\u5185\u5BB9\u4E3A\u7A7A");
      if (Buffer.byteLength(patch, "utf8") > MAX_PATCH_BYTES) throw new Error("\u8865\u4E01\u8FC7\u5927");
      if (!/^diff --git /m.test(patch)) throw new Error("\u8865\u4E01\u683C\u5F0F\u65E0\u6CD5\u8BC6\u522B");
      const args = ["apply", "--recount", "--whitespace=nowarn"];
      if (options.cached !== false) args.push("--cached");
      if (options.reverse) args.push("--reverse");
      args.push("-");
      return this.action(args, root, { stdin: patch });
    });
  }
  async createCommit(cwd, options) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      const amend = options.amend === true;
      const text = typeof options.message === "string" ? options.message : "";
      if (!amend && !text.trim()) throw new Error("\u63D0\u4EA4\u4FE1\u606F\u4E0D\u80FD\u4E3A\u7A7A");
      const keepMessage = amend && !text.trim();
      const args = ["commit"];
      if (keepMessage) args.push("--amend", "--no-edit");
      else {
        args.push("-F", "-");
        if (amend) args.push("--amend");
      }
      if (options.signoff) args.push("--signoff");
      if (options.all) args.push("--all");
      const result = await this.action(args, root, { stdin: keepMessage ? void 0 : `${text.replace(/\r\n/g, "\n").trimEnd()}
` });
      if (!result.ok) return result;
      const head = await this.runner.run(["log", "-1", "-z", "--format=%H%x00%h%x00%s", "--no-color"], root);
      const [hash, shortHash, summary] = head.exitCode === 0 ? head.stdout.split("\0") : [];
      return { ...result, hash: hash || void 0, shortHash: shortHash || void 0, summary: summary || void 0 };
    });
  }
  /** The message of the last commit, used to prefill an amend. */
  async lastCommitMessage(cwd) {
    const root = await this.requireRepo(cwd);
    const result = await this.runner.run(["log", "-1", "--format=%B", "--no-color"], root);
    return result.exitCode === 0 ? result.stdout.trim() : "";
  }
  /**
   * One file's bytes from the worktree, for the inline image preview.
   *
   * Read-only, size-bounded, and restricted to paths Git already knows about, so a crafted
   * request cannot turn this into a way to read arbitrary files off the disk.
   */
  async readBlob(cwd, file) {
    try {
      const root = await this.requireRepo(cwd);
      const [safe] = await this.assertPaths(root, [file], true);
      const fullPath = join(root, ...safe.split("/"));
      const info = await lstat(fullPath);
      if (!info.isFile()) return { ok: false, error: "\u8FD9\u4E2A\u8DEF\u5F84\u4E0D\u662F\u4E00\u4E2A\u6587\u4EF6" };
      const [realRoot, realFile] = await Promise.all([realpath(root), realpath(fullPath)]);
      const resolvedPath = relative(realRoot, realFile);
      if (!resolvedPath || resolvedPath === ".." || resolvedPath.startsWith(`..${sep}`) || isAbsolute(resolvedPath)) {
        return { ok: false, error: "\u8DEF\u5F84\u8D85\u51FA\u4ED3\u5E93\u8303\u56F4" };
      }
      if (info.size > MAX_BLOB_BYTES) return { ok: false, error: `\u6587\u4EF6\u8D85\u8FC7 ${Math.round(MAX_BLOB_BYTES / 1e6)}MB\uFF0C\u65E0\u6CD5\u5185\u8054\u9884\u89C8` };
      return { ok: true, bytes: await readFile(realFile), type: blobType(safe) };
    } catch (error) {
      return { ok: false, error: message(error) };
    }
  }
  async resolveConflict(cwd, path, side) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      if (side !== "ours" && side !== "theirs") throw new Error("Invalid conflict side");
      const safe = await this.assertPaths(root, [path], false);
      const pathspec = safe.map((path2) => this.literalPathspec(path2));
      const checkout = await this.action(["checkout", `--${side}`, "--", ...pathspec], root);
      if (!checkout.ok) return checkout;
      return this.action(["add", "-A", "--", ...safe.map((path2) => this.literalPathspec(path2))], root);
    });
  }
  // ------------------------------------------------------- history rewriting
  async merge(cwd, ref) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      return this.action(["merge", "--no-edit", await this.resolveCommit(root, ref)], root);
    });
  }
  async rebase(cwd, ref) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      return this.action(["rebase", await this.resolveCommit(root, ref)], root);
    });
  }
  async cherryPick(cwd, ref) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      return this.action(["cherry-pick", await this.resolveCommit(root, ref)], root);
    });
  }
  async revert(cwd, ref) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      return this.action(["revert", "--no-edit", await this.resolveCommit(root, ref)], root);
    });
  }
  /** `continue` / `abort` / `skip` for whichever operation is in progress. */
  async operationStep(cwd, step) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      const state = await this.operationState(root);
      if (!state.kind) return { ok: false, error: "\u5F53\u524D\u6CA1\u6709\u8FDB\u884C\u4E2D\u7684\u64CD\u4F5C" };
      const command = state.kind === "am" ? "am" : state.kind;
      if (command === "apply" || command === "bisect") return { ok: false, error: `\u4E0D\u652F\u6301\u5BF9 ${state.kind} \u6267\u884C\u8BE5\u64CD\u4F5C` };
      if (step === "skip" && command === "merge") return { ok: false, error: "\u5408\u5E76\u65E0\u6CD5\u8DF3\u8FC7\uFF0C\u8BF7\u7EE7\u7EED\u6216\u4E2D\u6B62" };
      if (step === "continue" && state.conflicts.length > 0) return { ok: false, error: "\u4ECD\u6709\u672A\u89E3\u51B3\u7684\u51B2\u7A81\u6587\u4EF6" };
      const flag = step === "continue" ? "--continue" : step === "abort" ? "--abort" : "--skip";
      return this.action([command, flag], root);
    });
  }
  /** Moves the branch back to a previous point, keeping the worktree (soft/mixed only). */
  async reset(cwd, ref, mode = "soft") {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      if (mode !== "soft" && mode !== "mixed") throw new Error("Unsupported reset mode");
      return this.action(["reset", `--${mode}`, await this.resolveCommit(root, ref)], root);
    });
  }
  /** Undoes the last commit, leaving its content staged. */
  async undoLastCommit(cwd) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      const parent = await this.runner.run(["rev-parse", "--verify", "--quiet", "HEAD~1^{commit}"], root);
      if (parent.exitCode !== 0) throw new Error("\u6CA1\u6709\u53EF\u64A4\u9500\u7684\u4E0A\u4E00\u6B21\u63D0\u4EA4\uFF08\u5F53\u524D\u662F\u7B2C\u4E00\u4E2A\u63D0\u4EA4\uFF09");
      const undone = await this.runner.run(["log", "-1", "-z", "--format=%h%x00%s", "--no-color"], root);
      const [shortHash, summary] = undone.stdout.split("\0");
      const result = await this.action(["reset", "--soft", "HEAD~1"], root);
      return result.ok ? { ...result, shortHash, summary, output: result.output || `\u5DF2\u64A4\u9500\u63D0\u4EA4 ${shortHash}` } : result;
    });
  }
  // ------------------------------------------------------------------ remotes
  async fetch(cwd, options = {}) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      const remotes = await this.remotes(root);
      if (remotes.length === 0) return { ok: false, error: "\u6CA1\u6709\u914D\u7F6E\u4EFB\u4F55\u8FDC\u7A0B\u4ED3\u5E93" };
      if (options.remote) {
        this.safeRef(options.remote);
        if (!remotes.some((remote) => remote.name === options.remote)) throw new Error(`\u672A\u77E5\u7684\u8FDC\u7A0B\u4ED3\u5E93\uFF1A${options.remote}`);
      }
      const args = ["fetch", ...options.prune !== false ? ["--prune"] : [], ...options.remote ? [options.remote] : []];
      return this.action(args, root, { timeoutMs: NETWORK_TIMEOUT_MS });
    });
  }
  async pull(cwd, options = {}) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      const remotes = await this.remotes(root);
      if (remotes.length === 0) return { ok: false, error: "\u6CA1\u6709\u914D\u7F6E\u4EFB\u4F55\u8FDC\u7A0B\u4ED3\u5E93" };
      if (options.remote) {
        this.safeRef(options.remote);
        if (!remotes.some((remote) => remote.name === options.remote)) throw new Error(`\u672A\u77E5\u7684\u8FDC\u7A0B\u4ED3\u5E93\uFF1A${options.remote}`);
      }
      if (options.branch) await this.branchName(root, options.branch);
      const mode = options.mode ?? "ff-only";
      const args = ["pull", mode === "ff-only" ? "--ff-only" : mode === "rebase" ? "--rebase" : "--no-rebase"];
      if (options.remote) args.push(options.remote);
      if (options.branch) args.push(options.branch);
      const result = await this.action(args, root, { timeoutMs: NETWORK_TIMEOUT_MS });
      return this.withDivergence(root, result);
    });
  }
  async push(cwd, options = {}) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      const remotes = await this.remotes(root);
      if (remotes.length === 0) return { ok: false, error: "\u6CA1\u6709\u914D\u7F6E\u4EFB\u4F55\u8FDC\u7A0B\u4ED3\u5E93" };
      const status = await this.status(root);
      const branch = options.branch || (status.detached ? "" : status.branch);
      if (!branch) return { ok: false, error: "HEAD \u5904\u4E8E\u5206\u79BB\u72B6\u6001\uFF0C\u8BF7\u5148\u6307\u5B9A\u8981\u63A8\u9001\u7684\u5206\u652F" };
      await this.branchName(root, branch);
      if (options.remote) {
        this.safeRef(options.remote);
        if (!remotes.some((remote2) => remote2.name === options.remote)) throw new Error(`\u672A\u77E5\u7684\u8FDC\u7A0B\u4ED3\u5E93\uFF1A${options.remote}`);
      }
      const remote = options.remote || await this.defaultRemote(root, branch, remotes.map((item) => item.name));
      this.safeRef(remote);
      const args = ["push"];
      if (options.force === "with-lease") args.push("--force-with-lease");
      else if (options.force === "force") args.push("--force");
      if (options.setUpstream) args.push("--set-upstream");
      if (options.tags) args.push("--tags");
      if (options.dryRun) args.push("--dry-run");
      args.push(remote, branch);
      return this.action(args, root, { timeoutMs: NETWORK_TIMEOUT_MS });
    });
  }
  /** The configured upstream's remote, else `origin`, else the only remote there is. */
  async defaultRemote(root, branch, names) {
    const configured = await this.runner.run(["config", "--get", `branch.${branch}.remote`], root);
    const name = configured.stdout.trim();
    if (name && names.includes(name)) return name;
    if (names.includes("origin")) return "origin";
    return names[0];
  }
  async withDivergence(root, result) {
    const status = await this.status(root);
    return { ...result, ahead: status.ahead, behind: status.behind };
  }
  // ------------------------------------------------------------------- stash
  async stashPush(cwd, options = {}) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      const args = ["stash", "push"];
      if (options.includeUntracked) args.push("--include-untracked");
      if (options.keepIndex) args.push("--keep-index");
      if (options.message?.trim()) args.push("-m", options.message.trim());
      const result = await this.action(args, root);
      const text = `${result.output ?? ""}${result.error ?? ""}`;
      if (result.ok && /No local changes to save/i.test(text)) return { ok: false, error: "\u6CA1\u6709\u53EF\u4EE5\u50A8\u85CF\u7684\u6539\u52A8" };
      return result;
    });
  }
  async stashApply(cwd, index, options = {}) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      return this.action(["stash", options.pop ? "pop" : "apply", this.stashSelector(index)], root);
    });
  }
  async stashDrop(cwd, index) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      return this.action(["stash", "drop", this.stashSelector(index)], root);
    });
  }
  // -------------------------------------------------------------------- tags
  async tagCreate(cwd, name, options = {}) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      await this.refName(root, name, "refs/tags/");
      const args = ["tag"];
      if (options.message?.trim()) args.push("-a", "-m", options.message.trim());
      args.push("--", name);
      if (options.ref) args.push(await this.resolveCommit(root, options.ref));
      return this.action(args, root);
    });
  }
  async tagDelete(cwd, name) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      await this.refName(root, name, "refs/tags/");
      return this.action(["tag", "-d", "--", name], root);
    });
  }
  // ---------------------------------------------------------------- worktree
  async createWorktree(cwd, name, baseBranch) {
    const root = await this.getRepoRoot(cwd);
    if (!root) return { ok: false, error: "Not a git repository" };
    try {
      if (typeof name !== "string" || !name.trim()) throw new Error("Invalid worktree name");
      const sanitizedName = name.replace(/[^a-zA-Z0-9_\-.]/g, "-").toLowerCase();
      const branch = await this.branchName(root, `wt/${sanitizedName}`);
      const targetDir = resolve(root, "..", `.dsh-wt-${sanitizedName}`);
      const args = ["worktree", "add", "-b", branch, "--", targetDir];
      if (baseBranch !== void 0) args.push(await this.resolveCommit(root, baseBranch));
      const result = await this.runner.run(args, root);
      return result.exitCode === 0 ? { ok: true, path: targetDir } : { ok: false, error: result.stderr.trim() || "Failed to create worktree" };
    } catch (error) {
      return { ok: false, error: message(error) };
    }
  }
  /** Resolves a worktree argument against the registered worktrees only. */
  async registeredWorktree(root, worktreePath) {
    if (typeof worktreePath !== "string" || !worktreePath) throw new Error("Invalid worktree path");
    const wanted = resolve(root, worktreePath);
    const items = await this.worktrees(root);
    const match = items.find((item) => resolve(item.path) === wanted);
    if (!match) throw new Error("\u8BE5\u8DEF\u5F84\u4E0D\u662F\u5F53\u524D\u4ED3\u5E93\u767B\u8BB0\u7684\u5DE5\u4F5C\u6811");
    return match.path;
  }
  async removeWorktree(cwd, worktreePath, options = {}) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      const path = await this.registeredWorktree(root, worktreePath);
      return this.action(["worktree", "remove", ...options.force ? ["--force"] : [], "--", path], root);
    });
  }
  async lockWorktree(cwd, worktreePath, reason) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      const path = await this.registeredWorktree(root, worktreePath);
      const args = ["worktree", "lock"];
      if (reason?.trim()) args.push("--reason", reason.trim());
      args.push("--", path);
      return this.action(args, root);
    });
  }
  async unlockWorktree(cwd, worktreePath) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      const path = await this.registeredWorktree(root, worktreePath);
      return this.action(["worktree", "unlock", "--", path], root);
    });
  }
  async pruneWorktrees(cwd, options = {}) {
    return this.guarded(async () => {
      const root = await this.requireRepo(cwd);
      return this.action(["worktree", "prune", ...options.dryRun ? ["--dry-run"] : [], "--verbose"], root);
    });
  }
  /** Status of every registered worktree, for the manager list. */
  async worktreesWithStatus(cwd) {
    const items = await this.worktrees(cwd);
    for (const item of items) {
      try {
        const result = await this.runner.run(["status", "--porcelain", "-z", "--untracked-files=no"], item.path);
        if (result.exitCode === 0) item.dirtyFiles = result.stdout.split("\0").filter(Boolean).length;
      } catch {
      }
    }
    return items;
  }
};

// src/host/routes.ts
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as join2 } from "node:path";

// src/host/editor-launcher.ts
import { execFile, spawn as spawn2 } from "node:child_process";
import { existsSync as existsSync2, statSync } from "node:fs";
import { isAbsolute as isAbsolute2, dirname as dirname2, relative as relative2, resolve as resolve2, sep as sep2 } from "node:path";
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
    return hits.find((hit) => /\.exe$/i.test(hit)) ?? (process.platform === "win32" ? hits.find((hit) => /\.(cmd|bat)$/i.test(hit)) : void 0) ?? hits[0];
  } catch {
    return void 0;
  }
}
function spawnDetached(command, args) {
  return new Promise((resolve3, reject) => {
    const batch = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
    const child = spawn2(batch ? `"${command}"` : command, batch ? args.map((arg) => `"${arg}"`) : args, {
      detached: true,
      stdio: "ignore",
      shell: batch
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve3();
    });
  });
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
    if (UNSAFE_TARGET.test(target.repo) || target.file && UNSAFE_TARGET.test(target.file)) return { error: "\u6587\u4EF6\u8DEF\u5F84\u5305\u542B\u4E0D\u652F\u6301\u7528\u4E8E\u5916\u90E8\u7F16\u8F91\u5668\u7684\u5B57\u7B26" };
    const repo = resolve2(target.repo);
    if (!fileExists(repo)) return { error: "\u4ED3\u5E93\u8DEF\u5F84\u5DF2\u4E0D\u5B58\u5728" };
    if (!target.file) return { absolutePath: repo, display: repo };
    const absolutePath = resolve2(repo, target.file);
    const rel = relative2(repo, absolutePath);
    if (!rel || rel === ".." || rel.startsWith(`..${sep2}`) || isAbsolute2(rel)) return { error: "\u53EA\u80FD\u6253\u5F00\u5F53\u524D\u4ED3\u5E93\u5185\u7684\u6587\u4EF6" };
    if (!fileExists(absolutePath)) return { error: "\u6587\u4EF6\u5DF2\u4E0D\u5B58\u5728\uFF0C\u53EF\u80FD\u5DF2\u88AB\u5220\u9664\u6216\u91CD\u547D\u540D" };
    return { absolutePath, display: target.file };
  };
  const editorArguments = (candidate, absolutePath, line) => {
    if (isDirectory(absolutePath)) return [absolutePath];
    if (!candidate.goto) return [line ? `${absolutePath}:${line}` : absolutePath];
    return line ? ["-g", `${absolutePath}:${line}`] : ["-g", absolutePath];
  };
  const openWithSystemDefault = async (absolutePath) => {
    if (platform === "win32") await launch(env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "start", "", absolutePath]);
    else if (platform === "darwin") await launch("open", [absolutePath]);
    else await launch("xdg-open", [absolutePath]);
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
        try {
          await launch(command, editorArguments(candidate, absolutePath, target.line));
          return { ok: true, editor: candidate.label, target: display };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : "\u65E0\u6CD5\u542F\u52A8\u7F16\u8F91\u5668" };
        }
      }
      if (options.openNatively) {
        try {
          await options.openNatively(absolutePath);
          return { ok: true, target: display };
        } catch {
        }
      }
      try {
        await openWithSystemDefault(absolutePath);
        return { ok: true, target: display };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "\u65E0\u6CD5\u6253\u5F00\u9ED8\u8BA4\u5E94\u7528" };
      }
    },
    /**
     * "Show in file manager" is a different intent from "open": the user wants the
     * surrounding folder, and on Windows even a successful `explorer` exits non-zero,
     * so the exit code is deliberately never inspected here.
     */
    async reveal(target) {
      const resolved = resolveTarget(target);
      if ("error" in resolved) return { ok: false, error: resolved.error };
      const { absolutePath, display } = resolved;
      const isFile = Boolean(target.file) && !isDirectory(absolutePath);
      try {
        if (platform === "win32") await launch("explorer.exe", [isFile ? `/select,${absolutePath}` : absolutePath]);
        else if (platform === "darwin") await launch("open", isFile ? ["-R", absolutePath] : [absolutePath]);
        else await launch("xdg-open", [isFile ? dirname2(absolutePath) : absolutePath]);
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "\u65E0\u6CD5\u6253\u5F00\u6587\u4EF6\u7BA1\u7406\u5668" };
      }
      return { ok: true, target: display };
    }
  };
}

// src/host/routes.ts
var DEFAULT_BODY_LIMIT = 64 * 1024;
var BODY_LIMITS = {
  "/dsh-git/apply-patch": 8 * 1024 * 1024,
  "/dsh-git/commit": 256 * 1024,
  "/dsh-git/stash-push": 256 * 1024,
  "/dsh-git/tag-create": 256 * 1024
};
var MAX_LIST_ITEMS = 5e3;
function badRequest(message2) {
  return Object.assign(new Error(message2), { statusCode: 400 });
}
function readJsonBody(req, limit = DEFAULT_BODY_LIMIT) {
  return new Promise((resolve3, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > limit) {
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
  if (optional && (value === void 0 || value === null || value === "")) return void 0;
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw badRequest(`${key} must be a non-empty string`);
  return value;
}
function stringList(payload, key, optional = false) {
  const value = payload[key];
  if (value === void 0 || value === null) {
    if (optional) return void 0;
    throw badRequest(`${key} must be an array of strings`);
  }
  if (!Array.isArray(value) || value.length === 0) throw badRequest(`${key} must be a non-empty array of strings`);
  if (value.length > MAX_LIST_ITEMS) throw badRequest(`${key} has too many items`);
  return value.map((item) => {
    if (typeof item !== "string" || !item.trim() || item.includes("\0")) throw badRequest(`${key} must contain non-empty strings`);
    return item;
  });
}
function integerField(payload, key, min, max) {
  const value = payload[key];
  if (value === void 0 || value === null) return void 0;
  if (!Number.isInteger(value) || value < min || value > max) throw badRequest(`${key} must be an integer between ${min} and ${max}`);
  return value;
}
function enumField(payload, key, allowed, fallback) {
  const value = payload[key];
  if (value === void 0 || value === null || value === "") return fallback;
  if (typeof value !== "string" || !allowed.includes(value)) throw badRequest(`${key} must be one of ${allowed.join(", ")}`);
  return value;
}
function requiredEnumField(payload, key, allowed) {
  const value = enumField(payload, key, allowed);
  if (value === void 0) throw badRequest(`${key} is required`);
  return value;
}
function booleanField(payload, key) {
  const value = payload[key];
  if (value === void 0 || value === null) return void 0;
  if (typeof value !== "boolean") throw badRequest(`${key} must be a boolean`);
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
  const blobHandler = async (req, res, url) => {
    if (req.method !== "GET") {
      writeJson(res, 405, { ok: false, error: "Method Not Allowed" });
      return;
    }
    try {
      const path = stringField({ path: url.searchParams.get("path") }, "path");
      const file = stringField({ file: url.searchParams.get("file") }, "file");
      const blob = await service.readBlob(path, file);
      if (!blob.ok || !blob.bytes) {
        writeJson(res, 404, { ok: false, error: blob.error || "File is not readable" });
        return;
      }
      res.writeHead(200, {
        "Content-Type": blob.type || "application/octet-stream",
        "Content-Length": blob.bytes.byteLength,
        // Repository SVGs are untrusted active documents when opened directly. Keep
        // image previews usable without granting scripts the DSH origin's authority.
        "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'",
        "X-Content-Type-Options": "nosniff",
        // The URL carries the repository revision, so a stale image is never reused.
        "Cache-Control": "no-store"
      });
      res.end(blob.bytes);
    } catch (error) {
      writeJson(res, error?.statusCode === 400 ? 400 : 500, { ok: false, error: error?.message || "Blob read failed" });
    }
  };
  const apiHandler = async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname === "/dsh-git/events") {
        sseHandler(req, res, url);
        return;
      }
      if (url.pathname === "/dsh-git/blob") {
        await blobHandler(req, res, url);
        return;
      }
      if (req.method !== "POST") {
        writeJson(res, 405, { ok: false, error: "Method Not Allowed" });
        return;
      }
      const payload = await readJsonBody(req, BODY_LIMITS[url.pathname] ?? DEFAULT_BODY_LIMIT);
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
      const value = async (read) => {
        writeJson(res, 200, { ok: true, value: await read() });
      };
      switch (url.pathname) {
        // ---- reads -----------------------------------------------------------------
        case "/dsh-git/status":
          await value(() => service.status(path));
          return;
        case "/dsh-git/branches":
          await value(() => service.branches(path));
          return;
        case "/dsh-git/changes":
          await value(() => service.changes(path));
          return;
        case "/dsh-git/diff": {
          const diffOptions = {
            mode: enumField(payload, "mode", ["worktree", "unstaged", "staged", "range", "single"]),
            paths: stringList(payload, "files", true),
            ignoreWhitespace: booleanField(payload, "ignoreWhitespace"),
            context: integerField(payload, "context", 0, 50),
            includeUntracked: booleanField(payload, "includeUntracked")
          };
          await value(() => service.diff(path, optional("base"), optional("target"), diffOptions));
          return;
        }
        case "/dsh-git/log":
          await value(() => service.log(path, integerField(payload, "limit", 1, 500) ?? 50, {
            path: optional("file"),
            all: booleanField(payload, "all"),
            skip: integerField(payload, "skip", 0, 1e5)
          }));
          return;
        case "/dsh-git/commit-detail":
          await value(() => service.commitDetail(path, required("ref")));
          return;
        case "/dsh-git/file-history":
          await value(() => service.fileHistory(path, required("file"), integerField(payload, "limit", 1, 500) ?? 50));
          return;
        case "/dsh-git/blame":
          await value(() => service.blame(path, required("file"), integerField(payload, "maxLines", 1, 5e4) ?? 5e3));
          return;
        case "/dsh-git/reflog":
          await value(() => service.reflog(path, integerField(payload, "limit", 1, 1e3) ?? 100));
          return;
        case "/dsh-git/stashes":
          await value(() => service.stashes(path));
          return;
        case "/dsh-git/stash-show":
          await value(() => service.stashShow(path, integerField(payload, "index", 0, 1e4) ?? 0));
          return;
        case "/dsh-git/tags":
          await value(() => service.tags(path));
          return;
        case "/dsh-git/remotes":
          await value(() => service.remotes(path));
          return;
        case "/dsh-git/operation":
          await value(() => service.operationState(path));
          return;
        case "/dsh-git/conflicts":
          await value(() => service.conflicts(path));
          return;
        case "/dsh-git/worktrees":
          await value(() => service.worktrees(path));
          return;
        case "/dsh-git/worktrees-status":
          await value(() => service.worktreesWithStatus(path));
          return;
        case "/dsh-git/last-commit-message":
          await value(() => service.lastCommitMessage(path));
          return;
        // ---- working tree ----------------------------------------------------------
        case "/dsh-git/stage":
          writeJson(res, 200, await service.stage(path, stringList(payload, "files")));
          return;
        case "/dsh-git/stage-all":
          writeJson(res, 200, await service.stageAll(path));
          return;
        case "/dsh-git/unstage":
          writeJson(res, 200, await service.unstage(path, stringList(payload, "files")));
          return;
        case "/dsh-git/unstage-all":
          writeJson(res, 200, await service.unstageAll(path));
          return;
        case "/dsh-git/discard":
          writeJson(res, 200, await service.discard(path, stringList(payload, "files"), { staged: booleanField(payload, "staged") }));
          return;
        case "/dsh-git/delete-untracked":
          writeJson(res, 200, await service.deleteUntracked(path, stringList(payload, "files")));
          return;
        case "/dsh-git/apply-patch": {
          const patch = required("patch");
          writeJson(res, 200, await service.applyPatch(path, patch, {
            reverse: booleanField(payload, "reverse"),
            cached: booleanField(payload, "cached")
          }));
          return;
        }
        case "/dsh-git/write-gitignore":
          writeJson(res, 200, await service.addToIgnore(path, stringList(payload, "files"), { local: booleanField(payload, "local") }));
          return;
        // ---- commit ----------------------------------------------------------------
        case "/dsh-git/commit":
          writeJson(res, 200, await service.createCommit(path, {
            message: optional("message"),
            amend: booleanField(payload, "amend"),
            signoff: booleanField(payload, "signoff"),
            all: booleanField(payload, "all")
          }));
          return;
        case "/dsh-git/undo-commit":
          writeJson(res, 200, await service.undoLastCommit(path));
          return;
        case "/dsh-git/reset":
          writeJson(res, 200, await service.reset(path, required("ref"), enumField(payload, "mode", ["soft", "mixed"], "soft")));
          return;
        case "/dsh-git/conflict-resolve":
          writeJson(res, 200, await service.resolveConflict(path, required("file"), requiredEnumField(payload, "side", ["ours", "theirs"])));
          return;
        // ---- sequencing operations -------------------------------------------------
        case "/dsh-git/merge":
          writeJson(res, 200, await service.merge(path, required("ref")));
          return;
        case "/dsh-git/rebase":
          writeJson(res, 200, await service.rebase(path, required("ref")));
          return;
        case "/dsh-git/cherry-pick":
          writeJson(res, 200, await service.cherryPick(path, required("ref")));
          return;
        case "/dsh-git/revert":
          writeJson(res, 200, await service.revert(path, required("ref")));
          return;
        case "/dsh-git/operation-step":
          writeJson(res, 200, await service.operationStep(path, requiredEnumField(payload, "step", ["continue", "abort", "skip"])));
          return;
        // ---- remotes and sync ------------------------------------------------------
        case "/dsh-git/fetch":
          writeJson(res, 200, await service.fetch(path, { remote: optional("remote"), prune: booleanField(payload, "prune") }));
          return;
        case "/dsh-git/pull":
          writeJson(res, 200, await service.pull(path, {
            mode: enumField(payload, "mode", ["ff-only", "rebase", "merge"]),
            remote: optional("remote"),
            branch: optional("branch")
          }));
          return;
        case "/dsh-git/push": {
          const force = booleanField(payload, "force");
          writeJson(res, 200, await service.push(path, {
            remote: optional("remote"),
            branch: optional("branch"),
            setUpstream: booleanField(payload, "setUpstream"),
            // Force is always the leasing form, so a push that lost a race is rejected
            // instead of overwriting someone else's commit.
            force: force === void 0 ? void 0 : force ? "with-lease" : false
          }));
          return;
        }
        // ---- stash, tags, branches -------------------------------------------------
        case "/dsh-git/stash-push":
          writeJson(res, 200, await service.stashPush(path, {
            message: optional("message"),
            includeUntracked: booleanField(payload, "includeUntracked"),
            keepIndex: booleanField(payload, "keepIndex")
          }));
          return;
        case "/dsh-git/stash-apply":
          writeJson(res, 200, await service.stashApply(path, integerField(payload, "index", 0, 1e4) ?? 0, { pop: booleanField(payload, "pop") }));
          return;
        case "/dsh-git/stash-drop":
          writeJson(res, 200, await service.stashDrop(path, integerField(payload, "index", 0, 1e4) ?? 0));
          return;
        case "/dsh-git/tag-create":
          writeJson(res, 200, await service.tagCreate(path, required("name"), { ref: optional("ref"), message: optional("message") }));
          return;
        case "/dsh-git/tag-delete":
          writeJson(res, 200, await service.tagDelete(path, required("name")));
          return;
        case "/dsh-git/switch":
          writeJson(res, 200, await service.switchBranch(path, required("branch")));
          return;
        case "/dsh-git/create-branch":
          writeJson(res, 200, await service.createBranch(path, required("name"), optional("base")));
          return;
        case "/dsh-git/delete-branch":
          writeJson(res, 200, await service.deleteBranch(path, required("name"), booleanField(payload, "force")));
          return;
        // ---- worktrees -------------------------------------------------------------
        case "/dsh-git/create-worktree":
          writeJson(res, 200, await service.createWorktree(path, required("name"), optional("base")));
          return;
        case "/dsh-git/remove-worktree":
          writeJson(res, 200, await service.removeWorktree(path, required("worktreePath"), { force: booleanField(payload, "force") }));
          return;
        case "/dsh-git/lock-worktree":
          writeJson(res, 200, await service.lockWorktree(path, required("worktreePath"), optional("reason")));
          return;
        case "/dsh-git/unlock-worktree":
          writeJson(res, 200, await service.unlockWorktree(path, required("worktreePath")));
          return;
        case "/dsh-git/prune-worktrees":
          writeJson(res, 200, await service.pruneWorktrees(path, { dryRun: booleanField(payload, "dryRun") }));
          return;
        // ---- opening files outside the app -----------------------------------------
        case "/dsh-git/open-in-editor": {
          if (payload.line !== void 0 && (!Number.isInteger(payload.line) || payload.line < 1)) throw badRequest("line must be a positive integer");
          writeJson(res, 200, await editor.open({ repo: path, file: optional("file"), line: payload.line }));
          return;
        }
        case "/dsh-git/reveal":
          writeJson(res, 200, await editor.reveal({ repo: path, file: optional("file") }));
          return;
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

// src/host/tool-defs.ts
var annotationKeys = ["description", "title", "default", "examples"];
var schemaTypes = /* @__PURE__ */ new Set(["string", "number", "integer", "boolean", "null", "array", "object", "json"]);
var scalarTypes = /* @__PURE__ */ new Set(["string", "number", "integer", "boolean", "null"]);
function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function copyAnnotations(source, target) {
  for (const key of annotationKeys) {
    if (Object.hasOwn(source, key)) target[key] = source[key];
  }
}
function assertOnlyKeys(source, allowed, path) {
  for (const key of Object.keys(source)) {
    if (!allowed.includes(key)) throw new Error(`${path}.${key} is not supported by the tool schema`);
  }
}
function compileValueSchema(source, path, allowRequired, ancestors) {
  if (!isRecord(source)) throw new Error(`${path} must be a schema object`);
  if (ancestors.has(source)) throw new Error(`${path} is circular`);
  ancestors.add(source);
  try {
    const allowedBase = [...annotationKeys, ...allowRequired ? ["required"] : []];
    if (Object.hasOwn(source, "required") && source.required !== true) {
      throw new Error(`${path}.required must be true when present`);
    }
    if (Object.hasOwn(source, "oneOf")) {
      assertOnlyKeys(source, [...allowedBase, "oneOf"], path);
      if (!Array.isArray(source.oneOf) || source.oneOf.length < 2) {
        throw new Error(`${path}.oneOf must contain at least two schemas`);
      }
      const result2 = { oneOf: source.oneOf.map((branch, index) => compileValueSchema(branch, `${path}.oneOf[${index}]`, false, ancestors)) };
      copyAnnotations(source, result2);
      return result2;
    }
    const type = source.type;
    if (!schemaTypes.has(type)) throw new Error(`${path}.type must be a supported JSON schema type`);
    const result = {};
    if (type === "json") {
      assertOnlyKeys(source, [...allowedBase, "type"], path);
      copyAnnotations(source, result);
      return result;
    }
    if (type === "object") {
      assertOnlyKeys(source, [...allowedBase, "type", "properties", "additionalProperties"], path);
      if (typeof source.additionalProperties !== "boolean") {
        throw new Error(`${path}.additionalProperties must be explicitly true or false`);
      }
      result.type = "object";
      result.additionalProperties = source.additionalProperties;
      copyAnnotations(source, result);
      if (Object.hasOwn(source, "properties")) {
        if (!isRecord(source.properties)) throw new Error(`${path}.properties must be an object`);
        const properties = {};
        const required = [];
        for (const [key, child] of Object.entries(source.properties)) {
          if (!isRecord(child)) throw new Error(`${path}.properties.${key} must be a schema object`);
          if (Object.hasOwn(child, "required") && child.required === true) required.push(key);
          properties[key] = compileValueSchema(child, `${path}.properties.${key}`, true, ancestors);
        }
        result.properties = properties;
        if (required.length > 0) result.required = required;
      }
      return result;
    }
    if (type === "array") {
      assertOnlyKeys(source, [...allowedBase, "type", "items"], path);
      result.type = "array";
      copyAnnotations(source, result);
      if (Object.hasOwn(source, "items")) result.items = compileValueSchema(source.items, `${path}.items`, false, ancestors);
      return result;
    }
    assertOnlyKeys(source, [...allowedBase, "type", "enum", "const"], path);
    if (!scalarTypes.has(type)) throw new Error(`${path}.type must be a supported scalar schema type`);
    result.type = type;
    copyAnnotations(source, result);
    if (Object.hasOwn(source, "enum")) {
      if (!Array.isArray(source.enum) || source.enum.length === 0 || source.enum.some((item) => item !== null && !["string", "number", "boolean"].includes(typeof item))) {
        throw new Error(`${path}.enum must be a non-empty array of scalar values`);
      }
      result.enum = [...source.enum];
    }
    if (Object.hasOwn(source, "const")) result.const = source.const;
    return result;
  } finally {
    ancestors.delete(source);
  }
}
function compileParameters(parameters) {
  const source = parameters ?? {};
  if (!isRecord(source)) throw new Error("parameters must be an object");
  const properties = {};
  const required = [];
  for (const [name, parameter2] of Object.entries(source)) {
    if (!isRecord(parameter2)) throw new Error(`parameters.${name} must be an object`);
    if (!["string", "number", "boolean", "array"].includes(parameter2.type)) {
      throw new Error(`parameters.${name}.type must be string, number, boolean, or array`);
    }
    if (parameter2.required !== void 0 && typeof parameter2.required !== "boolean") {
      throw new Error(`parameters.${name}.required must be a boolean`);
    }
    if (parameter2.description !== void 0 && typeof parameter2.description !== "string") {
      throw new Error(`parameters.${name}.description must be a string`);
    }
    const prop = { type: parameter2.type };
    if (parameter2.description !== void 0) prop.description = parameter2.description;
    if (parameter2.default !== void 0) prop.default = parameter2.default;
    if (parameter2.enum !== void 0) {
      if (!Array.isArray(parameter2.enum) || parameter2.enum.some((value) => typeof value !== "string")) {
        throw new Error(`parameters.${name}.enum must be an array of strings`);
      }
      prop.enum = [...parameter2.enum];
    }
    if (parameter2.type === "array" && parameter2.items !== void 0) {
      if (!isRecord(parameter2.items) || typeof parameter2.items.type !== "string") {
        throw new Error(`parameters.${name}.items must declare a type`);
      }
      prop.items = { type: parameter2.items.type };
    } else if (parameter2.type !== "array" && parameter2.items !== void 0) {
      throw new Error(`parameters.${name}.items is only supported for arrays`);
    }
    properties[name] = prop;
    if (parameter2.required === true) required.push(name);
  }
  return {
    type: "object",
    properties,
    ...required.length > 0 ? { required } : {}
  };
}
function defineTool(definition) {
  if (!isRecord(definition)) throw new Error("defineTool: definition must be an object");
  if (typeof definition.name !== "string" || !/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(definition.name)) {
    throw new Error("defineTool: name must be snake_case");
  }
  if (typeof definition.description !== "string" || !definition.description.trim()) {
    throw new Error(`defineTool(${definition.name}): description is required`);
  }
  if (typeof definition.execute !== "function") {
    throw new Error(`defineTool(${definition.name}): execute must be a function`);
  }
  if (!isRecord(definition.output) || !isRecord(definition.output.schema)) {
    throw new Error(`defineTool(${definition.name}): output.schema is required and must be an object`);
  }
  if (definition.output.render !== void 0 && typeof definition.output.render !== "function") {
    throw new Error(`defineTool(${definition.name}): output.render must be a function`);
  }
  if (definition.timeoutMs !== void 0 && (!Number.isFinite(definition.timeoutMs) || definition.timeoutMs <= 0)) {
    throw new Error(`defineTool(${definition.name}): timeoutMs must be a positive finite number`);
  }
  const parameters = compileParameters(definition.parameters);
  const outputSchema = compileValueSchema(definition.output.schema, "schema", false, /* @__PURE__ */ new Set());
  const output = {
    schema: outputSchema,
    render: definition.output.render ?? (() => [])
  };
  const normalized = {
    name: definition.name,
    description: definition.description,
    parameters,
    output,
    ...definition.timeoutMs !== void 0 ? { timeoutMs: definition.timeoutMs } : {},
    ...definition.isConcurrencySafe === true ? { isConcurrencySafe: () => true } : {},
    execute: definition.execute
  };
  return normalized;
}

// src/host/agent-tools.ts
var cwdDescription = "\u4ED3\u5E93\u6240\u5728\u7684\u7EDD\u5BF9\u8DEF\u5F84\uFF08\u5FC5\u987B\u662F Git \u5DE5\u4F5C\u6811\u5185\u7684\u8DEF\u5F84\uFF09";
var toolNames = /* @__PURE__ */ new Set([
  "git_status",
  "git_diff",
  "git_log",
  "git_stage",
  "git_unstage",
  "git_commit",
  "git_stash",
  "git_branch"
]);
function parameter(type, description, required = false, extra = {}) {
  return { type, description, ...required ? { required: true } : {}, ...extra };
}
function textResult(text) {
  return [{ type: "text", text }];
}
function errorText(error) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return String(error);
}
function actionSummary(action, value) {
  if (value?.ok) return value.output || `\u5DF2\u5B8C\u6210${action}`;
  const error = typeof value?.error === "string" ? value.error : value?.error?.message;
  return `${action}\u5931\u8D25${error ? `\uFF1A${error}` : ""}`;
}
function gitStatusTool(service) {
  return defineTool({
    name: "git_status",
    description: "\u53EA\u8BFB\uFF1A\u67E5\u770B Git \u5DE5\u4F5C\u6811\u72B6\u6001\u3001\u5206\u652F\u4E0E\u5404\u7C7B\u53D8\u66F4\u6587\u4EF6\uFF0C\u4E0D\u4F1A\u4FEE\u6539\u4ED3\u5E93\u3002",
    parameters: {
      cwd: parameter("string", cwdDescription, true)
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          isGit: { type: "boolean", required: true },
          root: { type: "string", required: true },
          branch: { type: "string", required: true },
          head: { type: "string", required: true },
          upstream: { type: "string" },
          ahead: { type: "number" },
          behind: { type: "number" },
          stashCount: { type: "number" },
          operation: { oneOf: [{ type: "string" }, { type: "null" }] },
          detached: { type: "boolean", required: true },
          staged: { type: "number", required: true },
          unstaged: { type: "number", required: true },
          conflicts: { type: "number", required: true },
          untracked: { type: "number", required: true },
          clean: { type: "boolean", required: true },
          truncated: { type: "boolean", required: true },
          files: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                path: { type: "string", required: true },
                section: { type: "string", enum: ["staged", "unstaged", "conflict", "untracked"], required: true },
                status: { type: "string", required: true },
                insertions: { type: "number", required: true },
                deletions: { type: "number", required: true }
              }
            }
          }
        }
      },
      render: (_args, value) => textResult(value.clean ? "Git \u5DE5\u4F5C\u6811\u5E72\u51C0\u3002" : `Git \u5DE5\u4F5C\u6811\u6709 ${value.files.length}${value.truncated ? " \u4E2A\u4EE5\u4E0A" : ""} \u4E2A\u53D8\u66F4\u6587\u4EF6\u3002`)
    },
    async execute(args) {
      try {
        const [status, changes] = await Promise.all([service.status(args.cwd), service.changes(args.cwd)]);
        const entries = changes.entries;
        const files = entries.slice(0, 200).map((entry) => ({
          path: entry.path,
          section: entry.section,
          status: entry.status,
          insertions: entry.insertions,
          deletions: entry.deletions
        }));
        return {
          isGit: status.isGit,
          root: status.root,
          branch: status.branch,
          head: status.head,
          ...status.upstream !== void 0 ? { upstream: status.upstream } : {},
          ...status.ahead !== void 0 ? { ahead: status.ahead } : {},
          ...status.behind !== void 0 ? { behind: status.behind } : {},
          ...status.stashCount !== void 0 ? { stashCount: status.stashCount } : {},
          operation: status.operation ?? null,
          detached: status.detached ?? false,
          staged: changes.staged,
          unstaged: changes.unstaged,
          conflicts: changes.conflicts,
          untracked: changes.untracked,
          clean: status.isGit && entries.length === 0 && !status.operationInProgress,
          truncated: entries.length > 200,
          files
        };
      } catch (error) {
        throw error;
      }
    }
  });
}
function gitDiffTool(service) {
  return defineTool({
    name: "git_diff",
    description: "\u53EA\u8BFB\uFF1A\u67E5\u770B\u5DE5\u4F5C\u533A\u3001\u6682\u5B58\u533A\u6216\u63D0\u4EA4\u8303\u56F4\u7684\u4EE3\u7801\u5DEE\u5F02\uFF0C\u4E0D\u4F1A\u4FEE\u6539\u4ED3\u5E93\u3002",
    parameters: {
      cwd: parameter("string", cwdDescription, true),
      base: parameter("string", "\u5DEE\u5F02\u57FA\u51C6\u7248\u672C\u6216\u5206\u652F\u3002"),
      target: parameter("string", "\u5DEE\u5F02\u76EE\u6807\u7248\u672C\u6216\u5206\u652F\u3002"),
      mode: parameter("string", "\u5DEE\u5F02\u6A21\u5F0F\u3002", false, { enum: ["worktree", "staged", "range", "single"] }),
      files: parameter("array", "\u4EC5\u67E5\u770B\u8FD9\u4E9B\u4ED3\u5E93\u76F8\u5BF9\u8DEF\u5F84\u3002", false, { items: { type: "string" } }),
      context: parameter("number", "\u6BCF\u4E2A\u5DEE\u5F02\u5757\u663E\u793A\u7684\u4E0A\u4E0B\u6587\u884C\u6570\u3002"),
      ignoreWhitespace: parameter("boolean", "\u662F\u5426\u5FFD\u7565\u7A7A\u767D\u5DEE\u5F02\u3002")
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          base: { type: "string", required: true },
          target: { type: "string", required: true },
          totalInsertions: { type: "number", required: true },
          totalDeletions: { type: "number", required: true },
          truncated: { type: "boolean", required: true },
          files: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                path: { type: "string", required: true },
                oldPath: { type: "string" },
                status: { type: "string", required: true },
                insertions: { type: "number", required: true },
                deletions: { type: "number", required: true },
                binary: { type: "boolean", required: true },
                patch: { type: "string", required: true }
              }
            }
          }
        }
      },
      render: (_args, value) => textResult(`\u5DEE\u5F02\u5171 ${value.files.length} \u4E2A\u6587\u4EF6\uFF0C\u589E\u52A0 ${value.totalInsertions} \u884C\u3001\u5220\u9664 ${value.totalDeletions} \u884C${value.truncated ? "\uFF08\u8865\u4E01\u5DF2\u622A\u65AD\uFF09" : ""}\u3002`)
    },
    async execute(args) {
      try {
        const diff = await service.diff(args.cwd, args.base, args.target, {
          mode: args.mode,
          paths: args.files,
          context: args.context,
          ignoreWhitespace: args.ignoreWhitespace
        });
        let truncated = false;
        const files = diff.files.map((file) => {
          if (file.rawPatch.length > 8e3) truncated = true;
          return {
            path: file.path,
            ...file.oldPath !== void 0 ? { oldPath: file.oldPath } : {},
            status: file.status,
            insertions: file.insertions,
            deletions: file.deletions,
            binary: file.binary === true,
            patch: file.rawPatch.slice(0, 8e3)
          };
        });
        return {
          base: diff.base,
          target: diff.target,
          totalInsertions: diff.totalInsertions,
          totalDeletions: diff.totalDeletions,
          truncated,
          files
        };
      } catch (error) {
        throw error;
      }
    }
  });
}
function gitLogTool(service) {
  return defineTool({
    name: "git_log",
    description: "\u53EA\u8BFB\uFF1A\u67E5\u770B\u6700\u8FD1\u63D0\u4EA4\u8BB0\u5F55\u6216\u6307\u5B9A\u6587\u4EF6\u7684\u63D0\u4EA4\u5386\u53F2\uFF0C\u4E0D\u4F1A\u4FEE\u6539\u4ED3\u5E93\u3002",
    parameters: {
      cwd: parameter("string", cwdDescription, true),
      limit: parameter("number", "\u6700\u591A\u8FD4\u56DE\u7684\u63D0\u4EA4\u6570\u91CF\uFF0C\u8303\u56F4\u4E3A 1 \u5230 100\u3002"),
      file: parameter("string", "\u4EC5\u67E5\u770B\u6B64\u4ED3\u5E93\u76F8\u5BF9\u8DEF\u5F84\u7684\u5386\u53F2\u3002")
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          commits: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                hash: { type: "string", required: true },
                shortHash: { type: "string", required: true },
                subject: { type: "string", required: true },
                author: { type: "string", required: true },
                date: { type: "string", required: true },
                parents: { type: "array", items: { type: "string" }, required: true },
                refs: { type: "array", items: { type: "string" }, required: true }
              }
            }
          }
        }
      },
      render: (_args, value) => textResult(`\u63D0\u4EA4\u8BB0\u5F55\uFF1A${value.commits.length} \u6761${value.commits[0] ? `\uFF0C\u6700\u8FD1\u4E00\u6761\u4E3A ${value.commits[0].shortHash} ${value.commits[0].subject}` : ""}\u3002`)
    },
    async execute(args) {
      try {
        const rawLimit = typeof args.limit === "number" && Number.isFinite(args.limit) ? Math.trunc(args.limit) : 20;
        const limit = Math.min(100, Math.max(1, rawLimit));
        const commits = await service.log(args.cwd, limit, { path: args.file });
        return {
          commits: commits.map((commit) => ({
            hash: commit.hash,
            shortHash: commit.shortHash,
            subject: commit.subject,
            author: commit.author,
            date: commit.date,
            parents: commit.parents,
            refs: commit.refs
          }))
        };
      } catch (error) {
        throw error;
      }
    }
  });
}
function actionResultSchema(extraProperties = {}) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      ok: { type: "boolean", required: true },
      output: { type: "string" },
      error: { type: "string" },
      ...extraProperties
    }
  };
}
function gitStageTool(service) {
  return defineTool({
    name: "git_stage",
    description: "\u4F1A\u4FEE\u6539\u4ED3\u5E93\u6682\u5B58\u533A\uFF1A\u6682\u5B58\u6307\u5B9A\u6587\u4EF6\uFF1B\u672A\u63D0\u4F9B\u6587\u4EF6\u6216\u5217\u8868\u4E3A\u7A7A\u65F6\u6682\u5B58\u5168\u90E8\u6539\u52A8\u3002",
    parameters: {
      cwd: parameter("string", cwdDescription, true),
      files: parameter("array", "\u8981\u6682\u5B58\u7684\u4ED3\u5E93\u76F8\u5BF9\u8DEF\u5F84\uFF1B\u7701\u7565\u6216\u7A7A\u6570\u7EC4\u8868\u793A\u6682\u5B58\u5168\u90E8\u6539\u52A8\u3002", false, { items: { type: "string" } })
    },
    output: {
      schema: actionResultSchema(),
      render: (_args, value) => textResult(actionSummary("\u6682\u5B58", value))
    },
    async execute(args) {
      try {
        const files = args.files;
        return files === void 0 || Array.isArray(files) && files.length === 0 ? await service.stageAll(args.cwd) : await service.stage(args.cwd, files);
      } catch (error) {
        return { ok: false, error: errorText(error) };
      }
    }
  });
}
function gitUnstageTool(service) {
  return defineTool({
    name: "git_unstage",
    description: "\u4F1A\u4FEE\u6539\u4ED3\u5E93\u6682\u5B58\u533A\uFF1A\u53D6\u6D88\u6682\u5B58\u6307\u5B9A\u6587\u4EF6\uFF1B\u672A\u63D0\u4F9B\u6587\u4EF6\u6216\u5217\u8868\u4E3A\u7A7A\u65F6\u53D6\u6D88\u6682\u5B58\u5168\u90E8\u6539\u52A8\u3002",
    parameters: {
      cwd: parameter("string", cwdDescription, true),
      files: parameter("array", "\u8981\u53D6\u6D88\u6682\u5B58\u7684\u4ED3\u5E93\u76F8\u5BF9\u8DEF\u5F84\uFF1B\u7701\u7565\u6216\u7A7A\u6570\u7EC4\u8868\u793A\u53D6\u6D88\u6682\u5B58\u5168\u90E8\u6539\u52A8\u3002", false, { items: { type: "string" } })
    },
    output: {
      schema: actionResultSchema(),
      render: (_args, value) => textResult(actionSummary("\u53D6\u6D88\u6682\u5B58", value))
    },
    async execute(args) {
      try {
        const files = args.files;
        return files === void 0 || Array.isArray(files) && files.length === 0 ? await service.unstageAll(args.cwd) : await service.unstage(args.cwd, files);
      } catch (error) {
        return { ok: false, error: errorText(error) };
      }
    }
  });
}
function gitCommitTool(service) {
  return defineTool({
    name: "git_commit",
    description: "\u4F1A\u4FEE\u6539\u4ED3\u5E93\u5386\u53F2\uFF1A\u521B\u5EFA\u63D0\u4EA4\uFF1Bamend \u4F1A\u6539\u5199\u6700\u8FD1\u4E00\u6B21\u63D0\u4EA4\uFF0C\u53D7\u5B89\u5168\u9650\u5236\u9700\u5728\u4EBA\u7C7B Git \u9762\u677F\u4E2D\u6267\u884C\u3002",
    parameters: {
      cwd: parameter("string", cwdDescription, true),
      message: parameter("string", "\u63D0\u4EA4\u8BF4\u660E\u3002"),
      all: parameter("boolean", "\u662F\u5426\u540C\u65F6\u6682\u5B58\u5E76\u63D0\u4EA4\u6240\u6709\u5DF2\u8DDF\u8E2A\u6587\u4EF6\u7684\u6539\u52A8\u3002"),
      amend: parameter("boolean", "\u662F\u5426\u6539\u5199\u6700\u8FD1\u4E00\u6B21\u63D0\u4EA4\u3002")
    },
    output: {
      schema: actionResultSchema({
        hash: { type: "string" },
        shortHash: { type: "string" },
        summary: { type: "string" }
      }),
      render: (_args, value) => textResult(value.ok ? `\u63D0\u4EA4\u6210\u529F${value.shortHash ? `\uFF1A${value.shortHash}` : ""}${value.summary ? ` ${value.summary}` : ""}\u3002` : actionSummary("\u63D0\u4EA4", value))
    },
    async execute(args) {
      try {
        return await service.createCommit(args.cwd, {
          message: args.message,
          all: args.all,
          amend: args.amend
        });
      } catch (error) {
        return { ok: false, error: errorText(error) };
      }
    }
  });
}
function stashListSchema() {
  return {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        index: { type: "number", required: true },
        selector: { type: "string", required: true },
        hash: { type: "string", required: true },
        shortHash: { type: "string", required: true },
        subject: { type: "string", required: true },
        branch: { type: "string" },
        date: { type: "string", required: true }
      }
    }
  };
}
function gitStashTool(service) {
  return defineTool({
    name: "git_stash",
    description: "\u5217\u51FA\u50A8\u85CF\u5185\u5BB9\u4E3A\u53EA\u8BFB\uFF1Bpush\u3001pop\u3001apply \u4F1A\u4FEE\u6539\u5DE5\u4F5C\u533A\uFF0Cdrop \u4F1A\u5220\u9664\u50A8\u85CF\u4E14\u4EC5\u53EF\u5728\u4EBA\u7C7B Git \u9762\u677F\u4E2D\u6267\u884C\u3002",
    parameters: {
      cwd: parameter("string", cwdDescription, true),
      action: parameter("string", "\u50A8\u85CF\u64CD\u4F5C\u3002", true, { enum: ["list", "push", "pop", "apply", "drop"] }),
      message: parameter("string", "\u521B\u5EFA\u50A8\u85CF\u65F6\u4F7F\u7528\u7684\u8BF4\u660E\u3002"),
      index: parameter("number", "\u8981\u6062\u590D\u6216\u5220\u9664\u7684\u50A8\u85CF\u5E8F\u53F7\uFF0C\u9ED8\u8BA4 0\u3002")
    },
    output: {
      schema: {
        oneOf: [
          stashListSchema(),
          actionResultSchema()
        ]
      },
      render: (args, value) => textResult(Array.isArray(value) ? `\u50A8\u85CF\u5217\u8868\uFF1A${value.length} \u6761\u3002` : actionSummary(args.action === "push" ? "\u521B\u5EFA\u50A8\u85CF" : args.action === "pop" ? "\u6062\u590D\u5E76\u5220\u9664\u50A8\u85CF" : args.action === "apply" ? "\u5E94\u7528\u50A8\u85CF" : "\u5220\u9664\u50A8\u85CF", value))
    },
    async execute(args) {
      try {
        if (args.action === "list") return await service.stashes(args.cwd);
        const index = args.index ?? 0;
        if (args.action === "push") return await service.stashPush(args.cwd, { message: args.message });
        if (args.action === "pop") return await service.stashApply(args.cwd, index, { pop: true });
        if (args.action === "apply") return await service.stashApply(args.cwd, index, { pop: false });
        if (args.action === "drop") return await service.stashDrop(args.cwd, index);
        return { ok: false, error: "\u4E0D\u652F\u6301\u7684\u50A8\u85CF\u64CD\u4F5C" };
      } catch (error) {
        if (args.action === "list") throw error;
        return { ok: false, error: errorText(error) };
      }
    }
  });
}
function branchListSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      current: { type: "string", required: true },
      dirtyFiles: { type: "number", required: true },
      branches: {
        type: "array",
        required: true,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string", required: true },
            current: { type: "boolean", required: true },
            isRemote: { type: "boolean", required: true },
            upstream: { type: "string" },
            ahead: { type: "number" },
            behind: { type: "number" },
            subject: { type: "string" },
            hash: { type: "string" }
          }
        }
      }
    }
  };
}
function switchResultSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      ok: { type: "boolean", required: true },
      branch: { type: "string" },
      error: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: { type: "string", required: true },
          message: { type: "string", required: true }
        }
      }
    }
  };
}
function gitBranchTool(service) {
  return defineTool({
    name: "git_branch",
    description: "list \u4E3A\u53EA\u8BFB\uFF1Bcreate \u548C switch \u4F1A\u4FEE\u6539\u4ED3\u5E93\u5F53\u524D\u5206\u652F\u6216\u521B\u5EFA\u65B0\u5206\u652F\u3002",
    parameters: {
      cwd: parameter("string", cwdDescription, true),
      action: parameter("string", "\u5206\u652F\u64CD\u4F5C\u3002", true, { enum: ["list", "create", "switch"] }),
      name: parameter("string", "\u8981\u521B\u5EFA\u6216\u5207\u6362\u5230\u7684\u5206\u652F\u540D\u3002"),
      base: parameter("string", "\u521B\u5EFA\u5206\u652F\u65F6\u4F7F\u7528\u7684\u8D77\u70B9\u7248\u672C\u6216\u5206\u652F\u3002")
    },
    output: {
      schema: { oneOf: [branchListSchema(), switchResultSchema()] },
      render: (args, value) => textResult(args.action === "list" ? `\u5206\u652F\u5217\u8868\uFF1A${value.branches.length} \u4E2A\uFF0C\u5F53\u524D\u5206\u652F\u4E3A ${value.current || "\u65E0"}\u3002` : actionSummary(args.action === "create" ? "\u521B\u5EFA\u5206\u652F" : "\u5207\u6362\u5206\u652F", value))
    },
    async execute(args) {
      try {
        if (args.action === "list") return await service.branches(args.cwd);
        if (args.action === "create") return await service.createBranch(args.cwd, args.name, args.base);
        if (args.action === "switch") return await service.switchBranch(args.cwd, args.name);
        return { ok: false, error: { code: "invalid-action", message: "\u4E0D\u652F\u6301\u7684\u5206\u652F\u64CD\u4F5C" } };
      } catch (error) {
        if (args.action === "list") throw error;
        return { ok: false, error: { code: "git-tool-error", message: errorText(error) } };
      }
    }
  });
}
function isRecord2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function registerGitTools(ctx, service) {
  if (typeof ctx?.tools?.register !== "function") {
    console.warn("dsh-plugin-git: \u5F53\u524D DSH \u7248\u672C\u4E0D\u652F\u6301\u5DE5\u5177\u6CE8\u518C\uFF0C\u5DF2\u8DF3\u8FC7 Git \u5DE5\u5177");
    return () => {
    };
  }
  const disposers = [];
  const factories = [
    () => gitStatusTool(service),
    () => gitDiffTool(service),
    () => gitLogTool(service),
    () => gitStageTool(service),
    () => gitUnstageTool(service),
    () => gitCommitTool(service),
    () => gitStashTool(service),
    () => gitBranchTool(service)
  ];
  for (const createDefinition of factories) {
    try {
      const definition = createDefinition();
      const dispose = ctx.tools.register(definition);
      if (typeof dispose === "function") disposers.push(dispose);
    } catch (error) {
      console.warn(`dsh-plugin-git: Git \u5DE5\u5177\u5B9A\u4E49\u6216\u6CE8\u518C\u5931\u8D25\uFF1A${errorText(error)}`);
    }
  }
  if (typeof ctx?.on === "function") {
    try {
      const dispose = ctx.on("tools/pre-execute", async (exec, next) => {
        let name;
        let args;
        try {
          if (!isRecord2(exec) || typeof exec.name !== "string") return next();
          name = exec.name;
          args = exec.arguments;
        } catch {
          return next();
        }
        if (!toolNames.has(name) || !isRecord2(args)) return next();
        if (name === "git_commit" && args.amend === true) {
          return { kind: "deny", reason: "\u6539\u5199\u6700\u8FD1\u4E00\u6B21\u63D0\u4EA4\u4F1A\u91CD\u5199\u63D0\u4EA4\u5386\u53F2\uFF0C\u8BF7\u6539\u7531\u4F60\u5728 Git \u9762\u677F\u4E2D\u6267\u884C\u3002" };
        }
        if (name === "git_stash" && args.action === "drop") {
          return { kind: "deny", reason: "\u5220\u9664\u50A8\u85CF\u8BB0\u5F55\u53EF\u80FD\u65E0\u6CD5\u6062\u590D\uFF0C\u8BF7\u6539\u7531\u4F60\u5728 Git \u9762\u677F\u4E2D\u6267\u884C\u3002" };
        }
        return next();
      });
      if (typeof dispose === "function") disposers.push(dispose);
    } catch (error) {
      console.warn(`dsh-plugin-git: Git \u5DE5\u5177\u5BA1\u6279\u94A9\u5B50\u6CE8\u518C\u5931\u8D25\uFF1A${errorText(error)}`);
    }
  }
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    for (const dispose of disposers.reverse()) {
      try {
        dispose();
      } catch (error) {
        console.warn(`dsh-plugin-git: Git \u5DE5\u5177\u6E05\u7406\u5931\u8D25\uFF1A${errorText(error)}`);
      }
    }
  };
}

// src/index.ts
var inject = ["webServer", "workspaceRegistry"];
function apply(ctx) {
  const runner = createGitRunner();
  const service = new GitService(runner);
  ctx.effect(() => registerRoutes(ctx, service), "dsh-plugin-git: routes");
  ctx.inject(["tools"], (toolsCtx) => {
    toolsCtx.effect(() => registerGitTools(toolsCtx, service), "dsh-plugin-git: agent tools");
  });
}
export {
  apply,
  inject
};
//# sourceMappingURL=index.js.map
