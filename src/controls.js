// Keyboard shortcuts and the floating control pad. Items are story rows on lists (table or HN's own rows)
// and comments on threads; the pad's four arrows do what j / k / h / l do.
//   j / k  next / previous item        h  previous page, or parent comment
//   l      next page, or next sibling  o  open the story    c  open its comments
//   b      bookmark the item           n / N  next / previous new comment
const SELECTED_CLASS = 'hn-selected'
let selected = null

const shown = el => el.offsetParent !== null

function items() {
  const table = [...document.querySelectorAll('.hn-index tbody tr')]
  if (table.length) return table
  const stories = [...document.querySelectorAll('tr.athing.submission')].filter(tr => !tr.closest('.fatitem') && shown(tr))
  return stories.length ? stories : [...document.querySelectorAll('tr.comtr')].filter(shown)
}

function select(row) {
  selected?.classList.remove(SELECTED_CLASS)
  selected = row
  row.classList.add(SELECTED_CLASS)
  row.scrollIntoView({ block: 'center' })
}

function move(dir) {
  const rows = items()
  if (!rows.length) return
  const at = rows.indexOf(selected)
  select(rows[at < 0 ? (dir > 0 ? 0 : rows.length - 1) : Math.min(rows.length - 1, Math.max(0, at + dir))])
}

// Jump to a comment through one of HN's own '#id' links (parent / next) and select where it lands.
function follow(link) {
  const target = document.getElementById(link.getAttribute('href').slice(1))
  if (target) select(target)
}

const commentLink = (row, word) => [...(row?.querySelectorAll('.comhead a') ?? [])].find(a => a.textContent.trim() === word && a.getAttribute('href')?.startsWith('#'))
const onThread = () => selected?.classList.contains('comtr')

function left() {
  const link = onThread() && commentLink(selected, 'parent')
  link ? follow(link) : history.back()
}

function right() {
  const link = onThread() ? commentLink(selected, 'next') : document.querySelector('a.morelink')
  if (!link) return
  onThread() ? follow(link) : link.click()
}

const rowLink = (row, selector) => row?.querySelector(selector) ?? row?.nextElementSibling?.querySelector(selector)
const openStory = () => rowLink(selected, '.hn-title a, .titleline > a')?.click()
const openComments = () => (selected?.querySelector('.hn-comments a') ?? [...(selected?.nextElementSibling?.querySelectorAll('.subline a') ?? [])].find(a => /comment|discuss/.test(a.textContent)))?.click()
const bookmarkSelected = () => rowLink(selected, '.hn-bm')?.click()

const KEYS = {
  j: () => move(1), k: () => move(-1), h: left, l: right, o: openStory, c: openComments, b: bookmarkSelected,
  n: () => jumpNew?.(1), N: () => jumpNew?.(-1),
}

const typing = el => el?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')

document.addEventListener('keydown', e => {
  const action = KEYS[e.key]
  if (!action || e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || !document.documentElement.hasAttribute('data-hn-on')) return
  e.preventDefault()
  action()
})

function buildPad() {
  if (document.querySelector('.hn-pad') || !document.querySelector('#hnmain')) return
  document.body.append(h('div', { className: 'hn-pad', role: 'group', ariaLabel: 'Navigation' },
    iconButton('Previous item', 'up', () => move(-1), 'hn-pad-up'),
    iconButton('Previous page or parent comment', 'up', left, 'hn-pad-left'),
    iconButton('Next page or next comment at this level', 'up', right, 'hn-pad-right'),
    iconButton('Next item', 'up', () => move(1), 'hn-pad-down')))
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', buildPad, { once: true }) : buildPad()
