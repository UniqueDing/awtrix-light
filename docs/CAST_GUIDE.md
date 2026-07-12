# Live 创作文档

## 第一步：写清单

在 `list.json` 的 `castApps` 数组中添加一条记录：

```json
{
  "id": "my-cast",
  "type": "live",
  "name": "我的 Live",
  "name_i18n": { "zh": "我的 Live", "en": "My Live" },
  "version": 1,
  "author": "你的名字",
  "description": "简短描述",
  "description_i18n": { "zh": "简短描述", "en": "Short description" },
  "icon": "⏱",
  "entry": "cast/my-cast.js",
  "tags": ["demo", "timer"]
}
```

| 字段                               | 说明                                                                  |
| ---------------------------------- | --------------------------------------------------------------------- |
| `id`                               | 唯一标识，安装后会生成 `/Apps/cast/<id>.json` 和 `/Apps/cast/<id>.js` |
| `type`                             | 固定 `"live"`                                                         |
| `name` / `name_i18n`               | 显示名称                                                              |
| `version`                          | 版本号                                                                |
| `author`                           | 作者                                                                  |
| `description` / `description_i18n` | 描述文字                                                              |
| `icon`                             | emoji 或 LaMetric 数字 ID（如 `"27106"`）                             |
| `entry`                            | JS 模块路径                                                           |
| `tags`                             | 搜索和标签过滤用                                                      |

## 第二步：写 JS 模块

复制 `_template.js`，填好 `desc` 对象和逻辑。模块导出 `manifest` 和 `main(api, manifest)`。

### desc 结构

```js
const desc = {
  title: { zh: "标题", en: "Title" }, // 对话框标题
  hint: { zh: "提示", en: "Hint" }, // 可选，描述提示
  display: { type: "text", id: "v", initial: "0" }, // 可选，展示区
  controls: [
    // 控件按钮
    { id: "start", label: { zh: "开始", en: "Start" }, style: "primary" },
    { id: "stop", label: { zh: "停止", en: "Stop" }, style: "tonal" },
    { id: "reset", label: { zh: "重置", en: "Reset" }, style: "danger" },
  ],
  config: [
    // 可选，设置项
    {
      id: "speed",
      label: { zh: "速度", en: "Speed" },
      type: "number",
      value: 100,
    },
    {
      id: "show",
      label: { zh: "显示", en: "Show" },
      type: "bool",
      value: true,
    },
    {
      id: "color",
      label: { zh: "颜色", en: "Color" },
      type: "text",
      value: "#00e5ff",
    },
  ],
};
```

### style 取值

| 值          | 效果         |
| ----------- | ------------ |
| `'primary'` | 蓝色主按钮   |
| `'tonal'`   | 灰色次按钮   |
| `'danger'`  | 红色危险按钮 |

### config type

| 值         | 输入控件 |
| ---------- | -------- |
| `'text'`   | 文本框   |
| `'number'` | 数字框   |
| `'bool'`   | 开关     |

## JS API

| 方法                             | 说明                                                 |
| -------------------------------- | ---------------------------------------------------- |
| `api.renderDialog(desc)`         | 渲染 UI，返回 root DOM 元素                          |
| `api.getConfig()`                | 读取设置表单当前值，返回 `{key: value}`              |
| `api.updateDisplay(id, val)`     | 更新展示区文字                                       |
| `api.claim()`                    | 占用屏幕                                             |
| `api.frame({ clear, commands })` | 发送一帧到 LED 矩阵                                  |
| `api.release()`                  | 释放屏幕                                             |
| `api.status(msg, err)`           | 更新状态栏，err=true 红色                            |
| `api.t({ zh, en })`              | 多语言取值                                           |
| `api.lang`                       | 当前语言 `'zh'` / `'en'`                             |
| `api.onClose`                    | 关闭回调（设为 async 函数）                          |
| `api.onButton`                   | 硬件按键回调，收到 `'left'` / `'middle'` / `'right'` |
| `api.enableButtons()`            | 开始轮询硬件按键（200ms 间隔，需编译新固件）         |

### 帧命令

坐标范围：x 0-31, y 0-7

| 命令                                       | 格式     |
| ------------------------------------------ | -------- |
| `api.commands.clear()`                     | 清屏     |
| `api.commands.text(x, y, str, color)`      | 画文字   |
| `api.commands.fill(x, y, w, h, color)`     | 填充矩形 |
| `api.commands.pixel(x, y, color)`          | 单像素   |
| `api.commands.line(x0, y0, x1, y1, color)` | 直线     |

### 按钮 ID 规则

- 控件按钮：`#__cast_ctrl_{id}` — 对应 `controls[].id`
- 设置输入框：`#__cast_cfg_{id}` — 对应 `config[].id`
- 展示区：`#__cast_disp_{id}` — 对应 `display.id`

### manifest 可用字段

```
manifest.name           显示名称
manifest.author         作者
manifest.version        版本号
manifest.description    描述
manifest.icon           图标
manifest.tags           标签数组
manifest.id             ID
manifest.entry          模块路径
manifest.name_i18n      { zh, en }
manifest.description_i18n { zh, en }
```

## 第三步：部署

```bash
# 更新远程商店 list.json 和 cast/my-cast.js
# 安装时设备会把模块缓存到 /Apps/cast/my-cast.js，
# 并把 manifest 保存为 /Apps/cast/my-cast.json。
```
