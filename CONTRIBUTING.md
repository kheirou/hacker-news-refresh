# Contributing

Thanks for helping. Small, focused pull requests are easiest to review.

## Ground rules

- Original work only. Do not copy code, CSS, icons, wording or screenshots from other extensions or sites.
- No new permissions, remote code or tracking without a prior issue.
- Build UI with DOM APIs (no `innerHTML`); scope styles under `:root[data-hn-on]` so turning the redesign off restores HN.
- Keep user-facing text short and plain.

## Set up

```powershell
mise install
npm ci
mise run setup:browsers
```

## Before you open a pull request

1. `mise run dev:ci` must pass (web-ext lint with warnings as errors, plus Playwright tests).
2. For anything visual, also run `mise run smoke:firefox` (real Firefox, needs network).
3. Add or update a test with your change; fixtures live in `tests/helpers.js`.
4. Add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md).
5. Fill in the pull request template.

Pull requests are squash-merged into `main`. The maintainer runs the gate locally rather than on GitHub Actions, so please paste your `mise run dev:ci` result in the PR.

## Reporting bugs and ideas

Use the issue templates. For security problems follow [SECURITY.md](SECURITY.md) instead.

By contributing you agree your work is licensed under the [MIT licence](LICENSE).
