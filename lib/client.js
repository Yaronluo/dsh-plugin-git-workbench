window.__ModuleLoader__.load({
  id: "dsh-plugin-git-workbench",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/api.ts
function getEndpointUrl(endpoint) {
  return `/dsh-git/${endpoint.replace(/^\/+/, "")}`;
}
function errorMessage(error) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Git request failed";
}
async function postJson(endpoint, body, signal) {
  const res = await fetch(getEndpointUrl(endpoint), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal
  });
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}: ${res.statusText || "The server returned an invalid response"}`);
  }
  if (!res.ok || json?.ok === false) {
    const error = new Error(json?.error ? errorMessage(json.error) : `HTTP ${res.status}: ${res.statusText}`);
    if (json?.error?.code) Object.assign(error, { code: json.error.code });
    throw error;
  }
  if (json === null || typeof json !== "object") throw new Error("The Git server returned an invalid response");
  return json.value !== void 0 ? json.value : json;
}
function blobUrl(path, file, stamp) {
  const params = new URLSearchParams({ path, file });
  if (stamp) params.set("v", stamp);
  return `${getEndpointUrl("blob")}?${params.toString()}`;
}
function diffRequest(path, body, signal) {
  return postJson("diff", body, signal);
}
var gitApi;
var init_api = __esm({
  "src/client/api.ts"() {
    "use strict";
    gitApi = {
      getStatus(path, signal) {
        return postJson("status", { path }, signal);
      },
      getBranches(path, signal) {
        return postJson("branches", { path }, signal);
      },
      switchBranch(path, branch) {
        return postJson("switch", { path, branch });
      },
      createBranch(path, name, base) {
        return postJson("create-branch", { path, name, base });
      },
      deleteBranch(path, name, force = false) {
        return postJson("delete-branch", { path, name, force });
      },
      /**
       * The diff of the whole comparison. The extra `options` keep this call site testable and
       * backwards compatible: the panel asks for one comparison, not one request per section.
       */
      getDiff(path, base, target, signal, options = {}) {
        return diffRequest(path, { path, base, target, ...options }, signal);
      },
      /** The same endpoint as {@link getDiff}, with the full option set. */
      requestDiff(path, request = {}, signal) {
        return diffRequest(path, { path, ...request }, signal);
      },
      getWorktrees(path, signal) {
        return postJson("worktrees", { path }, signal);
      },
      getWorktreesWithStatus(path, signal) {
        return postJson("worktrees-status", { path }, signal);
      },
      createWorktree(path, name, base) {
        return postJson("create-worktree", { path, name, base });
      },
      removeWorktree(path, worktreePath, force = false) {
        return postJson("remove-worktree", { path, worktreePath, force });
      },
      lockWorktree(path, worktreePath, reason) {
        return postJson("lock-worktree", { path, worktreePath, reason });
      },
      unlockWorktree(path, worktreePath) {
        return postJson("unlock-worktree", { path, worktreePath });
      },
      pruneWorktrees(path, dryRun = false) {
        return postJson("prune-worktrees", { path, dryRun });
      },
      getLog(path, limit = 50, signal) {
        return postJson("log", { path, limit }, signal);
      },
      getFileLog(path, file, limit = 50, signal) {
        return postJson("log", { path, file, limit }, signal);
      },
      getCommitDetail(path, ref, signal) {
        return postJson("commit-detail", { path, ref }, signal);
      },
      getFileHistory(path, file, limit = 50, signal) {
        return postJson("file-history", { path, file, limit }, signal);
      },
      getBlame(path, file, maxLines = 5e3, signal) {
        return postJson("blame", { path, file, maxLines }, signal);
      },
      getReflog(path, limit = 100, signal) {
        return postJson("reflog", { path, limit }, signal);
      },
      getStashes(path, signal) {
        return postJson("stashes", { path }, signal);
      },
      getStashDiff(path, index, signal) {
        return postJson("stash-show", { path, index }, signal);
      },
      getTags(path, signal) {
        return postJson("tags", { path }, signal);
      },
      getRemotes(path, signal) {
        return postJson("remotes", { path }, signal);
      },
      getOperation(path, signal) {
        return postJson("operation", { path }, signal);
      },
      getConflicts(path, signal) {
        return postJson("conflicts", { path }, signal);
      },
      getChanges(path, signal) {
        return postJson("changes", { path }, signal);
      },
      getLastCommitMessage(path, signal) {
        return postJson("last-commit-message", { path }, signal);
      },
      // ---- working tree ---------------------------------------------------------------
      stage(path, files) {
        return postJson("stage", { path, files });
      },
      stageAll(path) {
        return postJson("stage-all", { path });
      },
      unstage(path, files) {
        return postJson("unstage", { path, files });
      },
      unstageAll(path) {
        return postJson("unstage-all", { path });
      },
      discard(path, files, staged = false) {
        return postJson("discard", { path, files, staged });
      },
      deleteUntracked(path, files) {
        return postJson("delete-untracked", { path, files });
      },
      applyPatch(path, patch, options = {}) {
        return postJson("apply-patch", { path, patch, ...options });
      },
      addToGitignore(path, files, local = false) {
        return postJson("write-gitignore", { path, files, local });
      },
      // ---- commit ---------------------------------------------------------------------
      commit(path, request) {
        return postJson("commit", { path, ...request });
      },
      undoCommit(path) {
        return postJson("undo-commit", { path });
      },
      resetTo(path, ref, mode = "soft") {
        return postJson("reset", { path, ref, mode });
      },
      resolveConflict(path, file, side) {
        return postJson("conflict-resolve", { path, file, side });
      },
      // ---- sequencing operations ------------------------------------------------------
      merge(path, ref) {
        return postJson("merge", { path, ref });
      },
      rebase(path, ref) {
        return postJson("rebase", { path, ref });
      },
      cherryPick(path, ref) {
        return postJson("cherry-pick", { path, ref });
      },
      revert(path, ref) {
        return postJson("revert", { path, ref });
      },
      operationStep(path, step) {
        return postJson("operation-step", { path, step });
      },
      // ---- remotes --------------------------------------------------------------------
      fetch(path, options = {}) {
        return postJson("fetch", { path, ...options });
      },
      pull(path, options = {}) {
        return postJson("pull", { path, ...options });
      },
      push(path, request = {}) {
        return postJson("push", { path, ...request });
      },
      // ---- stash and tags --------------------------------------------------------------
      stashPush(path, options = {}) {
        return postJson("stash-push", { path, ...options });
      },
      stashApply(path, index, pop = false) {
        return postJson("stash-apply", { path, index, pop });
      },
      stashDrop(path, index) {
        return postJson("stash-drop", { path, index });
      },
      tagCreate(path, name, options = {}) {
        return postJson("tag-create", { path, name, ...options });
      },
      tagDelete(path, name) {
        return postJson("tag-delete", { path, name });
      },
      /** Editors this machine can actually open files with, for the header's picker. */
      listEditors() {
        return postJson("editors", {});
      },
      /**
       * Opens a repository-relative file (or the repository itself) in the user's editor.
       * `editor` is a command from `listEditors()`, or `'system'` for the OS default app;
       * omitting it keeps the host's own probing.
       */
      openInEditor(path, file, line, editor) {
        return postJson("open-in-editor", { path, file, line, editor });
      },
      /** Shows the file (or the repository folder) in the platform file manager. */
      reveal(path, file) {
        return postJson("reveal", { path, file });
      },
      subscribeEvents(path, onStatus, onError) {
        if (typeof EventSource === "undefined") return () => {
        };
        let source;
        try {
          source = new EventSource(`${getEndpointUrl("events")}?path=${encodeURIComponent(path)}`);
        } catch (error) {
          onError?.(new Error(errorMessage(error)));
          return () => {
          };
        }
        source.addEventListener("status", (event) => {
          try {
            onStatus(JSON.parse(event.data));
          } catch (error) {
            onError?.(new Error(errorMessage(error)));
          }
        });
        source.addEventListener("status-error", (event) => {
          try {
            onError?.(new Error(errorMessage(JSON.parse(event.data).error)));
          } catch {
            onError?.(new Error("Failed to update Git status"));
          }
        });
        source.onerror = () => onError?.(new Error("The live Git connection was interrupted; reconnecting"));
        return () => source.close();
      }
    };
  }
});

// src/client/dialogs/CommitDetailDialog.tsx
var CommitDetailDialog_exports = {};
__export(CommitDetailDialog_exports, {
  CommitDetailDialog: () => CommitDetailDialog
});
function errorText(error, fallback) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return fallback;
}
function statusLetter(status) {
  if (status === "added") return "A";
  if (status === "deleted") return "D";
  if (status === "renamed") return "R";
  if (status === "copied") return "C";
  if (status === "typechange") return "T";
  if (status === "modified") return "M";
  return "?";
}
function CommitDetailDialog({ path, commitRef, onClose, showBackButton = true }) {
  const selectedRef = commitRef;
  const [detail, setDetail] = (0, import_react8.useState)(null);
  const [loading, setLoading] = (0, import_react8.useState)(true);
  const [error, setError] = (0, import_react8.useState)(null);
  const [selectedFile, setSelectedFile] = (0, import_react8.useState)(null);
  const [diffView, setDiffView] = (0, import_react8.useState)(null);
  const [diffLoading, setDiffLoading] = (0, import_react8.useState)(false);
  const [diffError, setDiffError] = (0, import_react8.useState)(null);
  const [action, setAction] = (0, import_react8.useState)(null);
  const [actionName, setActionName] = (0, import_react8.useState)("");
  const [actionBusy, setActionBusy] = (0, import_react8.useState)(false);
  const [notice, setNotice] = (0, import_react8.useState)(null);
  const detailRequestKey = JSON.stringify([path, selectedRef]);
  const [detailLoadedFor, setDetailLoadedFor] = (0, import_react8.useState)(null);
  const diffRequestKey = JSON.stringify([path, selectedRef, selectedFile?.path ?? null]);
  const [diffLoadedFor, setDiffLoadedFor] = (0, import_react8.useState)(null);
  const currentDetail = detailLoadedFor === detailRequestKey ? detail : null;
  const currentError = detailLoadedFor === detailRequestKey ? error : null;
  const currentLoading = detailLoadedFor !== detailRequestKey || loading;
  const currentDiffView = diffLoadedFor === diffRequestKey ? diffView : null;
  const currentDiffError = diffLoadedFor === diffRequestKey ? diffError : null;
  const currentDiffLoading = !!selectedFile && (diffLoadedFor !== diffRequestKey || diffLoading);
  (0, import_react8.useEffect)(() => {
    if (!selectedRef) {
      setError("Invalid commit reference");
      setLoading(false);
      setDetailLoadedFor(detailRequestKey);
      return;
    }
    const controller = new AbortController();
    setDetail(null);
    setSelectedFile(null);
    setLoading(true);
    setError(null);
    setDetailLoadedFor(null);
    gitApi.getCommitDetail(path, selectedRef, controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        setDetail(result);
        setDetailLoadedFor(detailRequestKey);
      }
    }).catch((reason) => {
      if (!controller.signal.aborted) {
        setError(errorText(reason, "Failed to read commit details"));
        setDetailLoadedFor(detailRequestKey);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [path, selectedRef]);
  (0, import_react8.useEffect)(() => {
    if (!selectedFile) {
      setDiffView(null);
      setDiffError(null);
      setDiffLoading(false);
      setDiffLoadedFor(diffRequestKey);
      return;
    }
    const controller = new AbortController();
    setDiffView(null);
    setDiffError(null);
    setDiffLoading(true);
    setDiffLoadedFor(null);
    gitApi.requestDiff(path, { mode: "single", base: selectedRef, files: [selectedFile.path] }, controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        setDiffView(result);
        setDiffLoadedFor(diffRequestKey);
      }
    }).catch((reason) => {
      if (!controller.signal.aborted) {
        setDiffError(errorText(reason, "Failed to read file diff"));
        setDiffLoadedFor(diffRequestKey);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setDiffLoading(false);
    });
    return () => controller.abort();
  }, [path, selectedRef, selectedFile]);
  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(selectedRef);
      setNotice("Copied commit hash");
      setError(null);
    } catch (reason) {
      setError(errorText(reason, "Failed to copy hash"));
    }
  };
  const beginAction = (next) => {
    setAction(next);
    setActionName("");
    setError(null);
    setNotice(null);
  };
  const runAction = async () => {
    if (!action || actionBusy) return;
    const name = actionName.trim();
    if ((action === "tag" || action === "branch") && !name) {
      setError(action === "tag" ? "Please enter a tag name" : "Please enter a branch name");
      return;
    }
    setActionBusy(true);
    setError(null);
    setNotice(null);
    try {
      let result;
      let successNotice = "";
      if (action === "tag") {
        result = await gitApi.tagCreate(path, name, { ref: selectedRef });
        successNotice = `Created tag at this commit: ${name}`;
      } else if (action === "branch") {
        result = await gitApi.createBranch(path, name, selectedRef);
        successNotice = `Created branch from this commit: ${name}`;
      } else if (action === "revert") {
        result = await gitApi.revert(path, selectedRef);
        successNotice = "Reverted this commit";
      } else {
        result = await gitApi.cherryPick(path, selectedRef);
        successNotice = "Cherry-picked this commit onto the current branch";
      }
      if (!result.ok) {
        setError(errorText(result.error, "Operation failed"));
        return;
      }
      setNotice(successNotice);
      setAction(null);
      setActionName("");
    } catch (reason) {
      setError(errorText(reason, "Operation failed"));
    } finally {
      setActionBusy(false);
    }
  };
  const activeDiff = currentDiffView?.files[0];
  const actionLabel = action === "tag" ? "Tag" : action === "branch" ? "Create branch here" : action === "revert" ? "Revert this commit" : "Cherry-pick onto current branch";
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-section", children: [
    showBackButton && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-panel-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: onClose, children: "Back" }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dsh-git-muted", children: "Commit details" })
    ] }),
    currentLoading ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dsh-git-muted", children: "Reading commit details\u2026" }) : currentError && !currentDetail ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "dsh-git-error", role: "alert", children: currentError }) : currentDetail && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("pre", { className: "dsh-git-detail-message", children: [
        currentDetail.subject,
        currentDetail.body ? `

${currentDetail.body}` : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-detail-meta", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: "Commit" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: currentDetail.subject }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: "Author" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: currentDetail.author }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: "Email" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: currentDetail.authorEmail }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: "Committer" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: currentDetail.committer }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: "Date" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: currentDetail.commitDate || currentDetail.date }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: "hash" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("code", { children: currentDetail.hash }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: "Parent commit" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: currentDetail.parents.join(", ") || "None" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("section", { className: "dsh-git-section", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-section-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
            "Changed files (",
            currentDetail.files.length,
            ")"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dsh-git-spacer" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dsh-git-ins", children: [
              "+",
              currentDetail.totalInsertions
            ] }),
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dsh-git-del", children: [
              "-",
              currentDetail.totalDeletions
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dsh-git-scroll-list", children: currentDetail.files.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dsh-git-muted", children: "This commit has no file changes" }) : currentDetail.files.map((file) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "button",
          {
            type: "button",
            className: "dsh-git-detail-file",
            "aria-pressed": selectedFile?.path === file.path,
            onClick: () => setSelectedFile(file),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dsh-git-badge", children: statusLetter(file.status) }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("code", { children: file.path }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dsh-git-ins", children: [
                "+",
                file.insertions
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dsh-git-del", children: [
                "-",
                file.deletions
              ] })
            ]
          },
          `${file.path}-${file.status}`
        )) })
      ] }),
      selectedFile && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("section", { className: "dsh-git-section", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dsh-git-section-head", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("code", { children: selectedFile.path }) }),
        currentDiffError && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "dsh-git-error", role: "alert", children: currentDiffError }),
        currentDiffLoading ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dsh-git-muted", children: "Reading file diff\u2026" }) : activeDiff?.binary ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dsh-git-binary-note", children: "The file is binary; the diff was not expanded" }) : activeDiff && activeDiff.hunks.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("pre", { className: "dsh-git-code-box", children: activeDiff.rawPatch }) : activeDiff && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dsh-git-diff-lines", children: activeDiff.hunks.map((hunk, hunkIndex) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-hunk-header", children: [
            "+",
            hunk.newStart,
            " ",
            hunk.oldStart,
            " ",
            hunk.header
          ] }),
          hunk.lines.map((line, lineIndex) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
            "div",
            {
              className: `dsh-git-diff-row${line.type === "add" ? " dsh-git-row-add" : line.type === "del" ? " dsh-git-row-del" : ""}`,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dsh-git-line-num", children: line.oldNum ?? "" }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dsh-git-line-num", children: line.newNum ?? "" }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "dsh-git-line-content", children: [
                  line.type === "add" ? "+ " : line.type === "del" ? "- " : "  ",
                  line.content
                ] })
              ]
            },
            `${line.oldNum}-${line.newNum}-${lineIndex}`
          ))
        ] }, `${hunk.oldStart}-${hunk.newStart}-${hunkIndex}`)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("section", { className: "dsh-git-section", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dsh-git-section-head", children: "Commit actions" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-inline-form", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: copyHash, children: "Copy hash" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: () => beginAction("tag"), children: "Tag" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: () => beginAction("branch"), children: "Create branch here" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: () => beginAction("revert"), children: "Revert this commit" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: () => beginAction("cherry-pick"), children: "Cherry-pick onto current branch" })
        ] }),
        notice && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "dsh-git-muted", role: "status", children: notice }),
        currentError && currentDetail && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "dsh-git-error", role: "alert", children: currentError }),
        action && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-section", role: "group", "aria-label": `${actionLabel}Confirm`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-section-head", children: [
            "Confirm",
            actionLabel
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { children: action === "tag" ? "Creates a new tag at this commit." : action === "branch" ? "Creates a new branch from this commit and switches to it." : action === "revert" ? "Creates a new commit that undoes the changes of this commit." : "Applies this commit to the current branch; may cause conflicts." }),
          (action === "tag" || action === "branch") && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "input",
            {
              className: "dsh-git-input",
              value: actionName,
              placeholder: action === "tag" ? "Tag name" : "Branch name",
              "aria-label": action === "tag" ? "Tag name" : "Branch name",
              onChange: (event) => setActionName(event.target.value)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-inline-form", children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-primary", disabled: actionBusy, onClick: runAction, children: [
              "Confirm",
              actionLabel
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: actionBusy, onClick: () => setAction(null), children: "Cancel" })
          ] })
        ] })
      ] })
    ] })
  ] });
}
var import_react8, import_jsx_runtime8;
var init_CommitDetailDialog = __esm({
  "src/client/dialogs/CommitDetailDialog.tsx"() {
    "use strict";
    import_react8 = require("react");
    init_api();
    import_jsx_runtime8 = require("react/jsx-runtime");
  }
});

// src/client/dialogs/ReflogPanel.tsx
var ReflogPanel_exports = {};
__export(ReflogPanel_exports, {
  ReflogPanel: () => ReflogPanel
});
function errorText2(error, fallback) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return fallback;
}
function ReflogPanel({ path }) {
  const [entries, setEntries] = (0, import_react9.useState)([]);
  const [loading, setLoading] = (0, import_react9.useState)(true);
  const [error, setError] = (0, import_react9.useState)(null);
  const [refresh, setRefresh] = (0, import_react9.useState)(0);
  const [pending, setPending] = (0, import_react9.useState)(null);
  const [busy, setBusy] = (0, import_react9.useState)(false);
  const [notice, setNotice] = (0, import_react9.useState)(null);
  (0, import_react9.useEffect)(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    gitApi.getReflog(path, 100, controller.signal).then((result) => {
      if (!controller.signal.aborted) setEntries(result);
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(errorText2(reason, "Failed to read reflog"));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [path, refresh]);
  const copyHash = async () => {
    if (!pending) return;
    try {
      await navigator.clipboard.writeText(pending.hash);
      setNotice("Copied commit hash");
      setError(null);
    } catch (reason) {
      setError(errorText2(reason, "Failed to copy hash"));
    }
  };
  const resetToEntry = async () => {
    if (!pending || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await gitApi.resetTo(path, pending.selector, "soft");
      if (!result.ok) {
        setError(result.error || "Soft reset failed");
        return;
      }
      setNotice(`Soft reset to ${pending.selector}`);
      setPending(null);
      setRefresh((value) => value + 1);
    } catch (reason) {
      setError(errorText2(reason, "Soft reset failed"));
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "dsh-git-scroll-list", children: [
    notice && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "dsh-git-muted", role: "status", children: notice }),
    error && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "dsh-git-error", role: "alert", children: error }),
    loading ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "dsh-git-muted", children: "Reading reflog\u2026" }) : entries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "dsh-git-empty-state", children: "No reflog entries" }) : entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
      "button",
      {
        type: "button",
        className: "dsh-git-reflog-row",
        "aria-pressed": pending?.selector === entry.selector,
        onClick: () => {
          setPending(entry);
          setError(null);
          setNotice(null);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("code", { children: entry.selector }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: entry.subject }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("code", { children: entry.shortHash }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("time", { children: entry.date })
        ]
      },
      `${entry.selector}-${entry.hash}`
    )),
    pending && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("section", { className: "dsh-git-section", "aria-label": "Confirm soft reset", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "dsh-git-section-head", children: "Confirm soft reset" }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("p", { children: [
        "Soft reset the current branch to ",
        pending.selector,
        "(",
        pending.shortHash,
        "), keeping the working tree and staged file contents. This moves the current branch pointer."
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "dsh-git-inline-form", children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-primary", disabled: busy, onClick: resetToEntry, children: "Soft reset to here" }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: busy, onClick: () => setPending(null), children: "Cancel" }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: copyHash, children: "Copy hash" })
      ] })
    ] })
  ] });
}
var import_react9, import_jsx_runtime9;
var init_ReflogPanel = __esm({
  "src/client/dialogs/ReflogPanel.tsx"() {
    "use strict";
    import_react9 = require("react");
    init_api();
    import_jsx_runtime9 = require("react/jsx-runtime");
  }
});

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  BranchChip: () => BranchChip,
  ChangesTab: () => ChangesTab,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/chips/BranchChip.tsx
var import_react4 = require("react");
init_api();

// src/client/icons.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function Icon({ size = 14, className = "", style, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round", className, style, "aria-hidden": "true", focusable: "false", children });
}
function IconBranch(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Icon, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6 7v10M6 14h5a7 7 0 0 0 7-7" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "6", cy: "5", r: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "6", cy: "19", r: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "18", cy: "5", r: "2" })
  ] });
}
function IconBranchPlus(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Icon, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6 7v10M6 15h4a6 6 0 0 0 6-6M17 4h4M19 2v4" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "6", cy: "5", r: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "6", cy: "19", r: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "16", cy: "7", r: "2" })
  ] });
}
function IconChevronDown({ size = 12, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { size, ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m7 10 5 5 5-5" }) });
}
function IconSearch(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Icon, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "10.5", cy: "10.5", r: "6.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m15.1 15.1 4.9 4.9" })
  ] });
}
function IconCheck(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m5 12 4.5 4.5L19 7" }) });
}
function IconDiff(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Icon, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 3v18M7.5 8v6M5 11h5M15 11h3" })
  ] });
}
function IconFile(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6" }) });
}
function IconRefresh(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 10a8 8 0 0 1 13.7-3.7L20 9M20 4v5h-5M20 14a8 8 0 0 1-13.7 3.7L4 15M4 20v-5h5" }) });
}
function IconClose(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m6 6 12 12M18 6 6 18" }) });
}
function IconHistory(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6M12 7v5l3 2" }) });
}
function IconFolderTree(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Icon, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 7V6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 12.5v3M8 15h5.5a2.5 2.5 0 0 0 2.5-2.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "11", r: "1.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "17", r: "1.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "16", cy: "11", r: "1.5" })
  ] });
}
function IconWorktree(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconFolderTree, { ...props });
}
function IconExternalLink(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M14 4h6v6M20 4l-8.5 8.5M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6h4.5" }) });
}
function IconChevronUp({ size = 12, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { size, ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m7 14 5-5 5 5" }) });
}
function IconPlus(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 5v14M5 12h14" }) });
}
function IconMinus(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5 12h14" }) });
}
function IconUndo(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Icon, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9 14 4 9l5-5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 9h10.5a5.5 5.5 0 0 1 0 11H10" })
  ] });
}
function IconCommit(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Icon, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 12h6M15 12h6" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "3.2" })
  ] });
}
function IconStash(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Icon, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "4", width: "18", height: "4.5", rx: "1.2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4" })
  ] });
}
function IconCopy(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Icon, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "9", y: "9", width: "11", height: "11", rx: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M15 6.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v8.5A1.5 1.5 0 0 0 5 15h1.5" })
  ] });
}
function IconTrash(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6.5 7l.8 12.1a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7M10.5 11v6M13.5 11v6" }) });
}
function IconWarning(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Icon, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10.3 4.3 2.6 17.6A1.9 1.9 0 0 0 4.3 20.5h15.4a1.9 1.9 0 0 0 1.7-2.9L13.7 4.3a1.9 1.9 0 0 0-3.4 0Z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 9.5v4M12 16.6v.4" })
  ] });
}
function IconArrowUp(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 19V5M6.5 10.5 12 5l5.5 5.5" }) });
}
function IconArrowDown(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 5v14M17.5 13.5 12 19l-5.5-5.5" }) });
}
function IconPush(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Icon, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M7 17.5a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18.2 9.4 4 4 0 0 1 17.6 17.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 21v-7M9.2 16.2 12 13.4l2.8 2.8" })
  ] });
}
function IconPull(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Icon, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M7 17.5a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18.2 9.4 4 4 0 0 1 17.6 17.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 13v7M9.2 17.2 12 20l2.8-2.8" })
  ] });
}
function IconCloudRefresh(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Icon, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M7 18a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18 10" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 6v4h-4M20 10a5.5 5.5 0 0 1-9.4 3.9M4 18v-4h4M4 14a5.5 5.5 0 0 1 9.4-3.9" })
  ] });
}
function IconColumns(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Icon, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "4", width: "7.5", height: "16", rx: "1.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "13.5", y: "4", width: "7.5", height: "16", rx: "1.5" })
  ] });
}
function IconImage(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Icon, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "4.5", width: "18", height: "15", rx: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8.5", cy: "10", r: "1.4" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m4 17 4.8-4.4a1.6 1.6 0 0 1 2.2 0L16 17.5M14.5 15l1.6-1.5a1.6 1.6 0 0 1 2.2 0L20 15" })
  ] });
}
function IconSparkle(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Icon, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9Z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M18 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z" })
  ] });
}

// src/client/hooks/use-git-status.ts
var import_react = require("react");
init_api();

// src/client/hooks/latest-request.ts
function createLatestRequestScope(path) {
  let disposed = false;
  let generation = 0;
  let controller;
  const invalidate = () => {
    ++generation;
    controller?.abort();
  };
  return {
    path,
    get disposed() {
      return disposed;
    },
    invalidate,
    begin() {
      invalidate();
      controller = new AbortController();
      const request = controller;
      const version = generation;
      if (disposed) request.abort();
      return {
        signal: request.signal,
        isCurrent: () => !disposed && version === generation && !request.signal.aborted
      };
    },
    dispose() {
      disposed = true;
      invalidate();
    }
  };
}

// src/client/hooks/use-git-status.ts
function useGitStatus(path) {
  const [snapshot, setSnapshot] = (0, import_react.useState)({ path, status: null, loading: !!path, error: null });
  const active = (0, import_react.useRef)(null);
  const reload = (0, import_react.useCallback)(() => {
    const scope = active.current;
    if (!scope || scope.disposed || scope.path !== path || !path) return;
    const request = scope.begin();
    setSnapshot((previous) => ({ ...previous, loading: !previous.status, error: null }));
    gitApi.getStatus(path, request.signal).then((status) => {
      if (request.isCurrent()) {
        setSnapshot({ path, status, loading: false, error: null });
      }
    }).catch((error) => {
      if (request.isCurrent()) {
        setSnapshot((previous) => ({ ...previous, loading: false, error: error instanceof Error ? error.message : String(error) }));
      }
    });
  }, [path]);
  (0, import_react.useEffect)(() => {
    const scope = createLatestRequestScope(path);
    active.current = scope;
    setSnapshot({ path, status: null, loading: !!path, error: null });
    if (!path) return () => scope.dispose();
    reload();
    const unsubscribe = gitApi.subscribeEvents(path, (status) => {
      if (scope.disposed) return;
      scope.invalidate();
      setSnapshot({ path, status, loading: false, error: null });
    }, (error) => {
      if (!scope.disposed) setSnapshot((previous) => ({ ...previous, error: error instanceof Error ? error.message : String(error) }));
    });
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => {
      scope.dispose();
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [path, reload]);
  const current = snapshot.path === path ? snapshot : { status: null, loading: !!path, error: null };
  return { status: current.status, isGit: current.status?.isGit ?? false, loading: current.loading, error: current.error, reload };
}

// src/client/chips/BranchPopover.tsx
var import_react2 = require("react");
init_api();

// src/client/chips/branch-list.ts
function remoteCheckoutName(name) {
  return name.slice(name.indexOf("/") + 1);
}
function selectableBranches(branches) {
  const localNames = new Set(branches.filter((branch) => !branch.isRemote).map((branch) => branch.name));
  return branches.filter((branch) => !branch.isRemote || !localNames.has(branch.name) && !localNames.has(remoteCheckoutName(branch.name)));
}

// src/client/chips/BranchPopover.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var errorMessage2 = (error) => error instanceof Error ? error.message : typeof error === "string" ? error : "Remote sync failed";
function BranchPopover({
  view,
  path,
  status,
  onSwitch,
  onCreateBranch,
  onOpenGraph,
  onCreateWorktree,
  onManageWorktrees,
  onReloadStatus,
  onClose
}) {
  const restoreFocus = (0, import_react2.useRef)(typeof document === "undefined" ? null : document.activeElement);
  (0, import_react2.useEffect)(() => () => {
    if (restoreFocus.current?.isConnected) restoreFocus.current.focus();
  }, []);
  const [query, setQuery] = (0, import_react2.useState)("");
  const [switching, setSwitching] = (0, import_react2.useState)(null);
  const [syncing, setSyncing] = (0, import_react2.useState)(null);
  const [error, setError] = (0, import_react2.useState)(null);
  const [notice, setNotice] = (0, import_react2.useState)(null);
  const filtered = (0, import_react2.useMemo)(() => {
    const selectable = selectableBranches(view.branches);
    const q = query.trim().toLowerCase();
    if (!q) return selectable;
    return selectable.filter((b) => b.name.toLowerCase().includes(q));
  }, [view.branches, query]);
  const currentBranch = view.branches.find((branch) => branch.name === view.current);
  const ahead = status?.ahead ?? currentBranch?.ahead ?? 0;
  const behind = status?.behind ?? currentBranch?.behind ?? 0;
  const stashCount = status?.stashCount ?? 0;
  const diverged = ahead > 0 || behind > 0;
  const credentialHint = error && /credential|authentication|authorization|username|password|凭据|认证|密码|登录|401|403/i.test(error);
  const handleSwitch = async (branchName) => {
    if (branchName === view.current || switching || syncing) return;
    setSwitching(branchName);
    setError(null);
    setNotice(null);
    try {
      await onSwitch(branchName);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : typeof err === "string" ? err : "Failed to switch branch");
    } finally {
      setSwitching(null);
    }
  };
  const handleSync = async (action) => {
    if (syncing || switching) return;
    setSyncing(action);
    setError(null);
    setNotice(null);
    try {
      const result = action === "fetch" ? await gitApi.fetch(path, { prune: true }) : action === "pull" ? await gitApi.pull(path, { mode: "ff-only" }) : await gitApi.push(path, { setUpstream: true });
      if (!result.ok) {
        setError(result.error || "Remote sync failed");
        return;
      }
      const success = action === "fetch" ? "Fetched remote updates" : action === "pull" ? "Pulled" : "Pushed";
      setNotice(result.output ? `${success}:${result.output}` : success);
      if (action === "pull" || action === "push") onReloadStatus?.();
    } catch (syncError) {
      setError(errorMessage2(syncError));
    } finally {
      setSyncing(null);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-git-popover-backdrop", onClick: () => {
      if (!switching && !syncing) onClose();
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-git-popover", role: "dialog", "aria-label": "Git branches", "aria-busy": !!switching || !!syncing, onKeyDown: (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (!switching && !syncing) onClose();
      }
    }, onClick: (event) => event.stopPropagation(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-git-search-box", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconSearch, { size: 14 }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "input",
          {
            className: "dsh-git-search-input",
            placeholder: "Search branches",
            value: query,
            onChange: (event) => setQuery(event.target.value),
            autoFocus: true
          }
        )
      ] }),
      (diverged || stashCount > 0) && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-git-diverged", children: [
        ahead > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dsh-git-ahead", title: ` ahead of upstream ${ahead} commits`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconArrowUp, { size: 12 }),
          "Ahead ",
          ahead,
          " commits"
        ] }),
        behind > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dsh-git-behind", title: ` behind upstream ${behind} commits`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconArrowDown, { size: 12 }),
          "Behind ",
          behind,
          " commits"
        ] }),
        stashCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dsh-git-badge", children: [
          "Stashes ",
          stashCount
        ] })
      ] }),
      view.dirtyFiles > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-git-dirty-warning", children: [
        "Uncommitted changes: ",
        view.dirtyFiles,
        " files"
      ] }),
      error && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { role: "alert", className: "dsh-git-error dsh-git-popover-error", children: [
        error,
        credentialHint && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-git-muted", children: "If credentials are required or the network is unreachable, run it once manually in a terminal" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-git-branch-list", children: filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { padding: "16px 12px", textAlign: "center", color: "var(--dsw-alias-label-secondary)", fontSize: 13 }, children: "No matching branch" }) : filtered.map((branch) => {
        const isCurrent = branch.name === view.current;
        const isSwitching = switching === branch.name;
        return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "button",
          {
            type: "button",
            className: `dsh-git-branch-item ${isCurrent ? "dsh-git-branch-item-active" : ""}`,
            onClick: () => void handleSwitch(branch.name),
            disabled: switching !== null || syncing !== null,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-git-branch-item-left", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconBranch, { size: 14, className: isCurrent ? "text-primary" : "" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { title: branch.name, children: branch.name })
              ] }),
              isCurrent && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconCheck, { size: 14 }),
              isSwitching && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontSize: 11, color: "var(--dsw-alias-label-secondary)" }, children: "Switching..." })
            ]
          },
          branch.name
        );
      }) }),
      notice && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-git-popover-notice", role: "status", children: notice }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-git-popover-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", title: "Fetch remote updates", disabled: !!syncing || !!switching, "aria-busy": syncing === "fetch", onClick: () => void handleSync("fetch"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconCloudRefresh, { size: 15 }),
          syncing === "fetch" ? "Fetching\u2026" : "Fetch"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", title: "Pull remote updates", disabled: !!syncing || !!switching, "aria-busy": syncing === "pull", onClick: () => void handleSync("pull"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconPull, { size: 15 }),
          syncing === "pull" ? "Pulling\u2026" : "Pull"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", title: "Push local commits", disabled: !!syncing || !!switching, "aria-busy": syncing === "push", onClick: () => void handleSync("push"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconPush, { size: 15 }),
          syncing === "push" ? "Pushing\u2026" : "Push"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-git-footer", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "dsh-git-footer-btn", disabled: !!switching || !!syncing, onClick: onCreateBranch, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconBranchPlus, { size: 17 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Create and check out new branch\u2026" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "dsh-git-footer-btn", disabled: !!switching || !!syncing, onClick: onOpenGraph, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconHistory, { size: 17 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Commit history" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "dsh-git-footer-btn", disabled: !!switching || !!syncing, onClick: onCreateWorktree, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconFolderTree, { size: 17 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Create and open worktree\u2026" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "dsh-git-footer-btn", disabled: !!switching || !!syncing, onClick: onManageWorktrees, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconFolderTree, { size: 17 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Manage worktrees\u2026" })
        ] })
      ] })
    ] })
  ] });
}

// src/client/cwd-resolver.ts
var import_react3 = require("react");
var EMPTY_SESSIONS = { byId: {} };
var EMPTY_WORKSPACES = { items: [] };
var noSubscribe = (_listener) => () => {
};
var emptySessions = () => EMPTY_SESSIONS;
var emptyWorkspaces = () => EMPTY_WORKSPACES;
var identity = (value) => value;
function text(value) {
  return typeof value === "string" && value.trim() ? value : "";
}
function resolveWorkspaceCwd(props = {}, snapshots = {}) {
  const direct = text(props.cwd) || text(props.session?.cwd) || text(props.workspace?.path);
  if (direct) return direct;
  const sessions = snapshots.sessions || EMPTY_SESSIONS;
  const workspaces = snapshots.workspaces?.items || [];
  const requestedSession = text(props.sessionId) || text(props.session?.sessionId) || text(props.session?.id);
  const mainSessions = Object.values(sessions.byId || {}).filter((s) => (s.retainedBy?.mainView || 0) > 0);
  const sessionId = requestedSession || (mainSessions.length === 1 ? text(mainSessions[0].id) : "");
  if (sessionId) {
    const cwd = text(sessions.byId?.[sessionId]?.cwd);
    if (cwd) return cwd;
    const owners = workspaces.filter((w) => w.sessionIds?.includes(sessionId));
    if (owners.length === 1) return text(owners[0].path);
    if (requestedSession) return "";
  }
  const workspaceId = text(props.workspaceId) || text(props.session?.workspaceId) || text(props.workspace?.workspaceId);
  if (workspaceId) return text(workspaces.find((w) => w.workspaceId === workspaceId)?.path);
  return "";
}
function bindSnapshotSource(source, fallback) {
  return {
    subscribe: source ? (listener) => source.subscribe(listener) : noSubscribe,
    getSnapshot: source ? () => source.getSnapshot() : fallback,
    getServerSnapshot: fallback
  };
}
function useWorkspaceContext(props = {}) {
  const sessionSource = (0, import_react3.useMemo)(() => bindSnapshotSource(props.gitSessionsSource, emptySessions), [props.gitSessionsSource]);
  const workspaceSource = (0, import_react3.useMemo)(() => bindSnapshotSource(props.gitWorkspacesSource, emptyWorkspaces), [props.gitWorkspacesSource]);
  const fallbackSessions = (0, import_react3.useSyncExternalStore)(sessionSource.subscribe, sessionSource.getSnapshot, sessionSource.getServerSnapshot);
  const fallbackWorkspaces = (0, import_react3.useSyncExternalStore)(workspaceSource.subscribe, workspaceSource.getSnapshot, workspaceSource.getServerSnapshot);
  const sessions = props.useSessions ? props.useSessions(identity) : fallbackSessions;
  const workspaces = props.useWorkspaces ? props.useWorkspaces(identity) : fallbackWorkspaces;
  const explicitId = text(props.sessionId) || text(props.session?.sessionId) || text(props.session?.id);
  const main = Object.values(sessions?.byId || {}).filter((session) => (session.retainedBy?.mainView || 0) > 0);
  const candidateId = explicitId || (main.length === 1 ? text(main[0].id) : "");
  const cwd = resolveWorkspaceCwd(props, { sessions, workspaces });
  const candidateCwd = candidateId ? resolveWorkspaceCwd({ sessionId: candidateId }, { sessions, workspaces }) : "";
  const normalize = (path) => {
    const value = path.replace(/\\/g, "/").replace(/\/$/, "");
    return /^[a-z]:\//i.test(value) || value.startsWith("//") ? value.toLowerCase() : value;
  };
  return { cwd, sessionId: candidateId && candidateCwd && normalize(candidateCwd) === normalize(cwd) ? candidateId : void 0 };
}
function useWorkspaceCwd(props = {}) {
  return useWorkspaceContext(props).cwd;
}

// src/client/chips/BranchChip.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function BranchChip(props) {
  const { cwd, sessionId } = useWorkspaceContext(props);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RepositoryChip, { cwd, sessionId, onOpenGitPanel: props.onOpenGitPanel }, `${sessionId || ""}:${cwd}`);
}
function RepositoryChip({ cwd, sessionId, onOpenGitPanel }) {
  const { status, isGit, loading, error, reload } = useGitStatus(cwd);
  const [open, setOpen] = (0, import_react4.useState)(false);
  const [branchesView, setBranchesView] = (0, import_react4.useState)(null);
  const [fetchingBranches, setFetchingBranches] = (0, import_react4.useState)(false);
  const [branchError, setBranchError] = (0, import_react4.useState)(null);
  const request = (0, import_react4.useRef)(null);
  (0, import_react4.useEffect)(() => () => request.current?.abort(), []);
  const handleTogglePopover = async () => {
    if (fetchingBranches) return;
    if (open) {
      setOpen(false);
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setFetchingBranches(true);
    setBranchError(null);
    try {
      const view = await gitApi.getBranches(cwd, controller.signal);
      if (!controller.signal.aborted) {
        setBranchesView(view);
        setOpen(true);
      }
    } catch (error2) {
      if (!controller.signal.aborted) setBranchError(error2 instanceof Error ? error2.message : String(error2));
    } finally {
      if (!controller.signal.aborted) setFetchingBranches(false);
    }
  };
  const openPanel = async (view) => {
    setOpen(false);
    setBranchError(null);
    try {
      if (!onOpenGitPanel) throw new Error("The Git workbench is not ready yet");
      await onOpenGitPanel(view, { cwd, sessionId });
    } catch (error2) {
      setBranchError(error2 instanceof Error ? error2.message : String(error2));
    }
  };
  if (loading && !status && !error) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-git-muted dsh-git-loading", role: "status", children: "Loading\u2026" });
  if (!status || !isGit) return error ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dsh-git-error", role: "alert", children: [
    error,
    " ",
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", onClick: reload, children: "Retry" })
  ] }) : null;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-git-branch-control", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "button",
      {
        type: "button",
        className: `dsh-git-chip ${open ? "dsh-git-chip-active" : ""}`,
        onClick: handleTogglePopover,
        disabled: fetchingBranches,
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        "aria-busy": fetchingBranches,
        title: `Current branch: ${status.branch}${status.dirtyFiles > 0 ? ` (${status.dirtyFiles} modified files)` : ""}`,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconBranch, { size: 16 }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-git-chip-branch", children: status.branch || "HEAD" }),
          (status.ahead || 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dsh-git-ahead", title: ` ahead of upstream ${status.ahead} commits`, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconArrowUp, { size: 12 }),
            status.ahead
          ] }),
          (status.behind || 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dsh-git-behind", title: ` behind upstream ${status.behind} commits`, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconArrowDown, { size: 12 }),
            status.behind
          ] }),
          (status.stashCount || 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dsh-git-badge", children: [
            "Stashes ",
            status.stashCount
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconChevronDown, { size: 12 })
        ]
      }
    ),
    (branchError || error) && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-git-error", role: "alert", children: branchError || error }),
    open && branchesView && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      BranchPopover,
      {
        view: branchesView,
        path: cwd,
        status: status || void 0,
        onReloadStatus: reload,
        onSwitch: async (target) => {
          const result = await gitApi.switchBranch(cwd, target);
          if (!result.ok) throw new Error(result.error?.message || "Failed to switch branch");
          reload();
        },
        onCreateBranch: () => {
          void openPanel("create-branch");
        },
        onOpenGraph: () => {
          void openPanel("history");
        },
        onCreateWorktree: () => {
          void openPanel("create-worktree");
        },
        onManageWorktrees: () => {
          void openPanel("worktrees");
        },
        onClose: () => setOpen(false)
      }
    )
  ] });
}

// src/client/diff/ChangesTab.tsx
var import_react12 = require("react");
init_api();

// src/client/agent-bridge.ts
var PATCH_LIMIT = 12e3;
var TRUNCATION_NOTE = "\n\u2026 (the patch is too long and was truncated; ask me to view it file by file if you need the full content)";
function fence(text2) {
  const longest = (text2.match(/`{3,}/g) ?? []).reduce((max, run) => Math.max(max, run.length), 2);
  const marker = "`".repeat(Math.max(3, longest + 1));
  return `${marker}diff
${text2}
${marker}`;
}
function truncatePatch(patch, limit = PATCH_LIMIT) {
  if (patch.length <= limit) return patch;
  return patch.slice(0, limit) + TRUNCATION_NOTE;
}
function pathList(label, paths, empty) {
  if (!paths || paths.length === 0) return `- ${label}:${empty}`;
  const shown = paths.slice(0, 40).map((path) => `  - ${path}`);
  if (paths.length > shown.length) shown.push(`  - \u2026total ${paths.length} files`);
  return `- ${label}(${paths.length}):
${shown.join("\n")}`;
}
function buildContextText(context) {
  const branch = context.branch || "(unknown branch)";
  const tracking = context.upstream ? `, tracking ${context.upstream}${context.ahead ? `, ahead ${context.ahead} commits` : ""}${context.behind ? `, behind ${context.behind} commits` : ""}` : ", no upstream branch";
  return [
    "Below is the current state of my Git repository, please read it first, then wait for my questions:",
    "",
    ...context.cwd ? [`- Repository directory:${context.cwd}`] : [],
    `- Current branch:${branch}${tracking}`,
    context.summary ? `- Change summary:${context.summary}` : "- Change summary: (unknown)",
    pathList("Staged", context.staged, "(empty)"),
    pathList("Unstaged", context.unstaged, "(empty)"),
    pathList("Untracked", context.untracked, "(empty)"),
    pathList("Conflict", context.conflicts, "(none)")
  ].join("\n");
}
function stagedPatchBlock(context) {
  if (!context.patch) return "(no patch to display for the index)";
  return fence(truncatePatch(context.patch));
}
function buildCommitPrompt(context) {
  return [
    buildContextText(context),
    "",
    "Please write a commit message based on the **staged** changes above. Requirements:",
    "1. The first line is a concise imperative subject, no more than 72 characters, not ending with a period;",
    '2. If necessary, leave a blank line and then write the body, explaining "why" instead of restating what changed item by item;',
    "3. Use the same language as the repository's existing commit messages (I will include the most recent ones below).",
    "4. Output only the commit message itself: no explanations, no code blocks, no quotes around it.",
    "",
    "Staged patch:",
    stagedPatchBlock(context)
  ].join("\n");
}
function buildReviewPrompt(context) {
  return [
    buildContextText(context),
    "",
    "Please review these changes, focusing on: correctness defects, edge cases, possible data loss or security issues,",
    "and whether tests or docs are missing. Sort by severity, give the file and line number, and explain why you are making each suggestion.",
    "If a change looks fine, just say it is fine, do not make suggestions just to fill space.",
    "",
    "Patch for the current comparison range: ",
    context.patch ? fence(truncatePatch(context.patch)) : "(no patch to display for the current range)"
  ].join("\n");
}
function buildExplainPrompt(file) {
  const status = file.statusLabel ? `(${file.statusLabel})` : "";
  return [
    `Please explain \`${file.path}\`${status} these changes: what changed, why it may have been changed this way, and what the impact is.`,
    "Answer in English: give a one-sentence conclusion first, then explain block by block. If the patch contains risks I should pay attention to, point them out.",
    "",
    "Patch:",
    fence(truncatePatch(file.patch))
  ].join("\n");
}
async function deliverPrompt(scope, sessionId, text2) {
  if (!sessionId) return { ok: false, error: "No session is available; cannot open the side chat" };
  if (typeof scope?.onOpenGitSidechat !== "function") return { ok: false, error: "The Git side chat is not ready yet; enable the sidebar plugin and refresh the page" };
  try {
    const destination = await scope.onOpenGitSidechat(sessionId, scope.cwd || "", text2);
    return { ok: true, mode: destination === "conversation" ? "new-conversation" : "drafted" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Cannot open the side chat or fill in the prompt" };
  }
}

// src/client/loading-state.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function GitLoadingState({ title, hint, rows = 3, className = "" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: `dsh-git-changes-loading ${className}`.trim(), role: "status", "aria-live": "polite", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-loading-icon", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconRefresh, { size: 20, className: "dsh-git-spin" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: title }),
    hint ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: hint }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-loading-preview", "aria-hidden": "true", children: Array.from({ length: Math.max(1, rows) }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", {}, index)) })
  ] });
}

