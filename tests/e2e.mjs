// End-to-end test: loads the unpacked extension in Chrome for Testing and clicks every button.
// Site pages are faked via request interception so tests are deterministic and offline-safe.
import puppeteer from "puppeteer";
import path from "node:path";
import fs from "node:fs";

const EXT = path.resolve(process.argv[2] ?? "extension");
const SHOTS = path.resolve("tests/shots");
const GUIDE = path.resolve("extension/assets/guide"); // walkthrough images, regenerated on every run
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push(["PASS", name]);
    console.log("PASS", name);
  } catch (e) {
    results.push(["FAIL", name, e.message]);
    console.log("FAIL", name, "-", e.message);
  }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: true,
  pipe: true,
  enableExtensions: [EXT],
  args: ["--no-first-run", "--window-size=1280,860"],
  defaultViewport: { width: 1280, height: 860 },
});

const swTarget = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().endsWith("background.js"));
const sw = await swTarget.worker();
const extId = new URL(swTarget.url()).host;
const ext = (p) => `chrome-extension://${extId}/${p}`;
const store = {
  get: () => sw.evaluate(() => chrome.storage.local.get(null)),
  set: (o) => sw.evaluate((o) => chrome.storage.local.set(o), o),
  clear: () => sw.evaluate(() => chrome.storage.local.clear()),
};
const today = () => {
  const d = new Date(); const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const FAKE = `<!doctype html><html><head><title>Video</title></head><body style="margin:0;background:#f6f6f7;font-family:system-ui,sans-serif"><div style="display:grid;grid-template-columns:1fr 420px;gap:40px;padding:28px 40px;max-width:1280px;box-sizing:border-box"><div style="display:grid;justify-items:center;gap:16px"><div style="width:340px;height:604px;border-radius:18px;background:linear-gradient(165deg,#cfd3da,#b9bec8)"></div><video muted playsinline style="display:none"></video></div><div style="display:grid;gap:16px;align-content:start"><div style="display:flex;gap:12px"><div style="width:168px;height:94px;border-radius:10px;background:#dcdee3;flex:none"></div><div style="display:grid;gap:8px;align-content:start;padding-top:6px;flex:1"><div style="height:12px;border-radius:6px;background:#d9dbe0;width:92%"></div><div style="height:12px;border-radius:6px;background:#e3e5e9;width:64%"></div><div style="height:10px;border-radius:5px;background:#e8e9ec;width:40%"></div></div></div><div style="display:flex;gap:12px"><div style="width:168px;height:94px;border-radius:10px;background:#dcdee3;flex:none"></div><div style="display:grid;gap:8px;align-content:start;padding-top:6px;flex:1"><div style="height:12px;border-radius:6px;background:#d9dbe0;width:92%"></div><div style="height:12px;border-radius:6px;background:#e3e5e9;width:64%"></div><div style="height:10px;border-radius:5px;background:#e8e9ec;width:40%"></div></div></div><div style="display:flex;gap:12px"><div style="width:168px;height:94px;border-radius:10px;background:#dcdee3;flex:none"></div><div style="display:grid;gap:8px;align-content:start;padding-top:6px;flex:1"><div style="height:12px;border-radius:6px;background:#d9dbe0;width:92%"></div><div style="height:12px;border-radius:6px;background:#e3e5e9;width:64%"></div><div style="height:10px;border-radius:5px;background:#e8e9ec;width:40%"></div></div></div><div style="display:flex;gap:12px"><div style="width:168px;height:94px;border-radius:10px;background:#dcdee3;flex:none"></div><div style="display:grid;gap:8px;align-content:start;padding-top:6px;flex:1"><div style="height:12px;border-radius:6px;background:#d9dbe0;width:92%"></div><div style="height:12px;border-radius:6px;background:#e3e5e9;width:64%"></div><div style="height:10px;border-radius:5px;background:#e8e9ec;width:40%"></div></div></div><div style="display:flex;gap:12px"><div style="width:168px;height:94px;border-radius:10px;background:#dcdee3;flex:none"></div><div style="display:grid;gap:8px;align-content:start;padding-top:6px;flex:1"><div style="height:12px;border-radius:6px;background:#d9dbe0;width:92%"></div><div style="height:12px;border-radius:6px;background:#e3e5e9;width:64%"></div><div style="height:10px;border-radius:5px;background:#e8e9ec;width:40%"></div></div></div><div style="display:flex;gap:12px"><div style="width:168px;height:94px;border-radius:10px;background:#dcdee3;flex:none"></div><div style="display:grid;gap:8px;align-content:start;padding-top:6px;flex:1"><div style="height:12px;border-radius:6px;background:#d9dbe0;width:92%"></div><div style="height:12px;border-radius:6px;background:#e3e5e9;width:64%"></div><div style="height:10px;border-radius:5px;background:#e8e9ec;width:40%"></div></div></div><div style="display:flex;gap:12px"><div style="width:168px;height:94px;border-radius:10px;background:#dcdee3;flex:none"></div><div style="display:grid;gap:8px;align-content:start;padding-top:6px;flex:1"><div style="height:12px;border-radius:6px;background:#d9dbe0;width:92%"></div><div style="height:12px;border-radius:6px;background:#e3e5e9;width:64%"></div><div style="height:10px;border-radius:5px;background:#e8e9ec;width:40%"></div></div></div><div style="display:flex;gap:12px"><div style="width:168px;height:94px;border-radius:10px;background:#dcdee3;flex:none"></div><div style="display:grid;gap:8px;align-content:start;padding-top:6px;flex:1"><div style="height:12px;border-radius:6px;background:#d9dbe0;width:92%"></div><div style="height:12px;border-radius:6px;background:#e3e5e9;width:64%"></div><div style="height:10px;border-radius:5px;background:#e8e9ec;width:40%"></div></div></div></div></div></body></html>`;

async function fakePage() {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    if (/^https:\/\/(www\.)?(youtube|tiktok|instagram)\.com\//.test(u) && req.resourceType() === "document") {
      req.respond({ status: 200, contentType: "text/html", body: FAKE });
    } else if (/^https:\/\//.test(u)) {
      req.respond({ status: 204, body: "" });
    } else req.continue();
  });
  return page;
}
// Crop to one element (plus padding) at 2x, so walkthrough images stay sharp and focused.
async function crop(page, target, file, pad = 24) {
  const h = typeof target === "string" ? await page.$(target) : target;
  const b = await h.boundingBox();
  const vp = page.viewport();
  const x = Math.max(0, b.x - pad);
  const y = Math.max(0, b.y - pad);
  const width = Math.min(b.width + pad * 2, vp.width - x);
  await page.screenshot({ path: `${GUIDE}/${file}`, clip: { x, y, width, height: b.height + pad * 2, scale: 2 } });
}
const visible = (page, sel) => page.$eval(sel, (el) => !!el.offsetParent || getComputedStyle(el).position === "fixed").catch(() => false);
const text = (page, sel) => page.$eval(sel, (el) => el.textContent.trim());
const tabClosed = (page) => new Promise((r) => page.once("close", () => r(true)));

