const { test, expect } = require('@playwright/test')
const fs = require('node:fs')
const { boot } = require('./helpers')

const panelButton = page => page.getByRole('button', { name: 'Bookmarks', exact: true })
const stored = page => page.evaluate(() => __items('bm:'))

test.describe('bookmark buttons', () => {
  test('story row in the table: toggles, shows pressed, appears in the panel and can be removed there', async ({ page }) => {
    await boot(page, '/news')
    const button = page.locator('.hn-index tbody tr').first().getByRole('button', { name: 'Bookmark' })
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await button.click({ force: true })
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(await stored(page)).toMatchObject([{ key: 'story:1', type: 'story', title: 'Story A', url: 'https://a.example/x', hn: 'https://news.ycombinator.com/item?id=1' }])
    await panelButton(page).click()
    await expect(page.locator('.hn-bm-group')).toHaveText(['Stories'])
    await expect(page.locator('.hn-bm-list li a').first()).toHaveText('Story A')
    await expect(page.getByRole('link', { name: 'discussion' })).toHaveAttribute('href', 'https://news.ycombinator.com/item?id=1')
    await page.getByRole('button', { name: 'Remove bookmark: Story A' }).click()
    await expect(page.locator('.hn-bm-list')).toContainText('No bookmarks yet')
    await expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  test('story page: story and comment bookmarks', async ({ page }) => {
    await boot(page, '/item?id=1')
    await page.locator('.fatitem .hn-bm').click()
    await page.locator('tr.comtr').first().locator('.hn-bm').click()
    await expect.poll(async () => (await stored(page)).length).toBe(2)
    const list = await stored(page)
    expect(list.map(b => b.key).sort()).toEqual(['comment:11', 'story:1'])
    expect(list.find(b => b.type === 'comment').title).toBe('bob: First!')
    await panelButton(page).click()
    await expect(page.locator('.hn-bm-group')).toHaveText(['Stories', 'Comments'])
  })

  test('list view puts the button on HN own story rows too', async ({ page }) => {
    await boot(page, '/news', { settings: { view: 'list' } })
    await page.locator('tr.athing').first().locator('xpath=following-sibling::tr[1]').getByRole('button', { name: 'Bookmark' }).click()
    await expect.poll(async () => (await stored(page)).map(b => b.key)).toEqual(['story:1'])
  })

  test('profile page: bookmark the user', async ({ page }) => {
    await boot(page, '/user?id=pg')
    await page.locator('#bigbox .hn-bm').click()
    await expect.poll(() => stored(page)).toMatchObject([{ key: 'user:pg', type: 'user', title: 'pg', url: 'https://news.ycombinator.com/user?id=pg' }])
    await panelButton(page).click()
    await expect(page.locator('.hn-bm-group')).toHaveText(['Users'])
  })

  test('pressed state follows storage: bookmarks made elsewhere show up', async ({ page }) => {
    await boot(page, '/news', { settings: { bookmarks: [{ key: 'story:2', type: 'story', title: 'Job B', url: 'https://b.example/x', t: 1 }] } })
    await expect(page.locator('.hn-index tbody tr').nth(1).getByRole('button', { name: 'Bookmark' })).toHaveAttribute('aria-pressed', 'true')
    await panelButton(page).click()
    await expect(page.locator('.hn-bm-list li a').first()).toHaveText('Job B')
  })

  test('empty panel explains itself', async ({ page }) => {
    await boot(page, '/news')
    await panelButton(page).click()
    await expect(page.locator('.hn-bookmarks')).toContainText('No bookmarks yet')
  })
})

test.describe('backup and restore', () => {
  const backup = (bookmarks, extra = {}) => JSON.stringify({ app: 'hn-redesign', version: 1, bookmarks, settings: {}, ...extra })
  const story = (n, extra = {}) => ({ key: `story:${n}`, type: 'story', title: `Story ${n}`, url: `https://x.example/${n}`, t: n, ...extra })

  test('export downloads JSON with bookmarks and stored settings', async ({ page }) => {
    await boot(page, '/news', { settings: { theme: 'slate', bookmarks: [story(5)] } })
    await panelButton(page).click()
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export' }).click()])
    expect(download.suggestedFilename()).toMatch(/^hn-redesign-backup-\d{4}-\d{2}-\d{2}\.json$/)
    const data = JSON.parse(fs.readFileSync(await download.path(), 'utf8'))
    expect(data).toMatchObject({ app: 'hn-redesign', version: 1, bookmarks: [{ key: 'story:5' }], settings: { theme: 'slate' } })
    await expect(page.getByRole('status')).toHaveText('Backup downloaded.')
  })

  test('import merges by key (file wins), restores settings and reports the count', async ({ page }) => {
    await boot(page, '/news', { settings: { bookmarks: [story(1, { title: 'old title' }), story(9)] } })
    await panelButton(page).click()
    await page.locator('input[type=file]').setInputFiles({
      name: 'b.json', mimeType: 'application/json',
      buffer: Buffer.from(backup([story(1, { title: 'new title' }), story(2)], { settings: { theme: 'black', columns: ['title'] } })),
    })
    await expect(page.getByRole('status')).toHaveText('Imported 2 bookmarks.')
    const list = await stored(page)
    expect(list.map(b => `${b.key}:${b.title}`).sort()).toEqual(['story:1:new title', 'story:2:Story 2', 'story:9:Story 9'])
    await expect(page.locator('html')).toHaveAttribute('data-hn-theme', 'black')
    expect(await page.evaluate(() => __store.columns)).toEqual(['title'])
  })

  test('import rejects non-backups and drops unsafe entries and settings', async ({ page }) => {
    await boot(page, '/news')
    await panelButton(page).click()
    const input = page.locator('input[type=file]')
    await input.setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('not json') })
    await expect(page.getByRole('status')).toHaveText('That file is not valid JSON.')
    await input.setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') })
    await expect(page.getByRole('status')).toHaveText('That file is not an HN Redesign backup.')
    await input.setInputFiles({
      name: 'x.json', mimeType: 'application/json',
      buffer: Buffer.from(backup([story(3), story(4, { url: 'javascript:alert(1)' }), { key: 'bogus:1', type: 'bogus', title: 't', url: 'https://x.example' }], { settings: { theme: 7, evil: true, on: 'yes' } })),
    })
    await expect(page.getByRole('status')).toHaveText('Imported 1 bookmark, skipped 2 invalid.')
    expect((await stored(page)).map(b => b.key)).toEqual(['story:3'])
    expect(await page.evaluate(() => ({ theme: __store.theme, evil: __store.evil, on: __store.on }))).toEqual({})
  })

  test('parseBackup keeps only known fields and caps field length', async ({ page }) => {
    await boot(page, '/news')
    const out = await page.evaluate(text => parseBackup(text), backup([story(1, { title: 'x'.repeat(1000), extra: 'drop me', hn: 'ftp://nope' })]))
    expect(Object.keys(out.bookmarks[0]).sort()).toEqual(['key', 'title', 't', 'type', 'url'].sort())
    expect(out.bookmarks[0].title).toHaveLength(400)
  })
})
