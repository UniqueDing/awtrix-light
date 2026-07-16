#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const zlib = require("node:zlib");

function source(name) {
  return fs.readFileSync("www/js/" + name, "utf8");
}

function testGeneratedUiHasNoDebugBadge() {
  const markers = [
    "DBG-20260701-2105",
    "DBG-20260701-2052",
    "UI_DEBUG_BUILD",
    "debugBuildBadge",
    "showDebugBuildBadge",
  ];
  const assets = [
    "www/app.css.min",
    "www/app.js.min",
    "awtrix3/www/app.css.min",
    "awtrix3/www/app.js.min",
  ];
  for (const asset of assets) {
    const content = fs.readFileSync(asset, "utf8");
    for (const marker of markers)
      assert.equal(content.includes(marker), false, `${asset} contains ${marker}`);
  }

  const header = fs.readFileSync("awtrix3/src/web_assets.h", "utf8");
  const bytes = [...header.matchAll(/0x([0-9a-f]{2})/gi)].map((match) => Number.parseInt(match[1], 16));
  const shell = zlib.gunzipSync(Buffer.from(bytes)).toString("utf8");
  for (const marker of markers)
    assert.equal(shell.includes(marker), false, `embedded app shell contains ${marker}`);
}

function load(code, extra) {
  const context = Object.assign(
    {
      console,
      Promise,
      Object,
      Array,
      Set,
      String,
      Number,
      Error,
      JSON,
      encodeURIComponent,
      localStorage: {},
      window: {},
    },
    extra || {},
  );
  vm.createContext(context);
  vm.runInContext(code, context);
  return context;
}

class TestElement {
  constructor(tagName) {
    this.tagName = String(tagName || "div").toUpperCase();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.className = "";
    this.textContent = "";
    this.value = "";
    this.checked = false;
    this.options = [];
    this.attributes = {};
    this.classList = {
      add: (...names) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        names.forEach((name) => classes.add(name));
        this.className = [...classes].join(" ");
      },
      remove: (...names) => {
        const removed = new Set(names);
        this.className = this.className
          .split(/\s+/)
          .filter((name) => name && !removed.has(name))
          .join(" ");
      },
      contains: (name) => this.className.split(/\s+/).includes(name),
      toggle: (name, force) => {
        const enabled = force === undefined ? !this.classList.contains(name) : !!force;
        if (enabled) this.classList.add(name);
        else this.classList.remove(name);
        return enabled;
      },
    };
  }
  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    if (this.tagName === "SELECT" && child.tagName === "OPTION") this.options.push(child);
    return child;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const descendants = [];
    const visit = (node) => {
      node.children.forEach((child) => { descendants.push(child); visit(child); });
    };
    visit(this);
    const dataMatch = selector.match(/^\[data-([a-z-]+)(?:="([^"]*)")?\]$/);
    if (dataMatch) {
      const key = dataMatch[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return descendants.filter((node) =>
        node.dataset[key] !== undefined &&
        (dataMatch[2] === undefined || node.dataset[key] === dataMatch[2]));
    }
    if (selector === "input,select")
      return descendants.filter((node) => node.tagName === "INPUT" || node.tagName === "SELECT");
    if (selector === "[data-field-key]")
      return descendants.filter((node) => node.dataset.fieldKey !== undefined);
    if (selector === ".field-title") return descendants.filter((node) => node.className === "field-title");
    if (selector === ".advanced-settings summary") return descendants.filter((node) => node.tagName === "SUMMARY");
    if (selector === ".segmented button") return descendants.filter((node) => node.tagName === "BUTTON");
    if (/^(\.[a-z0-9_-]+)+$/i.test(selector)) {
      const classes = selector.slice(1).split(".");
      return descendants.filter((node) =>
        classes.every((name) => node.classList.contains(name)));
    }
    if (/^[a-z]+$/i.test(selector))
      return descendants.filter((node) => node.tagName === selector.toUpperCase());
    return [];
  }
  set innerHTML(value) {
    assert.equal(value, "", "tests only allow clearing DOM with innerHTML");
    this.children = [];
  }
  get innerHTML() { return ""; }
}

function testDocument() {
  const byId = {};
  return {
    byId,
    createElement(tag) {
      const element = new TestElement(tag);
      Object.defineProperty(element, "id", {
        get() { return this._id || ""; },
        set(value) { this._id = String(value); byId[this._id] = this; },
      });
      return element;
    },
    getElementById(id) { return byId[id] || null; },
  };
}

function helperContext() {
  return load(
    "let lang = 'zh';\n" +
      source("app-common.js") +
      "\n" +
      source("cast-labels.js") +
      "\nthis.api={setLang:v=>lang=v,appName,appDisplayName,appDisplayDescription,localizedField,localizedSearchText,castAppName,castAppDescription,mergeLocalizationMetadata};",
  ).api;
}

