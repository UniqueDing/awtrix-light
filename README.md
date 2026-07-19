# awtrix-light

AWTRIX3 定制 Web UI 补丁。

## 使用

```bash
./build.sh
```

项目结构：
- `patches/` - 只放修改 AWTRIX3 原文件的补丁
- `src/` - awtrix-light 自有 C++ 源码，编译时复制到 `awtrix3/src/`
- `www/` - awtrix-light 自有 Web UI 源码，编译时复制到 `awtrix3/www/`
- `app-store/` - 由本仓库管理的本地应用商店内容，包括 `app-store/list.json` 目录及 `app-store/apps/flow/`、`app-store/apps/live/` 等应用文件
- `tools/` - shell 构建辅助脚本

本地开发应用商店时，可在仓库根目录运行：

```bash
python3 tools/serve_app_store.py
```
