# Linetrans - GNOME 划词翻译扩展

Linetrans 是一个轻量级的 GNOME Shell 扩展，旨在提供便捷的划词翻译功能。它能够自动检测你选中的文本并将其翻译成中文，支持多种翻译服务后端。

## ✨ 主要功能

*   **划词即译**：选中一段文本（Primary Selection），扩展会自动检测并显示翻译结果通知。
*   **多源支持**：内置支持多种翻译服务，可按需切换：
    *   **Bing 翻译**（默认，无需配置）
    *   **Google 翻译**
    *   **AI 翻译**（支持 OpenAI 接口格式，可配置自定义模型、API Key 和 URL）
*   **快捷键控制**：
    *   `<Alt>w`：快速开启/暂停划词翻译功能。
    *   `<Alt>t`：强制翻译当前选中的文本（或剪贴板内容）。
*   **历史记录**：提供“最近一次翻译”对话框，方便查看和复制长文本译文。
*   **状态栏集成**：顶部栏图标显示当前状态（🌐 开启 / ⏸️ 暂停），并提供快捷菜单。
*   **智能防抖**：内置防抖机制，避免在频繁选择文本时产生过多的请求。

## 🛠️ 安装方法

### 自动安装

本项目提供了一个安装脚本，可以自动完成文件的复制和 Schema 的编译。

1.  克隆或下载本项目代码：
    ```bash
    git clone https://github.com/wonaren/linetrans-extension.git
    cd linetrans-extension
    ```

2.  运行安装脚本：
    ```bash
    chmod +x install.sh
    ./install.sh
    ```

3.  **重启 GNOME Shell**：
    *   **X11 用户**：按下 `Alt` + `F2`，输入 `r`，然后回车。
    *   **Wayland 用户**：需要注销并重新登录。

4.  在“扩展 (Extensions)”应用中启用 **Linetrans**。

### 手动安装

如果你想手动安装，请执行以下步骤：

1.  创建扩展目录：
    ```bash
    mkdir -p ~/.local/share/gnome-shell/extensions/linetrans@wonaren/schemas
    ```
2.  复制核心文件 (`extension.js`, `prefs.js`, `metadata.json`) 到上述目录。
3.  复制 `schemas/*.xml` 文件到 `schemas` 子目录。
4.  编译 Schema：
    ```bash
    glib-compile-schemas ~/.local/share/gnome-shell/extensions/linetrans@wonaren/schemas
    ```

## ⚙️ 配置说明

你可以在 GNOME 的“扩展”应用中打开 Linetrans 的设置界面，或直接通过状态栏图标菜单进行部分设置。

### 翻译服务设置
*   **API Service**：选择翻译后端（Bing, Google, AI）。
*   **AI 设置**（当选择 AI 服务时生效）：
    *   **Model**：模型名称（例如 `gpt-3.5-turbo` 或其他兼容模型）。
    *   **API URL**：接口地址。
    *   **API Key**：你的 API 密钥。

### 行为设置
*   **源语言/目标语言**：默认为自动检测 -> 简体中文。
*   **使用剪贴板回退**：如果划词（Primary Selection）为空，是否尝试翻译剪贴板（Clipboard）的内容。

## ⌨️ 快捷键

| 快捷键 | 功能 |
| :--- | :--- |
| `<Alt>w` | 开启 / 暂停 自动划词翻译 |
| `<Alt>t` | 立即翻译当前选中内容 |

> 注意：快捷键可以在设置中自定义。

## 📋 要求

*   GNOME Shell 45+ (已在 49 测试)
*   网络连接（用于访问翻译 API）

## 📝 许可证

[MIT License](LICENSE)
