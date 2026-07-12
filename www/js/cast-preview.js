let previewTimer = null,
  previewStarted = false;

function gifWord(a, v) {
  a.push(v & 255, (v >> 8) & 255);
}

function gifText(a, s) {
  for (let i = 0; i < s.length; i++) a.push(s.charCodeAt(i) & 255);
}

function gifPalette() {
  let p = [];

  for (let r = 0; r < 8; r++)
    for (let g = 0; g < 8; g++)
      for (let b = 0; b < 4; b++) {
        p.push(
          Math.round((r * 255) / 7),
          Math.round((g * 255) / 7),
          Math.round((b * 255) / 3),
        );
      }
  return p;
}

function gifIndex(v) {
  return (
    ((((v >> 16) & 255) >> 5) << 5) |
    ((((v >> 8) & 255) >> 5) << 2) |
    ((v & 255) >> 6)
  );
}

function gifLzw(pixels) {
  let min = 8,
    clear = 256,
    end = 257,
    size = 9,
    dict = 258,
    bits = 0,
    cur = 0,
    out = [];

  let put = (c) => {
    cur |= c << bits;
    bits += size;
    while (bits >= 8) {
      out.push(cur & 255);
      cur >>= 8;
      bits -= 8;
    }
    if (c === clear) {
      size = 9;
      dict = 258;
    } else {
      dict++;
      if (dict === 1 << size && size < 12) size++;
    }
  };

  put(clear);

  for (let i = 0; i < pixels.length; i++) {
    put(pixels[i]);
    if (dict >= 4094 && i < pixels.length - 1) put(clear);
  }
  put(end);

  if (bits > 0) out.push(cur & 255);

  let blocks = [];

  for (let i = 0; i < out.length; i += 255) blocks.push(out.slice(i, i + 255));

  return { min, blocks };
}

function buildPreviewGif(frames, w, h) {
  let bytes = [];

  gifText(bytes, "GIF89a");

  gifWord(bytes, w);

  gifWord(bytes, h);

  bytes.push(247, 0, 0);

  bytes.push(...gifPalette());

  for (let f of frames) {
    let delay = Math.max(2, Math.min(65535, Math.round((f.delay || 120) / 10)));
    bytes.push(33, 249, 4, 4);
    gifWord(bytes, delay);
    bytes.push(0, 0);
    bytes.push(44);
    gifWord(bytes, 0);
    gifWord(bytes, 0);
    gifWord(bytes, w);
    gifWord(bytes, h);
    bytes.push(0);
    let pix = f.frame.map(gifIndex),
      lzw = gifLzw(pix);
    bytes.push(lzw.min);
    lzw.blocks.forEach((b) => bytes.push(b.length, ...b));
    bytes.push(0);
  }
  bytes.push(59);

  return new Blob([new Uint8Array(bytes)], { type: "image/gif" });
}

function initPreviewView() {
  if (previewStarted) return;

  let c = $("liveCanvas");

  if (!c) return;

  previewStarted = true;

  let ctx = c.getContext("2d"),
    last = "",
    busy = false,
    baseDelay = 200,
    delay = baseDelay,
    pw = 32,
    ph = 8,
    paintPending = false,
    nextFrame = null,
    gifRecording = false,
    gifFrames = [],
    gifLast = 0;

  let paint = (a) => {
    nextFrame = a;
    if (paintPending) return;
    paintPending = true;
    requestAnimationFrame(() => {
      paintPending = false;
      let frame = nextFrame;
      nextFrame = null;
      if (!frame) return;
      if (gifRecording) {
        let now = Date.now();
        gifFrames.push({
          frame: frame.slice(0, pw * ph),
          delay: gifLast ? now - gifLast : baseDelay,
        });
        gifLast = now;
        if (gifFrames.length >= 120) {
          let b = $("liveGif");
          if (b) b.click();
        }
      }
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, c.width, c.height);
      for (let y = 0; y < ph; y++)
        for (let x = 0; x < pw; x++) {
          let v = frame[y * pw + x] || 0;
          ctx.fillStyle =
            "rgb(" +
            ((v >> 16) & 255) +
            "," +
            ((v >> 8) & 255) +
            "," +
            (v & 255) +
            ")";
          ctx.fillRect(
            x * Math.floor(c.width / pw) + 1,
            y * Math.floor(c.height / ph) + 1,
            Math.max(1, Math.floor(c.width / pw) - 2),
            Math.max(1, Math.floor(c.height / ph) - 2),
          );
        }
    });
  };

  let schedule = (ms) => {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(draw, ms);
  };

  let draw = async () => {
    if (!document.body.contains(c)) {
      previewStarted = false;
      if (previewTimer) {
        clearTimeout(previewTimer);
        previewTimer = null;
      }
      return;
    }
    if (document.hidden || !E.libraryPanel.classList.contains("active")) {
      schedule(1000);
      return;
    }
    if (busy) {
      schedule(delay);
      return;
    }
    busy = true;
    try {
      let r = await fetch("/api/screen", { cache: "no-store" });
      if (r.status === 401) {
        authHeader = "";
        sessionStorage.removeItem("awtrixAuth");
        previewStarted = false;
        busy = false;
        if (previewTimer) {
          clearTimeout(previewTimer);
          previewTimer = null;
        }
        initAuth();
        return;
      }
      if (!r.ok) throw Error("screen " + r.status);
      let text = await r.text();
      if (text !== last) {
        last = text;
        paint(JSON.parse(text));
      }
      delay = baseDelay;
    } catch (e) {
      delay = Math.min(Math.max(delay * 2, 1000), 2000);
    }
    busy = false;
    schedule(delay);
  };

  $("livePrev").onclick = () => fetch("/api/previousapp", { method: "POST" });

  $("liveNext").onclick = () => fetch("/api/nextapp", { method: "POST" });

  $("liveDownload").onclick = () => {
    let a = document.createElement("a");
    a.href = c.toDataURL();
    a.download = "awtrix.png";
    a.click();
  };

  let gifBtn = $("liveGif");

  if (gifBtn)
    gifBtn.onclick = () => {
      if (!gifRecording) {
        gifFrames = [];
        gifLast = 0;
        gifRecording = true;
        gifBtn.textContent = t.stop;
        gifBtn.classList.add("primary");
        return;
      }
      gifRecording = false;
      gifBtn.textContent = "GIF";
      gifBtn.classList.remove("primary");
      if (!gifFrames.length) return;
      let a = document.createElement("a");
      a.href = URL.createObjectURL(buildPreviewGif(gifFrames, pw, ph));
      a.download = "awtrix.gif";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

  if (E.interactiveRun) E.interactiveRun.onclick = startInteractiveDemo;

  if (E.interactiveStop) E.interactiveStop.onclick = stopInteractiveDemo;

  if (E.stopwatchOpen) E.stopwatchOpen.onclick = openStopwatchDialog;

  if (E.countdownOpen) E.countdownOpen.onclick = openCountdownDialog;

  renderAppKindTabs();

  draw();

  if (location.pathname === "/wifi") activate("settings", true);
}
