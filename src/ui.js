// Small DOM helpers shared by every content script: element builder, inline SVG icons, dropdown panels.
// No innerHTML anywhere: everything is built with createElement / textContent.

function h(tag, props = {}, ...kids) {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...kids.flat().filter(k => k != null && k !== false))
  return node
}

// Round icon button; `cls` adds classes, `onClick` is optional.
function iconButton(label, name, onClick, cls = '') {
  const b = h('button', { type: 'button', className: `hn-iconbtn ${cls}`.trim(), ariaLabel: label, title: label }, icon(name))
  if (onClick) b.addEventListener('click', onClick)
  return b
}

const SVG_NS = 'http://www.w3.org/2000/svg'
// Own stroke icons on a 24x24 grid. {d} = path, {c: [cx, cy, r]} = circle.
const ICONS = {
  history: [{ d: 'M3 12a9 9 0 1 0 3-6.7' }, { d: 'M3 4v5h5' }, { d: 'M12 7v5l3 2' }],
  user: [{ c: [12, 8, 4] }, { d: 'M4 21c0-4 4-6 8-6s8 2 8 6' }],
  search: [{ c: [11, 11, 7] }, { d: 'M20 20l-4-4' }],
  chevron: [{ d: 'M6 9l6 6 6-6' }],
  dots: [{ c: [5, 12, 1.4] }, { c: [12, 12, 1.4] }, { c: [19, 12, 1.4] }],
  bookmark: [{ d: 'M6 3h12v18l-6-4-6 4z' }],
  check: [{ d: 'M5 12l5 5 9-10' }],
  quote: [{ d: 'M5 18v-4a5 5 0 0 1 4-5' }, { d: 'M5 14h4v4H5z' }, { d: 'M14 18v-4a5 5 0 0 1 4-5' }, { d: 'M14 14h4v4h-4z' }],
  copy: [{ d: 'M9 9h11v11H9z' }, { d: 'M5 15V4h11' }],
  speaker: [{ d: 'M4 9v6h4l5 4V5L8 9z' }, { d: 'M16.5 9a4 4 0 0 1 0 6' }, { d: 'M19 6.5a8 8 0 0 1 0 11' }],
  up: [{ d: 'M6 15l6-6 6 6' }],
  close: [{ d: 'M6 6l12 12' }, { d: 'M18 6L6 18' }],
  calendar: [{ d: 'M4 6h16v14H4z' }, { d: 'M4 10h16' }, { d: 'M8 3v4' }, { d: 'M16 3v4' }],
}

function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  return node
}

// Our own mark: a rounded accent square with a white H.
function brandMark() {
  const svg = svgEl('svg', { viewBox: '0 0 96 96', 'aria-hidden': 'true', class: 'hn-mark' })
  svg.append(svgEl('rect', { width: 96, height: 96, rx: 20, fill: 'var(--accent)' }),
    ...[[26, 24, 12, 48], [58, 24, 12, 48], [26, 42, 44, 12]].map(([x, y, w, h]) => svgEl('rect', { x, y, width: w, height: h, rx: 3, fill: '#fff' })))
  return svg
}

function icon(name) {
  const svg = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'hn-icon' })
  for (const part of ICONS[name]) svg.append(part.c ? svgEl('circle', { cx: part.c[0], cy: part.c[1], r: part.c[2] }) : svgEl('path', { d: part.d }))
  return svg
}

// A dropdown panel opened by a trigger: one open at a time, closes on outside click or Esc (focus goes back to the trigger).
const openPanels = new Set()

function makePanel(trigger, panel, { onOpen } = {}) {
  panel.hidden = true
  trigger.setAttribute('aria-expanded', 'false')
  const entry = {
    trigger,
    close() {
      panel.hidden = true
      trigger.setAttribute('aria-expanded', 'false')
      openPanels.delete(entry)
    },
  }
  const open = () => {
    closePanels()
    panel.hidden = false
    trigger.setAttribute('aria-expanded', 'true')
    openPanels.add(entry)
    onOpen?.()
    panel.querySelector('a, button, input, select')?.focus()
  }
  // Tabbing out of an open panel closes it (the trigger itself is still a valid next stop).
  panel.addEventListener('focusout', e => {
    if (e.relatedTarget && !panel.contains(e.relatedTarget) && e.relatedTarget !== trigger) entry.close()
  })
  trigger.addEventListener('click', e => {
    e.stopPropagation()
    panel.hidden ? open() : entry.close()
  })
  panel.addEventListener('click', e => e.stopPropagation())
  return { open, close: entry.close }
}

const closePanels = () => [...openPanels].forEach(p => p.close())
document.addEventListener('click', closePanels)
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !openPanels.size) return
  const last = [...openPanels].pop()
  closePanels()
  last.trigger.focus()
})
