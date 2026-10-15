export const STYLES = `
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
`

export function disposeStyles(): void {
  if (typeof document !== 'undefined') document.getElementById('dsh-plugin-git-styles')?.remove()
}

export function injectStyles(): void {
  if (typeof document === 'undefined') return
  const id = 'dsh-plugin-git-styles'
  if (document.getElementById(id)) return
  const styleEl = document.createElement('style')
  styleEl.id = id
  styleEl.textContent = STYLES
  document.head.appendChild(styleEl)
}