function testUnifiedFallbacksAndIdentity() {
  const api = helperContext();
  const objectApp = {
    id: "clock-key",
    appKey: "clock-key",
    name: { en: "Clock", zh: "时钟" },
    description: { en: "Time", zh: "时间" },
  };
  assert.equal(api.appName(objectApp, 0), "clock-key");
  assert.equal(api.appDisplayName(objectApp, 0), "时钟");
  assert.equal(api.appDisplayDescription(objectApp), "时间");
  api.setLang("en");
  assert.equal(api.appDisplayName(objectApp, 0), "Clock");

  const legacy = {
    name: "bilibili-followers",
    "name-cn": "B站粉丝数",
    description: "Followers",
    "description-cn": "粉丝数",
  };
  api.setLang("zh");
  assert.equal(api.appName(legacy, 0), "bilibili-followers");
  assert.equal(api.appDisplayName(legacy, 0), "B站粉丝数");
  assert.equal(api.appDisplayDescription(legacy), "粉丝数");
  assert.equal(api.localizedField({ label: "UID", "label-cn": "用户ID" }, "label", "id"), "用户ID");
  api.setLang("en");
  assert.equal(api.appDisplayName(legacy, 0), "bilibili-followers");
  assert.equal(api.localizedField({ label: "UID", "label-cn": "用户ID" }, "label", "id"), "UID");

  const mixed = { name: { en: "English" }, "name-cn": "中文别名" };
  api.setLang("zh");
  assert.equal(api.appDisplayName(mixed, 0), "中文别名", "active Chinese alias beats object English fallback");
  const documented = {
    id: "documented",
    name: "Fallback",
    name_i18n: { en: "Documented", zh: "文档名称" },
    description_i18n: { en: "English description", zh: "中文描述" },
  };
  assert.equal(api.appDisplayName(documented, 0), "文档名称");
  assert.equal(api.appDisplayDescription(documented), "中文描述");
  assert.ok(api.localizedSearchText(documented).includes("documented"));
  assert.ok(api.localizedSearchText(documented).includes("english description"));
  assert.ok(api.localizedSearchText(documented).includes("中文描述"));
}

function testRegularCatalogDescriptionsMatchManifests() {
  const catalogPath = "app-store/list.json";
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

  for (const type of ["flow", "animation"]) {
    for (const app of catalog.apps[type]) {
      if (!app.description) continue;
      assert.equal(typeof app["description-cn"], "string", `${type}/${app.id} has a Chinese description`);
      assert.notEqual(app["description-cn"].trim(), "", `${type}/${app.id} Chinese description is nonempty`);

      const manifestPath = "app-store/" + app.manifest;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (manifest["description-cn"] !== undefined)
        assert.equal(app["description-cn"], manifest["description-cn"], `${type}/${app.id} matches its manifest`);
    }
  }
}

function testStoreAndInstalledLabels() {
  const api = helperContext();
  const regularStore = { id: "demo", name: "demo", "name-cn": "演示", description: "Demo", "description-cn": "演示描述" };
  const liveStore = { id: "timer", name: { en: "Timer", zh: "计时器" }, description: { en: "Count", zh: "计时" } };
  const installedRegular = Object.assign({ appKey: "demo", enabled: true, type: "flow" }, regularStore);
  const installedLive = { id: "stopwatch", name: "Stopwatch", "name-cn": "秒表", description: "Count", "description-cn": "计时" };
  assert.equal(api.appDisplayName(regularStore, 0), "演示");
  assert.equal(api.appName(installedRegular, 0), "demo");
  assert.equal(api.appDisplayName(installedRegular, 0), "演示");
  assert.equal(api.castAppName(liveStore), "计时器");
  assert.equal(api.castAppName(installedLive), "秒表");
  assert.equal(api.castAppDescription(installedLive), "计时");
  api.setLang("en");
  assert.equal(api.appDisplayName(regularStore, 0), "demo");
  assert.equal(api.castAppName(liveStore), "Timer");
  assert.equal(api.castAppName(installedLive), "Stopwatch");
}

function testLanguageRerenderDispatch() {
  const calls = [];
  const context = load(
    "const I={zh:{langCode:'zh-CN'},en:{langCode:'en'}};" +
      "let storeLoaded=true,libraryLoaded=true,activeStoreKind='app';" +
      "let E={sheet:{classList:{contains:()=>true}}};" +
      "let document={documentElement:{},querySelectorAll:()=>[]};" +
       "function $(id){return null} function refreshCastLabels(){calls.push('labels')}" +
       "function renderCastAppStore(){calls.push('cast-store')} function renderLibrary(){calls.push('library')}" +
       "function rerenderRegularSettingsDialog(){calls.push('settings-dialog')}" +
       "function rerenderRegularUninstallDialog(){calls.push('app-uninstall')}" +
       "function rerenderCastUninstallDialog(){calls.push('cast-uninstall')}" +
       "let rerenderRegularStore=()=>calls.push('app-store');" +
      source("i18n-runtime.js") +
      "\nthis.run=rerenderLocalizedUi;",
    { calls },
  );
  context.window.currentCastAppApi = { rerenderDialog: () => calls.push("dialog") };
  context.run();
  assert.deepEqual(calls, [
    "labels", "app-store", "library", "settings-dialog", "app-uninstall",
    "cast-uninstall", "dialog",
  ]);
}

