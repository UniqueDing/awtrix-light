#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function hex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

function makeResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function createMockWebSocket() {
  const sockets = [];
  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url) {
      this.url = url;
      this.readyState = MockWebSocket.CONNECTING;
      this.sent = [];
      sockets.push(this);
    }

    send(data) {
      this.sent.push(new Uint8Array(data));
    }

    close() {
      if (this.readyState === MockWebSocket.CLOSED) return;
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) this.onclose({});
    }

    serverOpen() {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen({});
    }

    serverMessage(bytes) {
      const copy = Uint8Array.from(bytes);
      if (this.onmessage) this.onmessage({ data: copy.buffer });
    }

    serverClose() {
      this.close();
    }
  }
  return { MockWebSocket, sockets };
}

function loadTransport(overrides) {
  const storage = {};
  let sessionRequests = 0;
  const context = Object.assign(
    {
      TextEncoder,
      Uint8Array,
      ArrayBuffer,
      Blob,
      Map,
      Promise,
      Date,
      Math,
      JSON,
      Error,
      Number,
      String,
      Array,
      parseInt,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      location: { protocol: "http:", hostname: "awtrix.local" },
      localStorage: storage,
      sessionStorage: storage,
      navigator: { sendBeacon: () => true },
      fetch: () => Promise.reject(Error("unexpected fetch")),
      WebSocket: undefined,
    },
    overrides || {},
  );
  vm.createContext(context);
  const source = fs.readFileSync("www/js/runtime-transport.js", "utf8");
  vm.runInContext(source + "\nthis.runtimeTransportForTest = runtimeTransport;", context);
  return { transport: context.runtimeTransportForTest, context };
}

function createFakeClock(start = 0) {
  let now = start;
  let nextId = 0;
  const timers = new Map();
  return {
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    setTimeout(callback, delay) {
      const id = ++nextId;
      timers.set(id, { callback, at: now + delay, interval: 0 });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    setInterval(callback, delay) {
      const id = ++nextId;
      timers.set(id, { callback, at: now + delay, interval: delay });
      return id;
    },
    clearInterval(id) {
      timers.delete(id);
    },
    async advance(ms) {
      const target = now + ms;
      while (true) {
        let next = Array.from(timers.entries())
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, timer] = next;
        now = timer.at;
        if (timer.interval) timer.at += timer.interval;
        else timers.delete(id);
        timer.callback();
        await tick();
      }
      now = target;
      await tick();
    },
    timers,
  };
}

function ack(type, id, status = 0) {
  return [0x82, 1, type, id >> 8, id & 255, status];
}

function requestId(packet) {
  return (packet[2] << 8) | packet[3];
}

async function testProtocolFixtures() {
  let { transport } = loadTransport();
  let protocol = transport._protocol;
  assert.equal(hex(protocol.authPacket("00112233445566778899aabbccddeeff")), "010100112233445566778899aabbccddeeff");
  assert.equal(hex(protocol.requestPacket(3, 0x1235)), "03011235");
  assert.equal(protocol.runtimeUrl({ port: 81, path: "/runtime" }), "ws://awtrix.local:81/runtime");

  ({ transport } = loadTransport({ location: { protocol: "https:", hostname: "fe80::1234" } }));
  assert.equal(transport._protocol.runtimeUrl({ port: 81, path: "runtime" }), "wss://[fe80::1234]:81/runtime");
  protocol = transport._protocol;
  assert.equal(hex(protocol.encodeFrame({ commands: [{ dp: [2, 3, "#ff0000"] }] }, 1)), "040100010001030203ff0000");
  assert.equal(hex(protocol.encodeFrame({ clear: true, commands: [{ df: [0, 0, 32, 8, 255] }] }, 2)), "04010002010101000020080000ff");
  assert.equal(hex(protocol.encodeFrame({ commands: [{ dl: [-1, 0, 31, 7, "#00ff00"] }] }, 3)), "04010003000104ff001f0700ff00");
  assert.equal(hex(protocol.encodeFrame({ commands: [{ dt: [1, 6, "Hi", "#ffffff"] }] }, 4)), "040100040001020106ffffff024869");
  assert.throws(() => protocol.encodeFrame({ commands: [{ dt: [0, 0, "x".repeat(129), 0] }] }, 1), /128 UTF-8 bytes/);
}

