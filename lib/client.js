window.__ModuleLoader__.load({
  id: "dsh-plugin-git",
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

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  BranchChip: () => BranchChip,
  ChangesTab: () => ChangesTab,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react11 = __toESM(require("react"), 1);

// src/client/chips/BranchChip.tsx
var import_react4 = require("react");

// src/client/api.ts
function getEndpointUrl(endpoint) {
  return `/dsh-git/${endpoint.replace(/^\/+/, "")}`;
}
function errorMessage(error) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Git \u8BF7\u6C42\u5931\u8D25";
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
    throw new Error(`HTTP ${res.status}: ${res.statusText || "\u670D\u52A1\u5668\u8FD4\u56DE\u4E86\u65E0\u6548\u54CD\u5E94"}`);
  }
  if (!res.ok || json?.ok === false) {
    const error = new Error(json?.error ? errorMessage(json.error) : `HTTP ${res.status}: ${res.statusText}`);
    if (json?.error?.code) Object.assign(error, { code: json.error.code });
    throw error;
  }
  if (json === null || typeof json !== "object") throw new Error("Git \u670D\u52A1\u5668\u8FD4\u56DE\u4E86\u65E0\u6548\u54CD\u5E94");
  return json.value !== void 0 ? json.value : json;
}
var gitApi = {
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
  getDiff(path, base, target, signal) {
    return postJson("diff", { path, base, target }, signal);
  },
  getWorktrees(path, signal) {
    return postJson("worktrees", { path }, signal);
  },
  createWorktree(path, name, base) {
    return postJson("create-worktree", { path, name, base });
  },
  removeWorktree(path, worktreePath) {
    return postJson("remove-worktree", { path, worktreePath });
  },
  getLog(path, limit = 50, signal) {
    return postJson("log", { path, limit }, signal);
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
        onError?.(new Error("Git \u72B6\u6001\u66F4\u65B0\u5931\u8D25"));
      }
    });
    source.onerror = () => onError?.(new Error("Git \u5B9E\u65F6\u8FDE\u63A5\u4E2D\u65AD\uFF0C\u6B63\u5728\u91CD\u8FDE"));
    return () => source.close();
  }
};

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

