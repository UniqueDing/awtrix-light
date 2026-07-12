function createCastAppApi(app) {
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
        this.label(desc.title) || castAppName(app) || "";
      E.sheetStatus.textContent = "";
      E.secondaryAction.style.display = "none";
      E.saveSettings.style.display = "none";
      this.close = async () => {
        if (this._btnTimer) {
          clearInterval(this._btnTimer);
          this._btnTimer = null;
        }
        if (this.onClose) await this.onClose();
        await this.release();
        E.sheet.classList.remove("show");
      };
      window.currentCastAppApi = this;
      let html = '<section class="settings-card">';
      if (desc.hint)
        html += '<p class="hint">' + this.label(desc.hint) + "</p>";
      if (desc.display && desc.display.type === "text") {
        let init = desc.display.initial || "";
        let id = "__cast_disp_" + (desc.display.id || "v");
        html += '<h3 id="' + id + '" class="cast-display">' + init + "</h3>";
      }
      if (desc.controls && desc.controls.length) {
        html += '<div class="live-actions">';
        desc.controls.forEach((c) => {
          let cls =
            c.style === "danger"
              ? "danger"
              : c.style === "tonal"
                ? "tonal"
                : "primary";
          html +=
            '<button id="__cast_ctrl_' +
            c.id +
            '" class="' +
            cls +
            '" type="button">' +
            this.label(c.label) +
            "</button>";
        });
        html += "</div>";
      }
      html += "</section>";
      if (desc.config && desc.config.length) {
        html += '<section class="settings-card"><h4>' + t.settings + "</h4>";
        desc.config.forEach((c) => {
          let v = c.value !== undefined ? c.value : "";
          html +=
            '<div class="field"><label>' + this.label(c.label) + "</label>";
          if (c.type === "checkbox" || c.type === "bool") {
            html +=
              '<label class="switch"><input id="__cast_cfg_' +
              c.id +
              '" type="checkbox" ' +
              (v ? "checked" : "") +
              '><span class="slider"></span></label>';
          } else {
            html +=
              '<input id="__cast_cfg_' +
              c.id +
              '" type="' +
              (c.type || "text") +
              '" value="' +
              esc(v) +
              '">';
          }
          html += "</div>";
        });
        html += "</section>";
      }
      E.fields.innerHTML = html;
      this.rootEl = E.fields;
      desc.controls.forEach((c) => {
        if (c.action) {
          let btn = this.rootEl.querySelector("#__cast_ctrl_" + c.id);
          if (btn) btn.onclick = (e) => c.action(api, e);
        }
      });
      E.sheet.classList.add("show");
      return E.fields;
    },
    getConfig() {
      let cfg = {};
      if (this._desc && this._desc.config) {
        this._desc.config.forEach((c) => {
          let el = document.getElementById("__cast_cfg_" + c.id);
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
      let el = document.getElementById("__cast_disp_" + id);
      if (el) el.textContent = val;
    },
    status(msg, err) {
      setStatus(E.sheetStatus, msg, err);
    },
    $(id) {
      return document.getElementById(id);
    },
    async claim() {
      return runtimePost("/api/runtime/claim", { owner: app.id });
    },
    async frame(body) {
      return runtimePost("/api/runtime/frame", body);
    },
    async release() {
      return runtimePost("/api/runtime/release", {});
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
    _btnTimer: null,
    enableButtons() {
      if (this._btnTimer) clearInterval(this._btnTimer);
      const self = this;
      const desc = this._desc;
      let keyMap = {};
      if (desc && desc.controls)
        desc.controls.forEach((c) => {
          if (c.key) keyMap[c.key] = "__cast_ctrl_" + c.id;
        });
      this._btnTimer = setInterval(async () => {
        try {
          let r = await fetch("/api/runtime/buttons");
          if (!r.ok) return;
          let j = await r.json();
          ["left", "middle", "right"].forEach((k) => {
            if (j[k]) {
              let id = keyMap[k];
              if (id && self.rootEl) {
                let btn = self.rootEl.querySelector("#" + id);
                if (btn) btn.click();
              }
            }
          });
        } catch (e) {}
      }, 200);
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
  if (interactiveRunning || countdown.running || stopwatch.running)
    navigator.sendBeacon &&
      navigator.sendBeacon(
        "/api/runtime/release",
        new Blob(["{}"], { type: "application/json" }),
      );
});
