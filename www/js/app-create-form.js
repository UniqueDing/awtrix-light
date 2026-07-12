function formDisplayFields() {
  let iconLabel =
    t.iconName +
    ' <a class="icon-create-link" href="https://developer.lametric.com/icons" target="_blank" rel="noopener noreferrer">' +
    t.createIcon +
    "</a>";
  return [
    ["displayText", t.displayText, "text"],
    ["displayIcon", iconLabel, "text"],
    ["displayColor", t.textColor, "color"],
    ["displayBackground", t.background, "color"],
    ["displayProgress", t.progress, "number"],
    ["displayProgressC", t.progressColor, "color"],
    ["displayProgressBC", t.progressBg, "color"],
  ];
}


function setCreateForm(data) {
  if (data.name !== undefined) $("cName").value = data.name;
  if (data.description !== undefined)
    $("c_description").value = data.description;
  if (data.appIcon !== undefined) $("c_appIcon").value = data.appIcon;
  if (data.author !== undefined) $("c_author").value = data.author;
  if (data.tagsText !== undefined) $("c_tagsText").value = data.tagsText;
  if (data.version !== undefined) $("c_version").value = data.version;
  renderInputs(data.inputs || []);
  renderSources(data.sources || []);
  formDisplayFields().forEach((f) => {
    let el = $("c_" + f[0]);
    if (data[f[0]] === undefined) return;
    if (f[2] === "color") el.value = hex(data[f[0]]);
    else el.value = data[f[0]];
  });
}

function inputRow(item) {
  item = item || {};
  let type = item.type || "text",
    value =
      item.value === undefined
        ? ""
        : '<input data-k="value" type="hidden" value="' +
          esc(item.value) +
          '">';
  return (
    '<div class="array-card input-row"><div class="array-head"><strong>' +
    t.inputs +
    '</strong><button class="icon-btn remove" type="button">-</button></div><div class="field"><label>ID</label><input data-k="id" value="' +
    esc(item.id) +
    '"></div><div class="field"><label>Label</label><input data-k="label" value="' +
    esc(item.label) +
    '"></div><div class="field"><label>Type</label><select data-k="type"><option value="text" ' +
    (type === "text" ? "selected" : "") +
    '>text</option><option value="number" ' +
    (type === "number" ? "selected" : "") +
    '>number</option></select></div><div class="field"><label>' +
    t.inputDescription +
    '</label><input data-k="description" value="' +
    esc(item.description) +
    '"></div>' +
    value +
    "</div>"
  );
}

function renderInputs(list) {
  let box = $("inputsBox");
  let rows =
    Array.isArray(list) && list.length ? list : createDefaults().inputs;
  box.innerHTML =
    rows.map(inputRow).join("") +
    '<button id="addInput" class="tonal" type="button">+ ' +
    t.add +
    "</button>";
  box
    .querySelectorAll(".input-row .remove")
    .forEach((b) => (b.onclick = () => b.closest(".input-row").remove()));
  $("addInput").onclick = () => {
    let div = document.createElement("div");
    div.innerHTML = inputRow({});
    let row = div.firstChild;
    row.querySelector(".remove").onclick = () => row.remove();
    $("addInput").before(row);
  };
}

function sourceRow(src) {
  src = Object.assign(
    {
      id: "main",
      type: "http",
      method: "GET",
      url: "",
      responseType: "json",
      interval: 300,
      timeout: 5000,
      headers: {},
      entity: "",
      value: "",
      skipState: "",
    },
    src || {},
  );
  let headers =
      typeof src.headers === "string"
        ? src.headers
        : JSON.stringify(src.headers || {}),
    body =
      src.body === undefined
        ? ""
        : typeof src.body === "string"
          ? src.body
          : JSON.stringify(src.body);
  return (
    '<div class="array-card source-row"><div class="array-head"><strong>' +
    t.sourceSection +
    '</strong><button class="icon-btn remove" type="button">-</button></div><div class="field"><label>' +
    t.sourceId +
    '</label><input data-k="id" value="' +
    esc(src.id) +
    '"></div><div class="field"><label>' +
    t.sourceType +
    '</label><select data-k="type"><option value="http" ' +
    (src.type === "http" ? "selected" : "") +
    '>HTTP</option><option value="ha" ' +
    (src.type === "ha" ? "selected" : "") +
    '>Home Assistant</option></select></div><div class="field"><label>HA Entity</label><input data-k="entity" value="' +
    esc(src.entity) +
    '"></div><div class="field"><label>HA Value Path</label><input data-k="value" value="' +
    esc(src.value) +
    '" placeholder="state"></div><div class="field"><label>Skip State</label><input data-k="skipState" value="' +
    esc(src.skipState) +
    '" placeholder="idle"></div><div class="field"><label>' +
    t.sourceMethod +
    '</label><select data-k="method"><option value="GET" ' +
    (src.method === "GET" ? "selected" : "") +
    '>GET</option><option value="POST" ' +
    (src.method === "POST" ? "selected" : "") +
    '>POST</option></select></div><div class="field"><label>' +
    t.sourceUrl +
    '</label><input data-k="url" value="' +
    esc(src.url) +
    '"></div><div class="field"><label>' +
    t.responseType +
    '</label><select data-k="responseType"><option value="json" ' +
    (src.responseType === "json" ? "selected" : "") +
    '>JSON</option><option value="text" ' +
    (src.responseType === "text" ? "selected" : "") +
    '>Text</option><option value="number" ' +
    (src.responseType === "number" ? "selected" : "") +
    '>Number</option><option value="xml" ' +
    (src.responseType === "xml" ? "selected" : "") +
    '>XML</option></select></div><div class="field"><label>' +
    t.interval +
    '</label><input data-k="interval" type="number" value="' +
    esc(src.interval) +
    '"></div><div class="field"><label>' +
    t.timeout +
    '</label><input data-k="timeout" type="number" value="' +
    esc(src.timeout) +
    '"></div><div class="field"><label>' +
    t.headers +
    '</label><input data-k="headers" value="' +
    esc(headers) +
    '"></div><div class="field"><label>' +
    t.body +
    '</label><input data-k="body" value="' +
    esc(body) +
    '"></div></div>'
  );
}