// src/client/hooks/use-git-status.ts
var import_react = require("react");

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
var import_jsx_runtime2 = require("react/jsx-runtime");
function BranchPopover({
  view,
  onSwitch,
  onCreateBranch,
  onOpenGraph,
  onCreateWorktree,
  onManageWorktrees,
  onClose
}) {
  const restoreFocus = (0, import_react2.useRef)(typeof document === "undefined" ? null : document.activeElement);
  (0, import_react2.useEffect)(() => () => {
    if (restoreFocus.current?.isConnected) restoreFocus.current.focus();
  }, []);
  const [query, setQuery] = (0, import_react2.useState)("");
  const [switching, setSwitching] = (0, import_react2.useState)(null);
  const [error, setError] = (0, import_react2.useState)(null);
  const filtered = (0, import_react2.useMemo)(() => {
    const q = query.trim().toLowerCase();
    if (!q) return view.branches;
    return view.branches.filter((b) => b.name.toLowerCase().includes(q));
  }, [view.branches, query]);
  const handleSwitch = async (branchName) => {
    if (branchName === view.current || switching) return;
    setSwitching(branchName);
    setError(null);
    try {
      await onSwitch(branchName);
      onClose();
    } catch (err) {
      setError(err?.message || "\u5207\u6362\u5206\u652F\u5931\u8D25");
    } finally {
      setSwitching(null);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-git-popover-backdrop", onClick: () => {
      if (!switching) onClose();
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-git-popover", role: "dialog", "aria-label": "Git \u5206\u652F", "aria-busy": !!switching, onKeyDown: (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (!switching) onClose();
      }
    }, onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-git-search-box", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconSearch, { size: 14 }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "input",
          {
            className: "dsh-git-search-input",
            placeholder: "\u641C\u7D22\u5206\u652F",
            value: query,
            onChange: (e) => setQuery(e.target.value),
            autoFocus: true
          }
        )
      ] }),
      view.dirtyFiles > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-git-dirty-warning", children: [
        "\u672A\u63D0\u4EA4\u7684\u66F4\u6539: ",
        view.dirtyFiles,
        " \u4E2A\u6587\u4EF6"
      ] }),
      error && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { role: "alert", className: "dsh-git-error", style: { fontSize: 12, padding: "4px 12px" }, children: error }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-git-branch-list", children: filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { padding: "16px 12px", textAlign: "center", color: "var(--dsw-alias-label-secondary)", fontSize: 13 }, children: "\u672A\u5339\u914D\u5230\u5206\u652F" }) : filtered.map((b) => {
        const isCur = b.name === view.current;
        const isSw = switching === b.name;
        return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "button",
          {
            type: "button",
            className: `dsh-git-branch-item ${isCur ? "dsh-git-branch-item-active" : ""}`,
            onClick: () => handleSwitch(b.name),
            disabled: switching !== null,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-git-branch-item-left", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconBranch, { size: 14, className: isCur ? "text-primary" : "" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { title: b.name, children: b.name })
              ] }),
              isCur && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconCheck, { size: 14 }),
              isSw && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontSize: 11, color: "var(--dsw-alias-label-secondary)" }, children: "\u5207\u6362\u4E2D..." })
            ]
          },
          b.name
        );
      }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-git-footer", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "dsh-git-footer-btn", disabled: !!switching, onClick: onCreateBranch, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconBranchPlus, { size: 17 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u521B\u5EFA\u5E76\u68C0\u51FA\u65B0\u5206\u652F\u2026" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "dsh-git-footer-btn", disabled: !!switching, onClick: onOpenGraph, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconHistory, { size: 17 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u63D0\u4EA4\u8BB0\u5F55" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "dsh-git-footer-btn", disabled: !!switching, onClick: onCreateWorktree, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconFolderTree, { size: 17 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u521B\u5EFA\u5E76\u6253\u5F00 worktree..." })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "dsh-git-footer-btn", disabled: !!switching, onClick: onManageWorktrees, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconFolderTree, { size: 17 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u7BA1\u7406 worktree..." })
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
      if (!onOpenGitPanel) throw new Error("\u53F3\u4FA7 Git \u9762\u677F\u5C1A\u672A\u5C31\u7EEA");
      await onOpenGitPanel(view, { cwd, sessionId });
    } catch (error2) {
      setBranchError(error2 instanceof Error ? error2.message : String(error2));
    }
  };
  if (loading && !status && !error) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-git-muted dsh-git-loading", role: "status", children: "\u52A0\u8F7D\u4E2D\u2026" });
  if (!status || !isGit) return error ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dsh-git-error", role: "alert", children: [
    error,
    " ",
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", onClick: reload, children: "\u91CD\u8BD5" })
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
        title: `\u5F53\u524D\u5206\u652F: ${status.branch}${status.dirtyFiles > 0 ? ` (${status.dirtyFiles} \u4E2A\u4FEE\u6539\u6587\u4EF6)` : ""}`,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconBranch, { size: 16 }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: status.branch || "HEAD" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconChevronDown, { size: 12 })
        ]
      }
    ),
    (branchError || error) && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-git-error", role: "alert", children: branchError || error }),
    open && branchesView && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      BranchPopover,
      {
        view: branchesView,
        onSwitch: async (target) => {
          const result = await gitApi.switchBranch(cwd, target);
          if (!result.ok) throw new Error(result.error?.message || "\u5207\u6362\u5206\u652F\u5931\u8D25");
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
var import_react5 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
function ChangesLoading({ repository = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-changes-loading", role: "status", "aria-live": "polite", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-loading-icon", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconRefresh, { size: 20, className: "dsh-git-spin" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: repository ? "\u6B63\u5728\u52A0\u8F7D\u4ED3\u5E93" : "\u6B63\u5728\u8BFB\u53D6\u6587\u4EF6\u5DEE\u5F02" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: repository ? "\u5206\u652F\u548C\u6587\u4EF6\u53D8\u66F4\u5373\u5C06\u663E\u793A\u5728\u8FD9\u91CC" : "\u6B63\u5728\u6574\u7406\u53D8\u66F4\u6587\u4EF6\u4E0E\u4EE3\u7801\u5BF9\u6BD4" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-loading-preview", "aria-hidden": "true", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", {}),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", {}),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", {})
    ] })
  ] });
}
function ChangesTab(props) {
  const cwd = useWorkspaceCwd(props);
  const { status, isGit, loading: statusLoading, error: statusError, reload: reloadStatus } = useGitStatus(cwd);
  const [selectedFile, setSelectedFile] = (0, import_react5.useState)(null);
  const [compareTarget, setCompareTarget] = (0, import_react5.useState)("working-head");
  const [compareDropdownOpen, setCompareDropdownOpen] = (0, import_react5.useState)(false);
  const [refresh, setRefresh] = (0, import_react5.useState)(0);
  const branch = status?.branch;
  const head = status?.head;
  const revision = status?.revision;
  const upstream = status?.upstream;
  const dirtyFiles = status?.dirtyFiles;
  const requestKey = JSON.stringify([cwd, isGit, compareTarget, branch, head, revision, upstream, dirtyFiles, refresh]);
  const [result, setResult] = (0, import_react5.useState)(null);
  const current = result?.key === requestKey ? result : null;
  const diffView = current?.view ?? null;
  const loadingDiff = !!cwd && isGit && (!current || current.loading);
  const diffError = current?.error;
  (0, import_react5.useEffect)(() => {
    setSelectedFile(null);
    setCompareDropdownOpen(false);
  }, [cwd]);
  (0, import_react5.useEffect)(() => {
    const controller = new AbortController();
    if (!cwd || !isGit) {
      setResult(null);
      return () => controller.abort();
    }
    if (compareTarget === "branch-upstream" && !upstream) {
      setResult({ key: requestKey, view: null, error: "\u5F53\u524D\u5206\u652F\u672A\u914D\u7F6E\u4E0A\u6E38\uFF0C\u65E0\u6CD5\u5BF9\u6BD4\u3002", loading: false });
      return () => controller.abort();
    }
    setResult({ key: requestKey, view: null, error: null, loading: true });
    const base = compareTarget === "branch-upstream" ? upstream : "HEAD";
    const target = compareTarget === "branch-upstream" ? "HEAD" : void 0;
    gitApi.getDiff(cwd, base, target, controller.signal).then((view) => {
      if (controller.signal.aborted) return;
      setResult({ key: requestKey, view, error: null, loading: false });
      setSelectedFile((previous) => view.files.some((file) => file.path === previous) ? previous : view.files[0]?.path ?? null);
    }).catch((error) => {
      if (!controller.signal.aborted) setResult({ key: requestKey, view: null, error: error instanceof Error ? error.message : String(error), loading: false });
    });
    return () => controller.abort();
  }, [cwd, isGit, compareTarget, branch, head, revision, upstream, dirtyFiles, refresh, requestKey]);
  const activeFile = (0, import_react5.useMemo)(() => {
    if (!diffView || !selectedFile) return diffView?.files[0] || null;
    return diffView.files.find((f) => f.path === selectedFile) || diffView.files[0] || null;
  }, [diffView, selectedFile]);
  if (statusLoading && !status && !statusError) return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-changes-panel", "aria-busy": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-toolbar-skeleton", "aria-hidden": "true", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", {}),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", {})
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ChangesLoading, { repository: true })
  ] });
  if (statusError && !status) return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-changes-panel", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-empty-state", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-state-icon", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconDiff, { size: 24 }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: "\u6682\u65F6\u65E0\u6CD5\u52A0\u8F7D\u4ED3\u5E93" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dsh-git-state-error", role: "alert", children: statusError }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: reloadStatus, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconRefresh, { size: 14 }),
      "\u91CD\u65B0\u52A0\u8F7D"
    ] })
  ] }) });
  if (!statusLoading && !isGit) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-changes-panel", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-empty-state", children: [
      statusError && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-state-error", role: "alert", children: statusError }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-state-icon", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconDiff, { size: 24 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: "\u5F53\u524D\u76EE\u5F55\u4E0D\u662F Git \u4ED3\u5E93" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { children: [
        "\u5728\u9879\u76EE\u4E2D\u6267\u884C ",
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { children: "git init" }),
        " \u540E\uFF0C\u5373\u53EF\u67E5\u770B\u5206\u652F\u548C\u6587\u4EF6\u5DEE\u5F02\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          type: "button",
          className: "dsh-git-btn dsh-git-btn-primary",
          onClick: () => {
            reloadStatus();
          },
          children: "\u91CD\u65B0\u52A0\u8F7D"
        }
      )
    ] }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-changes-panel", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-changes-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-repo-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dsh-git-current-branch", title: status?.branch || "HEAD", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconBranch, { size: 15 }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: status?.branch || "HEAD" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-change-summary", children: [
          diffView && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-git-file-count", children: diffView.files.length ? `${diffView.files.length} \u4E2A\u6587\u4EF6` : "\u65E0\u53D8\u66F4" }),
          !!diffView?.files.length && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-stat-badge", "aria-label": `\u65B0\u589E ${diffView.totalInsertions} \u884C\uFF0C\u5220\u9664 ${diffView.totalDeletions} \u884C`, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dsh-git-ins", children: [
              "+",
              diffView.totalInsertions
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dsh-git-del", children: [
              "\u2212",
              diffView.totalDeletions
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dsh-git-refresh-btn", "aria-label": "\u5237\u65B0\u53D8\u66F4", title: "\u5237\u65B0\u53D8\u66F4", disabled: loadingDiff || statusLoading, onClick: () => {
          reloadStatus();
          setRefresh((value) => value + 1);
        }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconRefresh, { size: 15, className: loadingDiff || statusLoading ? "dsh-git-spin" : "" }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-compare-control", onKeyDown: (event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setCompareDropdownOpen(false);
          event.currentTarget.querySelector(".dsh-git-compare-trigger")?.focus();
        }
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { type: "button", className: `dsh-git-compare-trigger ${compareDropdownOpen ? "dsh-git-compare-trigger-open" : ""}`, onClick: () => setCompareDropdownOpen(!compareDropdownOpen), title: "\u5207\u6362\u5BF9\u6BD4\u57FA\u51C6", "aria-expanded": compareDropdownOpen, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconDiff, { size: 15 }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-git-compare-label", children: compareTarget === "working-head" ? "\u5DE5\u4F5C\u533A" : status?.branch || "HEAD" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-git-compare-arrow", "aria-hidden": "true", children: "\u2192" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-git-compare-base", children: compareTarget === "working-head" ? "HEAD" : upstream || "\u672A\u914D\u7F6E\u4E0A\u6E38" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconChevronDown, { size: 13 })
        ] }),
        compareDropdownOpen && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-compare-backdrop", onClick: () => setCompareDropdownOpen(false) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-compare-menu", role: "group", "aria-label": "\u5BF9\u6BD4\u57FA\u51C6", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-compare-menu-heading", children: "\u5BF9\u6BD4\u57FA\u51C6" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { type: "button", className: "dsh-git-compare-option", "aria-pressed": compareTarget === "working-head", onClick: (event) => {
              setCompareTarget("working-head");
              setCompareDropdownOpen(false);
              event.currentTarget.closest(".dsh-git-compare-control")?.querySelector(".dsh-git-compare-trigger")?.focus();
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-git-option-icon", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconDiff, { size: 17 }) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dsh-git-option-copy", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: "\u672A\u63D0\u4EA4\u7684\u66F4\u6539" }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "\u5DE5\u4F5C\u533A\u4E0E HEAD \u5BF9\u6BD4" })
              ] }),
              compareTarget === "working-head" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconCheck, { size: 16 })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { type: "button", className: "dsh-git-compare-option", disabled: !upstream, "aria-pressed": compareTarget === "branch-upstream", onClick: (event) => {
              setCompareTarget("branch-upstream");
              setCompareDropdownOpen(false);
              event.currentTarget.closest(".dsh-git-compare-control")?.querySelector(".dsh-git-compare-trigger")?.focus();
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-git-option-icon", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconBranch, { size: 17 }) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dsh-git-option-copy", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("strong", { children: [
                  "\u4E0E\u4E0A\u6E38\u5206\u652F\u5BF9\u6BD4",
                  !upstream && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("small", { children: "\u672A\u914D\u7F6E" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: upstream ? `${status?.branch || "HEAD"} \u2192 ${upstream}` : "\u914D\u7F6E\u4E0A\u6E38\u5206\u652F\u540E\u53EF\u7528" })
              ] }),
              compareTarget === "branch-upstream" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconCheck, { size: 16 })
            ] })
          ] })
        ] })
      ] })
    ] }),
    statusError && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-changes-notice dsh-git-error", role: "alert", children: statusError }),
    loadingDiff ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ChangesLoading, {}) : diffError ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-empty-state", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-state-icon", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconDiff, { size: 24 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: "\u65E0\u6CD5\u8BFB\u53D6\u5DEE\u5F02" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dsh-git-state-error", role: "alert", children: diffError }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: () => {
        reloadStatus();
        setRefresh((value) => value + 1);
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconRefresh, { size: 14 }),
        "\u91CD\u8BD5"
      ] })
    ] }) : diffView && diffView.files.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-empty-state", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-state-icon dsh-git-state-clean", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconCheck, { size: 26 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: compareTarget === "working-head" ? "\u5DE5\u4F5C\u533A\u5F88\u5E72\u51C0" : "\u4E0E\u4E0A\u6E38\u5206\u652F\u4E00\u81F4" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: compareTarget === "working-head" ? "\u6682\u65E0\u672A\u63D0\u4EA4\u7684\u66F4\u6539\uFF0C\u65B0\u7684\u53D8\u66F4\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002" : "\u5F53\u524D\u5206\u652F\u4E0E\u4E0A\u6E38\u4E4B\u95F4\u6CA1\u6709\u6587\u4EF6\u5DEE\u5F02\u3002" })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-changes-body", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-file-list", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-file-list-heading", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "\u53D8\u66F4\u6587\u4EF6" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: diffView?.files.length || 0 })
        ] }),
        !diffView || diffView.files.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { padding: "20px 8px", textAlign: "center", color: "var(--dsw-alias-label-secondary)", fontSize: 12 }, children: "\u5F53\u524D\u65E0\u53EF\u5BF9\u6BD4\u7684\u66F4\u6539" }) : diffView.files.map((file) => {
          const isSelected = file.path === activeFile?.path;
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
            "button",
            {
              type: "button",
              "aria-pressed": isSelected,
              className: `dsh-git-file-item ${isSelected ? "dsh-git-file-item-active" : ""}`,
              onClick: () => setSelectedFile(file.path),
              title: file.path,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconFile, { size: 13 }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: file.path.split("/").pop() || file.path })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 4, fontFamily: "monospace", fontSize: 11 }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dsh-git-ins", children: [
                    "+",
                    file.insertions
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dsh-git-del", children: [
                    "-",
                    file.deletions
                  ] })
                ] })
              ]
            },
            file.path
          );
        })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-diff-view", children: activeFile ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-diff-header", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconFile, { size: 14 }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontWeight: 600 }, children: activeFile.path }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { fontSize: 11 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dsh-git-ins", children: [
              "+",
              activeFile.insertions
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dsh-git-del", children: [
              " -",
              activeFile.deletions
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-diff-lines", children: activeFile.hunks.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { padding: 20, color: "var(--dsw-alias-label-secondary)", fontStyle: "italic" }, children: activeFile.status === "deleted" ? "\u6587\u4EF6\u5DF2\u88AB\u5220\u9664" : "\u6587\u4EF6\u672A\u5305\u542B\u5DEE\u5F02\u884C\u6216\u4E3A\u4E8C\u8FDB\u5236\u6587\u4EF6" }) : activeFile.hunks.map((hunk, hIdx) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-hunk-header", children: hunk.header }),
          hunk.lines.map((line, lIdx) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
            "div",
            {
              className: `dsh-git-diff-row ${line.type === "add" ? "dsh-git-row-add" : line.type === "del" ? "dsh-git-row-del" : ""}`,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-line-num", children: line.oldNum ?? "" }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-line-num", children: line.newNum ?? "" }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-line-content", children: [
                  line.type === "add" ? "+ " : line.type === "del" ? "- " : "  ",
                  line.content
                ] })
              ]
            },
            lIdx
          ))
        ] }, hIdx)) })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--dsw-alias-label-secondary)", fontSize: 13 }, children: "\u9009\u62E9\u5DE6\u4FA7\u6587\u4EF6\u4EE5\u67E5\u770B\u4EE3\u7801\u5DEE\u5F02" }) })
    ] })
  ] });
}

