import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadTs } from './helpers/load-ts.mjs'

const { collectOverlayDiagnostics } = await loadTs('src/client/diagnostics.ts')

const EMPTY_STYLE = {
  content: '',
  width: '',
  height: '',
  opacity: '',
  backgroundImage: 'none',
  backgroundColor: 'rgba(0, 0, 0, 0)',
  top: '',
  right: '',
  bottom: '',
  left: '',
  zIndex: 'auto',
  position: 'static',
  borderLeftWidth: '0px',
  borderLeftColor: '',
  boxShadow: 'none',
  cursor: 'auto',
}

function box(x, y, width, height) {
  return { x, y, width, height, top: y, left: x, right: x + width, bottom: y + height }
}

function element({ tag = 'div', id = '', className = '', rect, attributes = [] } = {}) {
  const node = {
    tagName: tag.toUpperCase(),
    id,
    className,
    attributes: new Set(attributes),
    children: [],
    hasAttribute: name => node.attributes.has(name),
    contains: other => other === node || node.children.some(child => child.contains(other)),
    getBoundingClientRect: () => rect,
  }
  return node
}

/** Installs a fake document whose only elements are the ones handed in, then removes it again. */
function withDom({ nodes, styles = new Map(), stack = [], root }) {
  const documentElement = element({ tag: 'html', rect: box(0, 0, 1920, 1080) })
  const body = element({ tag: 'body', rect: box(0, 0, 1920, 1080), className: 'dsh-app' })
  documentElement.children.push(body)
  for (const node of nodes) if (node !== documentElement && node !== body) body.children.push(node)
  const document = {
    documentElement,
    body,
    querySelectorAll: () => [documentElement, body, ...nodes],
    elementsFromPoint: () => stack,
    elementFromPoint: () => null,
  }
  const previous = {
    document: globalThis.document,
    getComputedStyle: globalThis.getComputedStyle,
    innerWidth: globalThis.innerWidth,
    innerHeight: globalThis.innerHeight,
  }
  globalThis.document = document
  globalThis.getComputedStyle = (target, pseudo) => styles.get(target)?.[pseudo ?? 'self'] ?? EMPTY_STYLE
  globalThis.innerWidth = 1920
  globalThis.innerHeight = 1080
  return {
    run: () => collectOverlayDiagnostics(root),
    restore: () => {
      globalThis.document = previous.document
      globalThis.getComputedStyle = previous.getComputedStyle
      globalThis.innerWidth = previous.innerWidth
      globalThis.innerHeight = previous.innerHeight
    },
  }
}

test('overlay diagnostics names the dock divider that paints a stray hairline', () => {
  const panel = element({ className: 'dsh-git-workbench', rect: box(430, 100, 1200, 700) })
  const cell = element({ className: 'tabCell', rect: box(420, 90, 1400, 900), attributes: ['data-dockkit-cell'] })
  const divider = element({ className: 'divider', rect: box(646, 320, 0, 96), attributes: ['data-dockkit-divider'] })
  cell.children.push(panel)
  const ghost = element({ className: 'ghost', rect: box(646, 320, 2, 96) })

  const styles = new Map([
    [cell, { self: { ...EMPTY_STYLE, zIndex: '10', position: 'relative' } }],
    [divider, {
      self: { ...EMPTY_STYLE, zIndex: '11', position: 'relative' },
      '::after': {
        ...EMPTY_STYLE,
        content: '""',
        width: '1px',
        height: '96px',
        opacity: '0',
        backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0), rgb(173, 178, 184) 50%, rgba(0, 0, 0, 0))',
      },
    }],
    [ghost, { self: { ...EMPTY_STYLE, position: 'absolute', borderLeftWidth: '2px', borderLeftColor: 'rgb(229, 229, 229)' } }],
  ])

  const dom = withDom({ nodes: [cell, divider, ghost], styles, root: panel })
  try {
    const report = dom.run()
    assert.equal(report.panel.width, 1200)
    assert.equal(report.dividers.length, 1)
    assert.equal(report.dividers[0].zIndex, '11', 'the divider sits above the panel: z-index names the culprit')
    assert.match(report.dividers[0].after.backgroundImage, /gradient/, 'the hover glow is a gradient, not a solid colour')

    const gradient = report.gradients.find(hit => hit.which === '::after')
    assert.ok(gradient, 'the gradient painter is reported even though the divider box is zero pixels wide')
    assert.equal(gradient.pseudoOpacity, '0')
    assert.equal(gradient.backgroundSize, '1px 96px')

    const thin = report.thin.map(entry => entry.selector)
    assert.deepEqual(thin, ['div.divider', 'div.ghost'], 'the zero-width divider and the foreign 2px box are the only thin candidates')
  } finally {
    dom.restore()
  }
})

