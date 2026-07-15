function appName(i, n) {
  return typeof i === "string"
    ? i
    : (i &&
        (i.appKey || (typeof i.name === "string" && i.name) || i.id)) ||
        "App " + (n + 1);
}

function localLabel(v, f, zh) {
  let d = v && typeof v === "object" ? v : null;
  if (d) return d[lang] || d.en || d.zh || f || "";
  return (lang === "zh" && zh) || v || f || "";
}

function localizedField(item, key, fallback) {
  if (!item) return fallback || "";
  let value = item[key],
    valueMap = value && typeof value === "object" ? value : null,
    i18n = item[key + "_i18n"],
    i18nMap = i18n && typeof i18n === "object" ? i18n : null,
    activeAliases = [];
  if (lang === "zh")
    activeAliases = [
      i18nMap && i18nMap.zh,
      valueMap && valueMap.zh,
      item[key + "-cn"],
      item[key + "-zh"],
    ];
  else
    activeAliases = [
      i18nMap && i18nMap[lang],
      valueMap && valueMap[lang],
    ];
  return (
    activeAliases.find(
      (candidate) => candidate !== undefined && candidate !== null && candidate !== "",
    ) ||
    (i18nMap && i18nMap.en) ||
    (valueMap && valueMap.en) ||
    (typeof value === "string" && value) ||
    (i18nMap && i18nMap.zh) ||
    (valueMap && valueMap.zh) ||
    item[key + "-cn"] ||
    item[key + "-zh"] ||
    fallback ||
    ""
  );
}

function localizedSearchText(item, keys) {
  let values = [];
  (keys || ["name", "description"]).forEach((key) => {
    let value = item && item[key],
      i18n = item && item[key + "_i18n"];
    values.push(
      item && item.id,
      typeof value === "string" ? value : "",
      value && typeof value === "object" ? value.en : "",
      value && typeof value === "object" ? value.zh : "",
      i18n && typeof i18n === "object" ? i18n.en : "",
      i18n && typeof i18n === "object" ? i18n.zh : "",
      item && item[key + "-cn"],
      item && item[key + "-zh"],
    );
  });
  return values.filter(Boolean).join(" ").toLowerCase();
}

function appDisplayName(item, n) {
  return localizedField(item, "name", appName(item, n));
}

function appDisplayDescription(item) {
  return localizedField(item, "description", "");
}

function mergeLocalizationMetadata(target, source) {
  let out = Object.assign({}, target || {});
  ["name", "description"].forEach((key) => {
    [key, key + "-cn", key + "-zh", key + "_i18n"].forEach((field) => {
      if (
        (out[field] === undefined || out[field] === "") &&
        source &&
        source[field] !== undefined
      )
        out[field] = source[field];
    });
    let sourceValue = source && source[key],
      sourceI18n = source && source[key + "_i18n"],
      sourceMap =
        sourceI18n && typeof sourceI18n === "object"
          ? sourceI18n
          : sourceValue && typeof sourceValue === "object"
            ? sourceValue
            : null;
    if (sourceMap) {
      if ((out[key] === undefined || out[key] === "") && sourceMap.en)
        out[key] = sourceMap.en;
      if ((out[key + "-cn"] === undefined || out[key + "-cn"] === "") && sourceMap.zh)
        out[key + "-cn"] = sourceMap.zh;
    }
  });
  return out;
}

function setStatus(el, msg, err) {
  el.textContent = msg || "";
  el.className = err ? "status error" : "status";
}
function esc(v) {
  return String(v === undefined || v === null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}
