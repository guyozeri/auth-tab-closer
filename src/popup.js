"use strict";

const $ = (id) => document.getElementById(id);

function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.round(s / 60) + "m ago";
  return Math.round(s / 3600) + "h ago";
}

function loadEnabled() {
  chrome.storage.sync.get({ enabled: true }, ({ enabled }) => {
    $("enabled").checked = enabled;
    $("state").textContent = enabled
      ? "Watching for finished auth tabs."
      : "Paused — no tabs will be closed.";
  });
}

$("enabled").addEventListener("change", (e) => {
  chrome.storage.sync.set({ enabled: e.target.checked }, loadEnabled);
});

$("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

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
  for (const item of recentClosed.slice(0, 5)) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.className = "title";
    span.textContent = item.host || item.title || item.url;
    span.title = (item.title || "") + "\n" + item.url + "\n" + timeAgo(item.closedAt);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Reopen";
    btn.addEventListener("click", () => chrome.tabs.create({ url: item.url }));
    li.append(span, btn);
    ul.appendChild(li);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadEnabled();
  renderRecent();
});
