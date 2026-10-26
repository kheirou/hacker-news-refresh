// Table view of story lists (front page, new, ask, jobs...). Reads HN's own rows, never rewrites them.
// 'site' is not a column: when selected, the domain is shown inline after the title.
const COLUMNS = Object.fromEntries(COLUMN_DEFS.filter(d => d[1] !== null).map(d => [d[0], d[1]]))

const num = text => (text ? text.replace(/\D/g, '') : '')
const shortAge = text => text.replace(/ ago$/, '').replace(/\bminutes\b/, 'mins').replace(/\bminute\b/, 'min')

function parseRows(doc) {
  if (doc.querySelector('.fatitem')) return []
  return [...doc.querySelectorAll('tr.athing:not(.comtr)')].flatMap(tr => {
    const link = tr.querySelector('.titleline > a')
    if (!link) return []
    const meta = tr.nextElementSibling
    const comments = [...(meta?.querySelectorAll('.subline a') ?? [])].find(a => /comment|discuss/.test(a.textContent))
    return [{
      id: tr.id,
      rank: num(tr.querySelector('.rank')?.textContent),
      title: link,
      site: tr.querySelector('.sitestr')?.textContent ?? '',
      points: num(meta?.querySelector('.score')?.textContent),
      by: meta?.querySelector('.hnuser') ?? null,
      age: meta?.querySelector('.age a') ?? null,
      comments: comments ? { href: comments.href, text: /\d/.test(comments.textContent) ? num(comments.textContent) : '0' } : null,
    }]
  })
}

function cell(doc, col, row, showSite) {
  const td = doc.createElement('td')
  td.className = `hn-${col}`
  const value = row[col]
  if (col === 'age' && value) {
    const a = value.cloneNode(true)
    a.textContent = shortAge(a.textContent)
    td.append(a)
  } else if (value instanceof Element) {
    td.append(value.cloneNode(true))
    if (col === 'title' && showSite && row.site) td.append(Object.assign(doc.createElement('span'), { className: 'hn-site', textContent: ` (${row.site})` }))
  } else if (col === 'comments' && value) {
    const a = doc.createElement('a')
    a.href = value.href
    a.textContent = value.text
    td.append(a)
  } else if (typeof value === 'string') {
    td.textContent = col === 'rank' && value ? `${value}.` : value
  }
  return td
}

function buildTable(doc, rows, columns, showSite) {
  const table = doc.createElement('table')
  table.className = 'hn-index'
  const head = table.createTHead().insertRow()
  for (const col of columns) {
    const th = doc.createElement('th')
    th.className = `hn-${col}`
    th.textContent = COLUMNS[col]
    if (col === 'rank') th.setAttribute('aria-label', 'Rank')
    head.append(th)
  }
  const body = table.createTBody()
  for (const row of rows) {
    const tr = body.insertRow()
    tr.dataset.id = row.id
    tr.append(...columns.map(col => cell(doc, col, row, showSite)))
  }
  return table
}

function buildIndex(s, doc) {
  const rows = parseRows(doc)
  const list = doc.querySelector('tr.athing')?.closest('table')
  if (!rows.length || !list) return
  const columns = Object.keys(COLUMNS).filter(c => c === 'title' || s.columns.includes(c)) // a table without the story is useless
  list.before(buildTable(doc, rows, columns, s.columns.includes('site')))
  doc.documentElement.setAttribute('data-hn-table', '')
}

// "Open links in new tab": story links only, and only ones this extension changed are put back.
function setLinkTargets(s, doc) {
  const blank = s.on && s.newTab
  for (const a of doc.querySelectorAll('.titleline > a, .hn-index td.hn-title > a')) {
    if (blank) Object.assign(a, { target: '_blank', rel: 'noopener' }).dataset.hnBlank = ''
    else if (a.dataset.hnBlank !== undefined) { a.removeAttribute('target'); a.removeAttribute('rel'); delete a.dataset.hnBlank }
  }
}

function renderIndex(s, doc = document) {
  doc.querySelector('.hn-index')?.remove()
  doc.documentElement.removeAttribute('data-hn-table')
  if (s.on && s.view === 'table') buildIndex(s, doc)
  setLinkTargets(s, doc)
  decorateBookmarks()
  decorateNewReplies()
}

// Runs at document_start, so wait for the rows to exist.
const renderWhenReady = s =>
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => renderIndex(s), { once: true }) : renderIndex(s)
