// Service worker: single source of truth for budget, usage, emergency pass and settings.
// All state lives in chrome.storage.local because MV3 workers can be killed at any time.

// goal: an optional short reminder of what the user wants their time for,
// shown at the pause and on the block page (see RESEARCH.md).
const DEFAULT_SETTINGS = {
  budgetMinutes: 15,
  sites: { youtube: true, instagram: true, tiktok: true },
  goal: "",
};
const HISTORY_DAYS = 14;
const MAX_CUSTOM = 30;
const TYPO_GRACE_MS = 10 * 60 * 1000; // a site added in the last 10 minutes can be fixed or removed at once

// "reddit.com/r/popular" -> { host: "reddit.com", path: "/r/popular" }
function parseSite(input) {
  if (typeof input !== "string") return null;
  let t = input.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  const slash = t.indexOf("/");
  const host = slash === -1 ? t : t.slice(0, slash);
  let path = slash === -1 ? "" : t.slice(slash).replace(/[?#].*$/, "").replace(/\/+$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;
  return { host, path };
}
const siteId = (c) => c.host + c.path;

const LOOSEN_DELAY_MS = 24 * 60 * 60 * 1000; // precommitment: loosening waits 24h
const EMERGENCY_WAIT_MS = 60 * 1000; // must wait 60s before the pass starts
const EMERGENCY_GRANT_MS = 5 * 60 * 1000; // the pass lasts 5 minutes
const MAX_REPORT_SECONDS = 10; // ignore bogus usage reports

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clampBudget(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.budgetMinutes;
  return Math.min(240, Math.max(0, n));
}

function normalizeSettings(raw = {}) {
  const sites = {};
  for (const key of Object.keys(DEFAULT_SETTINGS.sites)) {
    sites[key] = raw.sites?.[key] ?? DEFAULT_SETTINGS.sites[key];
  }
  return {
    budgetMinutes: clampBudget(raw.budgetMinutes ?? DEFAULT_SETTINGS.budgetMinutes),
    sites,
    goal: typeof raw.goal === "string" ? raw.goal.trim().slice(0, 120) : "",
    custom: normalizeCustom(raw.custom),
  };
}

function normalizeCustom(list) {
  const out = [];
  const seen = new Set();
  for (const item of Array.isArray(list) ? list : []) {
    const c = typeof item === "string" ? parseSite(item) : parseSite(siteId(item ?? {}));
    if (c && !seen.has(siteId(c))) {
      seen.add(siteId(c));
      out.push({ ...c, mode: item?.mode === "limit" ? "limit" : "block", addedAt: Number(item?.addedAt) || 0 });
    }
  }
  return out.slice(0, MAX_CUSTOM);
}

// Custom sites get the content script through dynamic registration, limited to hosts the user granted.
async function syncCustomScripts(settings) {
  try {
    const hosts = [...new Set(settings.custom.map((c) => c.host))];
    const granted = [];
    for (const h of hosts) {
      const origins = [`*://${h}/*`, `*://*.${h}/*`];
      if (await chrome.permissions.contains({ origins })) granted.push(...origins);
    }
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: ["custom-sites"] });
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: ["custom-sites"] });
    if (granted.length) {
      await chrome.scripting.registerContentScripts([
        { id: "custom-sites", matches: granted, js: ["content.js"], runAt: "document_start", persistAcrossSessions: true },
      ]);
    }
  } catch (e) {
    console.warn("Could not update custom sites", e);
  }
}

// A newly added site should apply to tabs that are already open, without a reload.
async function injectIntoOpenTabs(host) {
  try {
    const tabs = await chrome.tabs.query({ url: [`*://${host}/*`, `*://*.${host}/*`] });
    await Promise.all(
      tabs.map((t) =>
        chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["content.js"] }).catch(() => {}),
      ),
    );
  } catch (e) {
    console.warn("Could not apply to open tabs", e);
  }
}

function lastDays(history, n) {
  const out = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    const pad = (x) => String(x).padStart(2, "0");
    const key = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    out.push({ date: key, seconds: history[key] ?? 0 });
  }
  return out;
}