// src/client/editor-menu.tsx
var import_react5 = require("react");
init_api();

// src/client/editor-icons.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var VSCODE_RIBBON = "M180.828 252.605a15.87 15.87 0 0 0 12.65-.486l52.5-25.263a15.94 15.94 0 0 0 9.026-14.363V41.197a15.94 15.94 0 0 0-9.025-14.363L193.477 1.57a15.88 15.88 0 0 0-18.114 3.084L74.857 96.35l-43.78-33.232a10.614 10.614 0 0 0-13.56.603L3.476 76.494c-4.63 4.211-4.635 11.495-.012 15.713l37.967 34.638l-37.967 34.637c-4.623 4.219-4.618 11.502.012 15.714l14.041 12.772a10.614 10.614 0 0 0 13.56.604l43.78-33.233l100.506 91.695a15.9 15.9 0 0 0 5.465 3.571m10.464-183.65l-76.262 57.89l76.262 57.888z";
var MARKS = {
  code: { initials: "VS", color: "#007ACC", path: VSCODE_RIBBON },
  "code-insiders": { initials: "VI", color: "#24BFB2", path: VSCODE_RIBBON },
  cursor: { initials: "CU", color: "#1F2937" },
  windsurf: { initials: "WI", color: "#0FA47F" },
  zed: { initials: "Z", color: "#084CCF" },
  subl: { initials: "S", color: "#FF9800" },
  // JetBrains marks really are a coloured square with a two-letter monogram; these are their hues.
  idea: { initials: "IJ", color: "#FE2858" },
  webstorm: { initials: "WS", color: "#07C3F2" },
  pycharm: { initials: "PC", color: "#21D789" },
  phpstorm: { initials: "PS", color: "#B45EF6" },
  goland: { initials: "GL", color: "#2FB4F5" },
  clion: { initials: "CL", color: "#31D0AA" },
  rider: { initials: "RD", color: "#F97A12" },
  datagrip: { initials: "DG", color: "#8B6BF2" },
  rubymine: { initials: "RM", color: "#FF4A5A" },
  studio: { initials: "AS", color: "#3DDC84" }
};
function editorKey(command) {
  const base = command.split(/[\\/]/).pop() ?? command;
  return base.replace(/\.(exe|cmd|bat|sh)$/i, "").toLowerCase();
}
function editorMark(command, label) {
  const key = editorKey(command);
  return MARKS[key] ?? MARKS[key.replace(/\d+$/, "")] ?? unknownMark(key, label);
}
function unknownMark(key, label) {
  const words = label.trim().split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : label.slice(0, 2)).toUpperCase();
  let hash = 0;
  for (const character of key || label) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 1000003;
  return { initials: initials || "?", tone: hash % 2 === 0 ? "quiet" : "outline" };
}
function EditorMark({ command, label, size = 16 }) {
  const mark = editorMark(command, label);
  const box = { width: size, height: size, fontSize: Math.max(7, Math.round(size * 0.44)) };
  if (mark.path) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "svg",
      {
        className: "dsh-git-editor-mark dsh-git-editor-mark-glyph",
        viewBox: "0 0 256 254",
        "aria-hidden": "true",
        style: box,
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: mark.path, fill: mark.color, fillRule: "evenodd" })
      }
    );
  }
  const style = mark.color ? { ...box, background: mark.color, color: "#fff" } : box;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: `dsh-git-editor-mark dsh-git-editor-mark-${mark.tone}`, "aria-hidden": "true", style, children: mark.initials });
}

// src/client/editor-menu.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var SYSTEM_EDITOR = "system";
function OpenInEditorMenu({ repo, file, line, onNotice, label = "Open in editor", size = 13, disabled = false, className = "" }) {
  const [open, setOpen] = (0, import_react5.useState)(false);
  const [editors, setEditors] = (0, import_react5.useState)(null);
  const [loadError, setLoadError] = (0, import_react5.useState)(null);
  const [busy, setBusy] = (0, import_react5.useState)(false);
  (0, import_react5.useEffect)(() => {
    if (!open || editors) return;
    let cancelled = false;
    setLoadError(null);
    gitApi.listEditors().then((list) => {
      if (!cancelled) setEditors(list);
    }).catch((error) => {
      if (!cancelled) setLoadError(errorMessage(error));
    });
    return () => {
      cancelled = true;
    };
  }, [open, editors]);
  const choose = async (editor) => {
    setOpen(false);
    setBusy(true);
    onNotice?.(null);
    try {
      const outcome = await gitApi.openInEditor(repo, file, line, editor);
      onNotice?.(outcome.ok ? { ok: true, text: `${outcome.editor ? `Took ${outcome.editor} open` : "Opened with the system default application"}:${outcome.target || file}` } : { ok: false, text: outcome.error || "Cannot open external editor" });
    } catch (error) {
      onNotice?.({ ok: false, text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };
  const reveal = async () => {
    setOpen(false);
    setBusy(true);
    onNotice?.(null);
    try {
      const outcome = await gitApi.reveal(repo, file);
      onNotice?.(outcome.ok ? { ok: true, text: `Revealed in the file manager: ${outcome.target || file}` } : { ok: false, text: outcome.error || "Cannot reveal this file in the file manager" });
    } catch (error) {
      onNotice?.({ ok: false, text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "div",
    {
      className: `dsh-git-editor-control ${className}`.trim(),
      onKeyDown: (event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          "button",
          {
            type: "button",
            className: "dsh-git-btn dsh-git-btn-secondary dsh-git-open-editor",
            title: "Open this file in an external editor (click to choose which one)",
            "aria-haspopup": "menu",
            "aria-expanded": open,
            disabled: disabled || busy,
            onClick: () => setOpen((value) => !value),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconExternalLink, { size }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: label }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconChevronDown, { size: 12 })
            ]
          }
        ),
        open && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dsh-git-editor-backdrop", onClick: () => setOpen(false) }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dsh-git-editor-menu", role: "menu", "aria-label": "Select external editor", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
              "button",
              {
                type: "button",
                role: "menuitem",
                className: "dsh-git-editor-option",
                title: "Open with the system's current default application",
                onClick: () => {
                  void choose(SYSTEM_EDITOR);
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconFile, { size: 15 }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dsh-git-editor-label", children: "System default application" }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dsh-git-editor-tag", children: "(default)" })
                ]
              }
            ),
            !editors && !loadError && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dsh-git-editor-hint", role: "status", children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dsh-git-editor-spinner", "aria-hidden": "true" }),
              "Detecting installed editors\u2026"
            ] }),
            loadError && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dsh-git-editor-hint dsh-git-error", role: "alert", children: loadError }),
            editors?.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dsh-git-editor-hint", children: "No editor command line detected" }),
            editors?.map((choice) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
              "button",
              {
                type: "button",
                role: "menuitem",
                className: "dsh-git-editor-option",
                title: choice.command,
                onClick: () => {
                  void choose(choice.command);
                },
                children: [
                  choice.icon ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("img", { className: "dsh-git-editor-mark dsh-git-editor-mark-image", src: choice.icon, alt: "", width: 16, height: 16 }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(EditorMark, { command: choice.command, label: choice.label }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dsh-git-editor-label", children: choice.label })
                ]
              },
              choice.command
            )),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
              "button",
              {
                type: "button",
                role: "menuitem",
                className: "dsh-git-editor-option dsh-git-editor-option-split",
                title: "Reveal this file in the system file manager",
                onClick: () => {
                  void reveal();
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconFolderTree, { size: 14 }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dsh-git-editor-label", children: "Show file location" })
                ]
              }
            )
          ] })
        ] })
      ]
    }
  );
}

// src/client/dialogs/FileInspectDialog.tsx
var import_react11 = require("react");
init_api();

// src/client/dialogs/blame-groups.ts
function groupBlameLines(lines) {
  let previousKey = null;
  return lines.map((line) => {
    const key = line.uncommitted ? "uncommitted" : `commit:${line.shortHash}`;
    const continuation = key === previousKey;
    previousKey = key;
    return { line, continuation };
  });
}

// src/client/dialogs/DialogShell.tsx
var import_react7 = require("react");

// src/client/panels/panel-context.ts
var import_react6 = require("react");
var GitPanelContext = (0, import_react6.createContext)(false);

// src/client/dialogs/DialogShell.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
function DialogShell({ title, onClose, busy = false, children, style }) {
  const inline = (0, import_react7.useContext)(GitPanelContext);
  const card = (0, import_react7.useRef)(null);
  const restoreFocus = (0, import_react7.useRef)(typeof document === "undefined" ? null : document.activeElement);
  const close = (0, import_react7.useRef)(onClose);
  close.current = onClose;
  const busyRef = (0, import_react7.useRef)(busy);
  busyRef.current = busy;
  (0, import_react7.useEffect)(() => {
    if (inline) return;
    const previous = restoreFocus.current;
    const node = card.current;
    if (!node) return;
    if (!node.contains(document.activeElement)) {
      const first = node.querySelector('input, button:not(:disabled), [tabindex="0"]');
      (first ?? node).focus();
    }
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!busyRef.current) close.current();
      } else if (event.key === "Tab") {
        const targets = Array.from(node.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'));
        const first = targets[0];
        const last = targets[targets.length - 1];
        if (!first) {
          event.preventDefault();
          node.focus();
        } else if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === node)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    node.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [inline]);
  if (inline) return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("section", { ref: card, className: "dsh-git-panel-form", "aria-label": title, "aria-busy": busy, children });
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dsh-git-modal-overlay", onClick: (event) => {
    if (event.target === event.currentTarget && !busy) onClose();
  }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { ref: card, className: "dsh-git-modal-card", role: "dialog", "aria-modal": "true", "aria-label": title, "aria-busy": busy, tabIndex: -1, style, children }) });
}

// src/client/dialogs/GitGraphDialog.tsx
var import_react10 = __toESM(require("react"), 1);
init_api();

// src/client/graph.ts
function computeGraph(commits, maxColumns = 8) {
  const rows = [];
  let columns = [];
  for (const commit of commits) {
    let column = columns.indexOf(commit.hash);
    if (column < 0) {
      column = columns.indexOf("");
      if (column < 0) {
        columns = columns.length >= maxColumns ? columns : [...columns, commit.hash];
        column = columns.length - 1;
      } else columns[column] = commit.hash;
    }
    const parents = [];
    const next = columns.slice();
    next[column] = "";
    const [first, ...mergeParents] = commit.parents;
    if (first) {
      const existing = next.indexOf(first);
      if (existing >= 0) parents.push({ hash: first, column: existing });
      else {
        next[column] = first;
        parents.push({ hash: first, column });
      }
    }
    for (const parent of mergeParents) {
      let target = next.indexOf(parent);
      if (target < 0) {
        target = next.indexOf("");
        if (target < 0) {
          if (next.length < maxColumns) {
            next.push(parent);
            target = next.length - 1;
          } else target = next.length - 1;
        } else next[target] = parent;
      }
      parents.push({ hash: parent, column: target });
    }
    const width = Math.min(maxColumns, Math.max(columns.length, ...parents.map((parent) => parent.column + 1), 1));
    rows.push({ commit, column: Math.min(column, width - 1), columns: columns.slice(0, width), parents, width });
    while (next.length && next[next.length - 1] === "") next.pop();
    columns = next;
  }
  return rows;
}

// src/client/dialogs/GitGraphDialog.tsx
var import_jsx_runtime10 = require("react/jsx-runtime");
var LANE_STEP = 14;
var LANE_INSET = 7;
var NODE_SIZE = 8;
var laneCenter = (column) => LANE_INSET + column * LANE_STEP;
var laneClass = (column) => `dsh-git-lane-${column % 8}`;
function sameCentres(left, right) {
  return left.length === right.length && left.every((value, index) => Math.abs(value - right[index]) < 0.5);
}
function renderErrorMessage(error) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return String(error);
}
var CommitDetailErrorBoundary = class extends import_react10.default.Component {
  state = { failed: false, message: "" };
  static getDerivedStateFromError(error) {
    return { failed: true, message: renderErrorMessage(error) };
  }
  retry = () => this.setState({ failed: false, message: "" });
  render() {
    if (this.state.failed) return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dsh-git-empty-state", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("strong", { children: "Cannot show commit details" }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "dsh-git-error", role: "alert", children: this.state.message }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: this.retry, children: "Retry" })
    ] });
    return this.props.children;
  }
};
function SelectedCommitDetails({ path, commitRef, DetailComponent, loadError, onBack, onRetry, showBackButton = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dsh-git-section", children: DetailComponent ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(CommitDetailErrorBoundary, { children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(DetailComponent, { path, commitRef, onClose: onBack, showBackButton }) }, JSON.stringify([path, commitRef])) : loadError ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "dsh-git-error", role: "alert", children: loadError }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: onRetry, children: "Retry loading details" })
  ] }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dsh-git-muted", children: "Loading the commit detail view\u2026" }) });
}
function GitGraphDialog({ path }) {
  const { status, error: statusError } = useGitStatus(path);
  const [commits, setCommits] = (0, import_react10.useState)([]);
  const [loading, setLoading] = (0, import_react10.useState)(true);
  const [error, setError] = (0, import_react10.useState)(null);
  const [refresh, setRefresh] = (0, import_react10.useState)(0);
  const [requestedRevision, setRequestedRevision] = (0, import_react10.useState)(null);
  const [activeTab, setActiveTab] = (0, import_react10.useState)("commits");
  const [selectedCommit, setSelectedCommit] = (0, import_react10.useState)(null);
  const [CommitDetailDialog2, setCommitDetailDialog] = (0, import_react10.useState)(null);
  const [ReflogPanel2, setReflogPanel] = (0, import_react10.useState)(null);
  const [commitLoadError, setCommitLoadError] = (0, import_react10.useState)(null);
  const [reflogLoadError, setReflogLoadError] = (0, import_react10.useState)(null);
  const [commitLoadAttempt, setCommitLoadAttempt] = (0, import_react10.useState)(0);
  const [reflogLoadAttempt, setReflogLoadAttempt] = (0, import_react10.useState)(0);
  const statusRevision = status?.head ?? (statusError ? "__status-error__" : null);
  (0, import_react10.useEffect)(() => {
    if (!selectedCommit || CommitDetailDialog2) return;
    let active = true;
    setCommitLoadError(null);
    Promise.resolve().then(() => (init_CommitDetailDialog(), CommitDetailDialog_exports)).then((module2) => {
      if (active) setCommitDetailDialog(() => module2.CommitDetailDialog);
    }).catch((reason) => {
      if (active) setCommitLoadError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => {
      active = false;
    };
  }, [selectedCommit, CommitDetailDialog2, commitLoadAttempt]);
  (0, import_react10.useEffect)(() => {
    if (activeTab !== "reflog" || ReflogPanel2) return;
    let active = true;
    setReflogLoadError(null);
    Promise.resolve().then(() => (init_ReflogPanel(), ReflogPanel_exports)).then((module2) => {
      if (active) setReflogPanel(() => module2.ReflogPanel);
    }).catch((reason) => {
      if (active) setReflogLoadError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => {
      active = false;
    };
  }, [activeTab, ReflogPanel2, reflogLoadAttempt]);
  (0, import_react10.useEffect)(() => {
    if (!status && !statusError) return;
    const revision = statusRevision ?? "__status-error__";
    const requestKey = `${path}\0${revision}`;
    if (requestedRevision === requestKey) return;
    const controller = new AbortController();
    setRequestedRevision(requestKey);
    setCommits([]);
    setLoading(true);
    setError(null);
    gitApi.getLog(path, 60, controller.signal).then((result) => {
      if (!controller.signal.aborted) setCommits(result);
    }).catch((error2) => {
      if (!controller.signal.aborted) setError(error2 instanceof Error ? error2.message : String(error2));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [path, refresh, statusRevision]);
  const refreshLog = () => {
    setRequestedRevision(null);
    setRefresh((value) => value + 1);
  };
  const graphRows = computeGraph(commits.map((commit) => ({ ...commit, parents: commit.parents ?? [] })));
  const gutter = graphRows.reduce((widest, row) => Math.max(widest, row.width), 1) * LANE_STEP + LANE_STEP;
  const viewRef = (0, import_react10.useRef)(null);
  const [graphLayout, setGraphLayout] = (0, import_react10.useState)({ centres: [], height: 0 });
  (0, import_react10.useLayoutEffect)(() => {
    const view = viewRef.current;
    if (!view) return;
    let frame = 0;
    const measure = () => {
      const rows = Array.from(view.querySelectorAll(".dsh-git-graph-row"));
      const origin = view.getBoundingClientRect();
      const rects = rows.map((row) => row.getBoundingClientRect());
      if (rects.length === 0 || rects.some((rect) => rect.height === 0)) return;
      const centres = rects.map((rect) => rect.top - origin.top + rect.height / 2);
      const height = rects[rects.length - 1].bottom - origin.top;
      setGraphLayout((previous) => sameCentres(previous.centres, centres) && Math.abs(previous.height - height) < 0.5 ? previous : { centres, height });
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(schedule);
    observer.observe(view);
    for (const row of Array.from(view.querySelectorAll(".dsh-git-graph-row"))) observer.observe(row);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [commits, activeTab, selectedCommit]);
  const lanes = [];
  if (graphLayout.centres.length === graphRows.length) {
    graphRows.forEach((row, index) => {
      const centre = graphLayout.centres[index];
      const next = graphLayout.centres[index + 1];
      const nextColumns = graphRows[index + 1]?.columns ?? [];
      const last = index === graphRows.length - 1;
      row.columns.forEach((hash, column) => {
        if (!hash) return;
        const x = laneCenter(column);
        const start = index === 0 ? 0 : centre;
        const end = last ? graphLayout.height : nextColumns[column] ? next : centre;
        if (end > start) lanes.push({ key: `lane-${index}-${column}`, className: laneClass(column), path: `M${x} ${start}L${x} ${end}` });
      });
      for (const parent of row.parents) {
        if (parent.column === row.column || next === void 0) continue;
        const from = laneCenter(row.column);
        const to = laneCenter(parent.column);
        const middle = (centre + next) / 2;
        lanes.push({
          key: `edge-${index}-${parent.column}-${parent.hash}`,
          className: laneClass(parent.column),
          path: `M${from} ${centre}C${from} ${middle} ${to} ${middle} ${to} ${next}`
        });
      }
    });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("section", { className: "dsh-git-history-panel", "aria-label": "Commit history", children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dsh-git-changes-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dsh-git-repo-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "dsh-git-panel-heading", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(IconHistory, { size: 17 }),
          "Commit history"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dsh-git-head-actions", children: [
          !loading && !error && commits.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "dsh-git-file-count", children: [
            "Recent ",
            commits.length,
            " entries"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "button",
            {
              type: "button",
              "aria-label": "Refresh commit log",
              title: "Refresh",
              className: "dsh-git-refresh-btn",
              disabled: loading,
              onClick: refreshLog,
              children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(IconRefresh, { size: 15, className: loading ? "dsh-git-spin" : "" })
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dsh-git-tab-strip", role: "tablist", "aria-label": "History type", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": activeTab === "commits",
            className: `dsh-git-tab${activeTab === "commits" ? " dsh-git-tab-active" : ""}`,
            onClick: () => {
              setActiveTab("commits");
              setSelectedCommit(null);
            },
            children: "Commit"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": activeTab === "reflog",
            className: `dsh-git-tab${activeTab === "reflog" ? " dsh-git-tab-active" : ""}`,
            onClick: () => {
              setActiveTab("reflog");
              setSelectedCommit(null);
            },
            children: "Reflog"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      "div",
      {
        className: "dsh-git-history-list",
        style: { "--dsh-git-graph-gutter": `${gutter}px` },
        children: activeTab === "reflog" ? ReflogPanel2 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(ReflogPanel2, { path }) : reflogLoadError ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "dsh-git-error", role: "alert", children: reflogLoadError }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "button",
            {
              type: "button",
              className: "dsh-git-btn dsh-git-btn-secondary",
              onClick: () => setReflogLoadAttempt((value) => value + 1),
              children: "Retry loading the reflog"
            }
          )
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dsh-git-muted", children: "Loading the reflog view\u2026" }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dsh-git-graph-view", ref: viewRef, hidden: selectedCommit !== null, children: [
            lanes.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
              "svg",
              {
                className: "dsh-git-graph-backdrop",
                width: gutter,
                height: graphLayout.height,
                viewBox: `0 0 ${gutter} ${graphLayout.height}`,
                "aria-hidden": "true",
                children: lanes.map((lane) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("g", { className: lane.className, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: lane.path, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" }) }, lane.key))
              }
            ),
            error ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dsh-git-empty-state", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dsh-git-state-icon", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(IconHistory, { size: 24 }) }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("strong", { children: "Cannot read commit history" }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "dsh-git-state-error", role: "alert", children: error }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: refreshLog, children: [
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(IconRefresh, { size: 14 }),
                "Retry"
              ] })
            ] }) : loading ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(GitLoadingState, { title: "Reading commits", hint: "Recent commits, authors, and branch references will appear shortly", rows: 4 }) : commits.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dsh-git-empty-state", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dsh-git-state-icon", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(IconHistory, { size: 24 }) }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("strong", { children: "No commits yet" }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { children: "This repository has no commits yet; the first one will show here." })
            ] }) : graphRows.map((row) => {
              const commit = row.commit;
              return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
                "div",
                {
                  className: "dsh-git-graph-row",
                  role: "button",
                  tabIndex: 0,
                  "aria-label": `View commit ${commit.shortHash} ${commit.subject}`,
                  onClick: () => setSelectedCommit(commit.hash),
                  onKeyDown: (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedCommit(commit.hash);
                    }
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                      "span",
                      {
                        className: `dsh-git-graph-node ${laneClass(row.column)}`,
                        style: { left: laneCenter(row.column) - NODE_SIZE / 2 },
                        "aria-hidden": "true"
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("article", { className: "dsh-git-history-item", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dsh-git-graph-copy", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dsh-git-graph-subject", children: commit.subject }),
                      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dsh-git-graph-meta", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("code", { title: commit.hash, children: commit.shortHash }),
                        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: commit.author }),
                        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("time", { children: commit.date }),
                        commit.refs.map((ref) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dsh-git-ref", children: ref }, ref))
                      ] })
                    ] }) })
                  ]
                },
                commit.hash
              );
            })
          ] }),
          selectedCommit && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            SelectedCommitDetails,
            {
              path,
              commitRef: selectedCommit,
              DetailComponent: CommitDetailDialog2,
              loadError: commitLoadError,
              onBack: () => setSelectedCommit(null),
              onRetry: () => setCommitLoadAttempt((value) => value + 1)
            }
          )
        ] })
      }
    )
  ] });
}

