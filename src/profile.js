// Profile tabs: HN's trailing profile links (submissions, comments, ...) become a tab bar. Hidden by CSS unless the redesign is on.
const PROFILE_LINK = /^(submitted|threads|favorites|upvoted|hidden)\b/

function profileTabs() {
  if (location.pathname !== '/user') return
  const rows = [...document.querySelectorAll('#bigbox tr')].filter(tr => tr.cells.length === 2 && !tr.cells[0].textContent.trim() && PROFILE_LINK.test(tr.querySelector('a')?.getAttribute('href') ?? ''))
  if (!rows.length) return
  const nav = h('nav', { className: 'hn-tabs' })
  for (const tr of rows) {
    const a = tr.querySelector('a')
    nav.append(h('a', { href: a.getAttribute('href') }, a.textContent))
    tr.classList.add('hn-tabrow')
  }
  rows[0].closest('table').before(nav)
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', profileTabs, { once: true }) : profileTabs()