function testStoreSearchPlaceholderRelabelsWithoutChangingValue() {
  const I = JSON.parse(fs.readFileSync("www/i18n.json", "utf8"));
  const input = new TestElement("input");
  input.id = "storeSearchInput";
  input.dataset.placeholder = "storeSearchPlaceholder";
  input.placeholder = "";
  input.value = "weather";
  const document = {
    documentElement: {},
    querySelectorAll(selector) {
      if (selector === "[data-placeholder]") return [input];
      return [];
    },
  };
  const context = load(
    "let E={sheet:{classList:{contains:()=>false}}};" +
      "function $(id){return null}" +
      source("i18n-runtime.js") +
      "\nthis.api={applyLang,setLang:(value)=>{lang=value}};",
    { document, I, localStorage: {} },
  );

  assert.match(
    fs.readFileSync("www/app.html", "utf8"),
    /id="storeSearchInput"[^>]*data-placeholder="storeSearchPlaceholder"/,
  );
  context.api.applyLang();
  assert.equal(input.placeholder, "搜索 App...");
  assert.equal(input.value, "weather");
  context.api.setLang("en");
  context.api.applyLang();
  assert.equal(input.placeholder, "Search Apps...");
  assert.equal(input.value, "weather");
}

function testInstallMergeLocalization() {
  const api = helperContext();
  let merged = api.mergeLocalizationMetadata(
    { id: "stopwatch", name: "Stopwatch", description: "Count" },
    { name: { en: "Stopwatch", zh: "秒表" }, description: { en: "Count", zh: "计时" } },
  );
  assert.equal(merged.name, "Stopwatch");
  assert.equal(merged["name-cn"], "秒表");
  assert.equal(merged.description, "Count");
  assert.equal(merged["description-cn"], "计时");

  merged = api.mergeLocalizationMetadata(
    { name: "Stopwatch", "name-cn": "旧秒表" },
    { name: { en: "Timer", zh: "新秒表" } },
  );
  assert.equal(merged.name, "Stopwatch");
  assert.equal(merged["name-cn"], "旧秒表");
}

function testLegacyLiveDialogRerender() {
  const document = testDocument();
  const fields = document.createElement("div");
  const context = load(
    "let lang='zh',t={settings:'设置'},currentApp=null;" +
      source("app-common.js") +
      source("cast-runtime.js") +
      "\nthis.api={createCastAppApi,setLang:v=>{lang=v;t={settings:v==='zh'?'设置':'Settings'}}};",
    {
      document,
      E: {
        sheetTitle: { textContent: "" },
        sheetStatus: { textContent: "" },
        secondaryAction: { style: {} },
        saveSettings: { style: {} },
        fields,
        sheet: { classList: { add() {}, remove() {} } },
      },
      hideFooterExport() {},
      setStatus() {},
      runtimeTransport: {
        disableButtons() {},
        enableButtons() {},
        claim() {},
        frame() {},
        release() {},
        isWebSocket() {},
        unloadRelease() {},
      },
      window: { addEventListener() {} },
      setTimeout() {},
      clearTimeout() {},
    },
  );
  const app = {
    id: "stopwatch",
    name: "Stopwatch",
    "name-cn": "秒表",
    description: "Count upward",
    "description-cn": "正向计时",
  };
  const api = context.api.createCastAppApi(app);
  api.renderDialog({ title: app.name, hint: app.description, controls: [] });
  assert.equal(context.E.sheetTitle.textContent, "秒表");
  context.api.setLang("en");
  api.rerenderDialog();
  assert.equal(context.E.sheetTitle.textContent, "Stopwatch");
}

function testLiveDialogUsesTextAndValidIds() {
  const document = testDocument();
  const fields = document.createElement("div");
  const context = load(
    "let lang='en',t={settings:'Settings'},currentApp=null;" +
      source("app-common.js") + source("cast-labels.js") + source("cast-runtime.js") +
      "\nthis.create=createCastAppApi;",
    {
      document,
      E: {
        sheetTitle: { textContent: "" }, sheetStatus: { textContent: "" },
        secondaryAction: { style: {} }, saveSettings: { style: {} }, fields,
        sheet: { classList: { add() {}, remove() {} } },
      },
      hideFooterExport() {}, setStatus() {},
      runtimeTransport: { disableButtons() {}, enableButtons() {}, claim() {}, frame() {}, release() {}, isWebSocket() {}, unloadRelease() {} },
      window: { addEventListener() {} }, setTimeout() {}, clearTimeout() {},
    },
  );
  const hostile = '<img src=x onerror="boom">';
  const api = context.create({ id: "safe", name: "Safe" });
  api.renderDialog({
    title: hostile,
    hint: hostile,
    display: { type: "text", id: "display", initial: hostile },
    controls: [{ id: "start", label: hostile }],
    config: [{ id: "minutes", label: hostile, value: hostile }],
  });
  assert.equal(context.E.sheetTitle.textContent, hostile);
  assert.equal(fields.querySelector("[data-cast-hint]").textContent, hostile);
  assert.equal(document.getElementById("__cast_disp_display").textContent, hostile);
  assert.equal(api._controlElements.start.textContent, hostile);
  assert.equal(api._configLabels.minutes.textContent, hostile);
  assert.equal(api._configElements.minutes.value, hostile);
  assert.equal(fields.children.length, 2, "hostile markup creates no extra DOM nodes");
  assert.throws(() => api.renderDialog({ controls: [{ id: 'bad"]', label: "Bad" }] }), /invalid component id/);
}

