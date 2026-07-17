let aboutVersionRequest, aboutUpdateTargetRequest;
let aboutUpdateRequest, aboutUpdateInstallRequest, aboutUpdateUploadRequest,
  aboutUpdateState = "idle", aboutUpdateResult, aboutUpdateTarget, aboutManualUpdateState = "idle";

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

function safeAboutUpdateText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validAboutUpdateTarget(target) {
  return target === "ulanzi" || target === "awtrix2-upgrade" ? target : "";
}

async function loadAboutUpdate() {
  let response = await fetch("/api/update", { cache: "no-store" });
  if (!response.ok) throw Error(t.updateCheckFailed);
  let result = await response.json();
  if (!result || typeof result !== "object" || result.ok !== true)
    throw Error(t.updateCheckFailed);
  if (result.updateAvailable === false) return {};
  if (result.updateAvailable !== true) throw Error(t.updateCheckFailed);
  let availableVersion = safeAboutUpdateText(result.availableVersion);
  if (!availableVersion) throw Error(t.updateCheckFailed);
  return { availableVersion };
}

function loadAboutUpdateTarget() {
  if (!aboutUpdateTargetRequest)
    aboutUpdateTargetRequest = fetch("/api/update/target", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw Error("update target failed");
        let result = await response.json(),
          target = validAboutUpdateTarget(result && result.target);
        if (!result || typeof result !== "object" || result.ok !== true || !target)
          throw Error("update target failed");
        aboutUpdateTarget = target;
        return target;
      })
      .finally(() => {
        aboutUpdateTargetRequest = null;
      });
  return aboutUpdateTargetRequest;
}

function startAboutUpdateCheck() {
  if (aboutUpdateRequest || aboutUpdateInstallRequest || aboutUpdateUploadRequest) return aboutUpdateRequest;
  aboutUpdateState = "checking";
  aboutUpdateResult = null;
  aboutUpdateRequest = loadAboutUpdate()
    .then((result) => {
      aboutUpdateResult = result;
      aboutUpdateState = result.availableVersion ? "available" : "none";
    })
    .catch(() => {
      aboutUpdateState = "error";
    })
    .finally(() => {
      aboutUpdateRequest = null;
    });
  return aboutUpdateRequest;
}

function startAboutUpdateInstall() {
  if (
    aboutUpdateRequest ||
    aboutUpdateInstallRequest || aboutUpdateUploadRequest ||
    aboutUpdateState !== "available"
  )
    return aboutUpdateInstallRequest;
  aboutUpdateState = "installing";
  aboutUpdateInstallRequest = fetch("/api/doupdate", { method: "POST" })
    .then((response) => {
      if (response.status !== 202) throw Error(t.updateInstallFailed);
      aboutUpdateState = "accepted";
    })
    .catch(() => {
      aboutUpdateState = "installError";
      throw Error(t.updateInstallFailed);
    })
    .finally(() => {
      aboutUpdateInstallRequest = null;
    });
  return aboutUpdateInstallRequest;
}

function renderAboutUpdateState(card, controls) {
  if (!isActiveAboutCard(card)) return;
  let busy = !!aboutUpdateRequest || !!aboutUpdateInstallRequest || !!aboutUpdateUploadRequest,
    available = aboutUpdateState === "available" || aboutUpdateState === "installing" || aboutUpdateState === "accepted" || aboutUpdateState === "installError";
  controls.check.disabled = busy || aboutUpdateState === "accepted";
  controls.check.textContent = aboutUpdateRequest ? t.checkingForUpdates : t.checkForUpdates;
  controls.details.style.display = available ? "" : "none";
  controls.install.disabled = busy || aboutUpdateState === "accepted";
  if (aboutUpdateResult)
    controls.availableVersion.textContent = aboutUpdateResult.availableVersion;
  if (aboutUpdateState === "checking") setStatus(controls.status, t.checkingForUpdates, false);
  else if (aboutUpdateState === "none") setStatus(controls.status, t.noUpdateAvailable, false);
  else if (aboutUpdateState === "available") setStatus(controls.status, t.updateAvailable, false);
  else if (aboutUpdateState === "installing") setStatus(controls.status, t.installingUpdate, false);
  else if (aboutUpdateState === "accepted") setStatus(controls.status, t.updateRestarting, false);
  else if (aboutUpdateState === "installError") setStatus(controls.status, t.updateInstallFailed, true);
  else if (aboutUpdateState === "error") setStatus(controls.status, t.updateCheckFailed, true);
  else setStatus(controls.status, "", false);
}

