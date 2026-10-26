// Selection toolbar: select text in a story or comment and a small bar offers highlight (saved as a bookmark),
// quote in reply, copy, read aloud and search HN. Only shown while the redesign is on.
const TEXT_SELECTOR = '.commtext, .toptext'
let selbar = null

function textHash(text) {
  let x = 2166136261
  for (const ch of text) x = Math.imul(x ^ ch.codePointAt(0), 16777619)
  return (x >>> 0).toString(36)
}

function readSelection() {
  const sel = getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null
  const range = sel.getRangeAt(0)
  const node = range.commonAncestorContainer
  const host = (node.nodeType === 1 ? node : node.parentElement)?.closest(TEXT_SELECTOR)
  const text = sel.toString().trim()
  if (!host || text.length < 2) return null
  const id = host.closest('tr.comtr')?.id ?? document.querySelector('.fatitem tr.athing')?.id
  return id ? { range, host, text, id } : null
}

function hideSelectionBar() { selbar?.remove(); selbar = null }

function quoteIntoReply({ host, text }) {
  const quote = `${text.split(/\n+/).map(l => `> ${l.trim()}`).join('\n\n')}\n\n`
  const link = host.closest('.comment')?.querySelector('.reply a[href^="reply?id="]')
  if (link) return openReply(link, quote)
  const box = document.querySelector('form[action="comment"] textarea')
  if (box) { box.value += quote; box.scrollIntoView({ block: 'center' }); box.focus() }
}

function speak(text) {
  if (speechSynthesis.speaking) return speechSynthesis.cancel()
  speechSynthesis.speak(new SpeechSynthesisUtterance(text))
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text) } catch { document.execCommand('copy') }
}

function showSelectionBar(info) {
  hideSelectionBar()
  const entry = {
    key: `highlight:${info.id}:${textHash(info.text)}`, type: 'highlight', title: info.text.replace(/\s+/g, ' ').slice(0, 200),
    text: info.text.slice(0, 2000), url: `${HN}item?id=${info.id}`,
  }
  const highlight = iconButton('Highlight', 'bookmark', async () => { await toggleBookmark(entry); sync() })
  const sync = () => kv.get(bmKey(entry.key)).then(saved => highlight.setAttribute('aria-pressed', String(bmKey(entry.key) in saved)))
  const search = h('a', { href: `https://hn.algolia.com/?q=${encodeURIComponent(info.text.replace(/\s+/g, ' ').slice(0, 100))}`, className: 'hn-iconbtn', ariaLabel: 'Search HN', title: 'Search HN', target: '_blank', rel: 'noopener' }, icon('search'))
  selbar = h('div', { className: 'hn-selbar', role: 'toolbar', ariaLabel: 'Selection' },
    highlight, iconButton('Quote in reply', 'quote', () => quoteIntoReply(info)), iconButton('Copy', 'copy', () => copyText(info.text)),
    iconButton('Read aloud', 'speaker', () => speak(info.text)), search)
  selbar.addEventListener('mousedown', e => e.preventDefault()) // keep the selection while clicking the bar
  const rect = info.range.getBoundingClientRect()
  Object.assign(selbar.style, { left: `${Math.max(8, rect.left + scrollX)}px`, top: `${Math.max(8, rect.top + scrollY - 52)}px` })
  document.body.append(selbar)
  sync()
}

function updateSelectionBar() {
  const info = document.documentElement.hasAttribute('data-hn-on') && readSelection()
  info ? showSelectionBar(info) : hideSelectionBar()
}

document.addEventListener('mouseup', e => { if (!selbar?.contains(e.target)) setTimeout(updateSelectionBar, 0) })
document.addEventListener('keyup', e => { if (e.shiftKey || e.key === 'Escape') updateSelectionBar() })
document.addEventListener('mousedown', e => { if (selbar && !selbar.contains(e.target)) hideSelectionBar() })
document.addEventListener('selectionchange', () => { if (selbar && getSelection().isCollapsed) hideSelectionBar() })