function testTopLevelCastApps() {
  const context = load(
    source("app-store-core.js") + "\nthis.normalize=normalizeLiveStoreList;",
    { t: {}, URL, location: { href: "http://device/", origin: "http://device" } },
  );
  const top = context.normalize({ castApps: [{ id: "top", entry: "top.js" }] }, "http://store/");
  assert.equal(top.length, 1);
  assert.equal(top[0].id, "top");
  assert.equal(top[0].entryUrl, "http://store/top.js");
  const grouped = context.normalize({ apps: { live: [{ id: "grouped" }] } }, "http://store/");
  assert.equal(grouped[0].id, "grouped");
  const both = context.normalize({
    apps: { live: [{ id: "grouped" }] },
    castApps: [{ id: "top" }, { id: "grouped", name: "duplicate" }],
  }, "http://store/");
  assert.deepEqual(Array.from(both, (app) => app.id), ["grouped", "top"]);
}

async function testStableInstallId() {
  const requests = [];
  const errors = [];
  const context = load(
    source("app-store-render.js") + "\nthis.install=installApp;",
    {
      E: { storeStatus: {} }, t: { installed: "Installed", installing: "Installing" },
      loadStoreFirmwareVersion: async () => "", isCompatibleVersion: () => true,
      storeFirmwareVersion: "",
      rawFetch: async () => ({ ok: true, json: async () => ({ name: "downloaded-name" }) }),
      installIconForApp: async () => {}, storeBase: () => "http://store/",
      mergeLocalizationMetadata: (payload) => payload,
      withDisplayCompatibility: (payload) => payload,
      fetch: async (url) => { requests.push(url); return { ok: true }; },
      setStatus(_element, message, error) { if (error) errors.push(message); },
      appDisplayName: () => "Catalog label", libraryLoaded: true,
    },
  );
  assert.equal(await context.install({ id: "stable-id", manifestUrl: "manifest.json" }, null, "fallback", true), true, errors.join(", "));
  assert.equal(requests[0], "/api/custom?name=stable-id&save=1");
}

async function testInstalledEnrichmentIsNarrowAndPreservesAnimation() {
  const context = load(
    source("app-common.js") + source("app-library.js") + "\nthis.enrich=enrichInstalledApps;",
    {
      lang: "en",
      loadSavedCustomPayload: async (key) =>
        key === "anim-id"
          ? {
              name_i18n: { en: "Animation", zh: "动画" },
              animation: { fps: 12 },
              display: { duration: 5 },
              inputs: [{ id: "token", value: "input-secret" }],
              sources: [{ id: "private", interval: 60, token: "source-secret" }],
              integration: "bilibili",
              bilibiliUid: "private-uid",
              enabled: false,
              type: "animation",
              icon: "saved-icon",
              secret: "must-not-leak",
              otherSetting: "also-private",
            }
          : { type: "animation", name_i18n: { en: "Not Animation" } },
    },
  );
  const result = await context.enrich([
    { name: "anim-id", type: "custom", enabled: true, icon: "api-icon" },
    { name: "no-schema", type: "custom", enabled: false },
  ]);
  assert.equal(result[0].appKey, "anim-id");
  assert.equal(context.appName(result[0], 0), "anim-id");
  assert.equal(result[0].type, "animation");
  assert.equal(result[0].enabled, true);
  assert.equal(result[0].icon, "api-icon");
  assert.equal(result[0].secret, undefined);
  assert.equal(result[0].inputs, undefined);
  assert.equal(result[0].sources, undefined);
  assert.equal(result[0].display, undefined);
  assert.equal(result[0].animation, undefined);
  assert.equal(result[0].integration, undefined);
  assert.equal(result[0].bilibiliUid, undefined);
  assert.equal(result[0].otherSetting, undefined);
  assert.equal(result[0].name_i18n.zh, "动画");
  assert.equal(result[1].type, "custom", "saved animation type requires animation schema");
  assert.equal(result[1].appKey, "no-schema");
}