// src/client/dialogs/FileInspectDialog.tsx
var import_jsx_runtime11 = require("react/jsx-runtime");
function FileInspectDialog({ path, file, onClose, onOpenCommit }) {
  const [tab, setTab] = (0, import_react11.useState)("history");
  const [refresh, setRefresh] = (0, import_react11.useState)(0);
  const [result, setResult] = (0, import_react11.useState)(null);
  const [notice, setNotice] = (0, import_react11.useState)(null);
  const [actionBusy, setActionBusy] = (0, import_react11.useState)(false);
  const [drilled, setDrilled] = (0, import_react11.useState)(null);
  const [DetailComponent, setDetailComponent] = (0, import_react11.useState)(null);
  const [detailError, setDetailError] = (0, import_react11.useState)(null);
  const [detailAttempt, setDetailAttempt] = (0, import_react11.useState)(0);
  const requestKey = JSON.stringify([path, file, tab, refresh]);
  const currentResult = result?.key === requestKey ? result : null;
  const loading = currentResult?.loading ?? true;
  const close = () => onClose?.();
  const commitRef = drilled && drilled.file === file ? drilled.hash : null;
  const openCommit = (hash) => {
    onOpenCommit?.(hash);
    setDrilled({ file, hash });
  };
  (0, import_react11.useEffect)(() => {
    if (!commitRef || DetailComponent) return;
    let active = true;
    setDetailError(null);
    Promise.resolve().then(() => (init_CommitDetailDialog(), CommitDetailDialog_exports)).then((module2) => {
      if (active) setDetailComponent(() => module2.CommitDetailDialog);
    }).catch((error) => {
      if (active) setDetailError(errorMessage(error));
    });
    return () => {
      active = false;
    };
  }, [commitRef, DetailComponent, detailAttempt]);
  (0, import_react11.useEffect)(() => {
    const controller = new AbortController();
    setResult({ key: requestKey, loading: true, history: null, blame: null, error: null });
    const load = async () => {
      try {
        if (tab === "history") {
          const history2 = await gitApi.getFileHistory(path, file, 50, controller.signal);
          if (!controller.signal.aborted) setResult({ key: requestKey, loading: false, history: history2, blame: null, error: null });
        } else {
          const blame2 = await gitApi.getBlame(path, file, 5e3, controller.signal);
          if (!controller.signal.aborted) setResult({ key: requestKey, loading: false, history: null, blame: blame2, error: null });
        }
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key: requestKey, loading: false, history: null, blame: null, error: errorMessage(error) });
      }
    };
    void load();
    return () => controller.abort();
  }, [path, file, tab, refresh, requestKey]);
  const runApiAction = async (action, successText) => {
    setActionBusy(true);
    setNotice(null);
    try {
      const response = await action();
      setNotice(response.ok ? { ok: true, text: successText } : { ok: false, text: response.error ?? "Operation failed" });
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    } finally {
      setActionBusy(false);
    }
  };
  const copyPath = async () => {
    setActionBusy(true);
    setNotice(null);
    try {
      await navigator.clipboard.writeText(file);
      setNotice({ ok: true, text: "File path copied" });
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    } finally {
      setActionBusy(false);
    }
  };
  const copyBlameHash = async (line) => {
    if (!line.uncommitted) onOpenCommit?.(line.hash);
    setNotice(null);
    try {
      await navigator.clipboard.writeText(line.hash);
      setNotice({ ok: true, text: `Copied commit hash: ${line.shortHash}` });
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    }
  };
  const history = currentResult?.history ?? null;
  const blame = currentResult?.blame ?? null;
  const requestError = currentResult?.error ?? null;
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(DialogShell, { title: "File \xB7 " + file, onClose: close, style: { width: 820, maxWidth: "94vw", maxHeight: "90vh" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dsh-git-modal-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(IconFile, { size: 16 }),
        "files \xB7 ",
        file
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", "aria-label": "Close", className: "dsh-git-icon-btn", onClick: close, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(IconClose, { size: 16 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dsh-git-modal-body", style: { padding: 0, gap: 0, flex: 1, minHeight: 0, overflow: "auto" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dsh-git-tab-strip", role: "tablist", "aria-label": "File inspection view", style: { margin: "10px 12px 0" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", role: "tab", "aria-selected": tab === "history", className: `dsh-git-tab ${tab === "history" ? "dsh-git-tab-active" : ""}`, onClick: () => {
          setNotice(null);
          setTab("history");
          setDrilled(null);
        }, children: "History" }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", role: "tab", "aria-selected": tab === "blame", className: `dsh-git-tab ${tab === "blame" ? "dsh-git-tab-active" : ""}`, onClick: () => {
          setNotice(null);
          setTab("blame");
          setDrilled(null);
        }, children: "Blame" })
      ] }),
      tab === "history" ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dsh-git-panel-toolbar", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dsh-git-section-head", children: [
            "Commit history ",
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dsh-git-badge", children: history?.length ?? 0 })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dsh-git-spacer" }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: actionBusy, onClick: () => {
            void copyPath();
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(IconCopy, { size: 14 }),
            "Copy path"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(OpenInEditorMenu, { repo: path, file, onNotice: setNotice }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: actionBusy, onClick: () => {
            void runApiAction(() => gitApi.reveal(path, file), "Opened in the file manager");
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(IconFolderTree, { size: 14 }),
            "Open file manager"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", "aria-label": "Refresh file history", title: "Refresh", disabled: loading, onClick: () => setRefresh((value) => value + 1), children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(IconRefresh, { size: 14, className: loading ? "dsh-git-spin" : "" }),
            "Refresh"
          ] })
        ] }),
        notice && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: `dsh-git-changes-notice ${notice.ok ? "" : "dsh-git-error"}`, role: notice.ok ? "status" : "alert", children: notice.text }),
        commitRef ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          SelectedCommitDetails,
          {
            path,
            commitRef,
            DetailComponent,
            loadError: detailError,
            showBackButton: true,
            onBack: () => setDrilled(null),
            onRetry: () => setDetailAttempt((value) => value + 1)
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dsh-git-scroll-list", children: loading ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dsh-git-panel-message", role: "status", children: "Reading file history\u2026" }) : requestError ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dsh-git-empty-state", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dsh-git-error", role: "alert", children: requestError }) }) : !history?.length ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dsh-git-empty-state", children: "No file history" }) : history.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("button", { type: "button", className: "dsh-git-reflog-row", title: entry.hash, onClick: () => openCommit(entry.hash), children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("code", { children: entry.shortHash }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: entry.subject }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dsh-git-muted", style: { flex: "0 1 auto" }, children: entry.author }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("time", { className: "dsh-git-muted", children: entry.date })
        ] }, entry.hash)) })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dsh-git-panel-toolbar", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dsh-git-mono", title: file, children: file }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dsh-git-spacer" }),
          blame && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dsh-git-muted", children: [
            "Total ",
            blame.totalLines,
            " lines"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", "aria-label": "Refresh blame info", title: "Refresh", disabled: loading, onClick: () => setRefresh((value) => value + 1), children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(IconRefresh, { size: 14, className: loading ? "dsh-git-spin" : "" }),
            "Refresh"
          ] })
        ] }),
        notice && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: `dsh-git-changes-notice ${notice.ok ? "" : "dsh-git-error"}`, role: notice.ok ? "status" : "alert", children: notice.text }),
        blame?.truncated && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dsh-git-muted", role: "status", style: { padding: "6px 12px" }, children: [
          "Showing only the first 5000 lines of ",
          blame.totalLines,
          " lines"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dsh-git-scroll-list", children: loading ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dsh-git-panel-message", role: "status", children: "Reading blame\u2026" }) : requestError ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dsh-git-empty-state", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dsh-git-error", role: "alert", children: requestError }) }) : !blame?.lines.length ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dsh-git-empty-state", children: "No blame information" }) : groupBlameLines(blame.lines).map(({ line, continuation }) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("button", { type: "button", className: "dsh-git-blame-row", title: line.uncommitted ? "Uncommitted" : line.hash, onClick: () => {
          void copyBlameHash(line);
        }, style: { width: "100%", border: 0, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer", font: "inherit" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: `dsh-git-blame-meta ${continuation ? "dsh-git-same-commit" : ""}`, children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("code", { children: continuation || line.uncommitted ? "" : line.shortHash }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: continuation ? "" : line.uncommitted ? "Uncommitted" : line.author }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("time", { children: continuation || line.uncommitted ? "" : line.date })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dsh-git-blame-num", children: line.lineNumber }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { style: { whiteSpace: "pre" }, children: line.content })
        ] }, `${line.lineNumber}-${line.hash}`)) })
      ] })
    ] })
  ] });
}

// src/client/diff/change-sections.ts
var ORDER = ["conflict", "staged", "unstaged", "untracked"];
var LABELS = {
  conflict: "Conflict",
  staged: "Staged",
  unstaged: "Unstaged",
  untracked: "Untracked"
};
var LETTERS = {
  added: "A",
  deleted: "D",
  renamed: "R",
  copied: "C",
  modified: "M",
  untracked: "U",
  conflict: "U"
};
function statusLetter2(status) {
  return LETTERS[status] ?? "M";
}
function statusTone(status) {
  if (status === "added" || status === "untracked") return "added";
  if (status === "deleted") return "deleted";
  if (status === "renamed" || status === "copied") return "renamed";
  if (status === "conflict") return "conflict";
  return "modified";
}
function buildSections(files, entries, fallbackLabel = "Changed files") {
  const byPath = /* @__PURE__ */ new Map();
  for (const file of files) if (!byPath.has(file.path)) byPath.set(file.path, file);
  if (!entries || entries.length === 0) {
    if (files.length === 0) return [];
    return [{
      key: "unstaged",
      label: fallbackLabel,
      rows: files.map((file) => ({
        key: `unstaged:${file.path}`,
        path: file.path,
        section: "unstaged",
        status: file.status,
        insertions: file.insertions,
        deletions: file.deletions,
        file
      }))
    }];
  }
  const grouped = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const file = byPath.get(entry.path) ?? null;
    if (!file) continue;
    const rows = grouped.get(entry.section) ?? [];
    rows.push({
      key: `${entry.section}:${entry.path}`,
      path: entry.path,
      origPath: entry.origPath,
      section: entry.section,
      status: entry.status,
      insertions: entry.insertions,
      deletions: entry.deletions,
      file
    });
    grouped.set(entry.section, rows);
  }
  return ORDER.filter((key) => (grouped.get(key)?.length ?? 0) > 0).map((key) => ({ key, label: LABELS[key], rows: grouped.get(key) }));
}
var STATUS_BY_LETTER = {
  A: "added",
  D: "deleted",
  R: "renamed",
  C: "renamed",
  T: "modified",
  M: "modified",
  U: "conflict",
  "?": "untracked"
};
function toChangeEntries(entries) {
  const rows = [];
  for (const entry of entries) {
    const status = entry.untracked ? "untracked" : entry.conflict ? "conflict" : STATUS_BY_LETTER[entry.index !== "." ? entry.index : entry.worktree] ?? "modified";
    const section = entry.conflict ? "conflict" : entry.untracked ? "untracked" : entry.index !== "." ? "staged" : "unstaged";
    const row = {
      path: entry.path,
      origPath: entry.origPath,
      section,
      status,
      insertions: 0,
      deletions: 0,
      code: `${entry.index}${entry.worktree}`
    };
    rows.push(row);
    if (!entry.conflict && !entry.untracked && entry.index !== "." && entry.worktree !== ".") {
      rows.push({ ...row, section: "unstaged", status: STATUS_BY_LETTER[entry.worktree] ?? "modified" });
    }
  }
  return rows;
}
function indexSummary(entries) {
  const summary = { staged: 0, unstaged: 0, conflicts: 0, untracked: 0, insertions: 0, deletions: 0, binary: 0 };
  for (const entry of entries ?? []) {
    summary[entry.section] += 1;
    summary.insertions += entry.insertions;
    summary.deletions += entry.deletions;
    if (entry.binary) summary.binary += 1;
  }
  return summary;
}
function commitProblem(message2, summary) {
  if (summary.conflicts > 0) return "There are unresolved conflicts, resolve them before committing.";
  if (summary.staged === 0) return "The index is empty; stage the files you want to commit first.";
  if (!message2.trim()) return "Please fill in the commit message.";
  return null;
}
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "avif", "svg"]);
function isImagePath(path) {
  const name = path.split("/").pop() ?? path;
  if (!name.includes(".")) return false;
  return IMAGE_EXTENSIONS.has(name.split(".").pop().toLowerCase());
}
function canPreviewImage(file) {
  return file.status !== "deleted" && isImagePath(file.path);
}

// src/client/diff/patch.ts
function patchPreamble(rawPatch) {
  const lines = trimmedLines(rawPatch);
  const firstHunk = lines.findIndex((line) => line.startsWith("@@"));
  return firstHunk < 0 ? lines.join("\n") : lines.slice(0, firstHunk).join("\n");
}
function isHunklessPatch(rawPatch) {
  return !trimmedLines(rawPatch).some((line) => line.startsWith("@@"));
}
function splitHunks(rawPatch) {
  const lines = trimmedLines(rawPatch);
  const firstHunk = lines.findIndex((line) => line.startsWith("@@"));
  if (firstHunk < 0) return [];
  const hunks = [];
  for (const line of lines.slice(firstHunk)) {
    if (line.startsWith("@@")) hunks.push([line]);
    else hunks[hunks.length - 1]?.push(line);
  }
  return hunks;
}
function buildHunkPatch(rawPatch, indexes) {
  if (isHunklessPatch(rawPatch)) return indexes.length ? "" : rawPatch;
  const hunks = splitHunks(rawPatch);
  if (indexes.length && indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= hunks.length)) return "";
  const wanted = indexes.length ? [...new Set(indexes)].sort((left, right) => left - right) : hunks.map((_, index) => index);
  if (!wanted.length) return "";
  const body = wanted.map((index) => hunks[index].join("\n")).join("\n");
  return `${patchPreamble(rawPatch)}
${body}
`;
}
function trimmedLines(rawPatch) {
  const lines = rawPatch.split("\n");
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}
var TOKEN_PATTERN = /[A-Za-z0-9_]+|\p{Script=Han}|[^\s]|\s+/gu;
function tokenizeLine(line) {
  return line.match(TOKEN_PATTERN) ?? [];
}
function diffWords(oldLine, newLine) {
  const left = tokenizeLine(oldLine);
  const right = tokenizeLine(newLine);
  if (left.length * right.length > 16e4) return positionalDiff(left, right);
  const table = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));
  for (let i2 = left.length - 1; i2 >= 0; i2--) {
    for (let j2 = right.length - 1; j2 >= 0; j2--) {
      table[i2][j2] = left[i2] === right[j2] ? table[i2 + 1][j2 + 1] + 1 : Math.max(table[i2 + 1][j2], table[i2][j2 + 1]);
    }
  }
  const oldTokens = [];
  const newTokens = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      oldTokens.push({ text: left[i], changed: false });
      newTokens.push({ text: right[j], changed: false });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      oldTokens.push({ text: left[i], changed: true });
      i++;
    } else {
      newTokens.push({ text: right[j], changed: true });
      j++;
    }
  }
  for (; i < left.length; i++) oldTokens.push({ text: left[i], changed: true });
  for (; j < right.length; j++) newTokens.push({ text: right[j], changed: true });
  return { old: mergeSegments(oldTokens), new: mergeSegments(newTokens) };
}
function positionalDiff(left, right) {
  return {
    old: mergeSegments(left.map((text2, index) => ({ text: text2, changed: right[index] !== text2 }))),
    new: mergeSegments(right.map((text2, index) => ({ text: text2, changed: left[index] !== text2 })))
  };
}
function mergeSegments(tokens) {
  const merged = [];
  for (const token of tokens) {
    const last = merged[merged.length - 1];
    if (last && last.changed === token.changed) last.text += token.text;
    else merged.push({ ...token });
  }
  return merged;
}
function pairChangedLines(lines) {
  const pairs = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.type === "del") {
      const deletions = [];
      while (index < lines.length && lines[index].type === "del") deletions.push(index++);
      const additions = [];
      while (index < lines.length && lines[index].type === "add") additions.push(index++);
      for (let k = 0; k < Math.max(deletions.length, additions.length); k++) {
        pairs.push({
          delIndex: deletions[k],
          addIndex: additions[k],
          oldLine: deletions[k] === void 0 ? void 0 : lines[deletions[k]].content,
          newLine: additions[k] === void 0 ? void 0 : lines[additions[k]].content
        });
      }
      continue;
    }
    if (line.type === "add") pairs.push({ addIndex: index, newLine: line.content });
    index++;
  }
  return pairs;
}
function wordHighlight(lines) {
  const highlight = /* @__PURE__ */ new Map();
  for (const pair of pairChangedLines(lines)) {
    if (pair.oldLine === void 0 || pair.newLine === void 0) continue;
    const words = diffWords(pair.oldLine, pair.newLine);
    if (pair.delIndex !== void 0) highlight.set(pair.delIndex, words.old);
    if (pair.addIndex !== void 0) highlight.set(pair.addIndex, words.new);
  }
  return highlight;
}
function splitRows(lines) {
  const rows = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.type === "del") {
      const removed = [];
      while (index < lines.length && lines[index].type === "del") removed.push(lines[index++]);
      const added = [];
      while (index < lines.length && lines[index].type === "add") added.push(lines[index++]);
      for (let k = 0; k < Math.max(removed.length, added.length); k++) {
        rows.push({
          left: removed[k] ? { num: removed[k].oldNum, content: removed[k].content, type: "del" } : void 0,
          right: added[k] ? { num: added[k].newNum, content: added[k].content, type: "add" } : void 0
        });
      }
      continue;
    }
    if (line.type === "add") {
      rows.push({ right: { num: line.newNum, content: line.content, type: "add" } });
    } else {
      rows.push({
        left: { num: line.oldNum, content: line.content, type: "normal" },
        right: { num: line.newNum, content: line.content, type: "normal" }
      });
    }
    index++;
  }
  return rows;
}

// src/client/diff/workbench-state.ts
var MAX_WORKBENCH_UI_STATES = 32;
var cache = /* @__PURE__ */ new Map();
function cacheKey(sessionId, cwd) {
  if (!cwd || sessionId == null || sessionId === "") return null;
  return JSON.stringify([String(sessionId), cwd]);
}
function copyUiState(state) {
  return {
    selectedFile: typeof state.selectedFile === "string" ? state.selectedFile : null,
    compareTarget: state.compareTarget === "branch-upstream" ? "branch-upstream" : "working-head",
    compareScope: state.compareScope === "staged" || state.compareScope === "unstaged" ? state.compareScope : "all",
    focusedFile: state.focusedFile && typeof state.focusedFile.cwd === "string" && typeof state.focusedFile.path === "string" ? { cwd: state.focusedFile.cwd, path: state.focusedFile.path } : null,
    commitMessage: typeof state.commitMessage === "string" ? state.commitMessage : "",
    fileListScrollTop: Number.isFinite(state.fileListScrollTop) ? Math.max(0, state.fileListScrollTop) : 0,
    diffScrollTop: Number.isFinite(state.diffScrollTop) ? Math.max(0, state.diffScrollTop) : 0
  };
}
function readWorkbenchUiState(sessionId, cwd) {
  const key = cacheKey(sessionId, cwd);
  if (!key) return null;
  const state = cache.get(key);
  if (!state) return null;
  cache.delete(key);
  cache.set(key, state);
  return copyUiState(state);
}
function writeWorkbenchUiState(sessionId, cwd, state) {
  const key = cacheKey(sessionId, cwd);
  if (!key) return;
  cache.delete(key);
  cache.set(key, copyUiState(state));
  while (cache.size > MAX_WORKBENCH_UI_STATES) {
    const oldest = cache.keys().next().value;
    if (oldest === void 0) break;
    cache.delete(oldest);
  }
}

