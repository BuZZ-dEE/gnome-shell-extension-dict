const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const LANGUAGES_LIST = Me.imports.language.LANGUAGES_LIST;

const SCHEMA_NAME = 'org.gnome.shell.extensions.dict';
const ADDRESS_LIST = 'address-list';
const ADDRESS_ACTIVE = 'address-active';
const MOBILE_AGENT = 'mobile-agent';
const ENABLE_JAVASCRIPT = 'enable-javascript';
const LOAD_IMAGE = 'load-image';
const TOP_ICON = 'top-icon';
const ENABLE_TRANSLATE_SHELL = 'enable-translate-shell';
const LANGUAGE = 'language';
const ENABLE_WEB = 'enable-web';
const WINDOW_FOLLOW_POINTER = 'window-follow-pointer';

const ADDRESS = [ "https://www.bing.com/dict/search=?q=%WORD&mkt=zh-cn" ]
let gsettings;

function init() {
    gsettings = Convenience.getSettings(SCHEMA_NAME);
}

function buildPrefsWidget() {
    let ui = new buildUi();
    return ui.widget;
}

class buildUi {
    constructor() {
        this.widget = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 20,
            margin_bottom: 20,
            margin_start: 20,
            margin_end: 20,
        });

        let vbox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 10
        });
        vbox.set_size_request(550, 350);

        this.addBoldTextToBox("Shortcut Keys", vbox);
        vbox.append(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, margin_bottom: 5, margin_top: 5}));
        let info = new Gtk.Label({xalign: 0});
        info.set_markup("Use key <b>Ctrl+Alt+j</b> to toggle popup icon function");
        vbox.append(info);
        info = new Gtk.Label({xalign: 0});
        info.set_markup("Use key <b>Ctrl+Alt+o</b> to show popup window");
        vbox.append(info);

        vbox.append(this.addItemSwitch("<b>Show top icon</b>", TOP_ICON));
        vbox.append(this.addItemSwitch("<b>Popup window follow pointer</b>", WINDOW_FOLLOW_POINTER));

        vbox.append(this.addLanguageCombo());

        vbox.append(this.addItemSwitch(
            "<b>Enable translate-shell</b> (Install translate-shell package first)",
            ENABLE_TRANSLATE_SHELL));

        vbox.append(this.addItemSwitch("<b>Enable Web translate</b>", ENABLE_WEB));
        vbox.append(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, margin_bottom: 5, margin_top: 5}));
        vbox.append(this.addMobileAgent());
        vbox.append(this.addEnableJS());
        vbox.append(this.addLoadImage());

        this.addBoldTextToBox("Web online address", vbox);
        vbox.append(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, margin_bottom: 5, margin_top: 5}));

        this.addressListBox = this.addAddressBox();
        vbox.append(this.addAddButton());
        vbox.append(this.addressListBox);

        let addressActive = gsettings.get_string(ADDRESS_ACTIVE);
        for (let child = this.addressListBox.get_first_child();
             child != null;
             child = child.get_next_sibling()) {
            let radio = child.get_first_child();
            let entry = radio.get_next_sibling();
            if (entry.get_text() == addressActive) {
                radio.active = true;
            }
        }

        this.widget.append(vbox);
    }

    addItemSwitch(string, key) {
        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 20});
        let info = new Gtk.Label({xalign: 0, hexpand: true});
        info.set_markup(string);
        hbox.append(info);

        let button = new Gtk.Switch({ active: gsettings.get_boolean(key) });
        button.connect('notify::active', (button) => { gsettings.set_boolean(key, button.active); });
        hbox.append(button);
        return hbox;
    }

    addLanguageCombo() {
        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 10});
        let setting_label = new Gtk.Label({  xalign: 0 });
        setting_label.set_markup("<b>Select target language</b>");
        hbox.append(setting_label);
        hbox.append(this.languageCombo());

        return hbox;
    }

    languageCombo() {
        let combo = new Gtk.ComboBoxText();
        combo.set_entry_text_column(0);

        for (let l in LANGUAGES_LIST) {
            combo.append(l, LANGUAGES_LIST[l]);
        }
        combo.set_active_id(gsettings.get_string(LANGUAGE));

        combo.connect('changed', () => {
            gsettings.set_string(LANGUAGE, combo.get_active_id());
            this.addressUpdate();
        });

        return combo;
    }

    addMobileAgent() {
        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 5, margin_start: 10 });
        let setting_label = new Gtk.Label({ label: "Use mobile agent", xalign: 0, hexpand: true });
        this.settingMobileAgent = new Gtk.Switch({ active: gsettings.get_boolean(MOBILE_AGENT) });

        this.settingMobileAgent.connect('notify::active', (button) => { gsettings.set_boolean(MOBILE_AGENT, button.active); });

        hbox.append(setting_label);
        hbox.append(this.settingMobileAgent);

        return hbox;
    }

    addEnableJS() {
        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 5, margin_start: 10 });
        let setting_label = new Gtk.Label({ label: "Enable javascript", xalign: 0, hexpand: true });
        this.settingEnableJS = new Gtk.Switch({ active: gsettings.get_boolean(ENABLE_JAVASCRIPT) });

        this.settingEnableJS.connect('notify::active', (button) => { gsettings.set_boolean(ENABLE_JAVASCRIPT, button.active); });

        hbox.append(setting_label);
        hbox.append(this.settingEnableJS);

        return hbox;
    }

    addLoadImage() {
        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 5, margin_start: 10});
        let setting_label = new Gtk.Label({ label: "Load image", xalign: 0, hexpand: true });
        this.settingLoadImage = new Gtk.Switch({ active: gsettings.get_boolean(LOAD_IMAGE) });

        this.settingLoadImage.connect('notify::active', (button) => { gsettings.set_boolean(LOAD_IMAGE, button.active); });

        hbox.append(setting_label);
        hbox.append(this.settingLoadImage);

        return hbox;
    }

    addAddButton() {
        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL,
            margin_top: 10,
        });

        let label = new Gtk.Label({ label: 'Add' });
        let add = new Gtk.Button({ label: 'Add' });
        add.connect('clicked', this.addClicked.bind(this));

        hbox.append(add);

        let info = new Gtk.Label({ margin_start: 10 });
        info.set_markup("Use <b>%WORD</b> to replace the search word");
        hbox.append(info);

        return hbox;
    }

    addClicked() {
        this.addressListBox.append(this.addressRow('http://', false));
        this.addressListBox.show();
    }

    addAddressBox() {
        let addressBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, margin_top: 10 });
        addressBox.append(this.addGoogleTranslate());

        ADDRESS.forEach( (a) => {
            addressBox.append(this.addressRow(a, true));
        });

        let addressList = [];
        gsettings.get_strv(ADDRESS_LIST).forEach( (a) => {
            if (a != "")
                addressList.push(a);
        });

        addressList.forEach( (a) => {
            addressBox.append(this.addressRow(a, false));
        });

        return addressBox;
    }

    addGoogleTranslate() {
        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 10});

        let radioButton = new Gtk.CheckButton({ });
        radioButton.active = true;
        radioButton.isDefault = true;
        radioButton.google = true;
        radioButton.connect("toggled", this.addressUpdate.bind(this));
        this.radioGroup = radioButton;
        hbox.append(radioButton);

        let info = new Gtk.Label({xalign: 0, margin_start: 10});
        info.set_markup("Use google translate");
        hbox.append(info);

        return hbox;
    }

    googleTranslateUrl() {
        let language = gsettings.get_string(LANGUAGE);
        let url = "https://translate.google.com/#view=home&op=translate&sl=auto&tl=" + language + "&text=%WORD";

        return url;
    }

    addressRow(address, isDefault) {
        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 10});

        let radioButton = new Gtk.CheckButton();
        radioButton.set_group(this.radioGroup);
        radioButton.isDefault = isDefault;
        radioButton.connect("toggled", this.addressUpdate.bind(this));
        hbox.append(radioButton);

        if (isDefault) {
            let label = new Gtk.Label({margin_start: 10, xalign: 0});
            label.selectable = true;
            label.set_text(address);
            hbox.append(label);
        } else {
            let entry = new Gtk.Entry({ margin_start: 10 });
            entry.set_text(address);
            entry.connect('changed', this.addressUpdate.bind(this));
            hbox.append(entry);

            let remove = new Gtk.Button({ margin_start: 10 });
            remove.set_label("Remove");
            remove.hbox = hbox;
            remove.connect("clicked", this.removeClicked.bind(this));
            hbox.append(remove);
        }

        return hbox;
    }

    removeClicked(button) {
        this.addressListBox.remove(button.hbox);
        this.addressUpdate();
    }

    addressUpdate() {
        let addressList = [];
        let addressActive = '';
        for (let row = this.addressListBox.get_first_child();
             row != null;
             row = row.get_next_sibling()) {
            let radio = row.get_first_child();
            let entry = radio.get_next_sibling();
            let link = entry.get_text();
            if (!radio.isDefault)
                addressList.push(link);

            if (radio.active) {
                if (radio.google)
                    addressActive = this.googleTranslateUrl();
                else
                    addressActive = link;
            }
        }

        gsettings.set_strv(ADDRESS_LIST, addressList);
        gsettings.set_string(ADDRESS_ACTIVE, addressActive);
    }

    addBoldTextToBox(text, box) {
        let txt = new Gtk.Label({xalign: 0, margin_top: 20});
        txt.set_markup('<b>' + text + '</b>');
        txt.set_wrap(true);
        box.append(txt);
    }
}

