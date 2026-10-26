const path = require('node:path')
const manifest = require('../src/manifest.json')

const src = file => path.join(__dirname, '..', 'src', file)
const [content] = manifest.content_scripts

// HN's own markup and the style rules that fought the redesign (a:link colours, quirks mode: no doctype).
const HN_CSS = `body,td{font-family:Verdana;font-size:10pt;color:#828282}
a:link{color:#000;text-decoration:none} a:visited{color:#828282;text-decoration:none}
.c00,.c00 a:link{color:#000} .title{color:#828282}`

const header = who => `<tr><td bgcolor="#ff6600"><table border="0" width="100%"><tr><td><span class="pagetop"><b class="hnname"><a href="news">Hacker News</a></b><a href="newest">new</a></span></td>
<td style="text-align:right"><span class="pagetop">${who ?? '<a href="login?goto=news">login</a>'}</span></td></tr></table></td></tr>`

const story = (id, rank, title, site, meta) => `<tr class="athing submission" id="${id}"><td align="right" valign="top" class="title"><span class="rank">${rank}.</span></td>
<td valign="top" class="votelinks"><center><a href="vote?id=${id}"><div class="votearrow"></div></a></center></td>
<td class="title"><span class="titleline"><a href="https://${site}/x">${title}</a><span class="sitebit comhead"> (<a href="from?site=${site}"><span class="sitestr">${site}</span></a>)</span></span></td></tr>
<tr><td colspan="2"></td><td class="subtext">${meta}</td></tr><tr class="spacer" style="height:5px"></tr>`

const comment = (id, indent, text) => `<tr class="athing comtr" id="${id}"><td><table border="0"><tr><td class="ind" indent="${indent}"><img src="s.gif" height="1" width="${indent * 40}"></td>
<td class="default"><span class="comhead"><a href="user?id=bob" class="hnuser">bob</a><span class="navs"> | ${indent ? '<a href="#11" class="clicky">parent</a> | ' : ''}<a href="#${Number(id) + 1}" class="clicky">next</a></span></span>
<div class="comment"><div class="commtext c00">${text}</div><div class="reply"><a href="reply?id=${id}&amp;goto=item%3Fid%3D1">reply</a></div></div></td></tr></table></td></tr>`

const page = rows => `<html><head><style>${HN_CSS}</style></head><body><center><table id="hnmain" border="0" width="85%" bgcolor="#f6f6ef">${rows}</table></center></body></html>`

const pages = {
  '/news': page(`${header()}<tr id="bigbox"><td><table border="0">
    ${story(1, 1, 'Story A', 'a.example', '<span class="subline"><span class="score">231 points</span> by <a href="user?id=alice" class="hnuser">alice</a> <span class="age"><a href="item?id=1">3 hours ago</a></span> | <a href="hide?id=1">hide</a> | <a href="item?id=1">39&nbsp;comments</a></span>')}
    ${story(2, 2, 'Job B', 'b.example', '<span class="age"><a href="item?id=2">4 days ago</a></span>')}
    <tr class="morespace"></tr><tr><td colspan="2"></td><td class="title"><a href="news?p=2" class="morelink">More</a></td></tr></table></td></tr>`),
  '/item': page(`${header()}<tr id="bigbox"><td><table class="fatitem" border="0">
    ${story(1, 1, 'Story A', 'a.example', '<span class="subline"><span class="score">231 points</span> by <a href="user?id=alice" class="hnuser">alice</a></span>')}</table>
    <table class="comment-tree">${comment(11, 0, 'First!')}${comment(12, 1, 'Reply <a href="https://x.example">link</a>')}</table></td></tr>`),
  '/user': page(`${header()}<tr id="bigbox"><td><table border="0">
    <tr class="athing"><td valign="top">user:</td><td><a href="user?id=pg" class="hnuser">pg</a></td></tr>
    <tr><td valign="top">karma:</td><td>157316</td></tr>
    <tr><td></td><td><a href="submitted?id=pg"><u>submissions</u></a></td></tr>
    <tr><td></td><td><a href="threads?id=pg"><u>comments</u></a></td></tr></table></td></tr>`),
}

pages['/ask'] = pages['/news']
pages['/front'] = pages['/news']

