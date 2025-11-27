# Linetrans - GNOME Shell 划词翻译扩展

<p align="center">
  <img src="https://img.shields.io/badge/GNOME-49-blue?logo=gnome" alt="GNOME 49">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/Version-251127-orange" alt="Version">
</p>

一个简洁高效的 GNOME Shell 划词翻译扩展，支持选中英文单词或句子后自动弹出翻译结果。

## ✨ 功能特性

- 🖱️ **划词翻译**: 选中文本后自动翻译（支持 Wayland）
- ⌨️ **快捷键支持**: 可自定义快捷键触发翻译
- 🔄 **多翻译引擎**: 支持 Bing、Google、AI API 三种翻译服务
- 💾 **翻译缓存**: 自动缓存翻译结果，减少重复请求
- 📋 **剪贴板回退**: 当 PRIMARY 选择不可用时，自动从剪贴板读取
- 🎯 **智能过滤**: 自动跳过中文文本，仅翻译英文内容
- ⏸️ **一键开关**: 通过面板图标或快捷键快速开启/关闭翻译功能

## 📸 截图

翻译结果通过系统通知显示，简洁不干扰工作流。

## 🔧 安装

### 方法一：使用安装脚本（推荐）

```bash
git clone https://github.com/Abovepast/linetrans.git
cd linetrans
chmod +x install.sh
./install.sh
```

### 方法二：手动安装

1. 克隆仓库：
```bash
git clone https://github.com/Abovepast/linetrans.git
```

2. 将扩展复制到 GNOME Shell 扩展目录：
```bash
mkdir -p ~/.local/share/gnome-shell/extensions/linetrans@Abovepast
cp -r linetrans/* ~/.local/share/gnome-shell/extensions/linetrans@Abovepast/
```

3. 编译 GSettings schema：
```bash
glib-compile-schemas ~/.local/share/gnome-shell/extensions/linetrans@Abovepast/schemas/
```

4. 重新登录或重启 GNOME Shell 使扩展生效

### 启用扩展

使用 GNOME Extensions 应用或命令行启用：
```bash
gnome-extensions enable linetrans@Abovepast
```

## ⚙️ 配置

### 翻译服务

扩展支持三种翻译服务：

| 服务 | 说明 | 配置需求 |
|------|------|----------|
| **Bing** | 微软必应翻译（默认） | 无需配置，开箱即用 |
| **Google** | 谷歌翻译 | 无需配置，开箱即用 |
| **AI** | AI 大模型翻译 | 需要配置 API 地址和密钥 |

### 快捷键

| 快捷键 | 功能 | 默认值 |
|--------|------|--------|
| 翻译开关 | 开启/关闭划词翻译 | `Alt+W` |
| 立即翻译 | 翻译当前选中文本 | `Alt+T` |

### 语言设置

- **源语言**: 默认 `en`（英语），支持 `auto` 自动检测
- **目标语言**: 默认 `zh-Hans`（简体中文）

### AI 配置

使用 AI 翻译服务时，需要配置以下参数：

- **API 地址**: 默认为 SiliconFlow API
- **API 密钥**: 您的 API 密钥
- **模型名称**: 默认为 `tencent/Hunyuan-MT-7B`

## 🚀 使用方法

1. **自动翻译**: 启用扩展后，选中任意英文文本即可自动弹出翻译通知
2. **手动翻译**: 选中文本后按 `Alt+T` 立即翻译
3. **暂停翻译**: 按 `Alt+W` 或点击面板图标暂停/恢复翻译功能
4. **查看历史**: 点击面板图标菜单中的"查看最近翻译"

## 📁 项目结构

```
linetrans/
├── extension.js          # 扩展主逻辑
├── prefs.js              # 设置界面
├── metadata.json         # 扩展元数据
├── install.sh            # 安装脚本
├── schemas/
│   └── org.gnome.shell.extensions.linetrans.gschema.xml  # GSettings schema
└── README.md
```

## 🛠️ 技术细节

- **兼容性**: GNOME Shell 49+
- **会话类型**: 支持 X11 和 Wayland
- **翻译缓存**: 最多缓存 100 条翻译结果
- **防抖延迟**: 900ms（避免频繁触发翻译）
- **请求超时**: 30 秒
- **Token 缓存**: Bing Token 缓存 10 分钟

## 🐛 问题排查

### 扩展未生效
- 确保已注销并重新登录
- 在 Wayland 下，`Alt+F2` + `r` 无效，必须重新登录

### 翻译无响应
- 检查网络连接
- 查看系统日志：`journalctl -f -o cat /usr/bin/gnome-shell`
- 启用调试模式查看详细日志

### Wayland 下剪贴板问题
- 确保"使用剪贴板回退"选项已启用
- 尝试使用 `Alt+T` 快捷键手动触发翻译

## 📄 许可证

本项目采用 MIT 许可证。

## 👤 作者

**Abovepast**

- GitHub: [@Abovepast](https://github.com/Abovepast)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 🙏 致谢

- [GNOME Shell Extensions](https://extensions.gnome.org/)
- [Bing Translator](https://www.bing.com/translator)
- [Google Translate](https://translate.google.com/)
