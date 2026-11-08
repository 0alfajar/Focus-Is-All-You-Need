// Runs on YouTube / Instagram / TikTok. Detects short-form pages (SPA-aware by polling the URL),
// shows the mindful pause, counts visible time, and asks the background to block when time is up.
(() => {
  if (window.top !== window) return;
  // A custom site can overlap a built-in one (static + dynamic injection); run only once.
  if (globalThis.__fiaynLoaded) return;
  globalThis.__fiaynLoaded = true;

  const PAUSE_SECONDS = 10;
  const PAUSE_VALID_MS = 15 * 60 * 1000; // pause again after 15 min away
  const REPORT_EVERY = 5;
  const PAUSE_KEY = "fiayn:pausePassedAt";
  const LEFT_KEY = "fiayn:justLeft";

  function shortFormSite(href) {
    const u = new URL(href);
    const h = u.hostname;
    if (/(^|\.)youtube\.com$/.test(h) && /^\/shorts(\/|$)/.test(u.pathname)) return "youtube";
    if (/(^|\.)instagram\.com$/.test(h) && /^\/reels?(\/|$)/.test(u.pathname)) return "instagram";
    if (/(^|\.)tiktok\.com$/.test(h)) return "tiktok";
    return null;
  }

  const send = (msg) => chrome.runtime.sendMessage(msg);

  // Custom sites come from settings; refreshed every 15s so new ones apply without a reload.
  let customList = null;
  let customAt = 0;
  const pathMatches = (path, prefix) => !prefix || path === prefix || path.startsWith(prefix + "/");
  async function matchSite(href) {
    const builtIn = shortFormSite(href);
    if (builtIn) return builtIn;
    if (!customList || Date.now() - customAt > 15000) {
      const s = await send({ type: "getStatus" });
      customList = s.settings.custom ?? [];
      customAt = Date.now();
    }
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "");
    const hit = customList.find(
      (c) => (host === c.host || host.endsWith("." + c.host)) && pathMatches(u.pathname.toLowerCase(), c.path),
    );
    return hit ? `custom:${hit.host}${hit.path}` : null;
  }
  const customEntry = (s, site) =>
    (s.settings.custom ?? []).find((c) => `custom:${c.host}${c.path}` === site);
  const siteEnabled = (s, site) =>
    site.startsWith("custom:")
      ? (s.settings.custom ?? []).some((c) => `custom:${c.host}${c.path}` === site)
      : Boolean(s.settings.sites[site]);

  function pauseValid() {
    try {
      return Date.now() - Number(sessionStorage.getItem(PAUSE_KEY) || 0) < PAUSE_VALID_MS;
    } catch {
      return false;
    }
  }
  function touchPause() {
    try {
      sessionStorage.setItem(PAUSE_KEY, String(Date.now()));
    } catch {}
  }

  function pauseVideos() {
    document.querySelectorAll("video").forEach((v) => {
      if (!v.paused) v.pause();
    });
  }

  function fmt(seconds) {
    const s = Math.max(0, Math.round(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  // ---------- Fonts (declared on the page; @font-face doesn't work inside shadow roots) ----------
  let fontsInjected = false;
  function injectFonts() {
    if (fontsInjected) return;
    fontsInjected = true;
    const url = (p) => chrome.runtime.getURL(p);
    const style = document.createElement("style");
    style.textContent = `
      @font-face { font-family: "FIAYN Sans"; src: url("${url("assets/fonts/outfit.woff2")}") format("woff2"); font-weight: 300 700; font-display: swap; }
      @font-face { font-family: "FIAYN Mono"; src: url("${url("assets/fonts/dmmono-500.woff2")}") format("woff2"); font-weight: 500; font-display: swap; }`;
    (document.head || document.documentElement).appendChild(style);
  }

  const OVERLAY_CSS = `
    :host {
      all: initial;
      --paper: #ffffff; --surface: #ffffff; --field: #f3f4f7; --ink: #121b36; --muted: #5a6380; --line: #e1e4ec;
      --accent: #1a4be0; --accent-ink: #ffffff; --accent-soft: #e8eefc;
      --scrim: rgb(255 255 255 / .82);
      --font-ui: "FIAYN Sans", "Segoe UI", system-ui, sans-serif;
      --font-num: "FIAYN Mono", ui-monospace, Consolas, monospace;
    }
    @media (prefers-color-scheme: dark) {
      :host {
        --paper: #0a0d14; --surface: #131824; --field: #0a0d14; --ink: #e9edf3; --muted: #8b95a7; --line: #222a3a;
        --accent: #5ab9fc; --accent-ink: #0a0d14; --accent-soft: #12263a;
        --scrim: rgb(10 13 20 / .84);
      }
    }
    * { box-sizing: border-box; }
    .scrim { position: fixed; inset: 0; overscroll-behavior: contain; display: grid; place-items: center; padding: 16px;
      background: var(--scrim); backdrop-filter: blur(14px) saturate(.6); -webkit-backdrop-filter: blur(14px) saturate(.6);
      font: 400 15px/1.5 var(--font-ui); color: var(--ink); }
    .card { width: 100%; max-width: 460px; display: grid; gap: 18px; padding: 28px;
      background: var(--surface); border: 1px solid var(--line); border-radius: 10px;
      box-shadow: 0 24px 64px -24px rgb(0 0 0 / .35); }
    .card:focus { outline: none; }
    .label { font: 500 13px/1.4 var(--font-ui); color: var(--muted); }
    .left { font: 400 13px/1.3 var(--font-ui); font-variant-numeric: tabular-nums; color: var(--muted); }
    h1 { margin: 0; font: 500 30px/1.1 var(--font-ui); letter-spacing: -0.035em; }
    .field { display: grid; gap: 6px; }
    input { width: 100%; padding: 12px 14px; border-radius: 8px; border: 1px solid var(--line);
      background: var(--field); color: var(--ink); font: inherit; outline: none; }
    input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
    .hint { margin: 0; min-height: 18px; font-size: 13px; color: var(--muted); }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { flex: 0 0 auto; min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--line);
      background: transparent; color: var(--ink); font: 400 14px/1 var(--font-ui); }
    .chip:hover { border-color: var(--muted); }
    .chip[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: var(--surface); }
    .plan.nudge { background: var(--accent-soft); border-radius: 0 8px 8px 0; padding: 10px 14px; }
    .plan { border-left: 3px solid var(--accent); padding: 2px 0 2px 14px; display: grid; gap: 2px; }
    [hidden] { display: none !important; }
    .plan p { margin: 0; font-weight: 500; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    button { flex: 1 1 160px; min-height: 44px; padding: 0 18px; border-radius: 8px; border: 1px solid transparent;
      font: 500 15px/1 var(--font-ui); cursor: pointer; transition: transform .12s ease, filter .15s ease; }
    button:not(:disabled):hover { transform: translateY(-1px); }
    button:not(:disabled):active { transform: scale(.98); }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .close { background: var(--accent); color: var(--accent-ink); }
    .close:hover { filter: brightness(1.06); }
    .go { position: relative; overflow: hidden; background: transparent; color: var(--ink); border-color: var(--line); }
    .go::before { content: ""; position: absolute; inset: 0; width: var(--p, 0%); background: var(--accent-soft);
      transition: width 1s linear; }
    .go span { position: relative; }
    .go:disabled { cursor: not-allowed; color: var(--muted); }
    .go:not(:disabled):hover { background: var(--accent-soft); }
    @media (prefers-reduced-motion: reduce) { .go::before, button { transition: none; } button:not(:disabled):hover, button:not(:disabled):active { transform: none; } }`;

  // ---------- Pause overlay ----------
  let pauseHost = null;

  const LEAVE = {
    youtube: { label: "Back to YouTube", url: "https://www.youtube.com/" },
    instagram: { label: "Back to Instagram", url: "https://www.instagram.com/" },
    tiktok: { label: "Leave TikTok", url: null },
  };
  const REASONS = ["A video someone sent me", "A break I planned", "Honestly, just bored"];
  const BORED = REASONS[2];

  function showPause(site) {
    if (pauseHost) return;
    injectFonts();
    pauseHost = document.createElement("div");
    pauseHost.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;";
    pauseHost.id = "fiayn-pause";
    const root = pauseHost.attachShadow({ mode: "open" });
    const leave = LEAVE[site] ?? { label: `Leave ${site.replace(/^custom:/, "").split("/")[0]}`, url: null };
    root.innerHTML = `
      <style>${OVERLAY_CSS}</style>
      <div class="scrim">
        <div class="card" role="dialog" aria-modal="true" aria-labelledby="t" tabindex="-1">
          <span class="left"></span>
          <h1 id="t">What brings you here?</h1>
          <div class="field">
            <div class="chips" role="group" aria-label="Pick a reason">
              ${REASONS.map((r) => `<button type="button" class="chip" aria-pressed="false">${r}</button>`).join("")}
            </div>
            <input id="reason" maxlength="120" autocomplete="off" placeholder="Or type your own reason…" aria-label="Your reason" />
          </div>
          <div class="plan">
            <span class="label">You wanted time for</span><p class="goal"></p>
          </div>
          <div class="actions">
            <button class="close" type="button"></button>
            <button class="go" type="button" disabled><span></span></button>
          </div>
          <p class="hint" role="status"></p>
        </div>
      </div>`;

    const input = root.querySelector("input");
    const go = root.querySelector(".go");
    const goText = go.querySelector("span");
    const hint = root.querySelector(".hint");
    const chips = [...root.querySelectorAll(".chip")];
    const planBox = root.querySelector(".plan");
    const goal = status?.settings.goal ?? "";
    root.querySelector(".goal").textContent = goal;
    planBox.hidden = !goal;
    root.querySelector(".left").textContent = `${fmt(status?.remaining ?? 0)} left today`;
    root.querySelector(".close").textContent = leave.label;

    // Keep site keyboard shortcuts (YouTube's k, j, l, f…) from firing while typing.
    for (const ev of ["keydown", "keyup", "keypress"]) {
      input.addEventListener(ev, (e) => {
        e.stopPropagation();
        if (ev === "keydown" && e.key === "Enter" && !go.disabled) go.click();
      });
    }

    let left = PAUSE_SECONDS;
    const update = () => {
      const reason = input.value.trim();
      const hasReason = reason.length >= 3;
      const ready = left <= 0 && hasReason;
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c.textContent === reason)));
      planBox.classList.toggle("nudge", reason === BORED);
      go.disabled = !ready;
      go.style.setProperty("--p", `${((PAUSE_SECONDS - Math.max(0, left)) / PAUSE_SECONDS) * 100}%`);
      goText.textContent = left > 0 ? `Continue in ${left}s` : "Continue";
      hint.textContent = !hasReason
        ? "Pick a reason to continue. The short wait helps the urge settle."
        : reason === BORED
          ? goal ? "That's an honest answer. Your reminder is right above." : "That's an honest answer. Going back is always an option."
          : left > 0
            ? "Thanks. Continue opens when the timer ends."
            : "";
    };
    const countdown = setInterval(() => {
      left -= 1;
      update();
      if (left <= 0) clearInterval(countdown);
    }, 1000);
    input.addEventListener("input", update);
    chips.forEach((c) =>
      c.addEventListener("click", () => {
        input.value = c.textContent;
        update();
      }),
    );
    update();

    go.addEventListener("click", () => {
      if (go.disabled) return;
      touchPause();
      removePause();
    });
    root.querySelector(".close").addEventListener("click", async () => {
      // Leave in the same tab, never close it: closing makes Chrome jump to a neighbouring tab.
      try {
        await send({ type: "resisted" });
        if (leave.url) {
          try { sessionStorage.setItem(LEFT_KEY, "1"); } catch {}
          location.href = leave.url;
        } else {
          await send({ type: "leave", from: location.href });
        }
      } catch {}
    });

    pauseHost._cleanup = () => clearInterval(countdown);
    document.documentElement.appendChild(pauseHost);
    setTimeout(() => root.querySelector(".card")?.focus(), 50);
  }

  function removePause() {
    if (!pauseHost) return;
    pauseHost._cleanup?.();
    pauseHost.remove();
    pauseHost = null;
  }

  // ---------- Remaining-time pill ----------
  let pill = null;
  function showPill(text, urgent) {
    if (!pill) {
      injectFonts();
      pill = document.createElement("div");
      pill.setAttribute("aria-live", "off");
      document.documentElement.appendChild(pill);
    }
    pill.style.cssText =
      "all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483646;pointer-events:none;" +
      "padding:7px 12px;border-radius:6px;box-shadow:0 6px 20px -8px rgb(0 0 0 / .5);" +
      `background:${urgent ? "#c4202f" : "#121b36"};color:#ffffff;` +
      "font:500 13px/1.2 'FIAYN Sans','Segoe UI',system-ui,sans-serif;font-variant-numeric:tabular-nums;";
    pill.textContent = text;
  }
  function removePill() {
    pill?.remove();
    pill = null;
  }

  // ---------- "You left" confirmation (shown once on the page you land on) ----------
  function showLeftToast() {
    let flagged = false;
    try {
      flagged = sessionStorage.getItem(LEFT_KEY) === "1";
      sessionStorage.removeItem(LEFT_KEY);
    } catch {}
    if (!flagged) return;
    send({ type: "getStatus" }).then((s) => {
      injectFonts();
      const t = document.createElement("div");
      t.id = "fiayn-toast";
      t.setAttribute("role", "status");
      t.style.cssText =
        "all:initial;position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483646;" +
        "max-width:min(440px,calc(100vw - 32px));box-sizing:border-box;padding:12px 16px;border-radius:10px;" +
        "background:#121b36;color:#ffffff;box-shadow:0 10px 30px -10px rgb(0 0 0 / .5);" +
        "font:400 14px/1.45 'FIAYN Sans','Segoe UI',system-ui,sans-serif;transition:opacity .3s ease;";
      const goal = s?.settings?.goal;
      t.textContent = goal ? `Good call. Back to ${goal}.` : "Good call. You left short-form.";
      (document.body || document.documentElement).appendChild(t);
      setTimeout(() => (t.style.opacity = "0"), 4000);
      setTimeout(() => t.remove(), 4400);
    }).catch(() => {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showLeftToast, { once: true });
  else showLeftToast();

  // ---------- Main loop ----------
  let status = null;
  let lastSite = null;
  let unsent = 0;
  let busy = false;
  let blocking = false;

  async function flush() {
    if (unsent <= 0) return;
    const seconds = unsent;
    unsent = 0;
    status = await send({ type: "addUsage", seconds });
  }

  async function tick() {
    if (busy || blocking) return;
    if (!chrome.runtime?.id) {
      // Extension was reloaded/removed; this script is orphaned.
      clearInterval(timer);
      removePause();
      removePill();
      return;
    }
    busy = true;
    try {
      const site = await matchSite(location.href);
      if (site !== lastSite) {
        if (lastSite) await flush();
        lastSite = site;
        status = null;
      }
      if (!site) {
        removePause();
        removePill();
        return;
      }
      if (status?.emergencyActive && Date.now() >= status.emergencyUntil) status = null;
      if (!status) status = await send({ type: "getStatus" });
      if (!siteEnabled(status, site)) {
        removePause();
        removePill();
        return;
      }
      // Sites the user chose to block are off all day (unless an emergency pass is running).
      if (customEntry(status, site)?.mode === "block" && !status.emergencyActive) {
        blocking = true;
        pauseVideos();
        await send({ type: "block", from: location.href, why: "site" });
        return;
      }
      if (status.blocked) {
        blocking = true;
        pauseVideos();
        await send({ type: "block", from: location.href });
        return;
      }
      if (!pauseValid()) {
        pauseVideos();
        showPause(site);
        return;
      }
      removePause();
      if (document.visibilityState !== "visible") return;

      touchPause();
      unsent += 1;
      const outOfTime = !status.emergencyActive && unsent >= status.remaining;
      if (unsent >= REPORT_EVERY || outOfTime) await flush();

      if (status.emergencyActive) {
        showPill(`Pass ${fmt((status.emergencyUntil - Date.now()) / 1000)}`, true);
      } else {
        const left = status.remaining - unsent;
        showPill(left <= 60 ? `${fmt(left)} left, last minute` : `${fmt(left)} left today`, left <= 60);
      }
    } catch {
      // Worker restarting or context invalidated; try again next tick.
      status = null;
    } finally {
      busy = false;
    }
  }

  const timer = setInterval(tick, 1000);
  tick();
})();
