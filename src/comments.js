// Inline reply: swap HN's reply page for a form under the comment. Logged out (no form on the reply page) it
// falls back to HN's own page, so nothing is lost.
const redesignOn = () => document.documentElement.hasAttribute('data-hn-on')

// `initial` pre-fills the box (quote reply); an already open form just gets the text added.
async function openReply(link, initial = '') {
  const holder = link.closest('.comment, .toptext, td.default, td')
  const open = holder?.querySelector('.hn-reply textarea')
  if (open) { open.value += initial; open.focus(); return }
  if (!holder) return
  const page = new DOMParser().parseFromString(await (await fetch(link.href, { credentials: 'same-origin' })).text(), 'text/html')
  const source = page.querySelector('form[action="comment"]')
  if (!source) return void (location.href = link.href)

  const status = h('span')
  const box = h('textarea', { name: 'text', rows: 6, value: initial })
  const form = h('form', { className: 'hn-reply' }, box, h('br'), h('button', { type: 'submit', textContent: 'reply' }), status)
  for (const input of source.querySelectorAll('input[type=hidden]')) form.prepend(input.cloneNode())
  form.addEventListener('submit', async e => {
    e.preventDefault()
    status.textContent = ' posting...'
    const res = await fetch('comment', { method: 'POST', credentials: 'same-origin', body: new URLSearchParams(new FormData(form)) }).catch(() => null)
    if (res?.ok && res.redirected) {
      form.replaceChildren(h('span', {}, 'Posted. '), h('a', { href: res.url, textContent: 'Reload to see it' }))
    } else {
      status.textContent = ' HN did not accept it (rate limit, or too short?). '
      status.append(h('a', { href: link.href, textContent: 'open the reply page' }))
    }
  })
  holder.append(form)
  box.focus()
}

document.addEventListener('click', e => {
  const link = e.target.closest?.('a[href^="reply?id="]')
  if (!link || !redesignOn() || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
  e.preventDefault()
  openReply(link).catch(() => void (location.href = link.href))
})
