# Architecture

A Firefox MV2 extension with no build step. One content script bundle runs at `document_start` on `news.ycombinator.com`; the files load in the order listed in `src/manifest.json`.

## Files in `src/`

| File | Job |
|------|-----|
| `defaults.js` | Setting defaults, limits, column definitions |
| `store.js` | `storage.local` helpers (list, trim, remove by prefix) |
| `ui.js` | DOM helpers, icons, brand mark, one-at-a-time panels |
| `shell.js` | Header, tabs, toolbar, heading, account card |
| `panels.js` | Settings drawer and the list/table view bar |
| `index.js` | Table and list views of story pages |
| `comments.js`, `newreplies.js` | Inline reply, new-comment marks and arrows |
| `bookmarks.js`, `history.js` | Saved items and recently viewed |
| `selection.js`, `userpop.js`, `controls.js`, `profile.js` | Selection popup, user cards, control pad, profile layout |
| `content.js` | Wires everything and re-renders when settings change |
| `content.css` | Tokens, themes and layout, nested under `:root[data-hn-on]` |
| `popup.html`, `popup.js` | Toolbar popup: launcher and master switch |

## Design rules

- All styles live under `:root[data-hn-on]`, so switching the redesign off restores HN exactly.
- UI is built from DOM APIs, never `innerHTML`.
- HN serves no doctype (quirks mode); the CSS resets table font and line height explicitly.

## Storage

One key per item so tabs writing at once cannot overwrite each other:

- `history:<id>`: recently viewed stories
- `seen:<id>`: `{count, ids, pages, t}` for new-reply marks
- `bm:<key>`: bookmarks
- plain keys from `DEFAULTS`: settings

`trimItems` caps each growing prefix at most every 6 hours. Non-settings writes never re-render the page.

## Tests

- `tests/*.spec.js` (Playwright, Chromium) serve HN-shaped fixtures with a mock `browser.storage` that behaves like Firefox.
- `scripts/firefox-smoke.js` drives real Firefox with Selenium and geckodriver against live HN.
- `mise run dev:ci` is the merge gate.