// src/client/diff/ChangesTab.tsx
var import_jsx_runtime12 = require("react/jsx-runtime");
function ChangesLoading() {
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(GitLoadingState, { title: "Loading repository", hint: "Branches and file changes will appear here shortly" });
}
var OPERATION_LABELS = {
  merge: "Merge in progress",
  rebase: "Rebase in progress",
  "cherry-pick": "Cherry-pick in progress",
  revert: "Revert in progress",
  am: "Applying mail patch in progress",
  bisect: "Bisect in progress",
  apply: "Patch application in progress"
};
var OPERATION_STEPS = {
  merge: ["continue", "abort"],
  rebase: ["continue", "skip", "abort"],
  "cherry-pick": ["continue", "skip", "abort"],
  revert: ["continue", "skip", "abort"],
  am: ["continue", "skip", "abort"]
};
var STEP_LABELS = { continue: "Continue", skip: "Skip this step", abort: "Abort operation" };
var SCOPES = [
  { key: "all", label: "All", hint: "All differences between the working tree and HEAD" },
  { key: "unstaged", label: "Unstaged", hint: "Between the index and the working tree (stage hunk by hunk is available)" },
  { key: "staged", label: "Staged", hint: "Between HEAD and the index (unstage hunk by hunk is available)" }
];
var CONTEXT_CHOICES = [0, 3, 10];
function ChangesTab(props) {
  const cwd = useWorkspaceCwd(props);
  const sessionId = props.sessionId == null ? null : String(props.sessionId);
  const restoredUiState = readWorkbenchUiState(sessionId, cwd);
  const { status, isGit, loading: statusLoading, error: statusError, reload: reloadStatus } = useGitStatus(cwd);
  const [selectedFile, setSelectedFile] = (0, import_react12.useState)(() => restoredUiState?.selectedFile ?? null);
  const [compareTarget, setCompareTarget] = (0, import_react12.useState)(() => restoredUiState?.compareTarget ?? "working-head");
  const [compareDropdownOpen, setCompareDropdownOpen] = (0, import_react12.useState)(false);
  const [refresh, setRefresh] = (0, import_react12.useState)(0);
  const [editorNotice, setEditorNotice] = (0, import_react12.useState)(null);
  const branch = status?.branch;
  const head = status?.head;
  const revision = status?.revision;
  const upstream = status?.upstream;
  const dirtyFiles = status?.dirtyFiles;
  const requestKey = JSON.stringify([sessionId, cwd, isGit, compareTarget, branch, head, revision, upstream, dirtyFiles, refresh]);
  const [result, setResult] = (0, import_react12.useState)(null);
  const [compareScope, setCompareScope] = (0, import_react12.useState)(() => restoredUiState?.compareScope ?? "all");
  const [contextLines, setContextLines] = (0, import_react12.useState)(3);
  const [ignoreWhitespace, setIgnoreWhitespace] = (0, import_react12.useState)(false);
  const [wordLevel, setWordLevel] = (0, import_react12.useState)(true);
  const [splitView, setSplitView] = (0, import_react12.useState)(false);
  const [activeHunk, setActiveHunk] = (0, import_react12.useState)(0);
  const [busy, setBusy] = (0, import_react12.useState)(null);
  const [actionNotice, setActionNotice] = (0, import_react12.useState)(null);
  const [commitMessage, setCommitMessage] = (0, import_react12.useState)(() => restoredUiState?.commitMessage ?? "");
  const [amend, setAmend] = (0, import_react12.useState)(false);
  const [signoff, setSignoff] = (0, import_react12.useState)(false);
  const [commitAll, setCommitAll] = (0, import_react12.useState)(false);
  const [conflictOpen, setConflictOpen] = (0, import_react12.useState)(null);
  const [conflictFile, setConflictFile] = (0, import_react12.useState)(null);
  const [conflictError, setConflictError] = (0, import_react12.useState)(null);
  const conflictRequest = (0, import_react12.useRef)(0);
  const [inspectFile, setInspectFile] = (0, import_react12.useState)(null);
  const [fileQuery, setFileQuery] = (0, import_react12.useState)("");
  const current = result?.key === requestKey ? result : null;
  const diffView = current?.view ?? null;
  const [focusedFile, setFocusedFile] = (0, import_react12.useState)(() => restoredUiState?.focusedFile ?? null);
  const cacheIdentityRef = (0, import_react12.useRef)({ sessionId, cwd });
  const focusPath = cacheIdentityRef.current.sessionId === sessionId && focusedFile?.cwd === cwd ? focusedFile.path : null;
  const fileListElement = (0, import_react12.useRef)(null);
  const diffLinesElement = (0, import_react12.useRef)(null);
  const uiStateRef = (0, import_react12.useRef)({
    selectedFile,
    compareTarget,
    compareScope,
    focusedFile,
    commitMessage,
    fileListScrollTop: restoredUiState?.fileListScrollTop ?? 0,
    diffScrollTop: restoredUiState?.diffScrollTop ?? 0
  });
  uiStateRef.current = { ...uiStateRef.current, selectedFile, compareTarget, compareScope, focusedFile, commitMessage };
  const saveUiState = (identity2) => {
    const state = uiStateRef.current;
    writeWorkbenchUiState(identity2.sessionId, identity2.cwd, {
      ...state,
      fileListScrollTop: fileListElement.current?.scrollTop ?? state.fileListScrollTop,
      diffScrollTop: diffLinesElement.current?.scrollTop ?? state.diffScrollTop
    });
  };
  const loadingDiff = !!cwd && isGit && (!current || current.loading);
  const diffError = current?.error;
  (0, import_react12.useEffect)(() => {
    const previous = cacheIdentityRef.current;
    if (previous.sessionId === sessionId && previous.cwd === cwd) return;
    saveUiState(previous);
    cacheIdentityRef.current = { sessionId, cwd };
    const restored = readWorkbenchUiState(sessionId, cwd);
    const restoredFocus = restored?.focusedFile?.cwd === cwd ? restored.focusedFile : null;
    const nextState = {
      selectedFile: restored?.selectedFile ?? null,
      compareTarget: restored?.compareTarget ?? "working-head",
      compareScope: restored?.compareScope ?? "all",
      focusedFile: restoredFocus,
      commitMessage: restored?.commitMessage ?? "",
      fileListScrollTop: restored?.fileListScrollTop ?? 0,
      diffScrollTop: restored?.diffScrollTop ?? 0
    };
    uiStateRef.current = nextState;
    setSelectedFile(nextState.selectedFile);
    setCompareTarget(nextState.compareTarget);
    setCompareScope(nextState.compareScope);
    setFocusedFile(nextState.focusedFile);
    setCommitMessage(nextState.commitMessage);
    if (fileListElement.current) fileListElement.current.scrollTop = nextState.fileListScrollTop;
    if (diffLinesElement.current) diffLinesElement.current.scrollTop = nextState.diffScrollTop;
    setCompareDropdownOpen(false);
    setFileQuery("");
    setConflictOpen(null);
    setConflictFile(null);
    setConflictError(null);
    setInspectFile(null);
    conflictRequest.current += 1;
    setActionNotice(null);
    setEditorNotice(null);
  }, [sessionId, cwd]);
  (0, import_react12.useEffect)(() => () => saveUiState(cacheIdentityRef.current), []);
  (0, import_react12.useEffect)(() => {
    if (!diffView) return;
    if (fileListElement.current) fileListElement.current.scrollTop = uiStateRef.current.fileListScrollTop;
    if (diffLinesElement.current) diffLinesElement.current.scrollTop = uiStateRef.current.diffScrollTop;
  }, [diffView]);
  (0, import_react12.useEffect)(() => {
    if (!editorNotice) return;
    const timer = setTimeout(() => setEditorNotice(null), 5e3);
    return () => clearTimeout(timer);
  }, [editorNotice]);
  (0, import_react12.useEffect)(() => {
    if (!actionNotice) return;
    const timer = setTimeout(() => setActionNotice(null), 5e3);
    return () => clearTimeout(timer);
  }, [actionNotice]);
  (0, import_react12.useEffect)(() => {
    if (!amend || !cwd) return;
    let cancelled = false;
    gitApi.getLastCommitMessage(cwd).then((message2) => {
      if (!cancelled && message2) setCommitMessage((previous) => previous || message2);
    }).catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, [amend, cwd]);
  (0, import_react12.useEffect)(() => {
    const controller = new AbortController();
    if (!cwd || !isGit) {
      setResult(null);
      return () => controller.abort();
    }
    if (compareScope === "all" && compareTarget === "branch-upstream" && !upstream) {
      setResult({ key: requestKey, view: null, error: "The current branch has no upstream configured; cannot compare.", loading: false });
      return () => controller.abort();
    }
    setResult({ key: requestKey, view: null, error: null, loading: true });
    setActiveHunk(0);
    const base = compareScope === "all" ? compareTarget === "branch-upstream" ? upstream : "HEAD" : void 0;
    const target = compareScope === "all" && compareTarget === "branch-upstream" ? "HEAD" : void 0;
    const options = {
      context: contextLines,
      ignoreWhitespace
    };
    if (compareScope !== "all") options.mode = compareScope;
    if (focusPath) options.files = [focusPath];
    gitApi.getDiff(cwd, base, target, controller.signal, options).then((view) => {
      if (controller.signal.aborted) return;
      setResult({ key: requestKey, view, error: null, loading: false });
      setSelectedFile((previous) => view.files.some((file) => file.path === previous) ? previous : view.files[0]?.path ?? null);
    }).catch((error) => {
      if (!controller.signal.aborted) setResult({ key: requestKey, view: null, error: error instanceof Error ? error.message : String(error), loading: false });
    });
    return () => controller.abort();
  }, [cwd, isGit, compareTarget, compareScope, contextLines, ignoreWhitespace, branch, head, revision, upstream, dirtyFiles, refresh, focusPath, requestKey]);
  const activeFile = (0, import_react12.useMemo)(() => {
    if (!diffView || !selectedFile) return diffView?.files[0] || null;
    return diffView.files.find((f) => f.path === selectedFile) || diffView.files[0] || null;
  }, [diffView, selectedFile]);
  const highlighted = (0, import_react12.useMemo)(() => {
    if (!wordLevel || splitView || !activeFile) return null;
    const byHunk = /* @__PURE__ */ new Map();
    activeFile.hunks.forEach((hunk, index) => byHunk.set(index, wordHighlight(hunk.lines)));
    return byHunk;
  }, [wordLevel, splitView, activeFile]);
  const files = diffView?.files ?? [];
  const entries = status?.entries ? toChangeEntries(status.entries) : void 0;
  const summary = indexSummary(entries);
  const sections = buildSections(files, entries, "Changed files");
  const showSectionHeaders = !(sections.length === 1 && !entries?.length);
  const query = fileQuery.trim().toLowerCase();
  const operation = status?.operation ?? void 0;
  const operationSteps = operation ? OPERATION_STEPS[operation] ?? [] : [];
  const conflictCount = summary.conflicts;
  const stagedCount = summary.staged;
  const amendable = amend && !commitMessage.trim();
  const commitIssue = commitAll ? conflictCount > 0 ? "There are unresolved conflicts, resolve them before committing." : commitMessage.trim() ? null : "Please fill in the commit message." : amendable ? conflictCount > 0 ? "There are unresolved conflicts, resolve them before committing." : null : commitProblem(commitMessage, summary);
  const run = async (label, action) => {
    if (busy) return;
    setBusy(label);
    setActionNotice(null);
    try {
      const outcome = await action();
      if (outcome && outcome.ok === false) setActionNotice({ ok: false, text: outcome.error || `${label}Failed` });
      else setActionNotice({ ok: true, text: `${label}Done` });
      reloadStatus();
      setRefresh((value) => value + 1);
    } catch (error) {
      setActionNotice({ ok: false, text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  };
  const copyText = async (label, text2) => {
    try {
      const clipboard = globalThis.navigator?.clipboard;
      if (!clipboard?.writeText) throw new Error("The current environment does not support the clipboard");
      await clipboard.writeText(text2);
      setActionNotice({ ok: true, text: `${label}Copied` });
    } catch (error) {
      setActionNotice({ ok: false, text: errorMessage(error) });
    }
  };
  const promptContext = () => ({
    cwd,
    branch,
    upstream,
    ahead: status?.ahead,
    behind: status?.behind,
    summary: `${summary.staged} staged / ${summary.unstaged} unstaged / ${summary.untracked} untracked, +${summary.insertions} -${summary.deletions}`,
    staged: (entries ?? []).filter((entry) => entry.section === "staged").map((entry) => entry.path),
    unstaged: (entries ?? []).filter((entry) => entry.section === "unstaged").map((entry) => entry.path),
    untracked: (entries ?? []).filter((entry) => entry.section === "untracked").map((entry) => entry.path),
    conflicts: (entries ?? []).filter((entry) => entry.section === "conflict").map((entry) => entry.path),
    patch: files.map((file) => file.rawPatch ?? "").join("")
  });
  const askAgent = async (label, text2) => {
    if (!text2.trim()) return;
    setActionNotice({ ok: true, text: "Opening the side chat and filling in the prompt\u2026" });
    try {
      const result2 = await deliverPrompt({ ...props, cwd }, props.sessionId, text2);
      if (!result2.ok) {
        setActionNotice({ ok: false, text: result2.error || `${label}Failed` });
        return;
      }
      setActionNotice({ ok: true, text: result2.mode === "new-conversation" ? `Created a new chat and filled in "${label}" prompt, confirm before sending` : `Filled in the side chat "${label}" prompt, confirm before sending` });
    } catch (error) {
      setActionNotice({ ok: false, text: errorMessage(error) || `${label}Failed` });
    }
  };
  const draftCommitPrompt = async (event) => {
    if ((event?.detail ?? 0) > 1) return;
    try {
      const staged = compareScope === "staged" ? diffView : await gitApi.getDiff(cwd, "HEAD", "working", void 0, { mode: "staged" });
      await askAgent("Commit message", buildCommitPrompt({ ...promptContext(), patch: staged?.files.map((file) => file.rawPatch ?? "").join("") || "" }));
    } catch (error) {
      setActionNotice({ ok: false, text: errorMessage(error) });
    }
  };
  const applyHunks = (file, indexes, direction) => {
    const patch = buildHunkPatch(file.rawPatch ?? "", indexes);
    if (!patch) {
      setActionNotice({ ok: false, text: "No patch is available for this hunk, use a whole-file action instead." });
      return;
    }
    return run(direction === "stage" ? "Stage selected lines" : "Unstage selected lines", () => gitApi.applyPatch(cwd, patch, direction === "unstage" ? { cached: true, reverse: true } : { cached: true }));
  };
  const jumpHunk = (delta) => {
    const total = activeFile?.hunks.length ?? 0;
    if (!total) return;
    const next = (activeHunk + delta + total) % total;
    setActiveHunk(next);
    const element = globalThis.document?.getElementById(`dsh-git-hunk-${next}`);
    element?.scrollIntoView?.({ block: "center" });
  };
  const showConflict = async (path) => {
    const request = ++conflictRequest.current;
    if (conflictOpen === path) {
      setConflictOpen(null);
      setConflictFile(null);
      setConflictError(null);
      return;
    }
    setConflictOpen(path);
    setConflictFile(null);
    setConflictError(null);
    try {
      const files2 = await gitApi.getConflicts(cwd);
      if (conflictRequest.current !== request) return;
      setConflictFile(files2.find((file) => file.path === path) ?? null);
    } catch (error) {
      if (conflictRequest.current !== request) return;
      setConflictError(errorMessage(error));
    }
  };
  const submitCommit = () => run(status?.operation ? "Commit" : amend ? "Amend commit" : "Commit", async () => {
    const outcome = await gitApi.commit(cwd, { message: commitMessage, amend, signoff, all: commitAll });
    if (!outcome.ok) return outcome;
    setCommitMessage("");
    setAmend(false);
    return outcome;
  });
  const firstLoad = statusLoading && !status && !statusError;
  if (statusError && !status) return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-changes-panel", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-empty-state", children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-state-icon", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconDiff, { size: 24 }) }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("strong", { children: "Cannot load the repository right now" }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { className: "dsh-git-state-error", role: "alert", children: statusError }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: reloadStatus, children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconRefresh, { size: 14 }),
      "Reload"
    ] })
  ] }) });
  if (!statusLoading && !isGit) {
    return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-changes-panel", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-empty-state", children: [
      statusError && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-state-error", role: "alert", children: statusError }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-state-icon", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconDiff, { size: 24 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("strong", { children: "The current directory is not a Git repository" }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("p", { children: [
        "Run in project ",
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("code", { children: "git init" }),
        " , then you can see branches and file diffs."
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
        "button",
        {
          type: "button",
          className: "dsh-git-btn dsh-git-btn-primary",
          onClick: () => {
            reloadStatus();
          },
          children: "Reload"
        }
      )
    ] }) });
  }
  const renderRow = (row) => {
    const isSelected = row.path === activeFile?.path;
    const isUntracked = row.status === "untracked";
    const canDiscard = row.section === "unstaged" && !isUntracked;
    return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: `dsh-git-file-row ${isSelected ? "dsh-git-file-row-active" : ""}`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
        "button",
        {
          type: "button",
          "aria-pressed": isSelected,
          className: `dsh-git-file-item ${isSelected ? "dsh-git-file-item-active" : ""}`,
          onClick: () => setSelectedFile(row.path),
          title: row.path,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: `dsh-git-file-status dsh-git-tone-${statusTone(row.status)}`, children: statusLetter2(row.status) }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-file-name", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconFile, { size: 13 }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-file-copy", children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: row.path.split("/").pop() || row.path }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("small", { children: row.path.includes("/") ? row.path.slice(0, row.path.lastIndexOf("/")) : "Repository root" })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-file-stats", children: row.file?.binary ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-binary-mark", children: "Binary" }) : row.insertions || row.deletions ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-ins", children: [
                "+",
                row.insertions
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-del", children: [
                "-",
                row.deletions
              ] })
            ] }) : null })
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-file-actions", children: [
        row.section === "unstaged" && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          "button",
          {
            type: "button",
            className: "dsh-git-icon-btn",
            title: "Stage this file",
            disabled: !!busy,
            onClick: (event) => {
              event?.stopPropagation?.();
              run("Stage file", () => gitApi.stage(cwd, [row.path]));
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconPlus, { size: 12 })
          }
        ),
        row.section === "staged" && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          "button",
          {
            type: "button",
            className: "dsh-git-icon-btn",
            title: "Unstage this file",
            disabled: !!busy,
            onClick: (event) => {
              event?.stopPropagation?.();
              run("Unstage", () => gitApi.unstage(cwd, [row.path]));
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconMinus, { size: 12 })
          }
        ),
        canDiscard && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          "button",
          {
            type: "button",
            className: "dsh-git-icon-btn",
            title: "Revert changes to this file",
            disabled: !!busy,
            onClick: (event) => {
              event?.stopPropagation?.();
              run("Discard changes", () => gitApi.discard(cwd, [row.path]));
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconUndo, { size: 12 })
          }
        ),
        row.section === "staged" && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          "button",
          {
            type: "button",
            className: "dsh-git-icon-btn",
            title: "Unstage and discard these changes",
            disabled: !!busy,
            onClick: (event) => {
              event?.stopPropagation?.();
              run("Discard staged changes", () => gitApi.discard(cwd, [row.path], true));
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconTrash, { size: 12 })
          }
        ),
        isUntracked && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          "button",
          {
            type: "button",
            className: "dsh-git-icon-btn",
            title: "Delete this untracked file",
            disabled: !!busy,
            onClick: (event) => {
              event?.stopPropagation?.();
              run("Delete untracked files", () => gitApi.deleteUntracked(cwd, [row.path]));
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconTrash, { size: 12 })
          }
        ),
        isUntracked && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          "button",
          {
            type: "button",
            className: "dsh-git-icon-btn",
            title: "Add to .gitignore",
            disabled: !!busy,
            onClick: (event) => {
              event?.stopPropagation?.();
              run("Add to .gitignore", () => gitApi.addToGitignore(cwd, [row.path]));
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconClose, { size: 12 })
          }
        ),
        row.section === "conflict" && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
            "button",
            {
              type: "button",
              className: "dsh-git-icon-btn dsh-git-icon-btn-wide",
              title: "Keep the current branch version (--ours)",
              disabled: !!busy,
              onClick: (event) => {
                event?.stopPropagation?.();
                run("Use current version", () => gitApi.resolveConflict(cwd, row.path, "ours"));
              },
              children: "Current"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
            "button",
            {
              type: "button",
              className: "dsh-git-icon-btn dsh-git-icon-btn-wide",
              title: "Keep the incoming version (--theirs)",
              disabled: !!busy,
              onClick: (event) => {
                event?.stopPropagation?.();
                run("Use incoming version", () => gitApi.resolveConflict(cwd, row.path, "theirs"));
              },
              children: "Incoming"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { type: "button", className: "dsh-git-icon-btn", title: "View conflict", onClick: (event) => {
            event?.stopPropagation?.();
            showConflict(row.path);
          }, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconWarning, { size: 12 }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          "button",
          {
            type: "button",
            className: "dsh-git-icon-btn",
            title: "Reveal in file manager",
            disabled: !!busy,
            onClick: (event) => {
              event?.stopPropagation?.();
              run("Reveal in file manager", () => gitApi.reveal(cwd, row.path));
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconFolderTree, { size: 12 })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          "button",
          {
            type: "button",
            className: "dsh-git-icon-btn",
            title: "Copy path",
            onClick: (event) => {
              event?.stopPropagation?.();
              copyText("Path", row.path);
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconCopy, { size: 12 })
          }
        )
      ] }),
      conflictOpen === row.path && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-conflict-view", children: conflictError ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-conflict-line dsh-git-error", role: "alert", children: conflictError }) : !conflictFile ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-conflict-line", children: "Reading conflict content\u2026" }) : conflictFile.binary ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-conflict-line", children: 'A binary file cannot show both conflict sides; choose a side with "Current / Incoming".' }) : conflictFile.lines.map((line, index) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: `dsh-git-conflict-line dsh-git-conflict-${line.type}`, children: line.content }, index)) })
    ] }, row.key);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-changes-panel", "aria-busy": firstLoad ? "true" : void 0, children: [
    firstLoad ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-toolbar-skeleton", "aria-hidden": "true", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("i", {}),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("i", {})
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-changes-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-repo-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-current-branch", title: status?.branch || "HEAD", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconBranch, { size: 15 }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: status?.branch || "HEAD" })
        ] }),
        !!status?.ahead && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-ahead-behind dsh-git-ahead", title: ` ahead of upstream ${status.ahead} commits`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconArrowUp, { size: 12 }),
          status.ahead
        ] }),
        !!status?.behind && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-ahead-behind dsh-git-behind", title: ` behind upstream ${status.behind} commits`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconArrowDown, { size: 12 }),
          status.behind
        ] }),
        !!status?.stashCount && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-stash-badge", title: `has ${status.stashCount} stash entries`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconStash, { size: 12 }),
          status.stashCount
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-change-summary", children: [
          diffView && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-file-count", children: diffView.files.length ? `${diffView.files.length} files` : "No changes" }),
          !!diffView?.files.length && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-stat-badge", "aria-label": `Added ${diffView.totalInsertions} lines, deleted ${diffView.totalDeletions} lines`, children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-ins", children: [
              "+",
              diffView.totalInsertions
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-del", children: [
              "\u2212",
              diffView.totalDeletions
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { type: "button", className: "dsh-git-refresh-btn", "aria-label": "Refresh changes", title: "Refresh changes", disabled: loadingDiff || statusLoading, onClick: () => {
          reloadStatus();
          setRefresh((value) => value + 1);
        }, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconRefresh, { size: 15, className: loadingDiff || statusLoading ? "dsh-git-spin" : "" }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-compare-control", onKeyDown: (event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setCompareDropdownOpen(false);
          event.currentTarget.querySelector(".dsh-git-compare-trigger")?.focus();
        }
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("button", { type: "button", className: `dsh-git-compare-trigger ${compareDropdownOpen ? "dsh-git-compare-trigger-open" : ""}`, onClick: () => setCompareDropdownOpen(!compareDropdownOpen), title: "Switch diff base", "aria-expanded": compareDropdownOpen, children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconDiff, { size: 15 }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-compare-label", children: compareTarget === "working-head" ? "Workspace" : status?.branch || "HEAD" }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-compare-arrow", "aria-hidden": "true", children: "\u2192" }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-compare-base", children: compareTarget === "working-head" ? "HEAD" : upstream || "No upstream configured" }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconChevronDown, { size: 13 })
        ] }),
        compareDropdownOpen && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-compare-backdrop", onClick: () => setCompareDropdownOpen(false) }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-compare-menu", role: "group", "aria-label": "Compare against", children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-compare-menu-heading", children: "Compare against" }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("button", { type: "button", className: "dsh-git-compare-option", "aria-pressed": compareTarget === "working-head", onClick: (event) => {
              setCompareTarget("working-head");
              setCompareDropdownOpen(false);
              event.currentTarget.closest(".dsh-git-compare-control")?.querySelector(".dsh-git-compare-trigger")?.focus();
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-option-icon", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconDiff, { size: 17 }) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-option-copy", children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("strong", { children: "Uncommitted changes" }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: "Working tree vs HEAD" })
              ] }),
              compareTarget === "working-head" && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconCheck, { size: 16 })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("button", { type: "button", className: "dsh-git-compare-option", disabled: !upstream, "aria-pressed": compareTarget === "branch-upstream", onClick: (event) => {
              setCompareTarget("branch-upstream");
              setCompareDropdownOpen(false);
              event.currentTarget.closest(".dsh-git-compare-control")?.querySelector(".dsh-git-compare-trigger")?.focus();
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-option-icon", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconBranch, { size: 17 }) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-option-copy", children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("strong", { children: [
                  "Compare with upstream",
                  !upstream && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("small", { children: "Not configured" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: upstream ? `${status?.branch || "HEAD"} \u2192 ${upstream}` : "Available after configuring an upstream branch" })
              ] }),
              compareTarget === "branch-upstream" && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconCheck, { size: 16 })
            ] })
          ] })
        ] })
      ] })
    ] }),
    operation && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-operation-banner", role: "status", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-operation-icon", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconWarning, { size: 16 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-operation-copy", children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("strong", { children: OPERATION_LABELS[operation] ?? `Git operation in progress (${operation})` }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: conflictCount > 0 ? `has ${conflictCount} files have conflicts; resolve them to continue.` : "There are no conflicts to resolve; you can continue this operation." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-operation-actions", children: operationSteps.map((step) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
        "button",
        {
          type: "button",
          className: `dsh-git-btn dsh-git-btn-secondary ${step === "abort" ? "dsh-git-btn-danger" : ""}`,
          disabled: !!busy,
          onClick: () => run(STEP_LABELS[step], () => gitApi.operationStep(cwd, step)),
          children: STEP_LABELS[step]
        },
        step
      )) })
    ] }),
    statusError && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-changes-notice dsh-git-error", role: "alert", children: statusError }),
    editorNotice && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: `dsh-git-changes-notice ${editorNotice.ok ? "dsh-git-editor-notice" : "dsh-git-error"}`, role: "status", children: editorNotice.text }),
    actionNotice && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: `dsh-git-changes-notice ${actionNotice.ok ? "dsh-git-action-notice" : "dsh-git-error"}`, role: "status", children: actionNotice.text }),
    busy && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-changes-notice dsh-git-busy-notice", role: "status", children: [
      busy,
      "\u2026"
    ] }),
    firstLoad || loadingDiff ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ChangesLoading, {}) : diffError ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-empty-state", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-state-icon", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconDiff, { size: 24 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("strong", { children: "Cannot read the diff" }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { className: "dsh-git-state-error", role: "alert", children: diffError }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: () => {
        reloadStatus();
        setRefresh((value) => value + 1);
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconRefresh, { size: 14 }),
        "Retry"
      ] })
    ] }) : diffView && diffView.files.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-empty-state", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-state-icon dsh-git-state-clean", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconCheck, { size: 26 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("strong", { children: compareScope === "staged" ? "The staging area is empty" : compareScope === "unstaged" ? "No unstaged changes" : compareTarget === "working-head" ? "Working tree is clean" : "Up to date with upstream branch" }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { children: compareScope !== "all" ? "Switch the range above to view the other side of the diff." : compareTarget === "working-head" ? "No uncommitted changes yet, new changes will appear here." : "There are no file differences between the current branch and its upstream." })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-changes-body", children: inspectFile ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(FileInspectDialog, { path: cwd, file: inspectFile, onClose: () => setInspectFile(null) }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-changes-side", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
        "div",
        {
          className: "dsh-git-file-list",
          ref: fileListElement,
          onScroll: (event) => {
            uiStateRef.current.fileListScrollTop = event.currentTarget.scrollTop;
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-file-list-heading", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: "Changed files" }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-file-list-count", children: [
                summary.unstaged > 0 && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "dsh-git-link-btn",
                    disabled: !!busy,
                    onClick: () => run("Stage all", () => gitApi.stageAll(cwd)),
                    children: "Stage all"
                  }
                ),
                summary.staged > 0 && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "dsh-git-link-btn",
                    disabled: !!busy,
                    onClick: () => run("Unstage all", () => gitApi.unstageAll(cwd)),
                    children: "Unstage all"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: diffView?.files.length || 0 })
              ] })
            ] }),
            files.length > 6 && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-file-filter", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconFile, { size: 13 }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("input", { className: "dsh-git-file-filter-input", value: fileQuery, placeholder: "Filter files", onChange: (event) => setFileQuery(event.currentTarget.value) }),
              fileQuery && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { type: "button", className: "dsh-git-icon-btn", title: "Clear filter", onClick: () => setFileQuery(""), children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconClose, { size: 12 }) })
            ] }),
            focusPath && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-dirty-warning", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconFile, { size: 13 }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { children: [
                "Loaded only ",
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-mono", children: focusPath }),
                " patch"
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { type: "button", className: "dsh-git-link-btn", onClick: () => setFocusedFile(null), children: "Show all files" })
            ] }),
            !diffView || diffView.files.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-file-list-empty", children: "No changes to compare" }) : sections.map((section) => {
              const rows = query ? section.rows.filter((row) => row.path.toLowerCase().includes(query)) : section.rows;
              if (rows.length === 0) return null;
              return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-file-section", children: [
                showSectionHeaders && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: `dsh-git-file-section-heading dsh-git-section-${section.key}`, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: section.label }),
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: rows.length })
                ] }),
                rows.map(renderRow)
              ] }, section.key);
            })
          ]
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-diff-view", children: activeFile ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-diff-header", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-diff-file", title: activeFile.path, children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconFile, { size: 14 }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-diff-path", children: activeFile.path }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-diff-stats", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-ins", children: [
                "+",
                activeFile.insertions
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-del", children: [
                " -",
                activeFile.deletions
              ] })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-head-actions", children: [
            activeFile.status === "untracked" && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
              "button",
              {
                type: "button",
                className: "dsh-git-btn dsh-git-btn-secondary",
                title: "Add this file to the index",
                disabled: !!busy,
                onClick: () => run("Stage file", () => gitApi.stage(cwd, [activeFile.path])),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconPlus, { size: 13 }),
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: "Stage" })
                ]
              }
            ),
            activeFile.status === "deleted" && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
              "button",
              {
                type: "button",
                className: "dsh-git-btn dsh-git-btn-secondary",
                title: "Restore this deleted file",
                disabled: !!busy,
                onClick: () => run("Restore file", () => gitApi.discard(cwd, [activeFile.path])),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconUndo, { size: 13 }),
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: "Restore" })
                ]
              }
            ),
            canPreviewImage(activeFile) && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-image-hint", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconImage, { size: 13 }),
              "Image"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("details", { className: "dsh-git-file-menu", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("summary", { className: "dsh-git-btn dsh-git-btn-secondary", children: [
                "More actions",
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconChevronDown, { size: 12 })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-file-menu-items", children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
                  "button",
                  {
                    type: "button",
                    className: "dsh-git-btn dsh-git-btn-secondary",
                    title: "View this file's history and line-by-line blame",
                    onClick: () => setInspectFile(activeFile.path),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconHistory, { size: 13 }),
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: "History" })
                    ]
                  }
                ),
                focusPath === activeFile.path ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
                  "button",
                  {
                    type: "button",
                    className: "dsh-git-btn dsh-git-btn-secondary dsh-git-tool-btn-active",
                    title: "Reload the patches for all files",
                    onClick: () => setFocusedFile(null),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconRefresh, { size: 13 }),
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: "All files" })
                    ]
                  }
                ) : /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
                  "button",
                  {
                    type: "button",
                    className: "dsh-git-btn dsh-git-btn-secondary",
                    title: "Only request the patch for this file from Git",
                    onClick: () => setFocusedFile({ cwd, path: activeFile.path }),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconFile, { size: 13 }),
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: "Load this file only" })
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
                  "button",
                  {
                    type: "button",
                    className: "dsh-git-btn dsh-git-btn-secondary dsh-git-ai-btn",
                    title: "Open the side chat and fill in the prompt explaining the current file's changes (does not send automatically)",
                    onClick: (event) => (event?.detail ?? 0) > 1 ? void 0 : askAgent("Explain this file", buildExplainPrompt({ path: activeFile.path, patch: activeFile.rawPatch ?? "", statusLabel: statusTone(activeFile.status) === "added" ? "Added" : statusTone(activeFile.status) === "deleted" ? "Deleted" : "Modified" })),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconSparkle, { size: 13 }),
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: "Explain changes" })
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
                  "button",
                  {
                    type: "button",
                    className: "dsh-git-btn dsh-git-btn-secondary",
                    title: "Copy this file's path",
                    onClick: () => copyText("Path", activeFile.path),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconCopy, { size: 13 }),
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: "Copy path" })
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
                  "button",
                  {
                    type: "button",
                    className: "dsh-git-btn dsh-git-btn-secondary",
                    title: "Reveal in file manager",
                    disabled: !!busy,
                    onClick: () => run("Reveal in file manager", () => gitApi.reveal(cwd, activeFile.path)),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconFolderTree, { size: 13 }),
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: "Reveal in file manager" })
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
                  "button",
                  {
                    type: "button",
                    className: "dsh-git-btn dsh-git-btn-secondary",
                    title: "Copy this file's patch",
                    onClick: () => copyText("Patch", activeFile.rawPatch ?? ""),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconDiff, { size: 13 }),
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: "Copy patch" })
                    ]
                  }
                )
              ] })
            ] }),
            activeFile.status !== "deleted" && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(OpenInEditorMenu, { repo: cwd, file: activeFile.path, onNotice: setEditorNotice })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-diff-toolbar", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-scope-group", role: "group", "aria-label": "Diff range", children: SCOPES.map((scope) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
            "button",
            {
              type: "button",
              title: scope.hint,
              "aria-pressed": compareScope === scope.key,
              className: `dsh-git-scope-option ${compareScope === scope.key ? "dsh-git-scope-option-active" : ""}`,
              disabled: compareTarget === "branch-upstream" && scope.key !== "all" && scope.key !== "unstaged",
              onClick: () => setCompareScope(scope.key),
              children: scope.label
            },
            scope.key
          )) }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-tool-group", children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
              "button",
              {
                type: "button",
                className: "dsh-git-tool-btn",
                title: "Show fewer or more context lines",
                onClick: () => setContextLines(CONTEXT_CHOICES[(CONTEXT_CHOICES.indexOf(contextLines) + 1) % CONTEXT_CHOICES.length]),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconColumns, { size: 13 }),
                  "Context ",
                  contextLines
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
              "button",
              {
                type: "button",
                className: `dsh-git-tool-btn ${wordLevel ? "dsh-git-tool-btn-active" : ""}`,
                "aria-pressed": wordLevel,
                title: "Highlight changed words inline",
                onClick: () => setWordLevel((value) => !value),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-tool-glyph", "aria-hidden": "true", children: "a" }),
                  "Word level"
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
              "button",
              {
                type: "button",
                className: `dsh-git-tool-btn ${ignoreWhitespace ? "dsh-git-tool-btn-active" : ""}`,
                "aria-pressed": ignoreWhitespace,
                title: "Ignore whitespace differences (git diff -w)",
                onClick: () => setIgnoreWhitespace((value) => !value),
                children: "Ignore whitespace"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
              "button",
              {
                type: "button",
                className: `dsh-git-tool-btn ${splitView ? "dsh-git-tool-btn-active" : ""}`,
                "aria-pressed": splitView,
                title: "Show the before and after in two side-by-side columns",
                onClick: () => setSplitView((value) => !value),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconColumns, { size: 13 }),
                  "Side by side"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-tool-group", children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
              "button",
              {
                type: "button",
                className: "dsh-git-tool-btn",
                title: "Previous change",
                disabled: !activeFile.hunks.length,
                onClick: () => jumpHunk(-1),
                children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconChevronUp, { size: 13 })
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-hunk-position", children: activeFile.hunks.length ? `${Math.min(activeHunk + 1, activeFile.hunks.length)}/${activeFile.hunks.length}` : "\u2014" }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
              "button",
              {
                type: "button",
                className: "dsh-git-tool-btn",
                title: "Next change",
                disabled: !activeFile.hunks.length,
                onClick: () => jumpHunk(1),
                children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconChevronDown, { size: 13 })
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          "div",
          {
            className: "dsh-git-diff-lines",
            ref: diffLinesElement,
            onScroll: (event) => {
              uiStateRef.current.diffScrollTop = event.currentTarget.scrollTop;
            },
            children: activeFile.hunks.length === 0 ? canPreviewImage(activeFile) ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-image-preview-wrap", children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("img", { className: "dsh-git-image-preview", alt: activeFile.path, src: blobUrl(cwd, activeFile.path, status?.revision) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-image-caption", children: activeFile.path })
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-diff-note", children: activeFile.status === "deleted" ? "File has been deleted" : activeFile.binary ? "Binary files have no diff lines to display." : "The file contains no diff lines, or there are no changes in this range." }) : activeFile.hunks.map((hunk, hunkIndex) => {
              const segments = highlighted?.get(hunkIndex);
              const canStageHunk = compareScope === "unstaged" && !activeFile.binary;
              const canUnstageHunk = compareScope === "staged" && !activeFile.binary;
              return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
                "div",
                {
                  id: `dsh-git-hunk-${hunkIndex}`,
                  className: `dsh-git-hunk ${hunkIndex === activeHunk ? "dsh-git-hunk-current" : ""}`,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-hunk-header", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-hunk-title", children: hunk.header }),
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-hunk-actions", children: [
                        canStageHunk && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
                          "button",
                          {
                            type: "button",
                            className: "dsh-git-hunk-action",
                            title: "Stage only this hunk",
                            disabled: !!busy,
                            onClick: () => applyHunks(activeFile, [hunkIndex], "stage"),
                            children: [
                              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconPlus, { size: 11 }),
                              "Stage these lines"
                            ]
                          }
                        ),
                        canUnstageHunk && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
                          "button",
                          {
                            type: "button",
                            className: "dsh-git-hunk-action",
                            title: "Unstage only this hunk",
                            disabled: !!busy,
                            onClick: () => applyHunks(activeFile, [hunkIndex], "unstage"),
                            children: [
                              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconMinus, { size: 11 }),
                              "Unstage these lines"
                            ]
                          }
                        ),
                        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                          "button",
                          {
                            type: "button",
                            className: "dsh-git-hunk-action",
                            title: "Copy this hunk",
                            onClick: () => copyText("Patch", buildHunkPatch(activeFile.rawPatch ?? "", [hunkIndex]) || activeFile.rawPatch || ""),
                            children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconCopy, { size: 11 })
                          }
                        )
                      ] })
                    ] }),
                    splitView ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-split", children: splitRows(hunk.lines).map((row, rowIndex) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-split-row", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: `dsh-git-split-cell ${row.left ? `dsh-git-split-${row.left.type}` : "dsh-git-split-blank"}`, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-line-num", children: row.left?.num ?? "" }),
                        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-split-text", children: row.left?.content ?? "" })
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: `dsh-git-split-cell ${row.right ? `dsh-git-split-${row.right.type}` : "dsh-git-split-blank"}`, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-line-num", children: row.right?.num ?? "" }),
                        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-split-text", children: row.right?.content ?? "" })
                      ] })
                    ] }, rowIndex)) }) : hunk.lines.map((line, lineIndex) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
                      "div",
                      {
                        className: `dsh-git-diff-row ${line.type === "add" ? "dsh-git-row-add" : line.type === "del" ? "dsh-git-row-del" : ""}`,
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-line-num", children: line.oldNum ?? "" }),
                          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-line-num", children: line.newNum ?? "" }),
                          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-line-content", children: [
                            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-line-sign", children: line.type === "add" ? "+" : line.type === "del" ? "-" : " " }),
                            segments?.get(lineIndex) ? segments.get(lineIndex).map((segment, index) => segment.changed ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: line.type === "add" ? "dsh-git-word-add" : "dsh-git-word-del", children: segment.text }, index) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: segment.text }, index)) : line.content
                          ] })
                        ]
                      },
                      lineIndex
                    ))
                  ]
                },
                hunkIndex
              );
            })
          }
        )
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-diff-placeholder", children: "Select a file on the left to see the diff" }) })
    ] }) }),
    diffView && diffView.files.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("section", { className: "dsh-git-commit-box", "aria-label": "Commit changes", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-commit-editor", children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-commit-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dsh-git-commit-title", children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconCommit, { size: 14 }),
            "Commit"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dsh-git-commit-count", children: stagedCount ? `${stagedCount} files staged` : "Staging area is empty" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          "textarea",
          {
            className: "dsh-git-commit-input",
            rows: 3,
            placeholder: amend ? "Leave blank to reuse the previous commit message" : "Commit message: the first line is the subject, the body follows after a blank line",
            value: commitMessage,
            disabled: !!busy,
            onChange: (event) => setCommitMessage(event.currentTarget.value),
            onKeyDown: (event) => {
              if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
              event.preventDefault?.();
              if (busy || commitIssue) return;
              void submitCommit();
            }
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-commit-controls", children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-commit-options", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("label", { className: "dsh-git-checkbox", title: "Rewrite the last commit instead of creating a new one", children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("input", { type: "checkbox", checked: amend, disabled: !!busy, onChange: () => setAmend((value) => !value) }),
            "Amend last commit"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("label", { className: "dsh-git-checkbox", title: "Add a Signed-off-by trailer to the commit message", children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("input", { type: "checkbox", checked: signoff, disabled: !!busy, onChange: () => setSignoff((value) => !value) }),
            "Signature"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("label", { className: "dsh-git-checkbox", title: "Commit unstaged changes as well (-a)", children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("input", { type: "checkbox", checked: commitAll, disabled: !!busy, onChange: () => setCommitAll((value) => !value) }),
            "All changes"
          ] })
        ] }),
        commitIssue && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dsh-git-commit-hint", children: commitIssue }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-commit-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-primary", disabled: !!busy || !!commitIssue, onClick: submitCommit, children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconCheck, { size: 13 }),
            amend ? "Amend commit" : "Commit"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
            "button",
            {
              type: "button",
              className: "dsh-git-btn dsh-git-btn-secondary",
              disabled: !!busy,
              title: "Undo the last commit, returning the changes to the index",
              onClick: () => run("Undo last commit", () => gitApi.undoCommit(cwd)),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconUndo, { size: 13 }),
                "Revert commit"
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
            "button",
            {
              type: "button",
              className: "dsh-git-btn dsh-git-btn-secondary dsh-git-ai-btn",
              disabled: !!busy,
              title: "Open the side chat and fill in the prompt for writing a commit message from the staged changes (does not send automatically)",
              onClick: draftCommitPrompt,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconSparkle, { size: 13 }),
                "AI write message"
              ]
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dsh-git-ai-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
            "button",
            {
              type: "button",
              className: "dsh-git-ai-btn",
              disabled: !!busy,
              title: "Open the side chat and fill in the current Git context (does not send automatically)",
              onClick: (event) => (event?.detail ?? 0) > 1 ? void 0 : askAgent("Git context", buildContextText(promptContext())),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconSparkle, { size: 12 }),
                "Inject Git context"
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
            "button",
            {
              type: "button",
              className: "dsh-git-ai-btn",
              disabled: !!busy,
              title: "Open the side chat and fill in the prompt for reviewing the current changes (does not send automatically)",
              onClick: (event) => (event?.detail ?? 0) > 1 ? void 0 : askAgent("Review changes", buildReviewPrompt(promptContext())),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(IconSparkle, { size: 12 }),
                "AI review changes"
              ]
            }
          )
        ] })
      ] })
    ] })
  ] });
}