// src/client/styles.ts
var STYLES = `
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
.dsh-git-search-box { display: flex; align-items: center; gap: 8px; padding: 8px 12px; margin: 8px 10px 4px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; }
.dsh-git-search-input { border: none; outline: none; background: transparent; width: 100%; font-size: 13px; color: var(--dsw-alias-label-primary); }
.dsh-git-dirty-warning { padding: 6px 14px; font-size: 12px; color: var(--dsw-alias-state-warn-primary); background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent); margin: 4px 10px; border-radius: 6px; }
.dsh-git-branch-list { flex: 1; overflow-y: auto; max-height: 240px; padding: 4px 6px; }
.dsh-git-branch-item { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 7px 10px; border-radius: 6px; border: none; background: transparent; color: var(--dsw-alias-label-primary); font-size: 13px; text-align: left; cursor: pointer; }
.dsh-git-branch-item-active { font-weight: 600; color: var(--dsw-alias-brand-primary); }
.dsh-git-branch-item-left { display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-git-footer { border-top: 1px solid var(--dsw-alias-border-l1); padding: 4px 6px; background: var(--dsw-alias-bg-layer-2); }
.dsh-git-footer-btn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border-radius: 6px; border: none; background: transparent; color: var(--dsw-alias-label-primary); font-size: 12.5px; text-align: left; cursor: pointer; }
.dsh-git-changes-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; min-width: 0; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-family: inherit; font-size: 13px; line-height: 1.5; overflow: hidden; }
.dsh-git-changes-panel *, .dsh-git-changes-panel *::before, .dsh-git-changes-panel *::after { box-sizing: border-box; }
.dsh-git-changes-panel button { font-family: inherit; }
.dsh-git-changes-panel svg { flex-shrink: 0; }
.dsh-git-changes-header { display: flex; flex-direction: column; padding: 12px 16px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); gap: 10px; flex-shrink: 0; }
.dsh-git-repo-row { display: flex; align-items: center; gap: 12px; min-width: 0; min-height: 28px; }
.dsh-git-current-branch { display: inline-flex; align-items: center; gap: 7px; min-width: 0; font-size: 13px; font-weight: 600; }
.dsh-git-current-branch > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-git-current-branch > svg { color: var(--dsw-alias-label-secondary); }
.dsh-git-change-summary { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-left: auto; flex-shrink: 0; }
.dsh-git-file-count { color: var(--dsw-alias-label-secondary); white-space: nowrap; font-size: 11px; }
.dsh-git-stat-badge { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 500; font-family: Consolas, monospace; font-variant-numeric: tabular-nums; }
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
.dsh-git-compare-base { font-family: Consolas, monospace; font-size: 11px; color: var(--dsw-alias-label-secondary); }
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
.dsh-git-diff-header > div { min-width: 0; flex-wrap: wrap; }
.dsh-git-file-item-active { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); color: var(--dsw-alias-brand-primary); font-weight: 500; }
.dsh-git-diff-view { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--dsw-alias-bg-base); }
.dsh-git-diff-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); font-size: 12.5px; font-family: monospace; overflow-wrap: anywhere; }
.dsh-git-diff-lines { flex: 1; overflow: auto; font-family: Consolas, monospace; font-size: 12px; line-height: 1.6; }
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
.dsh-git-btn { padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; }
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
.dsh-git-commit-row { flex-wrap: wrap; font-size: 13px; }
.dsh-git-ref { font-size: 11px; padding: 1px 6px; border-radius: 4px; color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); }
.dsh-git-header-controls, .dsh-git-hero-controls { display: inline-flex; align-items: center; gap: 8px; }
.dsh-git-hero-controls { flex-wrap: nowrap; min-width: 0; }
.dsh-git-branch-control { display: inline-flex; align-items: center; position: relative; flex-shrink: 0; }
.dsh-git-loading { font-size: 12px; white-space: nowrap; }
.dsh-git-chip { gap: 7px; height: 30px; background: transparent; border-color: var(--dsw-alias-border-l1); }
.dsh-git-selector-btn svg, .dsh-git-chip svg, .dsh-git-footer-btn svg, .dsh-git-branch-item svg { flex-shrink: 0; }
.dsh-git-footer-btn { gap: 10px; min-height: 36px; padding: 8px 10px; font-size: 13px; }
.dsh-git-footer-btn svg { color: var(--dsw-alias-label-secondary); }
.dsh-git-sidebar-content { height: 100%; min-height: 0; min-width: 0; overflow: hidden; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); container-type: inline-size; }
.dsh-git-panel-form { display: flex; flex-direction: column; height: 100%; min-height: 0; width: 100%; }
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
.dsh-git-history-list { min-height: 0; overflow: auto; flex: 1; padding: 0 16px; }
.dsh-git-history-item { padding: 16px 0; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dsh-git-history-subject { font-size: 13px; font-weight: 500; line-height: 1.6; overflow-wrap: anywhere; }
.dsh-git-history-refs { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.dsh-git-history-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 8px; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dsh-git-history-meta code { color: var(--dsw-alias-brand-primary); }
.dsh-git-history-meta time { margin-left: auto; }
@container (max-width: 600px) {
  .dsh-git-changes-body { flex-direction: column; }
  .dsh-git-file-list { width: auto; max-width: none; max-height: 30%; border-right: none; border-bottom: 1px solid var(--dsw-alias-border-l1); }
  .dsh-git-diff-view { min-height: 0; }
  .dsh-git-changes-header { padding: 10px 12px; }
}
`;
function disposeStyles() {
  if (typeof document !== "undefined") document.getElementById("dsh-plugin-git-styles")?.remove();
}
function injectStyles() {
  if (typeof document === "undefined") return;
  const id = "dsh-plugin-git-styles";
  if (document.getElementById(id)) return;
  const styleEl = document.createElement("style");
  styleEl.id = id;
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);
}

