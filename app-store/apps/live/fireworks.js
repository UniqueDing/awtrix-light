function burst(api) {
  const cs = ['#ff4444', '#ffcc00', '#00e5ff', '#aa44ff', '#00ff66'];
  const cmds = [api.commands.clear()], cx = Math.floor(Math.random() * 32), cy = Math.floor(Math.random() * 8);
  for (let i = 0; i < 36; i++) { const a = Math.random() * Math.PI * 2, r = Math.random() * 6; cmds.push(api.commands.pixel(Math.max(0, Math.min(31, Math.round(cx + Math.cos(a) * r))), Math.max(0, Math.min(7, Math.round(cy + Math.sin(a) * r))), cs[i % cs.length])) }
  return cmds
}

export async function main(api, m) {
  let running = false, timer = null;
  async function loop() { if (!running) return; await api.frame({ clear: true, commands: burst(api) }); timer = setTimeout(loop, api.getConfig().speed || 180) }

  const desc = {
    title: m.name, hint: m.description,
    controls: [
      { id: 'start', label: { zh: '开始', en: 'Start' }, style: 'primary', key: 'right',
        action: async () => { running = true; await api.claim(); api.enableButtons(); loop() } },
      { id: 'stop',  label: { zh: '停止', en: 'Stop' }, style: 'tonal', key: 'left',
        action: () => { running = false; if (timer) clearTimeout(timer); api.status(api.t({ zh: '已停止', en: 'Stopped' }), false) } }
    ],
    config: [
      { id: 'speed', label: { zh: '速度(ms)', en: 'Speed (ms)' }, type: 'number', value: 180 }
    ]
  };

  api.renderDialog(desc);
  api.onClose = async () => { running = false; if (timer) clearTimeout(timer) };
}
