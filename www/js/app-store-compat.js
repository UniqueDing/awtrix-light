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

async function loadInstalledStoreVersions(installed, catalog) {
  let animationItems = catalog && Array.isArray(catalog.animation)
      ? catalog.animation
      : [],
    installedNames = new Set(
      (Array.isArray(installed) ? installed : [])
        .filter((app) => app && app.name)
        .map((app) => app.name),
    ),
    map = {};
  await Promise.all(
    animationItems.map(async (item) => {
      let id = item && item.id;
      if (!id || !installedNames.has(id)) return;
      let saved = await loadSavedCustomPayload(id, null);
      if (!saved) return;
      map[id] = {
        version: saved.version,
        needsReinstall:
          saved.type === "animation" &&
          saved.animation &&
          typeof saved.animation === "object",
      };
    }),
  );
  return map;
}

function installedAppVersion(map, id, name) {
  let app = (map && ((id && map[id]) || (name && map[name]))) || null;
  return app && app.version ? String(app.version) : "";
}

function installedAppNeedsReinstall(map, id, name) {
  let app = (map && ((id && map[id]) || (name && map[name]))) || null;
  return !!(app && app.needsReinstall);
}