// Tests describe data as lists and maps; the extension stores one key per item (see src/store.js).
function toKeys(patch) {
  const out = {}
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'bookmarks') v.forEach(b => { out[`bm:${b.key}`] = b })
    else if (k === 'seen') Object.entries(v).forEach(([id, e]) => { out[`seen:${id}`] = e })
    else if (k === 'history') v.forEach(e => { out[`history:${e.id}`] = e })
    else out[k] = v
  }
  return out
}

// Serve a fixture at its real HN URL, mock storage, then load the extension files in manifest order.
async function boot(page, url, { settings = {}, loggedIn = false } = {}) {
  const u = new URL(url, 'https://news.ycombinator.com')
  await page.route('https://news.ycombinator.com/**', route => {
    const { pathname } = new URL(route.request().url())
    // content.css is injected as a style tag here, so its relative font URLs resolve against the page: serve src/fonts there.
    if (pathname.startsWith('/fonts/')) return route.fulfill({ path: path.join(__dirname, '..', 'src', 'fonts', path.basename(pathname)), contentType: 'font/woff2' })
    const body = pages[pathname]
    const html = loggedIn ? body?.replace(/<a href="login[^>]*>login<\/a>/, '<a id="me" href="user?id=tester">tester</a> (<span id="karma">1</span>) | <a id="logout" href="logout">logout</a>') : body
    return html ? route.fulfill({ contentType: 'text/html', body: html }) : route.fulfill({ status: 404, body: '' })
  })
  await page.addInitScript(({ initial, token }) => {
    // Behaves like Firefox's storage.local: values are copied in and out, every call takes a tick (so
    // overlapping read-modify-write updates really do overlap), and listeners get a { key: { newValue } } map.
    const listeners = []
    const tick = () => new Promise(r => setTimeout(r, 0))
    const copy = v => (v === undefined ? undefined : structuredClone(v))
    // Kept in sessionStorage so reloads and page changes in one tab see the same data, as real storage does;
    // a new boot() (new token) starts from its own initial data.
    const saved = JSON.parse(sessionStorage.getItem('__mock') ?? 'null')
    const data = saved?.token === token ? saved.data : { ...initial }
    const persist = () => sessionStorage.setItem('__mock', JSON.stringify({ token, data }))
    persist()
    window.__store = data
    window.__items = prefix => Object.keys(data).filter(k => k.startsWith(prefix)).map(k => data[k]).sort((a, b) => (b.t ?? 0) - (a.t ?? 0))
    const notify = changes => listeners.forEach(f => f(changes))
    window.browser = {
      storage: {
        local: {
          get: async keys => {
            await tick()
            if (keys === null || keys === undefined) return copy(data)
            if (typeof keys === 'string') keys = [keys]
            if (Array.isArray(keys)) return copy(Object.fromEntries(keys.filter(k => k in data).map(k => [k, data[k]])))
            return copy({ ...keys, ...data })
          },
          set: async o => {
            await tick()
            const changes = {}
            for (const [k, v] of Object.entries(o)) { changes[k] = { newValue: copy(v) }; data[k] = copy(v) }
            persist()
            notify(changes)
          },
          remove: async keys => {
            await tick()
            const changes = {}
            for (const k of [].concat(keys)) if (k in data) { changes[k] = {}; delete data[k] }
            persist()
            if (Object.keys(changes).length) notify(changes)
          },
        },
        onChanged: { addListener: f => listeners.push(f) },
      },
      runtime: { getManifest: () => ({ version: '9.9.9' }) },
      tabs: { create: async o => { (window.__tabs ??= []).push(o.url) } },
    }
  }, { initial: toKeys(settings), token: Math.random() })
  await page.goto(u.href)
  await inject(page)
}

// Load the extension files in manifest order (also used after a reload).
async function inject(page) {
  for (const css of content.css) await page.addStyleTag({ path: src(css) })
  for (const js of content.js) await page.addScriptTag({ path: src(js) })
  await page.waitForTimeout(100)
}

const setSettings = async (page, patch) => {
  await page.evaluate(p => browser.storage.local.set(p), toKeys(patch))
  await page.waitForTimeout(100)
}

module.exports = { boot, inject, setSettings, src, htmlPage: page, header, story, comment }
