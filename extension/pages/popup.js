const $ = (id) => document.getElementById(id);

async function render() {
  const s = await send({ type: "getStatus" });
  const mins = Math.round(s.budget / 60);
  const headline = $("headline");
  let dial;

  if (s.emergencyActive) {
    dial = { time: fmt((s.emergencyUntil - Date.now()) / 1000), caption: "pass left", remaining: 0, stop: true };
    headline.innerHTML = "Emergency pass running.<span class=\"sub\">Short-form closes again when it ends.</span>";
  } else if (s.budget === 0) {
    dial = { time: "Off", caption: "today", remaining: 0, stop: false };
    headline.innerHTML = "Short-form is off today.<span class=\"sub\">You set your daily minutes to 0.</span>";
  } else if (s.blocked) {
    // Once the minutes are used, the useful number is when they come back.
    dial = { time: untilMidnight(), caption: "until it opens", remaining: 0, stop: false };
    headline.innerHTML = `You've used today's ${plural(mins, "minute")}.<span class="sub">Short-form opens again at midnight.</span>`;
  } else {
    dial = { time: fmt(s.remaining), caption: "left today", remaining: s.remaining, stop: false };
    headline.innerHTML = s.used === 0
      ? `Nothing watched yet.<span class="sub">You have ${plural(mins, "minute")} of short-form today.</span>`
      : `${fmt(s.used)} watched so far.<span class="sub">Out of ${plural(mins, "minute")} today.</span>`;
  }

  renderDial($("dial"), { budget: s.budget || 60, ...dial });
  $("dial").querySelector(".time").classList.toggle("long", dial.time.length > 5);

  $("used").textContent = fmt(s.used);
  $("resisted").textContent = String(s.resisted);

  renderWeek(s);
  $("setup").hidden = s.onboarded;

  const notice = $("notice");
  notice.hidden = !s.pending;
  if (s.pending) {
    notice.textContent = `A looser setting starts ${new Date(s.pending.applyAt).toLocaleString([], {
      weekday: "short", hour: "2-digit", minute: "2-digit",
    })}. You can cancel it in Settings.`;
  }
}

function renderWeek(s) {
  const max = Math.max(s.budget, ...s.week.map((d) => d.seconds), 60);
  const bars = $("bars");
  if (bars.childElementCount !== 8) {
    bars.innerHTML = '<div class="limit"></div>' + '<div class="bar"><span></span></div>'.repeat(7);
    $("days").innerHTML = "<span></span>".repeat(7);
  }
  const limit = bars.firstElementChild;
  limit.style.bottom = `${(s.budget / max) * 100}%`;
  limit.hidden = s.budget === 0;
  s.week.forEach((d, i) => {
    const bar = bars.children[i + 1];
    const isToday = i === 6;
    bar.className = `bar${isToday ? " today" : ""}${d.seconds > s.budget ? " over" : ""}`;
    bar.firstElementChild.style.height = `${(d.seconds / max) * 100}%`;
    bar.title = `${fmt(d.seconds)} watched`;
    const day = $("days").children[i];
    day.textContent = isToday ? "Today" : new Date(d.date + "T12:00").toLocaleDateString([], { weekday: "narrow" });
    day.className = isToday ? "today" : "";
  });
  const avg = s.week.reduce((a, d) => a + d.seconds, 0) / 7;
  const empty = s.week.every((d) => d.seconds === 0);
  bars.hidden = empty;
  $("days").hidden = empty;
  $("weekEmpty").hidden = !empty;
  $("weekAvg").textContent = `Average ${fmt(avg)} a day`;
  bars.setAttribute("aria-label", `Last 7 days: ${s.week.map((d) => fmt(d.seconds)).join(", ")}. Average ${fmt(avg)} a day.`);
}

$("guide").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("pages/guide.html") });
  window.close();
});

$("openSetup").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("pages/welcome.html") });
  window.close();
});

$("settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

render();
setInterval(render, 1000);
