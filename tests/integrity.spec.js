const { test, expect } = require('@playwright/test')
const { boot, setSettings } = require('./helpers')

const entry = n => ({ key: `story:${n}`, type: 'story', title: `Story ${n}`, url: `https://x.example/${n}` })

test.describe('data survives several tabs writing at once', () => {
  test('overlapping bookmark toggles all stick (one storage key each, no read-modify-write)', async ({ page }) => {
    await boot(page, '/news')
    await page.evaluate(entries => Promise.all(entries.map(toggleBookmark)), [entry(1), entry(2), entry(3)])
    expect((await page.evaluate(() => __items('bm:'))).map(b => b.key).sort()).toEqual(['story:1', 'story:2', 'story:3'])
  })

  test('overlapping history writes all stick', async ({ page }) => {
    await boot(page, '/news')
    await page.evaluate(() => Promise.all(['a', 'b', 'c'].map(id => kv.set({ [`history:${id}`]: { id, title: id, t: Date.now() } }))))
    expect(await page.evaluate(() => __items('history:').length)).toBe(3)
  })

  test('seen is trimmed to the newest 300 stories', async ({ page }) => {
    const seen = Object.fromEntries(Array.from({ length: 305 }, (_, i) => [`x${i + 1}`, { count: 1, ids: [], t: i + 1 }]))
    await boot(page, '/item?id=1', { settings: { seen } })
    await expect.poll(() => page.evaluate(() => Object.keys(__store).filter(k => k.startsWith('seen:')).length)).toBe(300)
    expect(await page.evaluate(() => ['seen:1', 'seen:x305', 'seen:x1'].map(k => k in __store))).toEqual([true, true, false])
  })

  test('bookmarks over the cap drop the oldest', async ({ page }) => {
    await boot(page, '/news')
    await page.evaluate(async () => {
      const all = {}
      for (let i = 1; i <= BM_MAX + 3; i++) all[`bm:story:${i}`] = { key: `story:${i}`, type: 'story', title: 't', url: 'https://x.example', t: i }
      await kv.set(all)
      await toggleBookmark({ key: 'story:new', type: 'story', title: 'new', url: 'https://x.example' })
    })
    expect(await page.evaluate(() => __items('bm:').length)).toBe(2000)
    expect(await page.evaluate(() => ['bm:story:new', 'bm:story:1'].map(k => k in __store))).toEqual([true, false])
  })
})

test.describe('writes that are not settings leave the page alone', () => {
  test('bookmarking does not rebuild the table, and j / b / j keeps your place', async ({ page }) => {
    await boot(page, '/news')
    await page.evaluate(() => { window.__table = document.querySelector('.hn-index') })
    await page.keyboard.press('j')
    await page.keyboard.press('j')
    await page.keyboard.press('b')
    await expect.poll(() => page.evaluate(() => __items('bm:').length)).toBe(1)
    expect(await page.evaluate(() => document.querySelector('.hn-index') === window.__table)).toBe(true)
    await expect(page.locator('.hn-index tbody tr').nth(1)).toHaveClass(/hn-selected/)
    await page.keyboard.press('k')
    await expect(page.locator('.hn-index tbody tr').first()).toHaveClass(/hn-selected/)
  })

  test('a settings change still re-renders', async ({ page }) => {
    await boot(page, '/news')
    await page.evaluate(() => { window.__table = document.querySelector('.hn-index') })
    await setSettings(page, { columns: ['title'] })
    await expect(page.locator('.hn-index th')).toHaveText(['Story'])
    expect(await page.evaluate(() => document.querySelector('.hn-index') === window.__table)).toBe(false)
  })
})

test.describe('username lookups', () => {
  test('a failed lookup is retried on the next hover', async ({ page }) => {
    let calls = 0
    await page.route('https://hacker-news.firebaseio.com/**', r => {
      calls++
      return calls === 1 ? r.abort() : r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id: 'alice', created: 1, karma: 5 }) })
    })
    await boot(page, '/news', { settings: { columns: ['title', 'by'] } })
    const link = page.locator('.hn-index a.hnuser').first()
    await link.hover()
    await expect(page.locator('.hn-usercard')).toContainText("Couldn't load this user.")
    await page.mouse.move(5, 400)
    await expect(page.locator('.hn-usercard')).toHaveCount(0)
    await link.hover()
    await expect(page.locator('.hn-usercard')).toContainText('5 karma')
    expect(calls).toBe(2)
  })
})

test.describe('panels and keyboard', () => {
  test('tabbing out of an open panel closes it', async ({ page }) => {
    await boot(page, '/news')
    await page.getByRole('button', { name: 'Appearance and settings' }).click()
    await expect(page.locator('.hn-drawer')).toBeVisible()
    // The drawer holds about 35 controls: tab through them all and out the other side.
    for (let i = 0; i < 70 && await page.locator('.hn-drawer').isVisible(); i++) await page.keyboard.press('Tab')
    await expect(page.locator('.hn-drawer')).toBeHidden()
  })

  test('shift-tab back to the trigger keeps the panel open', async ({ page }) => {
    await boot(page, '/news')
    await page.getByRole('button', { name: 'Appearance and settings' }).click()
    await page.keyboard.press('Shift+Tab')
    await expect(page.getByRole('button', { name: 'Appearance and settings' })).toBeFocused()
    await expect(page.locator('.hn-drawer')).toBeVisible()
  })

  test('the view bar and the drawer use plain buttons, not ARIA menus that would need arrow keys', async ({ page }) => {
    await boot(page, '/news')
    await page.getByRole('button', { name: 'Appearance and settings' }).click()
    await expect(page.locator('[role=menu], [role=menuitem], [role=menuitemradio], [role=menuitemcheckbox], [role=tab], [role=tablist]')).toHaveCount(0)
    await expect(page.locator('[aria-haspopup]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Table', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('backup import limits', () => {
  test('numbers are clamped to the slider limits', async ({ page }) => {
    await boot(page, '/news')
    await page.getByRole('button', { name: 'Bookmarks', exact: true }).click()
    const backup = JSON.stringify({ app: 'hn-redesign', version: 1, bookmarks: [], settings: { size: 1e9, width: -5, line: 99 } })
    await page.locator('input[type=file]').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(backup) })
    await expect(page.getByRole('status')).toHaveText('Imported 0 bookmarks.')
    expect(await page.evaluate(() => ({ size: __store.size, width: __store.width, line: __store.line }))).toEqual({ size: 22, width: 600, line: 2 })
    await expect(page.locator('body')).toHaveCSS('font-size', '22px')
  })
})
