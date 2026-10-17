import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadTs } from './helpers/load-ts.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const sourceRoot = pathToFileURL(resolve(root, 'src') + '/').href
const chipUrl = pathToFileURL(resolve(root, 'src/client/chips/BranchChip.tsx')).href
const popoverUrl = pathToFileURL(resolve(root, 'src/client/chips/BranchPopover.tsx')).href
const virtual = source => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true })

// The capsule and the popover are rendered for real (React, hooks, the production components and the
// production icon set); only the network, the cwd resolver and — for the capsule — the popover are
// replaced, because none of them is what this file is about. The icons stay real: an assertion about
// an arrow must see the arrow.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL ?? ''
    const inChips = parent.endsWith('/chips/BranchChip.tsx') || parent.endsWith('/chips/BranchPopover.tsx')
    if (inChips) {
      if (specifier.endsWith('/api.js')) return virtual('export const gitApi = { getStatus: async () => globalThis.__chipStatus };')
    }
    if (parent.endsWith('/chips/BranchChip.tsx')) {
      if (specifier.endsWith('/hooks/use-git-status.js')) {
        return virtual('export function useGitStatus(){ return { status: globalThis.__chipStatus, isGit: true, loading: false, error: null, reload(){} } }')
      }
      if (specifier.endsWith('/cwd-resolver.js')) return virtual("export function useWorkspaceContext(){ return { cwd: '/repo-chip', sessionId: 'chip-session' } }")
      if (specifier.endsWith('/BranchPopover.js')) return virtual('export const BranchPopover = () => null;')
    }
    // The production sources import `./icons.js` while the file on disk is `icons.tsx` (or `.ts`).
    if (specifier.endsWith('.js') && parent.startsWith(sourceRoot)) {
      for (const extension of ['.tsx', '.ts']) {
        const candidate = new URL(specifier.slice(0, -3) + extension, parent)
        if (existsSync(candidate)) return { url: candidate.href, shortCircuit: true }
      }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith(sourceRoot) && (url.endsWith('.ts') || url.endsWith('.tsx'))) {
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
        }).outputText,
      }
    }
    return nextLoad(url, context)
  },
})

const { BranchChip } = await import(chipUrl)
const { BranchPopover } = await import(popoverUrl)

function renderChip(status) {
  globalThis.__chipStatus = status
  return renderToStaticMarkup(React.createElement(BranchChip, { cwd: '/repo-chip', sessionId: 'chip-session' }))
}

/** The real popover, rendered with the same status the capsule sees. */
function renderPopover(status) {
  globalThis.__chipStatus = status
  return renderToStaticMarkup(React.createElement(BranchPopover, {
    view: { current: 'main', branches: [{ name: 'main', current: true }, { name: 'feature/next', current: false }], dirtyFiles: 0 },
    path: '/repo-chip',
    status,
    onSwitch: async () => {},
    onCreateBranch() {},
    onOpenGraph() {},
    onCreateWorktree() {},
    onManageWorktrees() {},
    onClose() {},
  }))
}

/** The markup of one badge span, so an assertion cannot be satisfied by a neighbouring element. */
function badge(markup, className) {
  const start = markup.indexOf(`dsh-git-${className}`)
  assert.notEqual(start, -1, `.dsh-git-${className} is rendered`)
  const end = markup.indexOf('</span>', start)
  return markup.slice(start, end)
}

test('upstream counts are drawn as arrow icons, never as a text arrow glued to the branch name', () => {
  const markup = renderChip({ branch: 'main', ahead: 2, behind: 1, stashCount: 0, dirtyFiles: 0 })

  // The reported defect: `main` + `↑2` reads as "main 12"/"main 13" because the 13px text arrow is
  // a thin vertical stroke. The counts must therefore come from the icon set, and the branch name
  // must stay in its own element.
  assert.match(markup, /class="dsh-git-chip-branch">main</, '分支名独占一个元素')
  assert.doesNotMatch(markup, /[↑↓]/, '胶囊里不得再出现正文 ↑/↓ 字形')

  const ahead = badge(markup, 'ahead')
  assert.match(ahead, /<svg[^>]*viewBox="0 0 24 24"/, '领先计数前是图标箭头')
  assert.match(ahead, /title="领先上游 2 个提交"/)
  assert.match(ahead, /<\/svg>2$/, '图标后面只跟数字')

  const behind = badge(markup, 'behind')
  assert.match(behind, /<svg[^>]*viewBox="0 0 24 24"/, '落后计数前是图标箭头')
  assert.match(behind, /title="落后上游 1 个提交"/)
  assert.match(behind, /<\/svg>1$/, '图标后面只跟数字')
})

