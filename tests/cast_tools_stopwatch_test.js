#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function createClock(start = 0) {
  let now = start;
  let nextId = 0;
  const timers = new Map();
  return {
    Date: class extends Date { static now() { return now; } },
    setTimeout(callback, delay) {
      const id = ++nextId;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    async advance(ms) {
      const target = now + ms;
      while (true) {
        const next = Array.from(timers.entries())
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, timer] = next;
        timers.delete(id);
        now = timer.at;
        timer.callback();
        await tick();
      }
      now = target;
      await tick();
    },
    timers,
  };
}

function frameText(body) {
  const command = body.commands.find((item) => item.dt);
  return command.dt[2];
}

function loadBuiltIn(clock, runtimePost, isWebSocket = false) {
  const context = {
    Date: clock.Date,
    Promise,
    Math,
    String,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    runtimePost,
    runtimeTransport: { isWebSocket: () => isWebSocket },
    setStatus() {},
    E: { sheetStatus: {}, sheet: { classList: { remove() {} } } },
  };
  vm.createContext(context);
  const source = fs.readFileSync("www/js/cast-tools.js", "utf8");
  vm.runInContext(source + "\nthis.stopwatchTest = { stopwatch, stopwatchStart, stopwatchPause, stopwatchReset, stopwatchStop };", context);
  return context.stopwatchTest;
}

async function testBuiltInCadenceAndElapsed() {
  const clock = createClock(1000);
  const frames = [];
  const stopwatch = loadBuiltIn(clock, async (path, body) => {
    if (path === "/api/runtime/frame") frames.push({ at: clock.Date.now(), body });
  });
  await stopwatch.stopwatchStart();
  await clock.advance(1000);
  assert.ok(frames.length >= 15 && frames.length <= 16, `expected about 15 FPS, got ${frames.length}`);
  await stopwatch.stopwatchPause();
  assert.equal(frameText(frames.at(-1).body), "00:01.00");
  const gaps = frames.slice(1).map((frame, index) => frame.at - frames[index].at);
  assert.ok(gaps.every((gap) => gap > 66 && gap < 67), `unexpected cadence ${gaps.join(",")}`);
}

async function testBuiltInWebSocketCadenceWithSlowAck() {
  const clock = createClock(0);
  const frames = [];
  let active = 0;
  let maxActive = 0;
  let pending = null;
  function flush() {
    if (active || !pending) return;
    const frame = pending;
    pending = null;
    active++;
    maxActive = Math.max(maxActive, active);
    clock.setTimeout(() => {
      active--;
      frame.resolve();
      flush();
    }, 80);
  }
  const stopwatch = loadBuiltIn(clock, (path, body) => {
    if (path === "/api/runtime/frame") {
      frames.push({ at: clock.Date.now(), body });
      return new Promise((resolve) => {
        if (pending) pending.resolve({ dropped: true });
        pending = { resolve };
        flush();
      });
    }
    return Promise.resolve();
  }, true);
  await stopwatch.stopwatchStart();
  await clock.advance(999);
  assert.equal(frames.length, 15, "WebSocket submits every cadence tick despite deferred ACK");
  assert.equal(maxActive, 1, "transport model keeps one WebSocket frame in flight");
  const gaps = frames.slice(1).map((frame, index) => frame.at - frames[index].at);
  assert.ok(gaps.every((gap) => gap > 66 && gap < 67), `unexpected WebSocket cadence ${gaps.join(",")}`);
}

async function testBuiltInCoalescingAndLifecycle() {
  const clock = createClock(0);
  const frames = [];
  const releases = [];
  let active = 0;
  let maxActive = 0;
  let blocked = null;
  const stopwatch = loadBuiltIn(clock, (path, body) => {
    if (path === "/api/runtime/release") { releases.push(clock.Date.now()); return Promise.resolve(); }
    if (path !== "/api/runtime/frame") return Promise.resolve();
    frames.push(body);
    active++;
    maxActive = Math.max(maxActive, active);
    if (!blocked) blocked = deferred();
    return blocked.promise.finally(() => { active--; });
  });

  const started = stopwatch.stopwatchStart();
  await tick();
  await clock.advance(500);
  assert.equal(frames.length, 1, "slow transport keeps one request active");
  const paused = stopwatch.stopwatchPause();
  await clock.advance(500);
  blocked.resolve();
  await started;
  await paused;
  await tick();
  assert.equal(maxActive, 1, "frame requests never overlap");
  assert.equal(frames.length, 2, "pause flushes one latest frame");
  assert.equal(frameText(frames[1]), "00:00.50");
  await clock.advance(500);
  assert.equal(frames.length, 2, "pause cancels deadlines without revival");

  blocked = { promise: Promise.resolve() };
  await stopwatch.stopwatchReset();
  await tick();
  assert.equal(frameText(frames.at(-1)), "00:00.00");
  await stopwatch.stopwatchStop();
  await clock.advance(500);
  assert.equal(releases.length, 1);
  assert.equal(frames.length, 3, "stop emits no late frames");
}

async function run() {
  await testBuiltInCadenceAndElapsed();
  await testBuiltInWebSocketCadenceWithSlowAck();
  await testBuiltInCoalescingAndLifecycle();
  console.log("stopwatch pacing tests: ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
