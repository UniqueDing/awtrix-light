export async function main(api, m) {
  let running = false, count = 0, timer = null;

  async function loop() {
    if (!running) return;
    count++;
    const cfg = api.getConfig();
    api.updateDisplay('counter', String(count));
    await api.frame({ clear: true, commands: [
      api.commands.clear(), api.commands.text(0, 0, String(count), '#ffffff'),
      api.commands.fill(0, 7, Math.min(32, count), 1, cfg.color)
    ]});
    timer = setTimeout(loop, cfg.interval || 100);
  }

  const desc = {
    title: m.name, hint: m.description,
    display: { type: 'text', id: 'counter', initial: '0' },
    controls: [
      { id: 'start', label: { zh: '开始', en: 'Start' }, style: 'primary', key: 'right',
        action: async () => { if (running) return; running = true; await api.claim(); api.enableButtons(); api.status('v' + m.version + ' · ' + m.author, false); loop() } },
      { id: 'stop',  label: { zh: '停止', en: 'Stop'  }, style: 'tonal',   key: 'left',
        action: () => { running = false; if (timer) clearTimeout(timer); api.status(api.t({ zh: '已停止', en: 'Stopped' }), false) } },
      { id: 'reset', label: { zh: '重置', en: 'Reset' }, style: 'danger',  key: 'middle',
        action: () => { running = false; if (timer) clearTimeout(timer); count = 0; api.updateDisplay('counter', '0') } },
    ],
    config: [
      { id: 'interval', label: { zh: '间隔(ms)', en: 'Interval(ms)' }, type: 'number', value: 100 },
      { id: 'color',    label: { zh: '颜色',      en: 'Color'        }, type: 'text',   value: '#00e5ff' },
    ]
  };

  const root = api.renderDialog(desc);
  api.onClose = async () => { running = false; if (timer) clearTimeout(timer) };
}