function testRegularDialogRelabelPreservesValue() {
  const document = testDocument();
  const fields = document.createElement("div");
  const wrap = document.createElement("div");
  wrap.dataset.fieldKey = "input_uid";
  const label = document.createElement("label");
  label.className = "field-title";
  label.textContent = "UID";
  const help = document.createElement("button");
  help.dataset.fieldHelp = "1";
  const input = document.createElement("input");
  input.value = "unsaved-123";
  wrap.appendChild(label);
  wrap.appendChild(help);
  wrap.appendChild(input);
  fields.appendChild(wrap);
  const item = {
    appKey: "demo-id",
    type: "custom",
    name_i18n: { en: "Demo", zh: "演示" },
    inputs: [{ id: "uid", label_i18n: { en: "User ID", zh: "用户 ID" }, description_i18n: { en: "Account", zh: "账号" } }],
  };
  const context = load(
    "let lang='zh',currentApp='demo-id',t={appSettings:'设置',saveSettings:'保存',editApp:'编辑',refresh:'刷新',exportJson:'导出',commonSettings:'通用',noFields:'无字段',uid:'UID',interval:'间隔',repeatCount:'重复',duration:'时长'};" +
      "function appSettingFields(){return {}} function settingsDisplayFields(){return []}" +
      "function boolOptions(){return []} function openCreateApp(){} function refreshCustomApp(){}" +
      source("app-common.js") + source("app-settings-dialog.js") +
      "\nregularSettingsDialog={name:'demo-id',item:testItem};this.run=rerenderRegularSettingsDialog;",
    {
      testItem: item,
      document,
      E: {
        fields,
        sheetTitle: { textContent: "" },
        saveSettings: { textContent: "" },
        secondaryAction: { textContent: "" },
        exportAction: null,
      },
    },
  );
  context.run();
  assert.equal(input.value, "unsaved-123");
  assert.equal(label.textContent, "用户 ID");
  assert.equal(help.title, "账号");
  assert.equal(context.E.sheetTitle.textContent, "演示 设置");
  assert.equal(context.E.saveSettings.textContent, "保存");
  assert.equal(context.E.secondaryAction.textContent, "编辑");
}

function testUninstallLabelsKeepCanonicalIds() {
  const document = testDocument();
  const regularRequests = [];
  const E = {
    sheetTitle: { textContent: "" }, sheetStatus: { textContent: "" },
    fields: document.createElement("div"), secondaryAction: { style: {}, textContent: "" },
    saveSettings: { style: {}, textContent: "" },
    sheet: { classList: { add() {}, remove() {} } }, libraryStatus: {},
  };
  const context = load(
    "let lang='zh',currentApp=null,apps=[{appKey:'stable-id',name:'English',name_i18n:{zh:'中文名称',en:'English'},type:'flow'}],libraryLoaded=true,storeLoaded=true;" +
      "let t={uninstallTitle:'卸载应用',uninstallConfirmText:'确认卸载',cancel:'取消',uninstall:'卸载',uninstalled:'已卸载：'};" +
      "function hideFooterExport(){} function saveAppSettings(){} function setStatus(){} function loadLibrary(){} function loadStore(){}" +
      source("app-common.js") + source("app-uninstall.js") +
      "\nthis.open=uninstallApp;this.getCurrent=()=>currentApp;",
    {
      document, E,
      fetch: async (url, options) => {
        regularRequests.push({ url, body: options && options.body });
        return { ok: true, json: async () => ({ success: true }) };
      },
    },
  );
  context.open("stable-id");
  assert.equal(E.fields.querySelector("h3"), null);
  assert.equal(E.fields.children[0].children[0].textContent, "中文名称");
  assert.equal(E.secondaryAction.textContent, "取消");
  assert.equal(E.saveSettings.textContent, "卸载");
  E.saveSettings.onclick();
  assert.equal(JSON.parse(regularRequests[0].body).name, "stable-id");
}

async function testLiveUninstallLabelsKeepCanonicalId() {
  const document = testDocument();
  const requests = [];
  const E = {
    sheetTitle: { textContent: "" }, sheetStatus: { textContent: "" },
    fields: document.createElement("div"), secondaryAction: { style: {}, textContent: "" },
    saveSettings: { style: {}, textContent: "" },
    sheet: { classList: { add() {}, remove() {} } },
  };
  const context = load(
    "let lang='en',t={cancel:'Cancel',uninstall:'Uninstall'},currentApp=null;" +
      "function hideFooterExport(){} function saveAppSettings(){} function setStatus(){} function renderLibrary(){} function loadStore(){}" +
      source("app-common.js") + source("cast-labels.js") + source("cast-files-install.js") +
      "\ncastInstalledCache={'live-id':{id:'live-id',name_i18n:{en:'Live Label',zh:'直播标签'}}};this.open=uninstallCastApp;",
    {
      document, E,
      fetch: async (url) => { requests.push(url); return { ok: true }; },
    },
  );
  context.open("live-id");
  assert.equal(E.fields.children[0].children[0].textContent, "Live Label");
  assert.equal(E.secondaryAction.textContent, "Cancel");
  assert.equal(E.saveSettings.textContent, "Uninstall");
  await E.saveSettings.onclick();
  assert.ok(requests.some((url) => url.includes("%2FApps%2Fcast%2Flive-id.js")));
  assert.ok(requests.some((url) => url.includes("%2FApps%2Fcast%2Flive-id.json")));
}

async function testFailedStoreLoadClearsRerenderClosure() {
  const context = load(
    "let storeLoadRequestId=0,rerenderRegularStore=()=>{},storeLoaded=false,activeStoreKind='app',storeFirmwareVersion='';" +
      "let E={storeGrid:{innerHTML:'',className:''},storeStatus:{}};" +
      "function selectedStoreSource(){return {name:'source',url:'store.json'}} function storeManifestUrl(v){return v}" +
      "function renderStoreSourceBar(){} async function loadStoreFirmwareVersion(){} async function loadStoreManifest(){throw Error('failed')}" +
      "function setStatus(){} function storeLoadFailedMessage(){return 'failed'}" +
      source("app-store-render.js") +
      "\nthis.run=loadStore;this.get=()=>rerenderRegularStore;",
    {
      fetch: async () => ({ json: async () => [] }),
      console,
    },
  );
  await context.run();
  assert.equal(context.get(), null);
}