async function loadState() {
  const raw = await chrome.storage.local.get(["settings", "pending", "usage", "emergency", "history", "onboarded", "removals"]);
  const state = {
    removals: raw.removals ?? {},
    history: raw.history ?? {},
    onboarded: raw.onboarded ?? false,
    settings: normalizeSettings(raw.settings),
    pending: raw.pending ?? null,
    usage: raw.usage?.date === today() ? raw.usage : { date: today(), seconds: 0, resisted: 0 },
    emergency: raw.emergency ?? { date: null, until: 0, requestedAt: 0 },
  };
  if (state.pending && Date.now() >= state.pending.applyAt) {
    state.settings = normalizeSettings(state.pending.settings);
    state.pending = null;
    await chrome.storage.local.set({ settings: state.settings, pending: null });
    await syncCustomScripts(state.settings);
  }
  // Apply custom-site removals whose 24h wait is over.
  const due = Object.keys(state.removals).filter((id) => Date.now() >= state.removals[id]);
  if (due.length) {
    state.settings.custom = state.settings.custom.filter((c) => !due.includes(siteId(c)));
    for (const id of due) delete state.removals[id];
    if (state.pending) state.pending.settings.custom = state.settings.custom;
    await chrome.storage.local.set({ settings: state.settings, removals: state.removals, pending: state.pending });
    await syncCustomScripts(state.settings);
  }
  return state;
}

function toStatus(state) {
  const now = Date.now();
  const budget = state.settings.budgetMinutes * 60;
  const remaining = Math.max(0, budget - state.usage.seconds);
  const emergencyActive = state.emergency.until > now;
  const status = {
    budget,
    used: state.usage.seconds,
    remaining,
    resisted: state.usage.resisted ?? 0,
    blocked: remaining === 0 && !emergencyActive,
    emergencyActive,
    emergencyUntil: state.emergency.until,
    emergencyAvailable: state.emergency.date !== today(),
    emergencyRequestedAt: state.emergency.requestedAt ?? 0,
    settings: state.settings,
    pending: state.pending,
    // Today's bar always matches "Watched today".
    week: lastDays({ ...state.history, [state.usage.date]: state.usage.seconds }, 7),
    removals: state.removals,
    onboarded: state.onboarded,
  };
  updateBadge(status);
  return status;
}

function updateBadge(status) {
  const text = status.blocked
    ? "0"
    : status.emergencyActive
      ? "SOS"
      : String(Math.ceil(status.remaining / 60));
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: status.blocked ? "#b3261e" : "#2d6a4f" });
}