// ---------------- Onboarding ----------------
await step("welcome: opens on install; optional reminder, limit, done", async () => {
  const t = await browser.waitForTarget((t) => t.url().startsWith(ext("pages/welcome.html")), { timeout: 10000 });
  const w = await t.page();
  await w.setViewport({ width: 1280, height: 860 });
  await w.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await w.waitForSelector('[data-step="0"]:not([hidden])');
  assert(!(await w.$eval("#next", (b) => b.disabled)), "the reminder is optional, so Next is enabled");
  assert((await text(w, "#next")) === "Skip", "empty reminder offers Skip");
  assert(!(await visible(w, "#back")), "Back hidden on step 1");
  await w.screenshot({ path: `${SHOTS}/welcome-1.png` });
  await crop(w, '[data-step="0"]', "1-setup.png", 32);
  await w.click('.chips[data-for="goal"] button');
  assert((await text(w, "#next")) === "Next", "with a reminder the button says Next");
  await w.click("#next");

  await w.waitForSelector('[data-step="1"]:not([hidden])');
  await w.click('#presets [data-min="15"]');
  assert((await text(w, "#next")) === "Finish setup", "step 2 finishes setup");
  await w.screenshot({ path: `${SHOTS}/welcome-2.png` });
  await w.click("#back");
  await w.waitForSelector('[data-step="0"]:not([hidden])');
  await w.click("#next");
  await w.waitForSelector('[data-step="1"]:not([hidden])');
  await w.click("#next");

  await w.waitForSelector('[data-step="2"]:not([hidden])');
  assert((await text(w, "#sumGoal")) === "deep, focused work", "summary reminder");
  assert((await text(w, "#sumBudget")) === "15 minutes a day", "summary budget");
  await w.screenshot({ path: `${SHOTS}/welcome-done.png` });
  await w.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await w.screenshot({ path: `${SHOTS}/welcome-done-dark.png` });
  await w.setViewport({ width: 390, height: 844 });
  assert(!(await w.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "welcome scrolls sideways at 390px");

  const s = await store.get();
  assert(s.onboarded === true, "onboarded flag not stored");
  assert(s.settings.goal === "deep, focused work", "reminder not stored");
  assert(!("plan" in s.settings) && !("cue" in s.settings), "no plan fields any more");

  assert(await visible(w, "#tryIt"), "Try it on a Short should show on the last step");
  assert((await w.$eval("#tryIt", (b) => b.className)) === "btn", "Try it should be the primary button");
  assert((await text(w, "#next")) === "Done", "secondary button should say Done");
  const closed = tabClosed(w);
  await w.click("#next");
  assert(await Promise.race([closed, sleep(3000).then(() => false)]), "Done did not close the tab");
});

await step("welcome: reopening after setup shows the walkthrough", async () => {
  const w = await browser.newPage();
  await w.goto(ext("pages/welcome.html"));
  await w.waitForFunction((u) => location.href.startsWith(u), { timeout: 5000 }, ext("pages/guide.html"));
  await w.close();
});

// ---------------- Popup ----------------
await step("popup: renders a full dial and 'On' state", async () => {
  const p = await browser.newPage();
  await p.setViewport({ width: 320, height: 520 });
  await p.goto(ext("pages/popup.html"));
  await p.waitForFunction(() => document.querySelector("#dial .time")?.textContent === "15:00");
  assert(/Nothing watched yet/.test(await text(p, "#headline")), "headline for a fresh day");
  const ticks = await p.$$eval("#dial .tick.on", (t) => t.length);
  assert(ticks === 60, `expected 60 lit ticks, got ${ticks}`);
  assert((await text(p, "#dial .time")) === "15:00", "time should be 15:00");
  assert(!(await visible(p, "#notice")), "pending notice should be hidden");
  assert(!(await visible(p, "#setup")), "setup prompt should be hidden after onboarding");
  assert((await p.$$eval("#bars .bar", (b) => b.length)) === 7, "expected 7 day bars");
  assert((await text(p, "#days .today")) === "Today", "today label missing");
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await p.screenshot({ path: `${SHOTS}/popup-light.png` });
  const statsBottom = await p.$eval(".stats", (el) => el.getBoundingClientRect().bottom);
  await p.screenshot({ path: `${GUIDE}/6-popup.png`, clip: { x: 0, y: 0, width: 320, height: statsBottom, scale: 2 } });
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await p.screenshot({ path: `${SHOTS}/popup-dark.png` });
  await p.close();
});

await step("popup: blocked state shows when it opens again, said once", async () => {
  const st = await store.get();
  await store.set({ usage: { date: today(), seconds: st.settings.budgetMinutes * 60, resisted: 0 } });
  const p = await browser.newPage();
  await p.setViewport({ width: 320, height: 560 });
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await p.goto(ext("pages/popup.html"));
  await p.waitForFunction(() => document.querySelector("#dial .caption")?.textContent === "until it opens");
  assert(/^\d+h \d+m$|^\d+m$/.test(await text(p, "#dial .time")), "dial shows time until midnight");
  const body = await p.evaluate(() => document.body.innerText);
  assert((body.match(/blocked/gi) || []).length === 0, "the word 'blocked' should not repeat in the popup");
  await p.screenshot({ path: `${SHOTS}/popup-blocked.png` });
  await store.set({ usage: { date: today(), seconds: 0, resisted: 0 } });
  await p.close();
});

await step("popup: Settings button opens options page", async () => {
  const p = await browser.newPage();
  await p.goto(ext("pages/popup.html"));
  const opened = browser.waitForTarget((t) => t.url().startsWith(ext("pages/options.html")), { timeout: 5000 });
  await p.click("#settings");
  const t = await opened;
  (await t.page())?.close();
  if (!p.isClosed()) await p.close();
});

// ---------------- Options ----------------
let opt;
await step("options: preset button selects and enables Save", async () => {
  opt = await browser.newPage();
  await opt.goto(ext("pages/options.html"));
  await opt.waitForFunction(() => document.querySelector("#budget").value === "15");
  assert(await opt.$eval("#save", (b) => b.disabled), "Save should start disabled");
  await opt.click('#presets [data-min="5"]');
  assert((await opt.$eval('#presets [data-min="5"]', (b) => b.getAttribute("aria-pressed"))) === "true", "preset not pressed");
  assert(!(await opt.$eval("#save", (b) => b.disabled)), "Save should enable");
  await opt.click("#save");
  await opt.waitForFunction(() => document.querySelector("#status").textContent === "Saved");
  const s = await store.get();
  assert(s.settings.budgetMinutes === 5, `budget saved as ${s.settings.budgetMinutes}`);
  assert(await opt.$eval("#save", (b) => b.disabled), "Save should disable after saving");
});

await step("options: raising budget creates a 24h pending change", async () => {
  await opt.click('#presets [data-min="30"]');
  await opt.click("#save");
  await opt.waitForFunction(() => /24 hours/.test(document.querySelector("#status").textContent));
  assert(await visible(opt, "#pending"), "pending card should show");
  const s = await store.get();
  assert(s.settings.budgetMinutes === 5 && s.pending.settings.budgetMinutes === 30, "pending not stored correctly");
});

await step("options: Cancel this change removes pending", async () => {
  await opt.click("#cancelPending");
  await opt.waitForFunction(() => document.querySelector("#pending").hidden);
  assert((await store.get()).pending === null, "pending still stored");
});

await step("options: clicking site row label toggles the switch", async () => {
  const before = await opt.$eval("#site-tiktok", (c) => c.checked);
  await opt.click('label[for="site-tiktok"] .name');
  const after = await opt.$eval("#site-tiktok", (c) => c.checked);
  assert(before !== after, "label click did not toggle");
  await opt.click('label[for="site-tiktok"] .name'); // restore
});

await step("options: reminder saves immediately", async () => {
  assert((await opt.$eval("#goal", (i) => i.value)) === "deep, focused work", "reminder not loaded from setup");
  await opt.$eval("#goal", (i) => (i.value = ""));
  await opt.type("#goal", "my own projects");
  await opt.click("#save");
  await opt.waitForFunction(() => document.querySelector("#status").textContent === "Saved");
  let s = await store.get();
  assert(s.settings.goal === "my own projects", `goal: ${s.settings.goal}`);
  assert(!s.pending, "reminder change must not be delayed");
  await opt.$eval("#goal", (i) => (i.value = ""));
  await opt.type("#goal", "deep, focused work");
  await opt.click("#save");
  await opt.waitForFunction(() => document.querySelector("#status").textContent === "Saved");
  await opt.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await opt.screenshot({ path: `${SHOTS}/options-light.png`, fullPage: true });
  await opt.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await opt.screenshot({ path: `${SHOTS}/options-dark.png`, fullPage: true });
  await opt.setViewport({ width: 400, height: 860 });
  const overflow = await opt.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert(!overflow, "options page scrolls sideways at 400px");
  await opt.close();
});

// ---------------- Content script ----------------
await store.clear();
await store.set({ settings: { budgetMinutes: 1, sites: { youtube: true, instagram: true, tiktok: true }, goal: "deep, focused work", cue: "I feel the urge to scroll", action: "take three slow breaths and get back to it" } });

let yt;
await step("content: normal YouTube video page has no pause screen", async () => {
  yt = await fakePage();
  await yt.goto("https://www.youtube.com/watch?v=abc");
  await sleep(2000);
  assert(!(await yt.$("#fiayn-pause")), "pause overlay should not appear on /watch");
});

await step("content: Shorts shows pause; Continue locked until 10s + reason", async () => {
  await yt.goto("https://www.youtube.com/shorts/abc");
  await yt.waitForSelector("#fiayn-pause", { timeout: 5000 });
  const go = await yt.waitForSelector("pierce/.go");
  assert(await go.evaluate((b) => b.disabled), "Continue should be disabled at start");
  const goal = await yt.$eval("pierce/.goal", (p) => p.textContent);
  assert(goal === "deep, focused work", `pause goal: ${goal}`);
  assert((await yt.$eval("pierce/.close", (b) => b.textContent)) === "Back to YouTube", "leave button label");
  await yt.screenshot({ path: `${SHOTS}/pause-light.png` });
  await (await yt.waitForSelector("pierce/.chip")).click();
  assert(await yt.$eval("pierce/.plan", (el) => !el.hidden), "reminder box shows when a reminder is set");
  assert((await yt.$eval("pierce/#reason", (i) => i.value)) === "A video someone sent me", "chip should fill reason");
  assert(await go.evaluate((b) => b.disabled), "Continue still waits for the timer");
  await sleep(1200);
  await crop(yt, await yt.$("pierce/.card"), "2-pause.png", 28);
  await sleep(10500);
  assert(!(await go.evaluate((b) => b.disabled)), "Continue should enable after 10s with a reason");
  await go.click();
  await sleep(300);
  assert(!(await yt.$("#fiayn-pause")), "overlay should close after Continue");
  await sleep(2200);
  await yt.screenshot({ path: `${SHOTS}/watching.png` });
  const vp = yt.viewport();
  await yt.screenshot({ path: `${GUIDE}/3-watching.png`, clip: { x: vp.width - 560, y: vp.height - 320, width: 560, height: 320, scale: 2 } });
});

await step("content: timer counts and redirects to block page when out of time", async () => {
  await sleep(1500);
  const s = await store.get();
  await store.set({ usage: { date: today(), seconds: 57, resisted: s.usage?.resisted ?? 0 } });
  await yt.waitForFunction((u) => location.href.startsWith(u), { timeout: 15000 }, ext("pages/block.html"));
});

await step("block: shows blocked state, correct buttons visible", async () => {
  await yt.waitForFunction(() => document.querySelector("#title").textContent.includes("You chose 1 minute for today"));
  assert(!(await visible(yt, "#back")), "'Return to the video' must be hidden while blocked");
  assert(await visible(yt, "#home"), "home button should show");
  assert((await text(yt, "#home")) === "Open YouTube home", "home button text wrong");
  assert((await text(yt, "#goal")) === "deep, focused work", "block goal missing");
  assert((await text(yt, "#sosBtn")) === "Ask for a pass", "sos button text wrong");
  await yt.screenshot({ path: `${SHOTS}/block-light.png` });
  await crop(yt, "main", "4-blocked.png", 32);
  await yt.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await yt.screenshot({ path: `${SHOTS}/block-dark.png` });
  await yt.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
});

await step("block: emergency unlock waits 60s, then unlocks and returns to video", async () => {
  await yt.click("#sosBtn");
  await yt.waitForFunction(() => /Pass ready in/.test(document.querySelector("#sosBtn").textContent));
  await sleep(2200);
  await yt.screenshot({ path: `${SHOTS}/pass-wait.png` });
  await crop(yt, "#sos", "5-pass.png", 14);
  assert(await yt.$eval("#sosBtn", (b) => b.disabled), "button should be disabled during wait");
  // Skip the real 60s wait by backdating the request.
  const s = await store.get();
  await store.set({ emergency: { ...s.emergency, requestedAt: Date.now() - 61000 } });
  await yt.waitForFunction(() => document.querySelector("#sosBtn").textContent === "Start 5 minutes", { timeout: 5000 });
  await yt.click("#sosBtn");
  await yt.waitForFunction(() => location.href.startsWith("https://www.youtube.com/shorts/"), { timeout: 5000 });
  await yt.waitForFunction(() => {
    const host = document.querySelector("#fiayn-pause");
    return !host; // pause still valid from earlier
  });
  await sleep(2500);
  assert(!yt.url().startsWith("chrome-extension"), "should not be blocked during emergency");
});

await step("block: emergency can't be used twice; home button works", async () => {
  await store.set({ emergency: { date: today(), until: 0, requestedAt: 0 } });
  await yt.waitForFunction((u) => location.href.startsWith(u), { timeout: 10000 }, ext("pages/block.html"));
  await yt.waitForFunction(() => /used today/.test(document.querySelector("#sosText").textContent));
  assert(!(await visible(yt, "#sosBtn")), "sos button should be hidden after use");
  await yt.click("#home");
  await yt.waitForFunction(() => location.href === "https://www.youtube.com/", { timeout: 5000 });
});

await step("block: Close this tab closes it and returns to your last tab, not Settings", async () => {
  // Set up: a normal tab you were on, then Settings, then the blocked tab right next to Settings.
  const normal = await fakePage();
  await normal.goto("https://www.youtube.com/watch?v=last");
  await normal.bringToFront();
  await sleep(300);
  const settings = await browser.newPage();
  await settings.goto(ext("pages/options.html"));
  await settings.bringToFront();
  await sleep(300);
  await yt.bringToFront();
  await yt.goto(ext("pages/block.html?from=" + encodeURIComponent("https://www.tiktok.com/")));
  await yt.waitForSelector("#close");
  const closed = tabClosed(yt);
  await yt.click("#close");
  assert(await Promise.race([closed, sleep(3000).then(() => false)]), "tab did not close");
  await sleep(300);
  const vis = async (pg) => pg.evaluate(() => document.visibilityState);
  assert((await vis(settings)) === "hidden", "landed on Settings");
  assert((await vis(normal)) === "visible", "expected to return to the last normal tab");
  await settings.close();
  await normal.close();
});

await step("content: 'Leave TikTok' stays in the same tab and shows a confirmation", async () => {
  await store.clear();
  await store.set({ settings: { goal: "deep, focused work" } });
  const p = await fakePage();
  await p.goto("https://www.tiktok.com/@someone");
  await p.waitForSelector("#fiayn-pause", { timeout: 5000 });
  assert((await p.$eval("pierce/.close", (b) => b.textContent)) === "Leave TikTok", "leave label");
  await (await p.waitForSelector("pierce/.close")).click();
  await p.waitForFunction((u) => location.href.startsWith(u), { timeout: 5000 }, ext("pages/left.html"));
  assert(!p.isClosed(), "tab must not close");
  await p.waitForFunction(() => document.querySelector("#goal").textContent === "deep, focused work");
  assert(/1 time you left early/.test(await text(p, "#stat")), "left-early count");
  const s = await store.get();
  assert(s.usage.resisted === 1, `resisted = ${s.usage?.resisted}`);
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await p.screenshot({ path: `${SHOTS}/left.png` });
  const known = new Set(browser.targets());
  const opened = browser.waitForTarget((t) => t.type() === "page" && !known.has(t), { timeout: 5000 }).then(() => true, () => false);
  const closed = tabClosed(p);
  await p.click("#newTab");
  assert(await opened, "a new tab should open in its place");
  assert(await Promise.race([closed, sleep(3000).then(() => false)]), "old tab should be replaced");
});

await step("content: no reminder set, no empty reminder box", async () => {
  const st = await store.get();
  await store.set({ settings: { ...st.settings, goal: "" } });
  const p = await fakePage();
  await p.goto("https://www.youtube.com/shorts/none");
  await p.waitForSelector("#fiayn-pause", { timeout: 5000 });
  assert(await p.$eval("pierce/.plan", (el) => el.hidden), "reminder box should hide without a reminder");
  await p.close();
  await store.set({ settings: { ...st.settings, goal: "deep, focused work" } });
});

await step("content: 'Back to YouTube' goes to YouTube home with a toast", async () => {
  const p = await fakePage();
  await p.goto("https://www.youtube.com/shorts/abc");
  await p.waitForSelector("#fiayn-pause", { timeout: 5000 });
  await (await p.waitForSelector("pierce/.close")).click();
  await p.waitForFunction(() => location.href === "https://www.youtube.com/", { timeout: 5000 });
  await p.waitForSelector("#fiayn-toast", { timeout: 3000 });
  assert((await text(p, "#fiayn-toast")) === "Good call. Back to deep, focused work.", "toast text");
  assert(!(await p.$("#fiayn-pause")), "no pause on YouTube home");
  await p.close();
});

await step("settings: add with a typo, fix it, remove at once; 24h rule after 10 minutes", async () => {
  const o = await browser.newPage();
  await o.goto(ext("pages/options.html"));
  await o.waitForSelector("#newSite");
  // Headless Chrome can't show the permission prompt, so stand in for the user clicking Allow.
  await o.evaluate(() => { chrome.permissions.request = async () => true; });

  await o.type("#newSite", "not a site");
  await o.click("#addSite");
  assert(/look like a website/.test(await text(o, "#siteMsg")), "invalid input message");
  await o.$eval("#newSite", (i) => (i.value = ""));

  // Limit mode, with a typo.
  await o.click('#mode [data-mode="limit"]');
  assert(/daily minutes/.test(await text(o, "#modeHelp")), "limit help text");
  await o.type("#newSite", "https://www.YouTube.com/fed/");
  await o.keyboard.press("Enter");
  await o.waitForFunction(() => document.querySelectorAll("#clist li").length === 1);
  assert((await text(o, "#clist .host")) === "youtube.com/fed", "site row text");
  assert(/uses your daily minutes/.test(await text(o, "#clist .tag")), "mode tag");

  // Fix the typo right away.
  await o.click('#clist button[aria-label^="Edit"]');
  await o.waitForSelector("#clist li.editing input");
  await o.$eval("#clist li.editing input", (i) => (i.value = ""));
  await o.type("#clist li.editing input", "youtube.com/feed");
  await o.keyboard.press("Enter");
  await o.waitForFunction(() => document.querySelector("#clist .host")?.textContent === "youtube.com/feed");
  let s = await store.get();
  assert(s.settings.custom.length === 1 && s.settings.custom[0].path === "/feed", "edit should replace the typo");
  assert(!s.removals["youtube.com/fed"], "typo fix must not leave a pending removal");
  assert(s.settings.custom[0].mode === "limit", "edit keeps the mode");

  // Within 10 minutes, Remove is immediate.
  await o.click('#clist button[aria-label^="Remove"]');
  await o.waitForFunction(() => document.querySelectorAll("#clist li").length === 0);
  assert(/removed/.test(await text(o, "#siteMsg")), "quick remove message");

  // Add again and pretend it was added an hour ago: removal now waits 24h.
  await o.type("#newSite", "youtube.com/feed");
  await o.click("#addSite");
  await o.waitForFunction(() => document.querySelectorAll("#clist li").length === 1);
  s = await store.get();
  s.settings.custom[0].addedAt = Date.now() - 3600e3;
  await store.set({ settings: s.settings });
  await o.reload();
  await o.waitForSelector("#clist li");
  await o.evaluate(() => { chrome.permissions.request = async () => true; });
  await o.click('#clist button[aria-label^="Remove"]');
  await o.waitForFunction(() => document.querySelector("#clist li")?.classList.contains("removing"));
  assert((await text(o, "#clist button")) === "Keep", "button should switch to Keep");
  s = await store.get();
  assert(s.removals["youtube.com/feed"] > Date.now() + 23 * 3600e3, "removal should wait 24h");
  assert(s.settings.custom.length === 1, "site stays on during the wait");
  await o.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await o.screenshot({ path: `${SHOTS}/settings-sites.png`, fullPage: true });
  await crop(o, (await o.$$(".section"))[1], "7-settings.png", 0);
  await o.click("#clist button");
  await o.waitForFunction(() => !document.querySelector("#clist li").classList.contains("removing"));
  s = await store.get();
  assert(!s.removals["youtube.com/feed"], "Keep should cancel removal");

  // Block mode is the default.
  await o.click('#mode [data-mode="block"]');
  await o.type("#newSite", "youtube.com/gaming");
  await o.click("#addSite");
  await o.waitForFunction(() => document.querySelectorAll("#clist li").length === 2);
  s = await store.get();
  assert(s.settings.custom.find((c) => c.path === "/gaming")?.mode === "block", "block mode stored");
  await o.close();
});

await step("settings: scrolling over the minutes field doesn't change it", async () => {
  const o = await browser.newPage();
  await o.goto(ext("pages/options.html"));
  await o.waitForFunction(() => document.querySelector("#budget").value !== "");
  const before = await o.$eval("#budget", (i) => i.value);
  await o.click("#budget");
  const box = await (await o.$("#budget")).boundingBox();
  await o.mouse.move(box.x + 10, box.y + 10);
  await o.mouse.wheel({ deltaY: -300 });
  await o.mouse.wheel({ deltaY: 300 });
  await sleep(200);
  assert((await o.$eval("#budget", (i) => i.value)) === before, "wheel changed the value");
  await o.$eval("#budget", (i) => (i.value = ""));
  await o.type("#budget", "4a5");
  assert((await o.$eval("#budget", (i) => i.value)) === "45", "only digits allowed");
  await o.close();
});

await step("content: a blocked custom site goes straight to the block page", async () => {
  const p = await fakePage();
  await p.goto("https://www.youtube.com/gaming");
  await p.waitForFunction((u) => location.href.startsWith(u), { timeout: 8000 }, ext("pages/block.html"));
  await p.waitForFunction(() => document.querySelector("#title").textContent === "You blocked youtube.com/gaming.");
  assert(await visible(p, "#sosBtn"), "emergency pass still offered");
  await p.close();
});

await step("content: custom site gets the pause and a 'Leave' button", async () => {
  const p = await fakePage();
  await p.goto("https://www.youtube.com/feed/trending");
  await p.waitForSelector("#fiayn-pause", { timeout: 8000 });
  assert((await p.$eval("pierce/.close", (b) => b.textContent)) === "Leave youtube.com", "custom leave label");
  await p.goto("https://www.youtube.com/watch?v=1");
  await sleep(1500);
  assert(!(await p.$("#fiayn-pause")), "other paths on that site are not limited");
  await p.close();
});

await step("guide: walkthrough page loads every screenshot", async () => {
  const g = await browser.newPage();
  await g.goto(ext("pages/guide.html"));
  // Images below the fold are lazy; load them all so every one can be checked.
  await g.$$eval("img", (imgs) => imgs.forEach((i) => (i.loading = "eager")));
  await g.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth));
  const broken = await g.$$eval("img", (imgs) => imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute("src")));
  assert(broken.length === 0, `broken images: ${broken.join(", ")}`);
  const split = await g.$$eval(".do li", (lis) => lis.filter((li) => li.querySelector("strong") && li.getBoundingClientRect().height > 30).length);
  assert(split === 0, `${split} list items break onto extra lines`);
  await g.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await g.screenshot({ path: `${SHOTS}/guide.png` });
  await g.close();
});

await step("content: disabled site is not limited", async () => {
  await store.set({ settings: { budgetMinutes: 15, sites: { youtube: true, instagram: false, tiktok: true } } });
  const p = await fakePage();
  await p.goto("https://www.instagram.com/reels/abc/");
  await sleep(2500);
  assert(!(await p.$("#fiayn-pause")), "instagram should not be limited when off");
  await p.goto("https://www.instagram.com/reels/abc/");
  await p.close();
});

await step("pause screen dark mode screenshot", async () => {
  await store.clear();
  const p = await fakePage();
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await p.goto("https://www.youtube.com/shorts/xyz");
  await p.waitForSelector("#fiayn-pause", { timeout: 5000 });
  await sleep(600);
  await p.screenshot({ path: `${SHOTS}/pause-dark.png` });
  await p.setViewport({ width: 390, height: 780 });
  await sleep(300);
  await p.screenshot({ path: `${SHOTS}/pause-phone.png` });
  await p.close();
});

await browser.close();
const failed = results.filter((r) => r[0] === "FAIL");
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
