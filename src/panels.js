// Settings drawer (Aa button: one scrolling page with Colour, Text, Page, Reading, About) and the inline view bar
// above story lists. Every control writes storage.local; content.js re-applies it live, so nothing here touches
// the page directly.
const THEMES = [['light', 'Light'], ['classic', 'Classic'], ['slate', 'Slate'], ['dark', 'Dark'], ['black', 'Black']]
const FONTS = [['sans', 'Sans'], ['serif', 'Serif'], ['inter', 'Inter']]
// Switches: [setting, label, one-line description]
const COLOUR_SWITCH = ['autoDark', 'Follow system dark mode', 'Switches between light and dark with your system.']
const PAGE_SWITCHES = [
  ['fixedHeader', 'Keep the header in view', 'The tabs stay at the top while you scroll.'],
  ['newTab', 'Open stories in a new tab', 'Story links open in a new tab.'],
  ['hoverIcons', 'Hide vote arrows until hover', 'Quieter rows: arrows appear under the pointer.'],
  ['controlPad', 'Show the navigation pad', 'Arrow buttons for moving between stories and comments.'],
]
const READING_SWITCHES = [
  ['smoothing', 'Smooth text edges', 'Anti-aliased text where your system supports it.'],
  ['fade', 'Dim stories you have opened', 'Visited stories fade back.'],
  ['justify', 'Justify comments', 'Comment text lines up on both edges.'],
]
const COLUMN_LABELS = COLUMN_DEFS.map(d => [d[0], d[2]])

const SHORTCUTS = [
  ['j / k', 'Next / previous story or comment'], ['h / l', 'Previous page or parent / next page or sibling'], ['o', 'Open the story'],
  ['c', 'Open its comments'], ['b', 'Bookmark it'], ['n / N', 'Next / previous new comment'],
]

const save = patch => browser.storage.local.set(patch)
const section = (title, ...kids) => h('section', { className: 'hn-sec' }, h('h3', { className: 'hn-sec-title' }, title), ...kids)
const press = (button, on) => button.setAttribute('aria-pressed', String(on))

// A missing font never errors, it silently shows the next one: ask the browser whether Inter really loaded.
const interLoaded = () => document.fonts.load('16px "Hacker News Refresh Inter"').then(faces => faces.length > 0 && faces.every(f => f.status === 'loaded'), () => false)

// Text size / line spacing / page width: a slider with its value and -/+ buttons for exact steps.
function stepper(key, label, [min, max, step], format) {
  const input = h('input', { type: 'range', min, max, step, ariaLabel: label })
  const out = h('output', {})
  const set = value => save({ [key]: Math.min(max, Math.max(min, Math.round(value * 100) / 100)) })
  const button = (text, name, dir) => {
    const b = h('button', { type: 'button', className: 'hn-stepbtn', ariaLabel: `${name} ${label.toLowerCase()}` }, text)
    b.addEventListener('click', () => set(Number(input.value) + dir * step))
    return b
  }
  input.addEventListener('input', () => { out.textContent = format(input.value); set(Number(input.value)) })
  const row = h('div', { className: 'hn-step' }, h('span', { className: 'hn-step-label' }, label), button('-', 'Decrease', -1), out, button('+', 'Increase', 1), input)
  return { row, sync: s => { if (document.activeElement !== input) input.value = s[key]; out.textContent = format(s[key]) } }
}

function toggle([key, label, description]) {
  const input = h('input', { type: 'checkbox', role: 'switch', ariaLabel: label })
  input.addEventListener('change', () => save({ [key]: input.checked }))
  const row = h('label', { className: 'hn-switch' }, h('span', { className: 'hn-switch-text' }, h('strong', {}, label), h('small', {}, description)), input)
  return { row, sync: s => { input.checked = !!s[key] } }
}

function colourSection() {
  const tiles = THEMES.map(([key, label]) => {
    const b = h('button', { type: 'button', className: 'hn-tile', ariaLabel: `${label} theme`, title: `${label} theme` }, h('span', { className: 'hn-tile-sample' }, 'Aa'), h('span', { className: 'hn-tile-name' }, label))
    b.dataset.theme = key // the tile redraws itself with that theme's own colours (see the theme rules in content.css)
    b.addEventListener('click', () => save({ theme: key }))
    return { key, b }
  })
  const auto = toggle(COLOUR_SWITCH)
  const el = section('Colour', h('div', { className: 'hn-tiles' }, ...tiles.map(t => t.b)), auto.row)
  return { el, sync: s => { tiles.forEach(t => press(t.b, s.theme === t.key)); auto.sync(s) } }
}

