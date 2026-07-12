let activeStoreKind = "app",
  activeLibraryKind = "app";
function localLabel(v, f) {
  let d = v && typeof v === "object" ? v : null;
  return d ? d[lang] || d.en || d.zh || f || "" : v || f || "";
}
function castAppName(app) {
  return localLabel(app && app.name, (app && app.id) || "");
}
function castAppDescription(app) {
  return localLabel(app && app.description, "");
}
function castUi(k) {
  let m = {
    zh: {
      cast: "Live",
      animation: "Animation",
      castHint: "Live 由浏览器 JS 控制，需要保持页面打开",
      legacy: "此 Live 是旧内置项，请卸载后从应用商店重新安装外置版本。",
      uninstallTitle: "卸载 Live",
      uninstallHint:
        "确定要从我的应用中卸载这个 Live 吗？可以之后从应用商店重新安装。",
      empty: "还没有安装 Live，请到应用商店 > Live 安装。",
    },
    en: {
      cast: "Live",
      animation: "Animation",
      castHint:
        "Live entries are controlled by browser JavaScript. Keep this page open.",
      legacy:
        "This Live entry is a legacy built-in item. Uninstall it, then reinstall the external version from the app store.",
      uninstallTitle: "Uninstall Live",
      uninstallHint:
        "Remove this Live app from My Apps? You can reinstall it from the app store later.",
      empty: "No Live apps installed yet. Install one from App Store > Live.",
    },
  };
  return (m[lang] || m.zh)[k];
}
function refreshCastLabels() {
  document
    .querySelectorAll('[data-kind="cast"]')
    .forEach((b) => (b.textContent = castUi("cast")));
  document
    .querySelectorAll('[data-kind="app"]')
    .forEach((b) => (b.textContent = "App"));
}
