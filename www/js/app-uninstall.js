let regularUninstallDialog = null;

function rerenderRegularUninstallDialog() {
  if (!regularUninstallDialog || currentApp !== "__app_uninstall__") return;
  E.sheetTitle.textContent = t.uninstallTitle;
  regularUninstallDialog.title.textContent = appDisplayName(
    regularUninstallDialog.item,
    0,
  );
  regularUninstallDialog.hint.textContent = t.uninstallConfirmText;
  E.secondaryAction.textContent = t.cancel;
  E.saveSettings.textContent = t.uninstall;
}

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
  let item = (apps || []).find((app) => appName(app, 0) === name) || name;
  title.textContent = appDisplayName(item, 0);
  hint.textContent = t.uninstallConfirmText;
  section.appendChild(title);
  section.appendChild(hint);
  E.fields.appendChild(section);
  E.secondaryAction.style.display = "";
  E.secondaryAction.textContent = t.cancel;
  E.secondaryAction.onclick = () => {
    E.saveSettings.onclick = saveAppSettings;
    E.sheet.classList.remove("show");
  };
  E.saveSettings.style.display = "";
  E.saveSettings.textContent = t.uninstall;
  regularUninstallDialog = { name, item, title, hint };
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
      setStatus(E.libraryStatus, t.uninstalled + appDisplayName(item, 0), false);
    } catch (e) {
      setStatus(E.sheetStatus, e.message, true);
    }
  };
  E.sheet.classList.add("show");
}
