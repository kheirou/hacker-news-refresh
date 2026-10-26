const { test, expect } = require('@playwright/test')
const { boot, inject, htmlPage, header, story, comment } = require('./helpers')

// The item page as the fixtures build it, with the comments given.
const thread = comments => htmlPage(`${header()}<tr id="bigbox"><td><table class="fatitem" border="0">
  ${story(1, 1, 'Story A', 'a.example', '<span class="subline"><span class="score">231 points</span></span>')}</table>
  <table class="comment-tree">${comments}</table></td></tr>`)

const marked = page => page.evaluate(() => [...document.querySelectorAll('tr.hn-new')].map(r => r.id))
const seenIds = page => page.evaluate(() => __store['seen:1'].ids.slice().sort())

test.describe('new replies on a live thread', () => {
  test('a comment that arrives between two loads in the same tab is marked on the reload', async ({ page }) => {
    await boot(page, '/item?id=1', { settings: { seen: { 1: { count: 1, ids: ['11'], pages: [1], t: 1 } } } })
    expect(await marked(page)).toEqual(['12'])
    await page.route('**/item?id=1', r => r.fulfill({ contentType: 'text/html', body: thread(comment(11, 0, 'First!') + comment(12, 1, 'Reply') + comment(13, 1, 'Later')) }))
    await page.reload()
    await inject(page)
    expect(await marked(page)).toEqual(['12', '13'])
    await expect(page.locator('.hn-newbar')).toContainText('2 new')
  })

  test('the first visit marks nothing; the second marks only what arrived after it', async ({ page }) => {
    await boot(page, '/item?id=1')
    expect(await marked(page)).toEqual([])
    await page.route('**/item?id=1', r => r.fulfill({ contentType: 'text/html', body: thread(comment(11, 0, 'First!') + comment(12, 1, 'Reply') + comment(13, 1, 'Later')) }))
    await page.evaluate(() => sessionStorage.removeItem('hn-new-1')) // a new tab
    await page.reload()
    await inject(page)
    expect(await marked(page)).toEqual(['13'])
  })
})

test.describe('paged threads', () => {
  const pageTwo = thread(comment(21, 0, 'Page two A') + comment(22, 0, 'Page two B'))

  test('opening page 2 keeps what page 1 showed, and its own first visit is not "new"', async ({ page }) => {
    await boot(page, '/item?id=1', { settings: { seen: { 1: { count: 4, ids: ['11', '12'], pages: [1], t: 1 } } } })
    await page.route('**/item?id=1&p=2', r => r.fulfill({ contentType: 'text/html', body: pageTwo }))
    await page.goto('https://news.ycombinator.com/item?id=1&p=2')
    await inject(page)
    expect(await marked(page)).toEqual([])
    expect(await seenIds(page)).toEqual(['11', '12', '21', '22'])
    expect(await page.evaluate(() => __store['seen:1'].pages)).toEqual([1, 2])
  })

  test('back on page 1 nothing is falsely new; later comments on either page are', async ({ page }) => {
    await boot(page, '/item?id=1', { settings: { seen: { 1: { count: 4, ids: ['11', '12', '21', '22'], pages: [1, 2], t: 1 } } } })
    await page.evaluate(() => sessionStorage.removeItem('hn-new-1'))
    await page.reload()
    await inject(page)
    expect(await marked(page)).toEqual([])
    await page.route('**/item?id=1&p=2', r => r.fulfill({ contentType: 'text/html', body: thread(comment(21, 0, 'A') + comment(22, 0, 'B') + comment(23, 0, 'C')) }))
    await page.goto('https://news.ycombinator.com/item?id=1&p=2')
    await inject(page)
    expect(await marked(page)).toEqual(['23'])
  })
})

test.describe('storage reads and trimming', () => {
  test('trimming runs at most every six hours', async ({ page }) => {
    const seen = Object.fromEntries(Array.from({ length: 305 }, (_, i) => [`x${i + 1}`, { count: 1, ids: [], t: i + 1 }]))
    await boot(page, '/item?id=1', { settings: { seen, 'trimmed:seen:': Date.now() } })
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => Object.keys(__store).filter(k => k.startsWith('seen:')).length)).toBe(306)
  })

  test('bookmark buttons are coloured by reading only their own keys', async ({ page }) => {
    await boot(page, '/news', { settings: { bookmarks: [{ key: 'story:2', type: 'story', title: 'Job B', url: 'https://b.example/x', t: 1 }] } })
    await expect(page.locator('.hn-index tbody tr').nth(1).locator('.hn-bm')).toHaveAttribute('aria-pressed', 'true')
    const reads = await page.evaluate(async () => {
      const calls = []
      const get = browser.storage.local.get
      browser.storage.local.get = (...args) => { calls.push(args[0]); return get(...args) }
      await syncBookmarkButtons()
      browser.storage.local.get = get
      return calls
    })
    expect(reads).toHaveLength(1)
    expect(Array.isArray(reads[0]) && reads[0].every(k => k.startsWith('bm:'))).toBe(true)
  })
})

test.describe('words and labels', () => {
  test('each bookmark button names its item', async ({ page }) => {
    await boot(page, '/news')
    await expect(page.locator('.hn-index tbody tr').first().locator('.hn-bm')).toHaveAttribute('aria-label', 'Bookmark: Story A')
  })

  test('the About section tells the truth about requests', async ({ page }) => {
    await boot(page, '/news')
    await page.getByRole('button', { name: 'Appearance and settings' }).click()
    const text = await page.locator('.hn-drawer').innerText()
    expect(text).toContain('profile lookup when you hover a username')
    expect(text).not.toContain('nothing is sent anywhere')
  })
})

test.describe('licence', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n')

  test('MIT text at the root and inside the extension package, identical, with the font licence beside the fonts', () => {
    expect(read('LICENSE')).toContain('MIT License')
    expect(read('LICENSE')).toContain('Permission is hereby granted, free of charge')
    expect(read('src/LICENSE')).toBe(read('LICENSE'))
    expect(read('src/fonts/OFL.txt')).toContain('SIL Open Font License')
    expect(JSON.parse(read('package.json')).license).toBe('MIT')
  })
})
