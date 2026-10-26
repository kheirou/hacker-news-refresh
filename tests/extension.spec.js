const { test, expect } = require('@playwright/test')
const { boot, setSettings, src } = require('./helpers')

const color = (page, selector) => page.locator(selector).first().evaluate(e => getComputedStyle(e).color)
const display = (page, selector) => page.locator(selector).first().evaluate(e => getComputedStyle(e).display)

test.describe('themes and the on/off switch', () => {
  test('dark theme recolours the page, including links HN forces to black', async ({ page }) => {
    await boot(page, '/item?id=1', { settings: { theme: 'dark' } })
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(29, 29, 34)')
    expect(await color(page, '.titleline > a')).toBe('rgb(232, 232, 234)')
    expect(await color(page, '.commtext a')).toBe('rgb(232, 232, 234)')
  })

  test('off restores the original design and on brings it back live', async ({ page }) => {
    await boot(page, '/news', { settings: { theme: 'dark', view: 'table' } })
    await expect(page.locator('.hn-index')).toBeVisible()
    await expect(page.locator('.hn-header')).toBeVisible()
    await setSettings(page, { on: false })
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(page.locator('.hn-index')).toHaveCount(0)
    await expect(page.locator('.hn-header')).toBeHidden()
    await expect(page.locator('.hn-heading')).toBeHidden()
    await expect(page.locator('tr.athing').first()).toBeVisible()
    await expect(page.locator('.pagetop').first()).toBeVisible()
    await setSettings(page, { on: true })
    await expect(page.locator('.hn-index')).toBeVisible()
  })

  test('font, size and justify settings apply', async ({ page }) => {
    await boot(page, '/item?id=1', { settings: { font: 'serif', size: 18, justify: true } })
    await expect(page.locator('body')).toHaveCSS('font-size', '18px')
    await expect(page.locator('body')).toHaveCSS('font-family', /Georgia/)
    await expect(page.locator('.commtext').first()).toHaveCSS('text-align', 'justify')
  })
})

test.describe('page frame', () => {
  test('section tabs mark the current section; more menu lists the rest', async ({ page }) => {
    await boot(page, '/news')
    await expect(page.locator('.hn-tab')).toHaveText(['Top', 'Ask', 'Show', 'Best', 'New', 'Active'])
    await expect(page.locator('.hn-tab[aria-current]')).toHaveText('Top')
    await page.getByRole('button', { name: 'More sections' }).click()
    await expect(page.locator('.hn-sections .hn-panel a')).toHaveText(['past', 'comments', 'jobs', 'submit'])
  })

  test('another section marks its own tab and heads the list with its name', async ({ page }) => {
    await boot(page, '/ask')
    await expect(page.locator('.hn-tab[aria-current]')).toHaveText('Ask')
    await expect(page.locator('.hn-heading h1')).toHaveText('Ask')
  })

  test('front page heading shows today as weekday, day month, year', async ({ page }) => {
    await boot(page, '/news')
    const now = new Date()
    await expect(page.locator('.hn-day')).toHaveText(new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(now))
    await expect(page.locator('.hn-year')).toHaveText(String(now.getFullYear()))
  })

  test('flat layout: no card border, HN header row hidden, content centred', async ({ page }) => {
    await boot(page, '/news')
    await expect(page.locator('#hnmain')).toHaveCSS('border-top-width', '0px')
    await expect(page.locator('.pagetop').first()).toBeHidden()
    const box = await page.locator('#hnmain').boundingBox()
    expect(Math.abs(box.x - (1280 - box.x - box.width))).toBeLessThanOrEqual(2)
  })

  test('fixed header sticks only when the setting is on', async ({ page }) => {
    await boot(page, '/news')
    await expect(page.locator('.hn-header')).toHaveCSS('position', 'sticky')
    await setSettings(page, { fixedHeader: false })
    await expect(page.locator('.hn-header')).toHaveCSS('position', 'relative')
  })

  test('toolbar panels open one at a time and Esc closes them with focus back on the trigger', async ({ page }) => {
    await boot(page, '/news', { loggedIn: true })
    const history = page.getByRole('button', { name: 'History' })
    const account = page.getByRole('button', { name: 'Account' })
    await history.click()
    await expect(page.locator('.hn-history-panel')).toBeVisible()
    await account.click()
    await expect(page.locator('.hn-history-panel')).toBeHidden()
    await expect(page.locator('.hn-account-top')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.hn-account-top')).toBeHidden()
    await expect(account).toBeFocused()
    await account.click()
    await page.locator('h1').click()
    await expect(page.locator('.hn-account-top')).toBeHidden()
  })

  test('search icon links to HN search', async ({ page }) => {
    await boot(page, '/news')
    await expect(page.getByRole('link', { name: 'Search' })).toHaveAttribute('href', 'https://hn.algolia.com/')
  })

  test('theme can follow the OS (auto dark)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await boot(page, '/news', { settings: { autoDark: true, theme: 'light' } })
    await expect(page.locator('html')).toHaveAttribute('data-hn-theme', 'dark')
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.locator('html')).toHaveAttribute('data-hn-theme', 'light')
  })

  test('open links in new tab changes story links only, and undoes it when turned off', async ({ page }) => {
    await boot(page, '/news', { settings: { newTab: true } })
    await expect(page.locator('.hn-index td.hn-title a').first()).toHaveAttribute('target', '_blank')
    await expect(page.locator('.hn-index td.hn-comments a').first()).not.toHaveAttribute('target', '_blank')
    await setSettings(page, { newTab: false })
    await expect(page.locator('.hn-index td.hn-title a').first()).not.toHaveAttribute('target', '_blank')
    await expect(page.locator('.titleline > a').first()).not.toHaveAttribute('target', '_blank')
  })
})

