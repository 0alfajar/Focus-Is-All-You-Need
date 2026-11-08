const SITE_KEYS = Object.keys(SITES);
const $ = (id) => document.getElementById(id);

let saved = null; // settings as last confirmed by the background

let addMode = "block";
const MODE_HELP = {
  block: "Block keeps the site off all day. The emergency pass still works.",
  limit: "Limit shows the pause and uses your daily minutes, like Shorts.",
};
function renderMode() {
  document.querySelectorAll("#mode button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.mode === addMode)),
  );
  $("modeHelp").textContent = MODE_HELP[addMode];
}

function readForm() {
  const n = Math.round(Number($("budget").value));
  return {
    budgetMinutes: Number.isFinite(n) ? Math.min(240, Math.max(0, n)) : saved.budgetMinutes,
    sites: Object.fromEntries(SITE_KEYS.map((k) => [k, $(`site-${k}`).checked])),
    goal: $("goal").value.trim(),
  };
}

const comparable = (x) => JSON.stringify([x.budgetMinutes, x.sites, x.goal]);


function syncPresets() {
  const v = Number($("budget").value);
  document.querySelectorAll("#presets button").forEach((b) =>
    b.setAttribute("aria-pressed", String(Number(b.dataset.min) === v)),
  );
}

function updateDirty() {
  if (!saved) return;
  const dirty = comparable(readForm()) !== comparable(saved);
  $("save").disabled = !dirty;
  if (dirty) {
    $("status").textContent = "Unsaved changes";
    $("status").className = "";
  }
}

function fill(s) {
  saved = s.settings;
  $("budget").value = s.settings.budgetMinutes;
  for (const k of SITE_KEYS) $(`site-${k}`).checked = s.settings.sites[k];
  $("goal").value = s.settings.goal;
  syncPresets();
  renderPending(s);
  renderSites(s);
  updateDirty();
}

// ---------- Other sites (instant actions, no Save needed) ----------
function siteMsg(text, err = false) {
  $("siteMsg").textContent = text;
  $("siteMsg").className = "small " + (err ? "err" : "muted");
}

function renderSites(s) {
  const list = $("clist");
  list.replaceChildren();
  for (const c of s.settings.custom) {
    const id = c.host + c.path;
    const removeAt = s.removals?.[id];
    const li = document.createElement("li");
    li.className = removeAt ? "removing" : "";
    const meta = document.createElement("span");
    meta.style.cssText = "display:grid;gap:2px;min-width:0";
    const host = document.createElement("span");
    host.className = "host";
    host.textContent = id;
    meta.appendChild(host);
    if (!removeAt) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = c.mode === "limit" ? "Limited: uses your daily minutes" : "Blocked all day";
      meta.appendChild(tag);
    }
    if (removeAt) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = `Stops being limited ${new Date(removeAt).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}`;
      meta.appendChild(tag);
    }
    const actions = document.createElement("span");
    actions.className = "row-actions";
    const recent = Date.now() - (c.addedAt || 0) < TYPO_GRACE_MS;
    if (!removeAt) {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      editBtn.setAttribute("aria-label", `Edit ${id}`);
      editBtn.addEventListener("click", () => startEdit(li, c, s));
      actions.appendChild(editBtn);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = removeAt ? "Keep" : "Remove";
    btn.setAttribute("aria-label", `${btn.textContent} ${id}`);
    btn.addEventListener("click", async () => {
      const r = await send({ type: removeAt ? "keepSite" : "removeSite", id });
      renderSites(r);
      siteMsg(
        removeAt ? `${id} stays on your list.`
        : r.removedNow ? `${id} removed.`
        : `${id} stays on for 24 more hours, then it's removed. You can keep it until then.`,
      );
    });
    actions.appendChild(btn);
    li.append(meta, actions);
    if (recent && !removeAt) li.title = "Added in the last 10 minutes: you can edit or remove it right away.";
    list.appendChild(li);
  }
  list.hidden = s.settings.custom.length === 0;
}

const TYPO_GRACE_MS = 10 * 60 * 1000;

