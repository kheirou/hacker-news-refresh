// The redesigned page frame: header (section tabs + toolbar) and the heading above story lists.
// HN's own header stays in the DOM (CSS hides it while the redesign is on), so account details are read from it.
const SECTIONS = [['Top', '/news'], ['Ask', '/ask'], ['Show', '/show'], ['Best', '/best'], ['New', '/newest'], ['Active', '/active']]
const MORE = [['past', '/front'], ['comments', '/newcomments'], ['jobs', '/jobs'], ['submit', '/submit']]
const SECTION_PATHS = { '/': 'Top', '/news': 'Top', '/ask': 'Ask', '/show': 'Show', '/best': 'Best', '/newest': 'New', '/active': 'Active' }

function readAccount() {
  const me = document.querySelector('#me')
  return {
    name: me?.textContent.trim() ?? '',
    karma: document.querySelector('#karma')?.textContent.trim() ?? '',
    logout: document.querySelector('#logout')?.getAttribute('href') ?? 'logout',
    login: document.querySelector('a[href^="login"]')?.getAttribute('href') ?? 'login',
  }
}

function popup(trigger, panel, options) {
  const wrap = h('div', { className: 'hn-pop' }, trigger, panel)
  const control = makePanel(trigger, panel, options)
  return { wrap, ...control }
}

function accountPanel(account) {
  const id = encodeURIComponent(account.name)
  const links = [['Submissions', `submitted?id=${id}`], ['Comments', `threads?id=${id}`], ['Favorites', `favorites?id=${id}`], ['Upvoted', `upvoted?id=${id}`], ['Hidden', 'hidden']]
  if (!account.name) return h('div', { className: 'hn-panel hn-menu' }, h('a', { href: account.login }, 'Log in'))
  return h('div', { className: 'hn-panel hn-account-card' },
    h('div', { className: 'hn-account-top' },
      h('span', { className: 'hn-avatar', ariaHidden: 'true' }, account.name[0]),
      h('div', {}, h('strong', {}, account.name), h('div', { className: 'hn-muted' }, `${account.karma} karma`))),
    h('div', { className: 'hn-account-links' }, ...links.map(([text, href]) => h('a', { href }, text))),
    h('a', { href: account.logout, className: 'hn-account-out' }, 'Log out'))
}

function historyPanel() {
  const list = h('ol', { className: 'hn-history' })
  const clear = h('button', { type: 'button', className: 'hn-link' }, 'Clear')
  const panel = h('div', { className: 'hn-panel hn-history-panel' }, h('div', { className: 'hn-panel-title' }, 'Recently viewed', clear), list)
  const show = (history = []) => list.replaceChildren(...(history.length
    ? history.slice(0, 20).map(e => h('li', {}, h('a', { href: `item?id=${e.id}` }, e.title)))
    : [h('li', { className: 'hn-muted' }, 'Nothing yet')]))
  clear.addEventListener('click', () => removeItems('history:').then(() => show()))
  const refresh = () => listItems('history:').then(show)
  return { panel, refresh }
}

function sectionTabs() {
  const current = SECTION_PATHS[location.pathname]
  const tabs = SECTIONS.map(([text, href]) => h('a', { href, className: 'hn-tab', ...(text === current ? { ariaCurrent: 'page' } : {}) }, text))
  const more = popup(
    iconButton('More sections', 'chevron', null, 'hn-more'),
    h('div', { className: 'hn-panel hn-menu hn-left' }, ...MORE.map(([text, href]) => h('a', { href }, text))))
  return h('nav', { className: 'hn-sections', ariaLabel: 'Sections' }, ...tabs, more.wrap)
}

function buildHeader() {
  const account = readAccount()
  const settings = settingsPanel()
  const settingsPop = popup(h('button', { type: 'button', className: 'hn-iconbtn', ariaLabel: 'Appearance and settings', title: 'Appearance and settings' }, h('span', { className: 'hn-aa' }, h('small', {}, 'A'), 'A')), settings.panel, { onOpen: settings.refresh })
  const bookmarks = bookmarksPanel()
  const bookmarksPop = popup(iconButton('Bookmarks', 'bookmark'), bookmarks.panel, { onOpen: bookmarks.refresh })
  const history = historyPanel()
  const historyPop = popup(iconButton('History', 'history'), history.panel, { onOpen: history.refresh })
  const accountPop = popup(iconButton('Account', 'user'), accountPanel(account))
  settings.closeButton.addEventListener('click', settingsPop.close)
  const search = h('a', { href: 'https://hn.algolia.com/', className: 'hn-iconbtn', ariaLabel: 'Search', title: 'Search' }, icon('search'))
  const brand = h('a', { href: '/news', className: 'hn-brand', ariaLabel: 'Hacker News home' }, brandMark(), h('span', { className: 'hn-brand-text' }, 'Hacker News'))
  return h('header', { className: 'hn-header' }, brand, sectionTabs(), h('div', { className: 'hn-toolbar' }, settingsPop.wrap, bookmarksPop.wrap, historyPop.wrap, accountPop.wrap, search))
}

function headingDate() {
  const day = new URLSearchParams(location.search).get('day')
  const [y, m, d] = (day ?? '').split('-').map(Number)
  return location.pathname === '/front' && y ? new Date(y, m - 1, d) : new Date()
}

function datePicker() {
  const input = h('input', { type: 'date', ariaLabel: 'Go to a day', max: new Date().toLocaleDateString('en-CA'), value: headingDate().toLocaleDateString('en-CA') })
  input.addEventListener('change', () => { if (input.value) location.href = `front?day=${input.value}` })
  const panel = h('div', { className: 'hn-panel' }, h('label', { className: 'hn-datepick' }, h('span', { className: 'hn-muted' }, 'Front page of'), input))
  return popup(iconButton('Go to a day', 'calendar'), panel).wrap
}

function headingParts() {
  const date = headingDate()
  return {
    weekday: new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(date),
    rest: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(date),
    year: String(date.getFullYear()),
  }
}

function buildHeading() {
  const section = SECTION_PATHS[location.pathname]
  if (!section && location.pathname !== '/front') return null
  const title = section && section !== 'Top'
    ? h('h1', {}, h('span', { className: 'hn-day' }, section))
    : (({ weekday, rest, year }) => h('h1', {}, h('span', { className: 'hn-day' }, weekday), h('span', { className: 'hn-date' }, rest), h('span', { className: 'hn-year' }, year)))(headingParts())
  const dated = !section || section === 'Top'
  return [h('div', { className: 'hn-heading' }, title, h('div', { className: 'hn-heading-tools' }, dated ? datePicker() : null)), viewBar().bar]
}

function buildShell() {
  const main = document.querySelector('#hnmain')
  if (!main || document.querySelector('.hn-header')) return
  document.body.prepend(buildHeader())
  const heading = buildHeading() // [heading, view bar] on list pages
  const cell = document.querySelector('#bigbox > td')
  if (heading && cell) cell.prepend(...heading)
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', buildShell, { once: true }) : buildShell()
