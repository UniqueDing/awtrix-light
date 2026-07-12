async function loadStore() {
  let requestId = ++storeLoadRequestId;
  storeLoaded = true;
  let source = selectedStoreSource(),
    storeUrl = storeManifestUrl(source.url);
  renderStoreSourceBar();
  await loadStoreFirmwareVersion();
  if (requestId !== storeLoadRequestId) return;
  if (activeStoreKind === "cast") {
    castModuleV++;
    castModuleCache = {};
    try {
      let loaded = await loadStoreManifest(storeUrl),
        data = loaded.data,
        loadedUrl = loaded.url,
        base = storeBase(loadedUrl);
      if (requestId !== storeLoadRequestId) return;
      castStoreCatalog = normalizeLiveStoreList(data, base);
      await loadCastInstalledMap();
      if (requestId !== storeLoadRequestId) return;
      renderCastAppStore();
      setStatus(
        E.storeStatus,
        (source.name || loadedUrl) + " - " + loadedUrl,
        false,
      );
    } catch (e) {
      if (requestId !== storeLoadRequestId) return;
      console.warn("store load failed", e);
      castStoreCatalog = [];
      renderCastAppStore();
      setStatus(E.storeStatus, storeLoadFailedMessage(), true);
    }
    return;
  }
  try {
    let [loaded, appsRes] = await Promise.all([
        loadStoreManifest(storeUrl),
        fetch("/api/apps"),
      ]),
      data = loaded.data,
      loadedUrl = loaded.url,
      installed = await appsRes.json(),
      list = normalizeStoreList(data),
      base = storeBase(loadedUrl);
    if (requestId !== storeLoadRequestId) return;
    if (!list || (!Array.isArray(list) && !list.flow))
      throw Error("invalid app store response");
    let installedList = Array.isArray(installed) ? installed : [],
      sourceLabel = source.name || loadedUrl,
      installedNames = new Set(installedList.map((a) => a && a.name)),
      installedMap = {};
    installedList.forEach((a) => {
      if (a && a.name) installedMap[a.name] = a;
    });
    E.storeGrid.innerHTML = "";
    E.storeGrid.className = "store-table";
    renderStoreSourceBar();
    let sf = $("storeFilter");
    if (sf) sf.classList.add("show");
    let doStoreRender = () => {
      E.storeGrid.innerHTML = "";
      let filter = $("storeSearchInput").value.toLowerCase();
      let tag = $("storeTags").querySelector(".active")?.dataset?.tag || "all";
      let compact = filter || tag !== "all";
      E.storeGrid.classList.toggle("store-grid-compact", false);
      let items = Array.isArray(list)
        ? list.filter(
            (item) =>
              item &&
              (item.type === "flow" || item.type === "animation" || !item.type),
          )
        : [];
      if (!items.length) {
        let f = list.flow || [],
          a = list.animation || [];
        let ff = filter ? f.filter((i) => matchStoreFilter(i, filter)) : f;
        let aa = filter ? a.filter((i) => matchStoreFilter(i, filter)) : a;
        if (tag !== "all") {
          ff = ff.filter((i) => (i.tags || []).includes(tag));
          aa = aa.filter((i) => (i.tags || []).includes(tag));
        }
        renderStoreSection(t.flowAppSection, ff, compact);
        renderStoreSection(t.animationAppSection, aa, compact);
      } else {
        if (filter) items = items.filter((i) => matchStoreFilter(i, filter));
        if (tag !== "all")
          items = items.filter((i) => (i.tags || []).includes(tag));
        E.storeGrid.classList.toggle(
          "store-grid-compact",
          compact && items.length > 0,
        );
        if (items.length) appendItems(E.storeGrid, items);
      }
    };
    let matchStoreFilter = (item, q) =>
      appName(item, 0).toLowerCase().includes(q) ||
      (item.description || "").toLowerCase().includes(q) ||
      (item.tags || []).join(" ").toLowerCase().includes(q);
    let renderStoreTags = () => {
      let box = $("storeTags");
      if (!box) return;
      let expanded = false,
        limit = 8,
        items = Array.isArray(list)
          ? list
          : [...(list.flow || []), ...(list.animation || [])],
        counts = {};
      items.forEach((i) =>
        (i.tags || []).forEach((t) => (counts[t] = (counts[t] || 0) + 1)),
      );
      let sorted = Object.keys(counts).sort(
        (a, b) => counts[b] - counts[a] || a.localeCompare(b),
      );
      let make = (l, v) => {
        let b = document.createElement("button");
        b.type = "button";
        b.className = "tonal store-tag" + (v === "all" ? " active" : "");
        b.textContent = l;
        b.dataset.tag = v;
        b.onclick = () => {
          box
            .querySelectorAll(".store-tag")
            .forEach((x) => x.classList.remove("active"));
          b.classList.add("active");
          doStoreRender();
          render();
        };
        return b;
      };
      let render = () => {
        let active = box.querySelector(".store-tag.active"),
          activeTag = active && active.dataset ? active.dataset.tag : "all",
          shown = expanded ? sorted : sorted.slice(0, limit);
        if (
          !expanded &&
          activeTag !== "all" &&
          sorted.includes(activeTag) &&
          !shown.includes(activeTag)
        )
          shown = shown.concat(activeTag);
        box.innerHTML = "";
        box.appendChild(make(t.all, "all"));
        shown.forEach((t) => box.appendChild(make(t, t)));
        let next = [...box.querySelectorAll(".store-tag")].find(
          (x) => x.dataset && x.dataset.tag === activeTag,
        );
        if (next) {
          box
            .querySelectorAll(".store-tag")
            .forEach((x) => x.classList.remove("active"));
          next.classList.add("active");
        }
        if (sorted.length > limit) {
          let more = document.createElement("button");
          more.type = "button";
          more.className = "tonal store-tag store-tag-more";
          more.textContent = expanded ? t.less : t.more;
          more.onclick = () => {
            expanded = !expanded;
            render();
          };
          box.appendChild(more);
        }
      };
      render();
    };
    let inp = $("storeSearchInput");
    if (inp) inp.oninput = doStoreRender;
    let appendItems = (target, items) => {
      items.forEach((item) => {
        let row = document.createElement("article");
        let name = appName(item, 0),
          id = item.id || name,
          manifest =
            item.manifest ||
            item.url ||
            "apps/" + encodeURIComponent(id) + ".json",
          isInstalled = installedNames.has(id) || installedNames.has(name);
        row.className = "store-row" + (isInstalled ? " installed" : "");
        row.innerHTML =
          '<div class="app-icon"></div><div class="name"></div><div class="meta"></div><button class="primary" type="button"></button>';
        setIcon(row.querySelector(".app-icon"), item.icon || name, base);
        row.querySelector(".name").textContent = name;
        row.querySelector(".meta").textContent =
          item.description || t.localJson;
        let btn = row.querySelector("button"),
          installedVersion = installedAppVersion(installedMap, id, name),
          compatible = isCompatibleVersion(item, storeFirmwareVersion),
          hasUpdate =
            compatible &&
            isInstalled &&
            item.version &&
            installedVersion &&
            compareVersions(item.version, installedVersion) > 0;
        btn.textContent = !compatible ? incompatibleText(item) : hasUpdate ? t.update : isInstalled ? t.installed : t.install;
        btn.disabled = !compatible || isInstalled && !hasUpdate;
        btn.classList.toggle("primary", compatible && (!isInstalled || hasUpdate));
        btn.classList.toggle("tonal", !compatible || isInstalled && !hasUpdate);
        btn.classList.toggle("incompatible", !compatible);
        if (compatible && (!isInstalled || hasUpdate))
          btn.onclick = () =>
            installApp(
              Object.assign({}, item, {
                id,
                manifestUrl: resolveStoreUrl(manifest, base),
              }),
              btn,
              name,
            );
        target.appendChild(row);
      });
    };
    let renderStoreSection = (title, items, compact) => {
      if (!items.length) return;
      let s = document.createElement("section");
      s.className = "store-section";
      s.innerHTML =
        '<div class="store-section-head"><div class="store-section-title"><h3>' +
        title +
        '</h3></div></div><div class="store-section-grid"></div>';
      let grid = s.querySelector(".store-section-grid");
      grid.classList.toggle("store-grid-compact", !!compact && items.length);
      appendItems(grid, items);
      E.storeGrid.appendChild(s);
    };
    renderStoreTags();
    doStoreRender();
    setStatus(
      E.storeStatus,
      sourceLabel + " - " + loadedUrl,
      false,
    );
  } catch (e) {
    if (requestId !== storeLoadRequestId) return;
    E.storeGrid.innerHTML = "";
    renderStoreSourceBar();
    setStatus(E.storeStatus, e.message, true);
  }
}

