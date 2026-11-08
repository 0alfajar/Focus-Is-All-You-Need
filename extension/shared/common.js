// Shared helpers for extension pages (popup, options, block).
const send = (msg) => chrome.runtime.sendMessage(msg);

const SITES = {
  youtube: { name: "YouTube Shorts", scope: "youtube.com/shorts", home: "https://www.youtube.com/" },
  instagram: { name: "Instagram Reels", scope: "instagram.com/reels", home: "https://www.instagram.com/" },
  tiktok: { name: "TikTok", scope: "All of tiktok.com", home: null },
};

function fmt(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function untilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const mins = Math.ceil((midnight - now) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Draws the dial: 60 ticks like a clock face, lit for the share of today's allowance still left.
 * el must contain an <svg> and a .face with .time and .caption children (built on first call).
 */
function renderDial(el, { budget, remaining, time, caption, stop = false }) {
  if (!el.querySelector("svg")) {
    el.innerHTML =
      '<svg viewBox="0 0 200 200" aria-hidden="true"></svg>' +
      '<div class="face"><div class="time"></div><div class="caption"></div></div>';
  }
  const svg = el.querySelector("svg");
  const count = 60;
  const lit = budget > 0 ? Math.ceil((remaining / budget) * count) : 0;

  if (svg.childElementCount !== count) {
    const ns = "http://www.w3.org/2000/svg";
    svg.replaceChildren();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 - Math.PI / 2;
      const line = document.createElementNS(ns, "line");
      const inner = i % 5 === 0 ? 78 : 84; // longer marks every 5, like a watch face
      line.setAttribute("x1", 100 + Math.cos(a) * inner);
      line.setAttribute("y1", 100 + Math.sin(a) * inner);
      line.setAttribute("x2", 100 + Math.cos(a) * 94);
      line.setAttribute("y2", 100 + Math.sin(a) * 94);
      line.setAttribute("class", "tick");
      svg.appendChild(line);
    }
  }
  // Ticks run clockwise from 12; the lit ones are the minutes you still have.
  [...svg.children].forEach((t, i) => t.classList.toggle("on", i < lit));
  el.classList.toggle("stop", stop);
  el.querySelector(".time").textContent = time;
  el.querySelector(".caption").textContent = caption;
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `${time} ${caption}`);
}
