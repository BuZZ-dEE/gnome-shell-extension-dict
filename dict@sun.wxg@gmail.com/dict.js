#!/usr/bin/gjs

const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const System = imports.system;
const GLib = imports.gi.GLib;
const Webkit = imports.gi.WebKit2;

imports.searchPath.push(GLib.path_get_dirname(System.programInvocationName));
const Util = imports.util;

const WEB_SITE = 'https://www.bing.com/dict/search?q=%WORD&mkt=zh-cn';

const DBusIface = '<node> \
<interface name="org.freedesktop.DBus"> \
<method name="GetNameOwner"> \
    <arg type="s" direction="in"/> \
    <arg type="s" direction="out"/> \
</method> \
</interface> \
</node>';
const DBusProxy = Gio.DBusProxy.makeProxyWrapper(DBusIface);

const DictIface = '<node> \
<interface name="org.gnome.Dict"> \
<method name="translateWords"> \
    <arg type="s" direction="in"/> \
    <arg type="i" direction="in"/> \
    <arg type="i" direction="in"/> \
</method> \
<method name="linkUpdate"> \
    <arg type="s" direction="in"/> \
    <arg type="b" direction="in"/> \
    <arg type="b" direction="in"/> \
</method> \
<method name="windowSize"> \
    <arg type="i" direction="in"/> \
    <arg type="i" direction="in"/> \
</method> \
<method name="closeDict"/> \
<method name="hideDict"/> \
<signal name="windowSizeChanged"> \
    <arg type="u"/> \
    <arg type="u"/> \
</signal> \
</interface> \
</node>';

const DICT_SCHEMA = 'org.gnome.shell.extensions.dict';
const HOTKEY = 'hotkey';
const TRIGGER_STATE = 'trigger-state';
const WINDOW_WIDTH = 'window-width';
const WINDOW_HEIGHT = 'window-height';
const ADDRESS_ACTIVE = 'address-active';
const ENABLE_JAVASCRIPT = 'enable-javascript';
const LOAD_IMAGE = 'load-image';
const TOP_ICON = 'top-icon';
const ENABLE_TRANSLATE_SHELL = 'enable-translate-shell';
const LANGUAGE = 'language';
const ENABLE_WEB = 'enable-web';

class Dict {
    constructor(words) {
        this.url = WEB_SITE;
        this.enableJS = false;
        this.loadImage = false;
        this.active = false;

        if (words != null)
            this.words = words;
        else
            this.words = 'welcome';

        this._gsettings = Util.getSettings(DICT_SCHEMA);

        this.path = GLib.path_get_dirname(System.programInvocationName);

        this.application = new Gtk.Application({application_id: "org.gnome.Dict"});
        this.application.connect('activate', this._onActivate.bind(this));
        this.application.connect('startup', this._onStartup.bind(this));

        this._impl = Gio.DBusExportedObject.wrapJSObject(DictIface, this);
        this._impl.export(Gio.DBus.session, '/org/gnome/Dict');
        Gio.DBus.session.own_name('org.gnome.Dict',
                                  Gio.BusNameOwnerFlags.REPLACE,
                                  null, null);

        this.enableTransShell = this._gsettings.get_boolean(ENABLE_TRANSLATE_SHELL);
        this.enableTransShellId = this._gsettings.connect("changed::" + ENABLE_TRANSLATE_SHELL,
                                                          this._updateNoteBook.bind(this));

        this.language = this._gsettings.get_string(LANGUAGE);
        this.languageId = this._gsettings.connect("changed::" + LANGUAGE,
                                                  () => { this.language = this._gsettings.get_string(LANGUAGE); });

        this.enableWeb = this._gsettings.get_boolean(ENABLE_WEB);
        this.enableWebId = this._gsettings.connect("changed::" + ENABLE_WEB,
                                                   this._updateNoteBook.bind(this));
    }

    _onActivate() {
        //this.window.show_all();
    }

    _onStartup() {
        this._buildUI ();
    }

