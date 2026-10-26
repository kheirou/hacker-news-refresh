// Bookmarks for stories, comments, users (and highlights, added by highlight.js): kept in storage.local,
// no account. A bookmark button sits next to each item; the toolbar panel lists them and backs them up as JSON.
const BOOKMARK_TYPES = [['story', 'Stories'], ['comment', 'Comments'], ['highlight', 'Highlights'], ['user', 'Users']]
const BM_MAX = 2000
const HN = 'https://news.ycombinator.com/'

const loadBookmarks = () => listItems('bm:')

const bmKey = key => `bm:${key}`

async function toggleBookmark(entry) {
  if ((await kv.get(bmKey(entry.key)))[bmKey(entry.key)]) return kv.remove(bmKey(entry.key))
  await kv.set({ [bmKey(entry.key)]: { ...entry, t: Date.now() } })
  await trimItems('bm:', BM_MAX)
}

const removeBookmark = key => kv.remove(bmKey(key))

function bookmarkButton(entry) {
  const b = h('button', { type: 'button', className: 'hn-bm', ariaLabel: `Bookmark: ${entry.title}`, title: 'Bookmark' }, icon('bookmark'))
  b.dataset.key = entry.key
  b.setAttribute('aria-pressed', 'false')
  b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggleBookmark(entry) })
  return b
}

// Reads only the keys of the buttons on this page, never the whole store.
async function syncBookmarkButtons() {
  const buttons = [...document.querySelectorAll('.hn-bm')]
  const saved = await kv.get(buttons.map(b => bmKey(b.dataset.key)))
  for (const b of buttons) b.setAttribute('aria-pressed', String(bmKey(b.dataset.key) in saved))
}

const storyEntry = (id, link) => ({ key: `story:${id}`, type: 'story', title: link.textContent.trim(), url: link.href, hn: `${HN}item?id=${id}` })
const userEntry = name => ({ key: `user:${name}`, type: 'user', title: name, url: `${HN}user?id=${encodeURIComponent(name)}` })
function commentEntry(tr) {
  const who = tr.querySelector('.hnuser')?.textContent ?? ''
  const text = tr.querySelector('.commtext')?.textContent.trim().replace(/\s+/g, ' ').slice(0, 120) ?? ''
  return { key: `comment:${tr.id}`, type: 'comment', title: `${who}: ${text}`, url: `${HN}item?id=${tr.id}` }
}

// Idempotent: safe to call again after the table is rebuilt.
function decorateBookmarks() {
  for (const tr of document.querySelectorAll('.hn-index tbody tr')) {
    const td = tr.querySelector('td.hn-title')
    const link = td?.querySelector('a')
    if (td && link && !td.querySelector('.hn-bm')) td.append(bookmarkButton(storyEntry(tr.dataset.id, link)))
  }
  for (const tr of document.querySelectorAll('tr.athing.submission')) {
    const sub = tr.nextElementSibling?.querySelector('.subline')
    const link = tr.querySelector('.titleline > a')
    if (sub && link && !sub.querySelector('.hn-bm')) sub.append(bookmarkButton(storyEntry(tr.id, link)))
  }
  for (const tr of document.querySelectorAll('tr.comtr')) {
    const head = tr.querySelector('.comhead')
    if (head && !head.querySelector('.hn-bm')) head.append(bookmarkButton(commentEntry(tr)))
  }
  const who = location.pathname === '/user' && document.querySelector('#bigbox a.hnuser')
  if (who && !who.parentElement.querySelector('.hn-bm')) who.after(bookmarkButton(userEntry(who.textContent.trim())))
  syncBookmarkButtons()
}

// Backups: the file is untrusted input, so keep only known fields and http(s) links.
const BM_FIELDS = ['key', 'type', 'title', 'url', 'hn', 'text', 't']
const validBookmark = b => b && typeof b.key === 'string' && BOOKMARK_TYPES.some(([type]) => b.key.startsWith(`${type}:`) && b.type === type)
  && typeof b.title === 'string' && /^https?:\/\//.test(b.url)

