function renderCastAppStore() {
  let sf = $("storeFilter");
  if (sf) sf.classList.add("show");
  E.storeGrid.innerHTML = "";
  renderAppKindTabs();
  renderStoreSourceBar();
  E.storeGrid.className = "store-table";
  let installedMap = castInstalledMap(),
    installed = new Set(Object.keys(installedMap));
  let renderCastGrid = () => {
    let input = $("storeSearchInput"),
      filter = input ? input.value.toLowerCase() : "",
      active = $("storeTags") && $("storeTags").querySelector(".active"),
      tag = active && active.dataset ? active.dataset.tag : "all";
    E.storeGrid.innerHTML = "";
    let visible = castStoreCatalog.filter((app) => {
      let appTags = app.tags || [];
      if (tag !== "all" && !appTags.includes(tag)) return false;
      if (filter) {
        let name = castAppName(app).toLowerCase(),
          desc = castAppDescription(app).toLowerCase(),
          tags = appTags.join(" ").toLowerCase();
        if (
          !name.includes(filter) &&
          !desc.includes(filter) &&
          !tags.includes(filter)
        )
          return false;
      }
      return true;
    });
    E.storeGrid.classList.toggle(
      "store-grid-compact",
      (filter || tag !== "all") && visible.length > 0,
    );
    visible.forEach((app) => {
      let installedApp = installedMap[app.id],
        isInstalled = installed.has(app.id),
        compatible = isCompatibleVersion(app, storeFirmwareVersion),
        hasUpdate =
          compatible &&
          isInstalled &&
          app.version &&
          installedApp &&
          installedApp.version &&
          compareVersions(app.version, installedApp.version) > 0,
        row = document.createElement("article");
      row.className = "store-row" + (isInstalled ? " installed" : "");
      row.innerHTML =
        '<div class="app-icon"></div><div class="name"></div><div class="meta"></div><button class="tonal" type="button"></button>';
      setIcon(
        row.querySelector(".app-icon"),
        app.icon || "JS",
        storeBase(selectedStoreSource().url),
      );
      row.querySelector(".name").textContent = castAppName(app);
      row.querySelector(".meta").textContent = castAppDescription(app);
      let btn = row.querySelector("button");
      btn.textContent = !compatible
          ? incompatibleText(app)
          : hasUpdate
            ? t.update
            : isInstalled
              ? t.installed
              : t.install;
      btn.disabled = !compatible || isInstalled && !hasUpdate;
      btn.classList.toggle("primary", compatible && (!isInstalled || hasUpdate));
      btn.classList.toggle("tonal", !compatible || isInstalled && !hasUpdate);
      btn.classList.toggle("incompatible", !compatible);
      if (compatible && (!isInstalled || hasUpdate))
        btn.onclick = () => installCastApp(app.id, btn);
      else btn.onclick = null;
      E.storeGrid.appendChild(row);
    });
  };
  let makeTag = (box, l, v) => {
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
      renderCastGrid();
      renderCastTags();
    };
    return b;
  };
  let inp = $("storeSearchInput");
  if (inp) inp.oninput = renderCastGrid;
  let tags = $("storeTags"),
    castTagsExpanded = false,
    renderCastTags = () => {
      if (!tags) return;
      let limit = 8,
        counts = {};
      castStoreCatalog.forEach((app) =>
        (app.tags || []).forEach((t) => (counts[t] = (counts[t] || 0) + 1)),
      );
      let sorted = Object.keys(counts).sort(
          (a, b) => counts[b] - counts[a] || a.localeCompare(b),
        ),
        active = tags.querySelector(".store-tag.active"),
        activeTag = active && active.dataset ? active.dataset.tag : "all",
        shown = castTagsExpanded ? sorted : sorted.slice(0, limit);
      if (
        !castTagsExpanded &&
        activeTag !== "all" &&
        sorted.includes(activeTag) &&
        !shown.includes(activeTag)
      )
        shown = shown.concat(activeTag);
      tags.innerHTML = "";
      tags.appendChild(makeTag(tags, t.all, "all"));
      shown.forEach((t) => tags.appendChild(makeTag(tags, t, t)));
      let next = [...tags.querySelectorAll(".store-tag")].find(
        (x) => x.dataset && x.dataset.tag === activeTag,
      );
      if (next) {
        tags
          .querySelectorAll(".store-tag")
          .forEach((x) => x.classList.remove("active"));
        next.classList.add("active");
      }
      if (sorted.length > limit) {
        let more = document.createElement("button");
        more.type = "button";
        more.className = "tonal store-tag store-tag-more";
        more.textContent = castTagsExpanded ? t.less : t.more;
        more.onclick = () => {
          castTagsExpanded = !castTagsExpanded;
          renderCastTags();
        };
        tags.appendChild(more);
      }
    };
  renderCastTags();
  renderCastGrid();
  setStatus(E.storeStatus, castUi("castHint"), false);
}
