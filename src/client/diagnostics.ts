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
export const CLIENT_BUILD = 'overlay-census-1'

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

interface Rect { x: number; y: number; width: number; height: number }

interface PseudoFacts {
  content: string
  width: string
  height: string
  opacity: string
  backgroundImage: string
  backgroundColor: string
  inset: string
}

export interface GradientHit {
  selector: string
  /** 'self' when the element's own background is a gradient, otherwise the pseudo that is. */
  which: string
  rect: Rect
  position: string
  zIndex: string
  opacity: string
  backgroundImage: string
  backgroundSize: string
  pseudoOpacity: string
  pseudoContent: string
}

export interface ThinElement {
  selector: string
  rect: Rect
  position: string
  zIndex: string
  opacity: string
  backgroundImage: string
  backgroundColor: string
  borderLeft: string
  boxShadow: string
  before: PseudoFacts
  after: PseudoFacts
}

export interface OverlayDiagnostics {
  viewport: { width: number; height: number; dpr: number; scrollX: number; scrollY: number }
  panel: Rect | null
  totalElements: number
  /** Anything whose box or pseudo paints a gradient and overlaps the panel: the line's painters. */
  gradients: GradientHit[]
  /** Thin vertical elements of the shell that overlap the panel: the stray-line candidates. */
  thin: ThinElement[]
  /** Every dock divider, whether or not it is thin: their geometry names the culprit. */
  dividers: Array<{ selector: string; rect: Rect; zIndex: string; hovered: boolean; before: PseudoFacts; after: PseudoFacts }>
  cells: Array<{ rect: Rect; zIndex: string; className: string; hasPanel: boolean }>
  /** What the topmost non-panel element is at a coarse grid of points over the panel. */
  hits: Array<{ x: number; y: number; selectors: string[] }>
  /** The chain under the pointer, if anything is hovered: a hover-only glow explains a line that appears on hover. */
  hoveredChain: string[]
  /** Non-default cursors met while walking a horizontal line across the panel: a live drag affordance. */
  cursorZones: Array<{ x: number; cursor: string; selector: string }>
}

function rectOf(element: Element): Rect {
  const box = element.getBoundingClientRect()
  return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) }
}

function selectorOf(element: Element): string {
  const name = element.tagName.toLowerCase()
  const className = typeof element.className === 'string' ? element.className.trim() : ''
  const id = element.id ? `#${element.id}` : ''
  const classes = className ? `.${className.split(/\s+/).slice(0, 3).join('.')}` : ''
  return `${name}${id}${classes}`
}

