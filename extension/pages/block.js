const EMERGENCY_WAIT_MS = 60 * 1000;
const STALE_REQUEST_MS = 10 * 60 * 1000;
const $ = (id) => document.getElementById(id);

const from = (() => {
  try {
    const u = new URL(new URLSearchParams(location.search).get("from"));
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
})();

const site = (() => {
  const h = from?.hostname ?? "";
  if (/(^|\.)youtube\.com$/.test(h)) return SITES.youtube;
  if (/(^|\.)instagram\.com$/.test(h)) return SITES.instagram;
  if (/(^|\.)tiktok\.com$/.test(h)) return SITES.tiktok;
  return h ? { name: h.replace(/^www\./, ""), home: null } : null;
})();

const whySite = new URLSearchParams(location.search).get("why") === "site";
const blockedEntry = (s) => {
  if (!from) return null;
  const host = from.hostname.replace(/^www\./, "");
  const path = from.pathname.toLowerCase();
  return (s.settings.custom ?? []).find(
    (c) =>
      c.mode === "block" &&
      (host === c.host || host.endsWith("." + c.host)) &&
      (!c.path || path === c.path || path.startsWith(c.path + "/")),
  );
};

let timer = null;
function refreshIn(ms) {
  clearTimeout(timer);
  timer = setTimeout(async () => render(await send({ type: "getStatus" })), ms);
}

function render(s) {
  $("goal").textContent = s.settings.goal;
  $("goalBox").hidden = !s.settings.goal;

  // "Open YouTube home" only makes sense for sites where the non-short-form part is allowed.
  $("home").hidden = !site?.home;
  if (site?.home) $("home").textContent = `Open ${site.name.split(" ")[0]} home`;

  const entry = whySite ? blockedEntry(s) : null;
  if (entry && !s.emergencyActive) {
    const name = entry.host + entry.path;
    renderDial($("dial"), { budget: 60, remaining: 0, time: "Off", caption: "blocked site", stop: true });
    $("eyebrow").textContent = "Blocked site";
    $("title").textContent = `You blocked ${name}.`;
    $("lede").textContent = `You chose to keep ${name} off. To change that, remove it in Settings. Removing a site takes 24 hours.`;
    $("back").hidden = true;
    $("sos").hidden = false;
    renderEmergency(s);
    return;
  }

  if (!s.blocked) {
    renderDial($("dial"), {
      budget: s.budget || 60,
      remaining: s.emergencyActive ? 0 : s.remaining,
      time: s.emergencyActive ? fmt((s.emergencyUntil - Date.now()) / 1000) : fmt(s.remaining),
      caption: s.emergencyActive ? "pass left" : "left today",
      stop: s.emergencyActive,
    });
    $("eyebrow").textContent = s.emergencyActive ? "Emergency pass running" : "Not blocked";
    $("title").textContent = s.emergencyActive
      ? "Your emergency pass is running."
      : "You still have time left today.";
    $("lede").textContent = s.emergencyActive
      ? "The block comes back when the timer reaches zero."
      : `${fmt(s.remaining)} of short-form left.`;
    $("back").hidden = !from;
    $("sos").hidden = true;
    if (s.emergencyActive) refreshIn(1000);
    return;
  }

  // Same as the popup: once time is used, show when it comes back.
  renderDial($("dial"), { budget: s.budget || 60, remaining: 0, time: untilMidnight(), caption: "until it opens", stop: false });
  $("eyebrow").textContent = "Daily allowance used";
  $("title").textContent =
    s.budget > 0
      ? `You chose ${plural(Math.round(s.budget / 60), "minute")} for today. That time is used up.`
      : "You switched short-form off for today.";
  $("lede").textContent =
    `That's okay. Short-form opens again at midnight, in ${untilMidnight()}.` +
    (site?.home ? ` The rest of ${site.name.split(" ")[0]} still works.` : "");
  $("back").hidden = true;
  $("sos").hidden = false;
  renderEmergency(s);
}

function renderEmergency(s) {
  const btn = $("sosBtn");
  const meter = $("meter");

  if (!s.emergencyAvailable) {
    $("sosText").textContent = "You've used today's emergency pass. You get a new one tomorrow.";
    btn.hidden = true;
    meter.hidden = true;
    return;
  }

  const elapsed = s.emergencyRequestedAt ? Date.now() - s.emergencyRequestedAt : null;

  if (elapsed === null || elapsed > STALE_REQUEST_MS) {
    $("sosText").textContent =
      "For something you really need, like a link someone sent you for work. One pass a day: wait 60 seconds, then watch for 5 minutes.";
    meter.hidden = true;
    btn.hidden = false;
    btn.disabled = false;
    btn.textContent = "Ask for a pass";
    btn.onclick = async () => {
      btn.disabled = true;
      render(await send({ type: "emergencyRequest" }));
    };
  } else if (elapsed < EMERGENCY_WAIT_MS) {
    const left = (EMERGENCY_WAIT_MS - elapsed) / 1000;
    $("sosText").textContent =
      "Urges rise, peak and fade like a wave. Breathe through this minute and see if this one passes on its own.";
    meter.hidden = false;
    $("meterFill").style.width = `${Math.min(100, (elapsed / EMERGENCY_WAIT_MS) * 100)}%`;
    btn.hidden = false;
    btn.disabled = true;
    btn.textContent = `Pass ready in ${fmt(left)}`;
    btn.onclick = null;
    refreshIn(1000);
  } else {
    $("sosText").textContent = "If you still need it, your 5 minutes can start now.";
    meter.hidden = true;
    btn.hidden = false;
    btn.disabled = false;
    btn.textContent = "Start 5 minutes";
    btn.onclick = async () => {
      btn.disabled = true;
      const r = await send({ type: "emergencyConfirm" });
      if (r.error) {
        $("sosText").textContent = r.error;
        btn.disabled = false;
        return;
      }
      if (from) location.href = from.href;
      else render(r);
    };
  }
}

$("close").addEventListener("click", async () => {
  await send({ type: "closeTab" });
});
$("home").addEventListener("click", () => {
  if (site?.home) location.href = site.home;
});
$("back").addEventListener("click", () => {
  if (from) location.href = from.href;
});

send({ type: "getStatus" }).then(render);
