function addField(f, item, parent) {
  parent = parent || E.fields;
  let wrap = document.createElement("div");
  wrap.className =
    f[2] === "color" || f[2] === "colorString" ? "field color-field" : "field";
  wrap.dataset.fieldKey = f[0];
  let src = f[3] === "legacy" ? "legacy" : "api",
    val =
      src === "legacy"
        ? legacySettings[f[0]]
        : item && item[f[0]] !== undefined
          ? item[f[0]]
          : settings[f[0]],
    input;
  if (item && f[0].startsWith("input_") && Array.isArray(item.inputs)) {
    let inputItem = item.inputs.find((x) => "input_" + x.id === f[0]);
    if (inputItem && inputItem.value !== undefined) val = inputItem.value;
  }
  if (item && item.display && item.display[f[0]] !== undefined)
    val = item.display[f[0]];
  if (item && item.animation && f[0] === "animation_fps")
    val = item.animation.fps;
  if (item && item.animation && f[0] === "animation_repeat")
    val = item.animation.repeat;
  if (
    item &&
    f[0].startsWith("source_") &&
    f[0].endsWith("_interval") &&
    Array.isArray(item.sources)
  ) {
    let id = f[0].slice(7, -9),
      srcItem = item.sources.find((x) => String(x.id || "") === id);
    if (srcItem && srcItem.interval !== undefined) val = srcItem.interval;
  }
  if (val === undefined || val === null) val = "";
  if (f[2] === "checkbox") {
    input = document.createElement("input");
    input.type = "hidden";
    input.value = val ? "on" : "off";
    let group = document.createElement("div");
    group.className = "segmented";
    boolOptions().forEach((o) => {
      let b = document.createElement("button");
      b.type = "button";
      b.textContent = o[1];
      b.dataset.value = o[0];
      b.className = o[0] === input.value ? "active" : "";
      b.onclick = () => {
        input.value = o[0];
        group
          .querySelectorAll("button")
          .forEach((x) => x.classList.toggle("active", x === b));
      };
      group.appendChild(b);
    });
    input._segment = group;
  } else if (f[2] === "select") {
    if (triBoolKeys.has(f[0]))
      val = val === true ? "on" : val === false ? "off" : val || "default";
    input = document.createElement("select");
    (f[3] || []).forEach((o) => {
      let opt = document.createElement("option");
      opt.value = o[0];
      opt.textContent = o[1];
      input.appendChild(opt);
    });
    input.value = val || (f[3] && f[3][0] && f[3][0][0]) || "";
  } else if (f[2] === "segmented") {
    if (triBoolKeys.has(f[0]))
      val = val === true ? "on" : val === false ? "off" : val || "default";
    if (triNumberKeys.has(f[0]))
      val = val === "" ? "default" : Number(val) > 0 ? "on" : "off";
    input = document.createElement("input");
    input.type = "hidden";
    input.value = val || (f[3] && f[3][0] && f[3][0][0]) || "";
    let group = document.createElement("div");
    group.className = "segmented";
    (f[3] || []).forEach((o) => {
      let b = document.createElement("button");
      b.type = "button";
      b.textContent = o[1];
      b.dataset.value = o[0];
      b.className = o[0] == input.value ? "active" : "";
      b.onclick = () => {
        input.value = o[0];
        group
          .querySelectorAll("button")
          .forEach((x) => x.classList.toggle("active", x === b));
      };
      group.appendChild(b);
    });
    input._segment = group;
  } else {
    input = document.createElement("input");
    input.type = f[2] === "colorString" ? "color" : f[2];
    input.value = f[2] === "color" || f[2] === "colorString" ? hex(val) : val;
  }
  input.dataset.key = f[0];
  input.dataset.type = f[2];
  input.dataset.source = src;
  let label = document.createElement("label");
  label.className = "field-title";
  label.textContent = f[1];
  if (f[4]) {
    let labelRow = document.createElement("div");
    labelRow.className = "field-label";
    labelRow.appendChild(label);
    let help = document.createElement("button");
    help.type = "button";
    help.className = "help-btn";
    help.dataset.fieldHelp = "1";
    help.textContent = "?";
    help.title = f[4];
    help.setAttribute("aria-label", f[1] + ":" + f[4]);
    help.onclick = () => openInputHelpDialog(f[1], f[4]);
    labelRow.appendChild(help);
    wrap.appendChild(labelRow);
  } else wrap.appendChild(label);
  if (f[2] === "checkbox") {
    wrap.appendChild(input);
    wrap.appendChild(input._segment);
  } else {
    wrap.appendChild(input);
    if (input._segment) wrap.appendChild(input._segment);
  }
  parent.appendChild(wrap);
}

