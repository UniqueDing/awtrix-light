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
- `tools/` - shell 构建辅助脚本