// src/client/workspace-actions.ts
function createWorktreeOpener(scope) {
  return async (path) => {
    if (!scope.workspaces?.create || !scope.uiWorkspace?.openWorkspace) {
      throw new Error("\u5F53\u524D\u73AF\u5883\u65E0\u6CD5\u6253\u5F00 Worktree \u4F1A\u8BDD\uFF0C\u8BF7\u624B\u52A8\u6253\u5F00\u8BE5\u76EE\u5F55");
    }
    const workspace = await scope.workspaces.create({ path });
    if (!workspace?.workspaceId) throw new Error("\u521B\u5EFA\u5DE5\u4F5C\u533A\u5931\u8D25\uFF1A\u672A\u8FD4\u56DE\u5DE5\u4F5C\u533A\u6807\u8BC6");
    await scope.uiWorkspace.openWorkspace(workspace.workspaceId);
  };
}

// src/client/sidebar-actions.ts
var GIT_PANEL_TYPES = {
  changes: "git-changes",
  history: "git-history",
  "create-branch": "git-create-branch",
  "create-worktree": "git-create-worktree",
  worktrees: "git-worktrees"
};
var GIT_PANEL_TITLES = {
  changes: "\u53D8\u66F4",
  history: "\u63D0\u4EA4\u8BB0\u5F55",
  "create-branch": "\u521B\u5EFA\u5206\u652F",
  "create-worktree": "\u521B\u5EFA\u5DE5\u4F5C\u6811",
  worktrees: "\u5DE5\u4F5C\u6811"
};
function createGitPanelOpener(scope) {
  return async (view, target) => {
    const type = GIT_PANEL_TYPES[view];
    if (!type) throw new Error("\u672A\u77E5\u7684 Git \u9762\u677F");
    if (!target.cwd) throw new Error("\u8BF7\u5148\u9009\u62E9\u9879\u76EE\u76EE\u5F55");
    const sidebar = scope.get?.("betterSidebar") || scope.betterSidebar;
    if (!sidebar?.openTab || !sidebar.getTab?.(type)) throw new Error("\u53F3\u4FA7 Git \u9762\u677F\u5C1A\u672A\u5C31\u7EEA\uFF0C\u8BF7\u542F\u7528\u4FA7\u8FB9\u680F\u63D2\u4EF6\u540E\u91CD\u8BD5");
    if (sidebar.isTabEnabled && !sidebar.isTabEnabled(type)) throw new Error("\u6B64 Git \u9762\u677F\u5DF2\u5728\u4FA7\u8FB9\u680F\u8BBE\u7F6E\u4E2D\u505C\u7528");
    let sessionId = target.sessionId;
    if (!sessionId) {
      const workspace = await scope.workspaces.create({ path: target.cwd });
      sessionId = await scope.uiWorkspace.connectWorkspace(workspace.workspaceId);
      await scope.uiWorkspace.openWorkspace(workspace.workspaceId);
    }
    sidebar.openTab({ type, id: type, path: target.cwd, title: GIT_PANEL_TITLES[view], target: "right", reveal: true }, { sessionId, cwd: target.cwd });
  };
}