function syncSourceBody(row) {
  let method = row.querySelector("[data-k=method]").value,
    body = row.querySelector("[data-k=body]"),
    type = row.querySelector("[data-k=type]").value,
    isHa = type === "ha",
    show = (k, on) => {
      let el = row.querySelector("[data-k=" + k + "]");
      el.disabled = !on;
      let field = el.closest(".field");
      if (field) field.style.display = on ? "" : "none";
    };
  show("body", !isHa && method !== "GET");
  if (method === "GET" || isHa) body.value = "";
  ["method", "url", "headers"].forEach((k) => show(k, !isHa));
  ["entity", "value", "skipState"].forEach((k) => show(k, isHa));
}

function wireSource(row) {
  row.querySelector(".remove").onclick = () => row.remove();
  row.querySelector("[data-k=method]").onchange = () => syncSourceBody(row);
  row.querySelector("[data-k=type]").onchange = () => syncSourceBody(row);
  syncSourceBody(row);
}

function renderSources(list) {
  let box = $("sourcesBox");
  let rows =
    Array.isArray(list) && list.length ? list : createDefaults().sources;
  box.innerHTML =
    rows.map(sourceRow).join("") +
    '<button id="addSource" class="tonal" type="button">+ ' +
    t.add +
    "</button>";
  box.querySelectorAll(".source-row").forEach(wireSource);
  $("addSource").onclick = () => {
    let div = document.createElement("div");
    div.innerHTML = sourceRow({});
    let row = div.firstChild;
    wireSource(row);
    $("addSource").before(row);
  };
}
function openCreateApp(data, mode) {
  hideFooterExport();
  formMode = mode || "create";
  E.secondaryAction.style.display = formMode === "edit" ? "none" : "";
  E.secondaryAction.textContent = t.useImport;
  E.secondaryAction.onclick = () => renderImportStep(1);
  E.saveSettings.style.display = "";
  E.saveSettings.textContent = formMode === "edit" ? t.saveSettings : t.create;
  currentApp = "__app_form__";
  E.sheetTitle.textContent = formMode === "edit" ? t.editApp : t.createApp;
  E.sheetStatus.textContent = "";
  let defaults = Object.assign(createDefaults(), data || {});
  E.fields.innerHTML =
    cf("cName", t.appNameLabel, "text", "") +
    createFieldHtml(["description", t.description, "text"], defaults) +
    createFieldHtml(
      [
        "appIcon",
        t.appIcon +
          ' <a class="icon-create-link" href="https://developer.lametric.com/icons" target="_blank" rel="noopener noreferrer">' +
          t.createIcon +
          "</a>",
        "text",
      ],
      defaults,
    ) +
    createFieldHtml(["author", t.author, "text"], defaults) +
    createFieldHtml(["tagsText", t.tags, "text"], defaults) +
    createFieldHtml(["version", t.version, "number"], defaults) +
    '<h4 class="form-section">' +
    t.inputsSection +
    '</h4><div id="inputsBox" class="array-list"></div><h4 class="form-section">' +
    t.sourceSection +
    '</h4><div id="sourcesBox" class="array-list"></div><h4 class="form-section">' +
    t.displaySection +
    "</h4>" +
    formDisplayFields()
      .map((f) => createFieldHtml(f, defaults))
      .join("");
  E.fields.querySelectorAll('select[id^="c_"]').forEach((i) => {
    i.dataset.create = "1";
    i.dataset.key = i.id.slice(2);
    i.dataset.type = "select";
  });
  renderInputs(defaults.inputs);
  renderSources(defaults.sources);
  if (data) setCreateForm(data);
  E.sheet.classList.add("show");
}
