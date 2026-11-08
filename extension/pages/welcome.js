const $ = (id) => document.getElementById(id);
const panels = [...document.querySelectorAll("[data-step]")];
const asides = $("asides").content;
const LAST = panels.length - 1; // the "All set" step
const SETTINGS_STEP = LAST - 1; // finishing this step saves the setup

let step = 0;
let budget = 15;
let finished = false;

function render() {
  panels.forEach((p, i) => (p.hidden = i !== step));
  [...$("steps").children].forEach((li, i) => {
    li.className = i < step ? "done" : i === step ? "current" : "";
  });

  // The "why" note sits next to the active step.
  document.querySelector(".layout aside")?.remove();
  const aside = asides.querySelector(`aside[data-for="${step}"]`);
  if (aside) document.querySelector(".layout").appendChild(aside.cloneNode(true));

  document.querySelectorAll("#presets button").forEach((b) =>
    b.setAttribute("aria-pressed", String(Number(b.dataset.min) === budget)),
  );

  const goal = $("goal").value.trim();
  $("back").hidden = step === 0 || step === LAST;
  $("tryIt").hidden = step !== LAST;
  // On the last step, trying it is the main action; "Done" steps back.
  $("tryIt").className = step === LAST ? "btn" : "btn ghost";
  // Skipping is never the main action, so an empty first step gets a secondary button.
  $("next").className = step === LAST || (step === 0 && !goal) ? "btn ghost" : "btn";
  $("nav").style.flexDirection = step === LAST ? "row-reverse" : "";
  $("nav").style.justifyContent = step === LAST ? "flex-end" : "";
  $("next").disabled = false;
  $("next").textContent =
    step === 0 && !goal ? "Skip" : step === SETTINGS_STEP ? "Finish setup" : step === LAST ? "Done" : "Next";

  if (step === LAST) {
    $("sumGoalRow").hidden = !goal;
    $("sumGoal").textContent = goal;
    $("sumBudget").textContent = budget === 0 ? "No short-form" : plural(budget, "minute") + " a day";
  }
}

function collect() {
  return {
    budgetMinutes: budget,
    sites: {
      youtube: $("w-youtube").checked,
      instagram: $("w-instagram").checked,
      tiktok: $("w-tiktok").checked,
    },
    goal: $("goal").value.trim(),
  };
}

document.addEventListener("click", (e) => {
  const chip = e.target.closest(".chips button");
  if (chip) {
    const target = $(chip.parentElement.dataset.for);
    target.value = chip.textContent;
    target.focus();
    render();
    return;
  }
  const preset = e.target.closest("#presets button");
  if (preset) {
    budget = Number(preset.dataset.min);
    render();
  }
});

document.addEventListener("input", render);
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches("input[type=text]")) $("next").click();
});

// Seeing the pause once right away shows the extension is working.
$("tryIt").addEventListener("click", () => {
  location.href = "https://www.youtube.com/shorts";
});

$("back").addEventListener("click", () => {
  step = Math.max(0, step - 1);
  render();
});

$("next").addEventListener("click", async () => {
  if (step === SETTINGS_STEP) {
    $("next").disabled = true;
    const s = await send({ type: "completeOnboarding", settings: collect() });
    if (s.error && !finished) {
      $("hint").textContent = s.error;
      $("next").disabled = false;
      return;
    }
    finished = true;
  }
  if (step === LAST) {
    await send({ type: "closeTab" });
    return;
  }
  step += 1;
  render();
  $("next").focus();
});

// If setup was already done (e.g. the page was reopened), show the walkthrough instead.
send({ type: "getStatus" }).then((s) => {
  if (s.onboarded && !finished) {
    location.replace(chrome.runtime.getURL("pages/guide.html"));
    return;
  }
  budget = s.settings.budgetMinutes;
  render();
  $("goal").focus();
});