// src/client/styles.ts
var CODE_FONT = 'var(--ds-font-family-code, Consolas, "Liberation Mono", Menlo, monospace)';
var UI_FONT = "var(--dsw-font-family, system-ui, sans-serif)";
function appUiFont() {
  if (typeof document !== "undefined" && document.documentElement && typeof getComputedStyle === "function") {
    const font = getComputedStyle(document.documentElement).fontFamily?.trim();
    if (font && !/[;{}<>]/.test(font) && !/^(?:["']?(?:Times New Roman|serif|monospace)["']?)$/i.test(font)) return font;
  }
  return UI_FONT;
}
function runtimeFontRule() {
  return `.dsh-git-sidebar-content, .dsh-git-workbench, .dsh-git-workbench-header, .dsh-git-changes-panel, .dsh-git-panel-form, .dsh-git-history-panel, .dsh-git-modal-card, .dsh-git-empty-state, .dsh-git-view-nav { font-family: ${appUiFont()}; }`;
}
function sheetText() {
  return `${STYLES}
${runtimeFontRule()}
`;
}
var STYLES = `
/* Our panels can be mounted anywhere, so they name the app's body font instead of
   inheriting whatever the host container happens to set. */
.dsh-git-sidebar-content, .dsh-git-workbench, .dsh-git-changes-panel, .dsh-git-panel-form, .dsh-git-history-panel, .dsh-git-modal-card, .dsh-git-empty-state { font-family: ${UI_FONT}; }
.dsh-git-workbench, .dsh-git-workbench *, .dsh-git-workbench *::before, .dsh-git-workbench *::after { box-sizing: border-box; }
.dsh-git-workbench { font-size: 13px; line-height: 1.5; }
.dsh-git-workbench :where(button, input, select, textarea, summary) { font-family: inherit; }
.dsh-git-workbench :where(button, summary):focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.dsh-git-chip, .dsh-git-selector-btn {
  display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-primary); font-size: 13px;
}
.dsh-git-chip { height: 28px; padding: 0 10px; border-radius: 14px; font-weight: 500; user-select: none; position: relative; }
.dsh-git-chip:hover, .dsh-git-selector-btn:hover, .dsh-git-branch-item:hover, .dsh-git-footer-btn:hover, .dsh-git-file-item:hover, .dsh-git-btn-secondary:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-git-chip-active { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.dsh-git-popover-backdrop { position: fixed; inset: 0; z-index: 9998; background: transparent; }
.dsh-git-popover {
  position: absolute; top: calc(100% + 6px); left: 0; width: 290px; max-width: 90vw; max-height: 480px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px;
  box-shadow: 0 8px 24px var(--dsw-alias-bg-overlay);
  z-index: 9999; display: flex; flex-direction: column; overflow: hidden;
}
.dsh-git-header-controls .dsh-git-popover { left: auto; right: 0; }
/* The session header is a shared row owned by several plugins: keep our two
   controls as one tight group with a gap, and never let a long branch name
   squeeze the neighbours. */
.dsh-git-header-controls { display: inline-flex; align-items: center; gap: 8px; margin-left: 6px; min-width: 0; }
.dsh-git-header-controls .dsh-git-chip > .dsh-git-chip-branch { max-width: 104px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-git-search-box { display: flex; align-items: center; gap: 8px; padding: 8px 12px; margin: 8px 10px 4px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; }
.dsh-git-search-input { border: none; outline: none; background: transparent; width: 100%; font-size: 13px; color: var(--dsw-alias-label-primary); }
.dsh-git-dirty-warning { padding: 6px 14px; font-size: 12px; color: var(--dsw-alias-state-warn-primary); background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent); margin: 4px 10px; border-radius: 6px; }
.dsh-git-branch-list { flex: 0 1 auto; min-height: 0; overflow-y: auto; max-height: 240px; padding: 4px 6px; }
.dsh-git-branch-item { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 7px 10px; border-radius: 6px; border: none; background: transparent; color: var(--dsw-alias-label-primary); font-size: 13px; text-align: left; cursor: pointer; }
.dsh-git-branch-item-active { font-weight: 600; color: var(--dsw-alias-brand-primary); }
.dsh-git-branch-item-left { display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-git-footer { border-top: 1px solid var(--dsw-alias-border-l1); padding: 4px 6px; background: var(--dsw-alias-bg-layer-2); }
.dsh-git-footer-btn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border-radius: 6px; border: none; background: transparent; color: var(--dsw-alias-label-primary); font-size: 12.5px; text-align: left; cursor: pointer; }
.dsh-git-changes-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; min-width: 0; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-family: ${UI_FONT}; font-size: 13px; line-height: 1.5; overflow: hidden; }
.dsh-git-changes-panel *, .dsh-git-changes-panel *::before, .dsh-git-changes-panel *::after { box-sizing: border-box; }
.dsh-git-changes-panel button { font-family: inherit; }
.dsh-git-changes-panel svg { flex-shrink: 0; }
/* Hashes, paths and commands (bare <code> included) use the app's code font. */
.dsh-git-changes-panel code, .dsh-git-changes-panel pre, .dsh-git-changes-panel kbd,
.dsh-git-sidebar-content code, .dsh-git-history-panel code, .dsh-git-panel-form code { font-family: ${CODE_FONT}; }
.dsh-git-mono { font-family: ${CODE_FONT}; }
.dsh-git-changes-header { display: flex; flex-direction: column; padding: 12px 16px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); gap: 10px; flex-shrink: 0; }
.dsh-git-repo-row { display: flex; align-items: center; gap: 12px; min-width: 0; min-height: 28px; }
.dsh-git-current-branch { display: inline-flex; align-items: center; gap: 7px; min-width: 0; font-size: 13px; font-weight: 600; }
.dsh-git-current-branch > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-git-current-branch > svg { color: var(--dsw-alias-label-secondary); }
.dsh-git-change-summary { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-left: auto; flex-shrink: 0; }
.dsh-git-file-count { color: var(--dsw-alias-label-secondary); white-space: nowrap; font-size: 11px; }
.dsh-git-stat-badge { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 500; font-family: ${CODE_FONT}; font-variant-numeric: tabular-nums; }
.dsh-git-refresh-btn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; flex-shrink: 0; border: 0; border-radius: 7px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.dsh-git-refresh-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dsh-git-refresh-btn:disabled { cursor: default; opacity: .55; }
.dsh-git-compare-control { position: relative; min-width: 0; }
.dsh-git-compare-trigger { display: flex; align-items: center; gap: 9px; width: 100%; min-width: 0; padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-size: 12px; line-height: 18px; cursor: pointer; text-align: left; transition: background .15s, border-color .15s; }
.dsh-git-compare-trigger:hover, .dsh-git-compare-trigger-open { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); }
.dsh-git-compare-trigger > svg:first-child, .dsh-git-compare-arrow { color: var(--dsw-alias-label-secondary); }
.dsh-git-compare-trigger > svg:last-child { margin-left: auto; color: var(--dsw-alias-label-secondary); transition: transform .15s; }
.dsh-git-compare-trigger-open > svg:last-child { transform: rotate(180deg); }
.dsh-git-compare-label, .dsh-git-compare-base { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-git-compare-base { font-family: ${CODE_FONT}; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.dsh-git-compare-arrow { flex-shrink: 0; }
.dsh-git-compare-backdrop { position: fixed; inset: 0; z-index: 999; }
.dsh-git-compare-menu { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 1000; padding: 5px; max-height: min(280px, 60vh); overflow-y: auto; border: 1px solid var(--dsw-alias-border-l1); border-radius: 11px; background: var(--dsw-alias-bg-layer-1); box-shadow: 0 10px 32px color-mix(in srgb, var(--dsw-alias-bg-overlay) 35%, transparent), 0 2px 6px color-mix(in srgb, var(--dsw-alias-bg-overlay) 12%, transparent); }
.dsh-git-compare-menu-heading { padding: 5px 9px 7px; color: var(--dsw-alias-label-secondary); font-size: 10px; font-weight: 500; letter-spacing: .04em; }
.dsh-git-compare-option { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 9px; border: 0; border-radius: 7px; background: transparent; color: var(--dsw-alias-label-primary); text-align: left; cursor: pointer; }
.dsh-git-compare-option + .dsh-git-compare-option { margin-top: 3px; }
.dsh-git-compare-option:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); }
.dsh-git-compare-option[aria-pressed="true"] { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, transparent); }
.dsh-git-compare-option[aria-pressed="true"] > svg { color: var(--dsw-alias-brand-primary); }
.dsh-git-option-icon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 30px; height: 30px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px; color: var(--dsw-alias-label-secondary); }
.dsh-git-option-copy { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 3px; }
.dsh-git-option-copy strong { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; font-weight: 500; }
.dsh-git-option-copy > span { font-size: 11px; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.dsh-git-option-copy small { padding: 0 4px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 4px; font-size: 9px; font-weight: 400; color: var(--dsw-alias-label-secondary); }
.dsh-git-compare-option:disabled { cursor: not-allowed; opacity: .55; }
/* The editor picker reuses the compare dropdown's idiom, but anchored to the right edge
   of the diff header's action row. */
.dsh-git-editor-control { position: relative; display: inline-flex; }
.dsh-git-editor-backdrop { position: fixed; inset: 0; z-index: 999; }
.dsh-git-editor-menu { position: absolute; top: calc(100% + 6px); right: 0; z-index: 1000; display: flex; flex-direction: column; gap: 2px; width: 268px; padding: 5px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 11px; background: var(--dsw-alias-bg-layer-1); box-shadow: 0 10px 32px color-mix(in srgb, var(--dsw-alias-bg-overlay) 35%, transparent), 0 2px 6px color-mix(in srgb, var(--dsw-alias-bg-overlay) 12%, transparent); }
.dsh-git-editor-option { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: 0; border-radius: 7px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; text-align: left; cursor: pointer; }
.dsh-git-editor-option:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-git-editor-option > svg { flex-shrink: 0; color: var(--dsw-alias-label-secondary); }
.dsh-git-editor-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Windows 11 tags the association a double click would use; the name keeps the room. */
.dsh-git-editor-tag { flex: 0 0 auto; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.dsh-git-editor-option-split { margin-top: 5px; padding-top: 9px; border-top: 1px solid var(--dsw-alias-border-l1); border-radius: 0 0 7px 7px; }
.dsh-git-editor-hint { display: flex; align-items: center; padding: 8px 9px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
/* Brand marks carry their own colours in src/client/editor-icons.tsx; an editor we have no mark
   for falls back to a monogram in theme tones. */
.dsh-git-editor-mark { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; border: 1px solid transparent; border-radius: 4px; font-family: ${CODE_FONT}; font-weight: 600; line-height: 1; }
.dsh-git-editor-mark-glyph { border: 0; }
/* The real icon arrives from the executable as a PNG data URL. */
.dsh-git-editor-mark-image { border: 0; object-fit: contain; }
.dsh-git-editor-mark-quiet { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dsh-git-editor-mark-outline { border-color: var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-base); color: var(--dsw-alias-brand-primary); }
.dsh-git-editor-spinner { flex-shrink: 0; width: 11px; height: 11px; margin-right: 7px; border: 2px solid color-mix(in srgb, var(--dsw-alias-label-secondary) 30%, transparent); border-top-color: var(--dsw-alias-label-secondary); border-radius: 50%; animation: dsh-git-editor-spin .7s linear infinite; }
@keyframes dsh-git-editor-spin { to { transform: rotate(360deg); } }
.dsh-git-changes-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; min-height: 160px; padding: 32px 20px; text-align: center; color: var(--dsw-alias-label-secondary); }
.dsh-git-loading-icon, .dsh-git-state-icon { display: flex; align-items: center; justify-content: center; width: 52px; height: 52px; margin-bottom: 6px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 16px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); }
.dsh-git-changes-loading strong { margin-top: 14px; font-size: 13px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.dsh-git-changes-loading p { margin: 6px 0 0; font-size: 12px; line-height: 1.6; }
.dsh-git-toolbar-skeleton { display: flex; flex-direction: column; gap: 14px; padding: 20px 16px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dsh-git-toolbar-skeleton i, .dsh-git-loading-preview i { display: block; height: 7px; border-radius: 4px; background: var(--dsw-alias-bg-layer-2); animation: dsh-git-pulse 1.8s ease-in-out infinite; }
.dsh-git-toolbar-skeleton i:first-child { width: 32%; height: 12px; }
.dsh-git-toolbar-skeleton i:last-child { height: 34px; border-radius: 8px; }
.dsh-git-loading-preview { display: flex; flex-direction: column; gap: 9px; width: 150px; margin-top: 24px; }
.dsh-git-loading-preview i:nth-child(2) { width: 75%; animation-delay: .15s; }
.dsh-git-loading-preview i:nth-child(3) { width: 88%; animation-delay: .3s; }
.dsh-git-spin { animation: dsh-git-spin 1.2s linear infinite; }
@keyframes dsh-git-spin { to { transform: rotate(360deg); } }
@keyframes dsh-git-pulse { 50% { opacity: .4; } }
@media (prefers-reduced-motion: reduce) { .dsh-git-spin, .dsh-git-toolbar-skeleton i, .dsh-git-loading-preview i { animation: none; } .dsh-git-compare-trigger, .dsh-git-compare-trigger > svg:last-child { transition: none; } }
.dsh-git-changes-notice { margin: 12px 16px 0; padding: 10px 12px; border-radius: 8px; font-size: 12px; }
.dsh-git-editor-notice { background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary); }
/* Opens the file in the user's own editor: an inline action, never a dialog. */
.dsh-git-open-editor { display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; font-size: 12px; font-family: inherit; white-space: nowrap; }
.dsh-git-changes-panel .dsh-git-empty-state { gap: 10px; }
.dsh-git-changes-panel .dsh-git-empty-state strong { font-size: 14px; font-weight: 600; }
.dsh-git-changes-panel .dsh-git-empty-state p { max-width: 300px; font-size: 12px; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.dsh-git-changes-panel .dsh-git-empty-state .dsh-git-state-error { color: var(--dsw-alias-state-error-primary); max-height: 160px; overflow: auto; }
.dsh-git-empty-state .dsh-git-btn { display: inline-flex; align-items: center; gap: 7px; margin-top: 8px; }
.dsh-git-state-clean { color: var(--dsw-alias-state-success-primary); background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 5%, var(--dsw-alias-bg-base)); }
.dsh-git-file-list-heading { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px 10px; font-size: 11px; font-weight: 500; color: var(--dsw-alias-label-secondary); }
.dsh-git-file-list-heading > span:last-child { padding: 0 6px; border-radius: 5px; background: var(--dsw-alias-bg-layer-2); font-variant-numeric: tabular-nums; }
.dsh-git-ins { color: var(--dsw-alias-state-success-primary); }
.dsh-git-del { color: var(--dsw-alias-state-error-primary); }
.dsh-git-selector-btn { padding: 4px 8px; border-radius: 6px; font-size: 12.5px; }
.dsh-git-changes-body { display: flex; flex: 1; min-height: 0; overflow: hidden; }
.dsh-git-file-list { width: 260px; max-width: 40%; flex-shrink: 0; border-right: 1px solid var(--dsw-alias-border-l1); overflow-y: auto; padding: 6px; background: var(--dsw-alias-bg-layer-1); }
.dsh-git-file-item { display: flex; align-items: center; justify-content: space-between; width: 100%; border: none; background: transparent; color: inherit; text-align: left; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 12.5px; margin-bottom: 2px; user-select: none; }
.dsh-git-file-item { gap: 10px; min-height: 34px; }
.dsh-git-file-item > div:first-child { min-width: 0; }
.dsh-git-file-item > div:first-child > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-git-file-item > div:last-child { flex-shrink: 0; }
.dsh-git-file-name { display: flex; align-items: center; gap: 6px; overflow: hidden; }
.dsh-git-file-stats { display: flex; align-items: center; gap: 4px; font-family: ${CODE_FONT}; font-size: 11px; font-variant-numeric: tabular-nums; }
.dsh-git-diff-header > div { min-width: 0; }
.dsh-git-file-item-active { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); color: var(--dsw-alias-brand-primary); font-weight: 500; }
.dsh-git-diff-view { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--dsw-alias-bg-base); }
.dsh-git-diff-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); font-size: 12.5px; font-family: ${CODE_FONT}; }
/* Path, stats and the editor action share one line: wrapping them made a tall header
   with the button floating mid-height. The path ellipsizes instead. */
.dsh-git-diff-file { display: flex; align-items: center; gap: 8px; flex: 1 1 auto; min-width: 0; white-space: nowrap; }
.dsh-git-diff-file > svg { flex-shrink: 0; }
.dsh-git-diff-path { font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-git-diff-stats { flex-shrink: 0; font-size: 11px; }
.dsh-git-diff-lines { flex: 1; overflow: auto; font-family: ${CODE_FONT}; font-size: 12px; line-height: 1.6; }
.dsh-git-diff-row { display: flex; min-width: max-content; }
.dsh-git-line-num { width: 44px; flex-shrink: 0; text-align: right; padding-right: 8px; color: var(--dsw-alias-label-secondary); user-select: none; font-size: 11px; border-right: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); }
.dsh-git-line-content { flex: 1; padding-left: 10px; white-space: pre; tab-size: 4; }
.dsh-git-row-add, .dsh-git-row-add .dsh-git-line-num { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent); }
.dsh-git-row-add .dsh-git-line-content { color: var(--dsw-alias-state-success-primary); }
.dsh-git-row-del, .dsh-git-row-del .dsh-git-line-num { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent); }
.dsh-git-row-del .dsh-git-line-content { color: var(--dsw-alias-state-error-primary); }
.dsh-git-hunk-header { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); padding: 3px 12px; font-size: 11px; font-style: italic; border-block: 1px solid var(--dsw-alias-border-l1); }
.dsh-git-modal-overlay { position: fixed; inset: 0; z-index: 10000; background: var(--dsw-alias-bg-overlay); display: flex; align-items: center; justify-content: center; }
.dsh-git-modal-card { width: 480px; max-width: 90vw; max-height: 90vh; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; box-shadow: 0 20px 25px var(--dsw-alias-bg-overlay); display: flex; flex-direction: column; overflow: auto; }
.dsh-git-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--dsw-alias-border-l1); font-weight: 600; font-size: 15px; }
.dsh-git-modal-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
.dsh-git-modal-footer { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 12px 18px; border-top: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); }
.dsh-git-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 32px; padding: 6px 12px; border-radius: 7px; font-size: 12px; font-weight: 500; font-family: inherit; line-height: 1.5; white-space: nowrap; cursor: pointer; border: 1px solid transparent; transition: background .12s, border-color .12s; }
.dsh-git-btn-secondary { background: var(--dsw-alias-bg-layer-1); border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
.dsh-git-btn-primary { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 15%, var(--dsw-alias-bg-layer-1)); color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
.dsh-git-btn-primary:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 25%, var(--dsw-alias-bg-layer-1)); }
.dsh-git-btn:disabled, .dsh-git-chip:disabled, .dsh-git-footer-btn:disabled, .dsh-git-branch-item:disabled { opacity: .55; cursor: not-allowed; }
.dsh-git-input { box-sizing: border-box; width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-size: 13px; }
.dsh-git-input:focus { border-color: var(--dsw-alias-brand-primary); }
.dsh-git-modal-card button:focus-visible, .dsh-git-chip:focus-visible, .dsh-git-popover button:focus-visible, .dsh-git-changes-panel button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.dsh-git-muted { color: var(--dsw-alias-label-secondary); }
.dsh-git-error { color: var(--dsw-alias-state-error-primary); background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent); overflow-wrap: anywhere; }
.dsh-git-icon-btn { border: none; background: transparent; color: var(--dsw-alias-label-primary); cursor: pointer; padding: 4px; }
.dsh-git-worktree-row, .dsh-git-commit-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); }
.dsh-git-worktree-copy { min-width: 0; overflow-wrap: anywhere; }
.dsh-git-worktree-copy > strong { font-size: 13px; }
.dsh-git-worktree-path { margin-top: 2px; font-family: ${CODE_FONT}; font-size: 12px; }
.dsh-git-commit-row { flex-wrap: wrap; font-size: 13px; }
.dsh-git-ref { font-size: 11px; padding: 1px 6px; border-radius: 4px; color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); }
.dsh-git-hero-controls { display: inline-flex; align-items: center; gap: 8px; }
.dsh-git-hero-controls { flex-wrap: nowrap; min-width: 0; }
.dsh-git-branch-control { display: inline-flex; align-items: center; position: relative; flex-shrink: 0; }
.dsh-git-loading { font-size: 12px; white-space: nowrap; }
.dsh-git-chip { gap: 7px; height: 30px; background: transparent; border-color: var(--dsw-alias-border-l1); }
.dsh-git-selector-btn svg, .dsh-git-chip svg, .dsh-git-footer-btn svg, .dsh-git-branch-item svg { flex-shrink: 0; }
.dsh-git-footer-btn { gap: 10px; min-height: 36px; padding: 8px 10px; font-size: 13px; }
.dsh-git-footer-btn svg { color: var(--dsw-alias-label-secondary); }
.dsh-git-sidebar-content { display: flex; flex-direction: column; height: 100%; min-height: 0; min-width: 0; overflow: hidden; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); container-type: inline-size; }
/* The full-page workbench opts only its owning conversation out of chat scrolling/composing. */
[data-conversation-content]:has(.dsh-git-workbench) { display: flex; flex-direction: column; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; }
[data-conversation-content]:has(.dsh-git-workbench) > [data-conversation-scroll] { display: flex; flex: 1 1 auto; flex-direction: column; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; }
[data-conversation-content]:has(.dsh-git-workbench) > [data-conversation-scroll] > [data-composer-seat]:not(:has(.dsh-git-workbench)) { display: none; }
[data-conversation-content]:has(.dsh-git-workbench) > [data-conversation-scroll] > :has(.dsh-git-workbench) { box-sizing: border-box; display: flex; flex: 1 1 auto; flex-direction: column; position: static; width: 100%; max-width: none; height: 100%; min-width: 0; min-height: 0; margin: 0; padding: 0; overflow: hidden; }
[data-conversation-content]:has(> [data-conversation-scroll] > [data-composer-seat] .dsh-git-workbench) > [data-conversation-scroll] > [data-composer-seat]:has(.dsh-git-workbench) { display: flex; flex: 1 1 auto; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; }
[data-conversation-content] > [data-conversation-scroll]:has(> [data-composer-seat] .dsh-git-workbench) > :not([data-composer-seat]) { display: none; }
.dsh-git-workbench { display: flex; flex: 1 1 auto; flex-direction: column; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); }
/* The chat column's width handle resizes the conversation, and its ::after is a 2px bar in a flat
   light gray that fades out at both ends. Over the workbench the column cannot usefully be resized
   (the panel fills it edge to edge), so the whole affordance is switched off while the panel is
   mounted: the drag never starts, the resize cursor is gone, and the gray bar stops painting. The
   host's class hash changes between builds, so match on the CSS-module name instead. */
:root:has(.dsh-git-workbench) [class*='_widthHandle'] { pointer-events: none !important; }
:root:has(.dsh-git-workbench) [class*='_widthHandle']::after { opacity: 0 !important; transition: none !important; }
.dsh-git-workbench-header { box-sizing: border-box; display: flex; flex: 0 0 48px; align-items: center; gap: 16px; width: 100%; height: 48px; min-width: 0; min-height: 48px; padding: 0 24px; overflow: hidden; border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); }
.dsh-git-workbench-header > :first-child { display: inline-flex; align-items: center; gap: 8px; flex: 0 0 auto; font-size: 14px; font-weight: 600; }
.dsh-git-workbench-header > :nth-child(2) { flex: 1 1 auto; min-width: 0; overflow: hidden; color: var(--dsw-alias-label-secondary); text-overflow: ellipsis; white-space: nowrap; }
.dsh-git-workbench-header :where(button) { flex-shrink: 0; font-family: inherit; }
.dsh-git-blank-nav { display: flex; align-items: center; gap: 6px; padding: 8px 24px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dsh-git-blank-nav [role=tab] { border: 0; border-radius: 6px; padding: 6px 12px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.dsh-git-blank-nav [aria-selected=true] { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-brand-primary); }
.dsh-git-workbench .dsh-git-sidebar-content { flex: 1 1 auto; width: 100%; height: auto; min-width: 0; min-height: 0; overflow: hidden; }
.dsh-git-workbench .dsh-git-view-content { display: block; flex: 1 1 0; width: 100%; min-width: 0; min-height: 0; overflow: auto; overscroll-behavior-y: contain; scrollbar-gutter: stable; }
.dsh-git-workbench .dsh-git-view-content > * { flex: none; height: auto; min-height: 100%; }
.dsh-git-workbench .dsh-git-changes-panel { height: auto; min-height: 100%; overflow: visible; }
.dsh-git-workbench .dsh-git-changes-body { flex: 0 0 auto; height: clamp(360px, calc(100dvh - 370px), 760px); min-height: 360px; }
.dsh-git-workbench .dsh-git-history-list { flex: none; overflow: visible; padding: 0 24px 24px; }
.dsh-git-workbench .dsh-git-panel-form { height: auto; min-height: 100%; }
.dsh-git-workbench .dsh-git-panel-form .dsh-git-modal-body { flex: none; overflow: visible; }
/* History/blame takes over the slot the file list and diff normally occupy, so it is on
   screen at once; that slot has a definite height, which keeps its own list scrolling. */
.dsh-git-changes-body > .dsh-git-panel-form { flex: 1 1 auto; min-width: 0; }
.dsh-git-workbench .dsh-git-changes-body > .dsh-git-panel-form { height: 100%; min-height: 0; overflow: hidden; }
.dsh-git-workbench .dsh-git-changes-body > .dsh-git-panel-form .dsh-git-modal-body { flex: 1; overflow: auto; }
.dsh-git-view-nav { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; padding: 8px 24px; border-bottom: 1px solid var(--dsw-alias-border-l1); flex-shrink: 0; background: var(--dsw-alias-bg-base); }
.dsh-git-view-pages { display: flex; align-items: center; gap: 4px; min-width: 0; overflow-x: auto; }
.dsh-git-view-actions { display: flex; align-items: center; gap: 2px; margin-left: auto; flex-shrink: 0; }
.dsh-git-view-tab, .dsh-git-view-action { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); font-size: 12.5px; font-family: inherit; cursor: pointer; white-space: nowrap; }
.dsh-git-view-tab:hover, .dsh-git-view-action:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dsh-git-view-tab svg, .dsh-git-view-action svg { flex-shrink: 0; }
.dsh-git-view-tab-active { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-border-l1); }
.dsh-git-view-action { padding: 0 8px; }
.dsh-git-view-action > span { white-space: nowrap; }
.dsh-git-view-action { border-color: var(--dsw-alias-border-l1); }
.dsh-git-view-tab-active { color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent); border-color: transparent; }
.dsh-git-view-nav button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.dsh-git-view-content { display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0; }
.dsh-git-view-content > * { flex: 1; min-height: 0; min-width: 0; }
.dsh-git-panel-form { display: flex; flex-direction: column; height: 100%; min-height: 0; width: 100%; }
/* Match list labels and status text instead of inheriting the browser's 16px default. */
.dsh-git-panel-form, .dsh-git-modal-card { font-size: 13px; line-height: 1.5; }
:where(.dsh-git-sidebar-content, .dsh-git-modal-card, .dsh-git-popover) :where(button, input, select, textarea) { font-family: inherit; }
.dsh-git-panel-form > form { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.dsh-git-panel-form .dsh-git-modal-header { padding: 12px 16px; font-size: 14px; flex-shrink: 0; }
.dsh-git-panel-form .dsh-git-modal-header > span { display: inline-flex; align-items: center; gap: 8px; }
.dsh-git-panel-form .dsh-git-modal-body { padding: 16px; min-height: 0; overflow: auto; flex: 1; }
.dsh-git-panel-form .dsh-git-modal-footer { padding: 12px 16px; flex-shrink: 0; }
.dsh-git-panel-form .dsh-git-commit-row { padding: 12px 0; border-width: 0 0 1px; border-radius: 0; background: transparent; gap: 6px 10px; }
.dsh-git-panel-form .dsh-git-commit-row > strong { font-size: 12px; font-weight: 500; }
.dsh-git-panel-message, .dsh-git-empty-state { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; padding: 32px 20px; color: var(--dsw-alias-label-secondary); text-align: center; }
.dsh-git-empty-state { flex: 1; min-height: 0; }
.dsh-git-empty-state strong { font-size: 16px; color: var(--dsw-alias-label-primary); }
.dsh-git-empty-state p { margin: 0; font-size: 13px; line-height: 1.6; }
.dsh-git-history-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.dsh-git-panel-heading { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; }
.dsh-git-history-list { display: flex; flex-direction: column; min-height: 0; overflow: auto; flex: 1; padding: 0 16px; }
/* Heading row inside the column header: without it the action button stretches
   into a full-width empty bar. */
.dsh-git-head-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; flex-shrink: 0; }
.dsh-git-history-item { padding: 16px 0; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dsh-git-history-subject { font-size: 13px; font-weight: 500; line-height: 1.6; overflow-wrap: anywhere; }
.dsh-git-history-refs { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.dsh-git-history-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 8px; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dsh-git-history-meta code { color: var(--dsw-alias-brand-primary); }
.dsh-git-history-meta time { margin-left: auto; }
/* ---------- staging, commit box, operation banner ---------- */
.dsh-git-op-banner { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); border-left: 3px solid var(--dsw-alias-state-warn-primary); background: var(--dsw-alias-bg-layer-1); font-size: 12px; flex-shrink: 0; }
.dsh-git-op-banner-error { border-left-color: var(--dsw-alias-state-error-primary); }
.dsh-git-op-banner svg { color: var(--dsw-alias-state-warn-primary); }
.dsh-git-op-banner-error svg { color: var(--dsw-alias-state-error-primary); }
.dsh-git-op-title { font-weight: 500; }
.dsh-git-op-detail { color: var(--dsw-alias-label-secondary); }
.dsh-git-op-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.dsh-git-commit-box { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); flex-shrink: 0; }
.dsh-git-commit-textarea { box-sizing: border-box; width: 100%; min-height: 54px; max-height: 180px; resize: vertical; padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-family: ${UI_FONT}; font-size: 12.5px; line-height: 1.55; }
.dsh-git-commit-textarea:focus { outline: none; border-color: var(--dsw-alias-brand-primary); }
.dsh-git-commit-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.dsh-git-commit-hint { color: var(--dsw-alias-label-secondary); font-size: 11px; }
/* The agent actions read the same repository state as the commit form, so they sit with it
   and stay visually secondary: they hand work to the session, they do not change the repo. */
.dsh-git-ai-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.dsh-git-ai-btn { display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border: 1px dashed var(--dsw-alias-border-l2); border-radius: 7px; background: transparent; color: var(--dsw-alias-label-secondary); font-family: ${UI_FONT}; font-size: 11.5px; cursor: pointer; }
.dsh-git-ai-btn:hover:not(:disabled) { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.dsh-git-ai-btn:disabled { opacity: .5; cursor: default; }
.dsh-git-spacer { margin-left: auto; }
.dsh-git-checkbox { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--dsw-alias-label-secondary); cursor: pointer; user-select: none; }
.dsh-git-checkbox input { accent-color: var(--dsw-alias-brand-primary); margin: 0; }

/* ---------- grouped change list ---------- */
.dsh-git-change-group { margin-bottom: 6px; }
.dsh-git-change-group-head { display: flex; align-items: center; gap: 6px; padding: 5px 8px 4px; color: var(--dsw-alias-label-secondary); font-size: 10.5px; font-weight: 600; letter-spacing: .04em; }
.dsh-git-change-group-head > span:last-child { padding: 0 5px; border-radius: 5px; background: var(--dsw-alias-bg-layer-2); font-variant-numeric: tabular-nums; }
.dsh-git-change-row { display: flex; align-items: center; gap: 6px; padding: 4px 6px 4px 8px; border-radius: 6px; min-height: 28px; font-size: 12.5px; }
.dsh-git-change-row:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-git-change-open { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; border: none; background: transparent; color: inherit; font: inherit; text-align: left; padding: 0; cursor: pointer; }
.dsh-git-change-open > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-git-change-badge { flex-shrink: 0; width: 14px; text-align: center; font-family: ${CODE_FONT}; font-size: 11px; font-weight: 700; }
.dsh-git-change-badge-added { color: var(--dsw-alias-state-success-primary); }
.dsh-git-change-badge-deleted { color: var(--dsw-alias-state-error-primary); }
.dsh-git-change-badge-modified { color: var(--dsw-alias-state-warn-primary); }
.dsh-git-change-badge-conflict { color: var(--dsw-alias-state-error-primary); }
.dsh-git-change-badge-renamed { color: var(--dsw-alias-brand-primary); }
.dsh-git-change-stats { flex-shrink: 0; display: flex; gap: 4px; font-family: ${CODE_FONT}; font-size: 10.5px; font-variant-numeric: tabular-nums; }
.dsh-git-change-actions { flex-shrink: 0; display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity .12s; }
.dsh-git-change-row:hover .dsh-git-change-actions, .dsh-git-change-row:focus-within .dsh-git-change-actions { opacity: 1; }
.dsh-git-change-actions .dsh-git-icon-btn:hover { background: var(--dsw-alias-bg-layer-1); }
.dsh-git-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 5px; color: var(--dsw-alias-label-secondary); }
.dsh-git-icon-btn:hover:not(:disabled) { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
.dsh-git-icon-btn:disabled { opacity: .4; cursor: default; }
.dsh-git-icon-btn-danger:hover:not(:disabled) { color: var(--dsw-alias-state-error-primary); }
.dsh-git-icon-btn-active { color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-bg-layer-2); }

/* ---------- diff toolbar / hunk actions ---------- */
.dsh-git-diff-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 6px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); flex-shrink: 0; }
.dsh-git-tool-group { display: inline-flex; align-items: center; gap: 2px; padding: 2px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px; background: var(--dsw-alias-bg-base); }
.dsh-git-tool-group > button { min-width: 24px; height: 22px; padding: 0 6px; border: none; border-radius: 5px; background: transparent; color: var(--dsw-alias-label-secondary); font-size: 11px; font-family: inherit; cursor: pointer; }
.dsh-git-tool-group > button:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dsh-git-tool-group > button[aria-pressed="true"], .dsh-git-tool-group > button.dsh-git-icon-btn-active { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-brand-primary); }
.dsh-git-tool-group > button:disabled { opacity: .4; cursor: default; }
.dsh-git-hunk-header { display: flex; align-items: center; gap: 8px; }
.dsh-git-hunk-actions { display: flex; align-items: center; gap: 2px; margin-left: auto; opacity: .55; }
.dsh-git-hunk-header:hover .dsh-git-hunk-actions { opacity: 1; }
.dsh-git-hunk-btn { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 18px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 4px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-secondary); cursor: pointer; padding: 0; }
.dsh-git-hunk-btn:hover:not(:disabled) { color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
.dsh-git-hunk-btn:disabled { opacity: .4; cursor: default; }
.dsh-git-word-add { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 32%, transparent); border-radius: 2px; }
.dsh-git-word-del { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 32%, transparent); border-radius: 2px; }
.dsh-git-diff-split { display: flex; flex: 1; min-height: 0; min-width: 0; overflow: hidden; }
.dsh-git-diff-pane { flex: 1 1 50%; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.dsh-git-diff-pane + .dsh-git-diff-pane { border-left: 1px solid var(--dsw-alias-border-l1); }
.dsh-git-diff-pane-head { display: flex; gap: 8px; padding: 3px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font-size: 10.5px; }
.dsh-git-diff-stream { flex: 1; overflow: auto; font-family: ${CODE_FONT}; font-size: 12px; line-height: 1.6; }
.dsh-git-binary-note, .dsh-git-diff-image { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 28px 20px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dsh-git-diff-image img { max-width: 100%; max-height: 60vh; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); }
.dsh-git-image-box { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 10.5px; }
.dsh-git-image-box code { overflow-wrap: anywhere; text-align: center; }

/* ---------- conflicts ---------- */
.dsh-git-conflict-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 6px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); font-size: 12px; }
.dsh-git-conflict-lines { flex: 1; overflow: auto; font-family: ${CODE_FONT}; font-size: 12px; line-height: 1.6; }
.dsh-git-conflict-row { display: flex; gap: 8px; padding: 0 10px; white-space: pre; min-width: max-content; }
.dsh-git-conflict-ours { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent); }
.dsh-git-conflict-theirs { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, transparent); }
.dsh-git-conflict-base { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); }
.dsh-git-conflict-marker { color: var(--dsw-alias-label-secondary); font-style: italic; }

/* ---------- history graph / details ---------- */
/* The graph canvas is one absolutely positioned overlay per list (see
   .dsh-git-graph-backdrop), so rows only carry text and their own dot. */
.dsh-git-graph-view { position: relative; }
.dsh-git-graph-backdrop { position: absolute; top: 0; left: 0; z-index: 2; pointer-events: none; }
.dsh-git-graph-row { position: relative; padding: 6px 0 6px var(--dsh-git-graph-gutter, 28px); border-bottom: 1px solid var(--dsw-alias-border-l1); cursor: pointer; }
.dsh-git-graph-row:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-git-graph-row-active { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent); }
/* The commit rows reuse the shared list item class, whose rhythm and border would
   double up with the row's own padding and separator. */
.dsh-git-graph-row > .dsh-git-history-item { padding: 0; border-bottom: 0; }
.dsh-git-graph-node { position: absolute; top: 50%; z-index: 3; width: 8px; height: 8px; margin-top: -4px; border-radius: 50%; background: currentColor; }
.dsh-git-graph-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: 2px 0; }
.dsh-git-graph-subject { font-size: 12.5px; font-weight: 500; overflow-wrap: anywhere; }
.dsh-git-graph-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; color: var(--dsw-alias-label-secondary); font-size: 10.5px; }
.dsh-git-graph-meta code { color: var(--dsw-alias-brand-primary); }
.dsh-git-lane-0 { color: var(--dsw-alias-brand-primary); }
.dsh-git-lane-1 { color: var(--dsw-alias-state-success-primary); }
.dsh-git-lane-2 { color: var(--dsw-alias-state-warn-primary); }
.dsh-git-lane-3 { color: var(--dsw-alias-state-error-primary); }
/* Lanes 4-7 have no dedicated theme token, so they are blended from the ones that
   exist: still eight visually distinct lanes, still theme-driven in both modes. */
.dsh-git-lane-4 { color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, var(--dsw-alias-state-success-primary)); }
.dsh-git-lane-5 { color: color-mix(in srgb, var(--dsw-alias-brand-primary) 60%, var(--dsw-alias-state-warn-primary)); }
.dsh-git-lane-6 { color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 55%, var(--dsw-alias-state-error-primary)); }
.dsh-git-lane-7 { color: color-mix(in srgb, var(--dsw-alias-label-secondary) 60%, var(--dsw-alias-brand-primary)); }
.dsh-git-detail-message { margin: 0; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); font-size: 12.5px; white-space: pre-wrap; overflow-wrap: anywhere; }
.dsh-git-detail-meta { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.dsh-git-detail-meta > span:nth-child(odd) { color: var(--dsw-alias-label-secondary); }
.dsh-git-detail-meta > span:nth-child(even) { color: var(--dsw-alias-label-primary); overflow-wrap: anywhere; }
.dsh-git-detail-file { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; border: none; border-bottom: 1px solid var(--dsw-alias-border-l1); background: transparent; color: inherit; font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.dsh-git-detail-file:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-git-detail-file > code { flex: 1; min-width: 0; overflow-wrap: anywhere; }

/* ---------- stash / reflog / blame ---------- */
.dsh-git-stash-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px; background: var(--dsw-alias-bg-layer-2); }
.dsh-git-stash-row + .dsh-git-stash-row { margin-top: 6px; }
.dsh-git-stash-copy { flex: 1; min-width: 0; }
.dsh-git-stash-subject { font-size: 12.5px; overflow-wrap: anywhere; }
.dsh-git-stash-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 3px; color: var(--dsw-alias-label-secondary); font-size: 10.5px; }
.dsh-git-stash-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.dsh-git-reflog-row { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border: none; border-bottom: 1px solid var(--dsw-alias-border-l1); background: transparent; color: inherit; font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.dsh-git-reflog-row:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-git-reflog-row code { flex-shrink: 0; color: var(--dsw-alias-brand-primary); }
.dsh-git-reflog-row > span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.dsh-git-blame-row { display: flex; gap: 8px; padding: 0 10px; font-family: ${CODE_FONT}; font-size: 12px; line-height: 1.65; white-space: pre; min-width: max-content; }
.dsh-git-blame-meta { flex-shrink: 0; width: 210px; display: flex; gap: 6px; color: var(--dsw-alias-label-secondary); overflow: hidden; }
.dsh-git-blame-meta code { color: var(--dsw-alias-brand-primary); }
.dsh-git-blame-num { flex-shrink: 0; width: 42px; text-align: right; color: var(--dsw-alias-label-secondary); }
.dsh-git-same-commit { color: var(--dsw-alias-label-secondary); }

/* ---------- full-page management surfaces ---------- */
.dsh-git-page { display: flex; flex-direction: column; min-height: 100%; background: var(--dsw-alias-bg-base); font-size: 13px; }
.dsh-git-page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px 24px; padding: 24px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dsh-git-page-title { min-width: 0; }
.dsh-git-page-title h2, .dsh-git-page-title .dsh-git-panel-heading { margin: 0; font-size: 18px; font-weight: 600; line-height: 1.4; color: var(--dsw-alias-label-primary); }
.dsh-git-page-title p { margin: 6px 0 0; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
.dsh-git-page-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; flex-shrink: 0; }
.dsh-git-page-body { flex: 1; width: 100%; max-width: 1280px; margin: 0 auto; padding: 24px; }
.dsh-git-page-body > .dsh-git-section { padding: 0; margin: 0 0 24px; gap: 14px; }
.dsh-git-page-body > form.dsh-git-section { padding: 20px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); }
.dsh-git-page .dsh-git-section-head { font-size: 12px; font-weight: 600; letter-spacing: 0; }
.dsh-git-page .dsh-git-scroll-list { flex: none; overflow: visible; }
.dsh-git-page .dsh-git-empty-state { min-height: 280px; padding: 40px 24px; border: 1px dashed var(--dsw-alias-border-l2); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); }
.dsh-git-page .dsh-git-empty-state p { max-width: 420px; }
.dsh-git-page .dsh-git-worktree-row { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; padding: 20px; border-radius: 12px; background: var(--dsw-alias-bg-base); }
.dsh-git-page .dsh-git-worktree-copy { flex: 1 1 280px; min-width: 0; }
.dsh-git-page .dsh-git-scroll-list > .dsh-git-section { padding: 0; margin-bottom: 12px; }
.dsh-git-page .dsh-git-badge-warn { display: inline-flex; padding: 2px 8px; border-radius: 6px; font-size: 11px; }
.dsh-git-page .dsh-git-worktree-path { margin: 6px 0 10px; font-size: 12px; }
.dsh-git-page .dsh-git-worktree-copy > strong { font-size: 15px; }
.dsh-git-page .dsh-git-stash-actions { flex-wrap: wrap; gap: 6px; }
.dsh-git-page .dsh-git-stash-row { flex-wrap: wrap; gap: 16px; padding: 18px 20px; border-radius: 12px; background: var(--dsw-alias-bg-base); }
.dsh-git-page .dsh-git-stash-subject { font-size: 14px; font-weight: 600; }
.dsh-git-page .dsh-git-stash-meta { margin-top: 6px; font-size: 11px; }
.dsh-git-page .dsh-git-panel-toolbar { padding: 12px 0 0; background: transparent; border: 0; }
.dsh-git-page .dsh-git-panel-toolbar:has(input) { flex-wrap: wrap; }
.dsh-git-page .dsh-git-panel-toolbar input { flex: 1 1 240px; }
.dsh-git-page .dsh-git-badge { font-size: 11px; padding: 2px 8px; }
.dsh-git-page .dsh-git-error, .dsh-git-page .dsh-git-changes-notice { margin: 0 0 16px; padding: 10px 12px; border-radius: 8px; }
.dsh-git-page label { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.dsh-git-page input[type=checkbox] { margin: 0; accent-color: var(--dsw-alias-brand-primary); }
.dsh-git-history-list > .dsh-git-section { flex-shrink: 0; }
.dsh-git-history-list button[aria-label="\u8FD4\u56DE\u63D0\u4EA4\u8BB0\u5F55"] { position: sticky; top: 8px; z-index: 5; align-self: flex-start; box-shadow: 0 2px 8px var(--dsw-alias-bg-overlay); }
.dsh-git-history-list .dsh-git-detail-meta { padding: 12px 0; gap: 8px 16px; }
.dsh-git-history-list .dsh-git-detail-message { padding: 20px; border-radius: 10px; }

/* ---------- misc rows ---------- */
.dsh-git-inline-form { display: flex; align-items: center; gap: 8px; }
.dsh-git-inline-form .dsh-git-input { flex: 1; min-width: 0; }
.dsh-git-section { display: flex; flex-direction: column; gap: 6px; padding: 10px 0; }
.dsh-git-section-head { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600; color: var(--dsw-alias-label-secondary); letter-spacing: .04em; }
.dsh-git-code-box { margin: 0; padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px; background: var(--dsw-alias-bg-layer-2); font-family: ${CODE_FONT}; font-size: 11.5px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 220px; overflow: auto; }
.dsh-git-badge { display: inline-flex; align-items: center; gap: 4px; padding: 1px 7px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 10.5px; font-variant-numeric: tabular-nums; }
.dsh-git-badge-warn { color: var(--dsw-alias-state-warn-primary); background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent); }
.dsh-git-badge-error { color: var(--dsw-alias-state-error-primary); background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 14%, transparent); }
.dsh-git-badge-brand { color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent); }
.dsh-git-ahead, .dsh-git-behind { display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px 1px 5px; border-radius: 999px; font-size: 11px; font-variant-numeric: tabular-nums; }
.dsh-git-ahead { color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent); }
.dsh-git-behind { color: var(--dsw-alias-state-warn-primary); background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent); }
/* The popover's divergence row: one pill per diverged side, never a zero side, and the row carries
   the popover's own gutter instead of hugging the card edge. */
.dsh-git-diverged { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 2px 14px 8px; }
.dsh-git-diverged .dsh-git-ahead, .dsh-git-diverged .dsh-git-behind { padding: 2px 8px 2px 6px; font-size: 11.5px; }
.dsh-git-popover-section { padding: 4px 10px 8px; }
.dsh-git-popover-actions { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-top: 1px solid var(--dsw-alias-border-l1); }
.dsh-git-popover-actions .dsh-git-btn { flex: 1; justify-content: center; }
.dsh-git-popover-notice { margin: 6px 10px 0; padding: 7px 10px; border-radius: 6px; font-size: 12px; overflow-wrap: anywhere; color: var(--dsw-alias-state-success-primary); background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent); }
.dsh-git-popover-error { margin: 4px 10px 0; padding: 7px 10px; border-radius: 6px; font-size: 12px; }
.dsh-git-tab-strip { display: flex; align-items: center; gap: 2px; padding: 2px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); }
.dsh-git-tab { flex: 1; padding: 5px 8px; border: none; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); font-family: inherit; font-size: 12px; cursor: pointer; }
.dsh-git-tab-active { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); }
.dsh-git-scroll-list { flex: 1; min-height: 0; overflow: auto; }
.dsh-git-panel-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); flex-shrink: 0; }
.dsh-git-dirty-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-warn-primary); flex-shrink: 0; }

/* ---------- changes workspace: compact command bar, review panes, commit composer ---------- */
.dsh-git-workbench .dsh-git-changes-panel > .dsh-git-changes-header { flex-direction: row; align-items: center; flex-wrap: wrap; gap: 12px 24px; padding: 14px 24px; background: var(--dsw-alias-bg-base); }
.dsh-git-workbench .dsh-git-changes-panel > .dsh-git-changes-header .dsh-git-repo-row { flex: 1 1 260px; }
.dsh-git-workbench .dsh-git-compare-control { flex: 0 1 260px; width: 260px; }
.dsh-git-file-menu { position: relative; }
.dsh-git-file-menu > summary { display: inline-flex; align-items: center; gap: 6px; list-style: none; user-select: none; }
.dsh-git-file-menu > summary::-webkit-details-marker { display: none; }
.dsh-git-file-menu[open] > summary { border-color: var(--dsw-alias-brand-primary); }
.dsh-git-file-menu-items { position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; width: 210px; display: flex; flex-direction: column; gap: 2px; padding: 6px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); box-shadow: 0 8px 24px var(--dsw-alias-bg-overlay); }
.dsh-git-file-menu-items > .dsh-git-btn { width: 100%; justify-content: flex-start; border: 0; background: transparent; padding: 8px 10px; font-size: 12px; }
.dsh-git-file-menu-items > .dsh-git-btn:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-git-commit-editor { display: flex; flex: 1 1 50%; flex-direction: column; gap: 10px; min-width: 0; }
.dsh-git-commit-controls { display: flex; flex: 1 1 40%; flex-direction: column; justify-content: center; gap: 12px; min-width: 0; }
.dsh-git-workbench .dsh-git-changes-panel > .dsh-git-commit-box { display: flex; flex-direction: row; align-items: stretch; gap: 24px; padding: 20px 24px; background: var(--dsw-alias-bg-layer-1); }
.dsh-git-workbench .dsh-git-diff-view { min-height: 0; }
.dsh-git-workbench .dsh-git-diff-lines { min-height: 0; scrollbar-gutter: stable; }
.dsh-git-workbench .dsh-git-row-add .dsh-git-line-content, .dsh-git-workbench .dsh-git-row-del .dsh-git-line-content { color: var(--dsw-alias-label-primary); }
.dsh-git-workbench .dsh-git-row-add .dsh-git-line-sign { color: var(--dsw-alias-state-success-primary); }
.dsh-git-workbench .dsh-git-row-del .dsh-git-line-sign { color: var(--dsw-alias-state-error-primary); }
.dsh-git-workbench .dsh-git-hunk-header { font-style: normal; min-height: 30px; }
.dsh-git-workbench .dsh-git-file-item { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; justify-content: initial; gap: 8px; padding: 8px 10px; }
.dsh-git-workbench .dsh-git-file-name { min-width: 0; }
.dsh-git-file-copy { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.dsh-git-file-copy > span, .dsh-git-file-copy > small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-git-file-copy > small { font-size: 10.5px; font-weight: 400; color: var(--dsw-alias-label-secondary); }
.dsh-git-workbench .dsh-git-file-row { position: relative; }
.dsh-git-workbench .dsh-git-file-actions { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); padding: 3px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; background: var(--dsw-alias-bg-layer-1); pointer-events: none; }
.dsh-git-workbench .dsh-git-file-row:hover .dsh-git-file-actions, .dsh-git-workbench .dsh-git-file-row:focus-within .dsh-git-file-actions { pointer-events: auto; }

.dsh-git-changes-panel > .dsh-git-commit-box { flex-shrink: 0; border-top: 1px solid var(--dsw-alias-border-l1); border-bottom: 0; }
.dsh-git-changes-side { display: flex; flex: 0 0 auto; flex-direction: column; width: clamp(260px, 24vw, 360px); max-width: 40%; min-height: 0; border-right: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); overflow: hidden; }
.dsh-git-changes-side .dsh-git-file-list { width: 100%; max-width: none; flex: 1 1 auto; min-height: 0; border-right: none; background: transparent; }
.dsh-git-operation-banner { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); border-left: 3px solid var(--dsw-alias-state-warn-primary); background: var(--dsw-alias-bg-layer-1); font-size: 12px; flex-shrink: 0; }
.dsh-git-operation-icon { display: inline-flex; color: var(--dsw-alias-state-warn-primary); }
.dsh-git-operation-copy { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.dsh-git-operation-copy > span { color: var(--dsw-alias-label-secondary); }
.dsh-git-operation-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.dsh-git-commit-head { display: flex; align-items: center; gap: 8px; }
.dsh-git-commit-title { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; }
.dsh-git-commit-count { margin-left: auto; color: var(--dsw-alias-label-secondary); font-size: 10.5px; font-variant-numeric: tabular-nums; }
.dsh-git-commit-input { box-sizing: border-box; width: 100%; min-height: 58px; max-height: 200px; resize: vertical; padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-family: ${UI_FONT}; font-size: 12.5px; line-height: 1.55; }
.dsh-git-commit-input:focus { outline: none; border-color: var(--dsw-alias-brand-primary); }
.dsh-git-commit-options { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.dsh-git-btn-danger { color: var(--dsw-alias-state-error-primary); }
.dsh-git-btn-danger:hover:not(:disabled) { border-color: var(--dsw-alias-state-error-primary); }
.dsh-git-action-notice { color: var(--dsw-alias-label-secondary); }
.dsh-git-busy-notice { color: var(--dsw-alias-label-secondary); font-style: italic; }
.dsh-git-ahead-behind, .dsh-git-stash-badge { display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px 1px 5px; border-radius: 999px; font-size: 10.5px; font-variant-numeric: tabular-nums; }
.dsh-git-ahead-behind { color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent); }
/* The repo row marks both directions with the shared pill; the behind side keeps the warn tone. */
.dsh-git-ahead-behind.dsh-git-behind { color: var(--dsw-alias-state-warn-primary); background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent); font-size: 10.5px; }
.dsh-git-stash-badge { color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); }
.dsh-git-scope-group { display: inline-flex; align-items: center; gap: 2px; padding: 2px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px; background: var(--dsw-alias-bg-base); }
.dsh-git-scope-option { height: 22px; padding: 0 8px; border: none; border-radius: 5px; background: transparent; color: var(--dsw-alias-label-secondary); font-family: inherit; font-size: 11px; cursor: pointer; }
.dsh-git-scope-option:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dsh-git-scope-option-active { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-brand-primary); font-weight: 500; }
.dsh-git-scope-option:disabled { opacity: .4; cursor: default; }
.dsh-git-tool-btn { display: inline-flex; align-items: center; gap: 4px; min-width: 24px; height: 22px; padding: 0 6px; border: none; border-radius: 5px; background: transparent; color: var(--dsw-alias-label-secondary); font-family: inherit; font-size: 11px; cursor: pointer; }
.dsh-git-tool-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dsh-git-tool-btn-active { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-brand-primary); }
.dsh-git-tool-btn:disabled { opacity: .4; cursor: default; }
.dsh-git-tool-glyph { font-family: ${CODE_FONT}; font-size: 11px; font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
.dsh-git-hunk-position { min-width: 34px; text-align: center; color: var(--dsw-alias-label-secondary); font-size: 10.5px; font-variant-numeric: tabular-nums; }
.dsh-git-file-list-count { display: inline-flex; align-items: center; gap: 8px; }
.dsh-git-link-btn { padding: 0; border: none; background: transparent; color: var(--dsw-alias-brand-primary); font-family: inherit; font-size: 10.5px; cursor: pointer; }
.dsh-git-link-btn:hover:not(:disabled) { text-decoration: underline; }
.dsh-git-link-btn:disabled { opacity: .45; cursor: default; }
.dsh-git-file-filter { display: flex; align-items: center; gap: 6px; margin: 4px 8px 6px; padding: 3px 7px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-secondary); }
.dsh-git-file-filter-input { flex: 1; min-width: 0; border: none; background: transparent; color: var(--dsw-alias-label-primary); font-family: inherit; font-size: 11.5px; }
.dsh-git-file-filter-input:focus { outline: none; }
.dsh-git-file-list-empty { padding: 10px; color: var(--dsw-alias-label-secondary); font-size: 11.5px; }
.dsh-git-file-section { margin-bottom: 4px; }
.dsh-git-file-section-heading { display: flex; align-items: center; gap: 6px; padding: 5px 8px 3px; color: var(--dsw-alias-label-secondary); font-size: 10.5px; font-weight: 600; letter-spacing: .04em; }
.dsh-git-file-section-heading > span:last-child { margin-left: auto; padding: 0 5px; border-radius: 5px; background: var(--dsw-alias-bg-layer-2); font-variant-numeric: tabular-nums; }
.dsh-git-section-conflict { color: var(--dsw-alias-state-error-primary); }
.dsh-git-file-row { display: flex; align-items: center; gap: 2px; border-radius: 6px; }
.dsh-git-file-row:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-git-file-row .dsh-git-file-item { flex: 1; min-width: 0; margin-bottom: 0; }
.dsh-git-file-row-active { background: var(--dsw-alias-bg-layer-2); }
.dsh-git-file-status { flex-shrink: 0; width: 13px; text-align: center; font-family: ${CODE_FONT}; font-size: 11px; font-weight: 700; }
.dsh-git-tone-added { color: var(--dsw-alias-state-success-primary); }
.dsh-git-tone-deleted { color: var(--dsw-alias-state-error-primary); }
.dsh-git-tone-modified { color: var(--dsw-alias-state-warn-primary); }
.dsh-git-tone-renamed { color: var(--dsw-alias-brand-primary); }
.dsh-git-tone-conflict { color: var(--dsw-alias-state-error-primary); }
.dsh-git-file-actions { display: flex; align-items: center; gap: 1px; flex-shrink: 0; opacity: 0; transition: opacity .12s; }
.dsh-git-file-row:hover .dsh-git-file-actions, .dsh-git-file-row:focus-within .dsh-git-file-actions { opacity: 1; }
.dsh-git-file-actions .dsh-git-icon-btn { width: 20px; height: 20px; }
.dsh-git-file-actions .dsh-git-icon-btn:hover { background: var(--dsw-alias-bg-layer-1); }
.dsh-git-icon-btn-wide { width: auto; padding: 0 5px; font-family: inherit; font-size: 10.5px; }
.dsh-git-binary-mark { color: var(--dsw-alias-label-secondary); font-size: 10px; }
.dsh-git-conflict-view { margin: 2px 0 6px; padding: 6px 8px; border: 1px solid var(--dsw-alias-border-l1); border-left: 3px solid var(--dsw-alias-state-error-primary); border-radius: 6px; background: var(--dsw-alias-bg-base); max-height: 220px; overflow: auto; font-family: ${CODE_FONT}; font-size: 11.5px; line-height: 1.55; }
.dsh-git-conflict-line { white-space: pre-wrap; overflow-wrap: anywhere; }
.dsh-git-conflict-line.dsh-git-conflict-ours { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent); }
.dsh-git-conflict-line.dsh-git-conflict-theirs { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, transparent); }
.dsh-git-conflict-line.dsh-git-conflict-base { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); }
.dsh-git-conflict-line.dsh-git-conflict-marker { color: var(--dsw-alias-label-secondary); font-style: italic; }
.dsh-git-diff-placeholder, .dsh-git-diff-note { padding: 24px 20px; color: var(--dsw-alias-label-secondary); font-size: 12px; text-align: center; }
.dsh-git-hunk { border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dsh-git-hunk-current { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 5%, transparent); }
.dsh-git-hunk-title { flex: 1; min-width: 0; font-family: ${CODE_FONT}; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-git-hunk-action { display: inline-flex; align-items: center; gap: 3px; height: 18px; padding: 0 6px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 4px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-secondary); font-family: inherit; font-size: 10.5px; cursor: pointer; }
.dsh-git-hunk-action:hover:not(:disabled) { color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
.dsh-git-hunk-action:disabled { opacity: .4; cursor: default; }
.dsh-git-line-sign { flex-shrink: 0; width: 12px; color: var(--dsw-alias-label-secondary); }
.dsh-git-line-content { display: flex; }
.dsh-git-split { display: flex; flex-direction: column; }
.dsh-git-split-row { display: flex; align-items: stretch; }
.dsh-git-split-cell { flex: 1 1 50%; display: flex; gap: 6px; min-width: 0; padding-right: 8px; }
.dsh-git-split-cell + .dsh-git-split-cell { border-left: 1px solid var(--dsw-alias-border-l1); padding-left: 8px; }
.dsh-git-split-cell.dsh-git-split-add { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 16%, transparent); }
.dsh-git-split-cell.dsh-git-split-del { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 16%, transparent); }
.dsh-git-split-cell.dsh-git-split-blank { background: var(--dsw-alias-bg-layer-2); }
.dsh-git-split-text { min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.dsh-git-image-preview-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 24px 20px; }
.dsh-git-image-preview { max-width: 100%; max-height: 60vh; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); }
.dsh-git-image-caption { color: var(--dsw-alias-label-secondary); font-size: 10.5px; overflow-wrap: anywhere; text-align: center; }
.dsh-git-image-hint { display: inline-flex; align-items: center; gap: 4px; color: var(--dsw-alias-label-secondary); font-size: 10.5px; }

@container (max-width: 600px) {
  .dsh-git-changes-body { flex-direction: column; }
  .dsh-git-changes-side { width: auto; max-width: none; max-height: 42%; border-right: none; border-bottom: 1px solid var(--dsw-alias-border-l1); }
  .dsh-git-file-list { width: auto; max-width: none; max-height: 30%; border-right: none; border-bottom: 1px solid var(--dsw-alias-border-l1); }
  .dsh-git-changes-side .dsh-git-file-list { flex: 1 1 auto; max-height: none; border-bottom: 0; }
  .dsh-git-diff-view { min-height: 0; }
  .dsh-git-changes-header { padding: 10px 12px; }
  /* A narrow sidebar keeps the affordance and drops the label. */
  .dsh-git-open-editor > span { display: none; }
  .dsh-git-open-editor { padding: 4px 6px; }
  .dsh-git-workbench .dsh-git-changes-body { height: auto; min-height: 0; }
  .dsh-git-workbench .dsh-git-changes-side { flex: none; height: 240px; max-height: none; }
  .dsh-git-workbench .dsh-git-diff-view { flex: none; height: 440px; min-height: 440px; }
  .dsh-git-workbench .dsh-git-changes-panel > .dsh-git-commit-box { flex-direction: column; gap: 16px; padding: 16px; }
  .dsh-git-workbench .dsh-git-compare-control { flex: 1 1 100%; width: auto; }
  .dsh-git-workbench .dsh-git-changes-panel > .dsh-git-changes-header { padding: 12px 16px; }
  .dsh-git-workbench-header, .dsh-git-view-nav { padding-left: 16px; padding-right: 16px; }
  .dsh-git-workbench-header > :first-child strong { font-size: 12px; }
  .dsh-git-workbench-header > :nth-child(2) { font-size: 11px; }
  .dsh-git-view-actions { margin-left: 0; }
  .dsh-git-page-header, .dsh-git-page-body { padding: 16px; }
  .dsh-git-page-actions { width: 100%; }
  .dsh-git-page .dsh-git-stash-actions { width: 100%; }
}
`;
function disposeStyles() {
  if (typeof document !== "undefined") document.getElementById("dsh-plugin-git-styles")?.remove();
}
function injectStyles() {
  if (typeof document === "undefined") return;
  const id = "dsh-plugin-git-styles";
  const sheet = sheetText();
  const existing = document.getElementById(id);
  if (existing) {
    if (existing.textContent !== sheet) existing.textContent = sheet;
    return;
  }
  const styleEl = document.createElement("style");
  styleEl.id = id;
  styleEl.textContent = sheet;
  document.head.appendChild(styleEl);
}

// src/client/diagnostics.ts
var CLIENT_BUILD = "overlay-census-1";
function computedFont(element) {
  if (!element || typeof getComputedStyle !== "function") return "";
  return getComputedStyle(element).fontFamily || "";
}
function collectClientReport(build = CLIENT_BUILD) {
  const report = {
    build,
    stylesElement: false,
    stylesLength: 0,
    stylesHasFontToken: false,
    probeUiFont: "",
    probeCodeFont: "",
    bodyFont: "",
    rootFontFamily: "",
    appFontToken: "",
    codeFontToken: "",
    uiFont: "",
    location: "",
    reportedAt: ""
  };
  if (typeof document === "undefined") return report;
  try {
    const styleEl = document.getElementById("dsh-plugin-git-styles");
    const text2 = styleEl?.textContent ?? "";
    report.stylesElement = Boolean(styleEl);
    report.stylesLength = text2.length;
    report.stylesHasFontToken = text2.includes("dsw-font-family");
    const probe = document.createElement("div");
    probe.className = "dsh-git-panel-form";
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:fixed;left:-10000px;top:0;width:200px;height:20px";
    const ui = document.createElement("span");
    ui.textContent = "Font";
    const code = document.createElement("code");
    code.textContent = "master (currently checked out)";
    probe.append(ui, code);
    document.body.appendChild(probe);
    report.probeUiFont = computedFont(ui);
    report.probeCodeFont = computedFont(code);
    probe.remove();
    report.bodyFont = computedFont(document.body);
    const root = document.documentElement;
    report.rootFontFamily = computedFont(root);
    report.appFontToken = getComputedStyle(root).getPropertyValue("--dsw-font-family").trim();
    report.codeFontToken = getComputedStyle(root).getPropertyValue("--ds-font-family-code").trim();
    report.uiFont = appUiFont();
    report.location = String(globalThis.location?.href ?? "");
    report.reportedAt = (/* @__PURE__ */ new Date()).toISOString();
  } catch {
  }
  return report;
}
var PROBE_FAMILIES = [
  "Microsoft YaHei",
  "Noto Sans SC",
  "PingFang SC",
  "Hiragino Sans GB",
  "Source Han Sans SC",
  "SimSun",
  "NSimSun",
  "Consolas",
  "Segoe UI",
  "JetBrains Mono",
  "Cascadia Mono",
  "Courier New"
];
function fontAvailability(families = PROBE_FAMILIES) {
  const available = {};
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return available;
    const sample = "Font sample Wg1";
    ctx.font = "32px monospace";
    const base = ctx.measureText(sample).width;
    for (const family of families) {
      ctx.font = `32px "${family}", monospace`;
      available[family] = Math.abs(ctx.measureText(sample).width - base) > 0.5;
    }
  } catch {
  }
  return available;
}
var PANEL_PROBE_CLASSES = ["dsh-git-panel-form", "dsh-git-changes-panel", "dsh-git-worktree-path", "dsh-git-view-tab"];
var PANEL_SAMPLE_SELECTORS = [
  ".dsh-git-panel-heading",
  ".dsh-git-worktree-path",
  ".dsh-git-worktree-branch",
  ".dsh-git-view-tab",
  ".dsh-git-empty-state",
  ".dsh-git-changes-panel",
  "code"
];
function describe(element) {
  const name = element.tagName.toLowerCase();
  const className = typeof element.className === "string" ? element.className.trim() : "";
  return className ? `${name}.${className.split(/\s+/).join(".")}` : name;
}
function fontOf(element) {
  const style = getComputedStyle(element);
  return {
    selector: describe(element),
    font: style.fontFamily || "",
    weight: style.fontWeight || "",
    size: style.fontSize || ""
  };
}
function collectPanelDiagnostics(root) {
  if (!root || typeof getComputedStyle !== "function") return { found: false };
  const result = { found: true };
  try {
    result.panelFont = getComputedStyle(root).fontFamily || "";
    const ancestors = [];
    let node = root;
    for (let depth = 0; node && depth < 8; depth += 1) {
      ancestors.push(fontOf(node));
      node = node.parentElement;
    }
    result.ancestors = ancestors;
    const holder = document.createElement("div");
    holder.setAttribute("aria-hidden", "true");
    holder.style.cssText = "position:absolute;left:-10000px;top:0;width:240px";
    const made = [];
    for (const className of PANEL_PROBE_CLASSES) {
      const element = document.createElement("div");
      element.className = className;
      element.textContent = "Font sample master";
      holder.appendChild(element);
      made.push({ selector: `.${className}`, element });
    }
    const code = document.createElement("code");
    code.textContent = "master (currently checked out)";
    holder.appendChild(code);
    made.push({ selector: "code", element: code });
    root.appendChild(holder);
    result.probes = made.map(({ selector, element }) => ({ ...fontOf(element), selector }));
    holder.remove();
    const elements = [];
    for (const selector of PANEL_SAMPLE_SELECTORS) {
      const element = root.querySelector(selector);
      if (element) elements.push({ ...fontOf(element), selector });
    }
    result.elements = elements;
    result.availability = fontAvailability();
    result.fontFaceCount = document.fonts?.size ?? 0;
  } catch {
  }
  return result;
}
function rectOf(element) {
  const box = element.getBoundingClientRect();
  return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
}
function selectorOf(element) {
  const name = element.tagName.toLowerCase();
  const className = typeof element.className === "string" ? element.className.trim() : "";
  const id = element.id ? `#${element.id}` : "";
  const classes = className ? `.${className.split(/\s+/).slice(0, 3).join(".")}` : "";
  return `${name}${id}${classes}`;
}
function pseudoFacts(element, which) {
  const empty = { content: "", width: "", height: "", opacity: "", backgroundImage: "", backgroundColor: "", inset: "" };
  try {
    const style = getComputedStyle(element, which);
    return {
      content: style.content || "",
      width: style.width || "",
      height: style.height || "",
      opacity: style.opacity || "",
      backgroundImage: style.backgroundImage || "",
      backgroundColor: style.backgroundColor || "",
      inset: `${style.top} ${style.right} ${style.bottom} ${style.left}`
    };
  } catch {
    return empty;
  }
}
function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
function isHovered(element) {
  try {
    return element.matches(":hover");
  } catch {
    return false;
  }
}
function collectOverlayDiagnostics(root) {
  const result = {
    viewport: {
      width: globalThis.innerWidth || 0,
      height: globalThis.innerHeight || 0,
      dpr: globalThis.devicePixelRatio || 1,
      scrollX: globalThis.scrollX || 0,
      scrollY: globalThis.scrollY || 0
    },
    panel: null,
    totalElements: 0,
    gradients: [],
    thin: [],
    dividers: [],
    cells: [],
    hits: [],
    hoveredChain: [],
    cursorZones: []
  };
  if (typeof document === "undefined" || typeof getComputedStyle !== "function") return result;
  try {
    const panelRect = root ? rectOf(root) : { x: 0, y: 0, width: result.viewport.width, height: result.viewport.height };
    result.panel = root ? panelRect : null;
    const all = document.querySelectorAll("*");
    result.totalElements = all.length;
    for (const element of all) {
      if (root && (root.contains(element) || element === root)) continue;
      const rect = rectOf(element);
      if (!overlaps(rect, panelRect)) continue;
      const classList = typeof element.className === "string" ? element.className : "";
      if (element.hasAttribute("data-dockkit-divider")) {
        result.dividers.push({
          selector: selectorOf(element),
          rect,
          zIndex: getComputedStyle(element).zIndex,
          hovered: isHovered(element),
          before: pseudoFacts(element, "::before"),
          after: pseudoFacts(element, "::after")
        });
      }
      if (element.hasAttribute("data-dockkit-cell")) {
        result.cells.push({
          rect,
          zIndex: getComputedStyle(element).zIndex,
          className: classList.slice(0, 80),
          hasPanel: Boolean(root && element.contains(root))
        });
      }
      const style = getComputedStyle(element);
      const before = pseudoFacts(element, "::before");
      const after = pseudoFacts(element, "::after");
      const painted = (facts) => Boolean(facts.content) && facts.content !== "none" && facts.backgroundImage.includes("gradient");
      const which = style.backgroundImage.includes("gradient") ? "self" : painted(before) ? "::before" : painted(after) ? "::after" : "";
      if (which && result.gradients.length < 20) {
        const facts = which === "self" ? { content: "", width: style.width, height: style.height, opacity: style.opacity, backgroundImage: style.backgroundImage, backgroundColor: style.backgroundColor, inset: "" } : which === "::before" ? before : after;
        result.gradients.push({
          selector: selectorOf(element),
          which,
          rect,
          position: style.position,
          zIndex: style.zIndex,
          opacity: style.opacity,
          backgroundImage: facts.backgroundImage.slice(0, 160),
          backgroundSize: facts.width + " " + facts.height,
          pseudoOpacity: facts.opacity,
          pseudoContent: facts.content
        });
      }
      if (rect.width > 8 || rect.height < 8 || result.thin.length >= 20) continue;
      result.thin.push({
        selector: selectorOf(element),
        rect,
        position: style.position,
        zIndex: style.zIndex,
        opacity: style.opacity,
        backgroundImage: style.backgroundImage.slice(0, 120),
        backgroundColor: style.backgroundColor,
        borderLeft: `${style.borderLeftWidth} ${style.borderLeftColor}`,
        boxShadow: style.boxShadow.slice(0, 120),
        before,
        after
      });
    }
    const stepX = Math.max(40, Math.round(panelRect.width / 12));
    for (let x = panelRect.x + stepX; x < panelRect.x + panelRect.width && result.hits.length < 40; x += stepX) {
      for (const ratio of [0.2, 0.4, 0.6, 0.8]) {
        const y = Math.round(panelRect.y + panelRect.height * ratio);
        const stack = document.elementsFromPoint(x, y) || [];
        const foreign = stack.filter((element) => !(root && (root.contains(element) || element === root)) && element !== document.documentElement && element !== document.body).slice(0, 3).map(selectorOf);
        if (foreign.length) result.hits.push({ x, y, selectors: foreign });
      }
    }
    result.hoveredChain = Array.from(document.querySelectorAll(":hover")).slice(-6).map(selectorOf);
    const midY = Math.round(panelRect.y + panelRect.height / 2);
    let previous = "";
    for (let x = panelRect.x + 2; x < panelRect.x + panelRect.width && result.cursorZones.length < 12; x += 4) {
      const top = document.elementFromPoint(x, midY);
      if (!top) continue;
      const cursor = getComputedStyle(top).cursor || "";
      const signature = cursor + "|" + selectorOf(top);
      if (!cursor || cursor === "auto" || cursor === "default" || signature === previous) continue;
      previous = signature;
      result.cursorZones.push({ x, cursor, selector: selectorOf(top) });
    }
  } catch {
  }
  return result;
}
function reportClientState(source = "client", panel, overlay) {
  try {
    if (typeof fetch !== "function") return;
    void fetch("/dsh-git/client-report", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, ...collectClientReport(), panel, overlay })
    }).catch(() => {
    });
  } catch {
  }
}

