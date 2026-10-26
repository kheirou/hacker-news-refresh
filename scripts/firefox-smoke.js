// Real-Firefox smoke test: loads src/ as a temporary add-on in headless Firefox and checks it against live HN.
// Not part of dev:ci (needs network and a Firefox install): run it with `mise run smoke:firefox`.
const path = require('node:path')
const { launch, sleep } = require('./firefox')

const failures = []
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + detail}`); if (!ok) failures.push(name) }

async function main() {
  const { driver, ID, install, onExtensionPage, setStorage, getStorage, probe, load, shot } = await launch({
    out: path.resolve(__dirname, '..', 'web-ext-artifacts'), size: { width: 1280, height: 900 },
  })
  try {
    check('add-on installs', (await install()) === ID)

    await load('https://news.ycombinator.com/')
    const base = await probe(() => ({ on: document.documentElement.hasAttribute('data-hn-on'), bg: getComputedStyle(document.body).backgroundColor }))
    check('redesign applies by default', base.on && base.bg !== 'rgba(0, 0, 0, 0)', JSON.stringify(base))
    await shot('front-default')

    const frame = await probe(() => ({
      tabs: [...document.querySelectorAll('.hn-tab')].map(a => a.textContent),
      current: document.querySelector('.hn-tab[aria-current]')?.textContent,
      heading: document.querySelector('.hn-heading h1')?.textContent,
      headerHeight: document.querySelector('.hn-header')?.getBoundingClientRect().height,
      hnHeaderHidden: getComputedStyle(document.querySelector('.pagetop')).display === 'none' || document.querySelector('.pagetop').getBoundingClientRect().height === 0,
    }))
    check('header with six tabs, Top current, date heading', frame.tabs.length === 6 && frame.current === 'Top' && /\d{4}/.test(frame.heading) && frame.headerHeight > 40, JSON.stringify(frame))
    check("HN's own header is hidden", frame.hnHeaderHidden, JSON.stringify(frame))
    const tools = await probe(() => ({
      pad: document.querySelector('.hn-pad')?.getBoundingClientRect().height > 0,
      picker: !!document.querySelector('button[aria-label="Go to a day"]'),
    }))
    check('control pad and date picker are there', tools.pad && tools.picker, JSON.stringify(tools))
    await driver.executeScript(() => document.querySelector('button[aria-label="History"]').click())
    const panel = await probe(() => document.querySelector('.hn-history-panel')?.getBoundingClientRect().height > 0)
    check('history panel opens from the toolbar', panel === true)
    await shot('front-history-panel')

    // The real controls: settings drawer tile, then the view bar, through the page's own storage round trip.
    const click = label => driver.executeScript(l => document.querySelector(`[aria-label="${l}"]`).click(), label)
    await click('Appearance and settings')
    await sleep(200)
    await click('Slate theme')
    await sleep(500)
    check('settings drawer: a theme tile switches the theme through real storage', (await probe(() => document.documentElement.dataset.hnTheme)) === 'slate')
    await shot('front-settings-panel')
    await driver.executeScript(() => document.body.click())
    await driver.executeScript(() => [...document.querySelectorAll('.hn-seg button')].find(b => b.textContent === 'List').click())
    await sleep(500)
    check('view bar: List removes the table', (await probe(() => document.querySelectorAll('.hn-index').length)) === 0)
    check('view bar: columns hide in list view', (await probe(() => document.querySelector('.hn-viewgroup[aria-label="Columns"]').hidden)) === true)
    const listShape = await probe(() => {
      const col = document.querySelector('#hnmain').getBoundingClientRect()
      const title = document.querySelector('tr.athing .titleline').getBoundingClientRect()
      const rank = document.querySelector('tr.athing td').getBoundingClientRect()
      return { colX: Math.round(col.x), titleX: Math.round(title.x), rankWidth: Math.round(rank.width) }
    })
    check('list view keeps its shape (stories not squeezed to the right edge)', listShape.rankWidth < 120 && listShape.titleX < listShape.colX + 200, JSON.stringify(listShape))
    await shot('front-list-view')

    await setStorage({ theme: 'dark', view: 'table' })
    await load('https://news.ycombinator.com/')
    const dark = await probe(() => ({
      bg: getComputedStyle(document.body).backgroundColor,
      rows: document.querySelectorAll('.hn-index tbody tr').length,
      more: document.querySelector('.morelink').getBoundingClientRect().height > 0,
    }))
    check('dark theme from storage', dark.bg === 'rgb(29, 29, 34)', JSON.stringify(dark))
    check('table view builds 30 rows and keeps More', dark.rows === 30 && dark.more, JSON.stringify(dark))
    await shot('front-dark-table')

    // The sliders must reach the cells (HN has no doctype, so tables reset font size and line height in quirks mode).
    await setStorage({ size: 22, line: 2 })
    await sleep(500)
    const big = await probe(() => { const td = getComputedStyle(document.querySelector('.hn-index td.hn-title')); return [td.fontSize, td.lineHeight] })
    check('font size and line height sliders reach the table cells', big[0] === '22px' && big[1] === '44px', JSON.stringify(big))
    await setStorage({ size: 16, line: 1.4 })
    await sleep(500)

    // The bundled Inter must really load from the extension on HN (its page security rules could block it).
    await setStorage({ font: 'inter' })
    await sleep(500)
    const inter = await driver.executeAsyncScript(done => document.fonts.load('16px "HN Redesign Inter"').then(
      faces => done({ faces: faces.length, loaded: document.fonts.check('16px "HN Redesign Inter"'), status: faces.map(f => f.status), family: getComputedStyle(document.querySelector('.hn-index td.hn-title')).fontFamily }),
      e => done({ error: String(e) })))
    check('bundled Inter loads on HN', inter.loaded === true && inter.faces >= 1 && inter.status?.every(s => s === 'loaded'), JSON.stringify(inter))
    await shot('front-inter')
    await driver.executeScript(() => document.querySelector('[aria-label="Appearance and settings"]').click())
    await sleep(600)
    check('no false "Inter couldn\'t load" warning when it did load', await probe(() => document.querySelector('.hn-warn').hidden === true))
    await driver.executeScript(() => document.body.click())
    await setStorage({ font: 'sans' })
    await sleep(500)

    await driver.executeScript(() => document.querySelector('.hn-index tbody tr .hn-bm').click())
    await sleep(500)
    check('bookmark button toggles in the table', (await probe(() => document.querySelector('.hn-index tbody tr .hn-bm').getAttribute('aria-pressed'))) === 'true')
    await driver.executeScript(() => document.querySelector('button[aria-label="Bookmarks"]').click())
    await sleep(300)
    const listed = await probe(() => [...document.querySelectorAll('.hn-bm-list li a:first-child')].length)
    check('bookmarks panel lists it', listed === 1, String(listed))
    await shot('front-bookmarks-panel')
    await driver.executeScript(() => document.body.click())

    // A real thread: new-comment marks (seen is rewound, then the page reloaded) and the selection toolbar.
    const storyId = await probe(() => document.querySelector('.hn-index tbody tr').dataset.id)
    await load(`https://news.ycombinator.com/item?id=${storyId}`)
    const seen = (await getStorage())[`seen:${storyId}`]
    check('thread is remembered in seen', Array.isArray(seen?.ids) && seen.ids.length > 2, JSON.stringify(seen && seen.ids.length))
    check('story page decorates comments with bookmark buttons', (await probe(() => document.querySelectorAll('tr.comtr .hn-bm').length)) > 2)
    await setStorage({ [`seen:${storyId}`]: { ...seen, ids: seen.ids.slice(0, -2), count: 0 } })
    await driver.executeScript(() => sessionStorage.clear()) // marks are cached per tab; forget the first visit's
    await load(`https://news.ycombinator.com/item?id=${storyId}`)
    const marks = await probe(() => ({ marked: document.querySelectorAll('tr.hn-new').length, bar: document.querySelector('.hn-newbar')?.textContent }))
    check('comments missing from seen are marked new, with the arrow bar', marks.marked === 2 && /2 new/.test(marks.bar), JSON.stringify(marks))
    await shot('thread-new-comments')
    await driver.executeScript(() => {
      const el = document.querySelector('tr.comtr .commtext')
      const range = document.createRange()
      range.selectNodeContents(el)
      getSelection().removeAllRanges()
      getSelection().addRange(range)
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
    await sleep(300)
    check('selection toolbar appears with five actions', (await probe(() => document.querySelectorAll('.hn-selbar [aria-label]').length)) === 5)
    await driver.executeScript(() => document.querySelector('.hn-selbar [aria-label="Highlight"]').click())
    await sleep(500)
    check('highlight is saved as a bookmark', Object.entries(await getStorage()).some(([k, v]) => k.startsWith('bm:') && v.type === 'highlight'))
    await shot('thread-selection-bar')

    await driver.executeScript(() => { getSelection().removeAllRanges(); document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) })
    await driver.actions().sendKeys('j').perform()
    await sleep(300)
    check('keyboard: j selects the first comment', (await probe(() => document.querySelector('tr.hn-selected')?.classList.contains('comtr'))) === true)
    await driver.executeScript(() => document.querySelector('tr.comtr a.hnuser').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
    await sleep(3000) // hover delay + a real request to hacker-news.firebaseio.com from the content script
    const card = await probe(() => document.querySelector('.hn-usercard')?.textContent ?? '')
    check('user card loads from the HN API in real Firefox', /Member for .* karma/.test(card), card)
    await shot('thread-user-card')

    // Three overlapping bookmark writes through the extension's own code on real storage: none may be lost.
    const kept = await onExtensionPage(async () => {
      for (const file of ['defaults.js', 'store.js', 'ui.js', 'bookmarks.js']) {
        await driver.executeAsyncScript((f, done) => { const s = document.createElement('script'); s.src = f; s.onload = () => done(); document.head.append(s) }, file)
      }
      return driver.executeAsyncScript(async done => {
        const entry = n => ({ key: `story:race${n}`, type: 'story', title: `race ${n}`, url: 'https://example.com' })
        await Promise.all([1, 2, 3].map(n => toggleBookmark(entry(n))))
        done(Object.keys(await browser.storage.local.get(null)).filter(k => k.startsWith('bm:story:race')).length)
      })
    })
    check('three overlapping bookmark writes all stick on real storage', kept === 3, String(kept))

    await setStorage({ on: false })
    await load('https://news.ycombinator.com/')
    const off = await probe(() => ({ bg: getComputedStyle(document.body).backgroundColor, table: document.querySelectorAll('.hn-index').length }))
    check('off restores the original design', off.bg === 'rgba(0, 0, 0, 0)' && off.table === 0, JSON.stringify(off))
  } finally {
    await driver.quit()
  }
  if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1) }
  console.log('\nall checks passed')
}

main().catch(e => { console.error('FAIL', e.message); process.exit(1) })
