function parseMaybeJson(v, fallback) {
  if (!String(v || "").trim()) return fallback;
  return JSON.parse(v);
}

function collectInputs() {
  return Array.from(document.querySelectorAll("#inputsBox .input-row"))
    .map((r) => {
      let input = {
          id: r.querySelector("[data-k=id]").value,
          label: r.querySelector("[data-k=label]").value,
          type: r.querySelector("[data-k=type]").value,
        },
        description = r.querySelector("[data-k=description]"),
        value = r.querySelector("[data-k=value]");
      if (description && description.value)
        input.description = description.value;
      if (value) input.value = value.value;
      return input;
    })
    .filter((i) => i.id);
}

function collectSources() {
  return Array.from(document.querySelectorAll("#sourcesBox .source-row"))
    .map((r) => {
      let method = r.querySelector("[data-k=method]").value,
        type = r.querySelector("[data-k=type]").value || "http",
        source = {
          id: r.querySelector("[data-k=id]").value || "main",
          type: type,
          method: method,
          url: r.querySelector("[data-k=url]").value || "",
          responseType:
            r.querySelector("[data-k=responseType]").value || "json",
          interval: Number(r.querySelector("[data-k=interval]").value || 0),
          timeout: Number(r.querySelector("[data-k=timeout]").value || 0),
          headers: parseMaybeJson(
            r.querySelector("[data-k=headers]").value,
            {},
          ),
        },
        body = r.querySelector("[data-k=body]").value,
        entity = r.querySelector("[data-k=entity]").value,
        value = r.querySelector("[data-k=value]").value,
        skipState = r.querySelector("[data-k=skipState]").value;
      if (type === "ha") {
        source.method = "GET";
        source.url = "";
        source.headers = {};
        if (entity) source.entity = entity;
        if (value) source.value = value;
        if (skipState) source.skipState = skipState;
      } else if (method !== "GET" && body.trim())
        source.body = parseMaybeJson(body, body);
      return source;
    })
    .filter((s) => s.id);
}

function collectCreatePayload() {
  let display = {
    text: $("c_displayText").value || "",
    icon: $("c_displayIcon").value || "",
    color: $("c_displayColor").value,
    background: $("c_displayBackground").value,
  };
  let progress = Number($("c_displayProgress").value);
  if (progress >= 0) {
    display.progress = progress;
    display.progressC = $("c_displayProgressC").value;
    display.progressBC = $("c_displayProgressBC").value;
  }
  return withDisplayCompatibility({
    name: $("cName").value.trim(),
    description: $("c_description").value || "",
    icon: $("c_appIcon").value || "",
    author: $("c_author").value || "",
    tags: ($("c_tagsText").value || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    version: Number($("c_version").value || 1),
    inputs: collectInputs(),
    sources: collectSources(),
    display: display,
  });
}
async function saveCreateApp() {
  let name = $("cName").value.trim(),
    payload;
  if (!name) {
    setStatus(E.sheetStatus, t.nameRequired, true);
    return;
  }
  try {
    payload = collectCreatePayload();
    setStatus(E.sheetStatus, t.saving, false);
    let r = await fetch(
      "/api/custom?name=" + encodeURIComponent(name) + "&save=1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!r.ok) throw Error("save failed");
    libraryLoaded = false;
    await loadLibrary();
    storeLoaded = false;
    loadStore();
    setStatus(E.sheetStatus, t.saved, false);
    E.sheet.classList.remove("show");
  } catch (e) {
    setStatus(E.sheetStatus, e.message, true);
  }
}
