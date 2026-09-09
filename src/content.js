/*
 * auth-tab-closer — content script
 *
 * Runs on every page. Reads visible text now and again as the DOM changes for a short
 * window (SPA / redirect-rendered confirmation pages), and messages the service worker
 * once if the page looks like a finished-auth dead end. All destructive logic lives in
 * the service worker — this script never closes anything itself.
 */
(function () {
  "use strict";

  const RULES = globalThis.AUTH_TAB_RULES;
  if (!RULES) return;

  const OBSERVE_MS = 10000; // keep watching for late-rendered content this long
  const DEBOUNCE_MS = 250;

  let reported = false;
  let debounceTimer = null;
  let observer = null;
  let stopTimer = null;
  let extraPhrases = []; // cached once at start; rarely changes mid-page

  function visibleText() {
    // innerText respects visibility / display; fall back to textContent.
    const body = document.body;
    if (!body) return "";
    const t = body.innerText || body.textContent || "";
    return t.slice(0, 20000);
  }

  function loadExtraPhrases(cb) {
    try {
      chrome.storage.sync.get({ extraStrongPhrases: [] }, (res) => {
        extraPhrases = Array.isArray(res.extraStrongPhrases)
          ? res.extraStrongPhrases
          : [];
        cb();
      });
    } catch (_) {
      cb();
    }
  }

  function check() {
    if (reported) return;
    const verdict = RULES.evaluate({
      text: visibleText(),
      title: document.title,
      host: location.hostname,
      extraStrongPhrases: extraPhrases,
    });
    if (!verdict.match) return;
    reported = true;
    teardown();
    try {
      chrome.runtime.sendMessage({
        type: "AUTH_TAB_MATCH",
        reason: verdict.reason,
        score: verdict.score,
        url: location.href,
        title: document.title,
      });
    } catch (_) {
      /* service worker asleep / context gone — nothing we can do */
    }
  }

  function scheduleCheck() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(check, DEBOUNCE_MS);
  }

  function teardown() {
    if (observer) observer.disconnect();
    observer = null;
    clearTimeout(debounceTimer);
    clearTimeout(stopTimer);
  }

  function start() {
    loadExtraPhrases(() => {
      check();
      if (reported) return;
      observer = new MutationObserver(scheduleCheck);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      stopTimer = setTimeout(teardown, OBSERVE_MS);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
