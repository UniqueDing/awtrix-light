function versionParts(v) {
  return String(v || "0").split(/[^0-9]+/).filter(Boolean).map(Number);
}

function compareVersions(a, b) {
  let x = versionParts(a), y = versionParts(b), n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) {
    let d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function minRequiredVersion(item) {
  return String((item && item.minFirmwareVersion) || "").trim();
}

function isCompatibleVersion(item, current) {
  let min = minRequiredVersion(item);
  return !min || !!current && compareVersions(current, min) >= 0;
}

function incompatibleText(item) {
  return minRequiredVersion(item) ? ">= " + minRequiredVersion(item) : t.install;
}

async function loadInstalledStoreVersions() {
  return {};
}

function installedAppVersion(map, id, name) {
  let app = (map && ((id && map[id]) || (name && map[name]))) || null;
  return app && app.version ? String(app.version) : "";
}
