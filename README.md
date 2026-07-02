# awtrix-light

AWTRIX3 定制 Web UI 补丁。

## 使用

```bash
git clone <awtrix3-url>
cd awtrix3
patch -p1 < /path/to/awtrix-light/awtrix3.patch
python3 tools/embed_www_assets.py
pio run -e awtrix2_upgrade -t upload --upload-port /dev/ttyUSB0
```

patch 包含：
- `lib/webserver/` - publicShell 白名单 + authMiddleware 修复
- `src/` - ServerManager、DisplayManager、Globals（+HA 设置、SPA 路由、auth 端点）
- `src/web_assets.h` - 嵌入 SPA
- `src/htmls.h` - 精简（仅 icon 上传控件）
- `src/Games/` - 删除废弃游戏，GameManager 变 stub
- `www/` - 定制 SPA
- `www/src/app/` - JS 源模块
- `tools/` - build_app_js.py、embed_www_assets.py
