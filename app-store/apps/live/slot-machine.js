const symbols = ['🍒', '🍋', 'BAR', '7', '💎', '👑', '🍇', '🍉'];

export async function main(api, m) {
  let reels = [0, 1, 2], spinning = false, timer = null;
  function textFor() { return reels.map(i => symbols[i]).join(' ') }
  async function draw() { api.updateDisplay('reels', textFor()); await api.frame({ clear: true, commands: [api.commands.clear(), api.commands.text(0, 0, textFor(), '#ffffff')] }) }
  async function loop() { if (!spinning) return; const step = Math.floor(Math.random() * symbols.length); reels[0] = (reels[0] + step) % 8; reels[1] = (reels[1] + step + 1) % 8; reels[2] = (reels[2] + step + 2) % 8; await draw(); timer = setTimeout(loop, api.getConfig().speed || 100) }

  const desc = {
    title: m.name, hint: m.description,
    display: { type: 'text', id: 'reels', initial: '🍒 BAR 7' },
    controls: [
      { id: 'spin', label: { zh: '旋转', en: 'Spin' }, style: 'primary', key: 'right',
        action: async () => { spinning = true; await api.claim(); api.enableButtons(); api.status(api.t({ zh: '旋转中...', en: 'Spinning...' }), false); loop() } },
      { id: 'stop', label: { zh: '停止', en: 'Stop' }, style: 'tonal', key: 'left',
        action: () => { spinning = false; if (timer) clearTimeout(timer); draw(); api.status(api.t({ zh: '已停止', en: 'Stopped' }), false) } }
    ],
    config: [
      { id: 'speed', label: { zh: '速度(ms)', en: 'Speed (ms)' }, type: 'number', value: 100 }
    ]
  };

  api.renderDialog(desc);
  api.onClose = async () => { spinning = false; if (timer) clearTimeout(timer) };
}
