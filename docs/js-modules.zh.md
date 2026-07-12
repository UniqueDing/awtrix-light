# Web UI JavaScript 模块说明

`www/app.js.min` 由 `tools/build_web_assets.sh build` 生成。源文件位于 `www/js/`，按脚本中的顺序拼接后再用 Terser 压缩。下表说明每个源文件的职责、当前是否仍有作用，以及是否建议合并。

## 总体结论

当前 JS 拆分粒度偏细，但大多数文件仍有作用。可以合并的是“纯 schema / 小工具 / 单函数包装”类文件；不建议合并大型业务文件，否则会回到之前单文件过大的状态。

最值得合并的候选：

- `app-store-compat.js` 可以并入 `app-store-core.js`。它现在只保留版本比较和空兼容函数，职责很小。
- `app-common.js`、`icon-state.js` 可以并入 `state-i18n.js` 或一个 `app-utils.js`，但保持独立也问题不大。
- `settings-tabs-labels.js` 可以并入 `settings-tabs-render.js`。
- `legacy-save.js` 可以并入 `device-save.js`，因为都是设置保存链路。
- `app-create-defaults.js`、`app-create-fields.js` 可以考虑并入 `app-create-form.js`，但会让创建表单文件变大。

不建议合并的模块：

- `app-library.js`、`app-settings-dialog.js`、`app-store-render.js`、`app-file-manager.js`、`cast-files-install.js`、`cast-runtime.js`、`cast-tools.js`。这些都是独立业务区域，合并后只会降低可维护性。

## 模块清单

