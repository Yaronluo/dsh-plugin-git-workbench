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
var import_react8 = __toESM(require("react"), 1);

// src/client/chips/BranchChip.tsx
var import_react6 = require("react");

// src/client/api.ts
function getEndpointUrl(endpoint) {
  const cleanEndpoint = endpoint.replace(/^\/+/, "");
  return `dsh-git/${cleanEndpoint}`;
}
async function postJson(endpoint, body) {
  const url = getEndpointUrl(endpoint);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (err) {
    res = await fetch(`/${getEndpointUrl(endpoint)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }
  const json = await res.json();
  if (!json.ok && json.error && !json.code) {
    throw new Error(json.error);
  }
  return json.value !== void 0 ? json.value : json;
}
var gitApi = {
  async getStatus(path) {
    return postJson("status", { path });
  },
  async getBranches(path) {
    return postJson("branches", { path });
  },
  async switchBranch(path, branch) {
    return postJson("switch", { path, branch });
  },
  async createBranch(path, name, base) {
    return postJson("create-branch", { path, name, base });
  },
  async getDiff(path, base, target) {
    return postJson("diff", { path, base, target });
  },
  async getWorktrees(path) {
    return postJson("worktrees", { path });
  },
  async createWorktree(path, name, base) {
    return postJson("create-worktree", { path, name, base });
  },
  async removeWorktree(path, worktreePath) {
    return postJson("remove-worktree", { path, worktreePath });
  },
  async getLog(path, limit = 50) {
    return postJson("log", { path, limit });
  },
  subscribeEvents(path, onStatus) {
    if (typeof EventSource === "undefined") return () => {
    };
    const url = `${getEndpointUrl("events")}?path=${encodeURIComponent(path)}`;
    let source;
    try {
      source = new EventSource(url);
    } catch {
      source = new EventSource(`/${url}`);
    }
    source.addEventListener("status", (e) => {
      try {
        const data = JSON.parse(e.data);
        onStatus(data);
      } catch {
      }
    });
    return () => {
      source.close();
    };
  }
};

// src/client/icons.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function IconBranch({ size = 14, className = "" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "6", y1: "3", x2: "6", y2: "13" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "6", cy: "3", r: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "6", cy: "13", r: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "7", r: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6 9a4 4 0 0 0 4-4v0" })
  ] });
}
function IconChevronDown({ size = 12, className = "" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", className, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "4 6 8 10 12 6" }) });
}
function IconSearch({ size = 14, className = "" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "7", cy: "7", r: "4.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "10.5", y1: "10.5", x2: "14", y2: "14" })
  ] });
}
function IconCheck({ size = 14, className = "" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "3.5 8.5 6.5 11.5 12.5 4.5" }) });
}
function IconDiff({ size = 14, className = "" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "2", y: "2", width: "12", height: "12", rx: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "8", y1: "2", x2: "8", y2: "14" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "5", y1: "5", x2: "5", y2: "9" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "3", y1: "7", x2: "7", y2: "7" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "9", y1: "7", x2: "13", y2: "7" })
  ] });
}
function IconFile({ size = 14, className = "" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "9 2 9 6 13 6" })
  ] });
}
function IconRefresh({ size = 14, className = "" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2.5 8a5.5 5.5 0 0 1 9.3-3.9L13.5 6" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "13.5 2 13.5 6 9.5 6" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M13.5 8a5.5 5.5 0 0 1-9.3 3.9L2.5 10" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "2.5 14 2.5 10 6.5 10" })
  ] });
}
function IconClose({ size = 14, className = "" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "4", y1: "4", x2: "12", y2: "12" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "12", y1: "4", x2: "4", y2: "12" })
  ] });
}
function IconGraph({ size = 14, className = "" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "5", cy: "4", r: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "5", cy: "12", r: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "11", cy: "8", r: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5 6v4" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5 6c0 2 6 0 6 2" })
  ] });
}
function IconWorktree({ size = 14, className = "" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "2", y: "3", width: "5", height: "4", rx: "1" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "9", y: "3", width: "5", height: "4", rx: "1" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "5.5", y: "10", width: "5", height: "4", rx: "1" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "4.5", y1: "7", x2: "4.5", y2: "8.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "11.5", y1: "7", x2: "11.5", y2: "8.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "4.5", y1: "8.5", x2: "11.5", y2: "8.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "8", y1: "8.5", x2: "8", y2: "10" })
  ] });
}

// src/client/hooks/use-git-status.ts
var import_react = require("react");
function useGitStatus2(path) {
  const [status, setStatus] = (0, import_react.useState)(null);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const reload = (0, import_react.useCallback)(() => {
    if (!path) {
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    gitApi.getStatus(path).then((res) => {
      setStatus(res);
    }).catch(() => {
      setStatus(null);
    }).finally(() => {
      setLoading(false);
    });
  }, [path]);
  (0, import_react.useEffect)(() => {
    reload();
    if (!path) return;
    const unsubscribe = gitApi.subscribeEvents(path, (updatedStatus) => {
      setStatus(updatedStatus);
    });
    const onFocus = () => {
      reload();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [path, reload]);
  return {
    status,
    isGit: status?.isGit ?? false,
    loading,
    reload
  };
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
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-git-popover-backdrop", onClick: onClose }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-git-popover", onClick: (e) => e.stopPropagation(), children: [
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
      error && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { color: "#dc2626", fontSize: 12, padding: "4px 12px", background: "#fef2f2" }, children: error }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-git-branch-list", children: filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { padding: "16px 12px", textAlign: "center", color: "#9ca3af", fontSize: 13 }, children: "\u672A\u5339\u914D\u5230\u5206\u652F" }) : filtered.map((b) => {
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
              isSw && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontSize: 11, color: "#6b7280" }, children: "\u5207\u6362\u4E2D..." })
            ]
          },
          b.name
        );
      }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-git-footer", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "dsh-git-footer-btn", onClick: onCreateBranch, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconBranch, { size: 14 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u521B\u5EFA\u5E76\u68C0\u51FA\u65B0\u5206\u652F..." })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "dsh-git-footer-btn", onClick: onOpenGraph, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconGraph, { size: 14 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Git \u56FE\u8C31" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "dsh-git-footer-btn", onClick: onCreateWorktree, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconWorktree, { size: 14 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u5728 worktree \u4E2D\u5F00\u59CB\u65B0\u4F1A\u8BDD..." })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "dsh-git-footer-btn", onClick: onManageWorktrees, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconWorktree, { size: 14 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u7BA1\u7406 worktree..." })
        ] })
      ] })
    ] })
  ] });
}

// src/client/dialogs/CreateBranchDialog.tsx
var import_react3 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
function CreateBranchDialog({ path, currentBranch, onClose, onSuccess }) {
  const [name, setName] = (0, import_react3.useState)("");
  const [base, setBase] = (0, import_react3.useState)(currentBranch);
  const [error, setError] = (0, import_react3.useState)(null);
  const [submitting, setSubmitting] = (0, import_react3.useState)(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
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
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-git-modal-overlay", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-git-modal-card", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-git-modal-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\u521B\u5EFA\u5E76\u68C0\u51FA\u65B0\u5206\u652F" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", onClick: onClose, style: { border: "none", background: "transparent", cursor: "pointer", padding: 4 }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconClose, { size: 16 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("form", { onSubmit: handleSubmit, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-git-modal-body", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { style: { display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }, children: "\u65B0\u5206\u652F\u540D\u79F0" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "input",
            {
              className: "dsh-git-input",
              placeholder: "\u4F8B\u5982\uFF1Afeature/awesome-ui",
              value: name,
              onChange: (e) => setName(e.target.value),
              autoFocus: true
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { style: { display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }, children: "\u57FA\u4E8E\u5206\u652F / Commit (\u53EF\u9009)" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "input",
            {
              className: "dsh-git-input",
              placeholder: "\u9ED8\u8BA4\u4E3A\u5F53\u524D\u5206\u652F HEAD",
              value: base,
              onChange: (e) => setBase(e.target.value)
            }
          )
        ] }),
        error && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { color: "#dc2626", fontSize: 12.5, background: "#fef2f2", padding: "6px 10px", borderRadius: 6 }, children: error })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-git-modal-footer", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: onClose, children: "\u53D6\u6D88" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
  ] }) });
}

// src/client/dialogs/GitGraphDialog.tsx
var import_react4 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
function GitGraphDialog({ path, onClose }) {
  const [commits, setCommits] = (0, import_react4.useState)([]);
  const [loading, setLoading] = (0, import_react4.useState)(true);
  (0, import_react4.useEffect)(() => {
    gitApi.getLog(path, 60).then((res) => setCommits(res)).catch(() => {
    }).finally(() => setLoading(false));
  }, [path]);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-modal-overlay", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-modal-card", style: { width: 720, height: 520 }, onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-git-modal-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconGraph, { size: 18 }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "Git \u63D0\u4EA4\u56FE\u8C31" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", onClick: onClose, style: { border: "none", background: "transparent", cursor: "pointer", padding: 4 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconClose, { size: 16 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { flex: 1, overflowY: "auto", padding: "10px 16px" }, children: loading ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { padding: 40, textAlign: "center", color: "#6b7280" }, children: "\u6B63\u5728\u52A0\u8F7D\u63D0\u4EA4\u56FE\u8C31..." }) : commits.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { padding: 40, textAlign: "center", color: "#6b7280" }, children: "\u6682\u65E0\u63D0\u4EA4\u8BB0\u5F55" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: commits.map((c, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 12px",
          borderRadius: 6,
          background: i % 2 === 0 ? "#fafafa" : "#ffffff",
          border: "1px solid #f3f4f6",
          fontSize: 13
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              style: {
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#3b82f6",
                boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.2)"
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontFamily: "monospace", fontWeight: 600, color: "#2563eb" }, children: c.shortHash }),
          c.refs.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { display: "flex", gap: 4 }, children: c.refs.map((r) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "span",
            {
              style: {
                fontSize: 11,
                padding: "1px 6px",
                borderRadius: 4,
                background: r.includes("HEAD") ? "#dbeafe" : "#f3f4f6",
                color: r.includes("HEAD") ? "#1e40af" : "#4b5563",
                fontWeight: 500
              },
              children: r
            },
            r
          )) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }, children: c.subject }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }, children: c.author }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: 11.5, color: "#9ca3af", whiteSpace: "nowrap" }, children: c.date })
        ]
      },
      c.hash
    )) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-git-modal-footer", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: onClose, children: "\u5173\u95ED" }) })
  ] }) });
}

// src/client/dialogs/WorktreeDialogs.tsx
var import_react5 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
function CreateWorktreeDialog({
  path,
  currentBranch,
  onClose,
  onSuccess
}) {
  const [name, setName] = (0, import_react5.useState)("");
  const [base, setBase] = (0, import_react5.useState)(currentBranch);
  const [submitting, setSubmitting] = (0, import_react5.useState)(false);
  const [error, setError] = (0, import_react5.useState)(null);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await gitApi.createWorktree(path, name.trim(), base.trim() || void 0);
      if (res.ok && res.path) {
        onSuccess(res.path);
        onClose();
      } else {
        setError(res.error || "\u521B\u5EFA Worktree \u5931\u8D25");
      }
    } catch (err) {
      setError(err?.message || "\u521B\u5EFA\u5F02\u5E38");
    } finally {
      setSubmitting(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dsh-git-modal-overlay", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dsh-git-modal-card", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dsh-git-modal-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconWorktree, { size: 16 }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "\u5728 Worktree \u4E2D\u5F00\u59CB\u65B0\u4F1A\u8BDD" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", onClick: onClose, style: { border: "none", background: "transparent", cursor: "pointer", padding: 4 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconClose, { size: 16 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("form", { onSubmit: handleSubmit, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dsh-git-modal-body", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { fontSize: 13, color: "#6b7280", lineHeight: 1.5 }, children: "Worktree \u5C06\u4E3A\u5E76\u884C\u4F1A\u8BDD\u63D0\u4F9B\u72EC\u7ACB\u7684\u4EE3\u7801\u5DE5\u4F5C\u6811\uFF0C\u907F\u514D\u591A\u4EFB\u52A1\u76F8\u4E92\u8986\u76D6\u6216\u5207\u6362\u5206\u652F\u5F71\u54CD\u5176\u4ED6\u64CD\u4F5C\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("label", { style: { display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }, children: "Worktree \u4EFB\u52A1\u6807\u8BC6" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "input",
            {
              className: "dsh-git-input",
              placeholder: "\u4F8B\u5982\uFF1Afeature-login \u6216 test-exp",
              value: name,
              onChange: (e) => setName(e.target.value),
              autoFocus: true
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("label", { style: { display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }, children: "\u57FA\u7EBF\u5206\u652F" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "input",
            {
              className: "dsh-git-input",
              value: base,
              onChange: (e) => setBase(e.target.value)
            }
          )
        ] }),
        error && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { color: "#dc2626", fontSize: 12.5, background: "#fef2f2", padding: "6px 10px", borderRadius: 6 }, children: error })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dsh-git-modal-footer", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: onClose, children: "\u53D6\u6D88" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "button",
          {
            type: "submit",
            className: "dsh-git-btn dsh-git-btn-primary",
            disabled: submitting || !name.trim(),
            children: submitting ? "\u521B\u5EFA\u4E2D..." : "\u5F00\u59CB\u72EC\u7ACB\u4F1A\u8BDD"
          }
        )
      ] })
    ] })
  ] }) });
}
function WorktreeManagerDialog({ path, onClose }) {
  const [list, setList] = (0, import_react5.useState)([]);
  const [loading, setLoading] = (0, import_react5.useState)(true);
  const reload = () => {
    setLoading(true);
    gitApi.getWorktrees(path).then((res) => setList(res)).catch(() => {
    }).finally(() => setLoading(false));
  };
  (0, import_react5.useEffect)(() => {
    reload();
  }, [path]);
  const handleDelete = async (wtPath) => {
    if (!confirm(`\u786E\u5B9A\u8981\u79FB\u9664 Worktree \u76EE\u5F55 ${wtPath} \u5417\uFF1F`)) return;
    await gitApi.removeWorktree(path, wtPath);
    reload();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dsh-git-modal-overlay", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dsh-git-modal-card", style: { width: 640 }, onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dsh-git-modal-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconWorktree, { size: 16 }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "\u7BA1\u7406 Git Worktrees" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", onClick: onClose, style: { border: "none", background: "transparent", cursor: "pointer", padding: 4 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconClose, { size: 16 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { padding: "14px 18px", maxHeight: 360, overflowY: "auto" }, children: loading ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { textAlign: "center", color: "#6b7280", padding: 20 }, children: "\u52A0\u8F7D\u4E2D..." }) : list.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { textAlign: "center", color: "#6b7280", padding: 20 }, children: "\u6682\u65E0\u591A\u4F59 Worktree" }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: list.map((wt) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderRadius: 6,
          background: wt.isCurrent ? "#eff6ff" : "#fafafa",
          border: wt.isCurrent ? "1px solid #bfdbfe" : "1px solid #f3f4f6"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 2 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: wt.branch }),
              wt.isCurrent && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 11, background: "#3b82f6", color: "#fff", padding: "1px 6px", borderRadius: 10 }, children: "\u5F53\u524D\u68C0\u51FA" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { fontSize: 12, color: "#6b7280", fontFamily: "monospace" }, children: wt.path })
          ] }),
          !wt.isCurrent && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "button",
            {
              type: "button",
              className: "dsh-git-btn dsh-git-btn-secondary",
              style: { color: "#dc2626", borderColor: "#fca5a5", padding: "4px 10px", fontSize: 12 },
              onClick: () => handleDelete(wt.path),
              children: "\u5220\u9664"
            }
          )
        ]
      },
      wt.path
    )) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dsh-git-modal-footer", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dsh-git-btn dsh-git-btn-secondary", onClick: onClose, children: "\u5B8C\u6210" }) })
  ] }) });
}

// src/client/cwd-resolver.ts
function resolveWorkspaceCwd(props, scope) {
  if (props?.cwd && typeof props.cwd === "string" && props.cwd.trim()) {
    return props.cwd.trim();
  }
  if (props?.workspace?.path && typeof props.workspace.path === "string") {
    return props.workspace.path.trim();
  }
  if (props?.session?.cwd && typeof props.session.cwd === "string") {
    return props.session.cwd.trim();
  }
  if (props?.cwdOf && typeof props.cwdOf === "function") {
    const res = props.cwdOf(props.sessionId);
    if (res && typeof res === "string") return res.trim();
  }
  const targetScope = scope || (typeof window !== "undefined" ? window.__dsh_scope__ : void 0);
  if (targetScope?.sessions?.list) {
    try {
      const snap = targetScope.sessions.list.getSnapshot();
      if (props?.sessionId && snap?.byId?.[props.sessionId]?.cwd) {
        return snap.byId[props.sessionId].cwd;
      }
      for (const id in snap?.byId || {}) {
        const item = snap.byId[id];
        if (item?.retainedBy?.mainView && item.cwd) return item.cwd;
      }
      for (const id in snap?.byId || {}) {
        if (snap.byId[id]?.cwd) return snap.byId[id].cwd;
      }
    } catch {
    }
  }
  if (targetScope?.workspaces?.list) {
    try {
      const items = targetScope.workspaces.list.getSnapshot()?.items || [];
      if (items.length > 0 && items[0]?.path) return items[0].path;
    } catch {
    }
  }
  if (targetScope?.uiWorkspace?.activeWorkspace?.path) {
    return targetScope.uiWorkspace.activeWorkspace.path;
  }
  return "";
}

// src/client/chips/BranchChip.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
function BranchChip(props) {
  injectStyles();
  if (typeof props?.useSessions === "function") {
    props.useSessions((state) => state);
  }
  const cwd = resolveWorkspaceCwd(props);
  const { status, isGit, loading, reload } = useGitStatus2(cwd);
  const [open, setOpen] = (0, import_react6.useState)(false);
  const [branchesView, setBranchesView] = (0, import_react6.useState)(null);
  const [fetchingBranches, setFetchingBranches] = (0, import_react6.useState)(false);
  const [showCreateBranch, setShowCreateBranch] = (0, import_react6.useState)(false);
  const [showGraph, setShowGraph] = (0, import_react6.useState)(false);
  const [showCreateWorktree, setShowCreateWorktree] = (0, import_react6.useState)(false);
  const [showManageWorktrees, setShowManageWorktrees] = (0, import_react6.useState)(false);
  if (loading || !isGit || !status) {
    return null;
  }
  const handleTogglePopover = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setFetchingBranches(true);
    try {
      const view = await gitApi.getBranches(cwd);
      setBranchesView(view);
      setOpen(true);
    } catch {
      setBranchesView({
        current: status.branch,
        dirtyFiles: status.dirtyFiles,
        branches: [{ name: status.branch, current: true, isRemote: false }]
      });
      setOpen(true);
    } finally {
      setFetchingBranches(false);
    }
  };
  const handleSwitchBranch = async (targetBranch) => {
    const res = await gitApi.switchBranch(cwd, targetBranch);
    if (!res.ok) {
      throw new Error(res.error?.message || "\u5207\u6362\u5206\u652F\u5931\u8D25");
    }
    reload();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { position: "relative", display: "inline-flex" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "button",
      {
        type: "button",
        className: `dsh-git-chip ${open ? "dsh-git-chip-active" : ""}`,
        onClick: handleTogglePopover,
        title: `\u5F53\u524D Git \u5206\u652F: ${status.branch}${status.dirtyFiles > 0 ? ` (${status.dirtyFiles} \u4E2A\u4FEE\u6539\u6587\u4EF6)` : ""}`,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconBranch, { size: 13 }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: status.branch || "HEAD" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconChevronDown, { size: 11 })
        ]
      }
    ),
    open && branchesView && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      BranchPopover,
      {
        view: branchesView,
        onSwitch: handleSwitchBranch,
        onCreateBranch: () => {
          setOpen(false);
          setShowCreateBranch(true);
        },
        onOpenGraph: () => {
          setOpen(false);
          setShowGraph(true);
        },
        onCreateWorktree: () => {
          setOpen(false);
          setShowCreateWorktree(true);
        },
        onManageWorktrees: () => {
          setOpen(false);
          setShowManageWorktrees(true);
        },
        onClose: () => setOpen(false)
      }
    ),
    showCreateBranch && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      CreateBranchDialog,
      {
        path: cwd,
        currentBranch: status.branch,
        onClose: () => setShowCreateBranch(false),
        onSuccess: (newBranch) => {
          reload();
        }
      }
    ),
    showGraph && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(GitGraphDialog, { path: cwd, onClose: () => setShowGraph(false) }),
    showCreateWorktree && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      CreateWorktreeDialog,
      {
        path: cwd,
        currentBranch: status.branch,
        onClose: () => setShowCreateWorktree(false),
        onSuccess: (wtPath) => {
          reload();
          alert(`\u5DF2\u5728\u72EC\u7ACB\u5DE5\u4F5C\u6811\u521B\u5EFA\u5206\u652F\u5E76\u5728\u76EE\u5F55\u6253\u5F00:
${wtPath}`);
        }
      }
    ),
    showManageWorktrees && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(WorktreeManagerDialog, { path: cwd, onClose: () => setShowManageWorktrees(false) })
  ] });
}

// src/client/diff/ChangesTab.tsx
var import_react7 = require("react");

// src/client/styles.ts
var STYLES = `
.dsh-git-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: 14px;
  background: var(--dsw-surface-alt, rgba(0, 0, 0, 0.04));
  border: 1px solid var(--dsw-border-subtle, rgba(0, 0, 0, 0.08));
  color: var(--dsw-text, #1f2937);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
  position: relative;
}

.dsh-git-chip:hover {
  background: var(--dsw-surface-hover, rgba(0, 0, 0, 0.08));
  border-color: var(--dsw-border, rgba(0, 0, 0, 0.15));
}

.dsh-git-chip-active {
  background: var(--dsw-surface-selected, rgba(59, 130, 246, 0.1));
  border-color: var(--dsw-primary, #3b82f6);
  color: var(--dsw-primary, #3b82f6);
}

.dsh-git-popover-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: transparent;
}

.dsh-git-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: 290px;
  max-height: 480px;
  background: var(--dsw-surface, #ffffff);
  border: 1px solid var(--dsw-border, rgba(0, 0, 0, 0.12));
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: dshGitFadeIn 0.12s ease-out;
}

@keyframes dshGitFadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.dsh-git-search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin: 8px 10px 4px 10px;
  background: var(--dsw-bg-subtle, #f9fafb);
  border: 1px solid var(--dsw-border, #e5e7eb);
  border-radius: 8px;
}

.dsh-git-search-input {
  border: none;
  outline: none;
  background: transparent;
  width: 100%;
  font-size: 13px;
  color: var(--dsw-text, #111827);
}

.dsh-git-dirty-warning {
  padding: 6px 14px;
  font-size: 12px;
  color: #ea580c;
  font-weight: 500;
  background: rgba(234, 88, 12, 0.06);
  margin: 4px 10px;
  border-radius: 6px;
}

.dsh-git-branch-list {
  flex: 1;
  overflow-y: auto;
  max-height: 240px;
  padding: 4px 6px;
}

.dsh-git-branch-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 7px 10px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--dsw-text, #374151);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s;
}

.dsh-git-branch-item:hover {
  background: var(--dsw-surface-hover, rgba(0, 0, 0, 0.05));
}

.dsh-git-branch-item-active {
  font-weight: 600;
  color: var(--dsw-primary, #2563eb);
}

.dsh-git-branch-item-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsh-git-footer {
  border-top: 1px solid var(--dsw-border-subtle, #f3f4f6);
  padding: 4px 6px;
  background: var(--dsw-surface-alt, #fafafa);
}

.dsh-git-footer-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--dsw-text, #4b5563);
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s;
}

.dsh-git-footer-btn:hover {
  background: var(--dsw-surface-hover, rgba(0, 0, 0, 0.05));
  color: var(--dsw-text-strong, #111827);
}

/* Changes Panel & Diff Styles */
.dsh-git-changes-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--dsw-surface, #ffffff);
  color: var(--dsw-text, #111827);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
}

.dsh-git-changes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--dsw-border, #e5e7eb);
  background: var(--dsw-surface-alt, #fafafa);
  gap: 8px;
}

.dsh-git-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dsh-git-stat-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  font-family: monospace;
}

.dsh-git-ins {
  color: #16a34a;
}

.dsh-git-del {
  color: #dc2626;
}

.dsh-git-selector-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--dsw-surface, #ffffff);
  border: 1px solid var(--dsw-border, #d1d5db);
  border-radius: 6px;
  font-size: 12.5px;
  cursor: pointer;
  color: var(--dsw-text, #374151);
}

.dsh-git-changes-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.dsh-git-file-list {
  width: 260px;
  border-right: 1px solid var(--dsw-border, #e5e7eb);
  overflow-y: auto;
  padding: 6px;
  background: var(--dsw-surface-alt, #fafafa);
}

.dsh-git-file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12.5px;
  margin-bottom: 2px;
  user-select: none;
}

.dsh-git-file-item:hover {
  background: var(--dsw-surface-hover, rgba(0, 0, 0, 0.04));
}

.dsh-git-file-item-active {
  background: var(--dsw-surface-selected, rgba(59, 130, 246, 0.12));
  color: var(--dsw-primary, #2563eb);
  font-weight: 500;
}

.dsh-git-diff-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.dsh-git-diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid #f0f0f0;
  background: #fbfbfb;
  font-size: 12.5px;
  font-family: monospace;
}

.dsh-git-diff-lines {
  flex: 1;
  overflow: auto;
  font-family: "JetBrains Mono", Consolas, "Courier New", monospace;
  font-size: 12px;
  line-height: 1.6;
}

.dsh-git-diff-row {
  display: flex;
  width: 100%;
}

.dsh-git-diff-row:hover {
  filter: brightness(0.97);
}

.dsh-git-line-num {
  width: 44px;
  text-align: right;
  padding-right: 8px;
  color: #9ca3af;
  user-select: none;
  font-size: 11px;
  border-right: 1px solid #f3f4f6;
  background: #fafafa;
}

.dsh-git-line-content {
  flex: 1;
  padding-left: 10px;
  white-space: pre;
  tab-size: 4;
}

.dsh-git-row-add {
  background: rgba(34, 197, 94, 0.12);
}

.dsh-git-row-add .dsh-git-line-content {
  color: #15803d;
}

.dsh-git-row-add .dsh-git-line-num {
  background: rgba(34, 197, 94, 0.18);
  color: #166534;
}

.dsh-git-row-del {
  background: rgba(239, 68, 68, 0.12);
}

.dsh-git-row-del .dsh-git-line-content {
  color: #b91c1c;
}

.dsh-git-row-del .dsh-git-line-num {
  background: rgba(239, 68, 68, 0.18);
  color: #991b1b;
}

.dsh-git-hunk-header {
  background: #f1f5f9;
  color: #64748b;
  padding: 3px 12px;
  font-size: 11px;
  font-style: italic;
  border-top: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
}

/* Modal Dialogs */
.dsh-git-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dsh-git-modal-card {
  width: 480px;
  max-width: 90vw;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dsh-git-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 600;
  font-size: 15px;
}

.dsh-git-modal-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dsh-git-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px;
  border-top: 1px solid #e5e7eb;
  background: #fafafa;
}

.dsh-git-btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.1s;
}

.dsh-git-btn-secondary {
  background: #ffffff;
  border-color: #d1d5db;
  color: #374151;
}

.dsh-git-btn-secondary:hover {
  background: #f9fafb;
}

.dsh-git-btn-primary {
  background: #2563eb;
  color: #ffffff;
}

.dsh-git-btn-primary:hover {
  background: #1d4ed8;
}

.dsh-git-btn-primary:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.dsh-git-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  font-size: 13px;
  outline: none;
}

.dsh-git-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}
`;
function injectStyles2() {
  if (typeof document === "undefined") return;
  const id = "dsh-plugin-git-styles";
  if (document.getElementById(id)) return;
  const styleEl = document.createElement("style");
  styleEl.id = id;
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);
}

// src/client/diff/ChangesTab.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
function ChangesTab(props) {
  injectStyles2();
  const cwd = resolveWorkspaceCwd(props);
  const { status, isGit, loading: statusLoading, reload: reloadStatus } = useGitStatus(cwd);
  const [diffView, setDiffView] = (0, import_react7.useState)(null);
  const [loadingDiff, setLoadingDiff] = (0, import_react7.useState)(false);
  const [selectedFile, setSelectedFile] = (0, import_react7.useState)(null);
  const [compareTarget, setCompareTarget] = (0, import_react7.useState)("working-head");
  const [compareDropdownOpen, setCompareDropdownOpen] = (0, import_react7.useState)(false);
  const loadDiff = async () => {
    if (!cwd || !isGit) return;
    setLoadingDiff(true);
    try {
      let base;
      let target;
      if (compareTarget === "branch-upstream") {
        base = status?.branch ? `origin/${status.branch}` : "origin/main";
        target = status?.branch || "HEAD";
      } else if (compareTarget === "staged") {
        base = "HEAD";
        target = void 0;
      } else {
        base = "HEAD";
        target = void 0;
      }
      const res = await gitApi.getDiff(cwd, base, target);
      setDiffView(res);
      if (res.files.length > 0 && !selectedFile) {
        setSelectedFile(res.files[0].path);
      }
    } catch {
    } finally {
      setLoadingDiff(false);
    }
  };
  (0, import_react7.useEffect)(() => {
    if (isGit && cwd) {
      loadDiff();
    }
  }, [cwd, isGit, compareTarget, status?.dirtyFiles]);
  const activeFile = (0, import_react7.useMemo)(() => {
    if (!diffView || !selectedFile) return diffView?.files[0] || null;
    return diffView.files.find((f) => f.path === selectedFile) || diffView.files[0] || null;
  }, [diffView, selectedFile]);
  if (!statusLoading && !isGit) {
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dsh-git-changes-panel", style: { alignItems: "center", justifyContent: "center", padding: 32 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconDiff, { size: 40, style: { color: "#9ca3af", marginBottom: 12 } }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 6 }, children: "\u5F53\u524D\u76EE\u5F55\u4E0D\u662F Git \u4ED3\u5E93" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { fontSize: 13, color: "#6b7280", textAlign: "center", maxWidth: 280, marginBottom: 16 }, children: [
        "\u5728\u9879\u76EE\u4E2D\u6267\u884C ",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("code", { children: "git init" }),
        " \u540E\u5373\u53EF\u5728\u6B64\u67E5\u770B\u5206\u652F\u3001\u672A\u63D0\u4EA4\u66F4\u6539\u4EE5\u53CA\u4EE3\u7801\u5DEE\u5F02\u5BF9\u6BD4\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "button",
        {
          type: "button",
          className: "dsh-git-btn dsh-git-btn-primary",
          onClick: () => {
            reloadStatus();
          },
          children: "\u91CD\u65B0\u68C0\u6D4B"
        }
      )
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dsh-git-changes-panel", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dsh-git-changes-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dsh-git-header-left", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("button", { type: "button", className: "dsh-git-selector-btn", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: "\u5206\u652F" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconChevronDown, { size: 11 })
        ] }),
        diffView && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dsh-git-stat-badge", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dsh-git-ins", children: [
            "+",
            diffView.totalInsertions
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dsh-git-del", children: [
            "-",
            diffView.totalDeletions
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { position: "relative" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
            "button",
            {
              type: "button",
              className: "dsh-git-selector-btn",
              onClick: () => setCompareDropdownOpen(!compareDropdownOpen),
              title: "\u5207\u6362\u5BF9\u6BD4\u57FA\u51C6",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconBranch, { size: 12 }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: compareTarget === "branch-upstream" ? `${status?.branch || "main"} \u2192 origin/${status?.branch || "main"}` : compareTarget === "staged" ? "\u5DF2\u6682\u5B58\u53D8\u66F4" : "\u5DE5\u4F5C\u533A \u2192 HEAD" }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconChevronDown, { size: 11 })
              ]
            }
          ),
          compareDropdownOpen && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              "div",
              {
                style: { position: "fixed", inset: 0, zIndex: 999 },
                onClick: () => setCompareDropdownOpen(false)
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
              "div",
              {
                style: {
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  width: 220,
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  zIndex: 1e3,
                  padding: 4
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                    "button",
                    {
                      type: "button",
                      className: "dsh-git-branch-item",
                      onClick: () => {
                        setCompareTarget("working-head");
                        setCompareDropdownOpen(false);
                      },
                      children: "\u5DE5\u4F5C\u533A vs HEAD (\u672A\u63D0\u4EA4\u66F4\u6539)"
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
                    "button",
                    {
                      type: "button",
                      className: "dsh-git-branch-item",
                      onClick: () => {
                        setCompareTarget("branch-upstream");
                        setCompareDropdownOpen(false);
                      },
                      children: [
                        status?.branch || "main",
                        " vs origin/",
                        status?.branch || "main"
                      ]
                    }
                  )
                ]
              }
            )
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "button",
        {
          type: "button",
          className: "dsh-git-selector-btn",
          onClick: () => {
            reloadStatus();
            loadDiff();
          },
          title: "\u5237\u65B0",
          style: { padding: "4px 6px" },
          children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconRefresh, { size: 13, className: loadingDiff ? "animate-spin" : "" })
        }
      ) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dsh-git-changes-body", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dsh-git-file-list", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { fontSize: 11.5, fontWeight: 600, color: "#6b7280", padding: "4px 8px 8px 8px", textTransform: "uppercase" }, children: [
          "\u53D8\u66F4\u6587\u4EF6 (",
          diffView?.files.length || 0,
          ")"
        ] }),
        loadingDiff && !diffView ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { padding: "20px 8px", textAlign: "center", color: "#9ca3af", fontSize: 12 }, children: "\u5206\u6790\u5DEE\u5F02\u4E2D..." }) : !diffView || diffView.files.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { padding: "20px 8px", textAlign: "center", color: "#9ca3af", fontSize: 12 }, children: "\u5F53\u524D\u65E0\u53EF\u5BF9\u6BD4\u7684\u66F4\u6539" }) : diffView.files.map((file) => {
          const isSelected = file.path === activeFile?.path;
          return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
            "div",
            {
              className: `dsh-git-file-item ${isSelected ? "dsh-git-file-item-active" : ""}`,
              onClick: () => setSelectedFile(file.path),
              title: file.path,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconFile, { size: 13 }),
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: file.path.split("/").pop() || file.path })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 4, fontFamily: "monospace", fontSize: 11 }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dsh-git-ins", children: [
                    "+",
                    file.insertions
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dsh-git-del", children: [
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
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dsh-git-diff-view", children: activeFile ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dsh-git-diff-header", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconFile, { size: 14 }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { fontWeight: 600 }, children: activeFile.path }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { style: { fontSize: 11 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dsh-git-ins", children: [
              "+",
              activeFile.insertions
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dsh-git-del", children: [
              " -",
              activeFile.deletions
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dsh-git-diff-lines", children: activeFile.hunks.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { padding: 20, color: "#9ca3af", fontStyle: "italic" }, children: activeFile.status === "deleted" ? "\u6587\u4EF6\u5DF2\u88AB\u5220\u9664" : "\u6587\u4EF6\u672A\u5305\u542B\u5DEE\u5F02\u884C\u6216\u4E3A\u4E8C\u8FDB\u5236\u6587\u4EF6" }) : activeFile.hunks.map((hunk, hIdx) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dsh-git-hunk-header", children: hunk.header }),
          hunk.lines.map((line, lIdx) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
            "div",
            {
              className: `dsh-git-diff-row ${line.type === "add" ? "dsh-git-row-add" : line.type === "del" ? "dsh-git-row-del" : ""}`,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dsh-git-line-num", children: line.oldNum ?? "" }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dsh-git-line-num", children: line.newNum ?? "" }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dsh-git-line-content", children: [
                  line.type === "add" ? "+ " : line.type === "del" ? "- " : "  ",
                  line.content
                ] })
              ]
            },
            lIdx
          ))
        ] }, hIdx)) })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13 }, children: "\u9009\u62E9\u5DE6\u4FA7\u6587\u4EF6\u4EE5\u67E5\u770B\u4EE3\u7801\u5DEE\u5F02" }) })
    ] })
  ] });
}

// src/client/index.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var inject = ["slots", "conversation", "sessions", "workspaces", "uiWorkspace"];
function ChangesToggleBtn(props) {
  const [open, setOpen] = (0, import_react8.useState)(false);
  const cwd = resolveWorkspaceCwd(props);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
      "button",
      {
        type: "button",
        className: "dsh-git-selector-btn",
        onClick: () => setOpen(!open),
        title: "\u67E5\u770B\u4EE3\u7801\u53D8\u66F4 (Diff)",
        style: { display: "inline-flex", alignItems: "center", gap: 4 },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(IconDiff, { size: 14 }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { fontSize: 12 }, children: "\u53D8\u66F4" })
        ]
      }
    ),
    open && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
      "div",
      {
        style: {
          position: "fixed",
          top: 60,
          right: 20,
          bottom: 20,
          width: 760,
          maxWidth: "90vw",
          background: "#ffffff",
          borderRadius: 12,
          boxShadow: "0 20px 30px rgba(0,0,0,0.18)",
          border: "1px solid #e5e7eb",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 16px",
                borderBottom: "1px solid #e5e7eb",
                background: "#fafafa",
                fontWeight: 600
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: "\u5DE5\u4F5C\u533A\u4EE3\u7801\u53D8\u66F4 (Git Diff)" }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                  "button",
                  {
                    type: "button",
                    onClick: () => setOpen(false),
                    style: { border: "none", background: "transparent", cursor: "pointer", padding: 4 },
                    children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(IconClose, { size: 16 })
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { flex: 1, overflow: "hidden" }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ChangesTab, { cwd }) })
        ]
      }
    )
  ] });
}
function apply(ctx) {
  injectStyles2();
  ctx.inject(["slots", "conversation", "sessions", "workspaces", "uiWorkspace"], (scope) => {
    if (typeof window !== "undefined") {
      ;
      window.__dsh_scope__ = scope;
    }
    const cwdOf = (sessionId) => {
      if (sessionId && scope.sessions?.list) {
        const snap = scope.sessions.list.getSnapshot();
        if (snap?.byId?.[sessionId]?.cwd) return snap.byId[sessionId].cwd;
      }
      if (scope.uiWorkspace?.activeWorkspace?.path) {
        return scope.uiWorkspace.activeWorkspace.path;
      }
      const items = scope.workspaces?.list?.getSnapshot()?.items || [];
      return items[0]?.path || "";
    };
    const chipEntry = {
      id: "dsh-plugin-git",
      order: 100,
      inject: () => ({
        cwdOf
      })
    };
    let mounted = false;
    const disposeContext = scope.slots.inject("conversation.input.selector.context", () => {
      mounted = true;
      try {
        return scope.slots.register(
          {
            name: "conversation.input.selector.context",
            ...chipEntry
          },
          BranchChip
        );
      } catch {
        return () => {
        };
      }
    });
    setTimeout(() => {
      if (mounted) return;
      disposeContext?.();
      scope.slots.inject("conversation.input.dock", () => {
        try {
          return scope.slots.register(
            {
              name: "conversation.input.dock",
              ...chipEntry
            },
            BranchChip
          );
        } catch {
          return () => {
          };
        }
      });
    }, 400);
    scope.slots.inject("conversation.session.header.utilities", () => {
      try {
        return scope.slots.register(
          {
            name: "conversation.session.header.utilities",
            order: 15,
            ...chipEntry
          },
          ChangesToggleBtn
        );
      } catch {
        return () => {
        };
      }
    });
  });
  try {
    ctx.inject(["betterSidebar"], (sideCtx) => {
      sideCtx.betterSidebar.registerTab({
        id: "git-changes",
        title: () => "\u53D8\u66F4",
        description: () => "\u67E5\u770B Git \u5DE5\u4F5C\u533A\u5DEE\u5F02\u4E0E\u5206\u652F\u5BF9\u6BD4",
        icon: () => import_react8.default.createElement(IconDiff, { size: 16 }),
        order: 15,
        single: true,
        component: (props) => import_react8.default.createElement(ChangesTab, props)
      });
    });
  } catch {
  }
}

    return module.exports;
  }
});
//# sourceMappingURL=client.js.map