    _buildUI() {
        this.window = new Gtk.ApplicationWindow({ application: this.application,
                                                   window_position: Gtk.WindowPosition.CENTER,
                                                   title: 'Dict',
                                                   border_width: 1 });

        this.window.set_icon_from_file(this.path + '/icons/flag.png');

        this.focusOutId = this.window.connect('focus-out-event', this._mouseLeave.bind(this));
        //this.window.connect('enter-notify-event', this._mouseMotion.bind(this));
        //this.window.connect('leave-notify-event', this._mouseLeave.bind(this));
        this.window.set_events(Gdk.EventMask.ALL_EVENTS_MASK);
        this.window.connect('configure-event', this.windowSizeChanged.bind(this));

        this.window.set_resizable(true);
        this.window.set_size_request(600, 500);
        this.width = 500;
        this.height = 600;

        let headerBar = new Gtk.HeaderBar({ show_close_button: false,
                                            title: 'Dict', });
        this.window.set_titlebar(headerBar);

        let button = new Gtk.ToggleButton({});
        button.set_relief(Gtk.ReliefStyle.NONE);
        button.connect('toggled', this.pinToggled.bind(this));

        let image = Gtk.Image.new_from_file(this.path + '/icons/push-pin.png');
        button.set_image(image);

        headerBar.pack_end(button);

        this.shell = new Gtk.Label();
        this.shell.set_xalign(0);
        this.shell.set_yalign(0);
        let scroll_window = new Gtk.ScrolledWindow({ expand: true });
        scroll_window.add(this.shell);
        this.shell.scroll_window = scroll_window;

        let manager = new Webkit.WebsiteDataManager({base_cache_directory: '/dev/null',
                                                     base_data_directory: '/dev/null',
                                                     disk_cache_directory: '/dev/null',
                                                     indexeddb_directory: '/dev/null',
                                                     local_storage_directory: '/dev/null',
                                                     offline_application_cache_directory: '/dev/null',
                                                     websql_directory: '/dev/null' });

        let context = Webkit.WebContext.new_with_website_data_manager(manager);
        this.web_view = Webkit.WebView.new_with_context(context);
        let settings = this.web_view.get_settings();
        settings.set_enable_page_cache(false);
        settings.set_enable_offline_web_application_cache(false);
        settings.set_enable_javascript(this.enableJS);
        settings.set_auto_load_images(this.loadImage);
        this.web_view.set_settings(settings);

        /*
        this.web_view.connect('load_changed', (w, event) => {
            if (event != Webkit.LoadEvent.FINISHED)
                return;

            this.web_view.show();
        });
        */

        this.web_view.load_uri(this._getUrl());

        this.notebook = new Gtk.Notebook({});
        this.window.add(this.notebook);

        this._updateNoteBook();
    }

    windowSizeChanged() {
        let [width, height] = this.window.get_size();
        if (this.width != width || this.height != height) {
            this.width = width;
            this.height = height;
            this._impl.emit_signal('windowSizeChanged', GLib.Variant.new('(uu)', [width, height]));
        }
    }

    pinToggled(button) {
        if (button.get_active()) {
            if (this.focusOutId) {
                this.window.disconnect(this.focusOutId);
                this.focusOutId = 0;
            }
        } else {
            if (!this.focusOutId)
                this.focusOutId = this.window.connect('focus-out-event', this._mouseLeave.bind(this));
        }
    }

    _mouseMotion(widget, event) {
    }

    _mouseLeave(widget, event) {
        this.window.hide();
        this.active = false;
    }

    _getUrl(words) {
        let url;
        if (words)
            url = this.url.replace("%WORD", words);
        else
            url = this.url.replace("%WORD", '');

        return url;
    }

    _shellTranslateWord(word) {
        let cmd = "trans -t " + this.language + " --show-languages n --no-ansi " + word;
        try {
            let [result, stdout, stderr, status] = GLib.spawn_command_line_sync(cmd);

            let text = Utf8ArrayToStr(stdout);

            this.shell.set_markup(text);

        } catch (e) {
            this.shell.set_text("Error: " + e.message);
        }
    }