// src/client/dialogs/GitGraphDialog.tsx
var import_react6 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
function GitGraphDialog({ path }) {
  const { status } = useGitStatus(path);
  const [commits, setCommits] = (0, import_react6.useState)([]);
  const [loading, setLoading] = (0, import_react6.useState)(true);
  const [error, setError] = (0, import_react6.useState)(null);
  const [refresh, setRefresh] = (0, import_react6.useState)(0);
  (0, import_react6.useEffect)(() => {
    const controller = new AbortController();
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
  }, [path, refresh, status?.head, status?.branch]);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: "dsh-git-history-panel", "aria-label": "\u63D0\u4EA4\u8BB0\u5F55", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dsh-git-changes-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dsh-git-panel-heading", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconHistory, { size: 17 }),
        "\u63D0\u4EA4\u8BB0\u5F55"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", "aria-label": "\u5237\u65B0\u63D0\u4EA4\u8BB0\u5F55", title: "\u5237\u65B0", className: "dsh-git-selector-btn", onClick: () => setRefresh((value) => value + 1), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconRefresh, { size: 16 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dsh-git-history-list", children: error ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dsh-git-error dsh-git-panel-message", role: "alert", children: [
      error,
      " ",
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dsh-git-selector-btn", onClick: () => setRefresh((value) => value + 1), children: "\u91CD\u8BD5" })
    ] }) : loading ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dsh-git-panel-message", role: "status", children: "\u52A0\u8F7D\u4E2D\u2026" }) : commits.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dsh-git-empty-state", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconHistory, { size: 40 }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: "\u6682\u65E0\u63D0\u4EA4\u8BB0\u5F55" })
    ] }) : commits.map((commit) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("article", { className: "dsh-git-history-item", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dsh-git-history-subject", children: commit.subject }),
      commit.refs.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dsh-git-history-refs", children: commit.refs.map((ref) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dsh-git-ref", children: ref }, ref)) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dsh-git-history-meta", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("code", { title: commit.hash, children: commit.shortHash }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: commit.author }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("time", { children: commit.date })
      ] })
    ] }, commit.hash)) })
  ] });
}