let regularSettingsDialog = null;

function isGifBackedAnimation(item) {
  return !!(
    item &&
    item.type === "animation" &&
    (!item.animation || typeof item.animation !== "object") &&
    typeof item.icon === "string" &&
    item.icon &&
    item.duration !== undefined
  );
}

function regularSettingsFields(name, item) {
  let fields = appSettingFields()[name] || [],
    commonFields = [];
  if (
    item.type === "custom" ||
    item.type === "flow" ||
    item.type === "animation"
  ) {
    let inputFields = Array.isArray(item.inputs)
        ? item.inputs.map((input) => [
            "input_" + input.id,
            localizedField(input, "label", input.id),
            input.type === "number" ? "number" : "text",
            undefined,
            localizedField(input, "description", ""),
          ])
        : item.bilibiliUid !== undefined
          ? [["bilibiliUid", t.uid, "text"]]
          : [],
      sourceFields = Array.isArray(item.sources)
        ? item.sources.map((source) => [
            "source_" + source.id + "_interval",
            (source.id || "source") + " " + t.interval,
            "number",
          ])
        : [],
      animationFields =
        item.type === "animation" && item.animation
          ? [
              ["animation_fps", "FPS", "number"],
              ["animation_repeat", t.repeatCount, "number"],
            ]
          : [];
    if (isGifBackedAnimation(item))
      fields = [["duration", t.duration, "number"]];
    else {
      commonFields = settingsDisplayFields();
      fields =
        item.type === "animation"
          ? animationFields.concat([["displayDuration", t.duration, "number"]])
          : inputFields.concat(sourceFields, animationFields);
    }
  }
  return { fields, commonFields };
}

function relabelField(field) {
  let wrap = Array.from(E.fields.querySelectorAll("[data-field-key]")).find(
    (candidate) => candidate.dataset.fieldKey === field[0],
  );
  if (!wrap) return;
  let label = wrap.querySelector(".field-title"),
    help = wrap.querySelector("[data-field-help]"),
    input = wrap.querySelector("input,select");
  if (label) label.textContent = field[1];
  if (help) {
    help.title = field[4] || "";
    help.setAttribute("aria-label", field[1] + ":" + (field[4] || ""));
    help.onclick = () => openInputHelpDialog(field[1], field[4] || "");
  }
  let options =
    field[2] === "checkbox"
      ? boolOptions()
      : field[2] === "segmented" || field[2] === "select"
        ? field[3] || []
        : [];
  if (input && input.tagName === "SELECT")
    Array.from(input.options).forEach((option, index) => {
      if (options[index]) option.textContent = options[index][1];
    });
  else
    wrap.querySelectorAll(".segmented button").forEach((button, index) => {
      if (options[index]) button.textContent = options[index][1];
    });
}

function rerenderRegularSettingsDialog() {
  if (!regularSettingsDialog || currentApp !== regularSettingsDialog.name) return;
  let name = regularSettingsDialog.name,
    item = regularSettingsDialog.item,
    descriptors = regularSettingsFields(name, item);
  E.sheetTitle.textContent = appDisplayName(item, 0) + " " + t.appSettings;
  E.saveSettings.textContent = t.saveSettings;
  if (item.type === "custom" || item.type === "flow")
    E.secondaryAction.textContent = t.editApp;
  let refresh = E.fields.querySelector("[data-settings-refresh]");
  if (refresh) refresh.textContent = t.refresh;
  let exportBtn = E.exportAction;
  if (exportBtn && exportBtn.style.display !== "none") exportBtn.textContent = t.exportJson;
  let summary = E.fields.querySelector(".advanced-settings summary");
  if (summary) summary.textContent = t.commonSettings;
  descriptors.fields.concat(descriptors.commonFields).forEach(relabelField);
  let empty = E.fields.querySelector("[data-settings-empty]");
  if (empty) empty.textContent = t.noFields;
}

function openInputHelpDialog(label, description) {
  regularSettingsDialog = null;
  hideFooterExport();
  E.secondaryAction.style.display = "none";
  E.saveSettings.style.display = "";
  E.saveSettings.textContent = t.ok;
  E.saveSettings.onclick = () => {
    E.saveSettings.onclick = saveAppSettings;
    E.sheet.classList.remove("show");
  };
  E.sheetTitle.textContent = label;
  E.sheetStatus.textContent = "";
  E.fields.innerHTML = '<p class="hint input-help-text"></p>';
  E.fields.querySelector("p").textContent = description;
  E.sheet.classList.add("show");
}

