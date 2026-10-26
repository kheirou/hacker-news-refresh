# Security policy

## Supported versions

Only the latest release receives fixes.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private reporting: **Security** tab → **Report a vulnerability**.

Include the steps to reproduce and the Firefox version. Expect a first reply within a week.

## Scope

The extension reads only `news.ycombinator.com` and `hacker-news.firebaseio.com`, stores data in `storage.local`, and runs no remote code. Reports about that surface (script injection through page content, data leaving the browser, permission creep) are in scope.
