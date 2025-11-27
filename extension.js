import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {ModalDialog} from 'resource:///org/gnome/shell/ui/modalDialog.js';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import Soup from 'gi://Soup';
import Pango from 'gi://Pango';

const BING_URL = "https://cn.bing.com";
const BING_TRANSLATOR_URL = "https://cn.bing.com/translator";
const BING_API_URL = "https://cn.bing.com/ttranslatev3";
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 优化常量
const MAX_CACHE_SIZE = 100;
const POLL_INTERVAL_MS = 1000;       // Wayland下轮询间隔建议稍长，避免频繁读取空剪贴板
const DEBOUNCE_DELAY_MS = 900;       // 增加防抖时间，等待用户完成选择动作
const REQUEST_TIMEOUT_SECS = 30;     // 请求超时时间
const BING_TOKEN_CACHE_MS = 10 * 60 * 1000; // Bing Token 缓存10分钟

// 翻译缓存 (实例级别，在 disable 时清理)
let TRANSLATION_CACHE = new Map();

// Bing Token 缓存
let _bingTokenCache = null;
let _bingTokenTimestamp = 0;

// 简单的最近一次翻译对话框
const LastTranslationDialog = GObject.registerClass(
class LastTranslationDialog extends ModalDialog {
    _init(indicator) {
        super._init({
            styleClass: 'linetrans-last-dialog',
            destroyOnClose: false,  // 不自动销毁，我们手动管理生命周期
        });
        this._indicator = indicator;

        this._titleLabel = new St.Label({
            text: _('最近一次翻译'),
            style: 'font-weight: bold; font-size: 16px; margin-bottom: 8px;'
        });
        this._originalLabel = new St.Label({
            text: _('原文:'),
            style: 'font-weight: bold; margin-top: 4px;'
        });
        this._originalText = new St.Label({
            text: '',
            style: 'color: #ddd;',
            x_expand: true,
        });
        this._originalText.clutter_text.set_line_wrap(true);
        this._originalText.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        
        this._translationLabel = new St.Label({
            text: _('译文:'),
            style: 'font-weight: bold; margin-top: 10px;'
        });
        this._translationText = new St.Label({
            text: '',
            style: 'color: #a3e635;',
            x_expand: true,
        });
        this._translationText.clutter_text.set_line_wrap(true);
        this._translationText.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);

        const box = new St.BoxLayout({
            vertical: true,
            style: 'padding: 18px; min-width: 400px;'
        });
        box.add_child(this._titleLabel);
        box.add_child(this._originalLabel);
        box.add_child(this._originalText);
        box.add_child(this._translationLabel);
        box.add_child(this._translationText);
        this.contentLayout.add_child(box);

        this.setButtons([
            {
                label: _('复制译文'),
                action: () => {
                    const txt = this._indicator._lastTranslation || '';
                    if (txt) {
                        St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, txt);
                        Main.notify(_('已复制译文'), txt.substring(0, 120));
                    }
                    this._safeClose();
                },
                key: Clutter.KEY_c,
            },
            {
                label: _('关闭'),
                action: () => this._safeClose(),
                default: true,
            },
        ]);
        
        // 监听 ESC 键和点击外部区域关闭
        this.connect('closed', () => {
            // 确保焦点正确释放
            global.stage.set_key_focus(null);
        });
    }

    _safeClose() {
        try {
            this.close();
        } catch (e) {
            console.warn(`[Linetrans] Dialog close error: ${e.message}`);
        }
        // 强制释放键盘焦点
        global.stage.set_key_focus(null);
    }

    updateContent(original, translation) {
        if (!original && !translation) {
            this._originalText.set_text(_('暂无历史翻译'));
            this._translationText.set_text('');
            return;
        }
        this._originalText.set_text(original || '');
        this._translationText.set_text(translation || '');
    }
});

