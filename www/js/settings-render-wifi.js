function renderGroupCards(groups, source) {
  groups.forEach((g) => {
    let card = document.createElement("section");
    card.className = "settings-card";
    let h = document.createElement("h3");
    h.textContent = g.title;
    card.appendChild(h);
    g.fields.forEach((f) => addSettingsField(card, f, source));
    if (Array.isArray(g.actions)) addSettingsActions(card, g.actions);
    if (card.querySelector(".field")) E.settingsGrid.appendChild(card);
  });
}

function addSettingsActions(card, actions) {
  let row = document.createElement("div");
  row.className = "actions-inline";
  actions.forEach((action) => {
    let button = document.createElement("button");
    button.type = "button";
    button.className = "tonal";
    button.textContent = action.label;
    button.onclick = () => testIntegration(action.test, button);
    row.appendChild(button);
  });
  card.appendChild(row);
}

function settingInputValue(key) {
  let input = E.settingsGrid.querySelector('[data-key="' + key + '"]');
  if (!input) return legacySettings[key] ?? "";
  if (input.dataset.type === "checkbox") return input.value === "on";
  if (input.dataset.type === "number") return Number(input.value || 0);
  return input.value || "";
}

async function testIntegration(type, button) {
  let original = button.textContent;
  button.disabled = true;
  button.textContent = "...";
  try {
    let body =
        type === "mqtt"
          ? {
              Broker: settingInputValue("Broker"),
              Port: settingInputValue("Port"),
              Username: settingInputValue("Username"),
              Password: settingInputValue("Password"),
            }
          : {
              "HA Base URL": settingInputValue("HA Base URL"),
              "HA Token": settingInputValue("HA Token"),
            },
      response = await fetch("/api/integrations/test-" + type, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw Error(result.error || t.testFailed);
    setStatus(E.settingsStatus, t.testPassed, false);
  } catch (e) {
    setStatus(E.settingsStatus, e.message, true);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function renderDeviceSettings() {
  let apiGroups = deviceSettingGroups(),
    legacyGroups = legacySettingGroups(),
    apiSection = apiGroups[settingsSection] || [],
    legacySection = legacyGroups[settingsSection] || [];
  if (apiSection && !Array.isArray(apiSection))
    apiSection = Object.values(apiSection).flat();
  if (legacySection && !Array.isArray(legacySection))
    legacySection = Object.values(legacySection).flat();
  E.settingsGrid.innerHTML = "";
  renderSettingsTabs();
  E.saveDeviceSettings.style.display = settingsSection === "about" ? "none" : "";
  E.settingsEmpty.style.display = "none";
  if (settingsSection === "about") {
    renderAboutCard();
    return;
  }
  if (settingsSection === "network")
    renderWifiSetupCard(E.settingsGrid, "settings");
  renderGroupCards(apiSection || [], "api");
  renderGroupCards(legacySection || [], "legacy");
  if (!E.settingsGrid.querySelector(".settings-card"))
    E.settingsEmpty.style.display = "block";
}
function wifiIds(prefix) {
  let p = prefix || "settings";
  return {
    ssid: p + "WifiSsid",
    list: p + "WifiSsidList",
    password: p + "WifiPassword",
    status: p + "WifiStatus",
    scan: p + "WifiScan",
    connect: p + "WifiConnect",
  };
}
function renderWifiSetupCard(target, prefix) {
  let box = target || E.settingsGrid,
    ids = wifiIds(prefix),
    card = document.createElement("section");
  card.className = "settings-card wifi-card";
  card.innerHTML =
    "<h3>" +
    t.wifiSetupCard +
    '</h3><p class="hint">' +
    t.scanNearby +
    '</p><div class="field wifi-ssid-field"><label>SSID</label><div class="wifi-ssid-row"><div class="wifi-ssid-input"><input id="' +
    ids.ssid +
    '" type="text" list="' +
    ids.list +
    '" placeholder="SSID" autocomplete="off"><span class="wifi-dropdown" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg></span></div><button id="' +
    ids.scan +
    '" class="icon-btn wifi-scan" type="button" aria-label="' +
    t.scanWifi +
    '" title="' +
    t.scanWifi +
    '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5M4 18v-5h5M18.5 9A7 7 0 0 0 6.3 6.8L4 11M20 13l-2.3 4.2A7 7 0 0 1 5.5 15"/></svg></button><datalist id="' +
    ids.list +
    '"></datalist></div><div class="field"><label>' +
    t.wifiPassword +
    '</label><input id="' +
    ids.password +
    '" type="password" autocomplete="new-password"></div><button id="' +
    ids.connect +
    '" class="primary wifi-connect" type="button">' +
    t.connectWifi +
    '</button><div id="' +
    ids.status +
    '" class="status"></div>';
  box.appendChild(card);
  $(ids.scan).onclick = () => scanWifiNetworks(prefix);
  $(ids.connect).onclick = () => connectWifiNetwork(prefix);
}
function renderWifiSetupPage() {
  E.wifiGrid.innerHTML = "";
  renderWifiSetupCard(E.wifiGrid, "wifi");
  E.wifiEmpty.style.display = "none";
}
async function scanWifiNetworks(prefix) {
  let ids = wifiIds(prefix),
    status = $(ids.status),
    listEl = $(ids.list),
    input = $(ids.ssid);
  status.textContent = t.scanning;
  status.className = "status";
  try {
    let r = await fetch("/scan", {
      cache: "no-store",
    });
    if (!r.ok) throw Error("scan failed");
    let list = await r.json();
    listEl.innerHTML = "";
    (Array.isArray(list) ? list : []).forEach((n) => {
      let opt = document.createElement("option");
      opt.value = n.ssid || "";
      opt.label =
        (n.selected ? "✓ " : "") +
        (n.ssid || "") +
        " " +
        (n.strength ? "(" + n.strength + " dBm)" : "");
      if (n.selected && !input.value) input.value = n.ssid || "";
      listEl.appendChild(opt);
    });
    status.textContent =
      t.found + (Array.isArray(list) ? list.length : 0) + t.networks;
  } catch (e) {
    status.textContent = e.message;
    status.className = "status error";
  }
}
async function connectWifiNetwork(prefix) {
  let ids = wifiIds(prefix),
    status = $(ids.status),
    ssid = ($(ids.ssid).value || "").trim(),
    password = $(ids.password).value;
  if (!ssid) {
    status.textContent = t.selectSsid;
    status.className = "status error";
    return;
  }
  status.textContent = t.connecting;
  status.className = "status";
  try {
    let body = new URLSearchParams({
        ssid: ssid,
        password: password,
        persistent: "true",
      }),
      r = await fetch("/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
    let text = await r.text();
    if (!r.ok) throw Error(text || "wifi failed");
    status.textContent = text || t.saved;
  } catch (e) {
    status.textContent = e.message;
    status.className = "status error";
  }
}
async function loadLegacySettings() {
  try {
    let r = await fetch("/DoNotTouch.json", {
      cache: "no-store",
    });
    legacySettings = r.ok ? await r.json() : {};
  } catch (e) {
    legacySettings = {};
  }
}
