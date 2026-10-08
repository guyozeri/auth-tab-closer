# auth-tab-closer

A Chrome extension (Manifest V3) that automatically closes the dead-end tabs left
behind after you sign into a CLI or tool through the browser — the
_"Login Successful — you can close this window"_ / _"Authorization complete! —
you can close this tab"_ screens that command-line logins, single sign-on, and
device-code flows leave open.

When a tab is closed you get a Chrome notification with a **Reopen** button, and
the last several closed tabs are listed in the popup and options page.

The popup also has a **Close auth tabs now** button that checks every open tab and
closes the finished-auth ones immediately (no delay, works even while auto-close is
paused). It still skips pinned tabs, respects your host block/allow list, and won't
close the last tab in a window unless you allow that in Options.

## How it works

| Piece | Role |
| --- | --- |
| `src/rules.js` | Pure matcher shared by the content script and the service worker. Curated per-provider rules + generic "strong" phrases (`you can close this tab/window`, `authentication successful`, …) + "weak" phrases (`login successful`, …) that only count on a near-empty page. |
| `src/content.js` | Runs on every page. Reads visible text immediately and again as the DOM changes for ~10s (to catch SPA / redirect-rendered confirmation screens). Sends one message to the service worker on a match; never closes anything itself. |
| `src/background.js` | Service worker. Applies safety guards, waits a short delay, closes the tab, records it, and shows the notification. |
| `src/options.*` | Full settings: enable, delay, notification toggle, host block/allow list, custom phrases, recent-closed log. |
| `src/popup.*` | Quick enable/disable, "Close auth tabs now" sweep, recent-closed list. |

### Safety guards (all in the service worker)

A matched tab is only closed if **all** of these hold:

- the extension is enabled;
- the host is not on your block list (or, in allow-list mode, is on it);
- the tab is not pinned;
- it is not the only tab in its window (unless you opt in);
- for a weak-only match, the tab is younger than `maxTabAgeSeconds` (default 120)
  — strong / known-provider matches and tabs opened by another tab bypass this;
- after the delay, the tab still exists and its URL has not changed.

## Install (load unpacked)

1. `git clone https://github.com/guyozeri/auth-tab-closer.git`
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select the repo folder.
4. Optionally open the extension's **Options** to tune the delay and lists.

## Develop

```sh
npm test        # run the matcher unit tests (node --test, no dependencies)
npm run zip     # build auth-tab-closer.zip for distribution
```

`tests/fixtures/` contains standalone HTML pages reproducing the Teleport and
Cursor screens, a delayed-render SPA case, and a negative "dashboard" page — open
them with the extension loaded to sanity-check end to end.

## License

MIT © Guy Ozeri
