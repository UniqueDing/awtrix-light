export async function main(api, m) {
  const desc = {
    title: m.name, hint: m.description,
    controls: [
      { id: 'draw',  label: { zh: '绘制', en: 'Draw'  }, style: 'primary',
        action: async () => { const c = api.getConfig(); await api.frame({ clear: false, commands: [api.commands.pixel(Number(c.x) || 0, Number(c.y) || 0, c.color || '#00e5ff')] }) } },
      { id: 'clear', label: { zh: '清空', en: 'Clear' }, style: 'danger',
        action: async () => { await api.frame({ clear: true, commands: [api.commands.clear()] }) } }
    ],
    config: [
      { id: 'x',     label: { zh: 'X (0-31)', en: 'X (0-31)' }, type: 'number', value: 0 },
      { id: 'y',     label: { zh: 'Y (0-7)',  en: 'Y (0-7)'  }, type: 'number', value: 0 },
      { id: 'color', label: { zh: '颜色',      en: 'Color'    }, type: 'text',   value: '#00e5ff' }
    ]
  };

  api.renderDialog(desc);
  await api.claim();
}