function pseudoFacts(element: Element, which: '::before' | '::after'): PseudoFacts {
  const empty: PseudoFacts = { content: '', width: '', height: '', opacity: '', backgroundImage: '', backgroundColor: '', inset: '' }
  try {
    const style = getComputedStyle(element, which)
    return {
      content: style.content || '',
      width: style.width || '',
      height: style.height || '',
      opacity: style.opacity || '',
      backgroundImage: style.backgroundImage || '',
      backgroundColor: style.backgroundColor || '',
      inset: `${style.top} ${style.right} ${style.bottom} ${style.left}`,
    }
  } catch {
    return empty
  }
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function isHovered(element: Element): boolean {
  try {
    return element.matches(':hover')
  } catch {
    return false
  }
}

/**
 * Names whatever the shell paints on top of the workbench.
 *
 * The panel fills its dock cell, so a visible hairline *inside* it can only come from an element
 * that is not ours and sits higher in the stacking order. This reports the thin vertical
 * candidates, every dock divider, and the topmost foreign element at a coarse grid of points, so
 * a stray line can be attributed to an actual node instead of guessed from a screenshot. Called
 * without a root it inspects the whole viewport, which is what catches a line outside the panel.
 */
export function collectOverlayDiagnostics(root?: HTMLElement | null): OverlayDiagnostics {
  const result: OverlayDiagnostics = {
    viewport: {
      width: globalThis.innerWidth || 0,
      height: globalThis.innerHeight || 0,
      dpr: globalThis.devicePixelRatio || 1,
      scrollX: globalThis.scrollX || 0,
      scrollY: globalThis.scrollY || 0,
    },
    panel: null,
    totalElements: 0,
    gradients: [],
    thin: [],
    dividers: [],
    cells: [],
    hits: [],
    hoveredChain: [],
    cursorZones: [],
  }
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return result
  try {
    const panelRect: Rect = root
      ? rectOf(root)
      : { x: 0, y: 0, width: result.viewport.width, height: result.viewport.height }
    result.panel = root ? panelRect : null
    const all = document.querySelectorAll('*')
    result.totalElements = all.length
    for (const element of all) {
      if (root && (root.contains(element) || element === root)) continue
      const rect = rectOf(element)
      if (!overlaps(rect, panelRect)) continue
      const classList = typeof element.className === 'string' ? element.className : ''
      if (element.hasAttribute('data-dockkit-divider')) {
        result.dividers.push({
          selector: selectorOf(element),
          rect,
          zIndex: getComputedStyle(element).zIndex,
          hovered: isHovered(element),
          before: pseudoFacts(element, '::before'),
          after: pseudoFacts(element, '::after'),
        })
      }
      if (element.hasAttribute('data-dockkit-cell')) {
        result.cells.push({
          rect,
          zIndex: getComputedStyle(element).zIndex,
          className: classList.slice(0, 80),
          hasPanel: Boolean(root && element.contains(root)),
        })
      }
      const style = getComputedStyle(element)
      const before = pseudoFacts(element, '::before')
      const after = pseudoFacts(element, '::after')
      // A hairline can be painted by a wide box whose *background* is a 1px-wide gradient, so the
      // painting element is reported on its own, outside the thin-element filter.
      const painted = (facts: PseudoFacts) => Boolean(facts.content) && facts.content !== 'none' && facts.backgroundImage.includes('gradient')
      const which = style.backgroundImage.includes('gradient') ? 'self' : painted(before) ? '::before' : painted(after) ? '::after' : ''
      if (which && result.gradients.length < 20) {
        const facts = which === 'self'
          ? { content: '', width: style.width, height: style.height, opacity: style.opacity, backgroundImage: style.backgroundImage, backgroundColor: style.backgroundColor, inset: '' }
          : which === '::before' ? before : after
        result.gradients.push({
          selector: selectorOf(element),
          which,
          rect,
          position: style.position,
          zIndex: style.zIndex,
          opacity: style.opacity,
          backgroundImage: facts.backgroundImage.slice(0, 160),
          backgroundSize: facts.width + ' ' + facts.height,
          pseudoOpacity: facts.opacity,
          pseudoContent: facts.content,
        })
      }
      if (rect.width > 8 || rect.height < 8 || result.thin.length >= 20) continue
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
        after,
      })
    }
    const stepX = Math.max(40, Math.round(panelRect.width / 12))
    for (let x = panelRect.x + stepX; x < panelRect.x + panelRect.width && result.hits.length < 40; x += stepX) {
      for (const ratio of [0.2, 0.4, 0.6, 0.8]) {
        const y = Math.round(panelRect.y + panelRect.height * ratio)
        const stack = document.elementsFromPoint(x, y) || []
        const foreign = stack
          .filter(element => !(root && (root.contains(element) || element === root)) && element !== document.documentElement && element !== document.body)
          .slice(0, 3)
          .map(selectorOf)
        if (foreign.length) result.hits.push({ x, y, selectors: foreign })
      }
    }
    result.hoveredChain = Array.from(document.querySelectorAll(':hover')).slice(-6).map(selectorOf)
    // A hidden bar can still leave a live drag zone, so walk a horizontal line across the panel and
    // report every pointer shape that is not the default: that is the affordance itself.
    const midY = Math.round(panelRect.y + panelRect.height / 2)
    let previous = ''
    for (let x = panelRect.x + 2; x < panelRect.x + panelRect.width && result.cursorZones.length < 12; x += 4) {
      const top = document.elementFromPoint(x, midY)
      if (!top) continue
      const cursor = getComputedStyle(top).cursor || ''
      const signature = cursor + '|' + selectorOf(top)
      if (!cursor || cursor === 'auto' || cursor === 'default' || signature === previous) continue
      previous = signature
      result.cursorZones.push({ x, cursor, selector: selectorOf(top) })
    }
  } catch {
    // diagnostics only
  }
  return result
}

/** Fire-and-forget upload; a failed report leaves no trace in the UI. */
export function reportClientState(source = 'client', panel?: PanelDiagnostics, overlay?: OverlayDiagnostics): void {
  try {
    if (typeof fetch !== 'function') return
    void fetch('/dsh-git/client-report', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, ...collectClientReport(), panel, overlay }),
    }).catch(() => {})
  } catch {
    // ignore
  }
}