function openGlobalDisplaySettings() {
  regularSettingsDialog = null;
  E.secondaryAction.style.display = "none";
  hideFooterExport();
  E.saveSettings.style.display = "";
  E.saveSettings.textContent = t.saveSettings;
  E.saveSettings.onclick = saveAppSettings;
  currentApp = "__global__";
  E.sheetTitle.textContent = t.appSettings;
  E.sheetStatus.textContent = "";
  E.fields.innerHTML = "";
  globalDisplayFields().forEach((f) => addField(f, {}));
  E.sheet.classList.add("show");
}
async function loadSavedCustomPayload(name, item) {
  try {
    let savedRes = await fetch("/api/custom?name=" + encodeURIComponent(name), {
        cache: "no-store",
      }).catch(() => null),
      saved = null;
    if (savedRes && savedRes.ok) saved = await savedRes.json();
    else {
      let fileRes = await fetch(
        "/CUSTOMAPPS/" + encodeURIComponent(name) + ".json",
        { cache: "no-store" },
      ).catch(() => null);
      if (fileRes && fileRes.ok) saved = await fileRes.json();
    }
    return saved ? Object.assign({}, item || {}, saved) : item;
  } catch (e) {
    return item;
  }
}

function exportFallbackPayload(item) {
  let payload = Object.assign({}, item || {});
  delete payload.enabled;
  delete payload.type;
  return payload;
}

