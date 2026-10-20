/**
 * Monospace font for code and paths. Never write the bare `monospace` keyword: it
 * resolves to the system default fixed font, which on a Chinese Windows is NSimSun /
 * a CJK serif-ish face whose Latin glyphs look thin and uneven. Follow the app's own
 * code font instead (the UI theme defines --ds-font-family-code on :root) with a
 * local fallback.
 */
export const CODE_FONT = 'var(--ds-font-family-code, Consolas, "Liberation Mono", Menlo, monospace)'

/**
 * Use the host's UI font token, not a separately ordered list of installed fonts.
 * The html element can still report the browser's default serif even when the app
 * uses its theme font, so reading its computed font is not a reliable UI reference.
 * Keeping the variable also follows host theme changes without reinjecting CSS.
 */
export const UI_FONT = 'var(--dsw-font-family, system-ui, sans-serif)'

export function appUiFont(): string {
  // Desktop may set a real CJK UI font on :root while the legacy theme token
  // still lists unavailable platform fonts. Mirror the app, not browser serif.
  if (typeof document !== 'undefined' && document.documentElement && typeof getComputedStyle === 'function') {
    const font = getComputedStyle(document.documentElement).fontFamily?.trim()
    if (font && !/[;{}<>]/.test(font) && !/^(?:["']?(?:Times New Roman|serif|monospace)["']?)$/i.test(font)) return font
  }
  return UI_FONT
}

/** Appended after STYLES so it wins on equal specificity with the runtime font. */
export function runtimeFontRule(): string {
  return `.dsh-git-sidebar-content, .dsh-git-workbench, .dsh-git-workbench-header, .dsh-git-changes-panel, .dsh-git-panel-form, .dsh-git-history-panel, .dsh-git-modal-card, .dsh-git-empty-state, .dsh-git-view-nav { font-family: ${appUiFont()}; }`
}

/** The exact text written into the document. */
export function sheetText(): string {
  return `${STYLES}\n${runtimeFontRule()}\n`
}

export const STYLES = `
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
.dsh-git-editor-option { display: flex; align-items: center; gap: 9px; width: 100%; padding: 8px 9px; border: 0; border-radius: 7px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; text-align: left; cursor: pointer; }
.dsh-git-editor-option:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-git-editor-option > svg { flex-shrink: 0; color: var(--dsw-alias-label-secondary); }
.dsh-git-editor-option > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* The mark is a span too, so it must win back the label rule's flex: 1. */
.dsh-git-editor-option > .dsh-git-editor-mark { flex: 0 0 auto; }
.dsh-git-editor-option > small { flex-shrink: 0; font-family: ${CODE_FONT}; font-size: 10px; color: var(--dsw-alias-label-secondary); }
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
.dsh-git-history-list button[aria-label="返回提交记录"] { position: sticky; top: 8px; z-index: 5; align-self: flex-start; box-shadow: 0 2px 8px var(--dsw-alias-bg-overlay); }
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
`

export function disposeStyles(): void {
  if (typeof document !== 'undefined') document.getElementById('dsh-plugin-git-styles')?.remove()
}

export function injectStyles(): void {
  if (typeof document === 'undefined') return
  const id = 'dsh-plugin-git-styles'
  const sheet = sheetText()
  const existing = document.getElementById(id)
  // Always refresh the text. Returning early when the element already exists pinned a
  // document to the first sheet it ever received, so a rebuilt bundle kept rendering
  // through stale CSS.
  if (existing) {
    if (existing.textContent !== sheet) existing.textContent = sheet
    return
  }
  const styleEl = document.createElement('style')
  styleEl.id = id
  styleEl.textContent = sheet
  document.head.appendChild(styleEl)
}
