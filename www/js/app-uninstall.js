async function uninstallApp(name) {
  hideFooterExport();
  currentApp = "__app_uninstall__";

  E.sheetTitle.textContent = t.uninstallTitle;
  E.sheetStatus.textContent = "";
  E.fields.innerHTML = "";
  let section = document.createElement("section"),
    title = document.createElement("h3"),
    hint = document.createElement("p");
  section.className = "settings-card";
  hint.className = "hint";
  title.textContent = name;
  hint.textContent = t.uninstallConfirmText;
  section.appendChild(title);
  section.appendChild(hint);
  E.fields.appendChild(section);
  E.secondaryAction.style.display = "";
  E.secondaryAction.textContent = t.cancel;
  E.secondaryAction.onclick = () => E.sheet.classList.remove("show");
  E.saveSettings.style.display = "";
  E.saveSettings.textContent = t.uninstall;
  E.saveSettings.onclick = async () => {
    try {
      setStatus(E.libraryStatus, "...", false);
      let response = await fetch("/api/apps/uninstall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      let result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success)
        throw Error(result.error || "uninstall failed");

      E.saveSettings.onclick = saveAppSettings;
      E.sheet.classList.remove("show");
      libraryLoaded = false;
      await loadLibrary();
      storeLoaded = false;
      loadStore();
      setStatus(E.libraryStatus, t.uninstalled + name, false);
    } catch (e) {
      setStatus(E.sheetStatus, e.message, true);
    }
  };
  E.sheet.classList.add("show");
}