| 文件 | 负责内容 | 是否还有作用 | 合并建议 |
|---|---|---|---|
| `i18n-runtime.js` | 语言、主题、登录启动遮罩、认证初始化。 | 有 | 不合并；它是启动前置逻辑。 |
| `state-i18n.js` | DOM 快捷访问、全局状态、认证 fetch 包装、原生 App key 映射。 | 有 | 可吸收 `app-common.js`/`icon-state.js`，但会变成全局杂项文件。 |
| `cast-bootstrap.js` | 页面路由、App/Live tab、底部导出按钮、通用 sheet 状态。 | 有 | 不合并；它是 SPA 框架层。 |
| `cast-labels.js` | Live/Cast 命名、Live 文案解析、Live UI 标签刷新。 | 有 | 可和 `cast-bootstrap.js` 合并，但保留独立更清晰。 |
| `cast-files-install.js` | Live app manifest 读取、安装、卸载、外部模块加载。 | 有 | 不合并；Live 安装链路独立且较复杂。 |
| `settings-state.js` | 设置页状态、legacy settings 缓存、文件页状态、Live catalog 状态。 | 有 | 不合并；状态集中放这里合理。 |
| `settings-tabs-labels.js` | 设置 tab 的中英文标签映射。 | 有 | 可并入 `settings-tabs-render.js`。 |
| `device-setting-groups.js` | 设备 API 设置项 schema。 | 有 | 不合并；schema 独立方便维护。 |
| `legacy-setting-groups.js` | `DoNotTouch.json` 旧设置项 schema。 | 有 | 不合并；legacy schema 和 device schema 分开更清楚。 |
| `settings-tabs-render.js` | 设置 tab 渲染和切换。 | 有 | 可吸收 `settings-tabs-labels.js`。 |
| `settings-field.js` | 单个设置字段渲染，包括输入框、选择、颜色、开关等。 | 有 | 不合并；字段渲染复用点多。 |
| `settings-render-wifi.js` | 设置卡片渲染、WiFi 配网卡片、集成测试、legacy settings 加载。 | 有 | 可继续拆小，不建议合并。 |
| `settings-load-save.js` | 加载设备设置并触发设置页渲染。 | 有 | 可并入 `settings-render-wifi.js`，但当前单独作为加载入口也合理。 |
| `settings-collect.js` | 从设置表单收集保存 payload。 | 有 | 可并入 `device-save.js`，但独立更便于复用。 |
| `legacy-save.js` | 保存 legacy `DoNotTouch.json` 并触发 reload。 | 有 | 可并入 `device-save.js`。 |
| `device-save.js` | 保存设备设置，串联 API 设置与 legacy 设置。 | 有 | 可吸收 `legacy-save.js`/`settings-collect.js`。 |
| `cast-runtime.js` | Live app runtime API、按钮状态、矩阵命令绘制、交互 demo。 | 有 | 不合并；运行时 API 独立。 |
| `cast-tools.js` | 内置 Live 工具：秒表、倒计时、对应 dialog 和屏幕绘制。 | 有 | 不合并；可未来按工具再拆。 |
| `cast-preview.js` | Live/动画预览 GIF 生成与 preview view 初始化。 | 有 | 不合并；GIF 编码逻辑独立。 |
| `cast-store-tab.js` | Live 应用商店 tab 渲染、搜索、标签筛选、安装按钮。 | 有 | 可并入 `app-store-render.js`，但 Live 与 App Store UI 分开更清楚。 |
| `icon-state.js` | 原生 icon 名称集合、缺失 icon URL 缓存。 | 有 | 可并入 `app-icons.js`。 |
| `app-common.js` | App 名称解析、状态提示、HTML escape 小工具。 | 有 | 可并入 `state-i18n.js` 或 `app-icons.js` 前的通用工具段。 |
| `app-store-core.js` | Store 默认源、URL 解析、manifest normalize、来源栏空实现。 | 有 | 可吸收 `app-store-compat.js`。 |
| `app-display-schema.js` | App 显示设置字段、三态字段、payload 兼容映射。 | 有 | 不合并；设置 dialog 和创建表单都依赖。 |
| `app-icons.js` | 图标 URL 候选、下载/上传图标、图标渲染。 | 有 | 可吸收 `icon-state.js`。 |
| `app-store-compat.js` | 版本号比较、兼容性空实现、已安装版本读取空实现。 | 仍有作用，但很小 | 建议并入 `app-store-core.js`。 |
| `app-create-fields.js` | 创建 App 表单的 select/input HTML 生成。 | 有 | 可并入 `app-create-form.js`。 |
| `app-file-manager.js` | LittleFS 文件列表、预览、保存、上传、新建、删除。 | 有 | 不合并；文件管理是独立页面。 |
| `app-library.js` | 我的应用列表、启停、排序、刷新、渲染。 | 有 | 不合并；业务核心模块。 |
| `app-settings-dialog.js` | App 设置弹窗、字段渲染、导出、保存、同步按钮。 | 有 | 不合并；业务复杂且独立。 |
| `app-uninstall.js` | App 卸载请求和卸载后 UI 刷新。 | 有 | 可并入 `app-library.js`，因为只服务我的应用列表。 |
| `app-store-render.js` | App Store 加载、筛选、渲染、安装 App。 | 有 | 不合并；App Store 核心 UI。 |
| `app-create-defaults.js` | 创建 App 默认值、示例 JSON、导入 normalize。 | 有 | 可并入 `app-create-form.js` 或 `app-create-import.js`。 |
| `app-create-form.js` | 创建/编辑 App 表单渲染、输入项和数据源行管理。 | 有 | 不建议继续合并；已经是创建页主体。 |
| `app-create-import.js` | JSON 导入向导步骤渲染。 | 有 | 可并入 `app-create-form.js`，但保持独立更清楚。 |
| `app-create-save.js` | 创建/编辑 App payload 收集和保存。 | 有 | 不合并；保存逻辑和渲染分开合理。 |
| `boot.js` | 绑定所有 UI 事件，启动认证初始化。 | 有 | 不合并；必须最后加载。 |

## 建议的下一轮合并顺序

如果要继续减少文件数量，建议按低风险顺序做：

1. `app-store-compat.js` -> `app-store-core.js`
2. `icon-state.js` -> `app-icons.js`
3. `settings-tabs-labels.js` -> `settings-tabs-render.js`
4. `legacy-save.js` -> `device-save.js`
5. `app-uninstall.js` -> `app-library.js`

这几项合并后不会明显改变业务边界，也不会让单个核心文件暴涨太多。