async function testHttpLeaseFlow() {
  const calls = [];
  const { transport } = loadTransport({
    fetch: async (path, options) => {
      calls.push({ path, body: options && options.body ? JSON.parse(options.body) : null });
      if (path === "/api/runtime/claim") return makeResponse(200, { ok: true, lease: "lease-value" });
      return makeResponse(200, { ok: true });
    },
  });
  await Promise.all([transport.claim("test-owner"), transport.claim("test-owner")]);
  await transport.frame({ clear: true, commands: [] });
  await transport.release();
  assert.deepEqual(calls.map((call) => call.path), ["/api/runtime/claim", "/api/runtime/frame", "/api/runtime/release"]);
  assert.equal(calls[1].body.lease, "lease-value");
  assert.equal(calls[2].body.lease, "lease-value");
}

async function testWebSocketStateFlow() {
  const token = "00112233445566778899aabbccddeeff";
  const httpCalls = [];
  const { MockWebSocket, sockets } = createMockWebSocket();
  const clicks = [];
  const screens = [];
  const storage = {};
  let sessionRequests = 0;
  const { transport } = loadTransport({
    WebSocket: MockWebSocket,
    localStorage: storage,
    sessionStorage: storage,
    fetch: async (path, options) => {
      httpCalls.push({ path, body: options && options.body ? JSON.parse(options.body) : null });
      if (path === "/api/runtime/session") {
        sessionRequests++;
        return sessionRequests === 1
          ? makeResponse(200, { v: 1, port: 81, path: "/runtime", token })
          : makeResponse(404, {});
      }
      if (path === "/api/runtime/claim") return makeResponse(200, { ok: true, lease: "http-lease" });
      return makeResponse(200, { ok: true });
    },
  });

  transport.enableButtons((key) => clicks.push(key));
  transport.setPreview(true, (frame) => screens.push(frame));
  const claimPromise = transport.claim("live-owner");
  await tick();
  assert.equal(sockets.length, 1, "one singleton socket for concurrent consumers");
  const socket = sockets[0];
  assert.equal(socket.url, "ws://awtrix.local:81/runtime");
  assert.equal(socket.url.includes(token), false, "token absent from URL");
  assert.deepEqual(storage, {}, "token absent from storage");

  socket.serverOpen();
  assert.equal(hex(socket.sent[0]), "010100112233445566778899aabbccddeeff");
  socket.serverMessage([0x81, 1, 0, 0, 0, 1, 0x10, 0, 7, 0]);
  await tick();
  const claimPacket = socket.sent.find((packet) => packet[0] === 2);
  assert.ok(claimPacket);
  socket.serverMessage(ack(2, requestId(claimPacket)));
  await tick();
  const subscribePacket = socket.sent.find((packet) => packet[0] === 5);
  assert.ok(subscribePacket);
  assert.equal(subscribePacket[4], 3);
  assert.equal(subscribePacket[5], 30);
  socket.serverMessage(ack(5, requestId(subscribePacket)));
  await claimPromise;

  const framePromise = transport.frame({ clear: true, commands: [{ dp: [1, 2, "#123456"] }] });
  await tick();
  const drawPacket = socket.sent.find((packet) => packet[0] === 4);
  assert.ok(drawPacket);
  socket.serverMessage(ack(4, requestId(drawPacket)));
  await framePromise;

  const screen = new Uint8Array(774);
  screen.set([0x84, 1, 0, 0, 0, 9, 0x12, 0x34, 0x56]);
  socket.serverMessage(screen);
  assert.equal(screens.length, 1);
  assert.equal(screens[0][0], 0x123456);

  socket.serverMessage([0x86, 1, 0, 0, 0, 10, 0]);
  socket.serverMessage([0x85, 1, 0, 0, 0, 9, 0, 1]);
  socket.serverMessage([0x85, 1, 0, 0, 0, 10, 0, 1]);
  assert.deepEqual(clicks, [], "snapshot and historical edges never click");
  socket.serverMessage([0x85, 1, 0, 0, 0, 11, 0, 1]);
  socket.serverMessage([0x85, 1, 0, 0, 0, 12, 0, 0]);
  assert.deepEqual(clicks, ["left"], "only newer press edge clicks");

  socket.serverClose();
  await tick();
  const fallbackFrame = transport.frame({ clear: false, commands: [] });
  await fallbackFrame;
  const fallbackPaths = httpCalls.map((call) => call.path).filter((path) => path === "/api/runtime/claim" || path === "/api/runtime/frame");
  assert.deepEqual(fallbackPaths, ["/api/runtime/claim", "/api/runtime/frame"]);
  assert.equal(httpCalls.at(-1).body.lease, "http-lease");
  assert.equal(sockets.length, 1, "cooldown prevents a second socket during fallback");
  transport.close();
}

