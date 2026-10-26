# AMO listing (copy into the developer hub)

Original work. Own code, icons, wording and name; no third-party assets, branding or payment code. Not affiliated with Y Combinator.

## Name
HN Redesign

## Summary (max 250 chars)
Reads Hacker News like a modern site: tidy header with tabs, a score table, five colour themes, bookmarks, new-comment badges, keyboard shortcuts and a one-click way back to the original page. Free, no account, nothing leaves your browser.

## Description
Open Hacker News and it already looks better. Everything is free and needs no account.

**Make it yours**
- Five colour themes (one is a classic HN look), or follow your system's dark mode
- Choose Sans, Serif or Inter, and set text size, line spacing and page width with sliders
- Show stories as a score table or HN's own list, and pick which columns appear
- Keep the header in view, dim stories you have opened, hide vote arrows until you hover, open stories in a new tab
- Switch back to the original page with one click

**Keep track**
- Bookmark stories, comments, people and highlighted passages, and back them up to a file and restore them
- See which stories have new comments since you last looked, and jump between the new ones
- Select text in a comment to highlight it, quote it, copy it, listen to it or search for it
- Hover a name to see account age, karma and bio
- Revisit recently opened stories, use profile tabs and an account menu, and open the front page of any earlier day

**Move faster**
- Reply under a comment without leaving the page (uses your existing login)
- Keyboard shortcuts and an on-screen arrow pad

Not endorsed by, affiliated with, or sponsored by Y Combinator.

## Licence field
MIT License (the text is in the zip as LICENSE; the bundled Inter font is SIL OFL 1.1 in fonts/OFL.txt).

## Category
Appearance (secondary: Social & Communication)

## Privacy
The extension collects nothing and has no analytics. Settings, bookmarks, your recently viewed stories and which comments you have seen are stored only in your browser (storage.local). It runs only on news.ycombinator.com. The only requests it makes are to Hacker News itself: the inline reply form and post go to news.ycombinator.com with your own session, exactly as HN's reply form does, and the username card asks Hacker News's public API (hacker-news.firebaseio.com) for that user's public profile, so that user name is sent to Hacker News when you hover it. Search and the "search HN" action are plain links to hn.algolia.com that you click yourself.

Manifest: `data_collection_permissions: none`.

## Permissions, for the reviewer
- `storage`: settings, bookmarks, history, seen-comment counts.
- Host `https://news.ycombinator.com/*` (content scripts): restyle the page and add the features.
- Host `https://hacker-news.firebaseio.com/*`: username card (public user profile, read only).
- `web_accessible_resources: fonts/*`: the bundled Inter font files, so the page's styles can load them (Firefox blocks the request otherwise). The extension's address contains a random per-install id, so sites cannot probe for them.

## Notes to reviewer
- No build step, no minification, no bundler: the zip is the `src/` folder as is.
- `src/fonts/` holds Inter (variable weight, Latin and Latin Extended subsets, two .woff2 files, 133 KB) under the SIL Open Font License 1.1; the licence text is `src/fonts/OFL.txt`. The files come unmodified from the `@fontsource-variable/inter` 5.3.0 npm package. They are fetched only when the Inter font is chosen.
- No remote code, no eval, no innerHTML/outerHTML/insertAdjacentHTML; every DOM node is built with createElement / textContent / SVG attributes. A user's "about" text from the API is flattened to plain text.
- Network: only news.ycombinator.com (same origin: reply form and post) and hacker-news.firebaseio.com/v0/user/NAME.json (GET). Nothing else is fetched; hn.algolia.com is only linked.
- Test: install, open https://news.ycombinator.com/. Aa button: the settings drawer (colour, text, page, reading, about). The bar under the heading: table or list, columns, bold titles. Bookmark icons appear on row hover. Open any story page: comments get bookmark icons; select a comment's text for the toolbar; hover a username for the card; press j / k. The toolbar button has the on/off switch.
- Inline reply and the account menu need a logged-in HN account; logged out they fall back to HN's own pages.
- CSS uses nesting (hence strict_min_version 142, which `data_collection_permissions` also needs).
- Licence: MIT (LICENSE in the zip). Source and tests: https://github.com/kheirou/hn-redesign (the uploaded zip is the source).

## Screenshots (docs/screenshots/, 1280x800, real Firefox, public pages)
1. 1-front-dark-table.png: front page, dark theme, table view, control pad
2. 2-bookmarks-panel.png: bookmarks panel
3. 3-settings-panel.png: the settings drawer (colour tiles, typeface, text steppers, switches)
4. 4-thread-new-comments-selection.png: thread with new-comment marks, arrows and the selection toolbar
5. 5-user-card.png: username card (demo user pg)
6. 6-original-design-restored.png: the original design, one click away
