export async function main(api, m) {
  const colors = ['#00ff00', '#ff0000', '#ffff00', '#0066ff'];
  let seq = [], input = [], accepting = false;

  function addStep() { seq.push(Math.floor(Math.random() * 4)); input = [] }
  async function showSequence() {
    accepting = false; const ft = api.getConfig().flashTime || 600;
    for (let i = 0; i < seq.length; i++) {
      await api.frame({ clear: true, commands: [api.commands.clear(), api.commands.fill(0, 0, 32, 8, colors[seq[i]]), api.commands.text(4, 2, String(i + 1), '#ffffff')] });
      await new Promise(r => setTimeout(r, ft));
      await api.frame({ clear: true, commands: [api.commands.clear()] });
      if (i < seq.length - 1) await new Promise(r => setTimeout(r, 200))
    }
    accepting = true; input = [];
    api.updateDisplay('status', api.t({ zh: '轮到你了', en: 'Your turn' }))
  }
  function pressColor(idx) {
    if (!accepting || input.length >= seq.length) return;
    input.push(idx);
    if (seq[input.length - 1] !== idx) { accepting = false; api.updateDisplay('status', api.t({ zh: '错误。分数 ', en: 'Wrong. Score ' }) + (seq.length - 1)); input = [] }
    else if (input.length === seq.length) { addStep(); api.updateDisplay('status', 'Level ' + seq.length); showSequence() }
  }
  async function flash(idx) {
    await api.frame({ clear: true, commands: [api.commands.clear(), api.commands.fill(0, 0, 32, 8, colors[idx]), api.commands.text(10, 2, String(idx), '#ffffff')] });
    setTimeout(() => api.frame({ clear: true, commands: [api.commands.clear()] }), 200)
  }

  const desc = {
    title: m.name, hint: m.description,
    display: { type: 'text', id: 'status', initial: '' },
    controls: [
      { id: 'start', label: { zh: '开始', en: 'Start' }, style: 'primary', key: 'right',
        action: async () => { seq = []; addStep(); await api.claim(); api.enableButtons(); showSequence() } },
      { id: 'c0',    label: { zh: '绿',  en: 'Green'  }, style: 'tonal', action: () => { pressColor(0); flash(0) } },
      { id: 'c1',    label: { zh: '红',  en: 'Red'    }, style: 'tonal', action: () => { pressColor(1); flash(1) } },
      { id: 'c2',    label: { zh: '黄',  en: 'Yellow' }, style: 'tonal', action: () => { pressColor(2); flash(2) } },
      { id: 'c3',    label: { zh: '蓝',  en: 'Blue'   }, style: 'tonal', action: () => { pressColor(3); flash(3) } }
    ],
    config: [
      { id: 'flashTime', label: { zh: '闪烁时长(ms)', en: 'Flash time (ms)' }, type: 'number', value: 600 }
    ]
  };

  api.renderDialog(desc);
  api.onClose = async () => { accepting = false };
}
