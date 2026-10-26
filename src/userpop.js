// User card: hover (or focus) a username for a moment to see account age, karma and the about text, with a
// bookmark button. Data comes from HN's public API (hacker-news.firebaseio.com), once per user per page.
const USER_API = 'https://hacker-news.firebaseio.com/v0/user/'
const HOVER_DELAY = 350
const users = new Map()
let card = null
let showTimer
let hideTimer

const loadUser = name => {
  if (!users.has(name)) {
    const lookup = fetch(`${USER_API}${encodeURIComponent(name)}.json`).then(r => r.json()).then(u => (u?.id ? u : Promise.reject(new Error('no user'))))
    users.set(name, lookup)
    lookup.catch(() => users.delete(name)) // a failed lookup must not stick: the next hover retries
  }
  return users.get(name)
}

// HN's "about" is HTML; show it as plain text so nothing from it runs or links out of the card.
const aboutText = html => new DOMParser().parseFromString(String(html ?? '').replace(/<p>/gi, '\n\n'), 'text/html').body.textContent.trim()

function memberFor(created) {
  const months = Math.max(0, Math.floor((Date.now() / 1000 - created) / (30.44 * 86400)))
  const years = Math.floor(months / 12)
  if (years >= 1) return `${years} year${years === 1 ? '' : 's'}`
  return months >= 1 ? `${months} month${months === 1 ? '' : 's'}` : 'under a month'
}

function hideCard() {
  clearTimeout(showTimer)
  card?.remove()
  card = null
}

const scheduleHide = () => { clearTimeout(showTimer); clearTimeout(hideTimer); hideTimer = setTimeout(hideCard, 250) }

async function showCard(link) {
  const name = link.textContent.trim()
  hideCard()
  card = h('div', { className: 'hn-usercard', role: 'group', ariaLabel: `About ${name}` }, h('strong', {}, name), h('p', { className: 'hn-muted' }, 'Loading...'))
  const mine = card
  const rect = link.getBoundingClientRect()
  Object.assign(card.style, { left: `${Math.max(8, Math.min(rect.left + scrollX, scrollX + innerWidth - 340))}px`, top: `${rect.bottom + scrollY + 6}px` })
  card.addEventListener('mouseenter', () => clearTimeout(hideTimer))
  card.addEventListener('mouseleave', scheduleHide)
  document.body.append(card)
  try {
    const user = await loadUser(name)
    if (card !== mine) return
    const about = aboutText(user.about)
    const bookmark = bookmarkButton(userEntry(name))
    mine.replaceChildren(
      h('div', { className: 'hn-usercard-head' }, h('strong', {}, name), bookmark),
      h('p', { className: 'hn-muted' }, `Member for ${memberFor(user.created)} · ${Number(user.karma).toLocaleString('en')} karma`),
      about ? h('div', { className: 'hn-about' }, about) : null)
    syncBookmarkButtons()
  } catch {
    if (card === mine) mine.replaceChildren(h('strong', {}, name), h('p', { className: 'hn-muted' }, "Couldn't load this user."))
  }
}

function userLinkAt(target) {
  const link = target.closest?.('a.hnuser')
  if (!link || !document.documentElement.hasAttribute('data-hn-on') || link.closest('.hn-usercard')) return null
  return location.pathname === '/user' && link.closest('tr.athing') ? null : link // a profile page already shows its own user
}

document.addEventListener('mouseover', e => {
  const link = userLinkAt(e.target)
  if (!link) return
  clearTimeout(hideTimer)
  clearTimeout(showTimer)
  showTimer = setTimeout(() => showCard(link), HOVER_DELAY)
})
document.addEventListener('mouseout', e => { if (userLinkAt(e.target)) scheduleHide() })
document.addEventListener('focusin', e => { const link = userLinkAt(e.target); if (link) { clearTimeout(showTimer); showTimer = setTimeout(() => showCard(link), HOVER_DELAY) } })
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideCard() })
