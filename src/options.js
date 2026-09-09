"use strict";

const DEFAULTS = {
  enabled: true,
  closeDelayMs: 2000,
  showNotification: true,
  closeLastTab: false,
  maxTabAgeSeconds: 120,
  listMode: "block",
  hostList: [],
  extraStrongPhrases: [],
};

const $ = (id) => document.getElementById(id);

function linesToArray(str) {
  return str
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function load() {
  chrome.storage.sync.get(DEFAULTS, (s) => {
    $("enabled").checked = s.enabled;
    $("showNotification").checked = s.showNotification;
    $("closeLastTab").checked = s.closeLastTab;
    $("closeDelayMs").value = s.closeDelayMs;
    $("maxTabAgeSeconds").value = s.maxTabAgeSeconds;
    for (const el of document.querySelectorAll('input[name="listMode"]')) {
      el.checked = el.value === s.listMode;
    }
    $("hostList").value = (s.hostList || []).join("\n");
    $("extraStrongPhrases").value = (s.extraStrongPhrases || []).join("\n");
  });
  renderRecent();
}

function save() {
  const listMode =
    document.querySelector('input[name="listMode"]:checked')?.value || "block";
  const next = {
    enabled: $("enabled").checked,
    showNotification: $("showNotification").checked,
    closeLastTab: $("closeLastTab").checked,
    closeDelayMs: Math.max(0, parseInt($("closeDelayMs").value, 10) || 0),
    maxTabAgeSeconds: Math.max(0, parseInt($("maxTabAgeSeconds").value, 10) || 0),
    listMode,
    hostList: linesToArray($("hostList").value),
    extraStrongPhrases: linesToArray($("extraStrongPhrases").value),
  };
  chrome.storage.sync.set(next, () => {
    const st = $("status");
    st.textContent = "Saved";
    setTimeout(() => (st.textContent = ""), 1500);
  });
}

function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.round(s / 60) + "m ago";
  return Math.round(s / 3600) + "h ago";
}

async function renderRecent() {
  const store = chrome.storage.session || chrome.storage.local;
  const { recentClosed = [] } = await store.get({ recentClosed: [] });
  const ul = $("recent");
  ul.innerHTML = "";
  if (!recentClosed.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Nothing closed yet.";
    ul.appendChild(li);
    return;
  }
  for (const item of recentClosed) {
    const li = document.createElement("li");
    const meta = document.createElement("div");
    meta.className = "meta";
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = item.title || item.host || item.url;
    const when = document.createElement("span");
    when.className = "when";
    when.textContent = timeAgo(item.closedAt) + " · " + (item.reason || "");
    meta.append(title, when);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Reopen";
    btn.addEventListener("click", () => chrome.tabs.create({ url: item.url }));

    li.append(meta, btn);
    ul.appendChild(li);
  }
}

document.addEventListener("DOMContentLoaded", load);
$("save").addEventListener("click", save);
