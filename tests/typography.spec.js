const { test, expect } = require('@playwright/test')
const { boot, setSettings } = require('./helpers')

// HN has no doctype (quirks mode): tables reset font size and line height unless the redesign inherits them again.
const css = (page, selector, prop) => page.locator(selector).first().evaluate((e, p) => getComputedStyle(e)[p], prop)

test.describe('font size and line height reach the content, not just the page background', () => {
  test('story table cells follow both sliders', async ({ page }) => {
    await boot(page, '/news', { settings: { size: 20, line: 2 } })
    expect(await css(page, '#hnmain', 'fontSize')).toBe('20px')
    expect(await css(page, '.hn-index td.hn-title', 'fontSize')).toBe('20px')
    expect(await css(page, '.hn-index td.hn-title', 'lineHeight')).toBe('40px')
  })

  test('comments follow both sliders', async ({ page }) => {
    await boot(page, '/item?id=1', { settings: { size: 18, line: 1.8 } })
    expect(await css(page, '.commtext', 'fontSize')).toBe('18px')
    expect(await css(page, '.commtext', 'lineHeight')).toBe('32.4px')
  })

  test('moving the sliders changes row height live', async ({ page }) => {
    await boot(page, '/news')
    const pitch = () => page.evaluate(() => { const [a, b] = [...document.querySelectorAll('.hn-index tbody tr')].map(r => r.getBoundingClientRect().top); return Math.round(b - a) })
    const before = await pitch()
    await setSettings(page, { line: 2, size: 22 })
    await expect.poll(pitch).toBeGreaterThan(before + 10)
    await setSettings(page, { line: 1.2, size: 12 })
    await expect.poll(pitch).toBeLessThan(before)
  })

  test('serif font reaches the table too', async ({ page }) => {
    await boot(page, '/news', { settings: { font: 'serif' } })
    expect(await css(page, '.hn-index td.hn-title', 'fontFamily')).toMatch(/Georgia/)
  })
})

test.describe('Inter (bundled, loaded only when chosen)', () => {
  test('choosing Inter in the Aa panel applies it to the page and the font really loads', async ({ page }) => {
    const fonts = []
    page.on('request', r => { if (r.url().includes('/fonts/')) fonts.push(r.url().split('/').pop()) })
    await boot(page, '/news')
    expect(fonts).toEqual([]) // Sans: nothing downloaded
    await page.getByRole('button', { name: 'Appearance and settings' }).click()
    await expect(page.getByRole('button', { name: 'Sans' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Serif' })).toBeVisible()
    await page.getByRole('button', { name: 'Inter', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-hn-font', 'inter')
    await expect(page.getByRole('button', { name: 'Inter', exact: true })).toHaveAttribute('aria-pressed', 'true')
    expect(await css(page, '.hn-index td.hn-title', 'fontFamily')).toContain('Hacker News Refresh Inter')
    const loaded = await page.evaluate(async () => { await document.fonts.load('16px "Hacker News Refresh Inter"'); return document.fonts.check('16px "Hacker News Refresh Inter"') })
    expect(loaded).toBe(true)
    expect(fonts).toContain('inter-latin-wght-normal.woff2')
    expect(fonts).not.toContain('inter-latin-ext-wght-normal.woff2') // only fetched for characters outside Latin
  })

  test('the Inter button previews in Inter and the licence ships with the font', async ({ page }) => {
    await boot(page, '/news')
    await page.getByRole('button', { name: 'Appearance and settings' }).click()
    expect(await css(page, '.hn-seg .hn-font-inter', 'fontFamily')).toContain('Hacker News Refresh Inter')
    const fs = require('node:fs')
    const dir = require('node:path').join(__dirname, '..', 'src', 'fonts')
    expect(fs.readdirSync(dir).sort()).toEqual(['OFL.txt', 'inter-latin-ext-wght-normal.woff2', 'inter-latin-wght-normal.woff2'])
    expect(fs.readFileSync(require('node:path').join(dir, 'OFL.txt'), 'utf8')).toContain('SIL Open Font License')
  })

  test('Inter text uses the weight and size settings like any other font', async ({ page }) => {
    await boot(page, '/news', { settings: { font: 'inter', size: 20, boldTitle: true } })
    expect(await css(page, '.hn-index td.hn-title', 'fontSize')).toBe('20px')
    expect(await css(page, '.hn-index td.hn-title a', 'fontWeight')).toBe('600')
  })
})

test.describe('bookmark button in the title cell', () => {
  test('sits at the right edge of the cell and never adds a line, even when the title fills the row', async ({ page }) => {
    await boot(page, '/news', { settings: { font: 'inter', width: 600 } })
    // A title long enough to fill the line: it may wrap by itself, but the button must not add a line of its own.
    await page.evaluate(() => { document.querySelector('.hn-index td.hn-title a').textContent = 'A title that is long enough to nearly fill the whole line of its cell' })
    const cell = page.locator('.hn-index td.hn-title').first()
    const button = cell.locator('.hn-bm')
    await expect(button).toHaveCSS('position', 'absolute')
    const [c, b] = [await cell.boundingBox(), await button.boundingBox()]
    expect(Math.abs(c.x + c.width - (b.x + b.width) - 12)).toBeLessThanOrEqual(1)
    const lineHeight = await cell.evaluate(e => parseFloat(getComputedStyle(e).lineHeight))
    const rows = Math.round((c.height - 9.6) / lineHeight)
    // Lines of text = distinct line tops of the link and the domain; the button must not add one.
    const textLines = await cell.evaluate(td => new Set([...td.querySelectorAll('a, .hn-site')].flatMap(e => [...e.getClientRects()].map(r => Math.round(r.top)))).size)
    expect(rows).toBe(textLines)
  })
})

test.describe('Inter not-loaded warning', () => {
  const openTheme = async page => {
    await page.getByRole('button', { name: 'Appearance and settings' }).click()
    await expect(page.locator('.hn-drawer')).toBeVisible()
  }

  test('no warning while Inter loads fine', async ({ page }) => {
    await boot(page, '/news', { settings: { font: 'inter' } })
    await openTheme(page)
    await expect(page.locator('.hn-warn')).toBeHidden()
  })

  test('no warning for Sans or Serif', async ({ page }) => {
    await boot(page, '/news', { settings: { font: 'serif' } })
    await openTheme(page)
    await expect(page.locator('.hn-warn')).toBeHidden()
  })

  test('if the font file cannot be fetched the panel says so, and the note clears once it can', async ({ page }) => {
    await boot(page, '/news')
    await page.route('https://news.ycombinator.com/fonts/*', r => r.abort()) // registered after boot: wins over the fixture route
    await openTheme(page)
    await page.getByRole('button', { name: 'Inter', exact: true }).click()
    await expect(page.locator('.hn-warn')).toBeVisible()
    await expect(page.locator('.hn-warn')).toContainText("Inter couldn't load")
    await page.getByRole('button', { name: 'Sans' }).click()
    await expect(page.locator('.hn-warn')).toBeHidden()
  })
})
