// Data that grows (history, seen comments, bookmarks) is stored one key per item (history:<id>, seen:<id>, bm:<key>).
// An update never reads a shared list first, so tabs writing at the same moment cannot overwrite each other.
// Trimming to a maximum is the only step that looks at the whole set.
const kv = browser.storage.local

const keysWith = (all, prefix) => Object.keys(all).filter(k => k.startsWith(prefix))
const newestFirst = all => (a, b) => (all[b].t ?? 0) - (all[a].t ?? 0)

async function listItems(prefix) {
  const all = await kv.get(null)
  return keysWith(all, prefix).sort(newestFirst(all)).map(k => all[k])
}

// shortcut: caps are enforced at most every 6 hours (reading all of storage is the costly part), so a set can
// overshoot its cap between runs; if that ever matters, trim on write again.
const TRIM_EVERY = 6 * 3600 * 1000

async function trimItems(prefix, max) {
  const stamp = `trimmed:${prefix}`
  if (Date.now() - ((await kv.get(stamp))[stamp] ?? 0) < TRIM_EVERY) return
  await kv.set({ [stamp]: Date.now() })
  const all = await kv.get(null)
  const surplus = keysWith(all, prefix).sort(newestFirst(all)).slice(max)
  if (surplus.length) await kv.remove(surplus)
}

const removeItems = async prefix => kv.remove(keysWith(await kv.get(null), prefix))
const changedPrefix = (changes, prefix) => Object.keys(changes).some(k => k.startsWith(prefix))