const handlers = {
  async getStatus() {
    return toStatus(await loadState());
  },

  async addUsage({ seconds }) {
    const state = await loadState();
    const s = Math.min(MAX_REPORT_SECONDS, Math.max(0, Math.round(Number(seconds) || 0)));
    state.usage.seconds += s;
    state.history[state.usage.date] = state.usage.seconds;
    const keep = new Set(lastDays(state.history, HISTORY_DAYS).map((d) => d.date));
    for (const k of Object.keys(state.history)) if (!keep.has(k)) delete state.history[k];
    await chrome.storage.local.set({ usage: state.usage, history: state.history });
    return toStatus(state);
  },

  async resisted() {
    const state = await loadState();
    state.usage.resisted = (state.usage.resisted ?? 0) + 1;
    await chrome.storage.local.set({ usage: state.usage });
    return toStatus(state);
  },

  async block({ from, why }, sender) {
    if (sender.tab?.id != null) {
      const url =
        chrome.runtime.getURL("pages/block.html") + "?from=" + encodeURIComponent(from ?? "") + (why === "site" ? "&why=site" : "");
      await chrome.tabs.update(sender.tab.id, { url });
    }
    return { ok: true };
  },

  // Leaving TikTok: replace the page in the same tab with a calm confirmation page.
  async leave({ from }, sender) {
    if (sender.tab?.id != null) {
      const url = chrome.runtime.getURL("pages/left.html") + "?from=" + encodeURIComponent(from ?? "");
      await chrome.tabs.update(sender.tab.id, { url });
    }
    return { ok: true };
  },

  async closeTab(_msg, sender) {
    if (sender.tab?.id != null) await closeTabGently(sender.tab.id);
    return { ok: true };
  },

  async emergencyRequest() {
    const state = await loadState();
    if (state.emergency.date === today()) {
      return { ...toStatus(state), error: "Today's emergency pass is already used." };
    }
    state.emergency = { ...state.emergency, requestedAt: Date.now() };
    await chrome.storage.local.set({ emergency: state.emergency });
    return toStatus(state);
  },

  async emergencyConfirm() {
    const state = await loadState();
    const now = Date.now();
    if (state.emergency.date === today()) {
      return { ...toStatus(state), error: "Today's emergency pass is already used." };
    }
    const requestedAt = state.emergency.requestedAt ?? 0;
    if (!requestedAt || now - requestedAt < EMERGENCY_WAIT_MS) {
      return { ...toStatus(state), error: "Wait for the countdown to finish." };
    }
    state.emergency = { date: today(), until: now + EMERGENCY_GRANT_MS, requestedAt: 0 };
    await chrome.storage.local.set({ emergency: state.emergency });
    return toStatus(state);
  },

  // Tightening applies now; loosening is scheduled 24h later (precommitment).
  async saveSettings({ settings }) {
    const state = await loadState();
    const cur = state.settings;
    const next = normalizeSettings(settings);

    // Custom sites are managed by addSite/removeSite, never through the form.
    next.custom = cur.custom;
    const immediate = normalizeSettings({
      ...next,
      budgetMinutes: Math.min(cur.budgetMinutes, next.budgetMinutes),
      sites: Object.fromEntries(
        Object.keys(cur.sites).map((k) => [k, cur.sites[k] || next.sites[k]]),
      ),
    });
    const loosens =
      next.budgetMinutes > cur.budgetMinutes ||
      Object.keys(next.sites).some((k) => cur.sites[k] && !next.sites[k]);

    state.settings = immediate;
    state.pending = loosens ? { settings: next, applyAt: Date.now() + LOOSEN_DELAY_MS } : null;
    await chrome.storage.local.set({ settings: state.settings, pending: state.pending });
    await syncCustomScripts(state.settings);
    return toStatus(state);
  },

  // First-run setup is made in a calm moment, so it applies as-is. Only allowed once.
  async completeOnboarding({ settings }) {
    const state = await loadState();
    if (state.onboarded) return { ...toStatus(state), error: "Setup is already done. Use Settings to make changes." };
    state.settings = normalizeSettings(settings);
    state.onboarded = true;
    await chrome.storage.local.set({ settings: state.settings, onboarded: true });
    await syncCustomScripts(state.settings);
    return toStatus(state);
  },

  // Adding a site is stricter, so it applies immediately (and cancels a scheduled removal).
  async addSite({ site, mode }) {
    const state = await loadState();
    const parsed = parseSite(site);
    const c = parsed && { ...parsed, mode: mode === "limit" ? "limit" : "block", addedAt: Date.now() };
    if (!c) return { ...toStatus(state), error: "That doesn't look like a website address. Try something like reddit.com." };
    const id = siteId(c);
    if (state.settings.custom.some((x) => siteId(x) === id)) {
      delete state.removals[id];
    } else {
      if (state.settings.custom.length >= MAX_CUSTOM) return { ...toStatus(state), error: `You can add up to ${MAX_CUSTOM} sites.` };
      state.settings.custom = [...state.settings.custom, c];
      if (state.pending) state.pending.settings.custom = state.settings.custom;
    }
    await chrome.storage.local.set({ settings: state.settings, removals: state.removals, pending: state.pending });
    await syncCustomScripts(state.settings);
    await injectIntoOpenTabs(c.host);
    return { ...toStatus(state), added: id, mode: c.mode };
  },

  // Removing a site is looser, so it waits 24 hours on its own timer,
  // unless it was added in the last few minutes (a typo).
  async removeSite({ id }) {
    const state = await loadState();
    const site = state.settings.custom.find((c) => siteId(c) === id);
    if (!site) return toStatus(state);
    if (Date.now() - site.addedAt < TYPO_GRACE_MS) {
      state.settings.custom = state.settings.custom.filter((c) => siteId(c) !== id);
      delete state.removals[id];
      if (state.pending) state.pending.settings.custom = state.settings.custom;
      await chrome.storage.local.set({ settings: state.settings, removals: state.removals, pending: state.pending });
      await syncCustomScripts(state.settings);
      return { ...toStatus(state), removedNow: true };
    }
    state.removals[id] ??= Date.now() + LOOSEN_DELAY_MS;
    await chrome.storage.local.set({ removals: state.removals });
    return toStatus(state);
  },

  // Fixing a typo: within the grace window the old address is replaced at once.
  // Later, the new address applies now and the old one follows the 24-hour removal.
  async editSite({ id, site }) {
    const state = await loadState();
    const old = state.settings.custom.find((c) => siteId(c) === id);
    const parsed = parseSite(site);
    if (!old) return { ...toStatus(state), error: "That site isn't in your list anymore." };
    if (!parsed) return { ...toStatus(state), error: "That doesn't look like a website address. Try something like reddit.com." };
    const next = { ...parsed, mode: old.mode, addedAt: Date.now() };
    const nextId = siteId(next);
    if (nextId === id) return toStatus(state);
    const exists = state.settings.custom.some((c) => siteId(c) === nextId);
    const quick = Date.now() - old.addedAt < TYPO_GRACE_MS;
    if (quick) {
      state.settings.custom = exists
        ? state.settings.custom.filter((c) => siteId(c) !== id)
        : state.settings.custom.map((c) => (siteId(c) === id ? next : c));
      delete state.removals[id];
    } else {
      if (!exists) state.settings.custom = [...state.settings.custom, next];
      state.removals[id] ??= Date.now() + LOOSEN_DELAY_MS;
    }
    delete state.removals[nextId];
    if (state.pending) state.pending.settings.custom = state.settings.custom;
    await chrome.storage.local.set({ settings: state.settings, removals: state.removals, pending: state.pending });
    await syncCustomScripts(state.settings);
    await injectIntoOpenTabs(next.host);
    return { ...toStatus(state), edited: nextId, replacedNow: quick };
  },

  async keepSite({ id }) {
    const state = await loadState();
    delete state.removals[id];
    await chrome.storage.local.set({ removals: state.removals });
    return toStatus(state);
  },

  async cancelPending() {
    const state = await loadState();
    state.pending = null;
    await chrome.storage.local.set({ pending: null });
    return toStatus(state);
  },
};