const LinetransIndicator = GObject.registerClass(
class LinetransIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'Linetrans');
        this.extension = extension;
        this._settings = this.extension.getSettings();
        this._uuid = extension.uuid;

        // 状态管理
        this._lastDetectedText = null; // 用于防抖：上一次检测到的文本
        this._lastTranslatedText = null; // 用于去重：上一次成功翻译的文本
        
        this._enabled = this._settings.get_boolean('translation-enabled');
        this._lastOriginal = null;
        this._lastTranslation = null;
        this._isProcessing = false;
        this._currentRequest = null;
        this._useClipboardFallback = this._settings.get_boolean('use-clipboard-fallback');
        this._pollId = 0;
        this._debounceTimeoutId = 0;
        
        this._buttonText = new St.Label({
            text: '🌐',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._buttonText);
        
        // 存储 settings 信号连接 ID 以便清理（必须在使用前初始化）
        this._settingsConnections = [];
        
        // 菜单项
        const translateNowItem = new PopupMenu.PopupMenuItem(_('立即翻译所选文本'));
        translateNowItem.connect('activate', () => this._readAndTranslateNow());
        this.menu.addMenuItem(translateNowItem);

        const historyItem = new PopupMenu.PopupMenuItem(_('查看最近翻译'));
        historyItem.connect('activate', () => this._openLastTranslationDialog());
        this.menu.addMenuItem(historyItem);

        // Service Selection Submenu
        const serviceMenu = new PopupMenu.PopupSubMenuMenuItem(_('翻译服务'));
        this.menu.addMenuItem(serviceMenu);

        this._serviceManager = new PopupMenu.PopupMenuSection();
        serviceMenu.menu.addMenuItem(this._serviceManager);

        const services = [
            { id: 'bing', label: 'Bing' },
            { id: 'google', label: 'Google' },
            { id: 'ai', label: 'AI' }
        ];

        this._serviceItems = new Map();
        
        for (const s of services) {
            const item = new PopupMenu.PopupMenuItem(s.label);
            item.connect('activate', () => {
                this._settings.set_string('api-service', s.id);
            });
            this._serviceManager.addMenuItem(item);
            this._serviceItems.set(s.id, item);
        }

        this._settingsConnections.push(
            this._settings.connect('changed::api-service', () => this._updateServiceMenu())
        );
        this._updateServiceMenu();

        // 诊断剪贴板内容
        // const diagnoseItem = new PopupMenu.PopupMenuItem(_('诊断剪贴板内容 (调试)'));
        // diagnoseItem.connect('activate', () => this._diagnoseClipboard());
        // this.menu.addMenuItem(diagnoseItem);
        
        // 暂停/开启功能
        this._toggleItem = new PopupMenu.PopupMenuItem('');
        this._toggleItem.connect('activate', () => this._toggleEnabled());
        this.menu.addMenuItem(this._toggleItem);
        
        this._updateIndicatorStyle();
        
        this._clipboard = St.Clipboard.get_default();
        // Gnome 45+ 推荐 TextEncoder
        this._encoder = new TextEncoder();
        
        // 复用 HTTP Session 以提高性能
        this._httpSession = new Soup.Session();
        this._httpSession.timeout = REQUEST_TIMEOUT_SECS;
        
        if (this._enabled) {
            // Wayland 下主要依赖轮询
            this._startPolling();
        }
    }

    _readAndTranslateNow() {
        // 强制重置状态，允许再次翻译相同文本
        this._lastTranslatedText = null;

        this._clipboard.get_text(St.ClipboardType.PRIMARY, (clip, textPrimary) => {
            const current = this._normalizeText(textPrimary);
            if (current) {
                this._translateText(current);
                return;
            }
            if (this._useClipboardFallback) {
                this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (clip2, textClipboard) => {
                    const alt = this._normalizeText(textClipboard);
                    if (alt) {
                        this._translateText(alt);
                    } else {
                        Main.notify(_('Linetrans'), _('未检测到选中的文本'));
                    }
                });
            } else {
                Main.notify(_('Linetrans'), _('未检测到选中的文本'));
            }
        });
    }
    
    _normalizeText(text) {
        if (!text) return '';
        // 限制长度，移除首尾空白，将所有换行和多余空格替换为单个空格
        return String(text)
            .substring(0, 1000)
            .trim()
            .replace(/[\r\n\s]+/g, ' ');
    }
    
    _request(method, url, headers = {}, body = null) {
        const message = Soup.Message.new(method, url);
        
        message.request_headers.append('User-Agent', USER_AGENT);
        for (const [key, value] of Object.entries(headers)) {
            message.request_headers.append(key, value);
        }

        if (body) {
            const bodyBytes = this._encoder.encode(body);
            let contentType = 'application/x-www-form-urlencoded';
            if (headers['Content-Type']) {
                contentType = headers['Content-Type'];
            }
            message.set_request_body_from_bytes(contentType, new GLib.Bytes(bodyBytes));
        }

        const session = this._httpSession;
        return new Promise((resolve, reject) => {
            session.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                (sess, res) => {
                    try {
                        const bytes = session.send_and_read_finish(res);
                        const status = message.get_status ? message.get_status() : message.status_code;
                        const decoder = new TextDecoder('utf-8');
                        const text = decoder.decode(bytes.get_data());
                        
                        if (status >= 200 && status < 300) {
                            resolve(text);
                        } else {
                            reject(new Error(`HTTP ${status}: ${text}`));
                        }
                    } catch (err) {
                        reject(err);
                    }
                }
            );
        });
    }

    async _getBingToken() {
        // 检查缓存是否有效
        const now = Date.now();
        if (_bingTokenCache && (now - _bingTokenTimestamp) < BING_TOKEN_CACHE_MS) {
            return _bingTokenCache;
        }
        
        const html = await this._request('GET', BING_TRANSLATOR_URL);
        
        let igMatch = html.match(/IG:"([A-Z0-9]+)"/);
        if (!igMatch) igMatch = html.match(/IG\s*:\s*"([^"]+)"/);
        const ig = igMatch ? igMatch[1] : null;
        
        const iidMatch = html.match(/data-iid="([^"]+)"/);
        const iid = iidMatch ? iidMatch[1] : "translator.5023";
        
        const paramsMatch = html.match(/params_AbusePreventionHelper\s*=\s*\[([^\]]+)\]/);
        if (!paramsMatch) throw new Error("无法找到 Token (params_AbusePreventionHelper)");
        
        const paramsStr = `[${paramsMatch[1]}]`;
        const params = JSON.parse(paramsStr);
        
        // 缓存 token
        _bingTokenCache = { ig, iid, key: params[0], token: params[1] };
        _bingTokenTimestamp = now;
        
        return _bingTokenCache;
    }

    _updateServiceMenu() {
        const current = this._settings.get_string('api-service');
        for (const [id, item] of this._serviceItems) {
            item.setOrnament(id === current ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE);
        }
    }

    async _translateWithGoogle(text) {
        const url = "https://translate.googleapis.com/translate_a/single";
        let fromLang = this._settings.get_string('source-language');
        if (!fromLang || fromLang === 'auto') fromLang = 'auto';
        
        let toLang = this._settings.get_string('target-language');
        if (!toLang) toLang = 'zh-CN';

        const params = {
            client: 'gtx',
            sl: fromLang,
            tl: toLang,
            dt: 't',
            q: text
        };
        
        const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        const fullUrl = `${url}?${query}`;
        
        const responseStr = await this._request('GET', fullUrl);
        const result = JSON.parse(responseStr);
        
        if (result && result[0]) {
            return result[0].map(item => item[0]).join('');
        }
        throw new Error('Google Translate API response invalid');
    }

    async _translateWithAI(text) {
        const url = this._settings.get_string('ai-api-url');
        const key = this._settings.get_string('ai-api-key');
        const model = this._settings.get_string('ai-model');
        
        const payload = {
            model: model,
            messages: [
                {
                    role: "system",
                    content: "你是一位精通大模型训练与深度学习领域的专业翻译专家。请将提供的文本进行翻译：如果是英文则翻译成中文。翻译时请特别注意大模型训练与深度学习领域的专业术语准确性，保持学术和专业风格。对于 'token'、'rank' 等容易混淆或业界通用的专业术语，请直接保留英文原文。"
                },
                {
                    role: "user",
                    content: text
                }
            ],
            stream: false
        };
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        };
        
        const responseStr = await this._request('POST', url, headers, JSON.stringify(payload));
        const result = JSON.parse(responseStr);
        
        if (result.choices && result.choices.length > 0 && result.choices[0].message) {
            return result.choices[0].message.content;
        }
        throw new Error('AI API response invalid: ' + responseStr);
    }

    async _translateWithBing(text) {
        const { ig, iid, key, token } = await this._getBingToken();
        
        let fromLang = this._settings.get_string('source-language');
        if (!fromLang || fromLang === 'auto') fromLang = 'auto-detect';
        
        let toLang = this._settings.get_string('target-language');
        if (!toLang) toLang = 'zh-Hans';

        const queryParams = `isVertical=1&IG=${ig}&IID=${iid}`;
        const url = `${BING_API_URL}?${queryParams}`;
        
        const bodyData = {
            'fromLang': fromLang,
            'text': text,
            'to': toLang,
            'token': token,
            'key': key
        };
        
        const bodyStr = Object.entries(bodyData)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');
        
        const responseStr = await this._request('POST', url, {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': BING_TRANSLATOR_URL,
            'Origin': BING_URL
        }, bodyStr);

        const result = JSON.parse(responseStr);
        if (result && result.length > 0 && result[0].translations) {
            return result[0].translations[0].text;
        }
        throw new Error('Bing API response invalid: ' + responseStr);
    }

    async _translateText(text) {
        if (this._isProcessing) return;
        if (text === this._lastTranslatedText) return;

        // 如果包含中文，则不进行翻译
        if (/[\u4e00-\u9fa5]/.test(text)) return;

        const service = this._settings.get_string('api-service');
        // 缓存 key 需要包含翻译服务，不同服务的翻译结果可能不同
        const cacheKey = `${service}:${text}`;

        if (TRANSLATION_CACHE.has(cacheKey)) {
            const cached = TRANSLATION_CACHE.get(cacheKey);
            this._showTranslation(text, cached, 0);
            return;
        }
        
        this._isProcessing = true;
        const startTime = Date.now();
        this._buttonText.set_text('⏳');

        try {
            let translation = null;

            if (service === 'google') {
                translation = await this._translateWithGoogle(text);
            } else if (service === 'ai') {
                translation = await this._translateWithAI(text);
            } else {
                translation = await this._translateWithBing(text);
            }

            if (translation) {
                TRANSLATION_CACHE.set(cacheKey, translation);
                if (TRANSLATION_CACHE.size > MAX_CACHE_SIZE) {
                    TRANSLATION_CACHE.delete(TRANSLATION_CACHE.keys().next().value);
                }
                const duration = (Date.now() - startTime) / 1000;
                this._showTranslation(text, translation, duration);
            }
        } catch (e) {
            console.error(`[Linetrans] Request Exception: ${e.toString()}`);
            this._showError(e.message);
        } finally {
            this._isProcessing = false;
            this._updateIndicatorStyle();
        }
    }
    
    _showTranslation(original, translation, duration = null) {
        try {
            let title = String(original);
            if (duration !== null) {
                // title = `翻译服务： 译文耗时：${duration.toFixed(2)} S`;
                const svcId = this._settings.get_string('api-service') || 'bing';
                const svcLabel = svcId === 'bing' ? 'Bing' : svcId === 'google' ? 'Google' : svcId === 'ai' ? 'AI' : svcId;
                title = `${svcLabel} · 译文耗时 ${duration.toFixed(2)} S`;
            }
            const body = String(translation);
            Main.notify(title, body);
            
            this._lastOriginal = original;
            this._lastTranslation = body;
            // 成功显示后，更新去重标记
            this._lastTranslatedText = original;
        } catch (e) {
            console.error(`[Linetrans] Notify Error: ${e.message}`);
        }
    }

    _openLastTranslationDialog() {
        // 每次都创建新的对话框实例，避免 disposed 对象被重用的问题
        const dialog = new LastTranslationDialog(this);
        dialog.updateContent(this._lastOriginal, this._lastTranslation);
        dialog.open();
    }

    _updateIndicatorStyle() {
        const color = this._enabled ? '#22c55e' : '#8b8b8b';
        this._buttonText.set_style(`color: ${color}; font-weight: bold;`);
        this._buttonText.set_text(this._enabled ? '🌐' : '⏸️');
        if (this._toggleItem) {
            this._toggleItem.label.set_text(this._enabled ? _('暂停划词翻译') : _('开启划词翻译'));
        }
    }

    _toggleEnabled() {
        this._enabled = !this._enabled;
        this._settings.set_boolean('translation-enabled', this._enabled);
        this._updateIndicatorStyle();
        
        if (this._enabled) {
            this._startPolling();
        } else {
            this._stopPolling();
            this._lastDetectedText = null;
        }
    }

    _startPolling() {
        if (this._pollId) return;
        
        this._pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, POLL_INTERVAL_MS, () => {
            this._pollSelection();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopPolling() {
        if (this._pollId) {
            GLib.source_remove(this._pollId);
            this._pollId = 0;
        }
    }

    _pollSelection() {
        if (!this._enabled || this._isProcessing) return;

        // 仅轮询 PRIMARY (鼠标中键/划词)
        this._clipboard.get_text(St.ClipboardType.PRIMARY, (clip, text) => {
            const current = this._normalizeText(text);
            
            // 如果内容为空或与上次检测到的一样，直接跳过
            if (!current || current === this._lastDetectedText) return;
            
            // 更新检测到的文本，并触发防抖
            this._lastDetectedText = current;
            this._scheduleDebouncedTranslate(current);
        });
    }

    _scheduleDebouncedTranslate(text) {
        if (this._debounceTimeoutId) {
            GLib.source_remove(this._debounceTimeoutId);
        }

        this._debounceTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DEBOUNCE_DELAY_MS, () => {
            this._translateText(text);
            this._debounceTimeoutId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _diagnoseClipboard() {
        this._clipboard.get_text(St.ClipboardType.PRIMARY, (clip, textPrimary) => {
            const primary = this._normalizeText(textPrimary);
            this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (clip2, textClipboard) => {
                const clipboard = this._normalizeText(textClipboard);
                const msg = `PRIMARY: "${primary || '(空)'}"\nCLIPBOARD: "${clipboard || '(空)'}"`;
                Main.notify(_('剪贴板诊断'), msg);
            });
        });
    }

    _showError(message) {
        Main.notify(_('翻译错误'), String(message));
        // 出错时允许重试
        this._lastDetectedText = null;
        this._lastTranslatedText = null;
        this._isProcessing = false;
    }

    destroy() {
        this._stopPolling();
        
        if (this._debounceTimeoutId) {
            GLib.source_remove(this._debounceTimeoutId);
            this._debounceTimeoutId = 0;
        }
        
        // 断开 settings 信号连接
        if (this._settingsConnections) {
            for (const id of this._settingsConnections) {
                this._settings.disconnect(id);
            }
            this._settingsConnections = [];
        }
        
        // 清理 HTTP Session
        if (this._httpSession) {
            this._httpSession.abort();
            this._httpSession = null;
        }
        
        if (this._currentRequest) {
            try { this._currentRequest.force_keep_alive = false; } catch(e) {}
            this._currentRequest = null;
        }
        
        super.destroy();
    }
});

export default class LinetransExtension extends Extension {
    enable() {
        this._indicator = new LinetransIndicator(this);
        Main.panel.addToStatusArea('linetrans-indicator', this._indicator);
        
        this._settings = this.getSettings();
        
        // 先尝试移除旧的快捷键绑定，避免重复添加
        try {
            Main.wm.removeKeybinding('toggle-shortcut');
        } catch (e) { /* 忽略 */ }
        try {
            Main.wm.removeKeybinding('translate-shortcut');
        } catch (e) { /* 忽略 */ }
        
        // 添加快捷键绑定
        try {
            Main.wm.addKeybinding(
                'toggle-shortcut',
                this._settings,
                Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.ALL,
                () => {
                    if (this._indicator) {
                        this._indicator._toggleEnabled();
                    }
                }
            );
        } catch (e) {
            console.warn(`[Linetrans] toggle-shortcut binding failed: ${e.message}`);
        }
        
        try {
            Main.wm.addKeybinding(
                'translate-shortcut',
                this._settings,
                Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.ALL,
                () => {
                    if (this._indicator) {
                        this._indicator._readAndTranslateNow();
                    }
                }
            );
        } catch (e) {
            console.warn(`[Linetrans] translate-shortcut binding failed: ${e.message}`);
        }
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        try {
            Main.wm.removeKeybinding('toggle-shortcut');
            Main.wm.removeKeybinding('translate-shortcut');
            this._settings = null;
        } catch (e) {}
        
        // 清理全局缓存
        TRANSLATION_CACHE.clear();
        _bingTokenCache = null;
        _bingTokenTimestamp = 0;
    }
}