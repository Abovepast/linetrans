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
            description: _('点击按钮后按下组合键来设置快捷键。'),
        });
        page.add(shortcutGroup);

        // 创建快捷键设置行的辅助函数
        const createShortcutRow = (title, settingsKey) => {
            const row = new Adw.ActionRow({
                title: title,
            });

            const shortcutLabel = new Gtk.ShortcutLabel({
                disabled_text: _('未设置'),
                valign: Gtk.Align.CENTER,
            });

            const editButton = new Gtk.Button({
                icon_name: 'preferences-desktop-keyboard-shortcuts-symbolic',
                valign: Gtk.Align.CENTER,
                tooltip_text: _('点击后按下新的快捷键'),
            });

            const clearButton = new Gtk.Button({
                icon_name: 'edit-clear-symbolic',
                valign: Gtk.Align.CENTER,
                tooltip_text: _('清除快捷键'),
            });

            row.add_suffix(shortcutLabel);
            row.add_suffix(editButton);
            row.add_suffix(clearButton);

            // 更新显示
            const updateLabel = () => {
                const arr = this._settings.get_strv(settingsKey);
                shortcutLabel.accelerator = arr.length > 0 ? arr[0] : null;
            };
            updateLabel();

            this._settings.connect(`changed::${settingsKey}`, updateLabel);

            // 清除按钮
            clearButton.connect('clicked', () => {
                this._settings.set_strv(settingsKey, []);
            });

            // 编辑按钮 - 打开快捷键捕获对话框
            editButton.connect('clicked', () => {
                const dialog = new Gtk.Dialog({
                    title: _('按下快捷键'),
                    transient_for: window,
                    modal: true,
                    default_width: 300,
                    default_height: 150,
                });

                const contentArea = dialog.get_content_area();
                contentArea.spacing = 12;
                contentArea.margin_top = 12;
                contentArea.margin_bottom = 12;
                contentArea.margin_start = 12;
                contentArea.margin_end = 12;

                const label = new Gtk.Label({
                    label: _('请按下您想要设置的快捷键组合...'),
                    wrap: true,
                });
                contentArea.append(label);

                const previewLabel = new Gtk.ShortcutLabel({
                    disabled_text: _('等待输入...'),
                    halign: Gtk.Align.CENTER,
                });
                contentArea.append(previewLabel);

                const cancelButton = dialog.add_button(_('取消'), Gtk.ResponseType.CANCEL);

                // 键盘事件控制器
                const keyController = new Gtk.EventControllerKey();
                dialog.add_controller(keyController);

                keyController.connect('key-pressed', (controller, keyval, keycode, state) => {
                    // 过滤掉单独的修饰键
                    const modifierKeys = [
                        Gtk.accelerator_parse('Shift_L')[1],
                        Gtk.accelerator_parse('Shift_R')[1],
                        Gtk.accelerator_parse('Control_L')[1],
                        Gtk.accelerator_parse('Control_R')[1],
                        Gtk.accelerator_parse('Alt_L')[1],
                        Gtk.accelerator_parse('Alt_R')[1],
                        Gtk.accelerator_parse('Super_L')[1],
                        Gtk.accelerator_parse('Super_R')[1],
                        Gtk.accelerator_parse('Meta_L')[1],
                        Gtk.accelerator_parse('Meta_R')[1],
                    ];

                    if (modifierKeys.includes(keyval)) {
                        return false;
                    }

                    // 获取修饰键状态
                    let mods = state & Gtk.accelerator_get_default_mod_mask();

                    // 生成加速器字符串
                    const accelerator = Gtk.accelerator_name(keyval, mods);

                    if (accelerator) {
                        this._settings.set_strv(settingsKey, [accelerator]);
                        dialog.close();
                    }

                    return true;
                });

                dialog.present();
            });

            return row;
        };

        const shortcutRow = createShortcutRow(_('翻译开关快捷键'), 'toggle-shortcut');
        shortcutGroup.add(shortcutRow);

        const translateShortcutRow = createShortcutRow(_('立即翻译快捷键'), 'translate-shortcut');
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
    }
}