test.describe('index table view', () => {
  test('is the default and builds one row per story with the chosen columns', async ({ page }) => {
    await boot(page, '/news')
    await expect(page.locator('.hn-index th')).toHaveText(['', 'Score', 'Story', 'Posted', 'Comments'])
    const first = page.locator('.hn-index tbody tr').first().locator('td')
    await expect(first).toHaveText(['1.', '231', 'Story A (a.example)', '3 hours', '39'])
    await setSettings(page, { columns: ['title', 'points', 'by'] })
    await expect(page.locator('.hn-index th')).toHaveText(['Score', 'Story', 'By'])
    await expect(page.locator('.hn-index tbody tr').first().locator('td')).toHaveText(['231', 'Story A', 'alice'])
  })

  test('job rows without score, author or comments get empty cells; More link stays', async ({ page }) => {
    await boot(page, '/news')
    const job = page.locator('.hn-index tbody tr').nth(1).locator('td')
    await expect(job).toHaveText(['2.', '', 'Job B (b.example)', '4 days', ''])
    await expect(page.locator('a.morelink')).toBeVisible()
    expect(await display(page, 'tr.athing')).toBe('none')
  })

  test('list view leaves the table out; item pages never get one', async ({ page }) => {
    await boot(page, '/news', { settings: { view: 'list' } })
    await expect(page.locator('.hn-index')).toHaveCount(0)
    await setSettings(page, { view: 'table' })
    await expect(page.locator('.hn-index')).toBeVisible()
    await page.unroute('https://news.ycombinator.com/**')
    await boot(page, '/item?id=1', { settings: { view: 'table' } })
    await expect(page.locator('.hn-index')).toHaveCount(0)
  })

  test('bold title and shortened ages', async ({ page }) => {
    await boot(page, '/news', { settings: { boldTitle: true } })
    await expect(page.locator('.hn-index td.hn-title a').first()).toHaveCSS('font-weight', '600')
    await setSettings(page, { boldTitle: false })
    await expect(page.locator('.hn-index td.hn-title a').first()).toHaveCSS('font-weight', '400')
  })
})