// src/client/workspace-actions.ts
function createWorktreeOpener(scope) {
  return async (path) => {
    if (!scope.workspaces?.create || !scope.uiWorkspace?.openWorkspace) {
      throw new Error("The current environment cannot open a Worktree session; please open that directory manually");
    }
    const workspace = await scope.workspaces.create({ path });
    if (!workspace?.workspaceId) throw new Error("Failed to create workspace: no workspace identifier was returned");
    await scope.uiWorkspace.openWorkspace(workspace.workspaceId);
  };
}

// src/client/panels/navigation.ts
var GIT_CONVERSATION_VIEW = "dsh-plugin-git";
var GIT_WORKBENCH_TITLE = "Git";
var GIT_PANEL_VIEWS = ["changes", "history", "stashes", "create-branch", "create-worktree", "worktrees"];
var GIT_PANEL_TITLES = {
  changes: "Changes",
  history: "Commit history",
  stashes: "Stashes",
  "create-branch": "Create branch",
  "create-worktree": "Create worktree",
  worktrees: "Worktree"
};
function isGitPanelView(value) {
  return typeof value === "string" && GIT_PANEL_VIEWS.includes(value);
}
var GIT_VIEW_ENTRIES = [
  { view: "changes", primary: true },
  { view: "history", primary: true },
  { view: "stashes", primary: true },
  { view: "worktrees", primary: true },
  { view: "create-branch", primary: false },
  { view: "create-worktree", primary: false }
];
var VIEW_BY_KEY = /* @__PURE__ */ new Map();
var listeners = /* @__PURE__ */ new Set();
function mapKey(sessionId, cwd) {
  return `${sessionId || ""}\0${cwd || ""}`;
}
function activeGitView(sessionId, cwd, fallback = "changes") {
  return VIEW_BY_KEY.get(mapKey(sessionId, cwd)) ?? fallback;
}
function setActiveGitView(sessionId, cwd, view) {
  const key = mapKey(sessionId, cwd);
  if (VIEW_BY_KEY.get(key) === view) return;
  VIEW_BY_KEY.set(key, view);
  for (const listener of [...listeners]) listener();
}
function subscribeGitView(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
var registrationError = "";
function noteGitViewError(message2) {
  registrationError = message2;
}
function gitViewError() {
  return registrationError;
}
var navigators = /* @__PURE__ */ new Map();
var navigationListeners = /* @__PURE__ */ new Set();
function samePath(left, right) {
  const normalize = (path) => {
    const value = path.replace(/\\/g, "/").replace(/\/$/, "");
    return /^[a-z]:\//i.test(value) || value.startsWith("//") ? value.toLowerCase() : value;
  };
  return normalize(left) === normalize(right);
}
function bindGitSessionNavigator(sessionId, navigator2) {
  navigators.set(sessionId, navigator2);
  for (const listener of [...navigationListeners]) listener();
  return () => {
    if (navigators.get(sessionId) === navigator2) navigators.delete(sessionId);
  };
}
function openGitSessionView(sessionId, cwd, timeoutMs = 5e3) {
  return new Promise((resolve, reject) => {
    let timer;
    const finish = (error) => {
      if (timer) clearTimeout(timer);
      navigationListeners.delete(check);
      if (error) reject(error);
      else resolve();
    };
    const check = () => {
      const navigator2 = navigators.get(sessionId);
      if (!navigator2) return;
      if (!samePath(navigator2.cwd, cwd)) {
        finish(new Error("The session's repository directory has changed; reopen the Git workbench"));
        return;
      }
      try {
        navigator2.select(GIT_CONVERSATION_VIEW);
        finish();
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    };
    navigationListeners.add(check);
    timer = setTimeout(() => finish(new Error(gitViewError() || "The Git session tab is not ready yet, reopen the session and retry")), timeoutMs);
    check();
  });
}

// src/client/sidebar-actions.ts
var GIT_PANEL_TYPES = Object.fromEntries(
  GIT_PANEL_VIEWS.map((view) => [view, GIT_CONVERSATION_VIEW])
);
function createGitPanelOpener(scope) {
  return async (view, target) => {
    if (!isGitPanelView(view)) throw new Error("Unknown Git page");
    if (!target.cwd) throw new Error("Please select a project directory first");
    const refused = gitViewError();
    if (refused) throw new Error(`Failed to register the Git workbench: ${refused}`);
    let sessionId = target.sessionId;
    if (!sessionId) {
      const workspace = await scope.workspaces.create({ path: target.cwd });
      sessionId = await scope.uiWorkspace.connectWorkspace(workspace.workspaceId);
      await scope.uiWorkspace.openWorkspace(workspace.workspaceId);
    }
    if (!sessionId) throw new Error("The workspace did not return a usable session");
    setActiveGitView(sessionId, target.cwd, view);
    await openGitSessionView(sessionId, target.cwd);
  };
}

// src/client/panels/GitWorkbenchPage.tsx
var import_react17 = require("react");

// src/client/panels/GitSidebarPanel.tsx
var import_react16 = require("react");

// src/client/dialogs/CreateBranchDialog.tsx
var import_react13 = require("react");
init_api();
var import_jsx_runtime13 = require("react/jsx-runtime");
function CreateBranchDialog({ path, currentBranch, onClose, onSuccess }) {
  const [name, setName] = (0, import_react13.useState)("");
  const [base, setBase] = (0, import_react13.useState)(currentBranch);
  const [error, setError] = (0, import_react13.useState)(null);
  const [submitting, setSubmitting] = (0, import_react13.useState)(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await gitApi.createBranch(path, name.trim(), base.trim() || void 0);
      if (res.ok && res.branch) {
        onSuccess(res.branch);
        onClose();
      } else {
        setError(res.error?.message || "Failed to create branch");
      }
    } catch (err) {
      setError(err?.message || "Error creating branch");
    } finally {
      setSubmitting(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(DialogShell, { title: "Create and check out new branch", busy: submitting, onClose, children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dsh-git-modal-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { children: "Create and check out new branch" }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("button", { type: "button", "aria-label": "Close", className: "dsh-git-icon-btn", disabled: submitting, onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(IconClose, { size: 16 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("form", { onSubmit: handleSubmit, children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dsh-git-modal-body", children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("label", { htmlFor: "dsh-git-branch-name", style: { display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }, children: "New branch name" }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
            "input",
            {
              className: "dsh-git-input",
              id: "dsh-git-branch-name",
              disabled: submitting,
              placeholder: "e.g.: feature/awesome-ui",
              value: name,
              onChange: (e) => setName(e.target.value),
              autoFocus: true
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("label", { htmlFor: "dsh-git-branch-base", style: { display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }, children: "From branch / commit (optional)" }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
            "input",
            {
              className: "dsh-git-input",
              id: "dsh-git-branch-base",
              disabled: submitting,
              placeholder: "Defaults to the current branch HEAD",
              value: base,
              onChange: (e) => setBase(e.target.value)
            }
          )
        ] }),
        error && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { role: "alert", className: "dsh-git-error", style: { fontSize: 12.5, padding: "6px 10px", borderRadius: 6 }, children: error })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "dsh-git-modal-footer", children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: submitting, onClick: onClose, children: "Cancel" }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
          "button",
          {
            type: "submit",
            className: "dsh-git-btn dsh-git-btn-primary",
            disabled: submitting || !name.trim(),
            children: submitting ? "Creating..." : "Create and checkout"
          }
        )
      ] })
    ] })
  ] });
}

