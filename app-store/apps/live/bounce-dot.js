export async function main(api, m) {
  let running = false, timer = null, x = 0, dx = 1;
  async function loop() {
    if (!running) return;
    const cfg = api.getConfig();
    await api.frame({ clear: true, commands: [
      api.commands.fill(0, 0, 32, 8, cfg.bgColor), api.commands.fill(x, 3, 2, 2, cfg.color), api.commands.text(0, 0, 'JS', '#00e5ff')
    ]});
    x += dx; if (x <= 0 || x >= 30) dx = -dx;
    timer = setTimeout(loop, cfg.speed || 80)
  }
  const desc = {
    title: m.name, hint: m.description,
    controls: [
      { id: 'start', label: { zh: '开始', en: 'Start' }, style: 'primary', key: 'right',
        action: async () => { if (running) return; running = true; await api.claim(); api.enableButtons(); loop() } },
      { id: 'stop',  label: { zh: '停止', en: 'Stop' }, style: 'tonal', key: 'left',
        action: () => { running = false; if (timer) clearTimeout(timer); api.status(api.t({ zh: '已停止', en: 'Stopped' }), false) } }
    ],
    config: [
      { id: 'color',   label: { zh: '点颜色',  en: 'Dot color'   }, type: 'text',   value: '#ffcc00' },
      { id: 'bgColor', label: { zh: '背景色',  en: 'Background'  }, type: 'text',   value: '#000000' },
      { id: 'speed',   label: { zh: '速度(ms)', en: 'Speed (ms)' }, type: 'number', value: 80 }
    ]
  };
  api.renderDialog(desc);
  api.onClose = async () => { running = false; if (timer) clearTimeout(timer) };
}
