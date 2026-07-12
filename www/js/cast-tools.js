let stopwatch = { running: false, start: 0, elapsed: 0, timer: null, lap: 0 };

function fmtStopwatch(ms) {
  let total = Math.floor(ms / 10),
    cs = total % 100,
    s = Math.floor(total / 100) % 60,
    m = Math.floor(total / 6000);

  return (
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0") +
    "." +
    String(cs).padStart(2, "0")
  );
}

function stopwatchElapsed() {
  return (
    stopwatch.elapsed + (stopwatch.running ? Date.now() - stopwatch.start : 0)
  );
}

function stopwatchCommands() {
  let txt = fmtStopwatch(stopwatchElapsed()),
    accent = stopwatch.running ? "#00e5ff" : "#ffcc00";

  return [
    { df: [0, 0, 32, 8, "#000000"] },
    { dt: [0, 0, txt, accent] },
    {
      df: [
        0,
        7,
        Math.min(32, Math.floor((stopwatchElapsed() % 60000) / 1875)),
        1,
        accent,
      ],
    },
  ];
}

async function drawStopwatch() {
  try {
    await runtimePost("/api/runtime/frame", {
      clear: true,
      commands: stopwatchCommands(),
    });
    if (stopwatch.running) stopwatch.timer = setTimeout(drawStopwatch, 80);
  } catch (e) {
    setStatus(E.sheetStatus, e.message, true);
  }
}

async function stopwatchClaim() {
  await runtimePost("/api/runtime/claim", { owner: "stopwatch" });

  drawStopwatch();
}

async function stopwatchStart() {
  if (!stopwatch.running) {
    stopwatch.running = true;
    stopwatch.start = Date.now();
    await stopwatchClaim();
  }
}

async function stopwatchPause() {
  if (stopwatch.running) {
    stopwatch.elapsed = stopwatchElapsed();
    stopwatch.running = false;
    if (stopwatch.timer) clearTimeout(stopwatch.timer);
    await drawStopwatch();
  }
}

async function stopwatchReset() {
  stopwatch.running = false;

  stopwatch.elapsed = 0;

  stopwatch.lap = 0;

  if (stopwatch.timer) clearTimeout(stopwatch.timer);

  await stopwatchClaim();

  setStatus(E.sheetStatus, "已重置", false);
}

async function stopwatchStop() {
  stopwatch.running = false;

  if (stopwatch.timer) clearTimeout(stopwatch.timer);

  await runtimePost("/api/runtime/release", {});

  E.sheet.classList.remove("show");
}

let countdown = {
  running: false,
  total: 300000,
  remaining: 300000,
  end: 0,
  timer: null,
};

