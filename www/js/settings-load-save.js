async function loadDeviceSettings() {
  setStatus(E.settingsStatus, "", false);
  if (settings && Object.keys(settings).length) renderDeviceSettings();
  try {
    let r = await fetch("/api/settings", {
      cache: "no-store",
    });
    if (!r.ok) throw Error("settings failed");
    settings = await r.json();
    renderDeviceSettings();
    loadLegacySettings()
      .then(() => {
        if (E.settingsPanel.classList.contains("active"))
          renderDeviceSettings();
      })
      .catch((e) => dbg("legacySettings:err " + e.message));
  } catch (e) {
    if (!settings || !Object.keys(settings).length) {
      E.settingsEmpty.style.display = "block";
      E.settingsEmpty.textContent = e.message;
    }
    setStatus(E.settingsStatus, e.message, true);
  }
}
