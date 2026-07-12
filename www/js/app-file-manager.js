function joinFilePath(dir, name) {
  return (dir.endsWith("/") ? dir : dir + "/") + name;
}

function parentFileDir(path) {
  if (path === "/" || !path) return "/";
  let p = path.replace(/\/$/, "").replace(/\/[^/]+$/, "/");
  return p || "/";
}

let fileViewRequestId = 0;

function selectFileTarget(path, btn, isDir) {
  fileViewRequestId++;
  selectedFilePath = path;
  selectedFileBinary = !!isDir;
  fileDirty = false;
  E.fileSelected.textContent = path;
  E.fileEditor.value = "";
  E.fileEditor.style.display = "none";
  E.fileSaveBtn.disabled = true;
  E.fileDeleteBtn.disabled = false;
  $("fileImage").style.display = "none";
  $("fileImage").removeAttribute("src");
  $("filePreview").style.display = "block";
  $("filePreview").textContent = isDir ? t.folderName + ": " + path : "";
  document
    .querySelectorAll(".file-item.active")
    .forEach((x) => x.classList.remove("active"));
  if (btn) btn.classList.add("active");
}

function resetFileEditor() {
  selectedFilePath = "";
  selectedFileBinary = false;
  fileDirty = false;
  E.fileSelected.textContent = t.noFileSelected;
  E.fileEditor.value = "";
  E.fileEditor.style.display = "none";
  $("filePreview").textContent = "";
  $("filePreview").style.display = "block";
  $("fileImage").style.display = "none";
  E.fileSaveBtn.disabled = true;
  E.fileDeleteBtn.disabled = true;
}

function fileUsageText(used, total) {
  let pct = total > 0 ? Math.round((used / total) * 100) : 0,
    fmt = (n) =>
      n >= 1048576
        ? (n / 1048576).toFixed(1) + " MB"
        : n >= 1024
          ? (n / 1024).toFixed(1) + " KB"
          : n + " B";
  return fmt(used) + " / " + fmt(total) + "(" + pct + "%)";
}

function setFileUsageLoading() {
  if (E.fileUsage)
    E.fileUsage.innerHTML =
      '<div class="file-usage-loading"><span class="spinner" aria-hidden="true"></span><span>' +
      t.loadingFiles +
      "</span></div>";
}

function setFileListLoading() {
  let listEl = $("fileList");
  if (listEl)
    listEl.innerHTML =
      '<div class="file-loading"><span class="spinner" aria-hidden="true"></span><span>' +
      t.loadingFiles +
      "</span></div>";
}

async function loadFileUsage() {
  if (!E.fileUsage) return;
  setFileUsageLoading();
  try {
    let r = await fetch("/status", { cache: "no-store" });
    if (!r.ok) throw Error("status failed");
    let j = await r.json(),
      total = Number(j.totalBytes),
      used = Number(j.usedBytes);
    if (!Number.isFinite(total) || !Number.isFinite(used))
      throw Error("invalid usage");
    let pct = total > 0 ? Math.max(0, Math.min(100, (used / total) * 100)) : 0;
    E.fileUsage.innerHTML =
      "<div><b>LittleFS</b><span>" +
      fileUsageText(Math.max(0, used), Math.max(0, total)) +
      '</span></div><i><em style="width:' +
      pct +
      '%"></em></i>';
  } catch (e) {
    E.fileUsage.textContent = "LittleFS:" + e.message;
  }
}

async function loadFiles(path) {
  filesLoaded = true;
  currentFileDir = path || "/";
  let listEl = $("fileList"),
    status = $("filesStatus"),
    pathEl = $("filePath");
  pathEl.textContent = currentFileDir;
  setFileListLoading();
  setStatus(status, "", false);
  resetFileEditor();
  loadFileUsage();
  try {
    let r = await fetch("/list?dir=" + encodeURIComponent(currentFileDir), {
      cache: "no-store",
    });
    if (!r.ok) throw Error((await r.text()) || "list failed");
    let list = await r.json();
    listEl.innerHTML = "";
    (Array.isArray(list) ? list : []).forEach((f) => {
      let full = joinFilePath(currentFileDir, f.name),
        btn = document.createElement("button");
      btn.className = "file-item " + f.type;
      btn.type = "button";
      btn.innerHTML =
        "<span>" +
        (f.type === "dir" ? "[D] " : "[F] ") +
        esc(f.name) +
        "</span><em>" +
        (f.type === "file" ? esc(f.size + " B") : "") +
        "</em>";
      btn.onclick = () => {
        if (f.type !== "dir") {
          viewFile(full, btn);
          return;
        }
        let dir = full + "/";
        if (btn.classList.contains("active") && selectedFilePath === dir) loadFiles(dir);
        else selectFileTarget(dir, btn, true);
      };
      listEl.appendChild(btn);
    });
  } catch (e) {
    listEl.innerHTML = "";
    setStatus(status, e.message, true);
  }
}