// src/client/dialogs/WorktreeDialogs.tsx
var import_react14 = require("react");
init_api();
var import_jsx_runtime14 = require("react/jsx-runtime");
var message = (error) => error instanceof Error ? error.message : typeof error === "string" ? error : "Operation failed";
function CreateWorktreeDialog({ path, currentBranch, onClose, onSuccess, onOpenWorktree }) {
  const [name, setName] = (0, import_react14.useState)("");
  const [base, setBase] = (0, import_react14.useState)(currentBranch || "");
  const [submitting, setSubmitting] = (0, import_react14.useState)(false);
  const [error, setError] = (0, import_react14.useState)(null);
  const [createdPath, setCreatedPath] = (0, import_react14.useState)(null);
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !createdPath && !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      let destination = createdPath;
      if (!destination) {
        const result = await gitApi.createWorktree(path, name.trim(), base.trim() || void 0);
        if (!result.ok || !result.path) throw new Error(message(result.error || "Worktree creation failed"));
        destination = result.path;
        setCreatedPath(destination);
        onSuccess?.(destination);
      }
      if (onOpenWorktree) await onOpenWorktree(destination);
      onClose();
    } catch (error2) {
      setError(message(error2));
    } finally {
      setSubmitting(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(DialogShell, { title: "Create worktree", onClose, busy: submitting, children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-modal-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(IconWorktree, { size: 16 }),
        " Create worktree"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("button", { type: "button", "aria-label": "Close", className: "dsh-git-icon-btn", disabled: submitting, onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(IconClose, { size: 16 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("form", { onSubmit: handleSubmit, children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-modal-body", children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-muted", style: { fontSize: 13 }, children: [
          "Separate worktrees keep parallel tasks from overwriting each other.",
          onOpenWorktree ? "It will open in the workspace after creation." : "This entry only creates a worktree; it does not create a session automatically."
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("label", { children: [
          "Worktree task id",
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("input", { className: "dsh-git-input", value: name, onChange: (event) => setName(event.target.value), disabled: submitting || !!createdPath, placeholder: "e.g. feature-login", autoFocus: true })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("label", { children: [
          "Base branch",
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("input", { className: "dsh-git-input", value: base, onChange: (event) => setBase(event.target.value), disabled: submitting || !!createdPath })
        ] }),
        createdPath && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { role: "status", children: [
          "Created: ",
          createdPath
        ] }),
        error && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-error", role: "alert", children: [
          error,
          createdPath ? "(the worktree was kept, you can retry opening it)" : ""
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-modal-footer", children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: submitting, onClick: onClose, children: "Close" }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("button", { type: "submit", className: "dsh-git-btn dsh-git-btn-primary", disabled: submitting || !createdPath && !name.trim(), children: submitting ? "Processing\u2026" : createdPath ? "Retry opening workspace" : onOpenWorktree ? "Create and open workspace" : "Create worktree" })
      ] })
    ] })
  ] });
}
function WorktreeManagerDialog({ path, onClose, onOpenWorktree }) {
  const inline = (0, import_react14.useContext)(GitPanelContext);
  const [list, setList] = (0, import_react14.useState)([]);
  const [loading, setLoading] = (0, import_react14.useState)(true);
  const [loadError, setLoadError] = (0, import_react14.useState)(null);
  const [actionError, setActionError] = (0, import_react14.useState)(null);
  const [notice, setNotice] = (0, import_react14.useState)(null);
  const [busy, setBusy] = (0, import_react14.useState)(null);
  const [pendingDelete, setPendingDelete] = (0, import_react14.useState)(null);
  const [forceDelete, setForceDelete] = (0, import_react14.useState)(false);
  const [lockTarget, setLockTarget] = (0, import_react14.useState)(null);
  const [lockReason, setLockReason] = (0, import_react14.useState)("");
  const [pruneOutput, setPruneOutput] = (0, import_react14.useState)(null);
  const [pruneReady, setPruneReady] = (0, import_react14.useState)(false);
  const [refreshKey, setRefreshKey] = (0, import_react14.useState)(0);
  const alive = (0, import_react14.useRef)(true);
  const close = onClose || (() => {
  });
  (0, import_react14.useEffect)(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  (0, import_react14.useEffect)(() => {
    const controller = new AbortController();
    setList([]);
    setLoading(true);
    setLoadError(null);
    const load = async () => {
      try {
        const result = await gitApi.getWorktreesWithStatus(path, controller.signal);
        if (!controller.signal.aborted) setList(result);
      } catch {
        if (controller.signal.aborted) return;
        try {
          const result = await gitApi.getWorktrees(path, controller.signal);
          if (!controller.signal.aborted) setList(result);
        } catch (fallbackError) {
          if (!controller.signal.aborted) setLoadError(message(fallbackError));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [path, refreshKey]);
  const mutate = async (key, action, success, afterSuccess) => {
    if (busy) return false;
    setBusy(key);
    setActionError(null);
    setNotice(null);
    try {
      const result = await action();
      if (!result.ok) {
        setActionError(result.error || "Operation failed");
        return false;
      }
      setNotice(success);
      afterSuccess?.();
      return true;
    } catch (actionError2) {
      setActionError(message(actionError2));
      return false;
    } finally {
      if (alive.current) {
        setBusy(null);
        setRefreshKey((value) => value + 1);
      }
    }
  };
  const handleReveal = async (worktreePath) => {
    setActionError(null);
    setNotice(null);
    try {
      const result = await gitApi.reveal(path, worktreePath);
      if (!result.ok) setActionError(result.error || "Cannot reveal the worktree in the file manager");
      else setNotice(`Revealed in the file manager: ${result.target || worktreePath}`);
    } catch (revealError) {
      setActionError(message(revealError));
    }
  };
  const handleOpen = async (worktreePath) => {
    if (!onOpenWorktree) return;
    setActionError(null);
    setNotice(null);
    try {
      await onOpenWorktree(worktreePath);
      setNotice(`Opened worktree:${worktreePath}`);
    } catch (openError) {
      setActionError(message(openError));
    }
  };
  const previewPrune = async () => {
    if (busy) return;
    setBusy("prune-preview");
    setActionError(null);
    setNotice(null);
    setPruneOutput(null);
    setPruneReady(false);
    try {
      const result = await gitApi.pruneWorktrees(path, true);
      if (!result.ok) {
        setActionError(result.error || "Cleanup preview failed");
        return;
      }
      const output = result.output?.trim() || "";
      setPruneOutput(output || "There are no stale worktrees to clean up.");
      setPruneReady(!!output);
    } catch (pruneError) {
      setActionError(message(pruneError));
    } finally {
      if (alive.current) setBusy(null);
    }
  };
  const confirmPrune = async () => {
    const completed = await mutate("prune", () => gitApi.pruneWorktrees(path, false), "Cleaned up stale worktrees", () => setPruneReady(false));
    if (completed) setPruneOutput(null);
  };
  const confirmDelete = (worktreePath) => {
    if (pendingDelete !== worktreePath) return;
    void mutate(
      `remove:${worktreePath}`,
      () => gitApi.removeWorktree(path, worktreePath, forceDelete),
      "Worktree deleted",
      () => {
        setPendingDelete(null);
        setForceDelete(false);
      }
    );
  };
  const closeDialog = () => {
    if (!busy) close();
  };
  const renderManagerBody = () => /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(import_jsx_runtime14.Fragment, { children: [
    notice && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "dsh-git-changes-notice", role: "status", children: notice }),
    actionError && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "dsh-git-error", role: "alert", children: actionError }),
    loadError && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "dsh-git-error", role: "alert", children: loadError }),
    pruneOutput !== null && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "dsh-git-section-head", children: "Prune preview" }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("pre", { className: "dsh-git-code-box", children: pruneOutput }),
      !pruneReady && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "dsh-git-muted", style: { fontSize: 13 }, children: "Git leaves a stale entry only when a worktree directory is deleted or moved by hand; removing from this page leaves nothing behind." }),
      pruneReady && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-panel-toolbar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-primary", disabled: !!busy, onClick: () => void confirmPrune(), children: busy === "prune" ? "Cleaning up\u2026" : "Confirm cleaning up stale worktrees" }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: !!busy, onClick: () => {
          setPruneOutput(null);
          setPruneReady(false);
        }, children: "Cancel" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("section", { className: "dsh-git-section", "aria-label": "Worktree list", children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-section-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { children: "Worktree list" }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: "dsh-git-badge", "aria-label": `Total ${list.length} worktrees`, children: [
          list.length,
          " trees"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "dsh-git-scroll-list", "aria-busy": loading, children: loading ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "dsh-git-panel-message", children: "Reading worktrees\u2026" }) : loadError && list.length === 0 ? null : list.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-empty-state", children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "dsh-git-state-icon", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(IconWorktree, { size: 24 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("strong", { children: "No worktrees" }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("p", { children: "A worktree checks the branch out into its own directory, which helps with parallel tasks." })
      ] }) : list.map((worktree) => /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("article", { className: "dsh-git-section", children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-worktree-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-worktree-copy", children: [
            /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("strong", { children: worktree.branch || "HEAD" }),
            worktree.isCurrent && "(current checkout)",
            /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "dsh-git-muted dsh-git-worktree-path", children: worktree.path }),
            /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { children: [
              (worktree.dirtyFiles || 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: "dsh-git-badge-warn", children: [
                worktree.dirtyFiles,
                " uncommitted changes"
              ] }),
              worktree.locked && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: "dsh-git-badge", title: worktree.lockedReason || "Worktree is locked", children: [
                "Locked",
                worktree.lockedReason ? ` \xB7 ${worktree.lockedReason}` : ""
              ] }),
              worktree.detached && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "dsh-git-badge", children: "Detached" }),
              worktree.prunable && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "dsh-git-badge-warn", children: "Removable" })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-stash-actions", children: [
            onOpenWorktree && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: !!busy, onClick: () => void handleOpen(worktree.path), children: [
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(IconExternalLink, { size: 15 }),
              "Open session"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: !!busy, onClick: () => void handleReveal(worktree.path), children: [
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(IconFolderTree, { size: 15 }),
              "Reveal in file manager"
            ] }),
            !worktree.locked && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", "aria-expanded": lockTarget === worktree.path, disabled: !!busy, onClick: () => {
              setLockTarget(lockTarget === worktree.path ? null : worktree.path);
              setLockReason("");
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(IconWorktree, { size: 15 }),
              "Lock"
            ] }),
            worktree.locked && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: !!busy, onClick: () => void mutate(`unlock:${worktree.path}`, () => gitApi.unlockWorktree(path, worktree.path), "Worktree unlocked"), children: [
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(IconCheck, { size: 15 }),
              "Unlock"
            ] }),
            !worktree.isCurrent && pendingDelete !== worktree.path && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-danger", disabled: !!busy || !!worktree.locked, title: worktree.locked ? "A locked worktree must be unlocked before it can be removed" : void 0, onClick: () => {
              setForceDelete(false);
              setPendingDelete(worktree.path);
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(IconTrash, { size: 15 }),
              "Remove worktree"
            ] })
          ] })
        ] }),
        lockTarget === worktree.path && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-panel-toolbar", children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("input", { className: "dsh-git-input", "aria-label": "Lock reason", placeholder: "Lock reason (optional)", value: lockReason, onChange: (event) => setLockReason(event.target.value), disabled: !!busy }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-primary", disabled: !!busy, onClick: () => void mutate(`lock:${worktree.path}`, () => gitApi.lockWorktree(path, worktree.path, lockReason.trim() || void 0), "Worktree locked", () => setLockTarget(null)), children: busy === `lock:${worktree.path}` ? "Locking\u2026" : "Confirm locking worktree" }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: !!busy, onClick: () => setLockTarget(null), children: "Cancel" })
        ] }),
        pendingDelete === worktree.path && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-section", role: "group", "aria-label": "Confirm worktree removal", children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "dsh-git-section-head", children: "Confirm worktree removal" }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("p", { children: "A normal removal refuses a worktree with uncommitted changes. Force removal may discard them, so confirm carefully." }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("label", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("input", { className: "dsh-git-checkbox", type: "checkbox", checked: forceDelete, onChange: (event) => setForceDelete(event.target.checked), disabled: !!busy }),
            "Force remove (may discard uncommitted changes)"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-panel-toolbar", children: [
            /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-danger", disabled: !!busy, onClick: () => confirmDelete(worktree.path), children: forceDelete ? "Confirm force-removing the worktree" : "Confirm worktree removal" }),
            /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: !!busy, onClick: () => {
              setPendingDelete(null);
              setForceDelete(false);
            }, children: "Cancel" })
          ] })
        ] })
      ] }, worktree.path)) })
    ] })
  ] });
  if (inline) return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("header", { className: "dsh-git-page-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-page-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("h2", { children: "Manage Git worktrees" }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("p", { children: "Inspect standalone working directories and safely open, lock, or remove worktrees." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-page-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: loading || !!busy, onClick: () => setRefreshKey((value) => value + 1), children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(IconRefresh, { size: 15 }),
          "Refresh"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: !!busy, onClick: () => void previewPrune(), children: busy === "prune-preview" ? "Checking\u2026" : "Preview cleaning up stale worktrees" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "dsh-git-page-body", children: renderManagerBody() })
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(DialogShell, { title: "Manage Git worktrees", onClose: closeDialog, busy: !!busy, style: { width: 640 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-modal-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(IconWorktree, { size: 16 }),
        " Manage Git worktrees"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("button", { type: "button", "aria-label": "Close", className: "dsh-git-icon-btn", disabled: !!busy, onClick: closeDialog, children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(IconClose, { size: 16 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-modal-body", children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "dsh-git-panel-toolbar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: loading || !!busy, onClick: () => setRefreshKey((value) => value + 1), children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(IconRefresh, { size: 14 }),
          "Refresh"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: !!busy, onClick: () => void previewPrune(), children: busy === "prune-preview" ? "Checking\u2026" : "Preview cleaning up stale worktrees" })
      ] }),
      renderManagerBody()
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "dsh-git-modal-footer", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: !!busy, onClick: closeDialog, children: "Done" }) })
  ] });
}

