function createCastAppApi(app) {
  let dialogLabel = (value, key) =>
    value === app[key] ? localizedField(app, key, localLabel(value)) : localLabel(value);
  let componentId = (value) => {
    let id = String(value || "");
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id))
      throw Error("invalid component id");
    return id;
  };
  let api = {
    app,
    get lang() {
      return lang;
    },
    label(v) {
      return localLabel(v);
    },
    t(v) {
      return localLabel(v);
    },
    renderDialog(desc) {
      this._desc = desc;
      hideFooterExport();
      currentApp = "__cast_external__" + app.id;
      E.sheetTitle.textContent =
        dialogLabel(desc.title, "name") || castAppName(app) || "";
      E.sheetStatus.textContent = "";
      E.secondaryAction.style.display = "none";
      E.saveSettings.style.display = "none";
      this.close = async () => {
        if (this._closing) return this._closing;
        this._closing = (async () => {
          if (this._buttonHandler) runtimeTransport.disableButtons(this._buttonHandler);
          let closeError = null;
          try {
            if (this.onClose) await this.onClose();
          } catch (error) {
            closeError = error;
          }
          try {
            await this.release();
          } finally {
            E.sheet.classList.remove("show");
            if (window["currentCastAppApi"] === this)
              window["currentCastAppApi"] = null;
          }
          if (closeError) throw closeError;
        })();
        return this._closing;
      };
      window["currentCastAppApi"] = this;
      E.fields.innerHTML = "";
      this._controlElements = {};
      this._configElements = {};
      this._configLabels = {};
      this._displayElements = {};
      let main = document.createElement("section");
      main.className = "settings-card";
      if (desc.hint) {
        let hint = document.createElement("p");
        hint.className = "hint";
        hint.dataset.castHint = "1";
        hint.textContent = dialogLabel(desc.hint, "description");
        main.appendChild(hint);
      }
      if (desc.display && desc.display.type === "text") {
        let displayId = componentId(desc.display.id || "v"),
          display = document.createElement("h3");
        display.id = "__cast_disp_" + displayId;
        display.className = "cast-display";
        display.textContent = desc.display.initial || "";
        main.appendChild(display);
        this._displayElements[displayId] = display;
      }
      if (desc.controls && desc.controls.length) {
        let actions = document.createElement("div");
        actions.className = "live-actions";
        desc.controls.forEach((c) => {
          let id = componentId(c.id),
            button = document.createElement("button"),
            cls =
            c.style === "danger"
              ? "danger"
              : c.style === "tonal"
                ? "tonal"
                : "primary";
          button.id = "__cast_ctrl_" + id;
          button.className = cls;
          button.type = "button";
          button.textContent = this.label(c.label);
          actions.appendChild(button);
          this._controlElements[id] = button;
        });
        main.appendChild(actions);
      }
      E.fields.appendChild(main);
      if (desc.config && desc.config.length) {
        let configSection = document.createElement("section"),
          configTitle = document.createElement("h4");
        configSection.className = "settings-card";
        configTitle.dataset.castSettings = "1";
        configTitle.textContent = t.settings;
        configSection.appendChild(configTitle);
        desc.config.forEach((c) => {
          let id = componentId(c.id),
            value = c.value !== undefined ? c.value : "",
            field = document.createElement("div"),
            label = document.createElement("label"),
            input = document.createElement("input");
          field.className = "field";
          label.textContent = this.label(c.label);
          field.appendChild(label);
          if (c.type === "checkbox" || c.type === "bool") {
            let toggle = document.createElement("label"),
              slider = document.createElement("span");
            toggle.className = "switch";
            input.type = "checkbox";
            input.checked = !!value;
            slider.className = "slider";
            toggle.appendChild(input);
            toggle.appendChild(slider);
            field.appendChild(toggle);
          } else {
            input.type = c.type || "text";
            input.value = value;
            field.appendChild(input);
          }
          input.id = "__cast_cfg_" + id;
          configSection.appendChild(field);
          this._configElements[id] = input;
          this._configLabels[id] = label;
        });
        E.fields.appendChild(configSection);
      }
      this.rootEl = E.fields;
      (desc.controls || []).forEach((c) => {
        if (c.action) {
          let btn = this._controlElements[componentId(c.id)];
          if (btn) btn.onclick = (e) => c.action(api, e);
        }
      });
      E.sheet.classList.add("show");
      return E.fields;
    },
    rerenderDialog() {
      let desc = this._desc;
      if (!desc || !this.rootEl) return;
      E.sheetTitle.textContent = dialogLabel(desc.title, "name") || castAppName(app) || "";
      let hint = this.rootEl.querySelector("[data-cast-hint]");
      if (hint) hint.textContent = dialogLabel(desc.hint, "description");
      let settingsTitle = this.rootEl.querySelector("[data-cast-settings]");
      if (settingsTitle) settingsTitle.textContent = t.settings;
      (desc.controls || []).forEach((c) => {
        let el = this._controlElements[componentId(c.id)];
        if (el) el.textContent = this.label(c.label);
      });
      (desc.config || []).forEach((c) => {
        let el = this._configLabels[componentId(c.id)];
        if (el) el.textContent = this.label(c.label);
      });
    },
    getConfig() {
      let cfg = {};
      if (this._desc && this._desc.config) {
        this._desc.config.forEach((c) => {
          let el = this._configElements[componentId(c.id)];
          if (!el) return;
          if (c.type === "checkbox" || c.type === "bool")
            cfg[c.id] = el.checked;
          else if (c.type === "number") cfg[c.id] = Number(el.value);
          else cfg[c.id] = el.value;
        });
      }
      return cfg;
    },
    updateDisplay(id, val) {
      let el = this._displayElements[componentId(id)];
      if (el) el.textContent = val;
    },
    status(msg, err) {
      setStatus(E.sheetStatus, msg, err);
    },
    $(id) {
      return document.getElementById(id);
    },
    async claim() {
      return runtimeTransport.claim(app.id);
    },
    async frame(body) {
      return runtimeTransport.frame(body);
    },
    isWebSocket() {
      return runtimeTransport.isWebSocket();
    },
    async release() {
      return runtimeTransport.release();
    },
    commands: {
      clear() {
        return { df: [0, 0, 32, 8, "#000000"] };
      },
      text(x, y, text, color) {
        return { dt: [x, y, text, color || "#ffffff"] };
      },
      fill(x, y, w, h, color) {
        return { df: [x, y, w, h, color || "#ffffff"] };
      },
      pixel(x, y, color) {
        return { dp: [x, y, color || "#ffffff"] };
      },
      line(x0, y0, x1, y1, color) {
        return { dl: [x0, y0, x1, y1, color || "#ffffff"] };
      },
    },
    _desc: null,
    _buttonHandler: null,
    _closing: null,
    enableButtons() {
      const self = this;
      const desc = this._desc;
      let keyMap = {};
      if (desc && desc.controls)
        desc.controls.forEach((c) => {
          if (c.key) keyMap[c.key] = componentId(c.id);
        });
      if (this._buttonHandler) runtimeTransport.disableButtons(this._buttonHandler);
      this._buttonHandler = (key) => {
        let id = keyMap[key];
        if (id && self.rootEl) {
          let btn = self._controlElements[id];
          if (btn) btn.click();
        }
      };
      runtimeTransport.enableButtons(this._buttonHandler);
    },
  };

  return api;
}