test('zero counts still render nothing at all', () => {
  const markup = renderChip({ branch: 'main', ahead: 0, behind: 0, stashCount: 0, dirtyFiles: 0 })
  assert.doesNotMatch(markup, /dsh-git-ahead|dsh-git-behind/)
  assert.doesNotMatch(markup, /[↑↓]/)
  assert.doesNotMatch(markup, /储藏/)
})

test('the popover prints only the diverged side, so a lone lead never drags a zero behind it', () => {
  const markup = renderPopover({ branch: 'main', ahead: 3, behind: 0, stashCount: 0, dirtyFiles: 0 })

  assert.match(markup, /class="dsh-git-diverged"/, '有领先才出现这一行')
  const ahead = badge(markup, 'ahead')
  assert.match(ahead, /title="领先上游 3 个提交"/)
  assert.match(ahead, /<svg[^>]*viewBox="0 0 24 24"/, '领先那一侧用图标箭头')
  assert.match(ahead, /<\/svg>领先 3 个提交$/, '图标后面直接跟文案')
  assert.doesNotMatch(markup, /落后/, '落后 0 个提交不得出现')
  assert.doesNotMatch(markup, /[↑↓]/, '这一行不得再用正文 ↑/↓ 字形')
})

test('the popover shows both pills when both sides diverge, and no row at all when level', () => {
  const both = renderPopover({ branch: 'main', ahead: 2, behind: 1, stashCount: 0, dirtyFiles: 0 })
  assert.match(badge(both, 'ahead'), /<svg[^>]*viewBox="0 0 24 24"[^>]*>[\s\S]*<\/svg>领先 2 个提交$/)
  assert.match(badge(both, 'behind'), /<svg[^>]*viewBox="0 0 24 24"[^>]*>[\s\S]*<\/svg>落后 1 个提交$/)

  const level = renderPopover({ branch: 'main', ahead: 0, behind: 0, stashCount: 0, dirtyFiles: 0 })
  assert.doesNotMatch(level, /dsh-git-diverged/, '与上游一致时这一行整行都不渲染')
  assert.doesNotMatch(level, /领先|落后|储藏/)
})

test('the sheet keeps the badge layout and truncates only the branch name', async () => {
  const { sheetText } = await loadTs('src/client/styles.ts')
  const sheet = sheetText()
  assert.match(sheet, /\.dsh-git-ahead, \.dsh-git-behind \{[^}]*display: inline-flex[^}]*gap: 3px[^}]*padding: 1px 6px 1px 5px[^}]*border-radius: 999px[^}]*font-size: 11px/)
  assert.match(sheet, /\.dsh-git-ahead \{ color: var\(--dsw-alias-brand-primary\); background: color-mix\(in srgb, var\(--dsw-alias-brand-primary\) 13%, transparent\); \}/)
  assert.match(sheet, /\.dsh-git-behind \{ color: var\(--dsw-alias-state-warn-primary\); background: color-mix\(in srgb, var\(--dsw-alias-state-warn-primary\) 14%, transparent\); \}/)
  // The popover row gets its own gutter: it used to sit flush against the card edge.
  assert.match(sheet, /\.dsh-git-diverged \{[^}]*display: flex[^}]*gap: 6px[^}]*padding: 2px 14px 8px/)
  // The ellipsis rule used to hit every direct span child, which also clipped the badges.
  assert.match(sheet, /\.dsh-git-header-controls \.dsh-git-chip > \.dsh-git-chip-branch \{ max-width: 104px/)
  assert.doesNotMatch(sheet, /\.dsh-git-header-controls \.dsh-git-chip > span \{/)
})
