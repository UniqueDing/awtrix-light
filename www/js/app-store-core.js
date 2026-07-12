const DEFAULT_STORE_SOURCE = {
  name: "awtrix-light",
  url: "http://192.168.31.7:8091/list.json",
};
const STORE_SOURCES_KEY = "awtrixStoreSourcesV2";
const STORE_SELECTED_KEY = "awtrixStoreUrlV2";
const LEGACY_STORE_SOURCES_KEY = "awtrixStoreSources";
const LEGACY_STORE_SELECTED_KEY = "awtrixStoreUrl";
const STORE_MIGRATED_KEY = "awtrixStoreSourcesMigratedV2";
const FALLBACK_STORE_SOURCE = { name: "fallback", url: "/api/app-store" };
let storeFirmwareVersion = "",
  storeLoadRequestId = 0;

function isStaleStoreSource(url) {
  return (
    url === "/list.json" ||
    url === "/api/app-store" ||
    String(url || "").includes("localhost:8091")
  );
}

function normalizeStoreSourceUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function storeSourceKey(url) {
  return normalizeStoreSourceUrl(url);
}

function cleanStoreSource(source) {
  let url = normalizeStoreSourceUrl(source && source.url);
  if (!url || isStaleStoreSource(url)) return null;
  return { name: String(source.name || url).trim() || url, url };
}

