let libraryLoadRequestId = 0,
  pendingAppToggles = new Map();

function appSettingFields() {
  return {
    Time: [
      ["TFORMAT", t.timeFormat, "text"],
      ["TIME_COL", t.timeColor, "color"],
      ["TMODE", t.timeMode, "select", timeModeOptions()],
      ["NTP Server", t.ntpServer, "text"],
      ["Timezone", t.timezone, "text"],
    ],
    Date: [
      ["DFORMAT", t.dateFormat, "text"],
      ["DATE_COL", t.dateColor, "color"],
      ["CHCOL", t.calendarHeader, "color"],
      ["CTCOL", t.calendarText, "color"],
      ["CBCOL", t.calendarBody, "color"],
      ["SOM", t.startMonday, "checkbox"],
      ["WD", t.weekday, "checkbox"],
      ["WDCA", t.weekdayActive, "color"],
      ["WDCI", t.weekdayInactive, "color"],
    ],
    Temperature: [
      ["TEMP_COL", t.textColor, "color"],
      ["CEL", t.celsius, "checkbox"],
    ],
    Humidity: [["HUM_COL", t.textColor, "color"]],
    Battery: [["BAT_COL", t.textColor, "color"]],
  };
}
function isRefreshableApp(item) {
  return item && (item.type === "custom" || item.type === "flow");
}
function enabledAppPosition(name) {
  let position = 0;
  for (let item of apps) {
    if (appName(item, 0) === name) break;
    position += !item || item.enabled !== false;
  }
  return position;
}
async function loadLibrary(options) {
  let requestId = ++libraryLoadRequestId;
  libraryLoaded = true;
  apps.length && options?.renderCached !== false && renderLibrary();
  try {
    let [appRes, setRes] = await Promise.all([
      fetch("/api/apps", { cache: "no-store" }),
      fetch("/api/settings", { cache: "no-store" }),
    ]);
    let nextApps = await enrichInstalledApps(await appRes.json()),
      nextSettings = await setRes.json();
    if (requestId !== libraryLoadRequestId) return;
    apps = nextApps;
    settings = nextSettings;
    renderLibrary();
  } catch (e) {
    if (requestId !== libraryLoadRequestId) return;
    libraryLoaded = false;
    setStatus(E.libraryStatus, e.message, true);
  }
}

async function enrichInstalledApps(list) {
  return await Promise.all(
    (Array.isArray(list) ? list : []).map(async (item) => {
      if (
        !item ||
        (item.type !== "custom" && item.type !== "flow" && item.type !== "animation")
      )
        return item;
      let key = appName(item, 0),
        saved = await loadSavedCustomPayload(key, null);
      if (!saved) return item;
      let next = mergeLocalizationMetadata(item, saved);
      next.appKey = key;
      next.enabled = item.enabled;
      next.type =
        saved.type === "animation" &&
        ((saved.animation && typeof saved.animation === "object") ||
          (typeof saved.icon === "string" &&
            saved.icon &&
            saved.duration !== undefined))
          ? "animation"
          : item.type;
      if (item.icon !== undefined) next.icon = item.icon;
      return next;
    }),
  );
}