function manualFirmwareFilenameIsValid(file, target) {
  if (!file || typeof file.name !== "string") return false;
  let suffix = target === "ulanzi" || target === "awtrix2-upgrade"
    ? target
    : "(?:ulanzi|awtrix2-upgrade)";
  return new RegExp("^awtrix-light-\\d+\\.\\d+\\.\\d+-light-" + suffix + "\\.bin$").test(file.name);
}

function manualFirmwareExpectedName(target) {
  return target
    ? "awtrix-light-X.Y.Z-light-" + target + ".bin"
    : "awtrix-light-X.Y.Z-light-<target>.bin";
}

function renderAboutManualUpdateState(card, controls) {
  if (!isActiveAboutCard(card)) return;
  let busy = !!aboutUpdateRequest || !!aboutUpdateInstallRequest || !!aboutUpdateUploadRequest || aboutManualUpdateState === "accepted",
    target = aboutUpdateTarget,
    file = controls.file.files && controls.file.files[0],
    valid = manualFirmwareFilenameIsValid(file, target);
  controls.expected.textContent = manualFirmwareExpectedName(target);
  controls.target.style.display = target ? "" : "none";
  if (target) controls.target.textContent = t.manualUpdateTarget + ": " + target;
  controls.file.disabled = busy;
  controls.ack.disabled = busy;
  controls.upload.disabled = busy || !controls.ack.checked || !valid;
  if (aboutManualUpdateState === "invalid") setStatus(controls.status, t.manualUpdateInvalidFile, true);
  else if (aboutManualUpdateState === "uploading") setStatus(controls.status, t.manualUpdateUploading, false);
  else if (aboutManualUpdateState === "accepted") setStatus(controls.status, t.manualUpdateRestarting, false);
  else if (aboutManualUpdateState === "error") setStatus(controls.status, t.manualUpdateFailed, true);
  else setStatus(controls.status, "", false);
}

function startManualFirmwareUpload(file, target) {
  if (aboutUpdateRequest || aboutUpdateInstallRequest || aboutUpdateUploadRequest || aboutManualUpdateState === "accepted")
    return aboutUpdateUploadRequest;
  if (!manualFirmwareFilenameIsValid(file, target)) {
    aboutManualUpdateState = "invalid";
    return null;
  }
  aboutManualUpdateState = "uploading";
  let formData = new FormData();
  formData.append("firmware", file);
  aboutUpdateUploadRequest = fetch("/api/update/upload", {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (response.status !== 202) throw Error(t.manualUpdateFailed);
      aboutManualUpdateState = "accepted";
    })
    .catch(() => {
      aboutManualUpdateState = "error";
    })
    .finally(() => {
      aboutUpdateUploadRequest = null;
    });
  return aboutUpdateUploadRequest;
}

