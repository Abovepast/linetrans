// gnome versoion 49
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class LinetransPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('常规'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        const langGroup = new Adw.PreferencesGroup({
            title: _('语言设置'),
        });
        page.add(langGroup);

        const sourceLangRow = new Adw.EntryRow({
            title: _('源语言'),
        });
        sourceLangRow.subtitle = _("例如 'en'");
        langGroup.add(sourceLangRow);

        const targetLangRow = new Adw.EntryRow({
            title: _('目标语言'),
        });
        targetLangRow.subtitle = _("例如 'zh-Hans'");
        langGroup.add(targetLangRow);

        const serviceGroup = new Adw.PreferencesGroup({
            title: _('翻译服务'),
        });
        page.add(serviceGroup);

        const serviceRow = new Adw.ComboRow({
            title: _('API 服务'),
            model: new Gtk.StringList({ strings: ['Bing', 'Google', 'AI'] }),
        });
        serviceGroup.add(serviceRow);

        const aiGroup = new Adw.PreferencesGroup({
            title: _('AI 配置'),
            description: _('仅在选择 AI 服务时生效'),
        });
        page.add(aiGroup);

        const aiModelRow = new Adw.EntryRow({
            title: _('模型名称'),
        });
        aiGroup.add(aiModelRow);

        const aiUrlRow = new Adw.EntryRow({
            title: _('API 地址'),
        });
        aiGroup.add(aiUrlRow);

        const aiKeyRow = new Adw.PasswordEntryRow({
            title: _('API 密钥'),
        });
        aiGroup.add(aiKeyRow);

        const behaviorGroup = new Adw.PreferencesGroup({
            title: _('行为与调试'),
        });
        page.add(behaviorGroup);

        const fallbackRow = new Adw.SwitchRow({
            title: _('使用剪贴板回退'),
            subtitle: _('当 PRIMARY 选择不可用或为空时，尝试从 CLIPBOARD 读取'),
        });
        behaviorGroup.add(fallbackRow);

        const debugRow = new Adw.SwitchRow({
            title: _('启用调试日志'),
            subtitle: _('在系统日志中打印详细调试信息'),
        });
        behaviorGroup.add(debugRow);
        
        const shortcutGroup = new Adw.PreferencesGroup({
            title: _('快捷键'),
            description: _('自定义翻译功能开关的全局快捷键。'),
        });
        page.add(shortcutGroup);

        const shortcutRow = new Adw.EntryRow({
            title: _('翻译开关快捷键'),
        });
        shortcutRow.set_subtitle ? shortcutRow.set_subtitle(_("例如 '&lt;Alt&gt;w'")) : null;
        shortcutGroup.add(shortcutRow);

        const translateShortcutRow = new Adw.EntryRow({
            title: _('立即翻译快捷键'),
        });
        translateShortcutRow.set_subtitle ? translateShortcutRow.set_subtitle(_("例如 '&lt;Alt&gt;t'")) : null;
        shortcutGroup.add(translateShortcutRow);

        this._settings.bind('source-language', sourceLangRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('target-language', targetLangRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        
        // Bind AI settings
        this._settings.bind('ai-model', aiModelRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('ai-api-url', aiUrlRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('ai-api-key', aiKeyRow, 'text', Gio.SettingsBindFlags.DEFAULT);

        // Bind Service ComboRow
        const services = ['bing', 'google', 'ai'];
        const currentService = this._settings.get_string('api-service');
        let serviceIdx = services.indexOf(currentService);
        if (serviceIdx === -1) serviceIdx = 0;
        serviceRow.selected = serviceIdx;

        serviceRow.connect('notify::selected', () => {
            if (serviceRow.selected >= 0 && serviceRow.selected < services.length) {
                this._settings.set_string('api-service', services[serviceRow.selected]);
            }
        });
        
        this._settings.connect('changed::api-service', () => {
             const val = this._settings.get_string('api-service');
             const idx = services.indexOf(val);
             if (idx !== -1 && idx !== serviceRow.selected) {
                 serviceRow.selected = idx;
             }
        });

        this._settings.bind('use-clipboard-fallback', fallbackRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    this._settings.bind('debug-mode', debugRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        // toggle-shortcut 是 as 类型（数组），这里只简单用单个字符串输入进行设置
        this._settings.connect('changed::toggle-shortcut', () => {
            const arr = this._settings.get_strv('toggle-shortcut');
            shortcutRow.text = arr.length > 0 ? arr[0] : '';
        });
        shortcutRow.connect('notify::text', row => {
            const val = row.text.trim();
            this._settings.set_strv('toggle-shortcut', val ? [val] : []);
        });
        // 初始化一次
        const initial = this._settings.get_strv('toggle-shortcut');
        shortcutRow.text = initial.length > 0 ? initial[0] : '';

        // translate-shortcut
        this._settings.connect('changed::translate-shortcut', () => {
            const arr = this._settings.get_strv('translate-shortcut');
            translateShortcutRow.text = arr.length > 0 ? arr[0] : '';
        });
        translateShortcutRow.connect('notify::text', row => {
            const val = row.text.trim();
            this._settings.set_strv('translate-shortcut', val ? [val] : []);
        });
        const initialTranslate = this._settings.get_strv('translate-shortcut');
        translateShortcutRow.text = initialTranslate.length > 0 ? initialTranslate[0] : '';
    }
}