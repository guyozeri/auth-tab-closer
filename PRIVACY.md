# Privacy Policy — Auth Tab Closer

_Last updated: 2026-09-30_

Auth Tab Closer does not collect, transmit, sell, or share any personal data.

## What the extension reads

To recognise finished sign-in pages ("Login successful — you can close this
window"), the content script reads the visible text of pages you open. This text
is checked locally, in your browser, against a list of phrases and is then
discarded. It is never stored or sent anywhere.

## What the extension stores

Using Chrome's built-in `chrome.storage`, the extension keeps:

- **Your settings** (enabled state, close delay, notification preference,
  host block/allow list, custom phrases) in `chrome.storage.sync`, which Chrome
  may sync across your own signed-in browsers.
- **A short list of recently closed tabs** (title and URL) so you can reopen
  them from the popup, notification, or options page. It is kept in
  `chrome.storage.session` (or `local` as a fallback) and never leaves your
  device.

## Network access

The extension makes no network requests. It contains no analytics, tracking,
advertising, or remote code.

## Contact

Questions: open an issue at https://github.com/guyozeri/auth-tab-closer/issues