function renderLibrary() {
  renderAppKindTabs();
  if (E.liveAppsPanel) E.liveAppsPanel.style.display = "grid";
  E.libraryList.style.display = "grid";
  E.libraryList.className = activeLibraryKind === "cast" ? "list" : "list";
  if (activeLibraryKind === "cast") {
    E.libraryList.innerHTML = "";
    let list = installedCastApps();
    setStatus(E.libraryStatus, t.count + list.length + t.castCountEnd, false);
    if (!list.length) {
      E.libraryList.innerHTML =
        '<section class="settings-card"><p class="hint">' +
        castUi("empty") +
        "</p></section>";
      return;
    }
    list.forEach((app) => {
      let row = document.createElement("article");
      row.className = "row cast-row";
      row.innerHTML =
        '<div class="app-icon"></div><div><div class="name"></div><div class="meta"></div></div><button class="trash" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg></button><button class="settings-btn" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7-11-7Z"/></svg></button>';
      setIcon(row.querySelector(".app-icon"), app.icon);
      row.querySelector(".name").textContent = castAppName(app);
      row.querySelector(".meta").textContent = castAppDescription(app);
      row.querySelector(".trash").title = t.uninstall;
      row.querySelector(".trash").onclick = (e) => {
        e.stopPropagation();
        uninstallCastApp(app.id);
      };
      row.querySelector(".settings-btn").title = castUi("open");
      row.querySelector(".settings-btn").onclick = (e) => {
        e.stopPropagation();
        openCastApp(app.id);
      };
      row.onclick = () => openCastApp(app.id);
      E.libraryList.appendChild(row);
    });
    return;
  }
  E.libraryList.innerHTML = "";
  let flowApps = apps;
  if (!flowApps.length) {
    setStatus(E.libraryStatus, t.count + 0 + t.countEnd, false);
    return;
  }
  flowApps.forEach((item, index) => {
    let name = appName(item, index),
      localizedName = appDisplayName(item, index),
      pending = pendingAppToggles.has(name),
      enabled = pending ? pendingAppToggles.get(name) : item.enabled !== false,
      row = document.createElement("article");
    row.className = "row" + (enabled ? "" : " disabled");
    row.innerHTML =
      '<div class="handle"><button class="icon-btn up" type="button">▲</button><button class="icon-btn down" type="button">▼</button></div><div class="app-icon"></div><div><div class="name"></div><div class="meta"></div></div><button class="trash" type="button" title="' +
      t.uninstall +
      '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg></button><button class="settings-btn" type="button" title="' +
      t.appSettings +
      '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4ZM13.5 6.5l4 4"/></svg></button><label class="switch"><input type="checkbox"><span class="slider"></span></label>';
    setIcon(row.querySelector(".app-icon"), item.icon || name);
    let suffix =
      item.type === "animation"
        ? "Animation"
        : item.type === "flow"
          ? "Flow"
          : "";
    let displayName = suffix ? localizedName + " · " + suffix : localizedName;
    row.querySelector(".name").textContent = displayName;
    let meta = row.querySelector(".meta");
    meta.textContent = appDisplayDescription(item);
    meta.style.display = meta.textContent ? "block" : "none";
    let settingsBtn = row.querySelector(".settings-btn");
    settingsBtn.onclick = (e) => {
      e.stopPropagation();
      openSettings(name);
    };
    let trash = row.querySelector(".trash");
    trash.classList.toggle(
      "hidden",
      item.type !== "custom" && item.type !== "flow" && item.type !== "animation",
    );
    trash.onclick = (e) => {
      e.stopPropagation();
      if (
        item.type === "custom" ||
        item.type === "flow" ||
        item.type === "animation"
      )
        uninstallApp(name);
    };
    let sw = row.querySelector(".switch"),
      input = row.querySelector("input");
    input.checked = enabled;
    input.disabled = pending;
    sw.onclick = (e) => e.stopPropagation();
    input.onclick = (e) => e.stopPropagation();
    input.onchange = (e) => {
      e.stopPropagation();
      toggleApp(name, e.target.checked);
    };
    row.querySelector(".up").onclick = (e) => {
      e.stopPropagation();
      moveApp(index, -1);
    };
    row.querySelector(".down").onclick = (e) => {
      e.stopPropagation();
      moveApp(index, 1);
    };
    row.onclick = () => openSettings(name);
    E.libraryList.appendChild(row);
  });
  setStatus(E.libraryStatus, t.count + apps.length + t.countEnd, false);
}

async function refreshCustomApp(name, btn, statusEl) {
  statusEl = statusEl || E.libraryStatus;
  setStatus(statusEl, t.updating, false);
  if (btn) btn.disabled = true;
  try {
    let r = await fetch(
      "/api/custom/refresh?name=" + encodeURIComponent(name),
      { method: "POST" },
    );
    if (!r.ok) throw Error("refresh failed");
    setStatus(statusEl, t.updated, false);
  } catch (e) {
    setStatus(statusEl, e.message, true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function moveApp(i, d) {
  let j = i + d;
  if (j < 0 || j >= apps.length) return;
  [apps[i], apps[j]] = [apps[j], apps[i]];
  renderLibrary();
  saveOrder();
}

async function saveOrder() {
  let names = apps
    .filter((a) => a.enabled !== false)
    .map((a, i) => appName(a, i));
  setStatus(E.libraryStatus, t.savingOrder, false);
  try {
    let r = await fetch("/api/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(names),
    });
    if (!r.ok) throw Error("reorder failed");
    setStatus(E.libraryStatus, t.orderSaved, false);
    libraryLoaded = false;
    await loadLibrary();
  } catch (e) {
    setStatus(E.libraryStatus, e.message, true);
  }
}

async function toggleApp(name, show) {
  let item = apps.find((a) => appName(a, 0) === name) || {};
  if (pendingAppToggles.has(name)) return;
  if (show && item.integration === "bilibili" && !String(item.bilibiliUid || "").trim()) {
    openSettings(name);
    setStatus(E.sheetStatus, t.uidRequired, true);
    loadLibrary();
    return;
  }
  pendingAppToggles.set(name, show);
  renderLibrary();
  setStatus(E.libraryStatus, t.updating, false);
  try {
    let key = nativeKeys[name],
      post = async (url, body, error) => {
        let response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw Error(error);
      };
    if (key) await post("/api/settings", { [key]: show }, "settings failed");
    await post(
      "/api/apps",
      [{ name, show, pos: show ? enabledAppPosition(name) : 0 }],
      "app update failed",
    );
    libraryLoaded = false;
    await loadLibrary({ renderCached: false });
    setStatus(E.libraryStatus, t.updated, false);
  } catch (e) {
    setStatus(E.libraryStatus, e.message, true);
    libraryLoaded = false;
    await loadLibrary({ renderCached: false });
  } finally {
    pendingAppToggles.delete(name);
    renderLibrary();
  }
}
