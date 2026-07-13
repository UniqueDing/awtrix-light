function bindUiHandlers() {
  if (E.createApp) E.createApp.onclick = () => openCreateApp(null, "create");
  if (E.globalDisplay) E.globalDisplay.onclick = openGlobalDisplaySettings;
  if (E.themeBtn) {
    E.themeBtn.onclick = () => {
      localStorage.awtrixTheme = document.body.classList.contains("dark")
        ? "light"
        : "dark";
      applyTheme();
    };
  }
  if (E.langBtn) {
    E.langBtn.onclick = () => {
      lang = t.langToggleShort;
      localStorage.awtrixLang = lang;
      applyLang();
      storeLoaded = false;
      loadStore();
    };
  }
  if (E.closeSheet) {
    E.closeSheet.onclick = () => {
      if (
        String(currentApp || "").startsWith("__cast_external__") &&
        window.currentCastAppApi
      ) {
        let closingApi = window.currentCastAppApi;
        closingApi
          .close()
          .catch((e) => setStatus(E.sheetStatus, e.message, true));
        return;
      }
      if (currentApp === "__stopwatch__") stopwatchStop().catch(() => {});
      if (currentApp === "__countdown__") countdownStop().catch(() => {});
      E.saveSettings.onclick = saveAppSettings;
      E.sheet.classList.remove("show");
    };
  }
  if (E.saveSettings) E.saveSettings.onclick = saveAppSettings;
  if (E.fileRefreshBtn)
    E.fileRefreshBtn.onclick = () => loadFiles(currentFileDir);
  if (E.fileBackBtn)
    E.fileBackBtn.onclick = () => loadFiles(parentFileDir(currentFileDir));
  if (E.fileUploadBtn)
    E.fileUploadBtn.onclick = () => E.fileUploadInput.click();
  if (E.fileUploadInput) {
    E.fileUploadInput.onchange = (e) => {
      let file = e.target.files && e.target.files[0];
      if (file)
        uploadFileToCurrentDir(file).catch((err) =>
          setStatus($("filesStatus"), err.message, true),
        );
      e.target.value = "";
    };
  }
  if (E.fileNewBtn) E.fileNewBtn.onclick = () => openCreateFileDialog(false);
  if (E.fileNewFolderBtn)
    E.fileNewFolderBtn.onclick = () => openCreateFileDialog(true);
  if (E.fileSaveBtn)
    E.fileSaveBtn.onclick = () =>
      saveSelectedFile().catch((err) =>
        setStatus($("filesStatus"), err.message, true),
      );
  if (E.fileDeleteBtn)
    E.fileDeleteBtn.onclick = () =>
      deleteSelectedFile().catch((err) =>
        setStatus($("filesStatus"), err.message, true),
      );
  if (E.fileEditor) {
    E.fileEditor.oninput = () => {
      fileDirty = true;
      E.fileSaveBtn.disabled = selectedFileBinary || !selectedFilePath;
    };
    resetFileEditor();
  }
  if (E.settingsTab) E.settingsTab.onclick = () => activate("settings", false);
  if (E.wifiTab) E.wifiTab.style.display = "none";
  if (E.storeTab) E.storeTab.onclick = () => activate("store", false);
  if (E.libraryTab) E.libraryTab.onclick = () => activate("library", false);
  if (E.filesTab) E.filesTab.onclick = () => activate("files", false);
  if (E.saveDeviceSettings) E.saveDeviceSettings.onclick = saveDeviceSettings;
  window.onpopstate = () =>
    activate(
      location.pathname === "/settings" || location.pathname === "/wifi"
        ? "settings"
        : location.pathname === "/my-apps"
          ? "library"
          : location.pathname === "/files"
            ? "files"
            : "store",
      true,
    );
}

bindUiHandlers();
initAuth();
