const { test, expect } = require('@playwright/test')
const { boot, src } = require('./helpers')

test.describe('settings drawer (Aa)', () => {
  const open = async page => {
    await page.getByRole('button', { name: 'Appearance and settings' }).click()
    await expect(page.locator('.hn-drawer')).toBeVisible()
  }
  const drawer = page => page.locator('.hn-drawer')

  test('is one scrolling page on the right edge, below the header, with five sections and no tabs', async ({ page }) => {
    await boot(page, '/news')
    await open(page)
    const box = await drawer(page).boundingBox()
    expect(Math.round(box.x + box.width)).toBe(1280)
    expect(Math.round(box.y)).toBe(68)
    expect(Math.round(box.y + box.height)).toBe(720)
    await expect(page.locator('.hn-sec-title')).toHaveText(['Colour', 'Text', 'Page', 'Reading', 'About'])
    await expect(page.getByRole('tab')).toHaveCount(0)
    await expect(drawer(page)).toHaveAttribute('role', 'dialog')
  })

  test('Esc and the close button shut it, with focus back on the Aa button', async ({ page }) => {
    await boot(page, '/news')
    const aa = page.getByRole('button', { name: 'Appearance and settings' })
    await open(page)
    await page.keyboard.press('Escape')
    await expect(drawer(page)).toBeHidden()
    await expect(aa).toBeFocused()
    await open(page)
    await page.getByRole('button', { name: 'Close settings' }).click()
    await expect(drawer(page)).toBeHidden()
  })

  test('colour tiles are drawn in their own theme colours and switch the page live', async ({ page }) => {
    await boot(page, '/news')
    await open(page)
    await expect(page.locator('.hn-tile')).toHaveCount(5)
    await expect(page.locator('.hn-tile-name')).toHaveText(['Light', 'Classic', 'Slate', 'Dark', 'Black'])
    const bg = name => page.getByRole('button', { name: `${name} theme` }).evaluate(e => getComputedStyle(e).backgroundColor)
    expect(await bg('Light')).toBe('rgb(255, 255, 255)')
    expect(await bg('Dark')).toBe('rgb(29, 29, 34)')
    expect(await bg('Slate')).toBe('rgb(30, 41, 59)')
    await page.getByRole('button', { name: 'Dark theme' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-hn-theme', 'dark')
    await expect(page.getByRole('button', { name: 'Dark theme' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Light theme' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('typeface is a segmented control', async ({ page }) => {
    await boot(page, '/news')
    await open(page)
    await expect(page.getByRole('group', { name: 'Typeface' }).getByRole('button')).toHaveText(['Sans', 'Serif', 'Inter'])
    await page.getByRole('button', { name: 'Serif', exact: true }).click()
    await expect(page.locator('body')).toHaveCSS('font-family', /Georgia/)
    await expect(page.getByRole('button', { name: 'Serif', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Sans', exact: true })).toHaveAttribute('aria-pressed', 'false')
  })

  test('steppers move size, spacing and width in exact steps and stop at the limits', async ({ page }) => {
    await boot(page, '/news')
    await open(page)
    await page.getByRole('button', { name: 'Increase text size' }).click()
    await expect(page.locator('body')).toHaveCSS('font-size', '17px')
    await page.getByRole('button', { name: 'Decrease text size' }).click()
    await page.getByRole('button', { name: 'Decrease text size' }).click()
    await expect(page.locator('body')).toHaveCSS('font-size', '15px')
    await page.getByRole('button', { name: 'Increase line spacing' }).click()
    await expect.poll(() => page.evaluate(() => __store.line)).toBe(1.5)
    await page.getByRole('button', { name: 'Increase page width' }).click()
    await expect(page.locator('#hnmain')).toHaveCSS('width', '1080px')
    await expect(page.locator('.hn-step output').first()).toHaveText('15px')
  })

  test('steppers clamp: nothing goes past the slider limits', async ({ page }) => {
    await boot(page, '/news', { settings: { size: 22, line: 1.2 } })
    await open(page)
    await page.getByRole('button', { name: 'Increase text size' }).click()
    await page.getByRole('button', { name: 'Decrease line spacing' }).click()
    await expect.poll(() => page.evaluate(() => [__store.size, __store.line])).toEqual([22, 1.2])
  })

  test('sliders still work and are named', async ({ page }) => {
    await boot(page, '/news')
    await open(page)
    await page.getByRole('slider', { name: 'Text size' }).fill('19')
    await expect(page.locator('body')).toHaveCSS('font-size', '19px')
    await page.getByRole('slider', { name: 'Page width' }).fill('700')
    await expect(page.locator('#hnmain')).toHaveCSS('width', '700px')
    await page.getByRole('slider', { name: 'Line spacing' }).fill('1.8')
    await expect.poll(() => page.evaluate(() => __store.line)).toBe(1.8)
  })

  test('eight switches, each with a one-line description, write storage and apply', async ({ page }) => {
    await boot(page, '/news')
    await open(page)
    await expect(page.getByRole('switch')).toHaveCount(8)
    await expect(page.locator('.hn-switch-text small')).toHaveCount(8)
    await page.getByRole('switch', { name: 'Keep the header in view' }).uncheck()
    await expect(page.locator('.hn-header')).toHaveCSS('position', 'relative')
    await page.getByRole('switch', { name: 'Open stories in a new tab' }).check()
    await expect(page.locator('.hn-index td.hn-title a').first()).toHaveAttribute('target', '_blank')
    await page.getByRole('switch', { name: 'Smooth text edges' }).uncheck()
    await expect(page.locator('html[data-hn-smooth]')).toHaveCount(0)
    await page.getByRole('switch', { name: 'Dim stories you have opened' }).uncheck()
    await expect(page.locator('html[data-hn-fade]')).toHaveCount(0)
    await page.getByRole('switch', { name: 'Hide vote arrows until hover' }).check()
    await expect(page.locator('html[data-hn-hover]')).toHaveCount(1)
    await page.getByRole('switch', { name: 'Follow system dark mode' }).check()
    await expect.poll(() => page.evaluate(() => __store.autoDark)).toBe(true)
  })

  test('shows the saved values when opened', async ({ page }) => {
    await boot(page, '/news', { settings: { newTab: true, size: 17, theme: 'slate', font: 'serif' } })
    await open(page)
    await expect(page.getByRole('switch', { name: 'Open stories in a new tab' })).toBeChecked()
    await expect(page.getByRole('slider', { name: 'Text size' })).toHaveValue('17')
    await expect(page.getByRole('button', { name: 'Slate theme' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Serif', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('About shows the version and shortcuts; "original design" switches the redesign off', async ({ page }) => {
    await boot(page, '/news')
    await open(page)
    await expect(drawer(page).locator('.hn-sec').last()).toContainText('9.9.9')
    await expect(page.locator('.hn-keys dt')).toHaveText(['j / k', 'h / l', 'o', 'c', 'b', 'n / N'])
    await page.getByRole('button', { name: 'Use the original design' }).click()
    await expect(page.locator('.hn-header')).toBeHidden()
    await expect(page.locator('.pagetop').first()).toBeVisible()
  })
})

test.describe('view bar under the heading', () => {
  const bar = page => page.getByRole('group', { name: 'Story list options' })

  test('is always visible on list pages: show as Table / List, columns, bold titles; no ... menu', async ({ page }) => {
    await boot(page, '/news')
    await expect(bar(page)).toBeVisible()
    await expect(bar(page).locator('.hn-viewlabel')).toHaveText(['Show as', 'Columns'])
    await expect(page.getByRole('button', { name: 'View options' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Table', exact: true })).toHaveAttribute('aria-pressed', 'true')
    const box = [await page.locator('.hn-heading').boundingBox(), await bar(page).boundingBox()]
    expect(box[1].y).toBeGreaterThan(box[0].y + box[0].height - 1) // directly under the heading rule
  })

  test('Table / List switch, and the columns group only shows for the table', async ({ page }) => {
    await boot(page, '/news')
    await page.getByRole('button', { name: 'List', exact: true }).click()
    await expect(page.locator('.hn-index')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('group', { name: 'Columns' })).toBeHidden()
    await page.getByRole('button', { name: 'Table', exact: true }).click()
    await expect(page.locator('.hn-index')).toBeVisible()
    await expect(page.getByRole('group', { name: 'Columns' })).toBeVisible()
  })

  test('column chips toggle columns; the story column is always there and has no chip', async ({ page }) => {
    await boot(page, '/news')
    const chips = page.getByRole('group', { name: 'Columns' })
    await expect(chips.getByRole('button')).toHaveText(['Rank', 'Score', 'Domain', 'Author', 'Posted', 'Comments'])
    await chips.getByRole('button', { name: 'Posted', exact: true }).click()
    await expect(page.locator('.hn-index th')).toHaveText(['', 'Score', 'Story', 'Comments'])
    await chips.getByRole('button', { name: 'Author', exact: true }).click()
    await expect(page.locator('.hn-index th')).toHaveText(['', 'Score', 'Story', 'By', 'Comments'])
    await expect(chips.getByRole('button', { name: 'Story', exact: true })).toHaveCount(0) // always shown, so no chip
    await expect(chips.getByRole('button', { name: 'Author', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('bold story titles chip toggles the weight', async ({ page }) => {
    await boot(page, '/news')
    await page.getByRole('button', { name: 'Bold story titles', exact: true }).click()
    await expect(page.locator('.hn-index td.hn-title a').first()).toHaveCSS('font-weight', '600')
    await expect(page.getByRole('button', { name: 'Bold story titles', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('follows saved settings, and is absent where there is no list', async ({ page }) => {
    await boot(page, '/news', { settings: { columns: ['title', 'by'], view: 'table' } })
    await expect(page.getByRole('button', { name: 'Author', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Score', exact: true })).toHaveAttribute('aria-pressed', 'false')
    await page.unroute('https://news.ycombinator.com/**')
    await boot(page, '/item?id=1')
    await expect(page.locator('.hn-viewbar')).toHaveCount(0)
  })
})

test.describe('toolbar popup (launcher)', () => {
  const load = async page => {
    await page.addInitScript(() => {
      window.__s = { on: true }
      window.browser = { storage: { local: { get: async x => ({ ...x, ...window.__s }), set: async o => Object.assign(window.__s, o) } }, tabs: { create: async o => { window.__opened = o.url } } }
    })
    await page.goto('file:///' + src('popup.html').replaceAll('\\', '/'))
  }

  test('master switch writes on, and reflects the stored value', async ({ page }) => {
    await load(page)
    await expect(page.getByLabel('Redesign on')).toBeChecked()
    await page.getByLabel('Redesign on').uncheck()
    expect(await page.evaluate(() => window.__s.on)).toBe(false)
  })

  test('Open Hacker News opens a tab', async ({ page }) => {
    await load(page)
    await page.getByRole('button', { name: 'Open Hacker News' }).click()
    expect(await page.evaluate(() => window.__opened)).toBe('https://news.ycombinator.com/')
  })
})