function downloadJson(name, payload) {
  let blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = (name || "custom-app") + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportCustomAppJson(name, item) {
  try {
    let payload = null,
      r = await fetch("/api/custom?name=" + encodeURIComponent(name));
    if (r.ok) payload = await r.json();
    else payload = exportFallbackPayload(item);
    downloadJson(name, payload);
    setStatus(E.sheetStatus, t.saved, false);
  } catch (e) {
    downloadJson(name, exportFallbackPayload(item));
    setStatus(E.sheetStatus, t.exportFailed, true);
  }
}

async function openSettings(name) {
  regularSettingsDialog = null;
  E.secondaryAction.style.display = "none";
  hideFooterExport();
  E.saveSettings.style.display = "";
  E.saveSettings.textContent = t.saveSettings;
  E.saveSettings.onclick = saveAppSettings;
  currentApp = name;
  E.sheetTitle.textContent = name + " " + t.appSettings;
  E.sheetStatus.textContent = "";
  E.fields.innerHTML =
    '<p class="hint">' + (t.loadingSettings || "Loading...") + "</p>";
  E.sheet.classList.add("show");
  let item = (apps || []).find((a) => appName(a, 0) === name) || {};
  item = await loadSavedCustomPayload(name, item);
  E.sheetTitle.textContent = appDisplayName(item, 0) + " " + t.appSettings;
  if (name === "Time") await loadLegacySettings();
  E.fields.innerHTML = "";
  let descriptors = regularSettingsFields(name, item),
    fields = descriptors.fields,
    commonFields = descriptors.commonFields;
  if (
    item.type === "custom" ||
    item.type === "flow" ||
    item.type === "animation"
  ) {
    let exportBtn = footerExportAction();
    if (item.type === "custom" || item.type === "flow") {
      let editPayload = normalizeImportedApp(item);
      E.secondaryAction.style.display = "";
      E.secondaryAction.textContent = t.editApp;
      E.secondaryAction.onclick = () => openCreateApp(editPayload, "edit");
    }
    if (isRefreshableApp(item)) {
      let refreshCard = document.createElement("section"),
        refreshBtn = document.createElement("button");
      refreshCard.className = "settings-card";
      refreshBtn.type = "button";
      refreshBtn.className = "tonal";
      refreshBtn.dataset.settingsRefresh = "1";
      refreshBtn.textContent = t.refresh;
      refreshBtn.onclick = () => refreshCustomApp(name, refreshBtn, E.sheetStatus);
      refreshCard.appendChild(refreshBtn);
      E.fields.appendChild(refreshCard);
    }
    exportBtn.style.display = "";
    exportBtn.textContent = t.exportJson;
    exportBtn.onclick = () => exportCustomAppJson(name, item);
  }
  regularSettingsDialog = { name, item };
  if (!fields.length && !commonFields.length) {
    let empty = document.createElement("p");
    empty.className = "hint";
    empty.dataset.settingsEmpty = "1";
    empty.textContent = t.noFields;
    E.fields.appendChild(empty);
    E.sheet.classList.add("show");
    return;
  }
  fields.forEach((f) => addField(f, item));
  if (commonFields.length) {
    let details = document.createElement("details");
    details.className = "settings-card advanced-settings";
    let summary = document.createElement("summary");
    summary.textContent = t.commonSettings;
    details.appendChild(summary);
    let body = document.createElement("div");
    body.className = "advanced-fields";
    details.appendChild(body);
    commonFields.forEach((f) => addField(f, item, body));
    E.fields.appendChild(details);
  }
  E.sheet.classList.add("show");
}

async function saveAppSettings() {
  if (currentApp === "__app_form__") return saveCreateApp();
  if (currentApp === "__store_source__") return saveStoreSourceDialog();
  if (currentApp === "__new_file__") return createFileItem(false);
  if (currentApp === "__new_folder__") return createFileItem(true);
  let body = {},
    legacyBody = {};
  E.fields.querySelectorAll("input,select").forEach((i) => {
    let v =
      i.dataset.type === "checkbox"
        ? i.value === "on"
        : i.dataset.type === "color"
          ? numberFromHex(i.value)
          : i.dataset.type === "colorString"
            ? i.value
            : i.dataset.type === "number"
              ? Number(i.value)
              : i.value;
    if (i.dataset.key === "TEFF" || i.dataset.key === "TMODE")
      v = Number(i.value);
    if (triBoolKeys.has(i.dataset.key)) {
      if (v === "default") return;
      v = v === "on";
    }
    if (triNumberKeys.has(i.dataset.key)) {
      if (v === "default") return;
      v = v === "on" ? 1 : 0;
    }
    if (i.dataset.source === "legacy") legacyBody[i.dataset.key] = v;
    else body[i.dataset.key] = v;
  });
  setStatus(E.sheetStatus, t.saving, false);
  try {
    let item = (apps || []).find((a) => appName(a, 0) === currentApp) || {},
      payload = await loadSavedCustomPayload(currentApp, item),
      isSchemaApp =
        payload &&
        (payload.type === "custom" ||
          payload.type === "flow" ||
          payload.type === "animation" ||
          payload.display ||
          Array.isArray(payload.inputs) ||
          Array.isArray(payload.sources));
    if (currentApp === "__global__") {
      let r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw Error("save failed");
      settings = Object.assign(settings, body);
    } else if (isSchemaApp) {
      let hasSchema = payload.display && typeof payload.display === "object";
      if (hasSchema) {
        payload.display = Object.assign({}, payload.display);
        triBoolKeys.forEach((k) => delete payload.display[k]);
        triNumberKeys.forEach((k) => delete payload.display[k]);
        Object.keys(body).forEach((k) => {
          if (k.startsWith("input_") || k.startsWith("source_")) return;
          payload.display[k] = body[k];
        });
      } else {
        payload = Object.assign({}, payload);
        triBoolKeys.forEach((k) => delete payload[k]);
        triNumberKeys.forEach((k) => delete payload[k]);
        Object.keys(body).forEach((k) => {
          if (k.startsWith("input_") || k.startsWith("source_")) return;
          payload[k] = body[k];
        });
      }
      if (Array.isArray(payload.inputs))
        payload.inputs = payload.inputs.map((x) =>
          Object.assign({}, x, {
            value:
              body["input_" + x.id] !== undefined
                ? body["input_" + x.id]
                : x.value,
          }),
        );
      if (Array.isArray(payload.sources))
        payload.sources = payload.sources.map((x) =>
          Object.assign({}, x, {
            interval:
              body["source_" + x.id + "_interval"] !== undefined
                ? body["source_" + x.id + "_interval"]
                : x.interval,
          }),
        );
      if (payload.animation) {
        payload.animation = Object.assign({}, payload.animation);
        if (body.animation_fps !== undefined)
          payload.animation.fps = body.animation_fps;
        if (body.animation_repeat !== undefined)
          payload.animation.repeat = body.animation_repeat;
      }
      delete payload.enabled;
      payload = withDisplayCompatibility(payload);
      let r = await fetch(
        "/api/custom?name=" + encodeURIComponent(currentApp) + "&save=1",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!r.ok) throw Error("save failed");
      libraryLoaded = false;
      await loadLibrary();
    } else {
      if (Object.keys(body).length) {
        let r = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw Error("save failed");
        settings = Object.assign(settings, body);
      }
      if (Object.keys(legacyBody).length) await saveLegacySettings(legacyBody);
    }
    setStatus(E.sheetStatus, t.saved, false);
    E.sheet.classList.remove("show");
  } catch (e) {
    setStatus(E.sheetStatus, e.message, true);
  }
}