// src/client/dialogs/CreateBranchDialog.tsx
var import_react9 = require("react");

// src/client/dialogs/DialogShell.tsx
var import_react8 = require("react");

// src/client/panels/panel-context.ts
var import_react7 = require("react");
var GitPanelContext = (0, import_react7.createContext)(false);

// src/client/dialogs/DialogShell.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
function DialogShell({ title, onClose, busy = false, children, style }) {
  const inline = (0, import_react8.useContext)(GitPanelContext);
  const card = (0, import_react8.useRef)(null);
  const restoreFocus = (0, import_react8.useRef)(typeof document === "undefined" ? null : document.activeElement);
  const close = (0, import_react8.useRef)(onClose);
  close.current = onClose;
  const busyRef = (0, import_react8.useRef)(busy);
  busyRef.current = busy;
  (0, import_react8.useEffect)(() => {
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
  if (inline) return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("section", { ref: card, className: "dsh-git-panel-form", "aria-label": title, "aria-busy": busy, children });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dsh-git-modal-overlay", onClick: (event) => {
    if (event.target === event.currentTarget && !busy) onClose();
  }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { ref: card, className: "dsh-git-modal-card", role: "dialog", "aria-modal": "true", "aria-label": title, "aria-busy": busy, tabIndex: -1, style, children }) });
}

// src/client/dialogs/CreateBranchDialog.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
function CreateBranchDialog({ path, currentBranch, onClose, onSuccess }) {
  const [name, setName] = (0, import_react9.useState)("");
  const [base, setBase] = (0, import_react9.useState)(currentBranch);
  const [error, setError] = (0, import_react9.useState)(null);
  const [submitting, setSubmitting] = (0, import_react9.useState)(false);
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
        setError(res.error?.message || "\u521B\u5EFA\u5206\u652F\u5931\u8D25");
      }
    } catch (err) {
      setError(err?.message || "\u521B\u5EFA\u5206\u652F\u53D1\u751F\u9519\u8BEF");
    } finally {
      setSubmitting(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(DialogShell, { title: "\u521B\u5EFA\u5E76\u68C0\u51FA\u65B0\u5206\u652F", busy: submitting, onClose, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dsh-git-modal-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: "\u521B\u5EFA\u5E76\u68C0\u51FA\u65B0\u5206\u652F" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", "aria-label": "\u5173\u95ED", className: "dsh-git-icon-btn", disabled: submitting, onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconClose, { size: 16 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("form", { onSubmit: handleSubmit, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dsh-git-modal-body", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("label", { htmlFor: "dsh-git-branch-name", style: { display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }, children: "\u65B0\u5206\u652F\u540D\u79F0" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "input",
            {
              className: "dsh-git-input",
              id: "dsh-git-branch-name",
              disabled: submitting,
              placeholder: "\u4F8B\u5982\uFF1Afeature/awesome-ui",
              value: name,
              onChange: (e) => setName(e.target.value),
              autoFocus: true
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("label", { htmlFor: "dsh-git-branch-base", style: { display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }, children: "\u57FA\u4E8E\u5206\u652F / Commit (\u53EF\u9009)" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "input",
            {
              className: "dsh-git-input",
              id: "dsh-git-branch-base",
              disabled: submitting,
              placeholder: "\u9ED8\u8BA4\u4E3A\u5F53\u524D\u5206\u652F HEAD",
              value: base,
              onChange: (e) => setBase(e.target.value)
            }
          )
        ] }),
        error && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { role: "alert", className: "dsh-git-error", style: { fontSize: 12.5, padding: "6px 10px", borderRadius: 6 }, children: error })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dsh-git-modal-footer", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: submitting, onClick: onClose, children: "\u53D6\u6D88" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "button",
          {
            type: "submit",
            className: "dsh-git-btn dsh-git-btn-primary",
            disabled: submitting || !name.trim(),
            children: submitting ? "\u521B\u5EFA\u4E2D..." : "\u521B\u5EFA\u5E76\u68C0\u51FA"
          }
        )
      ] })
    ] })
  ] });
}

