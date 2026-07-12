let castStoreCatalog = [],
  castModuleCache = {},
  castModuleV = 0,
  castInstalledCache = null;
const CAST_APPS_DIR = "/Apps/cast";
function validCastId(id) {
  return /^[A-Za-z0-9._-]{1,64}$/.test(String(id || ""));
}
function localCastInstalledMap() {
  try {
    return JSON.parse(localStorage.awtrixCastAppManifests || "{}");
  } catch (e) {
    return {};
  }
}
function castInstalledMap() {
  return castInstalledCache || localCastInstalledMap();
}
function castAppIds() {
  return Object.keys(castInstalledMap());
}
function castLocalPath(id, ext) {
  return CAST_APPS_DIR + "/" + id + ext;
}
function normalizeCastManifest(app, id) {
  app = Object.assign({}, app || {});
  app.id = app.id || id;
  if (!validCastId(app.id)) return null;
  let localJs = castLocalPath(app.id, ".js");
  app.entryLocal = app.entryLocal || app.entryUrl || app.entry || localJs;
  if (app.entryLocal !== localJs) app.entryLocal = localJs;
  app.entry = app.entryLocal;
  app.entryUrl = app.entryLocal;
  return app;
}
async function listCastManifestFiles() {
  let r = await fetch("/list?dir=" + encodeURIComponent(CAST_APPS_DIR), {
    cache: "no-store",
  });
  if (!r.ok) throw Error((await r.text()) || "cast list failed");
  let list = await r.json();
  return (Array.isArray(list) ? list : [])
    .filter(
      (f) =>
        f &&
        f.type !== "dir" &&
        /\.json$/i.test(f.name || "") &&
        String(f.name).toLowerCase() !== "apps.json",
    )
    .map((f) => String(f.name));
}
async function readCastManifest(name) {
  let id = String(name).replace(/\.json$/i, ""),
    path = castLocalPath(id, ".json"),
    r = await fetch("/api/files/view?path=" + encodeURIComponent(path), {
      cache: "no-store",
  });
  if (!r.ok) return null;
  let j = JSON.parse(await r.text());
  if (j.binary) return null;
  return normalizeCastManifest(JSON.parse(j.content || "{}"), id);
}
async function loadCastInstalledMap(force) {
  if (castInstalledCache && !force) return castInstalledCache;
  let map = {};
  try {
    let files = await listCastManifestFiles();
    let manifests = await Promise.all(files.map(readCastManifest));
    manifests.filter(Boolean).forEach((app) => {
      map[app.id] = app;
    });
  } catch (e) {
    map = localCastInstalledMap();
  }
  castInstalledCache = map;
  localStorage.awtrixCastAppManifests = JSON.stringify(castInstalledCache);
  localStorage.awtrixCastApps = JSON.stringify(Object.keys(castInstalledCache));
  return castInstalledCache;
}
async function saveCastInstalledMap(map) {
  castInstalledCache = map || {};
  localStorage.awtrixCastAppManifests = JSON.stringify(castInstalledCache);
  localStorage.awtrixCastApps = JSON.stringify(Object.keys(castInstalledCache));
}
function installedCastApps() {
  let map = castInstalledMap();
  return Object.keys(map)
    .map((id) => map[id])
    .filter(Boolean);
}
async function writeCastFile(path, text, type) {
  let blob = new Blob([text], {
      type: type || "text/plain",
    }),
    form = new FormData();
  form.append("file", blob, path.replace(/^\//, ""));
  let r = await fetch("/edit", {
    method: "POST",
    body: form,
  });
  if (!r.ok) throw Error((await r.text()) || "Live file save failed: " + path);
}
async function loadExternalCastModule(app) {
  let url = (app && app.entryLocal) || castLocalPath(app.id, ".js");
  if (!url) throw Error("missing entry");
  let sep = url.includes("?") ? "&" : "?";
  if (!castModuleCache[url])
    castModuleCache[url] = import(url + sep + "v=" + castModuleV);
  return castModuleCache[url];
}
async function openCastApp(id) {
  let map = await loadCastInstalledMap(),
    app = map[id] || castStoreCatalog.find((a) => a.id === id);
  if (!app) return;
  app = normalizeCastManifest(app, id);
  castModuleV++;
  castModuleCache = {};
  try {
    let mod = await loadExternalCastModule(app),
      api = createCastAppApi(app);
    if (mod.main) await mod.main(api, app);
    else throw Error("module missing main()");
  } catch (e) {
    setStatus(E.libraryStatus || E.storeStatus, e.message, true);
  }
}
async function installCastApp(id, btn) {
  if (!validCastId(id)) throw Error("invalid app id");
  let app = castStoreCatalog.find((a) => a.id === id);
  if (!app) return;
  let originalText = btn ? btn.textContent : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = t.installing || originalText;
  }
  try {
    await loadStoreFirmwareVersion();
    if (!isCompatibleVersion(app, storeFirmwareVersion)) throw Error(incompatibleText(app));
    let map = Object.assign({}, await loadCastInstalledMap()),
      manifestUrl = app.manifestUrl || app.manifest,
      base = app.storeBase || storeBase(selectedStoreSource().url),
      manifestBase = base,
      catalogApp = app;
    if (!catalogApp.entryUrl && !catalogApp.entry && manifestUrl) {
      let manifestResolved = resolveStoreUrl(manifestUrl, base),
        manifestRes = await rawFetch(manifestResolved, { cache: "no-store" });
      if (!manifestRes.ok) throw Error("manifest download failed: " + manifestResolved);
      let manifestApp = await manifestRes.json();
      manifestBase = storeBase(manifestResolved);
      catalogApp = Object.assign({}, catalogApp, manifestApp, {
        id: catalogApp.id || manifestApp.id,
        manifestUrl: manifestResolved,
        storeBase: manifestBase,
      });
      if (!validCastId(catalogApp.id)) throw Error("invalid app id");
      if (!isCompatibleVersion(catalogApp, storeFirmwareVersion))
        throw Error(incompatibleText(catalogApp));
    }
    let entryOriginal = catalogApp.entryUrl || catalogApp.entry;
    if (!entryOriginal) throw Error("missing entry");
    let entryResolved = resolveStoreUrl(entryOriginal, catalogApp.entryUrl ? manifestBase : base),
      entryRes = await rawFetch(entryResolved, {
        cache: "no-store",
      });
    if (!entryRes.ok) throw Error("Live JS download failed: " + entryResolved);
    let entryText = await entryRes.text(),
      jsPath = castLocalPath(catalogApp.id, ".js"),
      manifestPath = castLocalPath(catalogApp.id, ".json");
    await writeCastFile(jsPath, entryText, "text/javascript");
    await installIconForApp(catalogApp, catalogApp, manifestBase);
    let installed = normalizeCastManifest(
      Object.assign({}, catalogApp, {
        entry: jsPath,
        entryLocal: jsPath,
        entryUrl: jsPath,
        entryOriginal: entryResolved,
      }),
      catalogApp.id,
    );
    await writeCastFile(
      manifestPath,
      JSON.stringify(installed, null, 2),
      "application/json",
    );
    map[catalogApp.id] = installed;
    await saveCastInstalledMap(map);
    castModuleCache = {};
    castModuleV++;
    if (btn) {
      btn.textContent = t.installed;
      btn.onclick = null;
      btn.classList.remove("primary");
      btn.classList.add("tonal");
      let row = btn.closest(".store-row");
      if (row) row.classList.add("installed");
    }
    renderCastAppStore();
    if (activeLibraryKind === "cast") renderLibrary();
    setStatus(E.storeStatus, castAppName(catalogApp) + " " + t.installed, false);
  } catch (e) {
    setStatus(E.storeStatus, e.message, true);
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}
function uninstallCastApp(id) {
  if (!validCastId(id)) return;
  let map = castInstalledMap(),
    app = map[id],
    name = castAppName(app) || id;
  hideFooterExport();
  currentApp = "__cast_uninstall__";
  E.sheetTitle.textContent = castUi("uninstallTitle");
  E.sheetStatus.textContent = "";
  E.fields.innerHTML = "";
  let section = document.createElement("section"),
    title = document.createElement("h3"),
    hint = document.createElement("p");
  section.className = "settings-card";
  hint.className = "hint";
  title.textContent = name;
  hint.textContent = castUi("uninstallHint");
  section.appendChild(title);
  section.appendChild(hint);
  E.fields.appendChild(section);
  E.secondaryAction.style.display = "";
  E.secondaryAction.textContent = "取消";
  E.secondaryAction.onclick = () => E.sheet.classList.remove("show");
  E.saveSettings.style.display = "";
  E.saveSettings.textContent = "卸载";
  E.saveSettings.onclick = async () => {
    try {
      let next = Object.assign({}, await loadCastInstalledMap());
      delete next[id];
      await Promise.all([
        fetch("/edit?path=" + encodeURIComponent(castLocalPath(id, ".js")), {
          method: "DELETE",
        }).catch((e) => console.warn("Cast file delete failed", e)),
        fetch("/edit?path=" + encodeURIComponent(castLocalPath(id, ".json")), {
          method: "DELETE",
        }).catch((e) => console.warn("Cast file delete failed", e)),
      ]);
      await saveCastInstalledMap(next);
      E.saveSettings.onclick = saveAppSettings;
      E.sheet.classList.remove("show");
      renderLibrary();
      storeLoaded = false;
      if (activeStoreKind === "cast") loadStore();
    } catch (e) {
      setStatus(E.sheetStatus, e.message, true);
    }
  };
  E.sheet.classList.add("show");
}
