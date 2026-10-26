const { test, expect } = require('@playwright/test')
const { boot } = require('./helpers')

// Geometry of the page frame against the target look, at a wide viewport where the column has room on both sides.
test.describe('layout parity at 1650px', () => {
  test.use({ viewport: { width: 1650, height: 1000 } })
  const box = (page, selector) => page.locator(selector).first().boundingBox()

  test('the column is centred and 1060px wide by default', async ({ page }) => {
    await boot(page, '/news')
    const col = await box(page, '#hnmain')
    expect(Math.abs(col.x - (1650 - col.x - col.width))).toBeLessThanOrEqual(2)
    expect(Math.round(col.width)).toBe(1060)
  })

  test('brand at the far left, tabs on the column edge, toolbar at the far right', async ({ page }) => {
    await boot(page, '/news')
    const col = await box(page, '#hnmain')
    const brand = await box(page, '.hn-brand')
    const tab = await box(page, '.hn-tab')
    const tools = await box(page, '.hn-toolbar')
    expect(brand.x).toBeLessThan(30)
    expect(Math.abs(tab.x - col.x)).toBeLessThanOrEqual(2)
    expect(tools.x + tools.width).toBeGreaterThan(1650 - 40)
    await expect(page.locator('.hn-brand')).toHaveText('Hacker News')
    await expect(page.locator('.hn-brand')).toHaveAttribute('href', '/news')
    await expect(page.locator('.hn-brand svg')).toBeVisible()
  })

  test('header is 68px; tabs are larger with wide gaps', async ({ page }) => {
    await boot(page, '/news')
    expect(Math.round((await box(page, '.hn-header')).height)).toBe(68)
    const [a, b] = await page.locator('.hn-tab').evaluateAll(els => els.slice(0, 2).map(e => e.getBoundingClientRect()))
    expect(Math.round(b.x - (a.x + a.width))).toBe(48)
    expect(parseFloat(await page.locator('.hn-tab').first().evaluate(e => getComputedStyle(e).fontSize))).toBeCloseTo(17.6, 0)
  })

  test('the heading has the rule under it; the column headings do not', async ({ page }) => {
    await boot(page, '/news')
    await expect(page.locator('.hn-heading')).toHaveCSS('border-bottom-width', '1px')
    await expect(page.locator('.hn-index th').first()).toHaveCSS('border-bottom-width', '0px')
    expect(parseFloat(await page.locator('.hn-heading h1').evaluate(e => getComputedStyle(e).fontSize))).toBeCloseTo(36, 0)
  })

  test('rows are 32px apart; rank has a dot and sits left; replies use the text colour', async ({ page }) => {
    await boot(page, '/news')
    const [r1, r2] = await page.locator('.hn-index tbody tr').evaluateAll(rows => rows.slice(0, 2).map(r => r.getBoundingClientRect().top))
    expect(Math.round(r2 - r1)).toBe(32)
    await expect(page.locator('.hn-index td.hn-rank').first()).toHaveText('1.')
    await expect(page.locator('.hn-index td.hn-rank').first()).toHaveCSS('text-align', 'left')
    const colours = await page.evaluate(() => [getComputedStyle(document.body).color, getComputedStyle(document.querySelector('td.hn-comments')).color, getComputedStyle(document.querySelector('td.hn-age')).color])
    expect(colours[1]).toBe(colours[0])
    expect(colours[2]).not.toBe(colours[0])
  })

  test('More is a centred pill button', async ({ page }) => {
    await boot(page, '/news')
    const col = await box(page, '#hnmain')
    const more = await box(page, 'a.morelink')
    expect(Math.abs(more.x + more.width / 2 - (col.x + col.width / 2))).toBeLessThanOrEqual(2)
    await expect(page.locator('a.morelink')).toHaveCSS('border-top-left-radius', '8px')
    await expect(page.locator('a.morelink')).toHaveCSS('padding-left', '22px')
  })

  test('the toolbar still has all its icons (calendar, bookmarks, control pad stay)', async ({ page }) => {
    await boot(page, '/news')
    for (const name of ['Appearance and settings', 'Bookmarks', 'History', 'Account', 'Search']) await expect(page.locator(`.hn-toolbar [aria-label="${name}"]`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Go to a day' })).toBeVisible()
    await expect(page.locator('.hn-pad')).toBeVisible()
  })
})

test.describe('narrow windows', () => {
  test.use({ viewport: { width: 900, height: 800 } })

  test('no horizontal scrolling; tabs clear the brand', async ({ page }) => {
    await boot(page, '/news')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const brand = await page.locator('.hn-brand').boundingBox()
    const tab = await page.locator('.hn-tab').first().boundingBox()
    expect(tab.x).toBeGreaterThanOrEqual(brand.x + brand.width + 10)
  })
})

test.describe('list view keeps its shape', () => {
  test.use({ viewport: { width: 1650, height: 1000 } })

  test('the story cells stay wide and start near the rank; More does not squeeze them', async ({ page }) => {
    await boot(page, '/news', { settings: { view: 'list' } })
    const col = await page.locator('#hnmain').boundingBox()
    const title = await page.locator('tr.athing .titleline').first().boundingBox()
    expect(title.x).toBeLessThan(col.x + 200)
    const cells = await page.locator('tr.athing').first().evaluate(tr => [...tr.children].map(td => Math.round(td.getBoundingClientRect().width)))
    expect(cells[0]).toBeLessThan(120) // the rank column stays narrow (the bug made it about 1000px wide and pushed the stories to the right edge)
    await expect(page.locator('a.morelink')).toBeVisible()
    const more = await page.locator('a.morelink').boundingBox()
    expect(more.x).toBeLessThan(col.x + 400) // in list view More stays under the stories, not centred on the page
  })

  test('the table always has its story column, even if saved columns forget it', async ({ page }) => {
    await boot(page, '/news', { settings: { columns: ['points'] } })
    await expect(page.locator('.hn-index th')).toHaveText(['Score', 'Story'])
  })
})
