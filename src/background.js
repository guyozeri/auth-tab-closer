/*
 * auth-tab-closer — service worker (classic, so we can importScripts the shared matcher)
 *
 * Receives AUTH_TAB_MATCH from content scripts, applies safety guards, waits a short
 * delay, closes the tab, and shows a reversible notification.
 */
"use strict";

importScripts("rules.js");

const DEFAULTS = {
  enabled: true,
  closeDelayMs: 2000,
  showNotification: true,
  closeLastTab: false,
  maxTabAgeSeconds: 120,
  listMode: "block", // "block" | "allow"
  hostList: [], // hostnames, one relevant to the active listMode
  extraStrongPhrases: [],
};

const RECENT_KEY = "recentClosed";
const RECENT_MAX = 20;

// tabId -> createdAt (ms). In-memory only; fine because guards degrade gracefully.
const tabCreatedAt = new Map();

chrome.tabs.onCreated.addListener((tab) => {
  if (tab && typeof tab.id === "number") tabCreatedAt.set(tab.id, Date.now());
});
chrome.tabs.onRemoved.addListener((tabId) => tabCreatedAt.delete(tabId));

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULTS, (res) => resolve(res));
  });
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (_) {
    return "";
  }
}

function hostAllowedByList(host, settings) {
  const list = (settings.hostList || []).map((h) => h.trim().toLowerCase()).filter(Boolean);
  const onList = list.some((h) => host === h || host.endsWith("." + h));
  return settings.listMode === "allow" ? onList : !onList;
}

async function pushRecent(entry) {
  const store = chrome.storage.session || chrome.storage.local;
  const cur = (await store.get({ [RECENT_KEY]: [] }))[RECENT_KEY] || [];
  cur.unshift(entry);
  await store.set({ [RECENT_KEY]: cur.slice(0, RECENT_MAX) });
}

const reopenTargets = new Map(); // notificationId -> url

function notifyClosed(host, url) {
  const id = "atc:" + Date.now() + ":" + Math.random().toString(36).slice(2);
  chrome.notifications.create(id, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/128.png"),
    title: "Closed auth tab",
    message: host || url,
    contextMessage: "Auth Tab Closer",
    buttons: [{ title: "Reopen" }],
    priority: 0,
  });
  reopenTargets.set(id, url);
  // Auto-forget after a minute so the map can't grow unbounded.
  setTimeout(() => reopenTargets.delete(id), 60000);
}

chrome.notifications.onButtonClicked.addListener(async (id, btnIdx) => {
  if (btnIdx === 0) {
    let url = reopenTargets.get(id);
    if (!url) {
      // Worker may have restarted since the notification was shown — fall back
      // to the most recent closed tab.
      const store = chrome.storage.session || chrome.storage.local;
      const list = (await store.get({ [RECENT_KEY]: [] }))[RECENT_KEY] || [];
      url = list[0] && list[0].url;
    }
    if (url) chrome.tabs.create({ url });
  }
  reopenTargets.delete(id);
  chrome.notifications.clear(id);
});
chrome.notifications.onClicked.addListener((id) => {
  reopenTargets.delete(id);
  chrome.notifications.clear(id);
});

async function handleMatch(msg, senderTab) {
  if (!senderTab || typeof senderTab.id !== "number") return;
  const settings = await getSettings();
  if (!settings.enabled) return;

  const tabId = senderTab.id;
  const host = hostOf(msg.url || senderTab.url || "");

  if (!hostAllowedByList(host, settings)) return;

  // Re-fetch fresh tab state.
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (_) {
    return;
  }
  if (tab.pinned) return;

  // Don't nuke the last tab in a window unless explicitly allowed.
  if (!settings.closeLastTab) {
    try {
      const inWindow = await chrome.tabs.query({ windowId: tab.windowId });
      if (inWindow.length <= 1) return;
    } catch (_) {
      /* ignore */
    }
  }

  // Age guard: a weak-only match (score 2) on a tab the user has had open a long time
  // is probably not a fresh auth redirect. Strong/provider matches (score 3) bypass this,
  // as do tabs that were opened by another tab/app.
  const createdAt = tabCreatedAt.get(tabId);
  const ageOk =
    msg.score >= 3 ||
    typeof tab.openerTabId === "number" ||
    createdAt == null || // untracked (worker restarted) — don't block strong signals only
    Date.now() - createdAt <= settings.maxTabAgeSeconds * 1000;
  if (!ageOk) return;

  const delay = Math.max(0, Number(settings.closeDelayMs) || 0);
  const urlBefore = tab.url;

  setTimeout(async () => {
    let fresh;
    try {
      fresh = await chrome.tabs.get(tabId);
    } catch (_) {
      return; // already gone
    }
    if (fresh.url !== urlBefore) return; // user navigated away — leave it alone

    try {
      await chrome.tabs.remove(tabId);
    } catch (_) {
      return;
    }

    await pushRecent({
      url: msg.url || urlBefore,
      title: msg.title || fresh.title || host,
      host,
      reason: msg.reason,
      closedAt: Date.now(),
    });

    if (settings.showNotification) notifyClosed(host, msg.url || urlBefore);
  }, delay);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "AUTH_TAB_MATCH") {
    handleMatch(msg, sender.tab).finally(() => sendResponse({ ok: true }));
    return true; // async response
  }
  if (msg && msg.type === "REOPEN") {
    if (msg.url) chrome.tabs.create({ url: msg.url });
    sendResponse({ ok: true });
    return false;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULTS, (res) => chrome.storage.sync.set(res));
});
