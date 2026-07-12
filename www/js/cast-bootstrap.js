function wireKindTabs(box, active, onChange) {
  if (!box) return;
  box.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.kind === active);
    button.onclick = () => {
      onChange(button.dataset.kind);
      wireKindTabs(box, button.dataset.kind, onChange);
    };
  });
}

function renderAppKindTabs() {
  wireKindTabs(E.storeKindTabs, activeStoreKind, (kind) => {
    activeStoreKind = kind;
    let filter = $("storeFilter");
    if (filter) filter.classList.toggle("show", kind !== "cast");
    E.storeGrid.innerHTML = "";
    for (let i = 0; i < 6; i++) {
      let row = document.createElement("div");
      row.className = "store-row";
      row.innerHTML =
        '<div class="app-icon" style="background:var(--chip);animation:pulse 1.2s ease-in-out infinite"></div><div style="width:60%;height:14px;background:var(--chip);border-radius:7px;animation:pulse 1.2s ease-in-out infinite;animation-delay:' +
        i * 0.1 +
        's"></div><div style="width:80%;height:12px;background:var(--chip);border-radius:6px;animation:pulse 1.2s ease-in-out infinite;animation-delay:' +
        i * 0.1 +
        's"></div>';
      E.storeGrid.appendChild(row);
    }
    storeLoaded = false;
    loadStore();
  });

  wireKindTabs(E.libraryKindTabs, activeLibraryKind, (kind) => {
    activeLibraryKind = kind;
    E.libraryList.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      let row = document.createElement("div");
      row.className = "row";
      row.style.cssText = "opacity:.5";
      row.innerHTML =
        '<div style="width:38px;height:38px;border-radius:12px;background:var(--chip);animation:pulse 1.2s ease-in-out infinite;animation-delay:' +
        i * 0.1 +
        's"></div><div style="grid-column:3"><div style="width:60%;height:14px;background:var(--chip);border-radius:7px;animation:pulse 1.2s ease-in-out infinite;animation-delay:' +
        i * 0.1 +
        's;margin-bottom:4px"></div><div style="width:40%;height:12px;background:var(--chip);border-radius:6px;animation:pulse 1.2s ease-in-out infinite;animation-delay:' +
        i * 0.1 +
        's"></div></div>';
      E.libraryList.appendChild(row);
    }
    if (kind === "cast") {
      loadCastInstalledMap()
        .then(() => renderLibrary())
        .catch(() => renderLibrary());
    } else {
      renderLibrary();
    }
  });

  if (E.libraryKindTabs) {
    let actionRow = E.libraryKindTabs.nextElementSibling;
    if (actionRow && actionRow.classList.contains("library-actions")) {
      actionRow.innerHTML = "";
      actionRow.appendChild(E.createApp);
      actionRow.appendChild(E.globalDisplay);
    }
  }
}

function activate(tab, replace) {
  dbg("activate:" + tab);

  let active =
    tab === "settings"
      ? "settings"
      : tab === "library"
        ? "library"
        : tab === "files"
          ? "files"
          : "store";

  E.settingsTab.classList.toggle(
    "active",
    active === "settings" || active === "files",
  );
  if (E.wifiTab) E.wifiTab.classList.remove("active");
  E.storeTab.classList.toggle("active", active === "store");
  E.libraryTab.classList.toggle("active", active === "library");
  if (E.filesTab) E.filesTab.classList.toggle("active", active === "files");

  E.settingsPanel.classList.toggle("active", active === "settings");
  if (E.wifiPanel) E.wifiPanel.classList.remove("active");
  E.storePanel.classList.toggle("active", active === "store");
  E.libraryPanel.classList.toggle("active", active === "library");
  E.filesPanel.classList.toggle("active", active === "files");

  let path =
    active === "settings"
      ? "/settings"
      : active === "library"
        ? "/my-apps"
        : active === "files"
          ? "/files"
          : "/app-store";

  if (location.pathname !== path)
    (replace ? history.replaceState : history.pushState).call(
      history,
      { tab: active },
      "",
      path,
    );

  renderAppKindTabs();

  if (active === "settings") {
    if (settings && Object.keys(settings).length) renderDeviceSettings();
    loadDeviceSettings();
  }
  if (active === "store") {
    let filter = $("storeFilter");
    if (filter) filter.classList.toggle("show", activeStoreKind !== "cast");
    if (!storeLoaded) {
      E.storeGrid.innerHTML = "";
      for (let i = 0; i < 6; i++) {
        let row = document.createElement("div");
        row.className = "store-row";
        row.innerHTML =
          '<div class="app-icon" style="background:var(--chip);animation:pulse 1.2s ease-in-out infinite"></div><div style="width:60%;height:14px;background:var(--chip);border-radius:7px;animation:pulse 1.2s ease-in-out infinite;animation-delay:' +
          i * 0.1 +
          's"></div><div style="width:80%;height:12px;background:var(--chip);border-radius:6px;animation:pulse 1.2s ease-in-out infinite;animation-delay:' +
          i * 0.1 +
          's"></div>';
        E.storeGrid.appendChild(row);
      }
      loadStore();
    }
  }
  if (active === "library" && !libraryLoaded) {
    if (apps && apps.length) renderLibrary();
    else {
      E.libraryList.innerHTML = "";
      for (let i = 0; i < 5; i++) {
        let row = document.createElement("div");
        row.className = "row";
        row.style.cssText = "opacity:.5";
        row.innerHTML =
          '<div style="width:38px;height:38px;border-radius:12px;background:var(--chip);animation:pulse 1.2s ease-in-out infinite;animation-delay:' +
          i * 0.1 +
          's"></div><div style="grid-column:3"><div style="width:60%;height:14px;background:var(--chip);border-radius:7px;animation:pulse 1.2s ease-in-out infinite;animation-delay:' +
          i * 0.1 +
          's;margin-bottom:4px"></div><div style="width:40%;height:12px;background:var(--chip);border-radius:6px;animation:pulse 1.2s ease-in-out infinite;animation-delay:' +
          i * 0.1 +
          's"></div></div>';
        E.libraryList.appendChild(row);
      }
    }
    loadLibrary();
  }
  if (active === "files") {
    if (E.filesSettingsTabs) {
      E.filesSettingsTabs.innerHTML = "";
      renderSettingsTabs(E.filesSettingsTabs);
    }
    if (!filesLoaded) loadFiles("/");
  }
}

function footerExportAction() {
  if (!E.exportAction) {
    let button = document.createElement("button");
    button.className = "tonal footer-export";
    button.type = "button";
    E.exportAction = button;
    E.secondaryAction.after(button);
  }
  return E.exportAction;
}

function hideFooterExport() {
  if (E.exportAction) E.exportAction.style.display = "none";
}
