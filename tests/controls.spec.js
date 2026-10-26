const { test, expect } = require('@playwright/test')
const { boot, setSettings } = require('./helpers')

test.describe('keyboard shortcuts and control pad', () => {
  test('j / k move a selection through story rows, clamped at both ends', async ({ page }) => {
    await boot(page, '/news')
    const rows = page.locator('.hn-index tbody tr')
    await page.keyboard.press('j')
    await expect(rows.first()).toHaveClass(/hn-selected/)
    await page.keyboard.press('j')
    await expect(rows.nth(1)).toHaveClass(/hn-selected/)
    await page.keyboard.press('j')
    await expect(rows.nth(1)).toHaveClass(/hn-selected/)
    await page.keyboard.press('k')
    await expect(rows.first()).toHaveClass(/hn-selected/)
    await expect(page.locator('.hn-selected')).toHaveCount(1)
  })

  test('the pad arrows do the same as the keys', async ({ page }) => {
    await boot(page, '/news')
    await page.getByRole('button', { name: 'Next item' }).click()
    await expect(page.locator('.hn-index tbody tr').first()).toHaveClass(/hn-selected/)
    await page.getByRole('button', { name: 'Next item' }).click()
    await page.getByRole('button', { name: 'Previous item' }).click()
    await expect(page.locator('.hn-index tbody tr').first()).toHaveClass(/hn-selected/)
  })

  test('o opens the story, c its comments, b bookmarks it, l goes to the next page', async ({ page }) => {
    await page.route('https://a.example/**', r => r.fulfill({ contentType: 'text/html', body: 'story' }))
    await boot(page, '/news')
    await page.keyboard.press('j')
    await page.keyboard.press('b')
    await expect.poll(() => page.evaluate(() => __items('bm:').map(b => b.key))).toEqual(['story:1'])
    await page.keyboard.press('c')
    await expect(page).toHaveURL(/\/item\?id=1$/)
    await boot(page, '/news')
    await page.keyboard.press('j')
    await page.keyboard.press('o')
    await expect(page).toHaveURL('https://a.example/x')
    await boot(page, '/news')
    await page.keyboard.press('l')
    await expect(page).toHaveURL(/\/news\?p=2$/)
  })

  test('shortcuts also work on HN own rows in list view', async ({ page }) => {
    await boot(page, '/news', { settings: { view: 'list' } })
    await page.keyboard.press('j')
    await expect(page.locator('tr.athing').first()).toHaveClass(/hn-selected/)
    await page.keyboard.press('b')
    await expect.poll(() => page.evaluate(() => __items('bm:').map(b => b.key))).toEqual(['story:1'])
  })

  test('comments: j / k move, l goes to the next sibling, h to the parent, n / N through new comments', async ({ page }) => {
    await boot(page, '/item?id=1', { settings: { seen: { 1: { count: 1, ids: ['11'], t: 1 } } } })
    await page.keyboard.press('j')
    await expect(page.locator('tr[id="11"]')).toHaveClass(/hn-selected/)
    await page.keyboard.press('l')
    await expect(page.locator('tr[id="12"]')).toHaveClass(/hn-selected/)
    await page.keyboard.press('h')
    await expect(page.locator('tr[id="11"]')).toHaveClass(/hn-selected/)
    await page.keyboard.press('j')
    await page.keyboard.press('h') // 12 has parent 11
    await expect(page.locator('tr[id="11"]')).toHaveClass(/hn-selected/)
    await page.keyboard.press('n')
    await expect(page.locator('tr[id="12"]')).toHaveClass(/hn-current/)
  })

  test('typing in a box, modifier keys, and the redesign being off never trigger shortcuts', async ({ page }) => {
    await boot(page, '/item?id=1')
    await page.locator('body').evaluate(b => { const t = document.createElement('textarea'); t.id = 'box'; b.append(t) })
    await page.locator('#box').focus()
    await page.keyboard.type('jjj')
    await expect(page.locator('.hn-selected')).toHaveCount(0)
    await page.locator('#box').blur()
    await page.keyboard.press('Control+j')
    await expect(page.locator('.hn-selected')).toHaveCount(0)
    await setSettings(page, { on: false })
    await page.keyboard.press('j')
    await expect(page.locator('.hn-selected')).toHaveCount(0)
  })

  test('control pad can be switched off in settings', async ({ page }) => {
    await boot(page, '/news')
    await expect(page.locator('.hn-pad')).toBeVisible()
    await page.getByRole('button', { name: 'Appearance and settings' }).click()
    await page.getByRole('switch', { name: 'Show the navigation pad' }).uncheck()
    await expect(page.locator('.hn-pad')).toBeHidden()
  })

  test('the About section lists the shortcuts', async ({ page }) => {
    await boot(page, '/news')
    await page.getByRole('button', { name: 'Appearance and settings' }).click()
    await expect(page.locator('.hn-keys dt')).toHaveText(['j / k', 'h / l', 'o', 'c', 'b', 'n / N'])
  })
})