async function testRegularStoreTagSurvivesLiveRoundTrip() {
  const document = testDocument();
  const storeTags = document.createElement("div");
  storeTags.id = "storeTags";
  const storeSearchInput = document.createElement("input");
  storeSearchInput.id = "storeSearchInput";
  storeSearchInput.value = "no-match";
  const storeFilter = document.createElement("div");
  storeFilter.id = "storeFilter";
  const storeGrid = document.createElement("div");
  let catalog = {
    flow: [{ id: "forecast", tags: ["weather"] }],
    animation: [],
  },
    selectedSourceUrl = "store-a.json";
  const context = load(
    "let storeLoadRequestId=0,rerenderRegularStore=null,regularStoreTag='all',regularStoreSourceKey='',liveStoreTag='all',liveStoreSourceKey='',storeLoaded=false,activeStoreKind='app',storeFirmwareVersion='',castModuleV=0,castModuleCache={},castStoreCatalog=[];" +
      "let t={all:'All',more:'More',less:'Less',flowAppSection:'Flow',animationAppSection:'Animation'};" +
      source("app-store-render.js") + source("cast-store-tab.js") +
      "\nthis.api={loadStore,renderCastAppStore,rerender:()=>rerenderRegularStore(),tag:()=>regularStoreTag};",
    {
      document,
      E: { storeGrid, storeStatus: {} },
      $: (id) => document.getElementById(id),
      selectedStoreSource: () => ({ name: "source", url: selectedSourceUrl }),
      storeSourceKey: (url) => String(url || "").replace(/\/+$/, ""),
      storeManifestUrl: (url) => url,
      renderStoreSourceBar() {},
      loadStoreFirmwareVersion: async () => {},
      loadStoreManifest: async () => ({ data: {}, url: "store.json" }),
      normalizeStoreList: () => catalog,
      storeBase: () => "http://store/",
      setStatus() {},
      renderAppKindTabs() {},
      castInstalledMap: () => ({}),
      castUi: () => "Live",
      localizedSearchText: () => "",
      isCompatibleVersion: () => true,
      fetch: async () => ({ json: async () => [] }),
    },
  );

  await context.api.loadStore();
  const weather = storeTags.querySelectorAll(".store-tag").find(
    (button) => button.dataset.tag === "weather",
  );
  weather.textContent = "天气";
  weather.onclick();
  assert.equal(context.api.tag(), "weather", "selection stores canonical data-tag");

  context.api.rerender();
  assert.equal(
    storeTags.querySelector(".store-tag.active").dataset.tag,
    "weather",
    "language rerender restores the regular tag",
  );

  context.api.renderCastAppStore();
  assert.equal(storeTags.querySelector(".store-tag.active").dataset.tag, "all");
  context.api.rerender();
  assert.equal(
    storeTags.querySelector(".store-tag.active").dataset.tag,
    "weather",
    "App -> Live -> App restores the regular tag",
  );

  selectedSourceUrl = "store-b.json";
  await context.api.loadStore();
  assert.ok(
    storeTags.querySelectorAll(".store-tag").some(
      (button) => button.dataset.tag === "weather",
    ),
    "new source still contains the selected canonical tag",
  );
  assert.equal(context.api.tag(), "all", "source change resets memory");
  assert.equal(storeTags.querySelector(".store-tag.active").dataset.tag, "all");
}

