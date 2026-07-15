let lang = localStorage.awtrixLang || "zh";
let t = I[lang];
function applyLang() {
  t = I[lang];
  document.documentElement.lang = t.langCode;
  document.querySelectorAll("[data-i]").forEach((e) => {
    if (e.id === "sheetTitle" && E.sheet.classList.contains("show")) return;
    if (t[e.dataset.i]) e.textContent = t[e.dataset.i];
  });
  document.querySelectorAll("[data-placeholder]").forEach((e) => {
    if (t[e.dataset.placeholder]) e.placeholder = t[e.dataset.placeholder];
  });
  if ($("langBtn")) $("langBtn").textContent = t.langToggle;
}

function rerenderLocalizedUi() {
  refreshCastLabels();
  if (storeLoaded) {
    if (activeStoreKind === "cast") renderCastAppStore();
    else if (rerenderRegularStore) rerenderRegularStore();
  }
  if (libraryLoaded) renderLibrary();
  rerenderRegularSettingsDialog();
  rerenderRegularUninstallDialog();
  rerenderCastUninstallDialog();
  let api = window["currentCastAppApi"];
  if (api && api.rerenderDialog) api.rerenderDialog();
}
function applyTheme() {
  document.body.classList.toggle("dark", localStorage.awtrixTheme === "dark");
  if ($("themeBtn"))
    $("themeBtn").textContent = document.body.classList.contains("dark")
      ? "\u2600"
      : "\u{1f319}";
}
function hex(v) {
  if (typeof v === "string" && v[0] === "#") return v;
  let n = Number(v || 0).toString(16);
  return "#" + ("000000" + n).slice(-6);
}
function numberFromHex(v) {
  return parseInt(String(v).replace("#", ""), 16) || 0;
}

function startup(msg) {
  if ($("startupStatus")) $("startupStatus").textContent = msg || "";
}
function hideStartup() {
  if ($("startupGate")) $("startupGate").style.display = "none";
}
function showStartup(msg) {
  if ($("startupGate")) $("startupGate").style.display = "grid";
  startup(msg);
}
const UI_DEBUG_BUILD = "DBG-20260701-2052";
function showDebugBuildBadge() {
  let el = document.getElementById("debugBuildBadge");
  if (!el) {
    el = document.createElement("div");
    el.id = "debugBuildBadge";
    document.body.appendChild(el);
  }
  el.textContent = UI_DEBUG_BUILD;
}
function startApp() {
  dbg("startApp");
  startup(t.startupReady);
  applyTheme();
  applyLang();
  showDebugBuildBadge();
  activate(
    location.pathname === "/settings"
      ? "settings"
      : location.pathname === "/my-apps"
        ? "library"
        : location.pathname === "/files"
          ? "files"
          : "store",
    true,
  );
  hideStartup();
  dbg("startup:hidden");
  setTimeout(initPreviewView, 0);
}
function initAuth() {
  dbg("initAuth");
  if (authHeader) {
    dbg("auth:sessionStorage");
    startApp();
    return;
  }
  let showLogin = () => {
    let sp = $("startupSpinner"),
      hint = $("startupHint"),
      form = $("startupLoginForm");
    if (sp) sp.style.display = "none";
    if (hint) hint.style.display = "none";
    if (form) form.style.display = "";
    startup(t.startupLogin);
    let user = $("startupUser"),
      pass = $("startupPass"),
      btn = $("startupLoginBtn");
    let doLogin = () => {
      let u = ((user && user.value) || "").trim();
      let p = (pass && pass.value) || "";
      if (!u) {
        startup(t.enterUsername);
        return;
      }
      authHeader = btoa(u + ":" + p);
      sessionStorage.awtrixAuth = authHeader;
      startApp();
    };
    if (btn) btn.onclick = doLogin;
    if (pass)
      pass.onkeydown = (e) => {
        if (e.key === "Enter") doLogin();
      };
    if (user) user.focus();
  };
  fetch("/api/auth/status", { cache: "no-store" })
    .then((r) => r.json())
    .then((j) => {
      dbg("auth:status enabled=" + j.enabled);
      if (!j.enabled) {
        startApp();
        return;
      }
      showLogin();
    })
    .catch((e) => {
      dbg("auth:status failed " + e.message);
      showLogin();
    });
}
