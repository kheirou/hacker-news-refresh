// The toolbar popup is only a launcher plus the master switch, so the redesign can be turned back on
// even when the original design is showing (and its Aa button is hidden).
const onBox = document.querySelector('#on')

browser.storage.local.get(DEFAULTS).then(s => { onBox.checked = s.on })
onBox.addEventListener('change', () => browser.storage.local.set({ on: onBox.checked }))
document.querySelector('#open').addEventListener('click', () => {
  browser.tabs.create({ url: 'https://news.ycombinator.com/' })
  window.close()
})