function cleanBookmark(b) {
  const out = {}
  for (const f of BM_FIELDS) if (typeof b[f] === 'string' || (f === 't' && typeof b[f] === 'number')) out[f] = typeof b[f] === 'string' ? b[f].slice(0, f === 'text' ? 2000 : 400) : b[f]
  if (out.hn && !/^https?:\/\//.test(out.hn)) delete out.hn
  return out
}

function parseBackup(text) {
  let data
  try { data = JSON.parse(text) } catch { throw new Error('That file is not valid JSON.') }
  if (data?.app !== 'hacker-news-refresh' || !Array.isArray(data.bookmarks)) throw new Error('That file is not a Hacker News Refresh backup.')
  const bookmarks = data.bookmarks.filter(validBookmark).map(cleanBookmark).slice(0, BM_MAX)
  const settings = Object.fromEntries(Object.entries(data.settings ?? {}).filter(([k, v]) =>
    k in DEFAULTS && typeof v === typeof DEFAULTS[k] && Array.isArray(v) === Array.isArray(DEFAULTS[k]) && (!Array.isArray(v) || v.every(x => typeof x === 'string'))))
  for (const [key, [min, max]] of Object.entries(LIMITS)) if (key in settings) settings[key] = Math.min(max, Math.max(min, settings[key]))
  return { bookmarks, settings, skipped: data.bookmarks.length - bookmarks.length }
}

async function exportBackup() {
  const settings = await kv.get(Object.keys(DEFAULTS))
  const data = { app: 'hacker-news-refresh', version: 1, exported: new Date().toISOString(), bookmarks: await loadBookmarks(), settings }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = h('a', { href: url, download: `hacker-news-refresh-backup-${data.exported.slice(0, 10)}.json` })
  a.addEventListener('click', e => e.stopPropagation()) // a synthetic click must not close the open panel
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

async function importBackup(text) {
  const { bookmarks, settings, skipped } = parseBackup(text)
  // One key per bookmark, so a bookmark in the file replaces the same one here and the rest stay.
  await kv.set({ ...Object.fromEntries(bookmarks.map(b => [bmKey(b.key), { ...b, t: b.t ?? Date.now() }])), ...settings })
  await trimItems('bm:', BM_MAX)
  return { count: bookmarks.length, skipped }
}

function bookmarksPanel() {
  const list = h('div', { className: 'hn-bm-list' })
  const status = h('p', { className: 'hn-note', role: 'status' })
  const picker = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, ariaLabel: 'Backup file to import' })
  const exportBtn = h('button', { type: 'button', className: 'hn-link' }, 'Export')
  const importBtn = h('button', { type: 'button', className: 'hn-link' }, 'Import')
  const panel = h('div', { className: 'hn-panel hn-bookmarks' }, h('div', { className: 'hn-panel-title' }, 'Bookmarks', h('span', { className: 'hn-actions' }, exportBtn, importBtn)), list, status, picker)

  const show = (bookmarks = []) => {
    const groups = BOOKMARK_TYPES.map(([type, label]) => [label, bookmarks.filter(b => b.type === type)]).filter(([, items]) => items.length)
    list.replaceChildren(...(groups.length ? groups.flatMap(([label, items]) => [
      h('h3', { className: 'hn-bm-group' }, label),
      h('ul', {}, ...items.map(b => {
        const remove = h('button', { type: 'button', className: 'hn-bm-remove', ariaLabel: `Remove bookmark: ${b.title}`, title: 'Remove' }, '×')
        remove.addEventListener('click', () => removeBookmark(b.key))
        return h('li', {}, h('a', { href: b.url }, b.title), b.hn ? h('a', { href: b.hn, className: 'hn-muted' }, 'discussion') : null, remove)
      })),
    ]) : [h('p', { className: 'hn-muted' }, 'No bookmarks yet. Use the bookmark icon next to a story, comment or user.')]))
  }
  const refresh = () => loadBookmarks().then(show)

  exportBtn.addEventListener('click', () => exportBackup().then(() => { status.textContent = 'Backup downloaded.' }))
  importBtn.addEventListener('click', () => picker.click())
  picker.addEventListener('change', async () => {
    const file = picker.files[0]
    picker.value = ''
    if (!file) return
    try {
      const { count, skipped } = await importBackup(await file.text())
      status.textContent = `Imported ${count} bookmark${count === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} invalid` : ''}.`
    } catch (e) {
      status.textContent = e.message
    }
  })
  browser.storage.onChanged.addListener(changes => { if (!panel.hidden && changedPrefix(changes, 'bm:')) refresh() })
  return { panel, refresh }
}

browser.storage.onChanged.addListener(changes => { if (changedPrefix(changes, 'bm:')) syncBookmarkButtons() })
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', decorateBookmarks, { once: true }) : decorateBookmarks()
