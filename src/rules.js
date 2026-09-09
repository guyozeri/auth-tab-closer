/*
 * auth-tab-closer — shared matcher
 *
 * Loaded two ways with no build step:
 *   - as the first file in the content-script `js` array (plain classic script)
 *   - via `importScripts('src/rules.js')` inside the classic service worker
 *
 * It attaches everything to `globalThis.AUTH_TAB_RULES` so both contexts can reach it.
 */
(function (global) {
  "use strict";

  // Phrases that, on their own, are strong evidence a tab is a finished-auth dead end.
  // These almost never appear on a page the user actually wants to keep.
  const STRONG_PHRASES = [
    "you can close this tab",
    "you can close this window",
    "you may close this tab",
    "you may close this window",
    "you can now close this tab",
    "you can now close this window",
    "you may now close this tab",
    "you may now close this window",
    "this tab can be closed",
    "this window can be closed",
    "it is safe to close this tab",
    "it is safe to close this window",
    "safe to close this tab",
    "safe to close this window",
    "please close this tab",
    "please close this window",
    "close this tab and return",
    "close this window and return",
    "received verification code. you may now close",
    "received verification code. you can now close",
    "authentication successful",
    "authentication complete",
    "you are now authenticated",
    "you have been authenticated",
  ];

  // Phrases that only count when paired with a strong phrase OR a near-empty page.
  const WEAK_PHRASES = [
    "login successful",
    "log in successful",
    "sign-in successful",
    "sign in successful",
    "signed in successfully",
    "authorization complete",
    "authorization successful",
    "authorized successfully",
    "you're all set",
    "you are all set",
    "success!",
  ];

  // Curated per-provider rules. `all` substrings must ALL be present (case-insensitive,
  // whitespace-normalized). `hostIncludes` is an optional extra constraint on the hostname.
  const PROVIDER_RULES = [
    { name: "Teleport", all: ["login successful", "close this window"] },
    { name: "Cursor", all: ["authorization complete", "return to cursor"] },
    { name: "Google OAuth (loopback)", all: ["received verification code"] },
    { name: "GitHub device flow", all: ["device", "you're all set"] },
    { name: "GitHub OAuth", hostIncludes: "github.com", all: ["successfully authenticated"] },
    { name: "AWS SSO", all: ["request approved", "you can close this"] },
    { name: "AWS SSO (alt)", all: ["approved", "close this window", "aws"] },
    { name: "Vercel CLI", hostIncludes: "vercel.com", all: ["success", "close this tab"] },
    { name: "Supabase CLI", hostIncludes: "supabase.com", all: ["token", "close this tab"] },
    { name: "Linear", hostIncludes: "linear.app", all: ["authorized", "close this"] },
    { name: "Slack", all: ["you may close this tab", "slack"] },
    { name: "npm", all: ["you have authenticated", "close this"] },
    { name: "Netlify CLI", hostIncludes: "netlify.com", all: ["authorized", "close this window"] },
    { name: "Stripe CLI", hostIncludes: "stripe.com", all: ["pairing", "you can close this"] },
    { name: "Fly.io", hostIncludes: "fly.io", all: ["signed in", "close this"] },
    { name: "Doppler", hostIncludes: "doppler.com", all: ["authorized", "close this tab"] },
    { name: "Tailscale", hostIncludes: "tailscale.com", all: ["success", "close this"] },
  ];

  // A page with very little visible text is very likely a bare "you can close this" screen.
  const SPARSE_PAGE_MAX_CHARS = 400;

  function normalize(str) {
    return (str || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function anyPhrase(haystack, phrases) {
    for (const p of phrases) {
      if (haystack.includes(p)) return p;
    }
    return null;
  }

  /**
   * Decide whether a tab looks like a closeable finished-auth tab.
   *
   * @param {object} input
   * @param {string} input.text  visible page text
   * @param {string} [input.title] document title
   * @param {string} [input.host] location.hostname
   * @param {string[]} [input.extraStrongPhrases] user-supplied extra strong phrases
   * @returns {{match: boolean, score: number, reason: string}}
   *   score: 0 = no match, 2 = weak-only match on a sparse page, 3 = provider/strong match
   */
  function evaluate(input) {
    const text = normalize(input && input.text);
    const title = normalize(input && input.title);
    const host = normalize(input && input.host);
    const haystack = title ? text + " " + title : text;
    const extraStrong = (input && input.extraStrongPhrases) || [];

    if (!haystack) return { match: false, score: 0, reason: "empty page" };

    // 1. Curated provider rules win outright.
    for (const rule of PROVIDER_RULES) {
      if (rule.hostIncludes && !host.includes(rule.hostIncludes)) continue;
      if (rule.all.every((s) => haystack.includes(s))) {
        return { match: true, score: 3, reason: "provider: " + rule.name };
      }
    }

    // 2. Strong generic phrase (built-in or user-supplied).
    const strongHit =
      anyPhrase(haystack, STRONG_PHRASES) ||
      anyPhrase(haystack, extraStrong.map(normalize).filter(Boolean));
    if (strongHit) {
      return { match: true, score: 3, reason: 'strong phrase: "' + strongHit + '"' };
    }

    // 3. Weak phrase — only on a sparse page (bare confirmation screen).
    const weakHit = anyPhrase(haystack, WEAK_PHRASES);
    if (weakHit && text.length <= SPARSE_PAGE_MAX_CHARS) {
      return {
        match: true,
        score: 2,
        reason: 'weak phrase on sparse page: "' + weakHit + '"',
      };
    }

    return { match: false, score: 0, reason: "no match" };
  }

  global.AUTH_TAB_RULES = {
    evaluate,
    normalize,
    STRONG_PHRASES,
    WEAK_PHRASES,
    PROVIDER_RULES,
    SPARSE_PAGE_MAX_CHARS,
  };

  // Also expose as a CommonJS module for `node --test`.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.AUTH_TAB_RULES;
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