function renderAboutCard() {
  let versionCard = document.createElement("section"),
    updateCard = document.createElement("section"),
    title = document.createElement("h3"),
    field = document.createElement("div"),
    label = document.createElement("label"),
    value = document.createElement("output"),
    status = document.createElement("div"),
    updateTitle = document.createElement("h3"),
    actions = document.createElement("div"),
    check = document.createElement("button"),
    updateStatus = document.createElement("div"),
    details = document.createElement("div"),
    availableLabel = document.createElement("label"),
    availableVersion = document.createElement("output"),
    install = document.createElement("button"),
    warning = document.createElement("p"),
    manualDetails = document.createElement("div"),
    manualTitle = document.createElement("h4"),
    expectedLabel = document.createElement("label"),
    expected = document.createElement("output"),
    targetStatus = document.createElement("p"),
    file = document.createElement("input"),
    acknowledgement = document.createElement("input"),
    acknowledgementLabel = document.createElement("label"),
    acknowledgementRow = document.createElement("div"),
    upload = document.createElement("button"),
    manualStatus = document.createElement("div");
  versionCard.className = "settings-card";
  updateCard.className = "settings-card";
  title.textContent = t.about;
  field.className = "field";
  label.textContent = t.firmwareVersion;
  value.textContent = t.loadingSettings;
  status.className = "status";
  updateTitle.textContent = t.update;
  actions.className = "actions-inline";
  check.type = "button";
  check.className = "tonal";
  updateStatus.className = "status";
  details.className = "field";
  availableLabel.textContent = t.availableFirmwareVersion;
  install.type = "button";
  install.className = "primary";
  install.textContent = t.installUpdate;
  warning.className = "hint";
  warning.textContent = t.updateWarning;
  manualDetails.className = "field manual-update-details";
  manualTitle.textContent = t.manualUpdate;
  expectedLabel.textContent = t.manualUpdateExpectedName;
  targetStatus.className = "hint";
  file.type = "file";
  file.accept = ".bin,application/octet-stream";
  acknowledgement.type = "checkbox";
  acknowledgementLabel.textContent = t.manualUpdateAcknowledge;
  acknowledgementRow.className = "manual-update-acknowledgement";
  upload.type = "button";
  upload.className = "primary";
  upload.textContent = t.manualUpdateUpload;
  manualStatus.className = "status";
  details.appendChild(availableLabel);
  details.appendChild(availableVersion);
  details.appendChild(install);
  details.appendChild(warning);
  manualDetails.appendChild(manualTitle);
  manualDetails.appendChild(expectedLabel);
  manualDetails.appendChild(expected);
  manualDetails.appendChild(targetStatus);
  manualDetails.appendChild(file);
  acknowledgementRow.appendChild(acknowledgement);
  acknowledgementRow.appendChild(acknowledgementLabel);
  manualDetails.appendChild(acknowledgementRow);
  manualDetails.appendChild(upload);
  manualDetails.appendChild(manualStatus);
  actions.appendChild(check);
  field.appendChild(label);
  field.appendChild(value);
  versionCard.appendChild(title);
  versionCard.appendChild(field);
  versionCard.appendChild(status);
  updateCard.appendChild(updateTitle);
  updateCard.appendChild(actions);
  updateCard.appendChild(details);
  updateCard.appendChild(updateStatus);
  updateCard.appendChild(manualDetails);
  E.settingsGrid.appendChild(updateCard);
  E.settingsGrid.appendChild(versionCard);
  let controls = { check, status: updateStatus, details, availableVersion, install },
    manualControls = { expected, target: targetStatus, file, ack: acknowledgement, upload, status: manualStatus };
  check.onclick = () => {
    let request = startAboutUpdateCheck();
    renderAboutUpdateState(updateCard, controls);
    if (request)
      request.then(
        () => {
          renderAboutUpdateState(updateCard, controls);
          renderAboutManualUpdateState(updateCard, manualControls);
        },
        () => {
          renderAboutUpdateState(updateCard, controls);
          renderAboutManualUpdateState(updateCard, manualControls);
        },
      );
    renderAboutManualUpdateState(updateCard, manualControls);
  };
  install.onclick = () => {
    let request = startAboutUpdateInstall();
    renderAboutUpdateState(updateCard, controls);
    if (request)
      request.then(
        () => renderAboutUpdateState(updateCard, controls),
        () => renderAboutUpdateState(updateCard, controls),
      );
  };
  file.onchange = () => {
    aboutManualUpdateState = "idle";
    renderAboutManualUpdateState(updateCard, manualControls);
  };
  acknowledgement.onchange = () => renderAboutManualUpdateState(updateCard, manualControls);
  upload.onclick = () => {
    let request = startManualFirmwareUpload(
      file.files && file.files[0],
      aboutUpdateTarget,
    );
    renderAboutManualUpdateState(updateCard, manualControls);
    if (request)
      request.then(
        () => renderAboutManualUpdateState(updateCard, manualControls),
        () => renderAboutManualUpdateState(updateCard, manualControls),
      );
  };
  renderAboutUpdateState(updateCard, controls);
  renderAboutManualUpdateState(updateCard, manualControls);
  loadAboutUpdateTarget().then(
    () => renderAboutManualUpdateState(updateCard, manualControls),
    () => renderAboutManualUpdateState(updateCard, manualControls),
  );
  if (aboutUpdateRequest || aboutUpdateInstallRequest || aboutUpdateUploadRequest)
    (aboutUpdateRequest || aboutUpdateInstallRequest || aboutUpdateUploadRequest).then(
      () => {
        renderAboutUpdateState(updateCard, controls);
        renderAboutManualUpdateState(updateCard, manualControls);
      },
      () => {
        renderAboutUpdateState(updateCard, controls);
        renderAboutManualUpdateState(updateCard, manualControls);
      },
    );
  loadAboutVersion()
    .then((version) => {
      if (isActiveAboutCard(versionCard)) value.textContent = version;
    })
    .catch(() => {
      if (isActiveAboutCard(versionCard)) setStatus(status, t.versionLoadFailed, true);
    });
}
