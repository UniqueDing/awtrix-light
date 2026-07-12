function renderImportStep(step, data) {
  E.secondaryAction.style.display = "none";
  hideFooterExport();
  E.saveSettings.style.display = "none";
  if (step === 1) {
    E.sheetTitle.textContent = t.importPaste;
    E.fields.innerHTML =
      '<div class="import-screen"><div class="stepper"><b>1</b><span>' +
      t.importPaste +
      '</span><em>2</em><em>3</em></div><div class="field"><label>' +
      t.appJson +
      '</label><textarea id="importJsonText">' +
      appJsonSample() +
      '</textarea></div><div class="actions-inline"><button id="importCancel" class="tonal" type="button">' +
      t.manualCreate +
      '</button><button id="importNext" class="primary" type="button">' +
      t.importNext +
      "</button></div></div>";
    $("importCancel").onclick = () => openCreateApp(null, "create");
    $("importNext").onclick = () => {
      try {
        let parsed = normalizeImportedApp(
          JSON.parse($("importJsonText").value),
        );
        renderImportStep(2, parsed);
        setStatus(E.sheetStatus, "", false);
      } catch (e) {
        setStatus(E.sheetStatus, t.invalidJson, true);
      }
    };
    return;
  }
  if (step === 2) {
    E.sheetTitle.textContent = t.importPreview;
    E.fields.innerHTML =
      '<div class="import-screen"><div class="stepper"><em>1</em><b>2</b><span>' +
      t.importPreview +
      '</span><em>3</em></div><p class="hint">' +
      t.importReady +
      '</p><pre class="json-preview">' +
      esc(JSON.stringify(data, null, 2)) +
      '</pre><div class="actions-inline"><button id="importBack" class="tonal" type="button">' +
      t.importBack +
      '</button><button id="importApply" class="primary" type="button">' +
      t.importToForm +
      "</button></div></div>";
    $("importBack").onclick = () => renderImportStep(1);
    $("importApply").onclick = () => renderImportStep(3, data);
    return;
  }
  E.sheetTitle.textContent = t.importApply;
  E.fields.innerHTML =
    '<div class="import-screen"><div class="stepper"><em>1</em><em>2</em><b>3</b><span>' +
    t.importApply +
    '</span></div><p class="hint">' +
    t.importApplied +
    '</p><pre class="json-preview">' +
    esc(JSON.stringify(data, null, 2)) +
    '</pre><div class="actions-inline"><button id="importDone" class="primary" type="button">' +
    t.importApply +
    "</button></div></div>";
  $("importDone").onclick = () => {
    openCreateApp(data, "create");
    setStatus(E.sheetStatus, t.importApplied, false);
  };
}