async function testLiveStoreTagPersistsUntilSourceChanges() {
  const document = testDocument();
  const storeTags = document.createElement("div");
  storeTags.id = "storeTags";
  const storeSearchInput = document.createElement("input");
  storeSearchInput.id = "storeSearchInput";
  storeSearchInput.value = "no-match";
  const storeFilter = document.createElement("div");
  storeFilter.id = "storeFilter";
  const storeGrid = document.createElement("div");
  let selectedSourceUrl = "live-a.json",
    failLoad = false,
    writes = [],
    storage = {
      setItem(key, value) { writes.push([key, value]); },
      getItem() { return null; },
    };
  const context = load(
    "let storeLoadRequestId=0,rerenderRegularStore=null,regularStoreTag='all',regularStoreSourceKey='',liveStoreTag='all',liveStoreSourceKey='',storeLoaded=false,activeStoreKind='cast',storeFirmwareVersion='',castModuleV=0,castModuleCache={},castStoreCatalog=[],libraryLoaded=false;" +
      "let I={zh:{all:'All',more:'More',less:'Less',langCode:'zh'}}; function refreshCastLabels(){} function renderLibrary(){} function rerenderRegularSettingsDialog(){} function rerenderRegularUninstallDialog(){} function rerenderCastUninstallDialog(){}" +
      source("app-store-render.js") + source("cast-store-tab.js") + source("i18n-runtime.js") +
      "\nthis.api={loadStore,renderCastAppStore,languageRerender:rerenderLocalizedUi,tag:()=>liveStoreTag,key:()=>liveStoreSourceKey};",
    {
      document,
      E: { storeGrid, storeStatus: {} },
      $: (id) => document.getElementById(id),
      selectedStoreSource: () => ({ name: "source", url: selectedSourceUrl }),
      storeSourceKey: (url) => String(url || "").replace(/\/+$/, ""),
      storeManifestUrl: (url) => url,
      renderStoreSourceBar() {},
      loadStoreFirmwareVersion: async () => {},
      loadStoreManifest: async () => {
        if (failLoad) throw Error("failed");
        return {
          data: { apps: { live: [{ id: "timer", tags: ["timer"] }] } },
          url: selectedSourceUrl,
        };
      },
      normalizeLiveStoreList: (data) => data.apps.live,
      storeBase: () => "http://store/",
      loadCastInstalledMap: async () => ({}),
      storeLoadFailedMessage: () => "failed",
      setStatus() {},
      renderAppKindTabs() {},
      castInstalledMap: () => ({}),
      castUi: () => "Live",
      localizedSearchText: () => "",
      isCompatibleVersion: () => true,
      localStorage: storage,
      console: { warn() {} },
    },
  );

  await context.api.loadStore();
  storeTags.querySelectorAll(".store-tag").find(
    (button) => button.dataset.tag === "timer",
  ).onclick();
  assert.equal(context.api.tag(), "timer", "Live selection stores canonical data-tag");

  context.api.languageRerender();
  assert.equal(
    storeTags.querySelector(".store-tag.active").dataset.tag,
    "timer",
    "same-source Live language rerender restores the tag",
  );

  selectedSourceUrl = "live-b.json";
  failLoad = true;
  await context.api.loadStore();
  assert.equal(context.api.tag(), "timer", "failed Live load preserves the tag");
  assert.equal(context.api.key(), "live-a.json", "failed Live load preserves the source key");

  failLoad = false;
  await context.api.loadStore();
  assert.equal(context.api.tag(), "all", "successful new Live source resets the tag");
  assert.equal(context.api.key(), "live-b.json");
  assert.equal(storeTags.querySelector(".store-tag.active").dataset.tag, "all");
  assert.deepEqual(writes, [], "Live tag selection does not persist to localStorage");
}

function deferred() {
  let resolve, reject;
  return {
    promise: new Promise((nextResolve, nextReject) => {
      resolve = nextResolve;
      reject = nextReject;
    }),
    resolve,
    reject,
  };
}

function libraryLoadContext(fetch, renders, statuses) {
  return load(
    "let apps=[{name:'cached',enabled:true}],settings={version:'cached'},libraryLoaded=false;" +
      "let E={libraryStatus:{},sheetStatus:{}}; let t={};" +
      source("app-library.js") +
      "\nfunction renderLibrary(){renders.push({apps:apps,settings:settings})}" +
      "\nthis.api={load:loadLibrary,apps:()=>apps,settings:()=>settings,loaded:()=>libraryLoaded};",
    {
      fetch,
      renders,
      statuses,
      enrichInstalledApps: async (items) => items,
      setStatus(_element, message, error) { statuses.push({ message, error }); },
    },
  );
}

async function testLibraryLoadsIgnoreOutOfOrderAndStaleFailures() {
  const requests = [];
  const renders = [];
  const statuses = [];
  const context = libraryLoadContext((url) => {
    const request = deferred();
    requests.push({ url, request });
    return request.promise;
  }, renders, statuses);

  const first = context.api.load({ renderCached: false });
  const second = context.api.load({ renderCached: false });
  assert.deepEqual(requests.map((request) => request.url), [
    "/api/apps", "/api/settings", "/api/apps", "/api/settings",
  ]);

  requests[2].request.resolve({ json: async () => [{ name: "new", enabled: false }] });
  requests[3].request.resolve({ json: async () => ({ version: "new" }) });
  await second;
  requests[0].request.resolve({ json: async () => [{ name: "old", enabled: true }] });
  requests[1].request.resolve({ json: async () => ({ version: "old" }) });
  await first;

  assert.equal(context.api.apps()[0].name, "new");
  assert.equal(context.api.settings().version, "new");
  assert.equal(context.api.loaded(), true, "authoritative success marks the library loaded");
  assert.equal(renders.length, 1, "only the authoritative load renders");
  assert.deepEqual(statuses, []);

  const staleFailureRequests = [];
  const staleFailureRenders = [];
  const staleFailureStatuses = [];
  const staleFailure = libraryLoadContext((url) => {
    const request = deferred();
    staleFailureRequests.push({ url, request });
    return request.promise;
  }, staleFailureRenders, staleFailureStatuses);
  const failed = staleFailure.api.load({ renderCached: false });
  const authoritative = staleFailure.api.load({ renderCached: false });
  staleFailureRequests[2].request.resolve({ json: async () => [{ name: "authoritative" }] });
  staleFailureRequests[3].request.resolve({ json: async () => ({ version: "authoritative" }) });
  await authoritative;
  staleFailureRequests[0].request.reject(Error("stale load failed"));
  await failed;

  assert.equal(staleFailure.api.apps()[0].name, "authoritative");
  assert.equal(staleFailure.api.loaded(), true, "stale failure preserves a newer successful load");
  assert.equal(staleFailureRenders.length, 1);
  assert.deepEqual(staleFailureStatuses, [], "stale failures are silent");

  const authoritativeFailureRequests = [];
  const authoritativeFailure = libraryLoadContext((url) => {
    const request = deferred();
    authoritativeFailureRequests.push({ url, request });
    return request.promise;
  }, [], []);
  const failedAuthoritatively = authoritativeFailure.api.load({ renderCached: false });
  authoritativeFailureRequests[0].request.reject(Error("authoritative load failed"));
  await failedAuthoritatively;
  assert.equal(authoritativeFailure.api.loaded(), false, "authoritative failure permits a later library retry");
}