function startEdit(li, c, s) {
  const id = c.host + c.path;
  li.replaceChildren();
  li.classList.add("editing");
  const input = document.createElement("input");
  input.type = "text";
  input.value = id;
  input.spellcheck = false;
  input.autocomplete = "off";
  input.setAttribute("aria-label", `New address for ${id}`);
  const save = document.createElement("button");
  save.type = "button";
  save.textContent = "Save";
  save.className = "primary";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  const actions = document.createElement("span");
  actions.className = "row-actions";
  actions.append(cancel, save);
  li.append(input, actions);
  input.focus();
  input.select();
  const recent = Date.now() - (c.addedAt || 0) < TYPO_GRACE_MS;
  siteMsg(recent
    ? "Fix the address. Sites added in the last 10 minutes change right away."
    : "The new address applies now. The old one stays on for 24 hours, like removing it.");

  const commit = async () => {
    const next = parseSite(input.value);
    if (!next) {
      siteMsg("That doesn't look like a website address. Try something like reddit.com.", true);
      input.focus();
      return;
    }
    if (next.host + next.path === id) return renderSites(s);
    let granted = false;
    try {
      granted = await chrome.permissions.request({ origins: [`*://${next.host}/*`, `*://*.${next.host}/*`] });
    } catch {}
    if (!granted) {
      siteMsg(`Chrome needs your permission to run on ${next.host}. Nothing changed.`, true);
      return;
    }
    const r = await send({ type: "editSite", id, site: next.host + next.path });
    if (r.error) {
      siteMsg(r.error, true);
      return;
    }
    renderSites(r);
    siteMsg(r.replacedNow
      ? `Changed to ${r.edited}.`
      : `${r.edited} applies now. ${id} stays on for 24 hours, then it's removed.`);
  };
  save.addEventListener("click", commit);
  cancel.addEventListener("click", () => {
    renderSites(s);
    siteMsg("Edit cancelled.");
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel.click();
    }
  });
}

function parseSite(input) {
  let t = input.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  const slash = t.indexOf("/");
  const host = slash === -1 ? t : t.slice(0, slash);
  const path = slash === -1 ? "" : t.slice(slash).replace(/[?#].*$/, "").replace(/\/+$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? { host, path } : null;
}

async function addSite() {
  const raw = $("newSite").value;
  const c = parseSite(raw);
  if (!c) {
    siteMsg("That doesn't look like a website address. Try something like reddit.com.", true);
    $("newSite").focus();
    return;
  }
  // Must be called directly from the click so Chrome shows its permission prompt.
  let granted = false;
  try {
    granted = await chrome.permissions.request({ origins: [`*://${c.host}/*`, `*://*.${c.host}/*`] });
  } catch (e) {
    siteMsg(`Chrome couldn't ask for access to ${c.host}.`, true);
    return;
  }
  if (!granted) {
    siteMsg(`Chrome needs your permission to run on ${c.host}. Nothing was added.`, true);
    return;
  }
  const r = await send({ type: "addSite", site: c.host + c.path, mode: addMode });
  if (r.error) {
    siteMsg(r.error, true);
    return;
  }
  $("newSite").value = "";
  renderSites(r);
  siteMsg(r.mode === "limit" ? `${r.added} now uses your daily minutes, including tabs already open.` : `${r.added} is now blocked, including tabs already open.`);
}

function renderPending(s) {
  $("pending").hidden = !s.pending;
  if (!s.pending) return;
  const p = s.pending.settings;
  const when = new Date(s.pending.applyAt).toLocaleString([], {
    weekday: "long", hour: "2-digit", minute: "2-digit",
  });
  const on = SITE_KEYS.filter((k) => p.sites[k]).map((k) => SITES[k].name);
  $("pendingText").textContent =
    `Starting ${when}: ${p.budgetMinutes} minutes a day, limited on ${on.length ? on.join(", ") : "no sites"}.`;
}

function say(text, ok = false) {
  $("status").textContent = text;
  $("status").className = ok ? "ok" : "";
}

$("presets").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-min]");
  if (!b) return;
  $("budget").value = b.dataset.min;
  syncPresets();
  updateDirty();
});

$("form").addEventListener("input", () => {
  syncPresets();
  updateDirty();
});

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("save").disabled = true;
  const before = saved;
  const s = await send({ type: "saveSettings", settings: readForm() });
  if (s.error) {
    say(`Couldn't save: ${s.error}`);
    $("save").disabled = false;
    return;
  }
  fill(s);
  // The background clears any waiting change on save, so a pending change here came from this save.
  const loosened = Boolean(s.pending);
  if (loosened && comparable(s.settings) !== comparable(before)) {
    say("Stricter parts saved now. Looser parts start in 24 hours.", true);
  } else if (loosened) {
    say("Saved. This change starts in 24 hours.", true);
  } else {
    say("Saved", true);
  }
});

$("cancelPending").addEventListener("click", async () => {
  const s = await send({ type: "cancelPending" });
  renderPending(s);
  say("Waiting change cancelled", true);
});

send({ type: "getStatus" }).then(fill);

$("addSite").addEventListener("click", addSite);
$("newSite").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addSite();
  }
});

$("mode").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-mode]");
  if (!b) return;
  addMode = b.dataset.mode;
  renderMode();
});
renderMode();

// Digits only, max 240. A text field (not type=number) so the scroll wheel never changes it.
$("budget").addEventListener("input", () => {
  const digits = $("budget").value.replace(/\D/g, "").slice(0, 3);
  $("budget").value = digits === "" ? "" : String(Math.min(240, Number(digits)));
});
$("budget").addEventListener("blur", () => {
  if ($("budget").value === "") $("budget").value = saved?.budgetMinutes ?? 15;
  syncPresets();
  updateDirty();
});

// Warn before leaving with unsaved form changes.
window.addEventListener("beforeunload", (e) => {
  if (!$("save").disabled) e.preventDefault();
});