async function viewFile(path, btn) {
  let requestId = ++fileViewRequestId,
    preview = $("filePreview"),
    image = $("fileImage"),
    status = $("filesStatus");
  setStatus(status, "", false);
  selectedFilePath = path;
  selectedFileBinary = false;
  fileDirty = false;
  E.fileSelected.innerHTML =
    '<span class="spinner" aria-hidden="true"></span><span>' + esc(path) + "</span>";
  E.fileSaveBtn.disabled = true;
  E.fileDeleteBtn.disabled = false;
  preview.style.display = "block";
  preview.innerHTML =
    '<div class="file-loading"><span class="spinner" aria-hidden="true"></span><span>' +
    t.loadingFiles +
    "</span></div>";
  image.style.display = "none";
  image.removeAttribute("src");
  E.fileEditor.style.display = "none";
  E.fileEditor.value = "";
  document
    .querySelectorAll(".file-item.active")
    .forEach((x) => x.classList.remove("active"));
  if (btn) btn.classList.add("active");
  try {
    let r = await fetch("/api/files/view?path=" + encodeURIComponent(path), {
        cache: "no-store",
      }),
      j = await r.json();
    if (requestId !== fileViewRequestId || selectedFilePath !== path) return;
    if (!r.ok) throw Error(j.error || t.fileLoadFailed);
    selectedFileBinary = !!j.binary;
    fileDirty = false;
    E.fileSelected.textContent = path;
    E.fileDeleteBtn.disabled = false;
    if (j.binary) {
      E.fileSaveBtn.disabled = true;
      if ((j.contentType || "").startsWith("image/")) {
        preview.style.display = "none";
        preview.textContent = "";
        image.src = path + "?v=" + Date.now();
        image.style.display = "block";
      } else {
        preview.style.display = "block";
        preview.textContent = t.fileBinary;
      }
      return;
    }
    preview.style.display = "none";
    E.fileEditor.style.display = "block";
    E.fileEditor.value = j.content || "";
    E.fileSaveBtn.disabled = true;
  } catch (e) {
    if (requestId !== fileViewRequestId || selectedFilePath !== path) return;
    preview.style.display = "block";
    preview.textContent = "";
    E.fileEditor.style.display = "none";
    E.fileSaveBtn.disabled = true;
    E.fileDeleteBtn.disabled = false;
    E.fileSelected.textContent = path;
    setStatus(status, e.message, true);
  }
}

async function saveSelectedFile() {
  if (!selectedFilePath) return;
  let blob = new Blob([E.fileEditor.value], { type: "text/plain" }),
    form = new FormData();
  form.append("file", blob, selectedFilePath.replace(/^\//, ""));
  let r = await fetch("/edit", { method: "POST", body: form });
  if (!r.ok) throw Error((await r.text()) || "save failed");
  fileDirty = false;
  E.fileSaveBtn.disabled = true;
  setStatus($("filesStatus"), t.saved, false);
  loadFiles(currentFileDir);
}

async function uploadFileToCurrentDir(file) {
  let form = new FormData();
  form.append(
    "file",
    file,
    joinFilePath(currentFileDir, file.name).replace(/^\//, ""),
  );
  let r = await fetch("/edit", { method: "POST", body: form });
  if (!r.ok) throw Error((await r.text()) || "upload failed");
  setStatus($("filesStatus"), t.saved, false);
  loadFiles(currentFileDir);
}

function openCreateFileDialog(folder) {
  hideFooterExport();
  E.secondaryAction.style.display = "";
  E.secondaryAction.textContent = t.cancel;
  E.secondaryAction.onclick = () => E.sheet.classList.remove("show");
  E.saveSettings.style.display = "";
  E.saveSettings.textContent = folder ? t.newFolder : t.newFile;
  currentApp = folder ? "__new_folder__" : "__new_file__";
  E.sheetTitle.textContent = folder ? t.newFolder : t.newFile;
  E.sheetStatus.textContent = "";
  E.fields.innerHTML =
    '<div class="field"><label>' +
    (folder ? t.folderName : t.filename) +
    '</label><input id="newFileName" type="text" autocomplete="off"></div>';
  E.sheet.classList.add("show");
  setTimeout(() => $("newFileName").focus(), 0);
}

async function createFileItem(folder) {
  let name = ($("newFileName").value || "").trim();
  if (!name) {
    setStatus(E.sheetStatus, folder ? t.folderName : t.filename, true);
    return;
  }
  let path =
    joinFilePath(currentFileDir, name) +
    (folder && !name.endsWith("/") ? "/" : "");
  let r = await fetch("/edit?path=" + encodeURIComponent(path), {
    method: "PUT",
  });
  if (!r.ok) throw Error((await r.text()) || "create failed");
  E.sheet.classList.remove("show");
  setStatus($("filesStatus"), t.saved, false);
  loadFiles(currentFileDir);
}

async function deleteSelectedFile() {
  if (!selectedFilePath) return;
  if (!confirm(t.confirmDelete + selectedFilePath + "?")) return;
  let r = await fetch("/edit?path=" + encodeURIComponent(selectedFilePath), {
    method: "DELETE",
  });
  if (!r.ok) throw Error((await r.text()) || "delete failed");
  setStatus($("filesStatus"), t.saved, false);
  loadFiles(currentFileDir);
}
