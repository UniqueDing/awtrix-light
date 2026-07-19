function fmt(ms) { ms = Math.max(0, ms); const t = Math.ceil(ms/1000), s = t % 60, m = Math.floor(t/60); return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0') }

export async function main(api, m) {
  let total = 300000, remaining = 300000, running = false, end = 0, timer = null;
  function left() { return running ? Math.max(0, end - Date.now()) : remaining }
  function readConfig() { const c = api.getConfig(); total = Math.max(1, (Number(c.minutes)||0)*60 + (Number(c.seconds)||0)) * 1000; remaining = total }
  async function draw() {
    const v = left(), done = v <= 0, cfg = api.getConfig();
    api.updateDisplay('time', done ? 'DONE' : fmt(v));
    const color = done ? cfg.doneColor : cfg.color, w = total > 0 ? Math.max(0, Math.min(32, Math.ceil(v / total * 32))) : 0;
    await api.frame({ clear: true, commands: [api.commands.clear(), api.commands.text(done?1:0, 0, done?'DONE':fmt(v), color), api.commands.fill(0, 7, w, 1, color)] });
    if (running && !done) timer = setTimeout(draw, 120)
  }

  const desc = {
    title: m.name, hint: m.description,
    display: { type: 'text', id: 'time', initial: '05:00' },
    controls: [
      { id: 'start', label: { zh: '开始', en: 'Start' }, style: 'primary', key: 'right',
        action: () => { if (running) return; readConfig(); running = true; end = Date.now() + remaining; draw() } },
      { id: 'pause', label: { zh: '暂停', en: 'Pause' }, style: 'tonal',
        action: () => { if (!running) return; remaining = left(); running = false; if (timer) clearTimeout(timer); draw() } },
      { id: 'reset', label: { zh: '重置', en: 'Reset' }, style: 'tonal', key: 'middle',
        action: () => { running = false; if (timer) clearTimeout(timer); readConfig(); api.updateDisplay('time', fmt(total)); draw() } }
    ],
    config: [
      { id: 'minutes',  label: { zh: '分钟', en: 'Minutes'  }, type: 'number', value: 5 },
      { id: 'seconds',  label: { zh: '秒',   en: 'Seconds' }, type: 'number', value: 0 },
      { id: 'doneColor', label: { zh: '结束色', en: 'Done color' }, type: 'text', value: '#ff4444' },
      { id: 'color',     label: { zh: '计时色', en: 'Timer color' }, type: 'text', value: '#00ff99' }
    ]
  };

  api.renderDialog(desc);
  api.onClose = async () => { running = false; if (timer) clearTimeout(timer) };
  api.updateDisplay('time', fmt(total)); await api.claim(); api.enableButtons(); draw()
}
