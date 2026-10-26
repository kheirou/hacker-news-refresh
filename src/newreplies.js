// New replies: remember each story's comments when you open it. Lists then show an orange "N new" badge,
// and reopening the thread marks the comments that appeared since, with arrows to step through them.
const SEEN_MAX = 300
let jumpNew = null // set on a thread with new comments; shortcuts (controls.js) reuse it

const seenKey = id => `seen:${id}`
const countOf = text => Number((text ?? '').replace(/\D/g, '')) || 0
const storyPage = () => location.pathname === '/item' && document.querySelector('.fatitem .titleline') && document.querySelector('.fatitem tr.athing')

function sessionGet(key) { try { return JSON.parse(sessionStorage.getItem(key)) } catch { return null } }
function sessionSet(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode: marks just won't survive a reload */ } }

function newBar(ids) {
  let at = -1
  const go = dir => {
    at = (at + dir + ids.length) % ids.length
    document.querySelectorAll('.hn-current').forEach(n => n.classList.remove('hn-current'))
    const row = document.getElementById(ids[at])
    row.classList.add('hn-current')
    row.scrollIntoView({ block: 'center' })
  }
  jumpNew = go
  return h('div', { className: 'hn-newbar', role: 'group', ariaLabel: 'New comments' },
    h('span', {}, `${ids.length} new`), iconButton('Previous new comment', 'up', () => go(-1), 'hn-prev'), iconButton('Next new comment', 'up', () => go(1), 'hn-next'))
}

async function trackThread() {
  const story = storyPage()
  if (!story) return
  const id = story.id
  const ids = [...document.querySelectorAll('tr.comtr')].map(tr => tr.id)
  const previous = (await kv.get(seenKey(id)))[seenKey(id)]
  const page = Number(new URLSearchParams(location.search).get('p')) || 1 // long threads are paged: ?p=2 holds only its own comments
  const known = new Set(previous?.ids)
  // New = on a page you have opened before and not seen then. Marks are also kept per tab, so a reload keeps them
  // and still picks up comments that arrived since the last load.
  const visited = previous?.pages ?? [1]
  const arrived = previous && visited.includes(page) ? ids.filter(c => !known.has(c)) : []
  const key = `hn-new-${id}`
  const cached = sessionGet(key)
  const fresh = [...new Set([...(Array.isArray(cached) ? cached : []), ...arrived])].filter(c => ids.includes(c))
  sessionSet(key, fresh)
  for (const c of fresh) document.getElementById(c)?.classList.add('hn-new')
  if (fresh.length) document.body.append(newBar(fresh))
  const count = countOf(document.querySelector('.fatitem .subline a[href^="item"]:last-of-type')?.textContent) || ids.length
  await kv.set({ [seenKey(id)]: { count, ids: [...new Set([...known, ...ids])], pages: [...new Set([...(previous ? visited : []), page])], t: Date.now() } })
  await trimItems('seen:', SEEN_MAX)
}

function badge(host, entry, count) {
  const delta = entry ? count - entry.count : 0
  if (delta > 0) host.append(h('span', { className: 'hn-new-badge' }, `${delta} new`))
}

async function decorateNewReplies() {
  const ids = [...document.querySelectorAll('.hn-index tbody tr, tr.athing.submission')].map(tr => tr.dataset.id ?? tr.id)
  const seen = await kv.get(ids.map(seenKey)) // only the stories on this page
  // Remove and re-add with no await in between: overlapping calls must not leave duplicates.
  document.querySelectorAll('.hn-new-badge').forEach(n => n.remove())
  for (const tr of document.querySelectorAll('.hn-index tbody tr')) {
    const td = tr.querySelector('td.hn-comments')
    const link = td?.querySelector('a')
    if (link) badge(td, seen[seenKey(tr.dataset.id)], countOf(link.textContent))
  }
  for (const tr of document.querySelectorAll('tr.athing.submission')) {
    if (tr.closest('.fatitem')) continue // the thread you are reading: its new comments are marked instead
    const link = [...(tr.nextElementSibling?.querySelectorAll('.subline a') ?? [])].find(a => /comment/.test(a.textContent))
    if (link) badge(link.parentElement, seen[seenKey(tr.id)], countOf(link.textContent))
  }
}

browser.storage.onChanged.addListener(changes => { if (!storyPage() && changedPrefix(changes, 'seen:')) decorateNewReplies() })
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', () => (trackThread(), decorateNewReplies()), { once: true })
  : (trackThread(), decorateNewReplies())