function libraryRowDocument() {
  const document = testDocument();
  const createElement = document.createElement.bind(document);
  document.createElement = (tag) => {
    const element = createElement(tag);
    if (tag !== "article") return element;
    const selectors = {};
    Object.defineProperty(element, "innerHTML", {
      set(value) {
        if (!value.includes('type="checkbox"')) return;
        [".app-icon", ".name", ".meta", ".settings-btn", ".trash", ".switch", "input", ".up", ".down"].forEach((selector) => {
          selectors[selector] = createElement(selector === "input" ? "input" : "div");
        });
      },
      get() { return ""; },
    });
    element.querySelector = (selector) => selectors[selector] || null;
    return element;
  };
  return document;
}

async function testPendingLibraryTogglePreventsDuplicatesAndPreservesTarget() {
  const document = libraryRowDocument();
  const requests = [];
  const nativeSettings = deferred();
  const appMutation = deferred();
  const context = load(
    "let apps=[{name:'native-clock',enabled:false,type:'native'}],settings={},libraryLoaded=true,activeLibraryKind='app';" +
      "let E={libraryStatus:{},sheetStatus:{},libraryList:testList,liveAppsPanel:{style:{}}};" +
      "let t={count:'',countEnd:'',updating:'Updating',updated:'Updated'}; let nativeKeys={'native-clock':'CLOCK'};" +
      "function renderAppKindTabs(){} function setIcon(){} function appName(item){return item.name} function appDisplayName(item){return item.name}" +
      "function appDisplayDescription(){return ''} function installedCastApps(){return []} function castUi(){return ''} function openSettings(){}" +
      source("app-library.js") +
      "\nthis.api={render:renderLibrary,toggle:toggleApp};",
    {
      document,
      testList: document.createElement("div"),
      fetch(url, options) {
        requests.push({ url, options });
        if (url === "/api/settings" && options && options.method === "POST") return nativeSettings.promise;
        if (url === "/api/apps" && options && options.method === "POST") return appMutation.promise;
        if (url === "/api/apps") return Promise.resolve({ json: async () => [{ name: "native-clock", enabled: true, type: "native" }] });
        return Promise.resolve({ json: async () => ({}) });
      },
      enrichInstalledApps: async (items) => items,
      setStatus() {},
    },
  );

  context.api.render();
  const firstToggle = context.api.toggle("native-clock", true);
  const pendingInput = context.testList.children[0].querySelector("input");
  assert.equal(pendingInput.checked, true, "pending control shows requested state");
  assert.equal(pendingInput.disabled, true, "pending control is disabled");
  const duplicateToggle = context.api.toggle("native-clock", false);
  await duplicateToggle;
  assert.deepEqual(requests.map((request) => request.url), ["/api/settings"], "duplicate toggle submits nothing");

  nativeSettings.resolve({ ok: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(requests.map((request) => request.url), ["/api/settings", "/api/apps"], "native requests retain settings then apps ordering");
  appMutation.resolve({ ok: true });
  await firstToggle;
  const finalInput = context.testList.children[0].querySelector("input");
  assert.equal(finalInput.checked, true);
  assert.equal(finalInput.disabled, false, "control is re-enabled after completion");
}

async function run() {
  testGeneratedUiHasNoDebugBadge();
  testUnifiedFallbacksAndIdentity();
  testRegularCatalogDescriptionsMatchManifests();
  testStoreAndInstalledLabels();
  testLanguageRerenderDispatch();
  testStoreSearchPlaceholderRelabelsWithoutChangingValue();
  testInstallMergeLocalization();
  testLegacyLiveDialogRerender();
  testLiveDialogUsesTextAndValidIds();
  testTopLevelCastApps();
  await testStableInstallId();
  await testInstalledEnrichmentIsNarrowAndPreservesAnimation();
  testRegularDialogRelabelPreservesValue();
  testUninstallLabelsKeepCanonicalIds();
  await testLiveUninstallLabelsKeepCanonicalId();
  await testFailedStoreLoadClearsRerenderClosure();
  await testRegularStoreTagSurvivesLiveRoundTrip();
  await testLiveStoreTagPersistsUntilSourceChanges();
  await testLibraryLoadsIgnoreOutOfOrderAndStaleFailures();
  await testPendingLibraryTogglePreventsDuplicatesAndPreservesTarget();
  console.log("app localization tests: ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