function readJsonArrayStorage(key) {
  try {
    let list = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function uniqueCustomStoreSources(list) {
  let seen = new Set([storeSourceKey(DEFAULT_STORE_SOURCE.url)]),
    out = [];
  (Array.isArray(list) ? list : []).forEach((source) => {
    let next = cleanStoreSource(source);
    if (!next || seen.has(storeSourceKey(next.url))) return;
    seen.add(storeSourceKey(next.url));
    out.push(next);
  });
  return out;
}

function readCustomStoreSources() {
  let storedSelected = normalizeStoreSourceUrl(
      localStorage.getItem(STORE_SELECTED_KEY) ||
        localStorage.getItem(LEGACY_STORE_SELECTED_KEY),
    ),
    temporarySelected = normalizeStoreSourceUrl(
      localStorage.getItem("awtrixStoreSourceUrl"),
    ),
    selected = [storedSelected, temporarySelected]
      .filter((url) => url && !isStaleStoreSource(url))
      .map((url) => ({ name: url, url })),
    sources = uniqueCustomStoreSources(
      readJsonArrayStorage(STORE_SOURCES_KEY)
        .concat(readJsonArrayStorage(LEGACY_STORE_SOURCES_KEY))
        .concat(selected),
    );
  if (!storedSelected && temporarySelected && !isStaleStoreSource(temporarySelected))
    localStorage.setItem(STORE_SELECTED_KEY, temporarySelected);
  localStorage.setItem(STORE_MIGRATED_KEY, "1");
  localStorage.setItem(STORE_SOURCES_KEY, JSON.stringify(sources));
  localStorage.removeItem("awtrixStoreSourceUrl");
  return sources;
}

function removeLegacyStoreSourceKey(key) {
  let legacy = uniqueCustomStoreSources(
    readJsonArrayStorage(LEGACY_STORE_SOURCES_KEY),
  ).filter((source) => storeSourceKey(source.url) !== key);
  localStorage.setItem(LEGACY_STORE_SOURCES_KEY, JSON.stringify(legacy));
  if (storeSourceKey(localStorage.getItem(LEGACY_STORE_SELECTED_KEY)) === key)
    localStorage.removeItem(LEGACY_STORE_SELECTED_KEY);
}

function writeCustomStoreSources(custom, selectedUrl) {
  let clean = uniqueCustomStoreSources(custom),
    selected =
      normalizeStoreSourceUrl(selectedUrl || DEFAULT_STORE_SOURCE.url) ||
      DEFAULT_STORE_SOURCE.url;
  localStorage.setItem(STORE_SOURCES_KEY, JSON.stringify(clean));
  localStorage.setItem(STORE_SELECTED_KEY, selected);
  return clean;
}

function storeSources() {
  return [DEFAULT_STORE_SOURCE].concat(readCustomStoreSources());
}

function selectedStoreSource() {
  let sources = storeSources(),
    url = normalizeStoreSourceUrl(
      localStorage.getItem(STORE_SELECTED_KEY) ||
        localStorage.getItem(LEGACY_STORE_SELECTED_KEY),
    );
  if (isStaleStoreSource(url)) {
    localStorage.removeItem(STORE_SELECTED_KEY);
    localStorage.removeItem(LEGACY_STORE_SELECTED_KEY);
    url = "";
  }
  return (
    sources.find((source) => storeSourceKey(source.url) === storeSourceKey(url)) ||
    sources[0]
  );
}

function addStoreSource(source) {
  let next = cleanStoreSource(source);
  if (!next) return;
  let key = storeSourceKey(next.url),
    custom = readCustomStoreSources().filter(
      (source) => storeSourceKey(source.url) !== key,
    );
  custom.push(next);
  writeCustomStoreSources(custom, next.url);
}

function storeManifestUrl(url) {
  let source = String(url || DEFAULT_STORE_SOURCE.url),
    match = source.match(/^https:\/\/github\.com\/([^/?#]+)\/([^/?#]+)\/?$/);
  return match
    ? "https://raw.githubusercontent.com/" + match[1] + "/" + match[2] + "/main/list.json"
    : source;
}

function storeLoadFailedMessage() {
  return t.storeLoadFailed;
}

async function readStoreJson(res) {
  if (!res || !res.ok) throw Error(storeLoadFailedMessage());
  return await res.json();
}

async function loadStoreManifest(url) {
  try {
    let res = await fetch(url, { cache: "no-store" });
    return { data: await readStoreJson(res), url };
  } catch (e) {
    if (url === FALLBACK_STORE_SOURCE.url) throw e;
    let res = await fetch(FALLBACK_STORE_SOURCE.url, { cache: "no-store" });
    return { data: await readStoreJson(res), url: FALLBACK_STORE_SOURCE.url };
  }
}

async function loadStoreFirmwareVersion() {
  if (storeFirmwareVersion) return storeFirmwareVersion;
  try {
    let res = await fetch("/version", { cache: "no-store" });
    if (res.ok) storeFirmwareVersion = (await res.text()).trim();
  } catch (e) {
    console.warn("Firmware version unavailable", e);
  }
  return storeFirmwareVersion;
}

function absoluteStoreUrl(url) {
  return new URL(storeManifestUrl(url), location.href).href;
}

function storeBase(url) {
  return url === "/api/app-store"
    ? location.origin + "/app-store/"
    : new URL(".", absoluteStoreUrl(url)).href;
}

function resolveStoreUrl(path, base) {
  let p = String(path || "");
  if (/^https?:\/\//.test(p)) return p;
  if (p.startsWith("/")) p = p.slice(1);
  return new URL(p, base || location.origin + "/").href;
}

function normalizeLiveStoreList(data, base) {
  let grouped = data && data.apps && !Array.isArray(data.apps) ? data.apps : {},
    list = grouped.live || [];
  return list.map((app) => {
    let next = Object.assign({}, app);
    next.storeBase = base;
    if (next.manifest) next.manifestUrl = resolveStoreUrl(next.manifest, base);
    if (next.entry) next.entryUrl = resolveStoreUrl(next.entry, base);
    return next;
  });
}

function normalizeStoreList(data) {
  let grouped = data && data.apps && !Array.isArray(data.apps) ? data.apps : {};
  return {
    flow: grouped.flow || [],
    animation: grouped.animation || [],
  };
}

function renderStoreSourceBar() {
  if (!E.storeSourceSlot) return;
  let sources = storeSources(),
    selected = selectedStoreSource(),
    selectedKey = storeSourceKey(selected.url),
    bar = document.createElement("section");
  bar.className = "store-source-bar";
  bar.innerHTML =
    '<div class="store-source-picker" id="storeSourcePicker"><button id="storeSourceToggle" class="store-source-toggle" type="button" aria-haspopup="listbox" aria-expanded="false"><span class="store-source-current"></span><span class="store-source-caret" aria-hidden="true">⌄</span></button><div class="store-source-list" role="listbox" hidden></div></div><button id="storeAddSource" class="tonal" type="button"></button>';
  let picker = bar.querySelector("#storeSourcePicker"),
    toggle = bar.querySelector("#storeSourceToggle"),
    current = bar.querySelector(".store-source-current"),
    list = bar.querySelector(".store-source-list"),
    add = bar.querySelector("#storeAddSource"),
    docClick,
    close = () => {
      list.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      document.removeEventListener("click", docClick);
    },
    open = () => {
      list.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      document.removeEventListener("click", docClick);
      document.addEventListener("click", docClick);
    },
    selectSource = (source) => {
      localStorage.setItem(STORE_SELECTED_KEY, source.url);
      close();
      storeLoaded = false;
      loadStore();
    };
  docClick = (event) => {
    if (!picker.contains(event.target)) close();
  };
  current.textContent = selected.name || selected.url;
  add.textContent = "+";
  add.title = t.addSource;
  add.setAttribute("aria-label", t.addSource);
  sources.forEach((source, index) => {
    let key = storeSourceKey(source.url),
      custom = key !== storeSourceKey(DEFAULT_STORE_SOURCE.url),
      row = document.createElement("button"),
      text = document.createElement("span");
    row.type = "button";
    row.className =
      "store-source-row" +
      (key === selectedKey ? " active" : "") +
      (custom ? "" : " no-delete");
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", key === selectedKey ? "true" : "false");
    text.className = "store-source-text";
    text.textContent = index + 1 + ". " + (source.name || source.url);
    row.appendChild(text);
    if (custom) {
      let remove = document.createElement("span");
      remove.className = "store-source-delete";
      remove.setAttribute("aria-label", t.removeSource);
      remove.title = t.removeSource;
      remove.textContent = "×";
      remove.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        close();
        removeStoreSource(source.url);
      };
      row.appendChild(remove);
    }
    row.onclick = () => selectSource(source);
    list.appendChild(row);
  });
  toggle.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (list.hidden) open();
    else close();
  };
  picker.onclick = (event) => event.stopPropagation();
  add.onclick = openStoreSourceDialog;
  if (E.storeSourceSlot._storeSourceClose) E.storeSourceSlot._storeSourceClose();
  E.storeSourceSlot._storeSourceClose = close;
  E.storeSourceSlot.innerHTML = "";
  E.storeSourceSlot.appendChild(bar);
}

function removeStoreSource(url) {
  let key = storeSourceKey(url);
  if (!key || key === storeSourceKey(DEFAULT_STORE_SOURCE.url)) return;
  if (!confirm(t.confirmRemoveSource)) return;
  removeLegacyStoreSourceKey(key);
  let custom = readCustomStoreSources().filter(
      (source) => storeSourceKey(source.url) !== key,
    ),
    selected = selectedStoreSource(),
    nextSelected =
      storeSourceKey(selected.url) === key ? DEFAULT_STORE_SOURCE.url : selected.url;
  writeCustomStoreSources(custom, nextSelected);
  renderStoreSourceBar();
  storeLoaded = false;
  loadStore();
}

function openStoreSourceDialog() {
  hideFooterExport();
  E.secondaryAction.style.display = "";
  E.secondaryAction.textContent = t.cancel;
  E.secondaryAction.onclick = () => E.sheet.classList.remove("show");
  E.saveSettings.style.display = "";
  E.saveSettings.textContent = t.addSource;
  currentApp = "__store_source__";
  E.sheetTitle.textContent = t.addSource;
  E.sheetStatus.textContent = "";
  E.fields.innerHTML =
    '<div class="field"><label>' +
    t.sourceName +
    '</label><input id="storeSourceName" type="text"></div><div class="field"><label>' +
    t.sourceUrl +
    '</label><input id="storeSourceUrl" type="url"></div>';
  E.sheet.classList.add("show");
}

function saveStoreSourceDialog() {
  let name = ($("storeSourceName").value || "").trim(),
    url = ($("storeSourceUrl").value || "").trim();
  if (!url) {
    setStatus(E.sheetStatus, t.sourceUrl, true);
    return;
  }
  try {
    new URL(url);
  } catch (e) {
    setStatus(E.sheetStatus, t.invalidJson, true);
    return;
  }
  addStoreSource({ name: name || url, url });
  E.sheet.classList.remove("show");
  renderStoreSourceBar();
  setStatus(E.storeStatus, (lang === "zh" ? "已添加源" : "Source added") + " - " + url, false);
  storeLoaded = false;
  loadStore();
}