async function testAckTimeoutAndUnload() {
  const { MockWebSocket, sockets } = createMockWebSocket();
  const token = "ffeeddccbbaa99887766554433221100";
  const timers = new Map();
  let timerId = 0;
  const { transport } = loadTransport({
    WebSocket: MockWebSocket,
    setTimeout(callback, delay) {
      const id = ++timerId;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    fetch: async (path) => {
      if (path === "/api/runtime/session") return makeResponse(200, { v: 1, port: 81, path: "/runtime", token });
      if (path === "/api/runtime/claim") return makeResponse(200, { ok: true, lease: "timeout-fallback-lease" });
      return makeResponse(200, { ok: true });
    },
  });
  const claimPromise = transport.claim("timeout-owner");
  await tick();
  const socket = sockets[0];
  socket.serverOpen();
  socket.serverMessage([0x81, 1, 0, 0, 0, 1, 0x10, 0, 7, 0]);
  await tick();
  const timeout = Array.from(timers.values()).find((timer) => timer.delay === 4000);
  assert.ok(timeout, "claim ACK has bounded timeout");
  timeout.callback();
  const recoveredClaim = await claimPromise;
  assert.equal(recoveredClaim.lease, "timeout-fallback-lease");
  assert.equal(socket.readyState, MockWebSocket.CLOSED);

  const beacons = [];
  const unloadFetches = [];
  const http = loadTransport({
    navigator: {
      sendBeacon(path, body) {
        beacons.push({ path, body });
        return true;
      },
    },
    fetch: async (path) => {
      unloadFetches.push(path);
      return path === "/api/runtime/claim"
        ? makeResponse(200, { ok: true, lease: "unload-lease" })
        : makeResponse(200, { ok: true });
    },
  }).transport;
  await http.claim("external-live");
  assert.equal(http.unloadRelease(), true);
  assert.equal(beacons.length, 1);
  assert.equal(beacons[0].path, "/api/runtime/release");
  assert.equal(await beacons[0].body.text(), JSON.stringify({ lease: "unload-lease" }));
  assert.deepEqual(unloadFetches, ["/api/runtime/claim"], "unload uses only sendBeacon for an HTTP lease");
}

async function testBootstrapTimeouts() {
  async function runCase(openSocket) {
    const { MockWebSocket, sockets } = createMockWebSocket();
    const timers = new Map();
    let timerId = 0;
    const calls = [];
    const { transport } = loadTransport({
      WebSocket: MockWebSocket,
      setTimeout(callback, delay) {
        const id = ++timerId;
        timers.set(id, { callback, delay });
        return id;
      },
      clearTimeout(id) {
        timers.delete(id);
      },
      fetch: async (path) => {
        calls.push(path);
        if (path === "/api/runtime/session") return makeResponse(200, {
          v: 1,
          port: 81,
          path: "/runtime",
          token: "00112233445566778899aabbccddeeff",
        });
        if (path === "/api/runtime/claim") return makeResponse(200, { ok: true, lease: "bootstrap-fallback" });
        return makeResponse(200, { ok: true });
      },
    });
    const claim = transport.claim("bootstrap-owner");
    await tick();
    assert.equal(sockets.length, 1);
    if (openSocket) sockets[0].serverOpen();
    const timeout = Array.from(timers.values()).find((timer) => timer.delay === 4000);
    assert.ok(timeout, "bootstrap has a bounded timeout");
    timeout.callback();
    const result = await claim;
    assert.equal(result.lease, "bootstrap-fallback");
    assert.equal(sockets[0].readyState, MockWebSocket.CLOSED);
    assert.deepEqual(calls, ["/api/runtime/session", "/api/runtime/claim"]);
  }

  await runCase(false);
  await runCase(true);
}

async function testAuthResetCancelsBootstrap() {
  const { MockWebSocket, sockets } = createMockWebSocket();
  let resolveSession;
  const session = new Promise((resolve) => {
    resolveSession = resolve;
  });
  const { transport } = loadTransport({
    WebSocket: MockWebSocket,
    fetch: () => session,
  });
  const claim = transport.claim("cancelled-owner");
  await tick();
  transport.authReset();
  await assert.rejects(claim, /runtime (transport closed|not claimed)/);
  resolveSession(makeResponse(200, {
    v: 1,
    port: 81,
    path: "/runtime",
    token: "00112233445566778899aabbccddeeff",
  }));
  await tick();
  assert.equal(sockets.length, 0, "auth reset prevents late socket creation");
}

async function testCooldownRetriesWithDemand() {
  const clock = createFakeClock(1000);
  const { MockWebSocket, sockets } = createMockWebSocket();
  const calls = [];
  let sessionRequests = 0;
  const { transport } = loadTransport({
    Date: clock.Date,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    WebSocket: MockWebSocket,
    fetch: async (path) => {
      calls.push(path);
      if (path === "/api/runtime/session") {
        sessionRequests++;
        return sessionRequests === 1
          ? makeResponse(503, {})
          : makeResponse(200, {
              v: 1,
              port: 81,
              path: "/runtime",
              token: "00112233445566778899aabbccddeeff",
            });
      }
      if (path === "/api/screen") return makeResponse(200, []);
      return makeResponse(200, { ok: true });
    },
  });

  transport.setPreview(true, () => {});
  await tick();
  assert.equal(transport.isHttp(), true);
  assert.equal(sockets.length, 0);
  assert.equal(calls.filter((path) => path === "/api/runtime/session").length, 1);

  await clock.advance(29999);
  assert.equal(sockets.length, 0, "HTTP fallback remains active during cooldown");
  assert.equal(transport.isHttp(), true, "preview polling can continue detecting HTTP mode");

  await clock.advance(1);
  assert.equal(calls.filter((path) => path === "/api/runtime/session").length, 2);
  assert.equal(sockets.length, 1, "cooldown expiry opens exactly one retry socket");
  assert.equal(transport.isHttp(), true, "HTTP remains active until READY");

  const socket = sockets[0];
  socket.serverOpen();
  socket.serverMessage([0x81, 1, 0, 0, 0, 2, 0x10, 0, 7, 0]);
  await tick();
  const subscribe = socket.sent.find((packet) => packet[0] === 5);
  assert.ok(subscribe);
  assert.equal(subscribe[4], 1, "preview-only retry does not claim runtime");
  assert.equal(subscribe[5], 30);
  assert.equal(socket.sent.some((packet) => packet[0] === 2), false);
  socket.serverMessage(ack(5, requestId(subscribe)));
  await tick();
  assert.equal(transport.isWebSocket(), true);
  assert.equal(transport.isHttp(), false, "preview polling caller can stop after subscription ACK");
  transport.close();
}

async function testCooldownDoesNotRetryWithoutDemand() {
  const clock = createFakeClock(5000);
  const { MockWebSocket, sockets } = createMockWebSocket();
  let sessions = 0;
  const { transport } = loadTransport({
    Date: clock.Date,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    WebSocket: MockWebSocket,
    fetch: async (path) => {
      if (path === "/api/runtime/session") {
        sessions++;
        return makeResponse(503, {});
      }
      return makeResponse(200, { ok: true });
    },
  });
  transport.setPreview(true, () => {});
  await tick();
  assert.equal(transport.isHttp(), true);
  transport.setPreview(false);
  await clock.advance(30000);
  assert.equal(sessions, 1);
  assert.equal(sockets.length, 0, "no demand means no cooldown retry");
  transport.close();
}

async function testPreviewReadinessWaitsForSubscribeAck() {
  const { MockWebSocket, sockets } = createMockWebSocket();
  const { transport } = loadTransport({
    WebSocket: MockWebSocket,
    fetch: async (path) => path === "/api/runtime/session"
      ? makeResponse(200, {
          v: 1,
          port: 81,
          path: "/runtime",
          token: "00112233445566778899aabbccddeeff",
        })
      : makeResponse(200, { ok: true }),
  });

  transport.setPreview(true, () => {});
  await tick();
  const socket = sockets[0];
  socket.serverOpen();
  socket.serverMessage([0x81, 1, 0, 0, 0, 1, 0x10, 0, 7, 0]);
  await tick();

  const subscribe = socket.sent.find((packet) => packet[0] === 5);
  assert.ok(subscribe);
  assert.equal(transport.isWebSocket(), true, "generic WebSocket readiness remains READY-based");
  assert.equal(transport.isPreviewWebSocketReady(), false, "preview remains on HTTP fallback before SUBSCRIBE ACK");

  socket.serverMessage(ack(5, requestId(subscribe)));
  await tick();
  assert.equal(transport.isPreviewWebSocketReady(), true);
  transport.close();
}

async function testRapidPreviewSubscriptionReconciliation() {
  const { MockWebSocket, sockets } = createMockWebSocket();
  const { transport } = loadTransport({
    WebSocket: MockWebSocket,
    fetch: async (path) => path === "/api/runtime/session"
      ? makeResponse(200, {
          v: 1,
          port: 81,
          path: "/runtime",
          token: "00112233445566778899aabbccddeeff",
        })
      : makeResponse(200, { ok: true }),
  });

  transport.setPreview(true, () => {});
  await tick();
  const socket = sockets[0];
  socket.serverOpen();
  socket.serverMessage([0x81, 1, 0, 0, 0, 1, 0x10, 0, 7, 0]);
  await tick();
  const initialSubscribe = socket.sent.find((packet) => packet[0] === 5);
  socket.serverMessage(ack(5, requestId(initialSubscribe)));
  await tick();
  assert.equal(transport.isPreviewWebSocketReady(), true);

  transport.setPreview(false);
  const unsubscribe = socket.sent.filter((packet) => packet[0] === 5).at(-1);
  assert.equal(unsubscribe[4], 0);
  transport.setPreview(true);
  assert.equal(socket.sent.filter((packet) => packet[0] === 5).length, 2, "one subscription request remains in flight");

  socket.serverMessage(ack(5, requestId(unsubscribe)));
  await tick();
  const reconciledSubscribe = socket.sent.filter((packet) => packet[0] === 5).at(-1);
  assert.equal(socket.sent.filter((packet) => packet[0] === 5).length, 3, "ACK immediately triggers compensating subscription");
  assert.equal(reconciledSubscribe[4], 1);
  assert.equal(reconciledSubscribe[5], 30);
  assert.equal(transport.isPreviewWebSocketReady(), false);

  socket.serverMessage(ack(5, requestId(reconciledSubscribe)));
  await tick();
  assert.equal(transport.isPreviewWebSocketReady(), true);
  transport.close();
}

async function testPreviewReconnectResubscribesAndReceivesFrames() {
  const clock = createFakeClock(1000);
  const { MockWebSocket, sockets } = createMockWebSocket();
  const frames = [];
  const { transport } = loadTransport({
    Date: clock.Date,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    WebSocket: MockWebSocket,
    fetch: async (path) => path === "/api/runtime/session"
      ? makeResponse(200, {
          v: 1,
          port: 81,
          path: "/runtime",
          token: "00112233445566778899aabbccddeeff",
        })
      : makeResponse(200, { ok: true }),
  });

  transport.setPreview(true, (frame) => frames.push(frame));
  await tick();
  const firstSocket = sockets[0];
  firstSocket.serverOpen();
  firstSocket.serverMessage([0x81, 1, 0, 0, 0, 1, 0x10, 0, 7, 0]);
  await tick();
  const firstSubscribe = firstSocket.sent.find((packet) => packet[0] === 5);
  firstSocket.serverMessage(ack(5, requestId(firstSubscribe)));
  await tick();
  assert.equal(transport.isPreviewWebSocketReady(), true);

  firstSocket.serverClose();
  assert.equal(transport.isPreviewWebSocketReady(), false);
  await clock.advance(250);
  assert.equal(sockets.length, 2, "established preview demand reconnects once");

  const secondSocket = sockets[1];
  secondSocket.serverOpen();
  secondSocket.serverMessage([0x81, 1, 0, 0, 0, 2, 0x10, 0, 7, 0]);
  await tick();
  const secondSubscribe = secondSocket.sent.find((packet) => packet[0] === 5);
  assert.ok(secondSubscribe, "reconnect resubscribes retained preview demand");
  assert.equal(secondSubscribe[4], 1);
  assert.equal(secondSubscribe[5], 30);
  secondSocket.serverMessage(ack(5, requestId(secondSubscribe)));
  await tick();
  assert.equal(transport.isPreviewWebSocketReady(), true);

  const screen = new Uint8Array(774);
  screen.set([0x84, 1, 0, 0, 0, 3, 0xab, 0xcd, 0xef]);
  secondSocket.serverMessage(screen);
  assert.equal(frames.length, 1);
  assert.equal(frames[0][0], 0xabcdef, "retained handler receives SCREEN_RGB after reconnect");
  transport.close();
}

async function run() {
  await testProtocolFixtures();
  await testHttpLeaseFlow();
  await testWebSocketStateFlow();
  await testAckTimeoutAndUnload();
  await testBootstrapTimeouts();
  await testAuthResetCancelsBootstrap();
  await testCooldownRetriesWithDemand();
  await testCooldownDoesNotRetryWithoutDemand();
  await testPreviewReadinessWaitsForSubscribeAck();
  await testRapidPreviewSubscriptionReconciliation();
  await testPreviewReconnectResubscribesAndReceivesFrames();
  console.log("runtime transport tests: ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
