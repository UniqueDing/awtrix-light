function fmt(ms) { const t = Math.floor(ms / 10); return String(Math.floor(t/6000)).padStart(2,'0')+':'+String(Math.floor(t/100)%60).padStart(2,'0')+'.'+String(t%100).padStart(2,'0') }

export async function main(api, m) {
  const frameInterval = 1000 / 15;
  let running = false, start = 0, elapsed = 0, frameTimer = null, raf = null, busy = false, pendingFrame = null, nextFrame = 0, generation = 0;

  function v() { return running ? elapsed + (Date.now() - start) : elapsed }

  function color() { return running ? '#00e5ff' : '#ffcc00' }

  function updateUi() {
    api.updateDisplay('time', fmt(v()));
    if (running) raf = requestAnimationFrame(updateUi)
  }

  function stopLoops() {
    if (frameTimer) { clearTimeout(frameTimer); frameTimer = null }
    if (raf) { cancelAnimationFrame(raf); raf = null }
  }

  async function pushFrame(token) {
    if (token !== generation) return;
    if (api.isWebSocket && api.isWebSocket()) {
      api.frame({ clear: true, commands: [api.commands.text(3, 2, fmt(v()), color())] }).catch(() => {});
      return
    }
    pendingFrame = token;
    if (busy) return;
    busy = true;
    while (pendingFrame !== null) {
      const frameToken = pendingFrame;
      pendingFrame = null;
      if (frameToken !== generation) continue;
      try { await api.frame({ clear: true, commands: [api.commands.text(3, 2, fmt(v()), color())] }) } catch (e) {}
    }
    busy = false;
  }

  function frameLoop(token) {
    if (!running || token !== generation) return;
    pushFrame(token);
    const now = Date.now();
    do nextFrame += frameInterval; while (nextFrame <= now);
    frameTimer = setTimeout(() => frameLoop(token), nextFrame - now)
  }

  function startTimer() {
    if (running) return;
    running = true; start = Date.now();
    generation++; nextFrame = Date.now(); pendingFrame = null;
    stopLoops();
    updateUi();
    frameLoop(generation)
  }

  function pauseTimer() {
    if (!running) return;
    elapsed = v(); running = false;
    generation++; pendingFrame = null;
    stopLoops();
    updateUi();
    pushFrame(generation)
  }

  function resetTimer() {
    running = false; elapsed = 0; start = 0;
    generation++; pendingFrame = null;
    stopLoops();
    updateUi();
    pushFrame(generation)
  }

  const desc = {
    title: m.name, hint: m.description,
    display: { type: 'text', id: 'time', initial: '00:00.00' },
    controls: [
      { id: 'start', label: { zh: '开始', en: 'Start' }, style: 'primary', key: 'right', action: startTimer },
      { id: 'pause', label: { zh: '暂停', en: 'Pause' }, style: 'tonal', action: pauseTimer },
      { id: 'reset', label: { zh: '重置', en: 'Reset' }, style: 'tonal', key: 'middle', action: resetTimer }
    ]
  };

  api.renderDialog(desc);
  api.onClose = () => { running = false; generation++; pendingFrame = null; stopLoops() };
  await api.claim(); api.enableButtons(); updateUi(); pushFrame(generation)
}
