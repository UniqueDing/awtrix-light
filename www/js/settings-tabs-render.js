function renderSettingsTabs(target) {
  let labels = settingTabLabels(),
    order = ["device", "network", "integrations", "auth", "files", "about"],
    tabs = document.createElement("div"),
    active = E.filesPanel.classList.contains("active")
      ? "files"
      : settingsSection;
  tabs.className = "settings-tabs";
  order.forEach((k) => {
    let b = document.createElement("button");
    b.type = "button";
    b.className = "tonal settings-tab" + (active === k ? " active" : "");
    b.textContent = labels[k];
    b.onclick = () => {
      if (k === "files") {
        activate("files", false);
        return;
      }
      settingsSection = k;
      if (E.filesPanel.classList.contains("active"))
        activate("settings", false);
      else renderDeviceSettings();
    };
    tabs.appendChild(b);
  });
  (target || E.settingsGrid).appendChild(tabs);
}
