// Settings live in storage.local; the panels write them. CSS only applies while data-hn-on is set.
const FLAGS = {
  justify: 'hn-justify', fade: 'hn-fade', hoverIcons: 'hn-hover', fixedHeader: 'hn-fixed', smoothing: 'hn-smooth', boldTitle: 'hn-bold', controlPad: 'hn-pad',
}
const osDark = matchMedia('(prefers-color-scheme: dark)')

function apply(s) {
  const root = document.documentElement
  root.toggleAttribute('data-hn-on', s.on)
  root.dataset.hnTheme = s.autoDark ? (osDark.matches ? 'dark' : 'light') : s.theme
  root.dataset.hnFont = s.font
  for (const [key, attr] of Object.entries(FLAGS)) root.toggleAttribute(`data-${attr}`, s.on && s[key])
  root.style.setProperty('--size', `${s.size}px`)
  root.style.setProperty('--width', `${s.width}px`)
  root.style.setProperty('--line', s.line)
  renderWhenReady(s)
}

const load = () => browser.storage.local.get(DEFAULTS).then(apply)
apply(DEFAULTS)
load()
browser.storage.onChanged.addListener(changes => { if (settingsChanged(changes)) load() }) // bookmark/history/seen writes must not rebuild the page
osDark.addEventListener('change', load)