function textSection() {
  const fonts = FONTS.map(([key, label]) => {
    const b = h('button', { type: 'button', className: `hn-font-${key}` }, label)
    b.addEventListener('click', () => save({ font: key }))
    return { key, b }
  })
  const warn = h('p', { className: 'hn-warn', role: 'status', hidden: true }, "Inter couldn't load, so your system font is showing. Reload the extension (about:debugging) or restart Firefox.")
  const steppers = [stepper('size', 'Text size', LIMITS.size, v => `${v}px`), stepper('line', 'Line spacing', LIMITS.line, v => Number(v).toFixed(1)), stepper('width', 'Page width', LIMITS.width, v => `${v}px`)]
  const el = section('Text', h('div', { className: 'hn-seg', role: 'group', ariaLabel: 'Typeface' }, ...fonts.map(f => f.b)), warn, ...steppers.map(s => s.row))
  return {
    el,
    sync: s => {
      fonts.forEach(f => press(f.b, s.font === f.key))
      steppers.forEach(x => x.sync(s))
      warn.hidden = true
      if (s.font === 'inter') interLoaded().then(ok => { warn.hidden = ok })
    },
  }
}

function switchSection(title, defs) {
  const rows = defs.map(toggle)
  return { el: section(title, ...rows.map(r => r.row)), sync: s => rows.forEach(r => r.sync(s)) }
}

function aboutSection() {
  const original = h('button', { type: 'button', className: 'hn-link' }, 'Use the original design')
  original.addEventListener('click', () => save({ on: false }))
  const el = section('About',
    h('p', {}, 'Hacker News Refresh ', h('strong', {}, browser.runtime.getManifest().version)),
    h('p', { className: 'hn-muted' }, 'A cleaner, themeable Hacker News. Settings, history and bookmarks stay in this browser. The only requests go to Hacker News itself: replies, and a profile lookup when you hover a username.'),
    h('p', { className: 'hn-muted' }, 'Not endorsed by, affiliated with, or sponsored by Y Combinator.'),
    h('h4', { className: 'hn-subtitle' }, 'Keyboard shortcuts'),
    h('dl', { className: 'hn-keys' }, ...SHORTCUTS.flatMap(([keys, what]) => [h('dt', {}, keys), h('dd', {}, what)])),
    h('div', { className: 'hn-note' }, original, ' (turn it back on from the toolbar button)'))
  return { el, sync() {} }
}

function settingsPanel() {
  const parts = [colourSection(), textSection(), switchSection('Page', PAGE_SWITCHES), switchSection('Reading', READING_SWITCHES), aboutSection()]
  const closeButton = iconButton('Close settings', 'close')
  const panel = h('aside', { className: 'hn-drawer', role: 'dialog', ariaLabel: 'Settings' },
    h('div', { className: 'hn-drawer-head' }, h('h2', {}, 'Settings'), closeButton),
    h('div', { className: 'hn-drawer-body' }, ...parts.map(p => p.el)))
  const refresh = () => browser.storage.local.get(DEFAULTS).then(s => parts.forEach(p => p.sync(s)))
  browser.storage.onChanged.addListener(changes => { if (!panel.hidden && settingsChanged(changes)) refresh() })
  return { panel, refresh, closeButton }
}

// The bar under the heading: show as Table | List, which columns, bold titles. Always visible, always in step with storage.
function viewBar() {
  const views = [['table', 'Table'], ['list', 'List']].map(([key, label]) => {
    const b = h('button', { type: 'button' }, label)
    b.addEventListener('click', () => save({ view: key }))
    return { key, b }
  })
  let current = DEFAULTS
  const chips = COLUMN_LABELS.filter(([key]) => key !== 'title').map(([key, label]) => { // the story column is always shown, so it has no chip
    const b = h('button', { type: 'button', className: 'hn-chip' }, label)
    b.addEventListener('click', () => {
      const on = new Set(current.columns)
      on.has(key) ? on.delete(key) : on.add(key)
      save({ columns: COLUMN_LABELS.map(c => c[0]).filter(k => k === 'title' || on.has(k)) })
    })
    return { key, b }
  })
  const bold = h('button', { type: 'button', className: 'hn-chip' }, 'Bold story titles')
  bold.addEventListener('click', () => save({ boldTitle: !current.boldTitle }))
  const columns = h('div', { className: 'hn-viewgroup', role: 'group', ariaLabel: 'Columns' }, h('span', { className: 'hn-viewlabel' }, 'Columns'), ...chips.map(c => c.b))
  const bar = h('div', { className: 'hn-viewbar', role: 'group', ariaLabel: 'Story list options' },
    h('div', { className: 'hn-viewgroup' }, h('span', { className: 'hn-viewlabel' }, 'Show as'), h('div', { className: 'hn-seg', role: 'group', ariaLabel: 'Show stories as' }, ...views.map(v => v.b))),
    columns, bold)
  const refresh = () => browser.storage.local.get(DEFAULTS).then(s => {
    current = s
    views.forEach(v => press(v.b, s.view === v.key))
    chips.forEach(c => press(c.b, s.columns.includes(c.key)))
    press(bold, s.boldTitle)
    columns.hidden = s.view !== 'table' // columns only matter in the table
  })
  browser.storage.onChanged.addListener(changes => { if (settingsChanged(changes)) refresh() })
  refresh()
  return { bar, refresh }
}
