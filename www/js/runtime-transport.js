const runtimeTransport = (() => {
  const VERSION = 1,
    AUTH = 0x01,
    CLAIM = 0x02,
    RELEASE = 0x03,
    DRAW_FRAME = 0x04,
    SUBSCRIBE = 0x05,
    PING = 0x06,
    READY = 0x81,
    ACK = 0x82,
    ERROR = 0x83,
    SCREEN_RGB = 0x84,
    BUTTON_EDGE = 0x85,
    BUTTON_SNAPSHOT = 0x86,
    PONG = 0x87,
    MAX_PACKET = 4096;
  const textEncoder = new TextEncoder();
  let socket = null,
    mode = "idle",
    generation = 0,
    connectPromise = null,
    connectResolve = null,
    connectReject = null,
    bootstrapTimer = null,
    reconnectTimer = null,
    reconnectAttempt = 0,
    cooldownUntil = 0,
    requestId = 0,
    lease = "",
    httpClaimPromise = null,
    desiredOwner = "",
    claimed = false,
    explicitRelease = false,
    drawInFlight = null,
    pendingDraw = null,
    previewWanted = false,
    previewHandler = null,
    buttonHandler = null,
    buttonBits = 0,
    buttonSequence = 0,
    hasButtonSequence = false,
    buttonPollTimer = null,
    buttonPollBusy = false,
    pingTimer = null,
    subscribed = 0,
    subscribePromise = null,
    subscribeGeneration = 0,
    previewWebSocketReady = false,
    pending = new Map(),
    REQUEST_TIMEOUT_MS = 4000,
    BOOTSTRAP_TIMEOUT_MS = 4000;

  function clearBootstrapTimer() {
    if (bootstrapTimer) clearTimeout(bootstrapTimer);
    bootstrapTimer = null;
  }

  function hasDemand() {
    return !!(desiredOwner || previewWanted || buttonHandler);
  }

  function clearReconnectTimer() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function scheduleCooldownRetry() {
    if (reconnectTimer || explicitRelease || !hasDemand() || typeof WebSocket === "undefined") return;
    let delay = Math.max(0, cooldownUntil - Date.now());
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (explicitRelease || !hasDemand()) return;
      if (Date.now() < cooldownUntil) {
        scheduleCooldownRetry();
        return;
      }
      retryWebSocket();
    }, delay);
  }

  function enterHttpFallback() {
    cooldownUntil = Date.now() + 30000;
    mode = "http";
    previewWebSocketReady = false;
    if (buttonHandler) startButtonPolling();
    scheduleCooldownRetry();
  }

  function retryWebSocket() {
    if (explicitRelease || !hasDemand() || connectPromise || mode === "ws" || typeof WebSocket === "undefined") return;
    openSocket().catch((error) => {
      if (String(error.message).includes("401")) return;
      enterHttpFallback();
    });
  }

  function nextId() {
    requestId = (requestId + 1) & 0xffff;
    if (!requestId) requestId = 1;
    return requestId;
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  function tokenBytes(token) {
    if (!/^[0-9a-f]{32}$/i.test(token || "")) throw Error("invalid runtime token");
    let bytes = new Uint8Array(16);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(token.slice(i * 2, i * 2 + 2), 16);
    return bytes;
  }

  function runtimeUrl(session) {
    let scheme = location.protocol === "https:" ? "wss:" : "ws:";
    let host = location.hostname.includes(":") ? "[" + location.hostname + "]" : location.hostname;
    let path = String(session.path || "/runtime");
    if (path[0] !== "/") path = "/" + path;
    return scheme + "//" + host + ":" + Number(session.port) + path;
  }

  function authPacket(token) {
    let packet = new Uint8Array(18);
    packet.set([AUTH, VERSION]);
    packet.set(tokenBytes(token), 2);
    return packet;
  }

  function requestPacket(type, id, tail) {
    let packet = new Uint8Array(4 + (tail ? tail.length : 0));
    packet.set([type, VERSION, id >> 8, id & 255]);
    if (tail) packet.set(tail, 4);
    return packet;
  }

  function colorBytes(value) {
    let color;
    if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) color = parseInt(value.slice(1), 16);
    else if (typeof value === "number" && Number.isFinite(value)) color = Math.max(0, Math.min(0xffffff, Math.trunc(value)));
    else color = 0xffffff;
    return [color >> 16, (color >> 8) & 255, color & 255];
  }

  function signedByte(value) {
    return Math.max(-128, Math.min(127, Math.trunc(Number(value) || 0))) & 255;
  }

  function unsignedByte(value) {
    return Math.max(0, Math.min(255, Math.trunc(Number(value) || 0)));
  }

  function encodeCommand(command) {
    let values, text;
    if (command && Array.isArray(command.df)) {
      values = command.df;
      return new Uint8Array([1, signedByte(values[0]), signedByte(values[1]), unsignedByte(values[2]), unsignedByte(values[3]), ...colorBytes(values[4])]);
    }
    if (command && Array.isArray(command.dt)) {
      values = command.dt;
      text = textEncoder.encode(String(values[2] == null ? "" : values[2]));
      if (text.length > 128) throw Error("runtime text exceeds 128 UTF-8 bytes");
      let encoded = new Uint8Array(7 + text.length);
      encoded.set([2, signedByte(values[0]), signedByte(values[1]), ...colorBytes(values[3]), text.length]);
      encoded.set(text, 7);
      return encoded;
    }
    if (command && Array.isArray(command.dp)) {
      values = command.dp;
      return new Uint8Array([3, signedByte(values[0]), signedByte(values[1]), ...colorBytes(values[2])]);
    }
    if (command && Array.isArray(command.dl)) {
      values = command.dl;
      return new Uint8Array([4, signedByte(values[0]), signedByte(values[1]), signedByte(values[2]), signedByte(values[3]), ...colorBytes(values[4])]);
    }
    throw Error("unsupported runtime command");
  }

  function encodeFrame(body, id) {
    let commands = (body && body.commands) || [];
    if (!Array.isArray(commands) || commands.length > 128) throw Error("runtime frame exceeds 128 commands");
    let encoded = commands.map(encodeCommand);
    let length = 6 + encoded.reduce((total, item) => total + item.length, 0);
    if (length > MAX_PACKET) throw Error("runtime frame exceeds 4096 bytes");
    let packet = new Uint8Array(length), offset = 6;
    packet.set([DRAW_FRAME, VERSION, id >> 8, id & 255, body && body.clear ? 1 : 0, commands.length]);
    encoded.forEach((item) => {
      packet.set(item, offset);
      offset += item.length;
    });
    return packet;
  }

  function httpPost(path, body) {
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    }).then(async (response) => {
      let result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw Error(result.error || "runtime " + response.status);
      return result;
    });
  }

  function rejectPending(error) {
    pending.forEach((item) => {
      clearTimeout(item.timer);
      item.reject(error);
    });
    pending.clear();
    if (pendingDraw) pendingDraw.reject(error);
    drawInFlight = null;
    pendingDraw = null;
  }

  function forceHttpFallback(error) {
    claimed = false;
    subscribed = 0;
    previewWebSocketReady = false;
    rejectPending(error);
    enterHttpFallback();
    if (socket) socket.close();
  }

  function startPing() {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN || mode !== "ws") return;
      let now = Date.now() >>> 0;
      socket.send(new Uint8Array([PING, VERSION, now >>> 24, (now >>> 16) & 255, (now >>> 8) & 255, now & 255]));
    }, 20000);
  }

  function stopPing() {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
  }

  function sendRequest(type, tail) {
    if (!socket || socket.readyState !== WebSocket.OPEN || mode !== "ws") return Promise.reject(Error("runtime socket unavailable"));
    let id = nextId();
    return new Promise((resolve, reject) => {
      let key = type + ":" + id;
      let timer = setTimeout(() => {
        let item = pending.get(key);
        if (!item) return;
        pending.delete(key);
        item.reject(Error("runtime ack timeout"));
        forceHttpFallback(Error("runtime ack timeout"));
      }, REQUEST_TIMEOUT_MS);
      pending.set(key, { resolve, reject, timer });
      socket.send(requestPacket(type, id, tail));
    });
  }

  function subscriptionFlags() {
    return (previewWanted ? 1 : 0) | (buttonHandler ? 2 : 0);
  }

  function sendSubscribe() {
    if (mode !== "ws") return Promise.resolve({ ok: true });
    let socketGeneration = generation;
    if (subscribePromise && subscribeGeneration === socketGeneration) return subscribePromise;
    subscribeGeneration = socketGeneration;
    subscribePromise = (async () => {
      try {
        let result = { ok: true };
        while (socketGeneration === generation && mode === "ws") {
          let flags = subscriptionFlags();
          if (flags === subscribed) break;
          result = await sendRequest(SUBSCRIBE, new Uint8Array([flags, 30]));
          if (socketGeneration !== generation || mode !== "ws") break;
          subscribed = flags;
          previewWebSocketReady = previewWanted && !!(subscribed & 1);
          stopButtonPolling();
        }
        return result;
      } catch (error) {
        if (socketGeneration === generation) previewWebSocketReady = false;
        throw error;
      } finally {
        if (subscribeGeneration === socketGeneration) {
          subscribePromise = null;
          subscribeGeneration = 0;
        }
      }
    })();
    return subscribePromise;
  }

  function sendClaim() {
    let owner = textEncoder.encode(desiredOwner || "web");
    if (owner.length > 32 || Array.from(owner).some((value) => value < 0x20 || value > 0x7e)) return Promise.reject(Error("runtime owner must be printable ASCII up to 32 bytes"));
    let tail = new Uint8Array(1 + owner.length);
    tail[0] = owner.length;
    tail.set(owner, 1);
    return sendRequest(CLAIM, tail).then((result) => {
      claimed = true;
      return result;
    });
  }

  function flushDraw() {
    if (drawInFlight || !pendingDraw || !claimed || mode !== "ws") return;
    let item = pendingDraw;
    pendingDraw = null;
    let id = nextId();
    drawInFlight = item;
    pending.set(DRAW_FRAME + ":" + id, {
      timer: setTimeout(() => {
        let key = DRAW_FRAME + ":" + id;
        let request = pending.get(key);
        if (!request) return;
        pending.delete(key);
        request.reject(Error("runtime ack timeout"));
        forceHttpFallback(Error("runtime ack timeout"));
      }, REQUEST_TIMEOUT_MS),
      resolve(result) {
        drawInFlight = null;
        item.resolve(result);
        flushDraw();
      },
      reject(error) {
        drawInFlight = null;
        item.reject(error);
        flushDraw();
      },
    });
    socket.send(encodeFrame(item.body, id));
  }

  function parseMessage(event, socketGeneration) {
    if (socketGeneration !== generation || !(event.data instanceof ArrayBuffer)) return;
    let data = new Uint8Array(event.data);
    if (data.length < 2 || data[1] !== VERSION) return;
    if (data[0] === READY && data.length === 10) {
      clearBootstrapTimer();
      mode = "ws";
      previewWebSocketReady = false;
      cooldownUntil = 0;
      clearReconnectTimer();
      reconnectAttempt = 0;
      subscribed = 0;
      startPing();
      Promise.resolve(desiredOwner && !explicitRelease ? sendClaim() : null)
        .then(sendSubscribe)
        .then(() => {
          let resolve = connectResolve;
          connectPromise = null;
          connectResolve = null;
          connectReject = null;
          if (resolve) resolve("ws");
          flushDraw();
        })
        .catch((error) => {
          let reject = connectReject;
          connectPromise = null;
          connectResolve = null;
          connectReject = null;
          if (reject) reject(error);
          forceHttpFallback(error);
        });
      return;
    }
    if (data[0] === ACK && data.length === 6) {
      let key = data[2] + ":" + ((data[3] << 8) | data[4]), item = pending.get(key);
      if (!item) return;
      pending.delete(key);
      clearTimeout(item.timer);
      if (data[5] <= 1) item.resolve({ ok: true, status: data[5] });
      else item.reject(Error("runtime ack " + data[5]));
      return;
    }
    if (data[0] === ERROR && data.length === 4) {
      if (data[2] === 7) cooldownUntil = Date.now() + 30000;
      return;
    }
    if (data[0] === SCREEN_RGB && data.length === 774 && previewHandler) {
      let frame = new Array(256);
      for (let i = 0; i < frame.length; i++) frame[i] = (data[6 + i * 3] << 16) | (data[7 + i * 3] << 8) | data[8 + i * 3];
      previewHandler(frame);
      return;
    }
    if (data[0] === BUTTON_SNAPSHOT && data.length === 7) {
      buttonSequence = ((data[2] << 24) | (data[3] << 16) | (data[4] << 8) | data[5]) >>> 0;
      hasButtonSequence = true;
      buttonBits = data[6] & 7;
      return;
    }
    if (data[0] === BUTTON_EDGE && data.length === 8 && data[6] < 3) {
      let sequence = ((data[2] << 24) | (data[3] << 16) | (data[4] << 8) | data[5]) >>> 0;
      if (hasButtonSequence) {
        let distance = (sequence - buttonSequence) >>> 0;
        if (!distance || distance >= 0x80000000) return;
      }
      buttonSequence = sequence;
      hasButtonSequence = true;
      let mask = 1 << data[6], pressed = data[7] === 1;
      buttonBits = pressed ? buttonBits | mask : buttonBits & ~mask;
      if (pressed && buttonHandler) buttonHandler(["left", "middle", "right"][data[6]], true);
      return;
    }
    if (data[0] === PONG) return;
  }

  function scheduleReconnect(socketGeneration) {
    if (socketGeneration !== generation || explicitRelease || !hasDemand()) return;
    reconnectAttempt++;
    if (Date.now() < cooldownUntil || reconnectAttempt >= 4) {
      enterHttpFallback();
      return;
    }
    let delay = Math.min(5000, 250 * Math.pow(2, reconnectAttempt - 1));
    reconnectTimer = setTimeout(() => ensureTransport().catch(() => {}), delay);
  }

  function openSocket() {
    let preserveHttp = mode === "http";
    let socketGeneration = ++generation;
    previewWebSocketReady = false;
    connectPromise = new Promise((resolve, reject) => {
      connectResolve = resolve;
      connectReject = reject;
      clearBootstrapTimer();
      bootstrapTimer = setTimeout(() => {
        if (socketGeneration !== generation || !connectPromise) return;
        let rejectConnection = connectReject;
        connectPromise = null;
        connectResolve = null;
        connectReject = null;
        bootstrapTimer = null;
        mode = preserveHttp ? "http" : "idle";
        if (socket) socket.close();
        if (rejectConnection) rejectConnection(Error("runtime bootstrap timeout"));
      }, BOOTSTRAP_TIMEOUT_MS);
      fetch("/api/runtime/session", { method: "POST", cache: "no-store" })
        .then(async (response) => {
          if (response.status === 401) throw Error("runtime 401");
          if (!response.ok) throw Error("runtime session " + response.status);
          let session = await response.json();
          if (session.v !== VERSION) throw Error("runtime version");
          if (socketGeneration !== generation) throw Error("runtime connection cancelled");
          let ws = new WebSocket(runtimeUrl(session));
          socket = ws;
          if (!preserveHttp) mode = "connecting";
          ws.binaryType = "arraybuffer";
          ws.onopen = () => {
            if (socketGeneration === generation) ws.send(authPacket(session.token));
          };
          ws.onmessage = (event) => parseMessage(event, socketGeneration);
          ws.onerror = () => {};
          ws.onclose = () => {
            if (socketGeneration !== generation) return;
            clearBootstrapTimer();
            socket = null;
            stopPing();
            claimed = false;
            subscribed = 0;
            previewWebSocketReady = false;
            if (connectPromise) {
              connectReject(Error("runtime socket closed"));
              connectPromise = null;
              connectResolve = null;
              connectReject = null;
            }
            rejectPending(Error("runtime socket closed"));
            mode = preserveHttp ? "http" : "idle";
            if (preserveHttp) enterHttpFallback();
            else scheduleReconnect(socketGeneration);
          };
        })
        .catch((error) => {
          if (socketGeneration !== generation) return;
          clearBootstrapTimer();
          let rejectConnection = connectReject;
          connectPromise = null;
          connectResolve = null;
          connectReject = null;
          mode = preserveHttp ? "http" : "idle";
          if (rejectConnection) rejectConnection(error);
        });
    });
    return connectPromise;
  }

  async function ensureTransport() {
    if (mode === "ws") return "ws";
    if (mode === "http") {
      if (typeof WebSocket === "undefined") return "http";
      if (Date.now() < cooldownUntil) {
        scheduleCooldownRetry();
        return "http";
      }
      retryWebSocket();
      return "http";
    }
    if (connectPromise) return connectPromise;
    if (Date.now() < cooldownUntil || typeof WebSocket === "undefined") {
      mode = "http";
      return "http";
    }
    try {
      return await openSocket();
    } catch (error) {
      if (String(error.message).includes("401")) throw error;
      enterHttpFallback();
      return "http";
    }
  }

  function pollButtons() {
    if (!buttonHandler || mode === "ws" || buttonPollBusy) return;
    buttonPollBusy = true;
    fetch("/api/runtime/buttons", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((state) => {
        if (!state) return;
        ["left", "middle", "right"].forEach((key, index) => {
          let mask = 1 << index, pressed = !!state[key], wasPressed = !!(buttonBits & mask);
          buttonBits = pressed ? buttonBits | mask : buttonBits & ~mask;
          if (pressed && !wasPressed && buttonHandler) buttonHandler(key, true);
        });
      })
      .catch(() => {})
      .finally(() => { buttonPollBusy = false; });
  }

  function startButtonPolling() {
    if (buttonPollTimer || !buttonHandler || mode === "ws") return;
    buttonBits = 0;
    pollButtons();
    buttonPollTimer = setInterval(pollButtons, 200);
  }

  function stopButtonPolling() {
    if (buttonPollTimer) clearInterval(buttonPollTimer);
    buttonPollTimer = null;
    buttonPollBusy = false;
  }

  function ensureHttpClaim() {
    if (!desiredOwner || explicitRelease) return Promise.reject(Error("runtime not claimed"));
    if (lease) return Promise.resolve({ ok: true, lease });
    if (httpClaimPromise) return httpClaimPromise;
    claimed = false;
    httpClaimPromise = httpPost("/api/runtime/claim", { owner: desiredOwner })
      .then((result) => {
        if (explicitRelease || !desiredOwner) {
          if (result.lease) httpPost("/api/runtime/release", { lease: result.lease }).catch(() => {});
          throw Error("runtime released");
        }
        lease = result.lease || "";
        if (!lease) throw Error("runtime claim missing lease");
        claimed = true;
        return result;
      })
      .finally(() => {
        httpClaimPromise = null;
      });
    return httpClaimPromise;
  }

  async function claim(owner) {
    desiredOwner = String(owner || "web");
    explicitRelease = false;
    let transport = await ensureTransport();
    if (transport === "ws") {
      if (claimed) return { ok: true };
      return sendClaim();
    }
    return ensureHttpClaim();
  }

  async function frame(body) {
    let transport = await ensureTransport();
    if (transport === "http") {
      await ensureHttpClaim();
      let payload = Object.assign({}, body || {});
      payload.lease = lease;
      return httpPost("/api/runtime/frame", payload);
    }
    if (!claimed) await sendClaim();
    return new Promise((resolve, reject) => {
      if (pendingDraw) pendingDraw.resolve({ ok: true, dropped: true });
      pendingDraw = { body: body || {}, resolve, reject };
      flushDraw();
    });
  }

  async function release() {
    explicitRelease = true;
    clearReconnectTimer();
    desiredOwner = "";
    claimed = false;
    let currentLease = lease;
    lease = "";
    if (pendingDraw) pendingDraw.resolve({ ok: true, dropped: true });
    pendingDraw = null;
    if (mode === "ws" && socket && socket.readyState === WebSocket.OPEN) {
      try {
        return await sendRequest(RELEASE);
      } catch (error) {
        if (socket) socket.close();
        throw error;
      }
    }
    if (currentLease) {
      return httpPost("/api/runtime/release", { lease: currentLease });
    }
    return { ok: true };
  }

  function enableButtons(handler) {
    buttonHandler = handler || null;
    buttonBits = 0;
    hasButtonSequence = false;
    ensureTransport().then((transport) => transport === "ws" ? sendSubscribe() : startButtonPolling()).catch(() => startButtonPolling());
  }

  function disableButtons(handler) {
    if (handler && buttonHandler !== handler) return;
    buttonHandler = null;
    buttonBits = 0;
    hasButtonSequence = false;
    stopButtonPolling();
    if (!hasDemand()) clearReconnectTimer();
    if (mode === "ws") sendSubscribe().catch(() => {});
  }

  function setPreview(active, handler) {
    previewWanted = !!active;
    previewHandler = handler || previewHandler;
    if (!previewWanted) previewWebSocketReady = false;
    if (previewWanted) ensureTransport().then((transport) => transport === "ws" && sendSubscribe()).catch(() => {});
    else {
      if (!hasDemand()) clearReconnectTimer();
      if (mode === "ws") sendSubscribe().catch(() => {});
    }
    return mode;
  }

  function isWebSocket() {
    return mode === "ws";
  }

  function isPreviewWebSocketReady() {
    return previewWebSocketReady;
  }

  function isHttp() {
    return mode === "http";
  }

  function close() {
    explicitRelease = true;
    desiredOwner = "";
    previewWanted = false;
    buttonHandler = null;
    stopButtonPolling();
    stopPing();
    clearBootstrapTimer();
    clearReconnectTimer();
    generation++;
    let rejectConnection = connectReject;
    connectPromise = null;
    connectResolve = null;
    connectReject = null;
    if (rejectConnection) rejectConnection(Error("runtime transport closed"));
    if (socket) socket.close();
    socket = null;
    mode = "idle";
    claimed = false;
    lease = "";
    httpClaimPromise = null;
    subscribed = 0;
    subscribePromise = null;
    subscribeGeneration = 0;
    previewWebSocketReady = false;
    rejectPending(Error("runtime transport closed"));
  }

  function authReset() {
    cooldownUntil = 0;
    close();
  }

  function unloadRelease() {
    explicitRelease = true;
    desiredOwner = "";
    claimed = false;
    if (lease && navigator.sendBeacon) {
      let currentLease = lease;
      lease = "";
      let body = JSON.stringify({ lease: currentLease });
      return navigator.sendBeacon("/api/runtime/release", new Blob([body], { type: "application/json" }));
    }
    if (socket) socket.close();
    return false;
  }

  return {
    claim,
    frame,
    release,
    enableButtons,
    disableButtons,
    setPreview,
    isWebSocket,
    isPreviewWebSocketReady,
    isHttp,
    close,
    authReset,
    unloadRelease,
    _protocol: { authPacket, requestPacket, encodeFrame, runtimeUrl, bytesToHex },
  };
})();
