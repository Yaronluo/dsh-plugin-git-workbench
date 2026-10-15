export const STYLES = `
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
`

export function injectStyles(): void {
  if (typeof document === 'undefined') return
  const id = 'dsh-plugin-git-styles'
  if (document.getElementById(id)) return
  const styleEl = document.createElement('style')
  styleEl.id = id
  styleEl.textContent = STYLES
  document.head.appendChild(styleEl)
}
