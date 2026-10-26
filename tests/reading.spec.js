const { test, expect } = require('@playwright/test')
const { boot, inject, setSettings } = require('./helpers')

test.describe('new replies', () => {
  const seen = (count, ids = []) => ({ count, ids, t: 1 })

  test('first visit marks nothing and remembers the thread', async ({ page }) => {
    await boot(page, '/item?id=1')
    await expect(page.locator('tr.hn-new')).toHaveCount(0)
    await expect(page.locator('.hn-newbar')).toHaveCount(0)
    expect(await page.evaluate(() => __store['seen:1'].ids)).toEqual(['11', '12'])
  })

  test('comments added since the last visit are marked, counted and reachable with the arrows', async ({ page }) => {
    await boot(page, '/item?id=1', { settings: { seen: { 1: seen(1, ['11']) } } })
    await expect(page.locator('tr.hn-new')).toHaveCount(1)
    await expect(page.locator('tr[id="12"]')).toHaveClass(/hn-new/)
    await expect(page.locator('.hn-newbar')).toContainText('1 new')
    await page.getByRole('button', { name: 'Next new comment' }).click()
    await expect(page.locator('tr[id="12"]')).toHaveClass(/hn-current/)
    await page.getByRole('button', { name: 'Previous new comment' }).click()
    await expect(page.locator('tr[id="12"]')).toHaveClass(/hn-current/) // one new comment: wraps onto itself
    expect(await page.evaluate(() => __store['seen:1'].ids)).toEqual(['11', '12'])
  })

  test('marks survive a reload in the same tab even though "seen" was updated', async ({ page }) => {
    await boot(page, '/item?id=1', { settings: { seen: { 1: seen(1, ['11']) } } })
    await expect(page.locator('tr[id="12"]')).toHaveClass(/hn-new/)
    await page.reload()
    await inject(page)
    await expect(page.locator('tr[id="12"]')).toHaveClass(/hn-new/)
    await expect(page.locator('.hn-newbar')).toContainText('1 new')
  })

  test('story list: badge shows how many replies arrived since the visit (table and list view)', async ({ page }) => {
    await boot(page, '/news', { settings: { seen: { 1: seen(30), 2: seen(0) } } })
    const rows = page.locator('.hn-index tbody tr')
    await expect(rows.first().locator('.hn-new-badge')).toHaveText('9 new')
    await expect(rows.nth(1).locator('.hn-new-badge')).toHaveCount(0) // a job has no replies
    await setSettings(page, { view: 'list' })
    await expect(page.locator('.subline .hn-new-badge')).toHaveText('9 new')
    await setSettings(page, { seen: { 1: seen(39) }, view: 'table' })
    await expect(page.locator('.hn-new-badge')).toHaveCount(0)
  })

  test('badges and the arrow bar are hidden while the redesign is off', async ({ page }) => {
    await boot(page, '/news', { settings: { seen: { 1: seen(30) } } })
    await expect(page.locator('.hn-index .hn-new-badge')).toBeVisible()
    await setSettings(page, { on: false })
    await expect(page.locator('.hn-index')).toHaveCount(0)
    await expect(page.locator('.subline .hn-new-badge')).toBeHidden()
  })
})

test.describe('selection toolbar', () => {
  const select = (page, selector) => page.evaluate(sel => {
    const el = document.querySelector(sel)
    const range = document.createRange()
    range.selectNodeContents(el)
    getSelection().removeAllRanges()
    getSelection().addRange(range)
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  }, selector)

  test('appears for text in a comment with its five actions', async ({ page }) => {
    await boot(page, '/item?id=1')
    await select(page, 'tr[id="11"] .commtext')
    await expect(page.getByRole('toolbar', { name: 'Selection' }).getByRole('button')).toHaveText(['', '', '', ''])
    await expect(page.locator('.hn-selbar [aria-label]')).toHaveCount(5)
    for (const name of ['Highlight', 'Quote in reply', 'Copy', 'Read aloud']) await expect(page.getByRole('button', { name })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Search HN' })).toHaveAttribute('href', 'https://hn.algolia.com/?q=First!')
  })

  test('does not appear for page chrome, tiny selections, or when the redesign is off', async ({ page }) => {
    await boot(page, '/item?id=1')
    await select(page, '.fatitem .titleline')
    await expect(page.locator('.hn-selbar')).toHaveCount(0)
    await page.evaluate(() => { document.querySelector('tr[id="11"] .commtext').textContent = 'x' })
    await select(page, 'tr[id="11"] .commtext')
    await expect(page.locator('.hn-selbar')).toHaveCount(0)
    await setSettings(page, { on: false })
    await select(page, 'tr[id="12"] .commtext')
    await expect(page.locator('.hn-selbar')).toHaveCount(0)
  })

  test('highlight saves a bookmark linking to the comment, and toggles off again', async ({ page }) => {
    await boot(page, '/item?id=1')
    await select(page, 'tr[id="11"] .commtext')
    const highlight = page.getByRole('button', { name: 'Highlight' })
    await highlight.click()
    await expect(highlight).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(() => __items('bm:'))).toMatchObject([{ type: 'highlight', title: 'First!', text: 'First!', url: 'https://news.ycombinator.com/item?id=11' }])
    await page.getByRole('button', { name: 'Bookmarks', exact: true }).click()
    await expect(page.locator('.hn-bm-group')).toHaveText(['Highlights'])
    await select(page, 'tr[id="11"] .commtext')
    await page.getByRole('button', { name: 'Highlight' }).click()
    await expect(page.getByRole('button', { name: 'Highlight' })).toHaveAttribute('aria-pressed', 'false')
    expect(await page.evaluate(() => __items('bm:'))).toEqual([])
  })

  test('copy puts the selected text on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://news.ycombinator.com' })
    await boot(page, '/item?id=1')
    await select(page, 'tr[id="12"] .commtext')
    await page.getByRole('button', { name: 'Copy' }).click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Reply link')
  })

  test('read aloud speaks the selection', async ({ page }) => {
    await boot(page, '/item?id=1')
    await page.evaluate(() => { window.__spoken = []; speechSynthesis.speak = u => window.__spoken.push(u.text) })
    await select(page, 'tr[id="11"] .commtext')
    await page.getByRole('button', { name: 'Read aloud' }).click()
    expect(await page.evaluate(() => window.__spoken)).toEqual(['First!'])
  })

  test('quote in reply opens the inline reply form pre-filled with the quote', async ({ page }) => {
    await boot(page, '/item?id=1')
    await page.route('**/reply?id=11*', r => r.fulfill({ contentType: 'text/html', body: '<form action="comment" method="post"><input type="hidden" name="parent" value="11"><textarea name="text"></textarea></form>' }))
    await select(page, 'tr[id="11"] .commtext')
    await page.getByRole('button', { name: 'Quote in reply' }).click()
    await expect(page.locator('tr[id="11"] form.hn-reply textarea')).toHaveValue('> First!\n\n')
    // a second quote is appended to the open form
    await select(page, 'tr[id="11"] .commtext')
    await page.getByRole('button', { name: 'Quote in reply' }).click()
    await expect(page.locator('tr[id="11"] form.hn-reply textarea')).toHaveValue('> First!\n\n> First!\n\n')
  })

  test('clicking elsewhere closes the bar', async ({ page }) => {
    await boot(page, '/item?id=1')
    await select(page, 'tr[id="11"] .commtext')
    await expect(page.locator('.hn-selbar')).toBeVisible()
    await page.mouse.click(5, 300)
    await expect(page.locator('.hn-selbar')).toHaveCount(0)
  })
})