test.describe('date picker', () => {
  test('front page heading offers a day picker that opens that day', async ({ page }) => {
    await boot(page, '/news')
    await page.getByRole('button', { name: 'Go to a day' }).click()
    const input = page.locator('input[type=date]')
    await expect(input).toHaveAttribute('max', new Date().toLocaleDateString('en-CA'))
    await input.fill('2026-10-20')
    await expect(page).toHaveURL(/\/front\?day=2026-10-20$/)
  })

  test('a past day shows that date in the heading and the picker; other sections have no picker', async ({ page }) => {
    await boot(page, '/front?day=2026-10-20')
    await expect(page.locator('.hn-day')).toHaveText('Tuesday')
    await expect(page.locator('.hn-date')).toHaveText('20 October')
    await expect(page.locator('input[type=date]')).toHaveValue('2026-10-20')
    await page.unroute('https://news.ycombinator.com/**')
    await boot(page, '/ask')
    await expect(page.getByRole('button', { name: 'Go to a day' })).toHaveCount(0)
  })
})

test.describe('user card', () => {
  const user = { id: 'alice', created: Math.floor(Date.now() / 1000 - 5.2 * 365.25 * 86400), karma: 12345, about: 'Hello<p>I write <a href="https://evil.example">code</a> &amp; <script>alert(1)</script>' }
  const serve = (page, body = user, counter = { n: 0 }) =>
    page.route('https://hacker-news.firebaseio.com/**', r => { counter.n++; return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) }) })

  test('hovering a username shows age, karma and the about text as plain text', async ({ page }) => {
    await serve(page)
    await boot(page, '/news', { settings: { columns: ['title', 'by'] } })
    await page.locator('.hn-index a.hnuser').first().hover()
    const card = page.getByRole('group', { name: 'About alice' })
    await expect(card).toContainText('Member for 5 years · 12,345 karma')
    await expect(card.locator('.hn-about')).toHaveText('Hello\n\nI write code & alert(1)')
    await expect(card.locator('a, script')).toHaveCount(0)
  })

  test('the card has a bookmark button for the user and closes when the mouse leaves', async ({ page }) => {
    await serve(page)
    await boot(page, '/news', { settings: { columns: ['title', 'by'] } })
    await page.locator('.hn-index a.hnuser').first().hover()
    await page.locator('.hn-usercard .hn-bm').click()
    await expect.poll(() => page.evaluate(() => __items('bm:').map(b => b.key))).toEqual(['user:alice'])
    await page.mouse.move(5, 400)
    await expect(page.locator('.hn-usercard')).toHaveCount(0)
  })

  test('one request per user; failures say so; nothing shows while the redesign is off', async ({ page }) => {
    const counter = { n: 0 }
    await serve(page, user, counter)
    await boot(page, '/news', { settings: { columns: ['title', 'by'] } })
    const link = page.locator('.hn-index a.hnuser').first()
    await link.hover()
    await expect(page.locator('.hn-usercard')).toContainText('karma')
    await page.mouse.move(5, 400)
    await expect(page.locator('.hn-usercard')).toHaveCount(0)
    await link.hover()
    await expect(page.locator('.hn-usercard')).toContainText('karma')
    expect(counter.n).toBe(1)
    await page.mouse.move(5, 400)
    await page.unroute('https://hacker-news.firebaseio.com/**')
    await page.route('https://hacker-news.firebaseio.com/**', r => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: 'null' }))
    await page.evaluate(() => { document.querySelector('.hn-index a.hnuser').textContent = 'ghost' })
    await page.locator('.hn-index a.hnuser').first().hover()
    await expect(page.locator('.hn-usercard')).toContainText("Couldn't load this user.")
    await page.mouse.move(5, 400)
    await setSettings(page, { on: false })
    await page.locator('.subline a.hnuser').first().hover()
    await page.waitForTimeout(600)
    await expect(page.locator('.hn-usercard')).toHaveCount(0)
  })

  test('no card for the profile page own user', async ({ page }) => {
    await serve(page)
    await boot(page, '/user?id=pg')
    await page.locator('#bigbox a.hnuser').hover()
    await page.waitForTimeout(600)
    await expect(page.locator('.hn-usercard')).toHaveCount(0)
  })
})