function fmtCountdown(ms) {
  ms = Math.max(0, ms);

  let total = Math.ceil(ms / 1000),
    s = total % 60,
    m = Math.floor(total / 60) % 60,
    h = Math.floor(total / 3600);

  return h > 0
    ? String(h) +
        ":" +
        String(m).padStart(2, "0") +
        ":" +
        String(s).padStart(2, "0")
    : String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function countdownRemaining() {
  return countdown.running
    ? Math.max(0, countdown.end - Date.now())
    : countdown.remaining;
}

function countdownCommands() {
  let rem = countdownRemaining(),
    done = rem <= 0,
    txt = done ? "DONE" : fmtCountdown(rem),
    color = done ? "#ff4444" : "#00ff99",
    width =
      countdown.total > 0
        ? Math.max(0, Math.min(32, Math.ceil((rem / countdown.total) * 32)))
        : 0;

  return [
    { df: [0, 0, 32, 8, "#000000"] },
    { dt: [done ? 3 : 0, 0, txt, color] },
    { df: [0, 7, width, 1, color] },
  ];
}

async function drawCountdown() {
  try {
    await runtimePost("/api/runtime/frame", {
      clear: true,
      commands: countdownCommands(),
    });
    if (countdown.running && countdownRemaining() > 0)
      countdown.timer = setTimeout(drawCountdown, 120);
    else if (countdown.running) {
      countdown.running = false;
      countdown.remaining = 0;
      setStatus(E.sheetStatus, "倒计时结束", false);
    }
  } catch (e) {
    setStatus(E.sheetStatus, e.message, true);
  }
}

function readCountdownInput() {
  let min = Number(($("countdownMinutes") && $("countdownMinutes").value) || 0),
    sec = Number(($("countdownSeconds") && $("countdownSeconds").value) || 0);

  let total = Math.max(1, Math.floor(min * 60 + sec)) * 1000;

  countdown.total = total;

  countdown.remaining = total;
}

async function countdownClaim() {
  await runtimePost("/api/runtime/claim", { owner: "countdown" });

  drawCountdown();
}

async function countdownStart() {
  readCountdownInput();

  countdown.running = true;

  countdown.end = Date.now() + countdown.remaining;

  await countdownClaim();
}

async function countdownPause() {
  if (countdown.running) {
    countdown.remaining = countdownRemaining();
    countdown.running = false;
    if (countdown.timer) clearTimeout(countdown.timer);
    await drawCountdown();
  }
}

async function countdownReset() {
  countdown.running = false;

  if (countdown.timer) clearTimeout(countdown.timer);

  readCountdownInput();

  await countdownClaim();

  setStatus(E.sheetStatus, "已重置", false);
}

async function countdownStop() {
  countdown.running = false;

  if (countdown.timer) clearTimeout(countdown.timer);

  await runtimePost("/api/runtime/release", {});

  E.sheet.classList.remove("show");
}

function openCountdownDialog() {
  hideFooterExport();

  currentApp = "__countdown__";

  E.sheetTitle.textContent = "倒计时 Live";

  E.sheetStatus.textContent = "";

  E.secondaryAction.style.display = "";

  E.secondaryAction.textContent = "关闭";

  E.secondaryAction.onclick = countdownStop;

  E.saveSettings.style.display = "none";

  let minutes = Math.floor(countdown.total / 60000),
    seconds = Math.floor(countdown.total / 1000) % 60;

  E.fields.innerHTML =
    '<section class="settings-card stopwatch-dialog"><h3 id="countdownValue">' +
    fmtCountdown(countdownRemaining()) +
    '</h3><p class="hint">设置时间后点击开始，浏览器 JS 会控制屏幕显示倒计时。</p><div class="field"><label>分钟</label><input id="countdownMinutes" type="number" min="0" max="999" value="' +
    minutes +
    '"></div><div class="field"><label>秒</label><input id="countdownSeconds" type="number" min="0" max="59" value="' +
    seconds +
    '"></div><div class="live-actions"><button id="countdownStart" class="primary" type="button">开始</button><button id="countdownPause" class="tonal" type="button">暂停</button><button id="countdownReset" class="tonal" type="button">重置</button></div></section>';

  E.sheet.classList.add("show");

  let update = () => {
    let v = $("countdownValue");
    if (v) v.textContent = fmtCountdown(countdownRemaining());
    if (E.sheet.classList.contains("show") && currentApp === "__countdown__")
      requestAnimationFrame(update);
  };

  $("countdownStart").onclick = () =>
    countdownStart().catch((e) => setStatus(E.sheetStatus, e.message, true));

  $("countdownPause").onclick = () =>
    countdownPause().catch((e) => setStatus(E.sheetStatus, e.message, true));

  $("countdownReset").onclick = () =>
    countdownReset().catch((e) => setStatus(E.sheetStatus, e.message, true));

  update();
}

function openStopwatchDialog() {
  hideFooterExport();

  currentApp = "__stopwatch__";

  E.sheetTitle.textContent = "秒表 Live";

  E.sheetStatus.textContent = "";

  E.secondaryAction.style.display = "";

  E.secondaryAction.textContent = "关闭";

  E.secondaryAction.onclick = stopwatchStop;

  E.saveSettings.style.display = "none";

  E.fields.innerHTML =
    '<section class="settings-card stopwatch-dialog"><h3 id="stopwatchValue">00:00.00</h3><p class="hint">此 App 由浏览器 JS 控制屏幕，关闭页面会自动释放。</p><div class="live-actions"><button id="stopwatchStart" class="primary" type="button">开始</button><button id="stopwatchPause" class="tonal" type="button">暂停</button><button id="stopwatchReset" class="tonal" type="button">重置</button></div></section>';

  E.sheet.classList.add("show");

  let update = () => {
    let v = $("stopwatchValue");
    if (v) v.textContent = fmtStopwatch(stopwatchElapsed());
    if (E.sheet.classList.contains("show") && currentApp === "__stopwatch__")
      requestAnimationFrame(update);
  };

  $("stopwatchStart").onclick = () =>
    stopwatchStart().catch((e) => setStatus(E.sheetStatus, e.message, true));

  $("stopwatchPause").onclick = () =>
    stopwatchPause().catch((e) => setStatus(E.sheetStatus, e.message, true));

  $("stopwatchReset").onclick = () =>
    stopwatchReset().catch((e) => setStatus(E.sheetStatus, e.message, true));

  update();
}