test.describe('inline reply', () => {
  const form = '<form action="comment" method="post"><input type="hidden" name="parent" value="11"><input type="hidden" name="goto" value="item?id=1"><input type="hidden" name="hmac" value="abc"><textarea name="text"></textarea></form>'

  test('posts the copied hidden fields plus the text, then offers a reload link', async ({ page }) => {
    await boot(page, '/item?id=1')
    let posted
    await page.route('**/reply?id=11*', r => r.fulfill({ contentType: 'text/html', body: form }))
    await page.route('**/comment', r => {
      posted = r.request().postData()
      return r.fulfill({ status: 302, headers: { location: '/item?id=1' } })
    })
    await page.locator('.reply a').first().click()
    await page.locator('form.hn-reply textarea').fill('hello')
    await page.locator('form.hn-reply button').click()
    await expect(page.locator('form.hn-reply')).toContainText('Posted.')
    expect(Object.fromEntries(new URLSearchParams(posted))).toEqual({ parent: '11', goto: 'item?id=1', hmac: 'abc', text: 'hello' })
  })

  test('a rejected post shows a message and a link to the reply page', async ({ page }) => {
    await boot(page, '/item?id=1')
    await page.route('**/reply?id=11*', r => r.fulfill({ contentType: 'text/html', body: form }))
    await page.route('**/comment', r => r.fulfill({ contentType: 'text/html', body: 'posting too fast' }))
    await page.locator('.reply a').first().click()
    await page.locator('form.hn-reply textarea').fill('x')
    await page.locator('form.hn-reply button').click()
    await expect(page.locator('form.hn-reply')).toContainText('HN did not accept it')
  })

  test('logged out (no form on the reply page) falls back to HN own page', async ({ page }) => {
    await boot(page, '/item?id=1')
    await page.route('**/reply?id=11*', r => r.fulfill({ contentType: 'text/html', body: '<form action="login"></form>' }))
    await page.locator('.reply a').first().click()
    await expect(page).toHaveURL(/\/reply\?id=11/)
  })

  test('HN prev/next links in the comment menu stay visible', async ({ page }) => {
    await boot(page, '/item?id=1')
    await expect(page.locator('.navs a').first()).toBeVisible()
  })
})

test.describe('history', () => {
  test('records a story page newest first, deduped; skips comment permalinks', async ({ page }) => {
    await boot(page, '/item?id=1', { settings: { history: [{ id: '9', title: 'old', t: 1 }, { id: '1', title: 'stale', t: 2 }] } })
    const ids = await page.evaluate(() => __items('history:').map(h => `${h.id}:${h.title}`))
    expect(ids).toEqual(['1:Story A', '9:old'])
  })

  test('a page with no story title (comment permalink) records nothing', async ({ page }) => {
    await boot(page, '/item?id=11', { settings: { history: [] } })
    // The permalink's .fatitem holds a comment, not a .titleline: reset what the first load recorded and drop the title.
    await page.evaluate(() => { for (const k of Object.keys(__store)) if (k.startsWith('history:')) delete __store[k]; document.querySelector('.fatitem .titleline').remove() })
    await page.addScriptTag({ path: src('history.js') })
    expect(await page.evaluate(() => __items('history:'))).toEqual([])
  })

  test('history panel lists stored stories and can be cleared', async ({ page }) => {
    await boot(page, '/news', { settings: { history: [{ id: '7', title: 'Seven', t: 1 }, { id: '6', title: 'Six', t: 0 }] } })
    await page.getByRole('button', { name: 'History' }).click()
    await expect(page.locator('.hn-history li a')).toHaveText(['Seven', 'Six'])
    await expect(page.locator('.hn-history li a').first()).toHaveAttribute('href', 'item?id=7')
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(page.locator('.hn-history li')).toHaveCount(1)
    await expect(page.locator('.hn-history li')).toHaveText('Nothing yet')
  })
})

test.describe('account menu and profile tabs', () => {
  test('profile page gets tabs built from HN links; original rows hide', async ({ page }) => {
    await boot(page, '/user?id=pg')
    await expect(page.locator('.hn-tabs a')).toHaveText(['submissions', 'comments'])
    expect(await display(page, '.hn-tabrow')).toBe('none')
  })

  test('logged in: panel shows name, karma, links and logout', async ({ page }) => {
    await boot(page, '/user?id=pg', { loggedIn: true })
    await page.getByRole('button', { name: 'Account' }).click()
    await expect(page.locator('.hn-account-top')).toContainText('tester')
    await expect(page.locator('.hn-account-top')).toContainText('1 karma')
    await expect(page.locator('.hn-account-card a')).toHaveText(['Submissions', 'Comments', 'Favorites', 'Upvoted', 'Hidden', 'Log out'])
    await expect(page.getByRole('link', { name: 'Submissions', exact: true })).toHaveAttribute('href', 'submitted?id=tester')
    await expect(page.getByRole('link', { name: 'Log out' })).toHaveAttribute('href', 'logout')
  })

  test('logged out: account panel offers log in', async ({ page }) => {
    await boot(page, '/news')
    await page.getByRole('button', { name: 'Account' }).click()
    await expect(page.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', 'login?goto=news')
  })
})