// src/client/dialogs/WorktreeDialogs.tsx
var import_react10 = require("react");
var import_jsx_runtime8 = require("react/jsx-runtime");
var message = (error) => error instanceof Error ? error.message : typeof error === "string" ? error : "\u64CD\u4F5C\u5931\u8D25";
function CreateWorktreeDialog({ path, currentBranch, onClose, onSuccess, onOpenWorktree }) {
  const [name, setName] = (0, import_react10.useState)("");
  const [base, setBase] = (0, import_react10.useState)(currentBranch);
  const [submitting, setSubmitting] = (0, import_react10.useState)(false);
  const [error, setError] = (0, import_react10.useState)(null);
  const [createdPath, setCreatedPath] = (0, import_react10.useState)(null);
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !createdPath && !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      let destination = createdPath;
      if (!destination) {
        const result = await gitApi.createWorktree(path, name.trim(), base.trim() || void 0);
        if (!result.ok || !result.path) throw new Error(message(result.error || "\u521B\u5EFA Worktree \u5931\u8D25"));
        destination = result.path;
        setCreatedPath(destination);
        onSuccess(destination);
      }
      if (onOpenWorktree) await onOpenWorktree(destination);
      onClose();
    } catch (error2) {
      setError(message(error2));
    } finally {
      setSubmitting(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(DialogShell, { title: "\u521B\u5EFA Worktree", onClose, busy: submitting, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-modal-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(IconWorktree, { size: 16 }),
        " \u521B\u5EFA Worktree"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", "aria-label": "\u5173\u95ED", className: "dsh-git-icon-btn", disabled: submitting, onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(IconClose, { size: 16 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("form", { onSubmit: handleSubmit, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-modal-body", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-muted", style: { fontSize: 13 }, children: [
          "\u72EC\u7ACB\u5DE5\u4F5C\u6811\u53EF\u907F\u514D\u5E76\u884C\u4EFB\u52A1\u76F8\u4E92\u8986\u76D6\u3002",
          onOpenWorktree ? "\u521B\u5EFA\u540E\u5C06\u5728\u5DE5\u4F5C\u533A\u4E2D\u6253\u5F00\u3002" : "\u5F53\u524D\u5165\u53E3\u4EC5\u521B\u5EFA\u5DE5\u4F5C\u6811\uFF0C\u4E0D\u81EA\u52A8\u521B\u5EFA\u4F1A\u8BDD\u3002"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("label", { children: [
          "Worktree \u4EFB\u52A1\u6807\u8BC6",
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { className: "dsh-git-input", value: name, onChange: (event) => setName(event.target.value), disabled: submitting || !!createdPath, placeholder: "\u4F8B\u5982 feature-login", autoFocus: true })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("label", { children: [
          "\u57FA\u7EBF\u5206\u652F",
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { className: "dsh-git-input", value: base, onChange: (event) => setBase(event.target.value), disabled: submitting || !!createdPath })
        ] }),
        createdPath && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { role: "status", children: [
          "\u5DF2\u521B\u5EFA\uFF1A",
          createdPath
        ] }),
        error && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-error", role: "alert", children: [
          error,
          createdPath ? "\uFF08\u5DE5\u4F5C\u6811\u5DF2\u4FDD\u7559\uFF0C\u53EF\u91CD\u8BD5\u6253\u5F00\uFF09" : ""
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-modal-footer", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: submitting, onClick: onClose, children: "\u5173\u95ED" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "submit", className: "dsh-git-btn dsh-git-btn-primary", disabled: submitting || !createdPath && !name.trim(), children: submitting ? "\u5904\u7406\u4E2D\u2026" : createdPath ? "\u91CD\u8BD5\u6253\u5F00\u5DE5\u4F5C\u533A" : onOpenWorktree ? "\u521B\u5EFA\u5E76\u6253\u5F00\u5DE5\u4F5C\u533A" : "\u521B\u5EFA\u5DE5\u4F5C\u6811" })
      ] })
    ] })
  ] });
}
function WorktreeManagerDialog({ path, onClose }) {
  const [list, setList] = (0, import_react10.useState)([]);
  const [loading, setLoading] = (0, import_react10.useState)(true);
  const [error, setError] = (0, import_react10.useState)(null);
  const [deleting, setDeleting] = (0, import_react10.useState)(null);
  const [pendingDelete, setPendingDelete] = (0, import_react10.useState)(null);
  const [refresh, setRefresh] = (0, import_react10.useState)(0);
  const alive = (0, import_react10.useRef)(true);
  (0, import_react10.useEffect)(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  (0, import_react10.useEffect)(() => {
    const controller = new AbortController();
    setList([]);
    setLoading(true);
    setError(null);
    gitApi.getWorktrees(path, controller.signal).then((result) => {
      if (!controller.signal.aborted) setList(result);
    }).catch((error2) => {
      if (!controller.signal.aborted) setError(message(error2));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [path, refresh]);
  const handleDelete = async (worktreePath) => {
    if (deleting) return;
    setDeleting(worktreePath);
    setError(null);
    try {
      const result = await gitApi.removeWorktree(path, worktreePath);
      if (!result.ok) throw new Error(message(result.error || "\u5220\u9664 Worktree \u5931\u8D25"));
      if (alive.current) {
        setPendingDelete(null);
        setRefresh((value) => value + 1);
      }
    } catch (error2) {
      if (alive.current) setError(message(error2));
    } finally {
      if (alive.current) setDeleting(null);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(DialogShell, { title: "\u7BA1\u7406 Git Worktrees", onClose, busy: !!deleting, style: { width: 640 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-modal-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(IconWorktree, { size: 16 }),
        " \u7BA1\u7406 Git Worktrees"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", "aria-label": "\u5173\u95ED", className: "dsh-git-icon-btn", disabled: !!deleting, onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(IconClose, { size: 16 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-modal-body", style: { maxHeight: 360, overflowY: "auto" }, children: [
      error && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-error", role: "alert", children: [
        error,
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: !!deleting, onClick: () => setRefresh((value) => value + 1), children: "\u91CD\u65B0\u52A0\u8F7D" })
      ] }),
      loading ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dsh-git-muted", role: "status", children: "\u52A0\u8F7D\u4E2D\u2026" }) : !error && list.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dsh-git-muted", children: "\u6682\u65E0 Worktree" }) : list.map((worktree) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-git-worktree-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { minWidth: 0, overflowWrap: "anywhere" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("strong", { children: worktree.branch || "HEAD" }),
          worktree.isCurrent && "\uFF08\u5F53\u524D\u68C0\u51FA\uFF09",
          worktree.locked && "\uFF08\u5DF2\u9501\u5B9A\uFF09",
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dsh-git-muted", style: { fontFamily: "monospace", fontSize: 12 }, children: worktree.path })
        ] }),
        !worktree.isCurrent && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: !!deleting || worktree.locked, onClick: () => setPendingDelete(worktree.path), children: deleting === worktree.path ? "\u5220\u9664\u4E2D\u2026" : "\u5220\u9664" })
      ] }, worktree.path)),
      pendingDelete && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { role: "group", "aria-label": "\u786E\u8BA4\u5220\u9664 Worktree", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("p", { children: [
          "\u786E\u5B9A\u5220\u9664 ",
          pendingDelete,
          "\uFF1F\u6709\u672A\u63D0\u4EA4\u66F4\u6539\u6216\u9501\u5B9A\u7684\u5DE5\u4F5C\u6811\u4E0D\u4F1A\u5F3A\u5236\u5220\u9664\u3002"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: !!deleting, onClick: () => setPendingDelete(null), children: "\u53D6\u6D88" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-primary", disabled: !!deleting, onClick: () => handleDelete(pendingDelete), children: "\u786E\u8BA4\u5220\u9664" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dsh-git-modal-footer", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", disabled: !!deleting, onClick: onClose, children: "\u5B8C\u6210" }) })
  ] });
}