// Closing a tab makes Chrome jump to its neighbour, which may be one of our own pages
// (e.g. Settings). Instead, return to the tab the user was last on; if only our pages
// are left in the window, open a fresh new tab in its place.
async function closeTabGently(tabId) {
  const tab = await chrome.tabs.get(tabId);
  const ours = new Set(
    (await chrome.runtime.getContexts({ contextTypes: ["TAB"] })).map((c) => c.tabId),
  );
  const others = (await chrome.tabs.query({ windowId: tab.windowId }))
    .filter((t) => t.id !== tabId && !ours.has(t.id))
    .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
  if (others.length) await chrome.tabs.update(others[0].id, { active: true });
  else await chrome.tabs.create({ windowId: tab.windowId, index: tab.index, active: true });
  await chrome.tabs.remove(tabId);
}

// Serialize handlers so concurrent tabs can't lose usage updates.
let queue = Promise.resolve();
function serialized(fn) {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = handlers[msg?.type];
  if (!handler) return false;
  serialized(() => handler(msg, sender)).then(sendResponse, (err) =>
    sendResponse({ error: String(err?.message ?? err) }),
  );
  return true;
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  serialized(handlers.getStatus);
  if (reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("pages/welcome.html") });
});
chrome.runtime.onStartup.addListener(() => serialized(handlers.getStatus));
chrome.permissions.onAdded.addListener(() => serialized(async () => syncCustomScripts((await loadState()).settings)));
chrome.permissions.onRemoved.addListener(() => serialized(async () => syncCustomScripts((await loadState()).settings)));
