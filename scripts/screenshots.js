// Store screenshots (1280x800) taken in real Firefox against live HN, written to docs/screenshots/.
// Public pages only, logged out. Run with `mise run screenshots`.
const path = require('node:path')
const { launch, sleep } = require('./firefox')

async function main() {
  const { driver, install, setStorage, getStorage, probe, load, shot: save } = await launch({ out: path.resolve(__dirname, '..', 'docs', 'screenshots') })
  const shot = async name => { await save(name); console.log('wrote', name) }
  const click = label => driver.executeScript(l => document.querySelector(`[aria-label="${l}"]`).click(), label)

  try {
    await install()
    // Make the viewport exactly 1280x800.
    await driver.manage().window().setRect({ width: 1280, height: 900 })
    const inner = await probe(() => window.innerHeight)
    await driver.manage().window().setRect({ width: 1280, height: 900 + (800 - inner) })

    await setStorage({ theme: 'dark', view: 'table' })
    await load('https://news.ycombinator.com/')
    await shot('1-front-dark-table')

    // Bookmarks panel with a few real stories.
    for (const i of [0, 2, 4]) await driver.executeScript(n => document.querySelectorAll('.hn-index tbody tr .hn-bm')[n].click(), i)
    await sleep(500)
    await click('Bookmarks')
    await shot('2-bookmarks-panel')
    await driver.executeScript(() => document.body.click())

    await click('Appearance and settings')
    await sleep(200)
    await shot('3-settings-panel')
    await driver.executeScript(() => document.body.click())

    // A thread: rewind "seen" so the newest comments show as new, select some text for the toolbar.
    const storyId = await probe(() => document.querySelector('.hn-index tbody tr').dataset.id)
    await load(`https://news.ycombinator.com/item?id=${storyId}`)
    const seen = (await getStorage())[`seen:${storyId}`]
    await setStorage({ [`seen:${storyId}`]: { ...seen, ids: seen.ids.slice(0, -3), count: 0 } })
    await driver.executeScript(() => sessionStorage.clear())
    await load(`https://news.ycombinator.com/item?id=${storyId}`)
    await driver.executeScript(() => {
      const el = document.querySelector('tr.comtr .commtext p, tr.comtr .commtext')
      const range = document.createRange()
      range.selectNodeContents(el.firstChild?.nodeType === 3 ? el : el)
      getSelection().removeAllRanges()
      getSelection().addRange(range)
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      document.querySelector('tr.comtr').scrollIntoView({ block: 'start' })
      window.scrollBy(0, -140)
    })
    await shot('4-thread-new-comments-selection')

    await driver.executeScript(() => {
      getSelection().removeAllRanges()
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      // A neutral public profile for the card: the real author names and about texts in a thread are other people's.
      const head = document.querySelector('tr.comtr .comhead')
      head.querySelector('a.hnuser').replaceWith(Object.assign(document.createElement('a'), { className: 'hnuser', href: 'user?id=pg', textContent: 'pg' }))
      head.querySelector('a.hnuser').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    await sleep(3000)
    await shot('5-user-card')

    // The original design is one click away.
    await setStorage({ on: false })
    await load('https://news.ycombinator.com/')
    await shot('6-original-design-restored')
  } finally {
    await driver.quit()
  }
}

main().catch(e => { console.error('FAIL', e.message); process.exit(1) })