// src/client/dialogs/StashPanel.tsx
var import_react15 = require("react");
init_api();
var import_jsx_runtime15 = require("react/jsx-runtime");
var errorMessage3 = (error) => error instanceof Error ? error.message : typeof error === "string" ? error : "Operation failed";
function StashPanel({ path, onClose }) {
  const [stashes, setStashes] = (0, import_react15.useState)([]);
  const [loading, setLoading] = (0, import_react15.useState)(true);
  const [loadError, setLoadError] = (0, import_react15.useState)(null);
  const [actionError, setActionError] = (0, import_react15.useState)(null);
  const [notice, setNotice] = (0, import_react15.useState)(null);
  const [refreshKey, setRefreshKey] = (0, import_react15.useState)(0);
  const [showForm, setShowForm] = (0, import_react15.useState)(false);
  const [stashMessage, setStashMessage] = (0, import_react15.useState)("");
  const [includeUntracked, setIncludeUntracked] = (0, import_react15.useState)(false);
  const [keepIndex, setKeepIndex] = (0, import_react15.useState)(false);
  const [busy, setBusy] = (0, import_react15.useState)(null);
  const [pendingDrop, setPendingDrop] = (0, import_react15.useState)(null);
  const [diff, setDiff] = (0, import_react15.useState)(null);
  const diffRequest2 = (0, import_react15.useRef)(null);
  const alive = (0, import_react15.useRef)(true);
  (0, import_react15.useEffect)(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      diffRequest2.current?.abort();
    };
  }, []);
  (0, import_react15.useEffect)(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    gitApi.getStashes(path, controller.signal).then((result) => {
      if (!controller.signal.aborted) setStashes(result);
    }).catch((error) => {
      if (!controller.signal.aborted) setLoadError(errorMessage3(error));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [path, refreshKey]);
  (0, import_react15.useEffect)(() => {
    diffRequest2.current?.abort();
    setDiff(null);
    return () => diffRequest2.current?.abort();
  }, [path]);
  const runMutation = async (key, action, success) => {
    if (busy) return false;
    diffRequest2.current?.abort();
    setDiff(null);
    setBusy(key);
    setActionError(null);
    setNotice(null);
    try {
      const result = await action();
      if (!result.ok) {
        setActionError(result.error || "Operation failed");
        return false;
      }
      setNotice(success);
      setDiff(null);
      setPendingDrop(null);
      return true;
    } catch (error) {
      setActionError(errorMessage3(error));
      return false;
    } finally {
      if (alive.current) {
        setBusy(null);
        setRefreshKey((value) => value + 1);
      }
    }
  };
  const showDiff = async (stash) => {
    if (busy) return;
    diffRequest2.current?.abort();
    const controller = new AbortController();
    diffRequest2.current = controller;
    setDiff({ index: stash.index, loading: true });
    setActionError(null);
    try {
      const view = await gitApi.getStashDiff(path, stash.index, controller.signal);
      if (!controller.signal.aborted) setDiff({ index: stash.index, loading: false, view });
    } catch (error) {
      if (!controller.signal.aborted) setDiff({ index: stash.index, loading: false, error: errorMessage3(error) });
    }
  };
  const createStash = async (event) => {
    event.preventDefault();
    const created = await runMutation("push", () => gitApi.stashPush(path, {
      message: stashMessage.trim() || void 0,
      includeUntracked,
      keepIndex
    }), "Current changes stashed");
    if (!created) return;
    setShowForm(false);
    setStashMessage("");
    setIncludeUntracked(false);
    setKeepIndex(false);
  };
  const renderDiff = (stash) => {
    if (diff?.index !== stash.index) return null;
    if (diff.loading) return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dsh-git-section", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dsh-git-panel-message", children: "Reading stash diff\u2026" }) });
    if (diff.error) return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dsh-git-section", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dsh-git-error", role: "alert", children: diff.error }) });
    if (!diff.view?.files.length) return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dsh-git-section", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dsh-git-muted", children: "No diff to display" }) });
    return diff.view.files.map((file) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "dsh-git-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dsh-git-section-head", children: file.path }),
      file.binary ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dsh-git-binary-note", children: "Binary file; no text patch to display" }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("pre", { className: "dsh-git-code-box", children: file.rawPatch || "No text patch to display" })
    ] }, `${stash.index}:${file.path}`));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "dsh-git-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("header", { className: "dsh-git-page-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "dsh-git-page-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("h2", { className: "dsh-git-panel-heading", children: "Stashes" }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { children: "Save the current uncommitted changes; you can review the diff and reapply them later." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "dsh-git-page-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("button", { type: "button", className: `dsh-git-btn ${showForm ? "dsh-git-btn-secondary" : "dsh-git-btn-primary"}`, disabled: !!busy, "aria-expanded": showForm, onClick: () => setShowForm((value) => !value), children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconStash, { size: 15 }),
          showForm ? "Cancel creation" : "Create stash"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", title: "Refresh stashes", "aria-label": "Refresh stashes", disabled: loading || !!busy, onClick: () => setRefreshKey((value) => value + 1), children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconRefresh, { size: 15, className: loading ? "dsh-git-spin" : "" }),
          "Refresh"
        ] }),
        onClose && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: onClose, children: "Close" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "dsh-git-page-body", children: [
      notice && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dsh-git-changes-notice", role: "status", children: notice }),
      actionError && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dsh-git-error", role: "alert", children: actionError }),
      loadError && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dsh-git-error", role: "alert", children: loadError }),
      showForm && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("form", { className: "dsh-git-section", onSubmit: createStash, children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dsh-git-section-head", children: "Create stash" }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("input", { className: "dsh-git-input", "aria-label": "Stash description", placeholder: "Stash message (optional)", value: stashMessage, onChange: (event) => setStashMessage(event.target.value), disabled: !!busy }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("label", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("input", { className: "dsh-git-checkbox", type: "checkbox", checked: includeUntracked, onChange: (event) => setIncludeUntracked(event.target.checked), disabled: !!busy }),
          "Include untracked files"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("label", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("input", { className: "dsh-git-checkbox", type: "checkbox", checked: keepIndex, onChange: (event) => setKeepIndex(event.target.checked), disabled: !!busy }),
          "Keep staged changes"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "dsh-git-panel-toolbar", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("button", { type: "submit", className: "dsh-git-btn dsh-git-btn-primary", disabled: !!busy, children: busy === "push" ? "Creating stash\u2026" : "Confirm creating stash" }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: !!busy, onClick: () => setShowForm(false), children: "Cancel" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("section", { className: "dsh-git-section", "aria-label": "Stash list", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "dsh-git-section-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "Stash list" }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "dsh-git-badge", "aria-label": `Total ${stashes.length} stashes`, children: [
            stashes.length,
            " "
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dsh-git-scroll-list", "aria-busy": loading, children: loading ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dsh-git-panel-message", children: "Loading stashes\u2026" }) : loadError ? null : stashes.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "dsh-git-empty-state", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dsh-git-state-icon", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconStash, { size: 24 }) }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("strong", { children: "No stashes" }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { children: "After you create a stash, the changes live here; you can preview the diff, apply, or pop the stash." })
        ] }) : stashes.map((stash) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "dsh-git-section", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "dsh-git-stash-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "dsh-git-stash-copy", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("strong", { className: "dsh-git-stash-subject", children: stash.subject }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dsh-git-stash-meta", children: [stash.selector, stash.shortHash || stash.hash, stash.branch, stash.date].filter(Boolean).join(" \xB7 ") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "dsh-git-stash-actions", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", "aria-expanded": diff?.index === stash.index, disabled: !!busy, onClick: () => {
                if (diff?.index === stash.index) {
                  diffRequest2.current?.abort();
                  setDiff(null);
                } else void showDiff(stash);
              }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconDiff, { size: 15 }),
                diff?.index === stash.index ? "Collapse diff" : "View diff"
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: !!busy, onClick: () => void runMutation(`apply:${stash.index}`, () => gitApi.stashApply(path, stash.index, false), "Stash applied"), children: [
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconCheck, { size: 15 }),
                "Apply"
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: !!busy, onClick: () => void runMutation(`pop:${stash.index}`, () => gitApi.stashApply(path, stash.index, true), "Stash popped"), children: [
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconUndo, { size: 15 }),
                "Pop and remove"
              ] }),
              pendingDrop === stash.index ? /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-danger", disabled: !!busy, onClick: () => void runMutation(`drop:${stash.index}`, () => gitApi.stashDrop(path, stash.index), "Stash dropped"), children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconCheck, { size: 15 }),
                  "Confirm delete"
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: !!busy, onClick: () => setPendingDrop(null), children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconClose, { size: 15 }),
                  "Cancel"
                ] })
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-danger", disabled: !!busy, onClick: () => setPendingDrop(stash.index), children: [
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconTrash, { size: 15 }),
                "Delete stash"
              ] })
            ] })
          ] }),
          pendingDrop === stash.index && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "dsh-git-muted", role: "alert", children: "Confirming again deletes this stash permanently; otherwise cancel." }),
          renderDiff(stash)
        ] }, `${stash.index}:${stash.hash}`)) })
      ] })
    ] })
  ] });
}

// src/client/panels/GitSidebarPanel.tsx
var import_jsx_runtime16 = require("react/jsx-runtime");
var VIEW_ICONS = {
  changes: IconDiff,
  history: IconHistory,
  stashes: IconStash,
  worktrees: IconFolderTree,
  "create-branch": IconBranchPlus,
  "create-worktree": IconFolderTree
};
function GitViewStrip({ view, onSelect }) {
  const pages = GIT_VIEW_ENTRIES.filter((entry) => entry.primary);
  const actions = GIT_VIEW_ENTRIES.filter((entry) => !entry.primary);
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "dsh-git-view-nav", "aria-label": "Git navigation", children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "dsh-git-view-pages", role: "tablist", "aria-label": "Git page", children: pages.map(({ view: target }) => {
      const Icon2 = VIEW_ICONS[target];
      return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": view === target,
          className: `dsh-git-view-tab ${view === target ? "dsh-git-view-tab-active" : ""}`,
          onClick: () => onSelect(target),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(Icon2, { size: 15 }),
            /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: GIT_PANEL_TITLES[target] })
          ]
        },
        target
      );
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "dsh-git-view-actions", children: actions.map(({ view: target }) => {
      const Icon2 = VIEW_ICONS[target];
      return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
        "button",
        {
          type: "button",
          title: GIT_PANEL_TITLES[target],
          "aria-label": GIT_PANEL_TITLES[target],
          "aria-pressed": view === target,
          className: `dsh-git-view-action ${view === target ? "dsh-git-view-tab-active" : ""}`,
          onClick: () => onSelect(target),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(Icon2, { size: 15 }),
            /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: GIT_PANEL_TITLES[target] })
          ]
        },
        target
      );
    }) })
  ] });
}
function RepositoryForm({ view, cwd, branch, onFinish, onClose, onOpenWorktree }) {
  if (view === "create-branch") {
    return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
      CreateBranchDialog,
      {
        path: cwd,
        currentBranch: branch,
        onClose: () => onFinish("changes"),
        onSuccess: () => onFinish("changes")
      }
    );
  }
  if (view === "create-worktree") {
    return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
      CreateWorktreeDialog,
      {
        path: cwd,
        currentBranch: branch,
        onClose: () => onFinish("worktrees"),
        onSuccess: onOpenWorktree ? void 0 : () => onFinish("worktrees"),
        onOpenWorktree
      }
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(WorktreeManagerDialog, { path: cwd, onClose, onOpenWorktree });
}
function GitSidebarPanel(props) {
  const cwd = props.tab?.path || props.scope?.repoRoot || props.scope?.cwd || props.cwd || "";
  const sessionId = props.scope?.sessionId || props.sessionId;
  const requested = props.view ?? props.tab?.meta?.gitView;
  const fallback = isGitPanelView(requested) ? requested : "changes";
  const view = (0, import_react16.useSyncExternalStore)(subscribeGitView, () => activeGitView(sessionId, cwd, fallback), () => fallback);
  const select = (0, import_react16.useCallback)((next) => setActiveGitView(sessionId, cwd, next), [sessionId, cwd]);
  const { status, error, reload } = useGitStatus(cwd || void 0);
  const [reloadKey, setReloadKey] = (0, import_react16.useState)(0);
  const onClose = () => props.onClose?.();
  const finish = (next) => {
    select(next);
    setReloadKey((value) => value + 1);
  };
  const rootRef = (0, import_react16.useRef)(null);
  (0, import_react16.useEffect)(() => {
    const timer = setTimeout(() => reportClientState("panel", collectPanelDiagnostics(rootRef.current)), 300);
    const overlay = setTimeout(() => reportClientState("overlay", void 0, collectOverlayDiagnostics(rootRef.current)), 1200);
    return () => {
      clearTimeout(timer);
      clearTimeout(overlay);
    };
  }, [view, cwd]);
  const page = (() => {
    if (view === "changes") return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(ChangesTab, { ...props, cwd, sessionId });
    if (error && !status) return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "dsh-git-empty-state", children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "dsh-git-state-icon", children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(IconBranchPlus, { size: 24 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("strong", { children: "Cannot read the repository right now" }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("p", { className: "dsh-git-state-error", role: "alert", children: error }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: reload, children: "Reload" })
    ] });
    if (status && !status.isGit) return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "dsh-git-empty-state", children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "dsh-git-state-icon", children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(IconFolderTree, { size: 24 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("strong", { children: "The current directory is not a Git repository" }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("p", { children: [
        "Run in project ",
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("code", { children: "git init" }),
        " , then manage branches and worktrees here."
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-primary", onClick: reload, children: "Reload" })
    ] });
    const needsBranch = view === "create-branch" || view === "create-worktree";
    if (needsBranch && !status) return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(GitLoadingState, { title: "Detecting Git repository", hint: "Branch information will appear shortly" });
    if (view === "history") return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(GitGraphDialog, { path: cwd, onClose }, reloadKey);
    if (view === "stashes") return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(StashPanel, { path: cwd }, reloadKey);
    return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
      RepositoryForm,
      {
        view,
        cwd,
        branch: status?.branch ?? "",
        onFinish: finish,
        onClose,
        onOpenWorktree: props.onOpenWorktree
      }
    );
  })();
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(GitPanelContext.Provider, { value: true, children: /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "dsh-git-sidebar-content", ref: rootRef, children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(GitViewStrip, { view, onSelect: select }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "dsh-git-view-content", children: page })
  ] }, `${sessionId || ""}:${cwd}`) });
}

// src/client/panels/GitWorkbenchPage.tsx
var import_jsx_runtime17 = require("react/jsx-runtime");
function GitSessionBridge(props) {
  const { cwd, sessionId } = useWorkspaceContext(props);
  const view = props.useStore((state) => state.view);
  const blank = props.useSession((session) => session?.blank === true);
  (0, import_react17.useEffect)(() => {
    if (!sessionId) return;
    return bindGitSessionNavigator(sessionId, { cwd, select: props.selectConversationView });
  }, [sessionId, cwd, props.selectConversationView]);
  (0, import_react17.useEffect)(() => {
    if (!blank || view !== GIT_CONVERSATION_VIEW) return;
    try {
      return props.mountBlankWorkbench();
    } catch (error) {
      noteGitViewError(error instanceof Error ? error.message : String(error));
      props.selectConversationView("chat");
    }
  }, [blank, view, props.mountBlankWorkbench, props.selectConversationView]);
  return null;
}
function GitWorkbenchPage(props) {
  const { cwd, sessionId } = useWorkspaceContext(props);
  const blank = props.useSession ? props.useSession((session) => session?.blank === true) : false;
  const back = () => {
    if (props.onReturnToConversation) props.onReturnToConversation();
    else props.openView?.("chat");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("section", { className: "dsh-git-workbench", "aria-label": "Git workbench", children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("header", { className: "dsh-git-workbench-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "dsh-git-workbench-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(IconBranch, { size: 18 }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("strong", { children: "Git workbench" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "dsh-git-workbench-path", title: cwd, children: cwd || "No project directory selected" }),
      blank && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("nav", { className: "dsh-git-blank-nav", role: "tablist", "aria-label": "Conversation view", children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("button", { type: "button", role: "tab", "aria-selected": "false", onClick: back, children: "Chat" }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { role: "tab", "aria-selected": "true", children: "Git" })
      ] })
    ] }),
    cwd ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(GitSidebarPanel, { ...props, cwd, sessionId, onClose: back }, `${sessionId || ""}:${cwd}`) : /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: "dsh-git-empty-state", children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("strong", { children: "No project directory selected" }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("p", { children: "Choose a workspace for this session, then open the Git workbench." })
    ] })
  ] });
}

// src/client/conversation-registration.ts
var GIT_SESSION_BRIDGE_SLOT = "dsh-plugin-git.session-navigation";
function conversationViewStore(slots) {
  const entry = slots.entries("conversation.session.header").find((item) => item.store);
  if (!entry?.store) throw new Error("The current host does not provide session tab state, cannot mount the Git workbench");
  return entry.store;
}
function installGitConversationView(scope, components, shared) {
  const slots = scope.slots;
  const disposers = [];
  const failures = /* @__PURE__ */ new Map();
  const publishErrors = () => noteGitViewError([...failures.values()].join(";"));
  const guarded = (key, register) => {
    try {
      const dispose = register();
      failures.delete(key);
      publishErrors();
      return dispose;
    } catch (error) {
      failures.set(key, error instanceof Error ? error.message : String(error));
      publishErrors();
      console.error("[dsh-plugin-git] failed to mount the Git workbench: ", error);
      return () => {
        failures.delete(key);
        publishErrors();
      };
    }
  };
  disposers.push(slots.inject("conversation.view", () => guarded("conversation.view", () => slots.register({
    name: "conversation.view",
    id: GIT_CONVERSATION_VIEW,
    label: () => GIT_WORKBENCH_TITLE,
    order: 40,
    inject: () => shared
  }, components.Page))));
  for (const name of ["conversation.session.header.utilities", GIT_SESSION_BRIDGE_SLOT]) {
    disposers.push(slots.inject(name, () => guarded(name, () => {
      const store = conversationViewStore(slots);
      return slots.register({
        name,
        id: "dsh-plugin-git-navigation",
        order: 40,
        store,
        inject: (sessionId, actions) => ({
          ...shared,
          selectConversationView: (view) => actions.setView(view),
          // The native views area intentionally renders null in a blank Session.
          // Use the sanctioned composer chain only while Git is selected there;
          // its overlay fallback keeps the original draft/composer mounted.
          mountBlankWorkbench: () => slots.inject("conversation.composer", () => slots.register({
            name: "conversation.composer",
            priority: -100,
            select: (owner) => owner.sessionId === sessionId && owner.session?.blank === true ? {} : null,
            inject: () => ({ ...shared, onReturnToConversation: () => actions.setView("chat") })
          }, components.Page))
        })
      }, components.Bridge);
    })));
  }
  return () => {
    for (const dispose of disposers.reverse()) dispose();
  };
}

// src/client/hero-registration.ts
var HERO_SLOT = "conversation.hero.agentPreset";
function installHeroControls(slots, decorate, children) {
  let original;
  let unregister;
  const ownComponents = /* @__PURE__ */ new Set();
  let disposed = false;
  const sync = () => {
    if (disposed) return;
    const next = slots.entries(HERO_SLOT).filter((entry) => !ownComponents.has(entry.component)).sort((a, b) => (a.options?.priority ?? 0) - (b.options?.priority ?? 0))[0];
    if (next === original) return;
    unregister?.();
    unregister = void 0;
    original = next;
    if (!next) return;
    if (next.children && Object.keys(next.children).length) {
      console.warn("Git inline controls: preset seat now owns child slots; leaving the original unchanged");
      return;
    }
    const component = decorate(next.component);
    ownComponents.add(component);
    unregister = slots.register({
      ...next.options,
      name: HERO_SLOT,
      priority: (next.options?.priority ?? 0) - 1,
      inject: next.inject,
      locale: next.locale,
      store: next.store,
      ...children ? { children } : {}
    }, component);
  };
  const unsubscribe = slots.subscribe(HERO_SLOT, sync);
  sync();
  return () => {
    disposed = true;
    unsubscribe();
    unregister?.();
    ownComponents.clear();
  };
}

// src/client/sidechat-integration.tsx
var import_react18 = require("react");

// src/client/sidechat-draft.ts
function pasteSidechatDraft(root, draft, signal, timeoutMs = 1e4) {
  return new Promise((resolve, reject) => {
    let done = false;
    let frame = 0;
    const view = root.ownerDocument.defaultView;
    const text2 = draft.text.replace(/\r\n?/g, "\n");
    const finish = (error) => {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(timer);
      if (frame) view.cancelAnimationFrame(frame);
      signal.removeEventListener("abort", abort);
      error ? reject(error) : resolve();
    };
    const abort = () => finish(new Error("The side chat was closed or switched"));
    const observer = new view.MutationObserver(() => insert());
    const timer = setTimeout(() => finish(new Error("The side chat input box is not ready yet; check the side chat and retry")), timeoutMs);
    const insert = () => {
      if (done || signal.aborted) return;
      const input = root.querySelector("textarea");
      if (!input || input.disabled || input.readOnly) return;
      const previous = draft.inserted;
      const replay = previous?.element === input;
      if (replay && !input.value.startsWith(previous.value)) {
        finish(new Error("The previously filled prompt was edited or not accepted; check the side chat; nothing was appended again"));
        return;
      }
      const value = replay ? input.value : input.value ? `${input.value}

${text2}` : text2;
      if (!replay) {
        const setter = Object.getOwnPropertyDescriptor(view.HTMLTextAreaElement.prototype, "value")?.set;
        if (!setter) {
          finish(new Error("The current side chat does not support filling in prompts automatically"));
          return;
        }
        draft.inserted = { element: input, value };
        setter.call(input, value);
        input.dispatchEvent(new view.Event("input", { bubbles: true }));
      }
      observer.disconnect();
      frame = view.requestAnimationFrame(() => {
        if (signal.aborted || done) return;
        if (!input.value.startsWith(value)) {
          finish(new Error("The side chat did not accept the prompt or the draft was edited; check the input box"));
          return;
        }
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        finish();
      });
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "readonly"] });
    insert();
  });
}

// src/client/new-conversation-draft.ts
async function openNewConversationDraft(scope, cwd, text2) {
  const sessions = scope.sessions;
  const navigation = scope.uiWorkspace;
  const conversation = scope.get?.("conversation");
  if (!cwd) throw new Error("Missing project directory; cannot create the Git chat");
  if (typeof sessions?.create !== "function" || typeof sessions?.using !== "function" || typeof navigation?.openSession !== "function" || typeof conversation?.input?.for !== "function") {
    throw new Error("The current host does not support creating a new chat and filling in a draft; refresh the page or upgrade the host and try again");
  }
  const sessionId = await sessions.create({ cwd });
  if (typeof sessionId !== "string" || !sessionId) throw new Error("Failed to create a new chat: no session identifier was returned");
  try {
    await sessions.using(sessionId, { source: "plugin" }, async (reference) => {
      const context = reference.binding?.ctx ?? sessions.scope?.(sessionId);
      if (!context) throw new Error("The new chat is not ready yet; cannot fill in the prompt");
      const input = conversation.input.for(context);
      if (typeof input?.setDraft !== "function" || typeof input?.state?.getSnapshot !== "function") throw new Error("The new chat did not provide a draft interface");
      const draft = input.state.getSnapshot().draft || "";
      const next = draft ? `${draft}

${text2}` : text2;
      input.setDraft(next);
      if (input.state.getSnapshot().draft !== next) throw new Error("The new chat did not accept the prompt draft");
      await navigation.openSession(sessionId);
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`New conversation ${sessionId} was created, but filling in the draft or opening it failed: ${reason}. Open it in the session list to avoid creating it again.`);
  }
}

// src/client/sidechat-integration.tsx
var import_jsx_runtime18 = require("react/jsx-runtime");
var GIT_SIDECHAT_TYPE = "dsh-plugin-git:sidechat";
var bridges = /* @__PURE__ */ new WeakMap();
function installGitSidechat(sidebar, onReady) {
  const queues = /* @__PURE__ */ new Map();
  const listeners2 = /* @__PURE__ */ new Set();
  const emit = () => {
    for (const listener of [...listeners2]) listener();
  };
  const subscribe = (listener) => {
    listeners2.add(listener);
    return () => {
      listeners2.delete(listener);
    };
  };
  let unregister;
  let disposed = false;
  let installing = false;
  let original;
  let requestSequence = 0;
  function DraftedSidechat(props) {
    const root = (0, import_react18.useRef)(null);
    const sessionId = props.scope?.sessionId;
    const request = (0, import_react18.useSyncExternalStore)(subscribe, () => queues.get(sessionId)?.[0] ?? null, () => null);
    (0, import_react18.useEffect)(() => {
      if (!request || !root.current || !props.visible) return;
      const controller = new AbortController();
      pasteSidechatDraft(root.current, request, controller.signal).then(() => request.finish()).catch((error) => {
        if (!controller.signal.aborted) request.finish(error instanceof Error ? error : new Error(String(error)));
      });
      return () => controller.abort();
    }, [request, props.visible]);
    const Original = original?.component;
    return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "dsh-git-sidechat-root", ref: root, style: { height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }, children: Original && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Original, { ...props }) });
  }
  const failSession = (sessionId, message2) => {
    for (const request of [...queues.get(sessionId) ?? []]) request.finish(new Error(message2));
  };
  const sync = () => {
    if (disposed || installing || unregister) return;
    original = sidebar.getTab?.("sidechat");
    if (typeof original?.component !== "function") return;
    installing = true;
    try {
      unregister = sidebar.registerTab({
        id: GIT_SIDECHAT_TYPE,
        title: () => "Git side chat",
        description: () => "Git prompt draft, not sent automatically",
        icon: original.icon,
        hidden: true,
        single: true,
        component: DraftedSidechat,
        onClose: (tab, scope) => {
          failSession(scope.sessionId, "The side chat was closed; the prompt was not sent");
          original.onClose?.(tab, scope);
        }
      });
    } finally {
      installing = false;
    }
  };
  const unsubscribe = sidebar.subscribe(sync);
  sync();
  const record = {
    open(sessionId, cwd, text2) {
      if (!unregister || !sidebar.getTab?.(GIT_SIDECHAT_TYPE)) return Promise.reject(new Error("The side chat component is not ready yet"));
      if (sidebar.isTabEnabled?.("sidechat") === false || sidebar.isTabEnabled?.(GIT_SIDECHAT_TYPE) === false) return Promise.reject(new Error("The side chat is disabled in settings"));
      return new Promise((resolve, reject) => {
        let completed = false;
        const timer = setTimeout(() => request.finish(new Error("Timed out opening the side chat or filling in the prompt; check the side chat and retry")), 15e3);
        const request = {
          id: globalThis.crypto?.randomUUID?.() ?? `git-draft-${Date.now()}-${++requestSequence}`,
          text: text2,
          sessionId,
          finish(error) {
            if (completed) return;
            completed = true;
            clearTimeout(timer);
            const queue2 = queues.get(sessionId);
            if (queue2) {
              const index = queue2.indexOf(request);
              if (index >= 0) queue2.splice(index, 1);
              if (!queue2.length) queues.delete(sessionId);
            }
            emit();
            error ? reject(error) : resolve();
          }
        };
        const queue = queues.get(sessionId) ?? [];
        queue.push(request);
        queues.set(sessionId, queue);
        try {
          sidebar.openTab({
            type: GIT_SIDECHAT_TYPE,
            id: GIT_SIDECHAT_TYPE,
            title: "Git side chat",
            meta: { autoCreate: true },
            target: "right",
            reveal: true
          }, { sessionId, cwd });
          emit();
        } catch (error) {
          request.finish(error instanceof Error ? error : new Error(String(error)));
        }
      });
    }
  };
  bridges.set(sidebar, record);
  onReady?.(record.open);
  return () => {
    onReady?.(void 0);
    disposed = true;
    unsubscribe();
    if (bridges.get(sidebar) === record) bridges.delete(sidebar);
    for (const sessionId of [...queues.keys()]) failSession(sessionId, "The Git side chat integration was unmounted");
    unregister?.();
    listeners2.clear();
  };
}
function createGitSidechatOpener(scope, resolveOpen) {
  const openDestination = async (sessionId, cwd, text2) => {
    if (!sessionId || !cwd) throw new Error("Please select a project directory for the current session first");
    const sidebar = scope.get?.("betterSidebar");
    const open = resolveOpen ? resolveOpen() : sidebar ? bridges.get(sidebar)?.open : void 0;
    const available = sidebar && typeof sidebar.getTab?.("sidechat")?.component === "function" && sidebar.isTabEnabled?.("sidechat") !== false && sidebar.isTabEnabled?.(GIT_SIDECHAT_TYPE) !== false && open;
    if (!available) {
      await openNewConversationDraft(scope, cwd, text2);
      return "conversation";
    }
    await open(sessionId, cwd, text2);
    return "sidechat";
  };
  const inFlight = /* @__PURE__ */ new Map();
  return (sessionId, cwd, text2) => {
    const key = JSON.stringify([sessionId, cwd, text2]);
    const existing = inFlight.get(key);
    if (existing) return existing;
    const pending = openDestination(sessionId, cwd, text2).finally(() => {
      if (inFlight.get(key) === pending) inFlight.delete(key);
    });
    inFlight.set(key, pending);
    return pending;
  };
}

// src/client/index.tsx
var import_jsx_runtime19 = require("react/jsx-runtime");
var inject = ["slots", "sessions", "workspaces", "uiWorkspace"];
function SessionHeaderGitControls(props) {
  const blank = props.useSession ? props.useSession((session) => session?.blank) : false;
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: "dsh-git-header-controls", children: !blank && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(BranchChip, { ...props, mode: "header" }) });
}
function apply(ctx) {
  ctx.effect(() => {
    injectStyles();
    reportClientState();
    return disposeStyles;
  }, "dsh-plugin-git: styles");
  ctx.inject(["slots", "sessions", "workspaces", "uiWorkspace"], (scope) => {
    let openSidechat;
    const sharedProps = {
      gitSessionsSource: scope.sessions.list,
      gitWorkspacesSource: scope.workspaces.list,
      onOpenWorktree: createWorktreeOpener(scope),
      onOpenGitPanel: createGitPanelOpener(scope),
      onOpenGitSidechat: createGitSidechatOpener(scope, () => openSidechat)
    };
    scope.effect(() => installGitConversationView(scope, { Page: GitWorkbenchPage, Bridge: GitSessionBridge }, sharedProps), "dsh-plugin-git: conversation workbench");
    scope.inject(["betterSidebar"], (sideCtx) => {
      sideCtx.effect(() => installGitSidechat(sideCtx.betterSidebar, (open) => {
        openSidechat = open;
      }), "dsh-plugin-git: side conversation drafts");
    });
    scope.slots.inject("conversation.hero.agentPreset", () => installHeroControls(scope.slots, (Original) => {
      return function InlineHeroGitControls(props) {
        return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "dsh-git-hero-controls", children: [
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Original, { ...props }),
          props.sessionId && props.renderSlot(GIT_SESSION_BRIDGE_SLOT, {}),
          props.sessionId && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(BranchChip, { ...props, ...sharedProps })
        ] });
      };
    }, { [GIT_SESSION_BRIDGE_SLOT]: { kind: "single", scope: "session" } }));
    scope.slots.inject("conversation.session.header.utilities", () => scope.slots.register({
      id: "dsh-plugin-git",
      name: "conversation.session.header.utilities",
      order: 15,
      inject: () => sharedProps
    }, SessionHeaderGitControls));
  });
}

    return module.exports;
  }
});
//# sourceMappingURL=client.js.map
