/**
 * Reports what the running client bundle actually loaded.
 *
 * A rebuilt plugin can be invisible for reasons the host cannot see: the renderer may
 * still execute an older bundle, or a document may still carry an older copy of our
 * stylesheet. This posts the measurable facts (which build marker ran, whether the style
 * element holds the current sheet, which font finally won) to the host, which writes them
 * to a file next to the OS temp directory. Diagnostics only — it never affects the UI.
 */

import { appUiFont } from './styles.js'

/** Bump this whenever the client is rebuilt so a report identifies the running build. */
export const CLIENT_BUILD = 'font-cjk-3'

export interface ClientReport {
  build: string
  stylesElement: boolean
  stylesLength: number
  stylesHasFontToken: boolean
  probeUiFont: string
  probeCodeFont: string
  bodyFont: string
  rootFontFamily: string
  appFontToken: string
  codeFontToken: string
  /** The exact body-font chain the sheet was built with on this machine. */
  uiFont: string
  location: string
  reportedAt: string
}

function computedFont(element: Element | null): string {
  if (!element || typeof getComputedStyle !== 'function') return ''
  return getComputedStyle(element).fontFamily || ''
}

export function collectClientReport(build = CLIENT_BUILD): ClientReport {
  const report: ClientReport = {
    build,
    stylesElement: false,
    stylesLength: 0,
    stylesHasFontToken: false,
    probeUiFont: '',
    probeCodeFont: '',
    bodyFont: '',
    rootFontFamily: '',
    appFontToken: '',
    codeFontToken: '',
    uiFont: '',
    location: '',
    reportedAt: '',
  }
  if (typeof document === 'undefined') return report
  try {
    const styleEl = document.getElementById('dsh-plugin-git-styles')
    const text = styleEl?.textContent ?? ''
    report.stylesElement = Boolean(styleEl)
    report.stylesLength = text.length
    // `dsw-font-family` only exists in the sheet that declares the app body font.
    report.stylesHasFontToken = text.includes('dsw-font-family')

    // A detached probe keeps the measurement independent of whether a panel is open.
    const probe = document.createElement('div')
    probe.className = 'dsh-git-panel-form'
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = 'position:fixed;left:-10000px;top:0;width:200px;height:20px'
    const ui = document.createElement('span')
    ui.textContent = '字体'
    const code = document.createElement('code')
    code.textContent = 'master（当前检出）'
    probe.append(ui, code)
    document.body.appendChild(probe)
    report.probeUiFont = computedFont(ui)
    report.probeCodeFont = computedFont(code)
    probe.remove()

    report.bodyFont = computedFont(document.body)
    const root = document.documentElement
    report.rootFontFamily = computedFont(root)
    report.appFontToken = getComputedStyle(root).getPropertyValue('--dsw-font-family').trim()
    report.codeFontToken = getComputedStyle(root).getPropertyValue('--ds-font-family-code').trim()
    report.uiFont = appUiFont()
    report.location = String(globalThis.location?.href ?? '')
    report.reportedAt = new Date().toISOString()
  } catch {
    // A diagnostic must never break the plugin.
  }
  return report
}

/** Families our stack names, plus the ones the app itself may fall back to. */
const PROBE_FAMILIES = [
  'Microsoft YaHei', 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Source Han Sans SC',
  'SimSun', 'NSimSun', 'Consolas', 'Segoe UI', 'JetBrains Mono', 'Cascadia Mono', 'Courier New',
]

/**
 * Which families this machine actually resolves.
 *
 * A font stack is only as good as its first installed name: if every family in our stack is
 * missing, the browser silently falls back to its default CJK font. Canvas measurement is
 * the only reliable test — `document.fonts.check` answers about *pending* web fonts, not
 * about the system.
 */
export function fontAvailability(families: readonly string[] = PROBE_FAMILIES): Record<string, boolean> {
  const available: Record<string, boolean> = {}
  try {
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return available
    const sample = '字体样本 Wg1'
    ctx.font = '32px monospace'
    const base = ctx.measureText(sample).width
    for (const family of families) {
      ctx.font = `32px "${family}", monospace`
      available[family] = Math.abs(ctx.measureText(sample).width - base) > 0.5
    }
  } catch {
    // diagnostics only
  }
  return available
}

