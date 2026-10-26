// Remember story pages you open (local only, newest first, capped). The history panel lists them.
const HISTORY_MAX = 100

async function recordVisit() {
  const link = document.querySelector('.fatitem .titleline > a')
  const id = new URLSearchParams(location.search).get('id')
  if (!link || !id || location.pathname !== '/item') return
  await kv.set({ [`history:${id}`]: { id, title: link.textContent, t: Date.now() } })
  await trimItems('history:', HISTORY_MAX)
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', recordVisit, { once: true }) : recordVisit()