let interactiveTimer = null,
  interactiveFrame = 0,
  interactiveRunning = false;

function setInteractiveStatus(msg, err) {
  if (!E.interactiveStatus) return;

  E.interactiveStatus.textContent = msg || "";

  E.interactiveStatus.className = "status" + (err ? " error" : "");
}

async function runtimePost(path, body) {
  if (path === "/api/runtime/claim") return runtimeTransport.claim(body && body.owner);
  if (path === "/api/runtime/frame") return runtimeTransport.frame(body);
  if (path === "/api/runtime/release") return runtimeTransport.release();
  let r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });

  let j = await r.json().catch(() => ({}));

  if (!r.ok || j.ok === false) throw Error(j.error || "runtime " + r.status);

  return j;
}

function interactiveCommands(frame) {
  let x = frame % 29,
    tail = Math.max(0, x - 4),
    color = frame % 2 ? "#00e5ff" : "#ffcc00";

  return [
    { df: [0, 0, 32, 8, "#000000"] },
    { df: [tail, 3, 5, 2, "#14344a"] },
    { df: [x, 2, 4, 4, color] },
    { dt: [1, 0, "WEB", "#ffffff"] },
  ];
}

async function drawInteractiveFrame() {
  if (!interactiveRunning) return;

  try {
    await runtimePost("/api/runtime/frame", {
      clear: true,
      commands: interactiveCommands(interactiveFrame++),
    });
    interactiveTimer = setTimeout(drawInteractiveFrame, 120);
  } catch (e) {
    interactiveRunning = false;
    setInteractiveStatus(e.message, true);
  }
}

async function startInteractiveDemo() {
  if (interactiveRunning) return;

  setInteractiveStatus("正在占用屏幕...", false);

  try {
    await runtimePost("/api/runtime/claim", { owner: "web-demo" });
    interactiveRunning = true;
    interactiveFrame = 0;
    setInteractiveStatus("App 运行中：保持此页面打开", false);
    drawInteractiveFrame();
  } catch (e) {
    setInteractiveStatus(e.message, true);
  }
}

async function stopInteractiveDemo() {
  interactiveRunning = false;

  if (interactiveTimer) {
    clearTimeout(interactiveTimer);
    interactiveTimer = null;
  }
  try {
    await runtimePost("/api/runtime/release", {});
    setInteractiveStatus("已停止，恢复 Flow 轮播", false);
  } catch (e) {
    setInteractiveStatus(e.message, true);
  }
}

window.addEventListener("beforeunload", () => {
  runtimeTransport.unloadRelease();
});