async function installApp(item, btn, name, quiet) {
  let originalText = btn ? btn.textContent : "",
    done = false;
  if (btn) {
    btn.disabled = true;
    btn.textContent = t.installing || originalText;
  }
  if (!quiet) setStatus(E.storeStatus, "...", false);
  try {
    await loadStoreFirmwareVersion();
    if (!isCompatibleVersion(item, storeFirmwareVersion))
      throw Error(incompatibleText(item));
    let manifestUrl = item.manifestUrl || item.manifest || item.url;
    if (!manifestUrl) throw Error("missing app manifest");
    let appRes = await rawFetch(manifestUrl, { cache: "no-store" });
    if (!appRes.ok) throw Error("download failed");
    let payload = await appRes.json(),
      installName = payload.name || item.name || item.id || name;
    if (!isCompatibleVersion(payload, storeFirmwareVersion)) throw Error(incompatibleText(payload));
    if (payload.version === undefined && item.version !== undefined)
      payload.version = item.version;
    if (!installName) throw Error("missing app name");
    await installIconForApp(payload, item, storeBase(manifestUrl));
    payload = withDisplayCompatibility(payload);
    payload.save = true;
    let r = await fetch(
      "/api/custom?name=" + encodeURIComponent(installName) + "&save=1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!r.ok) throw Error((await r.text()) || "install failed");
    done = true;
    if (btn) {
      btn.textContent = t.installed;
      btn.onclick = null;
      btn.classList.remove("primary");
      btn.classList.add("tonal");
      let row = btn.closest(".store-row");
      if (row) row.classList.add("installed");
    }
    if (!quiet) setStatus(E.storeStatus, name + " " + t.installed, false);
    libraryLoaded = false;
    return true;
  } catch (e) {
    setStatus(E.storeStatus, e.message, true);
    return false;
  } finally {
    if (btn && !done) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}
