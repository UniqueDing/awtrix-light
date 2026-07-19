export async function main(api, m) {
  let snake = [[5,4],[4,4],[3,4]], dir = [1,0], food = [20,4], running = false, timer = null;
  function placeFood() { food = [Math.floor(Math.random()*32), Math.floor(Math.random()*8)] }
  async function draw() {
    const cmds = [api.commands.clear(), api.commands.pixel(food[0], food[1], '#ff4444')];
    snake.forEach((p, i) => cmds.push(api.commands.pixel(p[0], p[1], i ? '#00ff66' : '#ffffff')));
    await api.frame({ clear: true, commands: cmds })
  }
  function tick() {
    const head = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
    if (head[0] < 0 || head[0] >= 32 || head[1] < 0 || head[1] >= 8 || snake.some(p => p[0] === head[0] && p[1] === head[1])) {
      running = false; if (timer) clearTimeout(timer);
      api.status(api.t({ zh: '游戏结束 ', en: 'Game over ' }) + (snake.length - 3), true); return
    }
    snake.unshift(head);
    if (head[0] === food[0] && head[1] === food[1]) { placeFood();   api.updateDisplay('score', String(snake.length - 3)) }
    else snake.pop()
  }
  async function loop() { if (!running) return; tick(); if (!running) return; await draw(); timer = setTimeout(loop, api.getConfig().speed || 150) }

  const desc = {
    title: m.name, hint: m.description,
    display: { type: 'text', id: 'score', initial: '0' },
    controls: [
      { id: 'start', label: { zh: '开始', en: 'Start' }, style: 'primary', key: 'right',
        action: async () => { snake = [[5,4],[4,4],[3,4]]; dir = [1,0]; running = true; placeFood(); api.updateDisplay('score', '0'); await api.claim(); api.enableButtons(); await draw(); loop() } },
      { id: 'up',    label: { zh: '上',   en: 'Up'    }, style: 'tonal',
        action: () => { if (dir[1] !== 1) { dir = [0, -1]; if (running) { tick(); draw() } } } },
      { id: 'down',  label: { zh: '下',   en: 'Down'  }, style: 'tonal',
        action: () => { if (dir[1] !== -1) { dir = [0, 1]; if (running) { tick(); draw() } } } },
      { id: 'left',  label: { zh: '左',   en: 'Left'  }, style: 'tonal', key: 'left',
        action: () => { if (dir[0] !== 1) { dir = [-1, 0]; if (running) { tick(); draw() } } } },
      { id: 'right', label: { zh: '右',   en: 'Right' }, style: 'tonal', key: 'right',
        action: () => { if (dir[0] !== -1) { dir = [1, 0]; if (running) { tick(); draw() } } } }
    ],
    config: [
      { id: 'speed', label: { zh: '速度(ms)', en: 'Speed (ms)' }, type: 'number', value: 150 }
    ]
  };

  api.renderDialog(desc);
  api.onClose = async () => { running = false; if (timer) clearTimeout(timer) };
}
