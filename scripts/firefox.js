// Shared real-Firefox set-up for the smoke test and the screenshots: headless Firefox with src/ installed as a
// temporary add-on, plus helpers to read and write the extension's storage through its own page.
const { Builder } = require('selenium-webdriver')
const firefox = require('selenium-webdriver/firefox')
const fs = require('node:fs')
const path = require('node:path')

const SRC = path.resolve(__dirname, '..', 'src')
const FIREFOX = process.env.FIREFOX_BIN || 'C:/Program Files/Mozilla Firefox/firefox.exe'
const ID = 'hacker-news-refresh@kheirou.dev'
const UUID = '5b0d4c1e-7a3f-4c2b-9d6e-1f2a3b4c5d6e' // pinned so the extension's own pages can be opened
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function launch({ out, size }) {
  fs.mkdirSync(out, { recursive: true })
  const options = new firefox.Options().addArguments('-headless').setBinary(FIREFOX)
  options.setPreference('extensions.webextensions.uuids', JSON.stringify({ [ID]: UUID }))
  if (size) options.windowSize(size)
  const service = new firefox.ServiceBuilder().addArguments('--allow-system-access')
  const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).setFirefoxService(service).build()

  // moz-extension:// pages can't be navigated to by webdriver: open the popup page as a real tab via the browser
  // chrome, run something on it, then close that tab and go back to where we were.
  const onExtensionPage = async fn => {
    const previous = await driver.getWindowHandle()
    await driver.setContext('chrome')
    await driver.executeScript(u => { gBrowser.selectedTab = gBrowser.addTrustedTab(u) }, `moz-extension://${UUID}/popup.html`)
    await driver.setContext('content')
    const handles = await driver.getAllWindowHandles()
    await driver.switchTo().window(handles[handles.length - 1])
    await sleep(500)
    try { return await fn() } finally { await driver.close(); await driver.switchTo().window(previous) }
  }

  return {
    driver,
    ID,
    install: () => driver.installAddon(SRC, true),
    onExtensionPage,
    setStorage: patch => onExtensionPage(async () => { await driver.executeScript(p => browser.storage.local.set(p), patch); await sleep(200) }),
    getStorage: () => onExtensionPage(() => driver.executeAsyncScript(done => browser.storage.local.get().then(done))),
    probe: fn => driver.executeScript(fn),
    load: async url => { await driver.get(url); await sleep(2500) },
    shot: async name => { await sleep(400); fs.writeFileSync(path.join(out, `${name}.png`), await driver.takeScreenshot(), 'base64') },
  }
}

module.exports = { launch, sleep }