// src/client/panels/GitSidebarPanel.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
function RepositoryForm({ view, cwd, onClose, onOpenWorktree }) {
  const { status, loading, error, reload } = useGitStatus(cwd);
  if (loading && !status) return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "dsh-git-panel-message", role: "status", children: "\u52A0\u8F7D\u4E2D\u2026" });
  if (error && !status) return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "dsh-git-panel-message dsh-git-error", role: "alert", children: [
    error,
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("button", { type: "button", className: "dsh-git-selector-btn", onClick: reload, children: "\u91CD\u8BD5" })
  ] });
  if (!status?.isGit) return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "dsh-git-panel-message", children: "\u5F53\u524D\u76EE\u5F55\u4E0D\u662F Git \u4ED3\u5E93" });
  if (view === "create-branch") return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CreateBranchDialog, { path: cwd, currentBranch: status.branch, onClose, onSuccess: reload });
  if (view === "create-worktree") return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CreateWorktreeDialog, { path: cwd, currentBranch: status.branch, onClose, onSuccess: reload, onOpenWorktree });
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(WorktreeManagerDialog, { path: cwd, onClose });
}
function GitSidebarPanel(props) {
  const cwd = props.tab?.path || props.scope?.repoRoot || props.scope?.cwd || props.cwd || "";
  const sessionId = props.scope?.sessionId || props.sessionId;
  const { view, onClose } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(GitPanelContext.Provider, { value: true, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "dsh-git-sidebar-content", children: view === "changes" ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ChangesTab, { ...props, cwd, sessionId }) : view === "history" ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(GitGraphDialog, { path: cwd, onClose }) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(RepositoryForm, { view, cwd, onClose, onOpenWorktree: props.onOpenWorktree }) }, `${sessionId || ""}:${cwd}`) });
}

// src/client/hero-registration.ts
var HERO_SLOT = "conversation.hero.agentPreset";
function installHeroControls(slots, decorate) {
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
      store: next.store
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

// src/client/index.tsx
var import_jsx_runtime10 = require("react/jsx-runtime");
var inject = ["slots", "sessions", "workspaces", "uiWorkspace"];
function ChangesButton(props) {
  const target = useWorkspaceContext(props);
  const [error, setError] = (0, import_react11.useState)(null);
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("button", { type: "button", className: "dsh-git-selector-btn", title: "\u5728\u53F3\u4FA7\u67E5\u770B\u53D8\u66F4", onClick: () => {
      setError(null);
      props.onOpenGitPanel("changes", target).catch((error2) => setError(error2.message));
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(IconDiff, { size: 16 }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: "\u53D8\u66F4" })
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dsh-git-error", role: "alert", children: error })
  ] });
}
function SessionHeaderGitControls(props) {
  const blank = props.useSession ? props.useSession((session) => session?.blank) : false;
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dsh-git-header-controls", children: [
    !blank && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(BranchChip, { ...props, mode: "header" }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(ChangesButton, { ...props })
  ] });
}
function apply(ctx) {
  ctx.effect(() => {
    injectStyles();
    return disposeStyles;
  }, "dsh-plugin-git: styles");
  ctx.inject(["slots", "sessions", "workspaces", "uiWorkspace"], (scope) => {
    const sharedProps = {
      gitSessionsSource: scope.sessions.list,
      gitWorkspacesSource: scope.workspaces.list,
      onOpenWorktree: createWorktreeOpener(scope),
      onOpenGitPanel: createGitPanelOpener(scope)
    };
    scope.slots.inject("conversation.hero.agentPreset", () => installHeroControls(scope.slots, (Original) => {
      return function InlineHeroGitControls(props) {
        return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dsh-git-hero-controls", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Original, { ...props }),
          props.sessionId && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(BranchChip, { ...props, ...sharedProps })
        ] });
      };
    }));
    scope.slots.inject("conversation.session.header.utilities", () => scope.slots.register({
      id: "dsh-plugin-git",
      name: "conversation.session.header.utilities",
      order: 15,
      inject: () => sharedProps
    }, SessionHeaderGitControls));
    scope.inject(["betterSidebar"], (sideCtx) => {
      const icons = { changes: IconDiff, history: IconHistory, "create-branch": IconBranchPlus, "create-worktree": IconFolderTree, worktrees: IconFolderTree };
      for (const view of Object.keys(GIT_PANEL_TYPES)) {
        sideCtx.effect(() => sideCtx.betterSidebar.registerTab({
          id: GIT_PANEL_TYPES[view],
          title: () => GIT_PANEL_TITLES[view],
          description: () => view === "changes" ? "\u67E5\u770B\u5DE5\u4F5C\u533A\u4E0E\u4E0A\u6E38\u5DEE\u5F02" : GIT_PANEL_TITLES[view],
          icon: (size = 16) => import_react11.default.createElement(icons[view], { size }),
          order: view === "changes" ? 15 : 16,
          single: true,
          component: (props) => import_react11.default.createElement(GitSidebarPanel, {
            ...sharedProps,
            ...props,
            view,
            sessionId: props.scope?.sessionId || props.sessionId,
            onClose: () => sideCtx.betterSidebar.closeTab(props.tab.id, props.scope)
          })
        }), `dsh-plugin-git: sidebar ${view}`);
      }
    });
  });
}

    return module.exports;
  }
});
//# sourceMappingURL=client.js.map