    _updateNoteBook() {
        this.enableTransShell = this._gsettings.get_boolean(ENABLE_TRANSLATE_SHELL);
        this.enableWeb = this._gsettings.get_boolean(ENABLE_WEB);

        this.notebook.remove(this.web_view);
        this.notebook.remove(this.shell.scroll_window);

        let label;
        if (this.enableTransShell) {
            label =new Gtk.Label();
            label.set_text('translate shell');
            this.notebook.append_page(this.shell.scroll_window, label);
            this.notebook.child_set_property(this.shell.scroll_window, 'tab-expand', true);
        }

        if (this.enableWeb) {
            label =new Gtk.Label();
            label.set_text('web');
            this.notebook.append_page(this.web_view, label);
            this.notebook.child_set_property(this.web_view, 'tab-expand', true);
        }

        if (this.notebook.get_n_pages() < 1) {
            this.notebook.add(this.shell.scroll_window);
            this.shell.set_text('');
        }

        if (this.notebook.get_n_pages() < 2)
            this.notebook.set_show_tabs(false);
        else
            this.notebook.set_show_tabs(true);
    }

    translateWords(words, x, y) {
        this.words = words;
        this.x = x;
        this.y = y;

        if (this.enableWeb)
            this.web_view.load_uri(this._getUrl(this.words));

        if (this.enableTransShell)
            this._shellTranslateWord(words);

        this.notebook.prev_page();
        this._setWindowPosition();
        this.window.show_all();
        this.window.activate();
        this.active = true;
    }

    _setWindowPosition() {
        let screen = this.window.get_screen();
        let display = screen.get_display();
        let monitor = display.get_monitor_at_point(this.x, this.y);
        let workarea = monitor.get_workarea();

        let windowX, windowY;
        let [width, height] = this.window.get_size();
        if ((this.x + width) <= (workarea.x + workarea.width)) {
            windowX = this.x;
        } else {
            windowX = this.x - width;
            if (windowX < 0)
                windowX = 0;
        }

        if (((this.y - height / 2) >= workarea.y) && ((this.y + height / 2) <= (workarea.y + workarea.height))) {
            windowY = this.y - height / 2;
        } else if ((this.y - height / 2) < workarea.y) {
            windowY = workarea.y;
        } else {
            windowY = workarea.y + workarea.height - height;
        }

        this.window.move(windowX, Math.floor(windowY));
    }

    linkUpdate(link, enableJS, loadImage) {
        this.url = link;
        this.enableJS = enableJS;
        let settings = this.web_view.get_settings();
        settings.set_enable_javascript(this.enableJS);

        this.loadImage = loadImage;
        settings.set_auto_load_images(this.loadImage);

        this.web_view.set_settings(settings);
    }

    windowSize(width, height) {
        this.window.resize(width, height);
    }

    closeDict() {
        this.application.quit();
    }

    hideDict() {
        if (this.active) {
            this.active = false;
            this.window.hide();
        } else {
            this.translateWords(this.words, this.x, this.y);
        }
    }
};

function Utf8ArrayToStr(array) {
    var out, i, len, c;
    var char2, char3;

    out = "";
    len = array.length;
    i = 0;
    while (i < len) {
        c = array[i++];
        switch (c >> 4)
        {
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                // 0xxxxxxx
                out += String.fromCharCode(c);
                break;
            case 12: case 13:
                // 110x xxxx   10xx xxxx
                char2 = array[i++];
                out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                break;
            case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) |
                        ((char2 & 0x3F) << 6) |
                        ((char3 & 0x3F) << 0));
                break;
        }
    }
    return out;
}

let words = null;

if (ARGV.length > 0) {
    words = ARGV[0];
    for (let i = 1; i < ARGV.length; i++)
        words = words + '%20' + ARGV[i];
}

let dbusProxy = new DBusProxy(Gio.DBus.session,
                              'org.freedesktop.DBus',
                              '/org/freedesktop/DBus');
try {
    dbusProxy.GetNameOwnerSync('org.gnome.Dict');
} catch (e) {
    let app = new Dict(words);
    app.application.run(ARGV);
}
