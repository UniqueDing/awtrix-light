let aboutVersionRequest;

function isActiveAboutCard(card) {
  return (
    card.parentNode === E.settingsGrid &&
    settingsSection === "about" &&
    (!E.settingsPanel || E.settingsPanel.classList.contains("active")) &&
    (!E.filesPanel || !E.filesPanel.classList.contains("active"))
  );
}

function loadAboutVersion() {
  if (!aboutVersionRequest)
    aboutVersionRequest = fetch("/version", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw Error(t.versionLoadFailed);
        let version = (await response.text()).trim();
        if (!version) throw Error(t.versionLoadFailed);
        return version;
      })
      .finally(() => {
        aboutVersionRequest = null;
      });
  return aboutVersionRequest;
}

function renderAboutCard() {
  let card = document.createElement("section"),
    title = document.createElement("h3"),
    field = document.createElement("div"),
    label = document.createElement("label"),
    value = document.createElement("output"),
    status = document.createElement("div");
  card.className = "settings-card";
  title.textContent = t.about;
  field.className = "field";
  label.textContent = t.firmwareVersion;
  value.textContent = t.loadingSettings;
  status.className = "status";
  field.appendChild(label);
  field.appendChild(value);
  card.appendChild(title);
  card.appendChild(field);
  card.appendChild(status);
  E.settingsGrid.appendChild(card);
  loadAboutVersion()
    .then((version) => {
      if (isActiveAboutCard(card)) value.textContent = version;
    })
    .catch(() => {
      if (isActiveAboutCard(card)) setStatus(status, t.versionLoadFailed, true);
    });
}
