#!/bin/bash

# 从 metadata.json 中动态读取 UUID
UUID=$(grep -oP '"uuid":\s*"\K[^"]+' metadata.json)

if [ -z "$UUID" ]; then
    echo "错误：无法从 metadata.json 中读取 UUID。"
    exit 1
fi

EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
SCHEMA_DIR="$EXTENSION_DIR/schemas"

# 清理旧的安装（可选，但推荐）
if [ -d "$EXTENSION_DIR" ]; then
    echo "检测到旧版本，正在清理..."
    rm -rf "$EXTENSION_DIR"
fi

echo "正在安装扩展到: $EXTENSION_DIR"

# 创建目录结构
mkdir -p "$SCHEMA_DIR"

# 复制文件
echo "正在复制文件..."
cp extension.js "$EXTENSION_DIR/"
cp prefs.js "$EXTENSION_DIR/"
cp metadata.json "$EXTENSION_DIR/"
cp schemas/org.gnome.shell.extensions.linetrans.gschema.xml "$SCHEMA_DIR/"

# 编译 GSchema
echo "正在编译 GSettings schema..."
glib-compile-schemas "$SCHEMA_DIR"

echo ""
echo "✅ Linetrans 扩展安装/更新成功！"
echo ""
echo "重要提示：要使更改生效，请注销您的会话，然后重新登录。"
echo "（在 Wayland 下，'Alt+F2' + 'r' 不起作用）"