export interface ElementFont { selector: string; font: string; weight?: string; size?: string }

export interface PanelDiagnostics {
  found: boolean
  panelFont?: string
  ancestors?: ElementFont[]
  probes?: ElementFont[]
  elements?: ElementFont[]
  availability?: Record<string, boolean>
  fontFaceCount?: number
}

/** The classes whose cascade we care about, measured from *inside* the live panel. */
const PANEL_PROBE_CLASSES = ['dsh-git-panel-form', 'dsh-git-changes-panel', 'dsh-git-worktree-path', 'dsh-git-view-tab']
const PANEL_SAMPLE_SELECTORS = [
  '.dsh-git-panel-heading', '.dsh-git-worktree-path', '.dsh-git-worktree-branch',
  '.dsh-git-view-tab', '.dsh-git-empty-state', '.dsh-git-changes-panel', 'code',
]

function describe(element: Element): string {
  const name = element.tagName.toLowerCase()
  const className = typeof element.className === 'string' ? element.className.trim() : ''
  return className ? `${name}.${className.split(/\s+/).join('.')}` : name
}

function fontOf(element: Element): ElementFont {
  const style = getComputedStyle(element)
  return {
    selector: describe(element),
    font: style.fontFamily || '',
    weight: style.fontWeight || '',
    size: style.fontSize || '',
  }
}

/**
 * Measures the font cascade *inside* the opened panel.
 *
 * A detached probe inside `document.body` already reported the right stack, so if the panel
 * itself renders in another font, the override comes from an ancestor or from a competing
 * rule that only matches inside the sidebar. This walks both directions to name it.
 */
export function collectPanelDiagnostics(root: HTMLElement | null | undefined): PanelDiagnostics {
  if (!root || typeof getComputedStyle !== 'function') return { found: false }
  const result: PanelDiagnostics = { found: true }
  try {
    result.panelFont = getComputedStyle(root).fontFamily || ''

    const ancestors: ElementFont[] = []
    let node: Element | null = root
    for (let depth = 0; node && depth < 8; depth += 1) {
      ancestors.push(fontOf(node))
      node = node.parentElement
    }
    result.ancestors = ancestors

    // Elements are measured only after they join the panel, so the answer is the real cascade.
    const holder = document.createElement('div')
    holder.setAttribute('aria-hidden', 'true')
    holder.style.cssText = 'position:absolute;left:-10000px;top:0;width:240px'
    const made: Array<{ selector: string; element: HTMLElement }> = []
    for (const className of PANEL_PROBE_CLASSES) {
      const element = document.createElement('div')
      element.className = className
      element.textContent = '字体样本 master'
      holder.appendChild(element)
      made.push({ selector: `.${className}`, element })
    }
    const code = document.createElement('code')
    code.textContent = 'master（当前检出）'
    holder.appendChild(code)
    made.push({ selector: 'code', element: code })
    root.appendChild(holder)
    result.probes = made.map(({ selector, element }) => ({ ...fontOf(element), selector }))
    holder.remove()

    const elements: ElementFont[] = []
    for (const selector of PANEL_SAMPLE_SELECTORS) {
      const element = root.querySelector(selector)
      if (element) elements.push({ ...fontOf(element), selector })
    }
    result.elements = elements
    result.availability = fontAvailability()
    result.fontFaceCount = (document as unknown as { fonts?: { size?: number } }).fonts?.size ?? 0
  } catch {
    // diagnostics only
  }
  return result
}

/** Fire-and-forget upload; a failed report leaves no trace in the UI. */
export function reportClientState(source = 'client', panel?: PanelDiagnostics): void {
  try {
    if (typeof fetch !== 'function') return
    void fetch('/dsh-git/client-report', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, ...collectClientReport(), panel }),
    }).catch(() => {})
  } catch {
    // ignore
  }
}