test('overlay diagnostics ignores the panel subtree and everything that misses it', () => {
  const panel = element({ className: 'dsh-git-workbench', rect: box(430, 100, 800, 600) })
  const inside = element({ className: 'dsh-git-split-handle', rect: box(700, 200, 1, 300) })
  const outside = element({ className: 'far-away', rect: box(100, 100, 1, 300) })
  panel.children.push(inside)

  const dom = withDom({ nodes: [panel, inside, outside], root: panel })
  try {
    const report = dom.run()
    assert.equal(report.totalElements, 5, 'html, body, panel, and the two children')
    assert.deepEqual(report.thin, [], 'elements inside the panel are ours; elements that miss the panel cannot paint over it')
  } finally {
    dom.restore()
  }
})

test('overlay diagnostics finds a drag affordance that only shows through the pointer shape', () => {
  const panel = element({ className: 'dsh-git-workbench', rect: box(430, 100, 400, 400) })
  const handle = element({ className: 'Dc7zOa_widthHandle', rect: box(646, 100, 10, 400) })
  const dom = withDom({
    nodes: [panel, handle],
    styles: new Map([[handle, { self: { ...EMPTY_STYLE, cursor: 'col-resize' } }]]),
    root: panel,
  })
  globalThis.document.elementFromPoint = () => handle
  try {
    const report = dom.run()
    assert.deepEqual(report.cursorZones.map(zone => zone.cursor), ['col-resize'])
    assert.equal(report.cursorZones[0].selector, 'div.Dc7zOa_widthHandle')
    assert.equal(report.cursorZones[0].x, 432, 'the row walk starts inside the panel')
  } finally {
    dom.restore()
  }
})

test('overlay diagnostics reports what sits on top of the panel, skipping the document scaffolding', () => {
  const panel = element({ className: 'dsh-git-workbench', rect: box(430, 100, 400, 400) })
  const foreign = element({ className: 'tabLayoutDivider', rect: box(646, 100, 0, 400), attributes: ['data-dockkit-divider'] })
  const dom = withDom({ nodes: [panel, foreign], root: panel })
  const documentElement = globalThis.document.documentElement
  const body = globalThis.document.body
  const stack = [foreign, documentElement, body]
  globalThis.document.elementsFromPoint = () => stack
  try {
    const report = dom.run()
    assert.ok(report.hits.length > 0)
    for (const hit of report.hits) assert.deepEqual(hit.selectors, ['div.tabLayoutDivider'])
  } finally {
    dom.restore()
  }
})

test('overlay diagnostics stays empty when there is no panel to inspect', () => {
  const report = collectOverlayDiagnostics(null)
  assert.equal(report.panel, null)
  assert.deepEqual(report.thin, [])
  assert.deepEqual(report.gradients, [])
  assert.equal(report.totalElements, 0)
})

test('overlay diagnostics inspects the whole viewport when called without a panel', () => {
  const far = element({ className: 'chat-column', rect: box(495, 560, 2, 96) })
  const dom = withDom({ nodes: [far], styles: new Map([[far, { self: { ...EMPTY_STYLE, borderLeftWidth: '2px', borderLeftColor: 'rgb(229, 229, 229)' } }]]) })
  try {
    const report = dom.run()
    assert.equal(report.panel, null, 'the whole window is the region of interest')
    assert.deepEqual(report.thin.map(entry => entry.selector), ['div.chat-column'])
  } finally {
    dom.restore()
  }
})
