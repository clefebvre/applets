/*window.log2 = function () {
  let args = arguments;
  let output = [];
  for (var i = 0, len = args.length; i < len; i++) {

    if (typeof args[i] === 'object') {
      args[i] = JSON.stringify(args[i]);
    } else if (typeof args[i] !== 'string') {
      args[i] = args[i].toString();
    }
    output.push(args[i])
  }
  log(Date.now() + ': ' + output.join(' '))
};*/
const Main = imports.ui.main;
const IconTheme = imports.gi.Gtk.IconTheme;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const AppFavorites = imports.ui.appFavorites;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;

const AppletDir = imports.ui.appletManager.applets['Cinnamenu@json'];

const CinnamenuPanel = AppletDir.panel.CinnamenuPanel;

const PRIVACY_SCHEMA = 'org.cinnamon.desktop.privacy';
const REMEMBER_RECENT_KEY = 'remember-recent-files';

/**
 * @name CinnamenuButton
 * @description The main panel object that holds view/apps/menu buttons
 *
 * @param {object} metadata
 * @param {number} orientation
 * @param {number} panel_height
 * @param {number} instance_id
 */

function CinnamenuButton(metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id)
}

CinnamenuButton.prototype = {
  __proto__: Applet.TextIconApplet.prototype,

  _init: function(metadata, orientation, panel_height, instance_id) {
    Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
    this.setAllowedLayout(Applet.AllowedLayout.BOTH);
    this.orientation = orientation;
    this._uuid = metadata.uuid;
    this.settings = new Settings.AppletSettings(this, this._uuid, instance_id);

    this._appletEnterEventId = 0;
    this._appletLeaveEventId = 0;
    this._appletHoverDelayId = 0;

    this.appSystem = Cinnamon.AppSystem.get_default();
    this.appFavorites = AppFavorites.getAppFavorites();

    this.privacy_settings = new Gio.Settings({
      schema_id: PRIVACY_SCHEMA
    });
    this.privacy_settings.connect('changed::' + REMEMBER_RECENT_KEY, Lang.bind(this, this.refresh));

    // FS search
    this._fileFolderAccessActive = false;
    this._pathCompleter = new Gio.FilenameCompleter();
    this._pathCompleter.set_dirs_only(false);

    // Bind Preference Settings
    this._bindSettingsChanges();

    this._updateActivateOnHover();

    this._updateKeybinding();

    Main.themeManager.connect('theme-set', Lang.bind(this, this._updateIconAndLabel));
    this._updateIconAndLabel();

    // Connect gtk icontheme for when icons change
    this._iconsChangedId = IconTheme.get_default().connect('changed', Lang.bind(this, this._onIconsChanged));

    // Connect to AppSys for when new application installed
    this._installedChangedId = this.appSystem.connect('installed-changed', Lang.bind(this, this._onAppInstalledChanged));

    // Connect to AppFavorites for when favorites change
    this._favoritesChangedId = this.appFavorites.connect('changed', Lang.bind(this, this._onFavoritesChanged));

    this._setHotSpotTimeoutId = 0;
    this._display();
  },

  update_label_visible: function() {
    if (this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT) {
      this.hide_applet_label(true);
    } else {
      this.hide_applet_label(false);
    }
  },

  on_orientation_changed: function(orientation) {
    this.orientation = orientation;

    this.update_label_visible();

    this.cinnamenuPanel.menu.destroy();
    this.refresh();
    this._updateIconAndLabel();
  },

  on_applet_removed_from_panel: function() {
    Main.keybindingManager.removeHotKey('overlay-key-' + this.instance_id)
  },

  on_applet_clicked: function(event) {
    this.menu.toggle_with_options(this.enableAnimation);
  },

  _launch_editor: function () {
    Util.spawnCommandLine('cinnamon-menu-editor');
  },

  _updateKeybinding: function() {
    Main.keybindingManager.addHotKey('overlay-key-' + this.instance_id, this.overlayKey, Lang.bind(this, function() {
      if (!Main.overview.visible && !Main.expo.visible) {
        this.menu.toggle_with_options(this.enableAnimation);
      }
    }));
  },

  _updateIconAndLabel: function() {
    try {
      if (this.menuIconCustom) {
        if (this.menuIcon === '') {
          this.set_applet_icon_name('');
        } else if (GLib.path_is_absolute(this.menuIcon) && GLib.file_test(this.menuIcon, GLib.FileTest.EXISTS)) {
          if (this.menuIcon.search('-symbolic') !== -1) {
            this.set_applet_icon_symbolic_path(this.menuIcon);
          } else {
            this.set_applet_icon_path(this.menuIcon);
          }
        } else if (Gtk.IconTheme.get_default().has_icon(this.menuIcon)) {
          if (this.menuIcon.search('-symbolic') !== -1) {
            this.set_applet_icon_symbolic_name(this.menuIcon);
          } else {
            this.set_applet_icon_name(this.menuIcon);
          }
        }
      } else {
        this._set_default_menu_icon();
      }
    } catch (e) {
      global.logWarning('Could not load icon file ' + this.menuIcon + ' for menu button');
    }

    if (this.menuIconCustom && this.menuIcon === '') {
      this._applet_icon_box.hide();
    } else {
      this._applet_icon_box.show();
    }

    if (this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT) {
      this.set_applet_label('');
    } else {
      if (!this.panelMenuLabelText || this.panelMenuLabelText.length > 0) {
        this.set_applet_label(this.menuLabel); // TBD
        this.set_applet_tooltip(this.menuLabel);
      } else {
        this.set_applet_label('');
      }
    }
  },

  _set_default_menu_icon: function() {
    let path = global.datadir + '/theme/menu.svg';
    if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
      this.set_applet_icon_path(path);
      return;
    }

    path = global.datadir + '/theme/menu-symbolic.svg';
    if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
      this.set_applet_icon_symbolic_path(path);
      return;
    }
    /* If all else fails, this will yield no icon */
    this.set_applet_icon_path('');
  },

  refresh: function() {
    this._clearAll();
    this._display();
  },

  _clearAll: function() {
    if (this.cinnamenuPanel) {
      this.actor.remove_actor(this.cinnamenuPanel.actor);
    }

    if (this.cinnamenuPanel) {
      this.cinnamenuPanel.destroy();
    }
    this.cinnamenuPanel = null;
  },

  _display: function() {
    // Initialize apps menu button
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, this.orientation);
    this.menuManager.addMenu(this.menu);
    this.menu.setCustomStyleClass('menu-background');
    this.cinnamenuPanel = new CinnamenuPanel(this);
  },

  openMenu: function() {
    if (!this._applet_context_menu.isOpen) {
      this.menu.open(this.enableAnimation);
    }
  },

  _clearDelayCallbacks: function() {
    if (this._appletHoverDelayId > 0) {
      Mainloop.source_remove(this._appletHoverDelayId);
      this._appletHoverDelayId = 0;
    }
    if (this._appletLeaveEventId > 0) {
      this.actor.disconnect(this._appletLeaveEventId);
      this._appletLeaveEventId = 0;
    }

    return false;
  },

  _updateActivateOnHover: function() {
    if (this._appletEnterEventId > 0) {
      this.actor.disconnect(this._appletEnterEventId);
      this._appletEnterEventId = 0;
    }

    this._clearDelayCallbacks();

    if (this.activateOnHover) {
      this._appletEnterEventId = this.actor.connect('enter-event', Lang.bind(this, function() {
        if (this.hover_delay_ms > 0) {
          this._appletLeaveEventId = this.actor.connect('leave-event', Lang.bind(this, this._clearDelayCallbacks));
          this._appletHoverDelayId = Mainloop.timeout_add(this.hover_delay_ms,
            Lang.bind(this, function() {
              this.openMenu();
              this._clearDelayCallbacks();
            }));
        } else {
          this.openMenu();
        }
      }));
    }
  },

  // handler for when new application installed
  _onAppInstalledChanged: function() {
    this.refreshPanel();
  },

  // handler for when favorites change
  _onFavoritesChanged: function() {
    if (this.cinnamenuPanel) {
      this.cinnamenuPanel._selectFavorites(this.cinnamenuPanel._currentCategoryButton);
    }
  },

  // handler for when icons change
  _onIconsChanged: function() {
    // AppFavorites' changed signal gets called before the applet finishes initializing, so
    // we need to defer it here for now.
    Mainloop.idle_add_full(Mainloop.PRIORITY_DEFAULT, Lang.bind(this, this.refreshPanel));
  },

  // function to bind preference setting changes
  _bindSettingsChanges: function() {
    var settingsProps = [{
        key: 'menu-icon-custom',
        value: 'menuIconCustom',
        cb: this._updateIconAndLabel
      },
      {
        key: 'menu-icon',
        value: 'menuIcon',
        cb: this._updateIconAndLabel
      },
      {
        key: 'activate-on-hover',
        value: 'activateOnHover',
        cb: this._updateActivateOnHover
      },
      {
        key: 'hover-delay',
        value: 'hover_delay_ms',
        cb: this._updateActivateOnHover
      },
      {
        key: 'overlay-key',
        value: 'overlayKey',
        cb: this._updateKeybinding
      },
      {
        key: 'enable-animation',
        value: 'enableAnimation',
        cb: null
      },
      {
        key: 'enable-autoscroll',
        value: 'enableAutoScroll',
        cb: null
      },
      {
        key: 'enable-bookmarks',
        value: 'enableBookmarks',
        cb: Lang.bind(this, this.refreshPanel)
      },
      {
        key: 'menu-label',
        value: 'menuLabel',
        cb: this._updateIconAndLabel
      },
      {
        key: 'startup-view-mode',
        value: 'startupViewMode',
        cb: Lang.bind(this, this.refreshPanel)
      },
      {
        key: 'apps-grid-column-count',
        value: 'appsGridColumnCount',
        cb: Lang.bind(this, this.refreshPanel)
      },
      {
        key: 'category-icon-size',
        value: 'categoryIconSize',
        cb: Lang.bind(this, this.refreshPanel)
      },
      {
        key: 'apps-list-icon-size',
        value: 'appsListIconSize',
        cb: Lang.bind(this, this.refreshPanel)
      },
      {
        key: 'apps-grid-icon-size',
        value: 'appsGridIconSize',
        cb: Lang.bind(this, this.refreshPanel)
      },
      {
        key: 'apps-grid-icon-scale',
        value: 'appsGridIconScale',
        cb: null
      },
      {
        key: 'show-places',
        value: 'showPlaces',
        cb: Lang.bind(this, this.refreshPanel)
      },
      {
        key: 'show-application-icons',
        value: 'showApplicationIcons',
        cb: Lang.bind(this, this.refreshPanel)
      },
      {
        key: 'show-category-icons',
        value: 'showCategoryIcons',
        cb: Lang.bind(this, this.refreshPanel)
      },
      {
        key: 'search-filesystem',
        value: 'searchFilesystem',
        cb: Lang.bind(this, this.refreshPanel)
      },
      {
        key: 'show-apps-description-on-buttons',
        value: 'showAppDescriptionsOnButtons',
        cb: Lang.bind(this, this.refreshPanel)
      },
    ]

    for (let i = 0, len = settingsProps.length; i < len; i++) {
      this.settings.bind(settingsProps[i].key, settingsProps[i].value, settingsProps[i].cb);
    }
  },

  refreshPanel: function () {
    if (this.cinnamenuPanel) {
      this.cinnamenuPanel.refresh();
    }
  },

  // function to destroy CinnamenuButton
  destroy: function() {
    // Disconnect global signals
    if (this._installedChangedId) {
      this.appSystem.disconnect(this._installedChangedId);
    }

    if (this._favoritesChangedId) {
      AppFavorites.getAppFavorites().disconnect(this._favoritesChangedId);
    }

    if (this._iconsChangedId) {
      IconTheme.get_default().disconnect(this._iconsChangedId);
    }

    if (this._themeChangedId) {
      St.ThemeContext.get_for_stage(global.stage).disconnect(this._themeChangedId);
    }

    if (this._overviewShownId) {
      Main.overview.disconnect(this._overviewShownId);
    }

    if (this._overviewHiddenId) {
      Main.overview.disconnect(this._overviewHiddenId);
    }

    if (this._overviewPageChangedId) {
      Main.overview.disconnect(this._overviewPageChangedId);
    }

    // Destroy main clutter actor: this should be sufficient
    // From clutter documentation:
    // If the actor is inside a container, the actor will be removed.
    // When you destroy a container, its children will be destroyed as well.
    this.cinnamenuPanel.destroy();
    this.menu.destroy();
    this.actor.destroy();
    this.emit('destroy');
  }

};

function main(metadata, orientation, panel_height, instance_id) {
  return new CinnamenuButton(metadata, orientation, panel_height, instance_id);
}