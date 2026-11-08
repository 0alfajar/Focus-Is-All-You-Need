const $ = (id) => document.getElementById(id);

send({ type: "getStatus" }).then((s) => {
  $("goal").textContent = s.settings.goal;
  $("goalBox").hidden = !s.settings.goal;
  $("stat").textContent =
    s.resisted === 1 ? "That's 1 time you left early today." : `That's ${s.resisted} times you left early today.`;
});

// Replace this tab with a fresh one, so the user isn't dropped into whatever tab sits next to it.
$("newTab").addEventListener("click", async () => {
  const tab = await chrome.tabs.getCurrent();
  await chrome.tabs.create({ index: tab ? tab.index : undefined });
  if (tab?.id != null) await chrome.tabs.remove(tab.id);
});

$("close").addEventListener("click", () => send({ type: "closeTab" }));
