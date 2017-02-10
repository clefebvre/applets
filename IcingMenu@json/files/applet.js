'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var Applet = imports.ui.applet;
var Mainloop = imports.mainloop;
var CMenu = imports.gi.CMenu;
var Lang = imports.lang;
var Cinnamon = imports.gi.Cinnamon;
var St = imports.gi.St;
var Clutter = imports.gi.Clutter;
var Main = imports.ui.main;
var PopupMenu = imports.ui.popupMenu;
var AppFavorites = imports.ui.appFavorites;
var Gtk = imports.gi.Gtk;
var Atk = imports.gi.Atk;
var Gio = imports.gi.Gio;
var GnomeSession = imports.misc.gnomeSession;
var ScreenSaver = imports.misc.screenSaver;
var Util = imports.misc.util;
var Meta = imports.gi.Meta;
var DocInfo = imports.misc.docInfo;
var GLib = imports.gi.GLib;
var Settings = imports.ui.settings;
var SearchProviderManager = imports.ui.searchProviderManager;
var ajax = imports.applet.ajax;
var setTimeout = imports.applet.setTimeout;
var clog = imports.applet.clog;

var AppletDir = imports.ui.appletManager.applets['IcingMenu@json'];
var kmp = AppletDir.kmp.kmp;
var TransientButton = AppletDir.buttons.TransientButton;
var ApplicationButton = AppletDir.buttons.ApplicationButton;
var SearchProviderResultButton = AppletDir.buttons.SearchProviderResultButton;
var PlaceButton = AppletDir.buttons.PlaceButton;
var RecentButton = AppletDir.buttons.RecentButton;
var RecentClearButton = AppletDir.buttons.RecentClearButton;
var CategoryButton = AppletDir.buttons.CategoryButton;
var PlaceCategoryButton = AppletDir.buttons.PlaceCategoryButton;
var RecentCategoryButton = AppletDir.buttons.RecentCategoryButton;
var FavoritesButton = AppletDir.buttons.FavoritesButton;
var SystemButton = AppletDir.buttons.SystemButton;
var CategoriesApplicationsBox = AppletDir.buttons.CategoriesApplicationsBox;
var FavoritesBox = AppletDir.buttons.FavoritesBox;
var NoRecentDocsButton = AppletDir.buttons.NoRecentDocsButton;

var MAX_RECENT_FILES = 20;

var INITIAL_BUTTON_LOAD = 30;

var PRIVACY_SCHEMA = 'org.cinnamon.desktop.privacy';
var REMEMBER_RECENT_KEY = 'remember-recent-files';

var appsys = Cinnamon.AppSystem.get_default();

/* VisibleChildIterator takes a container (boxlayout, etc.)
 * and creates an array of its visible children and their index
 * positions.  We can then work through that list without
 * mucking about with positions and math, just give a
 * child, and it'll give you the next or previous, or first or
 * last child in the list.
 *
 * We could have this object regenerate off a signal
 * every time the visibles have changed in our applicationBox,
 * but we really only need it when we start keyboard
 * navigating, so increase speed, we reload only when we
 * want to use it.
 */

function VisibleChildIterator(container) {
  this._init(container);
}

VisibleChildIterator.prototype = {
  _init: function _init(container) {
    this.container = container;
    this.reloadVisible();
  },

  reloadVisible: function reloadVisible() {
    this.array = this.container.get_focus_chain().filter(function (x) {
      return !(x._delegate instanceof PopupMenu.PopupSeparatorMenuItem);
    });
  },

  getNextVisible: function getNextVisible(curChild) {
    return this.getVisibleItem(this.array.indexOf(curChild) + 1);
  },

  getPrevVisible: function getPrevVisible(curChild) {
    return this.getVisibleItem(this.array.indexOf(curChild) - 1);
  },

  getFirstVisible: function getFirstVisible() {
    return this.array[0];
  },

  getLastVisible: function getLastVisible() {
    return this.array[this.array.length - 1];
  },

  getVisibleIndex: function getVisibleIndex(curChild) {
    return this.array.indexOf(curChild);
  },

  getVisibleItem: function getVisibleItem(index) {
    var len = this.array.length;
    index = (index % len + len) % len;
    return this.array[index];
  },

  getNumVisibleChildren: function getNumVisibleChildren() {
    return this.array.length;
  },

  getAbsoluteIndexOfChild: function getAbsoluteIndexOfChild(child) {
    return this.container.get_children().indexOf(child);
  }
};

function MyApplet(orientation, panel_height, instance_id) {
  this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
  __proto__: Applet.TextIconApplet.prototype,

  _init: function _init(orientation, panel_height, instance_id) {
    var _this = this;

    Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

    this.c32 = true;
    try {
      this.setAllowedLayout(Applet.AllowedLayout.BOTH);
    } catch (e) {
      this.c32 = null;
    }
    this.initializing = true;

    this.initial_load_done = false;

    this.set_applet_tooltip(_('Menu'));
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this.orientation = orientation;

    this.actor.connect('key-press-event', function (actor, event) {
      return _this._onSourceKeyPress(actor, event);
    });

    this.settings = new Settings.AppletSettings(this, 'IcingMenu@json', instance_id);

    this._appletEnterEventId = 0;
    this._appletLeaveEventId = 0;
    this._appletHoverDelayId = 0;

    if (this.c32) {
      this.menu.setCustomStyleClass('menu-background');
    } else {
      this.menu.actor.add_style_class_name('menu-background');
    }
    this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));

    var settingsProps = [{ key: 'autoUpdate', value: 'autoUpdate', cb: this.handleUpdate }, { key: 'show-places', value: 'showPlaces', cb: this._refreshBelowApps }, { key: 'hover-delay', value: 'hover_delay_ms', cb: this._updateActivateOnHover }, { key: 'activate-on-hover', value: 'activateOnHover', cb: this._updateActivateOnHover }, { key: 'menu-icon-custom', value: 'menuIconCustom', cb: this._updateIconAndLabel }, { key: 'menu-icon', value: 'menuIcon', cb: this._updateIconAndLabel }, { key: 'menu-label', value: 'menuLabel', cb: this._updateIconAndLabel }, { key: 'overlay-key', value: 'overlayKey', cb: this._updateKeybinding }, { key: 'menu-height', value: 'menuHeight', cb: this._recalc_height }, { key: 'menu-width', value: 'menuWidth', cb: this._refreshMenu }, { key: 'search-position', value: 'searchPosition', cb: this._refreshMenu }, { key: 'appInfo-position', value: 'appInfoPosition', cb: this._refreshMenu }, { key: 'show-scrollbar', value: 'showScrollbar', cb: this._refreshMenu }, { key: 'show-category-icons', value: 'showCategoryIcons', cb: this._refreshAll }, { key: 'show-application-icons', value: 'showApplicationIcons', cb: this._refreshAll }, { key: 'favbox-show', value: 'favBoxShow', cb: this._reloadApp }, { key: 'enable-animation', value: 'enableAnimation', cb: null }];

    if (this.c32) {
      for (var i = 0, len = settingsProps.length; i < len; i++) {
        this.settings.bind(settingsProps[i].key, settingsProps[i].value, settingsProps[i].cb);
      }
    } else {
      for (var _i = 0, _len = settingsProps.length; _i < _len; _i++) {
        this.settings.bindProperty(Settings.BindingDirection.IN, settingsProps[_i].key, settingsProps[_i].value, settingsProps[_i].cb, null);
      }
    }

    this._updateActivateOnHover();

    this._updateKeybinding();

    Main.themeManager.connect('theme-set', Lang.bind(this, this._updateIconAndLabel));
    this._updateIconAndLabel();

    this._searchInactiveIcon = new St.Icon({
      style_class: 'menu-search-entry-icon',
      icon_name: 'edit-find',
      icon_type: St.IconType.SYMBOLIC
    });
    this._searchActiveIcon = new St.Icon({
      style_class: 'menu-search-entry-icon',
      icon_name: 'edit-clear',
      icon_type: St.IconType.SYMBOLIC
    });
    this._searchIconClickedId = 0;
    this._applicationsButtons = [];
    this._applicationsButtonFromApp = {};
    this._favoritesButtons = [];
    this._placesButtons = [];
    this._transientButtons = [];
    this.recentButton = null;
    this._recentButtons = [];
    this._categoryButtons = [];
    this._searchProviderButtons = [];
    this._selectedItemIndex = null;
    this._previousSelectedActor = null;
    this._previousVisibleIndex = null;
    this._previousTreeSelectedActor = null;
    this._activeContainer = null;
    this._activeActor = null;
    this._applicationsBoxWidth = 0;
    this.menuIsOpening = false;
    this._knownApps = []; // Used to keep track of apps that are already installed, so we can highlight newly installed ones
    this._appsWereRefreshed = false;
    this._canUninstallApps = GLib.file_test('/usr/bin/cinnamon-remove-application', GLib.FileTest.EXISTS);
    this._isBumblebeeInstalled = GLib.file_test('/usr/bin/optirun', GLib.FileTest.EXISTS);
    this.RecentManager = new DocInfo.DocManager();
    this.privacy_settings = new Gio.Settings({
      schema_id: PRIVACY_SCHEMA
    });
    this.noRecentDocuments = true;
    this._activeContextMenuParent = null;
    this._activeContextMenuItem = null;
    this._display();
    appsys.connect('installed-changed', Lang.bind(this, this.onAppSysChanged));
    AppFavorites.getAppFavorites().connect('changed', Lang.bind(this, this._refreshFavs));
    Main.placesManager.connect('places-updated', Lang.bind(this, this._refreshBelowApps));
    this.RecentManager.connect('changed', Lang.bind(this, this._refreshRecent));
    this.privacy_settings.connect('changed::' + REMEMBER_RECENT_KEY, Lang.bind(this, this._refreshRecent));
    this._fileFolderAccessActive = false;
    this._pathCompleter = new Gio.FilenameCompleter();
    this._pathCompleter.set_dirs_only(false);
    this.lastAcResults = [];

    if (typeof this.settings.bind === 'function') {
      this.settings.bind('search-filesystem', 'searchFilesystem');
    } else {
      this.settings.bindProperty(Settings.BindingDirection.IN, 'search-filesystem', 'searchFilesystem', null, null);
    }

    this.refreshing = false; // used as a flag to know if we're currently refreshing (so we don't do it more than once concurrently)

    this.recentContextMenu = null;
    this.appsContextMenu = null;

    // We shouldn't need to call refreshAll() here... since we get a 'icon-theme-changed' signal when CSD starts.
    // The reason we do is in case the Cinnamon icon theme is the same as the one specificed in GTK itself (in .config)
    // In that particular case we get no signal at all.
    this._refreshAll(this.initializing);

    St.TextureCache.get_default().connect('icon-theme-changed', Lang.bind(this, this.onIconThemeChanged));
    this._recalc_height();

    this.update_label_visible();

    // Wait 3s, as Cinnamon doesn't populate Applet._meta until after the applet loads.
    setTimeout(function () {
      return _this.handleUpdate();
    }, 3000);
  },

  handleUpdate: function handleUpdate() {
    var _this2 = this;

    if (this.autoUpdate) {
      this.version = 'v' + this._meta.version;
      // Parse out the HTML response instead of using the API endpoint to work around Github's API limit.
      ajax({ method: 'GET', url: 'https://github.com/jaszhix/icingmenu/releases/latest', json: false }).then(function (res) {
        var split = '/jaszhix/icingmenu/releases/download/';
        var end = res.split(split)[1].split('.zip')[0];
        var version = end.split('/')[0];
        var file = 'https://github.com' + split + end + '.zip';
        if (version !== _this2.version) {
          (function () {
            var now = Date.now();
            Main.notify('Icing Menu is updating...', 'Go to settings if you wish to disable automatic updates.');
            Util.trySpawnCommandLine('bash -c \'wget -O /tmp/IcingMenu-' + now + '.zip ' + file + '\'');
            // Defer for conservative durations due to lack of callback from Utils CLI methods
            setTimeout(function () {
              Util.trySpawnCommandLine('bash -c \'unzip -o /tmp/IcingMenu-' + now + '.zip -d ~/.local/share/cinnamon/applets/IcingMenu@json/\'');
              setTimeout(function () {
                return _this2._reloadApp();
              }, 10000);
            }, 10000);
          })();
        }
      }).catch(function (e) {
        return null;
      });
    }
  },


  _reloadApp: function _reloadApp() {
    Util.trySpawnCommandLine('bash -c "python ~/.local/share/cinnamon/applets/IcingMenu@json/utils.py reload"');
  },

  _updateKeybinding: function _updateKeybinding() {
    Main.keybindingManager.addHotKey('overlay-key-' + this.instance_id, this.overlayKey, Lang.bind(this, function () {
      if (!Main.overview.visible && !Main.expo.visible) {
        this.menu.toggle_with_options(this.enableAnimation);
      }
    }));
  },

  onIconThemeChanged: function onIconThemeChanged() {
    if (!this.refreshing && !this.initializing) {
      this.refreshing = true;
      Mainloop.timeout_add_seconds(1, Lang.bind(this, this._refreshAll));
    }
  },

  onAppSysChanged: function onAppSysChanged() {
    if (!this.refreshing) {
      this.refreshing = true;
      Mainloop.timeout_add_seconds(1, Lang.bind(this, this._refreshAll));
    }
  },

  _refreshAll: function _refreshAll() {
    var init = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

    try {
      this._refreshApps();
      this._refreshFavs();
      this._refreshPlaces();
      this._refreshRecent(init);
    } catch (exception) {
      global.log(exception);
    }
    this.refreshing = false;
  },

  _refreshBelowApps: function _refreshBelowApps() {
    this._refreshPlaces();
    this._refreshRecent();
  },

  openMenu: function openMenu() {
    if (!this._applet_context_menu.isOpen) {
      this.menu.open(this.enableAnimation);
    }
  },

  _clearDelayCallbacks: function _clearDelayCallbacks() {
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

  _updateActivateOnHover: function _updateActivateOnHover() {
    if (this._appletEnterEventId > 0) {
      this.actor.disconnect(this._appletEnterEventId);
      this._appletEnterEventId = 0;
    }

    this._clearDelayCallbacks();

    if (this.activateOnHover) {
      this._appletEnterEventId = this.actor.connect('enter-event', Lang.bind(this, function () {
        if (this.hover_delay_ms > 0) {
          this._appletLeaveEventId = this.actor.connect('leave-event', Lang.bind(this, this._clearDelayCallbacks));
          this._appletHoverDelayId = Mainloop.timeout_add(this.hover_delay_ms, Lang.bind(this, function () {
            this.openMenu();
            this._clearDelayCallbacks();
          }));
        } else {
          this.openMenu();
        }
      }));
    }
  },

  _recalc_height: function _recalc_height() {
    //let scrollBoxHeight = (this.leftBox.get_allocation_box().y2 - this.leftBox.get_allocation_box().y1) - (this.searchBox.get_allocation_box().y2 - this.searchBox.get_allocation_box().y1) / global.ui_scale;
    this.applicationsScrollBox.style = 'height: ' + this.menuHeight + 'px; width: ' + this.menuWidth + 'px;';
  },

  update_label_visible: function update_label_visible() {
    if (this.c32) {
      if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {
        this.hide_applet_label(true);
      } else {
        this.hide_applet_label(false);
      }
    }
  },

  _refreshMenu: function _refreshMenu() {
    this.on_orientation_changed(this.orientation);
  },


  on_orientation_changed: function on_orientation_changed(orientation) {
    this.orientation = orientation;

    this.update_label_visible();

    this.menu.destroy();
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    if (this.c32) {
      this.menu.setCustomStyleClass('menu-background');
    } else {
      this.menu.actor.add_style_class_name('menu-background');
    }
    this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));
    this._display();

    if (this.initial_load_done) {
      this._refreshAll();
    }
    this._updateIconAndLabel();
  },

  on_applet_added_to_panel: function on_applet_added_to_panel() {
    this.initial_load_done = true;
  },

  on_applet_removed_from_panel: function on_applet_removed_from_panel() {
    Main.keybindingManager.removeHotKey('overlay-key-' + this.instance_id);
  },

  _launch_editor: function _launch_editor() {
    Util.spawnCommandLine('cinnamon-menu-editor');
  },

  on_applet_clicked: function on_applet_clicked(event) {
    this.menu.toggle_with_options(this.enableAnimation);
  },

  _onSourceKeyPress: function _onSourceKeyPress(actor, event) {
    var symbol = event.get_key_symbol();

    if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
      this.menu.toggle();
      return true;
    } else if (symbol == Clutter.KEY_Escape && this.menu.isOpen) {
      this.menu.close();
      return true;
    } else if (symbol == Clutter.KEY_Down) {
      if (!this.menu.isOpen) {
        this.menu.toggle();
      }
      this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
      return true;
    } else {
      return false;
    }
  },

  _onOpenStateChanged: function _onOpenStateChanged(menu, open) {
    if (open) {
      if (this._appletEnterEventId > 0) {
        this.actor.handler_block(this._appletEnterEventId);
      }
      this.menuIsOpening = true;
      this.actor.add_style_pseudo_class('active');

      if (this.searchPosition !== 'none') {
        global.stage.set_key_focus(this.searchEntry);
      }

      this._selectedItemIndex = null;
      this._activeContainer = null;
      this._activeActor = null;

      var n = Math.min(this._applicationsButtons.length, INITIAL_BUTTON_LOAD);
      for (var i = 0; i < n; i++) {
        this._applicationsButtons[i].actor.show();
      }
      this._allAppsCategoryButton.actor.style_class = 'menu-category-button-selected';
      Mainloop.idle_add(Lang.bind(this, this._initial_cat_selection, n));
    } else {
      if (this._appletEnterEventId > 0) {
        this.actor.handler_unblock(this._appletEnterEventId);
      }

      this.actor.remove_style_pseudo_class('active');
      if (this.searchActive) {
        this.resetSearch();
      }

      if (this.appInfoPosition !== 'none') {
        this.selectedAppTitle.set_text('');
        this.selectedAppDescription.set_text('');
      }

      this._previousTreeSelectedActor = null;
      this._previousSelectedActor = null;
      this.closeContextMenus(null, false);

      this._clearAllSelections(true);
      this.destroyVectorBox();
    }
  },

  _initial_cat_selection: function _initial_cat_selection(start_index) {
    var n = this._applicationsButtons.length;
    for (var i = start_index; i < n; i++) {
      this._applicationsButtons[i].actor.show();
    }
  },

  destroy: function destroy() {
    this.actor._delegate = null;
    this.menu.destroy();
    this.actor.destroy();
    this.emit('destroy');
  },

  _set_default_menu_icon: function _set_default_menu_icon() {
    var path = global.datadir + '/theme/menu.svg';
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

  _favboxtoggle: function _favboxtoggle() {
    if (!this.favBoxShow) {
      this.leftPane.hide();
    } else {
      this.leftPane.show();
    }
  },

  _updateIconAndLabel: function _updateIconAndLabel() {
    try {
      if (this.menuIconCustom) {
        if (this.menuIcon === '') {
          this.set_applet_icon_name('');
        } else if (GLib.path_is_absolute(this.menuIcon) && GLib.file_test(this.menuIcon, GLib.FileTest.EXISTS)) {
          if (this.menuIcon.search('-symbolic') != -1) {
            this.set_applet_icon_symbolic_path(this.menuIcon);
          } else {
            this.set_applet_icon_path(this.menuIcon);
          }
        } else if (Gtk.IconTheme.get_default().has_icon(this.menuIcon)) {
          if (this.menuIcon.search('-symbolic') != -1) {
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

    if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) // no menu label if in a vertical panel
      {
        this.set_applet_label('');
      } else {
      if (this.menuLabel !== '') {
        this.set_applet_label(_(this.menuLabel)); // TBD
      } else {
        this.set_applet_label('');
      }
    }
  },

  _navigateContextMenu: function _navigateContextMenu(actor, symbol, ctrlKey) {
    if (symbol === Clutter.KEY_Menu || symbol === Clutter.Escape || ctrlKey && (symbol === Clutter.KEY_Return || symbol === Clutter.KP_Enter)) {
      actor.activateContextMenus();
      return;
    }

    var goUp = symbol === Clutter.KEY_Up;
    var nextActive = null;
    var menuItems = actor.menu._getMenuItems(); // The context menu items

    // The first context menu item of a RecentButton is used just as a label.
    // So remove it from the iteration.
    if (actor instanceof RecentButton) {
      menuItems.shift();
    }

    var menuItemsLength = menuItems.length;

    switch (symbol) {
      case Clutter.KEY_Page_Up:
        this._activeContextMenuItem = menuItems[0];
        this._activeContextMenuItem.setActive(true);
        return;
      case Clutter.KEY_Page_Down:
        this._activeContextMenuItem = menuItems[menuItemsLength - 1];
        this._activeContextMenuItem.setActive(true);
        return;
    }

    if (!this._activeContextMenuItem) {
      if (symbol === Clutter.KEY_Return || symbol === Clutter.KP_Enter) {
        actor.activate();
      } else {
        this._activeContextMenuItem = menuItems[goUp ? menuItemsLength - 1 : 0];
        this._activeContextMenuItem.setActive(true);
      }
      return;
    } else if (this._activeContextMenuItem && (symbol === Clutter.KEY_Return || symbol === Clutter.KP_Enter)) {
      this._activeContextMenuItem.activate();
      this._activeContextMenuItem = null;
      return;
    }

    var i = 0;
    for (; i < menuItemsLength; i++) {
      if (menuItems[i] === this._activeContextMenuItem) {
        nextActive = goUp ? menuItems[i - 1] || null : menuItems[i + 1] || null;
        break;
      }
    }

    if (!nextActive) {
      nextActive = goUp ? menuItems[menuItemsLength - 1] : menuItems[0];
    }

    nextActive.setActive(true);
    this._activeContextMenuItem = nextActive;
  },

  _onMenuKeyPress: function _onMenuKeyPress(actor, event) {
    var symbol = event.get_key_symbol();
    var item_actor = void 0;
    var index = 0;
    this.appBoxIter.reloadVisible();
    this.catBoxIter.reloadVisible();
    this.favBoxIter.reloadVisible();

    var keyCode = event.get_key_code();
    var modifierState = Cinnamon.get_event_state(event);

    /* check for a keybinding and quit early, otherwise we get a double hit
       of the keybinding callback */
    var action = global.display.get_keybinding_action(keyCode, modifierState);

    if (action == Meta.KeyBindingAction.CUSTOM) {
      return true;
    }

    index = this._selectedItemIndex;

    var ctrlKey = modifierState & Clutter.ModifierType.CONTROL_MASK;

    // If a context menu is open, hijack keyboard navigation and concentrate on the context menu.
    if (this._activeContextMenuParent && this._activeContextMenuParent._contextIsOpen && this._activeContainer === this.applicationsBox && (this._activeContextMenuParent instanceof ApplicationButton || this._activeContextMenuParent instanceof RecentButton)) {
      var continueNavigation = false;
      switch (symbol) {
        case Clutter.KEY_Up:
        case Clutter.KEY_Down:
        case Clutter.KEY_Return:
        case Clutter.KP_Enter:
        case Clutter.KEY_Menu:
        case Clutter.KEY_Page_Up:
        case Clutter.KEY_Page_Down:
        case Clutter.Escape:
          this._navigateContextMenu(this._activeContextMenuParent, symbol, ctrlKey);
          break;
        case Clutter.KEY_Right:
        case Clutter.KEY_Left:
        case Clutter.Tab:
        case Clutter.ISO_Left_Tab:
          continueNavigation = true;
          break;
      }
      if (!continueNavigation) {
        return true;
      }
    }

    var navigationKey = true;
    var whichWay = 'none';

    switch (symbol) {
      case Clutter.KEY_Up:
        whichWay = 'up';
        if (this._activeContainer === this.favoritesBox && ctrlKey && this.favoritesBox.get_child_at_index(index)._delegate instanceof FavoritesButton) {
          navigationKey = false;
        }
        break;
      case Clutter.KEY_Down:
        whichWay = 'down';
        if (this._activeContainer === this.favoritesBox && ctrlKey && this.favoritesBox.get_child_at_index(index)._delegate instanceof FavoritesButton) {
          navigationKey = false;
        }
        break;
      case Clutter.KEY_Page_Up:
        whichWay = 'top';
        break;
      case Clutter.KEY_Page_Down:
        whichWay = 'bottom';
        break;
      case Clutter.KEY_Right:
        if (!this.searchActive) {
          whichWay = 'right';
        }
        if (this._activeContainer === this.applicationsBox) {
          whichWay = 'none';
        } else if (this._activeContainer === this.categoriesBox && this.noRecentDocuments && this.categoriesBox.get_child_at_index(index)._delegate instanceof RecentCategoryButton) {
          whichWay = 'none';
        }
        break;
      case Clutter.KEY_Left:
        if (!this.searchActive) {
          whichWay = 'left';
        }
        if (this._activeContainer === this.favoritesBox) {
          whichWay = 'none';
        } else if (!this.favBoxShow && (this._activeContainer === this.categoriesBox || this._activeContainer === null)) {
          whichWay = 'none';
        }
        break;
      case Clutter.Tab:
        if (!this.searchActive) {
          whichWay = 'right';
        } else {
          navigationKey = false;
        }
        break;
      case Clutter.ISO_Left_Tab:
        if (!this.searchActive) {
          whichWay = 'left';
        } else {
          navigationKey = false;
        }
        break;
      default:
        navigationKey = false;
    }

    if (navigationKey) {
      switch (this._activeContainer) {
        case null:
          switch (whichWay) {
            case 'up':
              this._activeContainer = this.categoriesBox;
              item_actor = this.catBoxIter.getLastVisible();
              this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
              break;
            case 'down':
              this._activeContainer = this.categoriesBox;
              item_actor = this.catBoxIter.getFirstVisible();
              item_actor = this.catBoxIter.getNextVisible(item_actor);
              this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
              break;
            case 'right':
              this._activeContainer = this.applicationsBox;
              item_actor = this.appBoxIter.getFirstVisible();
              this._scrollToButton(item_actor._delegate);
              break;
            case 'left':
              if (this.favBoxShow) {
                this._activeContainer = this.favoritesBox;
                item_actor = this.favBoxIter.getFirstVisible();
              } else {
                this._activeContainer = this.applicationsBox;
                item_actor = this.appBoxIter.getFirstVisible();
                this._scrollToButton(item_actor._delegate);
              }
              break;
            case 'top':
              this._activeContainer = this.categoriesBox;
              item_actor = this.catBoxIter.getFirstVisible();
              this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
              break;
            case 'bottom':
              this._activeContainer = this.categoriesBox;
              item_actor = this.catBoxIter.getLastVisible();
              this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
              break;
          }
          break;
        case this.categoriesBox:
          switch (whichWay) {
            case 'up':
              this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
              this._previousTreeSelectedActor._delegate.isHovered = false;
              item_actor = this.catBoxIter.getPrevVisible(this._activeActor);
              this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
              break;
            case 'down':
              this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
              this._previousTreeSelectedActor._delegate.isHovered = false;
              item_actor = this.catBoxIter.getNextVisible(this._activeActor);
              this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
              break;
            case 'right':
              if (this.categoriesBox.get_child_at_index(index)._delegate instanceof RecentCategoryButton && this.noRecentDocuments) {
                if (this.favBoxShow) {
                  this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
                  item_actor = this.favBoxIter.getFirstVisible();
                }
              } else {
                item_actor = this._previousVisibleIndex !== null ? this.appBoxIter.getVisibleItem(this._previousVisibleIndex) : this.appBoxIter.getFirstVisible();
              }
              break;
            case 'left':
              if (this.favBoxShow) {
                this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
                item_actor = this.favBoxIter.getFirstVisible();
              } else {
                if (this.categoriesBox.get_child_at_index(index)._delegate instanceof RecentCategoryButton && this.noRecentDocuments) {
                  item_actor = this.categoriesBox.get_child_at_index(index);
                } else {
                  item_actor = this._previousVisibleIndex !== null ? this.appBoxIter.getVisibleItem(this._previousVisibleIndex) : this.appBoxIter.getFirstVisible();
                }
              }
              break;
            case 'top':
              this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
              this._previousTreeSelectedActor._delegate.isHovered = false;
              item_actor = this.catBoxIter.getFirstVisible();
              this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
              break;
            case 'bottom':
              this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
              this._previousTreeSelectedActor._delegate.isHovered = false;
              item_actor = this.catBoxIter.getLastVisible();
              this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
              break;
          }
          break;
        case this.applicationsBox:
          switch (whichWay) {
            case 'up':
              this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
              item_actor = this.appBoxIter.getPrevVisible(this._previousSelectedActor);
              this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
              this._scrollToButton(item_actor._delegate);
              break;
            case 'down':
              this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
              item_actor = this.appBoxIter.getNextVisible(this._previousSelectedActor);
              this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
              this._scrollToButton(item_actor._delegate);
              break;
            case 'right':
              this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
              item_actor = this._previousTreeSelectedActor !== null ? this._previousTreeSelectedActor : this.catBoxIter.getFirstVisible();
              this._previousTreeSelectedActor = item_actor;
              index = item_actor.get_parent()._vis_iter.getAbsoluteIndexOfChild(item_actor);

              if (this.favBoxShow) {
                item_actor._delegate.emit('enter-event');
                this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
                item_actor = this.favBoxIter.getFirstVisible();
              }
              break;
            case 'left':
              this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
              item_actor = this._previousTreeSelectedActor !== null ? this._previousTreeSelectedActor : this.catBoxIter.getFirstVisible();
              this._previousTreeSelectedActor = item_actor;
              break;
            case 'top':
              item_actor = this.appBoxIter.getFirstVisible();
              this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
              this._scrollToButton(item_actor._delegate);
              break;
            case 'bottom':
              item_actor = this.appBoxIter.getLastVisible();
              this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
              this._scrollToButton(item_actor._delegate);
              break;
          }
          break;
        case this.favoritesBox:
          switch (whichWay) {
            case 'up':
              this._previousSelectedActor = this.favoritesBox.get_child_at_index(index);
              item_actor = this.favBoxIter.getPrevVisible(this._previousSelectedActor);
              break;
            case 'down':
              this._previousSelectedActor = this.favoritesBox.get_child_at_index(index);
              item_actor = this.favBoxIter.getNextVisible(this._previousSelectedActor);
              break;
            case 'right':
              item_actor = this._previousTreeSelectedActor !== null ? this._previousTreeSelectedActor : this.catBoxIter.getFirstVisible();
              this._previousTreeSelectedActor = item_actor;
              break;
            case 'left':
              item_actor = this._previousTreeSelectedActor !== null ? this._previousTreeSelectedActor : this.catBoxIter.getFirstVisible();
              this._previousTreeSelectedActor = item_actor;
              index = item_actor.get_parent()._vis_iter.getAbsoluteIndexOfChild(item_actor);

              item_actor._delegate.emit('enter-event');
              item_actor = this._previousVisibleIndex !== null ? this.appBoxIter.getVisibleItem(this._previousVisibleIndex) : this.appBoxIter.getFirstVisible();
              break;
            case 'top':
              item_actor = this.favBoxIter.getFirstVisible();
              break;
            case 'bottom':
              item_actor = this.favBoxIter.getLastVisible();
              break;
          }
          break;
        default:
          break;
      }
      if (!item_actor) {
        return false;
      }
      index = item_actor.get_parent()._vis_iter.getAbsoluteIndexOfChild(item_actor);
    } else {
      if (this._activeContainer !== this.categoriesBox && (symbol === Clutter.KEY_Return || symbol === Clutter.KP_Enter)) {
        if (!ctrlKey) {
          item_actor = this._activeContainer.get_child_at_index(this._selectedItemIndex);
          item_actor._delegate.activate();
        } else if (ctrlKey && this._activeContainer === this.applicationsBox) {
          item_actor = this.applicationsBox.get_child_at_index(this._selectedItemIndex);
          if (item_actor._delegate instanceof ApplicationButton || item_actor._delegate instanceof RecentButton) {
            item_actor._delegate.activateContextMenus();
          }
        }
        return true;
      } else if (this._activeContainer === this.applicationsBox && symbol === Clutter.KEY_Menu) {
        item_actor = this.applicationsBox.get_child_at_index(this._selectedItemIndex);
        if (item_actor._delegate instanceof ApplicationButton || item_actor._delegate instanceof RecentButton) {
          item_actor._delegate.activateContextMenus();
        }
        return true;
      } else if (this._activeContainer === this.favoritesBox && symbol === Clutter.Delete) {
        item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex);
        if (item_actor._delegate instanceof FavoritesButton) {
          var favorites = AppFavorites.getAppFavorites().getFavorites();
          var numFavorites = favorites.length;
          AppFavorites.getAppFavorites().removeFavorite(item_actor._delegate.app.get_id());
          item_actor._delegate.toggleMenu();
          if (this._selectedItemIndex == numFavorites - 1) {
            item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex - 1);
          } else {
            item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex);
          }
        }
      } else if (this._activeContainer === this.favoritesBox && (symbol === Clutter.KEY_Down || symbol === Clutter.KEY_Up) && ctrlKey && this.favoritesBox.get_child_at_index(index)._delegate instanceof FavoritesButton) {
        item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex);
        var id = item_actor._delegate.app.get_id();
        var appFavorites = AppFavorites.getAppFavorites();
        var _favorites = appFavorites.getFavorites();
        var _numFavorites = _favorites.length;
        var favPos = 0;
        if (this._selectedItemIndex == _numFavorites - 1 && symbol === Clutter.KEY_Down) {
          favPos = 0;
        } else if (this._selectedItemIndex === 0 && symbol === Clutter.KEY_Up) {
          favPos = _numFavorites - 1;
        } else if (symbol === Clutter.KEY_Down) {
          favPos = this._selectedItemIndex + 1;
        } else {
          favPos = this._selectedItemIndex - 1;
        }
        appFavorites.moveFavoriteToPos(id, favPos);
        item_actor = this.favoritesBox.get_child_at_index(favPos);
      } else if (this.searchFilesystem && (this._fileFolderAccessActive || symbol === Clutter.slash)) {
        if (symbol === Clutter.Return || symbol === Clutter.KP_Enter) {
          if (this._run(this.searchEntry.get_text())) {
            this.menu.close();
          }
          return true;
        }
        if (symbol === Clutter.Escape) {
          this.searchEntry.set_text('');
          this._fileFolderAccessActive = false;
        }
        if (symbol === Clutter.slash) {
          // Need preload data before get completion. GFilenameCompleter load content of parent directory.
          // Parent directory for /usr/include/ is /usr/. So need to add fake name('a').
          var text = this.searchEntry.get_text().concat('/a');
          var prefix = void 0;
          if (text.lastIndexOf(' ') === -1) {
            prefix = text;
          } else {
            prefix = text.substr(text.lastIndexOf(' ') + 1);
          }
          this._getCompletion(prefix);

          return false;
        }
        if (symbol === Clutter.Tab) {
          var _text = actor.get_text();
          var _prefix = void 0;
          if (_text.lastIndexOf(' ') == -1) {
            _prefix = _text;
          } else {
            _prefix = _text.substr(_text.lastIndexOf(' ') + 1);
          }
          var postfix = this._getCompletion(_prefix);
          if (postfix !== null && postfix.length > 0) {
            actor.insert_text(postfix, -1);
            actor.set_cursor_position(_text.length + postfix.length);
            if (postfix[postfix.length - 1] == '/') {
              this._getCompletion(_text + postfix + 'a');
            }
          }
          return true;
        }
        if (symbol === Clutter.ISO_Left_Tab) {
          return true;
        }
        return false;
      } else if (symbol === Clutter.Tab || symbol === Clutter.ISO_Left_Tab) {
        return true;
      } else {
        return false;
      }
    }

    if (this.appInfoPosition !== 'none') {
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');
    }

    this._selectedItemIndex = index;
    if (!item_actor || item_actor === this.searchEntry) {
      return false;
    }
    item_actor._delegate.emit('enter-event');
    return true;
  },

  _addEnterEvent: function _addEnterEvent(button, callback) {
    var _callback = Lang.bind(this, function () {
      var parent = button.actor.get_parent();
      if (this._activeContainer === this.categoriesBox && parent !== this._activeContainer) {
        this._previousTreeSelectedActor = this._activeActor;
        this._previousSelectedActor = null;
      }
      if (this._previousTreeSelectedActor && this._activeContainer !== this.categoriesBox && parent !== this._activeContainer && button !== this._previousTreeSelectedActor && !this.searchActive) {
        this._previousTreeSelectedActor.style_class = 'menu-category-button';
      }
      if (parent != this._activeContainer) {
        parent._vis_iter.reloadVisible();
      }
      var _maybePreviousActor = this._activeActor;
      if (_maybePreviousActor && this._activeContainer !== this.categoriesBox) {
        this._previousSelectedActor = _maybePreviousActor;
        this._clearPrevSelection();
      }
      if (parent === this.categoriesBox && !this.searchActive) {
        this._previousSelectedActor = _maybePreviousActor;
        this._clearPrevCatSelection();
      }
      this._activeContainer = parent;
      this._activeActor = button.actor;
      this._selectedItemIndex = this._activeContainer._vis_iter.getAbsoluteIndexOfChild(this._activeActor);
      callback();
    });
    button.connect('enter-event', _callback);
    button.actor.connect('enter-event', _callback);
  },

  _clearPrevSelection: function _clearPrevSelection(actor) {
    if (this._previousSelectedActor && this._previousSelectedActor != actor) {
      if (this._previousSelectedActor._delegate instanceof ApplicationButton || this._previousSelectedActor._delegate instanceof RecentButton || this._previousSelectedActor._delegate instanceof SearchProviderResultButton || this._previousSelectedActor._delegate instanceof PlaceButton || this._previousSelectedActor._delegate instanceof RecentClearButton || this._previousSelectedActor._delegate instanceof TransientButton) {

        this._previousSelectedActor.style_class = 'menu-application-button';
      } else if (this._previousSelectedActor._delegate instanceof FavoritesButton || this._previousSelectedActor._delegate instanceof SystemButton) {

        this._previousSelectedActor.remove_style_pseudo_class('hover');
      }
    }
  },

  _clearPrevCatSelection: function _clearPrevCatSelection(actor) {
    if (this._previousTreeSelectedActor && this._previousTreeSelectedActor != actor) {
      this._previousTreeSelectedActor.style_class = 'menu-category-button';

      if (this._previousTreeSelectedActor._delegate) {
        this._previousTreeSelectedActor._delegate.emit('leave-event');
      }

      if (actor !== undefined) {
        this._previousVisibleIndex = null;
        this._previousTreeSelectedActor = actor;
      }
    } else {
      var children = this.categoriesBox.get_children();

      for (var i = 0, len = children.length; i < len; i++) {
        children[i].style_class = 'menu-category-button';
      }
    }
  },

  makeVectorBox: function makeVectorBox(actor) {
    this.destroyVectorBox(actor);

    var _global$get_pointer = global.get_pointer(),
        _global$get_pointer2 = _slicedToArray(_global$get_pointer, 3),
        mx = _global$get_pointer2[0],
        my = _global$get_pointer2[1],
        mask = _global$get_pointer2[2];

    var _categoriesApplicatio = this.categoriesApplicationsBox.actor.get_transformed_position(),
        _categoriesApplicatio2 = _slicedToArray(_categoriesApplicatio, 2),
        bx = _categoriesApplicatio2[0],
        by = _categoriesApplicatio2[1];

    var _categoriesApplicatio3 = this.categoriesApplicationsBox.actor.get_transformed_size(),
        _categoriesApplicatio4 = _slicedToArray(_categoriesApplicatio3, 2),
        bw = _categoriesApplicatio4[0],
        bh = _categoriesApplicatio4[1];

    var _actor$get_transforme = actor.get_transformed_size(),
        _actor$get_transforme2 = _slicedToArray(_actor$get_transforme, 2),
        aw = _actor$get_transforme2[0],
        ah = _actor$get_transforme2[1];

    var _actor$get_transforme3 = actor.get_transformed_position(),
        _actor$get_transforme4 = _slicedToArray(_actor$get_transforme3, 2),
        ax = _actor$get_transforme4[0],
        ay = _actor$get_transforme4[1];

    var _applicationsBox$get_ = this.applicationsBox.get_transformed_position(),
        _applicationsBox$get_2 = _slicedToArray(_applicationsBox$get_, 2),
        appbox_x = _applicationsBox$get_2[0],
        appbox_y = _applicationsBox$get_2[1];

    var right_x = appbox_x - bx;
    var xformed_mouse_x = mx - bx;
    var xformed_mouse_y = my - by;
    var w = Math.max(right_x - xformed_mouse_x, 0);

    var ulc_y = xformed_mouse_y + 0;
    var llc_y = xformed_mouse_y + 0;

    this.vectorBox = new St.Polygon({
      debug: false,
      width: w,
      height: bh,
      ulc_x: 0,
      ulc_y: ulc_y,
      llc_x: 0,
      llc_y: llc_y,
      urc_x: w,
      urc_y: 0,
      lrc_x: w,
      lrc_y: bh
    });

    this.categoriesApplicationsBox.actor.add_actor(this.vectorBox);
    this.vectorBox.set_position(xformed_mouse_x, 0);

    this.vectorBox.show();
    this.vectorBox.set_reactive(true);
    this.vectorBox.raise_top();

    this.vectorBox.connect('leave-event', Lang.bind(this, this.destroyVectorBox));
    this.vectorBox.connect('motion-event', Lang.bind(this, this.maybeUpdateVectorBox));
    this.actor_motion_id = actor.connect('motion-event', Lang.bind(this, this.maybeUpdateVectorBox));
    this.current_motion_actor = actor;
  },

  maybeUpdateVectorBox: function maybeUpdateVectorBox() {
    if (this.vector_update_loop) {
      Mainloop.source_remove(this.vector_update_loop);
      this.vector_update_loop = 0;
    }
    this.vector_update_loop = Mainloop.timeout_add(35, Lang.bind(this, this.updateVectorBox));
  },

  updateVectorBox: function updateVectorBox(actor) {
    if (this.vectorBox) {
      var _global$get_pointer3 = global.get_pointer(),
          _global$get_pointer4 = _slicedToArray(_global$get_pointer3, 3),
          mx = _global$get_pointer4[0],
          my = _global$get_pointer4[1],
          mask = _global$get_pointer4[2];

      var _categoriesApplicatio5 = this.categoriesApplicationsBox.actor.get_transformed_position(),
          _categoriesApplicatio6 = _slicedToArray(_categoriesApplicatio5, 2),
          bx = _categoriesApplicatio6[0],
          by = _categoriesApplicatio6[1];

      var xformed_mouse_x = mx - bx;

      var _applicationsBox$get_3 = this.applicationsBox.get_transformed_position(),
          _applicationsBox$get_4 = _slicedToArray(_applicationsBox$get_3, 2),
          appbox_x = _applicationsBox$get_4[0],
          appbox_y = _applicationsBox$get_4[1];

      var right_x = appbox_x - bx;
      if (right_x - xformed_mouse_x > 0) {
        this.vectorBox.width = Math.max(right_x - xformed_mouse_x, 0);
        this.vectorBox.set_position(xformed_mouse_x, 0);
        this.vectorBox.urc_x = this.vectorBox.width;
        this.vectorBox.lrc_x = this.vectorBox.width;
        this.vectorBox.queue_repaint();
      } else {
        this.destroyVectorBox(actor);
      }
    }
    this.vector_update_loop = 0;
    return false;
  },

  destroyVectorBox: function destroyVectorBox(actor) {
    if (this.vectorBox !== null) {
      this.vectorBox.destroy();
      this.vectorBox = null;
    }
    if (this.actor_motion_id > 0 && this.current_motion_actor !== null) {
      this.current_motion_actor.disconnect(this.actor_motion_id);
      this.actor_motion_id = 0;
      this.current_motion_actor = null;
    }
  },

  _refreshPlaces: function _refreshPlaces() {
    var _this3 = this;

    for (var i = 0, len = this._placesButtons.length; i < len; i++) {
      this._placesButtons[i].actor.destroy();
    }

    this._placesButtons = [];

    for (var _i2 = 0, _len2 = this._categoryButtons.length; _i2 < _len2; _i2++) {
      if (this._categoryButtons[_i2] instanceof PlaceCategoryButton) {
        this._categoryButtons[_i2].destroy();
        this._categoryButtons.splice(_i2, 1);
        this.placesButton = null;
        break;
      }
    }
    this._placesButtons = [];

    // Now generate Places category and places buttons and add to the list
    if (this.showPlaces) {
      this.placesButton = new PlaceCategoryButton(null, this.showCategoryIcons);
      this._addEnterEvent(this.placesButton, function () {
        if (!_this3.searchActive) {
          _this3.placesButton.isHovered = true;
          _this3._clearPrevCatSelection(_this3.placesButton);
          _this3.placesButton.actor.style_class = 'menu-category-button-selected';
          _this3.closeContextMenus(null, false);
          _this3._displayButtons(null, -1);
          _this3.makeVectorBox(_this3.placesButton.actor);
        }
      });
      this.placesButton.actor.connect('leave-event', function () {
        if (_this3._previousTreeSelectedActor === null) {
          _this3._previousTreeSelectedActor = _this3.placesButton.actor;
        } else {
          var prevIdx = _this3.catBoxIter.getVisibleIndex(_this3._previousTreeSelectedActor);
          var nextIdx = _this3.catBoxIter.getVisibleIndex(_this3.placesButton.actor);
          var idxDiff = Math.abs(prevIdx - nextIdx);
          if (idxDiff <= 1 || Math.min(prevIdx, nextIdx) < 0) {
            _this3._previousTreeSelectedActor = _this3.placesButton.actor;
          }
        }

        _this3.placesButton.isHovered = false;
      });

      this._categoryButtons.push(this.placesButton);
      this.categoriesBox.add_actor(this.placesButton.actor);

      var bookmarks = this._listBookmarks();
      var devices = this._listDevices();
      var places = bookmarks.concat(devices);

      var handleEnterEvent = function handleEnterEvent(button) {
        _this3._addEnterEvent(button, function () {
          _this3._clearPrevSelection(button.actor);
          button.actor.style_class = 'menu-application-button-selected';
          if (_this3.appInfoPosition !== 'none') {
            _this3.selectedAppTitle.set_text('');
            var selectedAppId = button.place.idDecoded;
            selectedAppId = selectedAppId.substr(selectedAppId.indexOf(':') + 1);
            var fileIndex = selectedAppId.indexOf('file:///');
            if (fileIndex !== -1) {
              selectedAppId = selectedAppId.substr(fileIndex + 7);
            }
            _this3.selectedAppDescription.set_text(selectedAppId);
          }
        });
      };

      var handleLeaveEvent = function handleLeaveEvent(button) {
        button.actor.connect('leave-event', Lang.bind(_this3, function () {
          this._previousSelectedActor = button.actor;
          if (this.appInfoPosition !== 'none') {
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
          }
        }));
      };

      for (var _i3 = 0, _len3 = places.length; _i3 < _len3; _i3++) {
        var place = places[_i3];
        var button = new PlaceButton(this, place, place.name, this.showApplicationIcons);

        handleEnterEvent(button);

        handleLeaveEvent(button);

        this._placesButtons.push(button);
        this.applicationsBox.add_actor(button.actor);
      }
    }

    this._setCategoriesButtonActive(!this.searchActive);

    this._recalc_height();
    this._resizeApplicationsBox();
  },

  _refreshRecent: function _refreshRecent() {
    var _this4 = this;

    var init = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

    if (this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY)) {
      if (!this.recentButton) {
        this.recentButton = new RecentCategoryButton(null, this.showCategoryIcons);
        this._addEnterEvent(this.recentButton, Lang.bind(this, function () {
          if (!this.searchActive) {
            this.recentButton.isHovered = true;

            Mainloop.idle_add_full(Mainloop.PRIORITY_DEFAULT, Lang.bind(this, function () {
              if (this.recentButton.isHovered) {
                this._clearPrevCatSelection(this.recentButton.actor);
                this.recentButton.actor.style_class = "menu-category-button-selected";
                this.closeContextMenus(null, false);
                this._displayButtons(null, null, -1);
              } else {
                this.recentButton.actor.style_class = "menu-category-button";
              }
            }));

            this.makeVectorBox(this.recentButton.actor);
          }
        }));
        this.recentButton.actor.connect('leave-event', Lang.bind(this, function () {

          if (this._previousTreeSelectedActor === null) {
            this._previousTreeSelectedActor = this.recentButton.actor;
          } else {
            var prevIdx = this.catBoxIter.getVisibleIndex(this._previousTreeSelectedActor);
            var nextIdx = this.catBoxIter.getVisibleIndex(this.recentButton.actor);

            if (Math.abs(prevIdx - nextIdx) <= 1) {
              this._previousTreeSelectedActor = this.recentButton.actor;
            }
          }

          this.recentButton.isHovered = false;
        }));

        this._categoryButtons.push(this.recentButton);
      }

      /* Make sure the recent category is at the bottom (can happen when refreshing places
       * or apps, since we don't destroy the recent category button each time we refresh recents,
       * as it happens a lot) */

      var parent = this.recentButton.actor.get_parent();

      if (parent !== null) {
        parent.remove_child(this.recentButton.actor);
      }

      this.categoriesBox.add_actor(this.recentButton.actor);
      this._categoryButtons.splice(this._categoryButtons.indexOf(this.recentButton), 1);
      this._categoryButtons.push(this.recentButton);

      var new_recents = [];

      var handleEnterEvent = function handleEnterEvent(button) {
        _this4._addEnterEvent(button, Lang.bind(_this4, function () {
          this._clearPrevSelection(button.actor);
          button.actor.style_class = "menu-application-button-selected";
          if (this.appInfoPosition !== 'none') {

            this.selectedAppTitle.set_text("");
            var selectedAppUri = button.uriDecoded;
            var fileIndex = selectedAppUri.indexOf("file:///");
            if (fileIndex !== -1) {
              selectedAppUri = selectedAppUri.substr(fileIndex + 7);
            }
            this.selectedAppDescription.set_text(selectedAppUri);
          }
        }));
      };

      var handleLeaveEvent = function handleLeaveEvent(button) {
        button.actor.connect('leave-event', Lang.bind(_this4, function () {
          button.actor.style_class = "menu-application-button";
          this._previousSelectedActor = button.actor;
          if (this.appInfoPosition !== 'none') {

            this.selectedAppTitle.set_text("");
            this.selectedAppDescription.set_text("");
          }
        }));
      };

      var handleNewButton = function handleNewButton(id) {
        var uri = _this4.RecentManager._infosByTimestamp[id].uri;
        return _this4._recentButtons.find(function (button) {
          return button instanceof RecentButton && button.uri && button.uri == uri;
        });
      };

      if (this.RecentManager._infosByTimestamp.length > 0) {
        var id = 0;
        while (id < this.RecentManager._infosByTimestamp.length) {
          var new_button = handleNewButton(id);

          if (new_button === undefined) {
            var button = new RecentButton(this, this.RecentManager._infosByTimestamp[id], this.showApplicationIcons);
            handleEnterEvent(button);
            handleLeaveEvent(button);

            new_button = button;
          }

          new_recents.push(new_button);

          id++;
        }

        var recent_clear_button = null;

        recent_clear_button = this._recentButtons.find(function (button) {
          return button instanceof RecentClearButton;
        });

        if (recent_clear_button === undefined) {
          (function () {
            var button = new RecentClearButton(_this4);
            _this4._addEnterEvent(button, Lang.bind(_this4, function () {
              this._clearPrevSelection(button.actor);
              button.actor.style_class = "menu-application-button-selected";
            }));
            button.actor.connect('leave-event', Lang.bind(_this4, function () {
              button.actor.style_class = "menu-application-button";
              this._previousSelectedActor = button.actor;
            }));

            recent_clear_button = button;
          })();
        }

        new_recents.push(recent_clear_button);

        this.noRecentDocuments = false;
      } else {
        var _new_button = null;

        for (var existing_button in this._recentButtons) {
          var _button = this._recentButtons[existing_button];

          if (_button instanceof NoRecentDocsButton) {
            _new_button = _button;
            break;
          }
        }

        if (_new_button === null) {
          _new_button = new NoRecentDocsButton();
        }

        this.noRecentDocuments = true;
        new_recents.push(_new_button);
      }

      var to_remove = [];

      /* Remove no-longer-valid items */
      for (var i = 0; i < this._recentButtons.length; i++) {
        var _button2 = this._recentButtons[i];

        if (_button2 instanceof NoRecentDocsButton && !this.noRecentDocuments) {
          to_remove.push(_button2);
        } else if (_button2 instanceof RecentButton) {
          if (new_recents.indexOf(_button2) == -1) {
            to_remove.push(_button2);
          }
        }
      }

      if (to_remove.length > 0) {
        for (var _i4 in to_remove) {
          to_remove[_i4].destroy();
          this._recentButtons.splice(this._recentButtons.indexOf(to_remove[_i4]), 1);
        }
      }

      to_remove = [];

      /* Now, add new actors, shuffle existing actors */

      var placeholder = null;

      /* Find the first occurrence of a RecentButton, if it exists */
      var children = this.applicationsBox.get_children();
      for (var _i5 = children.length - 1; _i5 > 0; _i5--) {
        if (children[_i5]._delegate instanceof RecentButton || children[_i5]._delegate instanceof RecentClearButton || _i5 == children.length - 1) {
          placeholder = children[_i5 - 1];
          break;
        }
      }

      children = null;

      for (var _i6 = 0; _i6 < new_recents.length; _i6++) {
        var actor = new_recents[_i6].actor;

        var _parent = actor.get_parent();
        if (_parent !== null) {
          _parent.remove_child(actor);
        }

        this.applicationsBox.insert_child_above(actor, placeholder);
        placeholder = actor;
      }

      this._recentButtons = new_recents;
    } else {
      for (var _i7 = 0; _i7 < this._recentButtons.length; _i7++) {
        this._recentButtons[_i7].destroy();
      }

      this._recentButtons = [];

      for (var _i8 = 0; _i8 < this._categoryButtons.length; _i8++) {
        if (this._categoryButtons[_i8] instanceof RecentCategoryButton) {
          this._categoryButtons[_i8].destroy();
          this._categoryButtons.splice(_i8, 1);
          this.recentButton = null;
          break;
        }
      }

      this._recentButtons = [];
    }

    this._setCategoriesButtonActive(!this.searchActive);

    this._recalc_height();
    this._resizeApplicationsBox();
    if (init) {
      setTimeout(function () {
        return _this4.initializing = false;
      }, 4000);
    }
  },

  _refreshApps: function _refreshApps() {
    var _this5 = this;

    /* iterate in reverse, so multiple splices will not upset 
     * the remaining elements */
    for (var i = this._categoryButtons.length - 1; i > -1; i--) {
      if (this._categoryButtons[i] instanceof CategoryButton) {
        this._categoryButtons[i].destroy();
        this._categoryButtons.splice(i, 1);
      }
    }

    this.applicationsBox.destroy_all_children();
    this._applicationsButtons = [];
    this._transientButtons = [];
    this._applicationsButtonFromApp = {};
    this._applicationsBoxWidth = 0;

    this._allAppsCategoryButton = new CategoryButton(null);
    this._addEnterEvent(this._allAppsCategoryButton, Lang.bind(this, function () {
      if (!this.searchActive) {
        this._allAppsCategoryButton.isHovered = true;
        this._clearPrevCatSelection(this._allAppsCategoryButton.actor);
        this._allAppsCategoryButton.actor.style_class = 'menu-category-button-selected';
        this._select_category(null, this._allAppsCategoryButton);
        this.makeVectorBox(this._allAppsCategoryButton.actor);
      }
    }));
    this._allAppsCategoryButton.actor.connect('leave-event', Lang.bind(this, function () {
      this._previousSelectedActor = this._allAppsCategoryButton.actor;
      this._allAppsCategoryButton.isHovered = false;
    }));
    this.categoriesBox.add_actor(this._allAppsCategoryButton.actor);

    var trees = [appsys.get_tree()];

    var handleEnterEvent = function handleEnterEvent(categoryButton, dir) {
      _this5._addEnterEvent(categoryButton, function () {
        if (!_this5.searchActive) {
          categoryButton.isHovered = true;
          _this5._clearPrevCatSelection(categoryButton.actor);
          categoryButton.actor.style_class = 'menu-category-button-selected';
          _this5._select_category(dir, categoryButton);
          _this5.makeVectorBox(categoryButton.actor);
        }
      });
    };

    var handleLeaveEvent = function handleLeaveEvent(categoryButton) {
      categoryButton.actor.connect('leave-event', Lang.bind(_this5, function () {
        if (this._previousTreeSelectedActor === null) {
          this._previousTreeSelectedActor = categoryButton.actor;
        } else {
          var prevIdx = this.catBoxIter.getVisibleIndex(this._previousTreeSelectedActor);
          var nextIdx = this.catBoxIter.getVisibleIndex(categoryButton.actor);
          if (Math.abs(prevIdx - nextIdx) <= 1) {
            this._previousTreeSelectedActor = categoryButton.actor;
          }
        }
        categoryButton.isHovered = false;
      }));
    };

    var sortDirs = function sortDirs(dirs) {
      dirs.sort(function (a, b) {
        var prefCats = ['administration', 'preferences'];
        var menuIdA = a.get_menu_id().toLowerCase();
        var menuIdB = b.get_menu_id().toLowerCase();

        var prefIdA = prefCats.indexOf(menuIdA);
        var prefIdB = prefCats.indexOf(menuIdB);

        if (prefIdA < 0 && prefIdB >= 0) {
          return -1;
        }
        if (prefIdA >= 0 && prefIdB < 0) {
          return 1;
        }

        var nameA = a.get_name().toLowerCase();
        var nameB = b.get_name().toLowerCase();

        if (nameA > nameB) {
          return 1;
        }
        if (nameA < nameB) {
          return -1;
        }
        return 0;
      });
      return dirs;
    };

    for (var _i9 = 0, len = trees.length; _i9 < len; _i9++) {
      var tree = trees[_i9];
      var root = tree.get_root_directory();
      var dirs = [];
      var iter = root.iter();
      var nextType = void 0;

      while ((nextType = iter.next()) != CMenu.TreeItemType.INVALID) {
        if (nextType == CMenu.TreeItemType.DIRECTORY) {
          dirs.push(iter.get_directory());
        }
      }

      dirs = sortDirs(dirs);

      for (var _i10 = 0, _len4 = dirs.length; _i10 < _len4; _i10++) {
        var dir = dirs[_i10];
        if (dir.get_is_nodisplay()) {
          continue;
        }
        if (this._loadCategory(dir)) {
          var categoryButton = new CategoryButton(dir, this.showCategoryIcons);

          handleEnterEvent(categoryButton, dir);

          handleLeaveEvent(categoryButton);

          this.categoriesBox.add_actor(categoryButton.actor);
        }
      }
    }
    // Sort apps and add to applicationsBox
    this._applicationsButtons.sort(function (a, b) {
      a = Util.latinise(a.app.get_name().toLowerCase());
      b = Util.latinise(b.app.get_name().toLowerCase());
      return a > b;
    });

    for (var _i11 = 0, _len5 = this._applicationsButtons.length; _i11 < _len5; _i11++) {
      this.applicationsBox.add_actor(this._applicationsButtons[_i11].actor);
      this.applicationsBox.add_actor(this._applicationsButtons[_i11].menu.actor);
    }

    this._appsWereRefreshed = true;
  },

  _favEnterEvent: function _favEnterEvent(button) {
    button.actor.add_style_pseudo_class('hover');

    if (this.appInfoPosition === 'none') {
      return;
    }
    if (button instanceof FavoritesButton) {
      this.selectedAppTitle.set_text(button.app.get_name());
      if (button.app.get_description()) {
        this.selectedAppDescription.set_text(button.app.get_description().split('\n')[0]);
      } else {
        this.selectedAppDescription.set_text('');
      }
    } else {
      this.selectedAppTitle.set_text(button.name);
      this.selectedAppDescription.set_text(button.desc);
    }
  },

  _favLeaveEvent: function _favLeaveEvent(widget, event, button) {
    this._previousSelectedActor = button.actor;
    button.actor.remove_style_pseudo_class('hover');

    if (this.appInfoPosition === 'none') {
      return;
    }
    this.selectedAppTitle.set_text('');
    this.selectedAppDescription.set_text('');
  },

  _refreshFavs: function _refreshFavs() {
    //Remove all favorites
    this.favoritesBox.destroy_all_children();

    //Load favorites again
    this._favoritesButtons = [];
    var launchers = global.settings.get_strv('favorite-apps');
    var appSys = Cinnamon.AppSystem.get_default();
    var j = 0;
    for (var i = 0, len = launchers.length; i < len; i++) {
      var app = appSys.lookup_app(launchers[i]);
      if (app) {
        var _button3 = new FavoritesButton(this, app, launchers.length + 3); // + 3 because we're adding 3 system buttons at the bottom
        this._favoritesButtons[app] = _button3;
        this.favoritesBox.add_actor(_button3.actor, {
          y_align: St.Align.END,
          y_fill: false
        });

        this._addEnterEvent(_button3, Lang.bind(this, this._favEnterEvent, _button3));
        _button3.actor.connect('leave-event', Lang.bind(this, this._favLeaveEvent, _button3));

        ++j;
      }
    }

    //Separator
    if (launchers.length !== 0) {
      var separator = new PopupMenu.PopupSeparatorMenuItem();
      this.favoritesBox.add_actor(separator.actor, {
        y_align: St.Align.END,
        y_fill: false
      });
    }

    //Lock screen
    var button = new SystemButton(this, 'system-lock-screen', launchers.length + 3, _('Lock screen'), _('Lock the screen'));

    this._addEnterEvent(button, Lang.bind(this, this._favEnterEvent, button));
    button.actor.connect('leave-event', Lang.bind(this, this._favLeaveEvent, button));

    button.activate = Lang.bind(this, function () {
      this.menu.close();

      var screensaver_settings = new Gio.Settings({
        schema_id: 'org.cinnamon.desktop.screensaver'
      });
      var screensaver_dialog = Gio.file_new_for_path('/usr/bin/cinnamon-screensaver-command');
      if (screensaver_dialog.query_exists(null)) {
        if (screensaver_settings.get_boolean('ask-for-away-message')) {
          Util.spawnCommandLine('cinnamon-screensaver-lock-dialog');
        } else {
          Util.spawnCommandLine('cinnamon-screensaver-command --lock');
        }
      } else {
        this._screenSaverProxy.LockRemote('');
      }
    });

    this.favoritesBox.add_actor(button.actor, {
      y_align: St.Align.END,
      y_fill: false
    });

    //Logout button
    button = new SystemButton(this, 'system-log-out', launchers.length + 3, _('Logout'), _('Leave the session'));

    this._addEnterEvent(button, Lang.bind(this, this._favEnterEvent, button));
    button.actor.connect('leave-event', Lang.bind(this, this._favLeaveEvent, button));

    button.activate = Lang.bind(this, function () {
      this.menu.close();
      this._session.LogoutRemote(0);
    });

    this.favoritesBox.add_actor(button.actor, {
      y_align: St.Align.END,
      y_fill: false
    });

    //Shutdown button
    button = new SystemButton(this, 'system-shutdown', launchers.length + 3, _('Quit'), _('Shutdown the computer'));

    this._addEnterEvent(button, Lang.bind(this, this._favEnterEvent, button));
    button.actor.connect('leave-event', Lang.bind(this, this._favLeaveEvent, button));

    button.activate = Lang.bind(this, function () {
      this.menu.close();
      this._session.ShutdownRemote();
    });

    this.favoritesBox.add_actor(button.actor, {
      y_align: St.Align.END,
      y_fill: false
    });

    this._recalc_height();
  },

  _loadCategory: function _loadCategory(dir, top_dir) {
    var _this6 = this;

    var iter = dir.iter();
    var has_entries = false;
    var nextType;
    if (!top_dir) {
      top_dir = dir;
    }

    var handleCategoryEvents = function handleCategoryEvents(applicationButton) {
      applicationButton.actor.connect('leave-event', function (a, b) {
        return _this6._appLeaveEvent(a, b, applicationButton);
      });
      _this6._addEnterEvent(applicationButton, function () {
        return _this6._appEnterEvent(applicationButton);
      });
    };

    while ((nextType = iter.next()) != CMenu.TreeItemType.INVALID) {
      if (nextType == CMenu.TreeItemType.ENTRY) {
        var entry = iter.get_entry();
        if (!entry.get_app_info().get_nodisplay()) {
          has_entries = true;
          var app = appsys.lookup_app_by_tree_entry(entry);
          if (!app) {
            app = appsys.lookup_settings_app_by_tree_entry(entry);
          }
          var app_key = app.get_id();
          if (app_key === null) {
            app_key = app.get_name() + ':' + app.get_description();
          }
          if (!(app_key in this._applicationsButtonFromApp)) {

            var applicationButton = new ApplicationButton(this, app, this.showApplicationIcons);

            var app_is_known = false;
            for (var i = 0, len = this._knownApps.length; i < len; i++) {
              if (this._knownApps[i] == app_key) {
                app_is_known = true;
              }
            }
            if (!app_is_known) {
              if (this._appsWereRefreshed) {
                applicationButton.highlight();
              } else {
                this._knownApps.push(app_key);
              }
            }

            handleCategoryEvents(applicationButton);

            this._applicationsButtons.push(applicationButton);
            applicationButton.category.push(top_dir.get_menu_id());
            this._applicationsButtonFromApp[app_key] = applicationButton;
          } else {
            this._applicationsButtonFromApp[app_key].category.push(dir.get_menu_id());
          }
        }
      } else if (nextType == CMenu.TreeItemType.DIRECTORY) {
        var subdir = iter.get_directory();
        if (this._loadCategory(subdir, top_dir)) {
          has_entries = true;
        }
      }
    }
    return has_entries;
  },

  _appLeaveEvent: function _appLeaveEvent(a, b, applicationButton) {
    this._previousSelectedActor = applicationButton.actor;
    applicationButton.actor.style_class = 'menu-application-button';

    if (this.appInfoPosition === 'none') {
      return;
    }
    this.selectedAppTitle.set_text('');
    this.selectedAppDescription.set_text('');
  },

  _appEnterEvent: function _appEnterEvent(applicationButton) {
    this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(applicationButton.actor);
    this._clearPrevSelection(applicationButton.actor);
    applicationButton.actor.style_class = 'menu-application-button-selected';

    if (this.appInfoPosition === 'none') {
      return;
    }
    this.selectedAppTitle.set_text(applicationButton.app.get_name());
    if (applicationButton.app.get_description()) {
      this.selectedAppDescription.set_text(applicationButton.app.get_description());
    } else {
      this.selectedAppDescription.set_text('');
    }
  },

  _scrollToButton: function _scrollToButton(button) {
    var current_scroll_value = this.applicationsScrollBox.get_vscroll_bar().get_adjustment().get_value();
    var box_height = this.applicationsScrollBox.get_allocation_box().y2 - this.applicationsScrollBox.get_allocation_box().y1;
    var new_scroll_value = current_scroll_value;
    if (current_scroll_value > button.actor.get_allocation_box().y1 - 10) {
      new_scroll_value = button.actor.get_allocation_box().y1 - 10;
    }
    if (box_height + current_scroll_value < button.actor.get_allocation_box().y2 + 10) {
      new_scroll_value = button.actor.get_allocation_box().y2 - box_height + 10;
    }
    if (new_scroll_value != current_scroll_value) {
      this.applicationsScrollBox.get_vscroll_bar().get_adjustment().set_value(new_scroll_value);
    }
  },

  _display: function _display() {
    var _this7 = this;

    this._activeContainer = null;
    this._activeActor = null;
    this.vectorBox = null;
    this.actor_motion_id = 0;
    this.vector_update_loop = null;
    this.current_motion_actor = null;
    var section = new PopupMenu.PopupMenuSection();
    this.menu.addMenuItem(section);

    this.leftPane = new St.BoxLayout({
      vertical: false
    });

    this.leftBox = new St.BoxLayout({
      style_class: 'menu-favorites-box',
      vertical: false
    });

    this._session = new GnomeSession.SessionManager();
    this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();

    this.leftPane.add_actor(this.leftBox, {
      y_align: St.Align.END,
      y_fill: false
    });
    this._favboxtoggle();

    var rightPane = new St.BoxLayout({
      vertical: true
    });

    if (this.appInfoPosition !== 'none') {
      this.selectedAppTitle = new St.Label({
        style_class: 'menu-selected-app-title',
        text: '',
        style: this.appInfoPosition === 'bottom' ? 'padding-top: 4px;' : 'padding-left: 22px;'
      });
      this.selectedAppDescription = new St.Label({
        style_class: 'menu-selected-app-description',
        text: '',
        style: this.appInfoPosition === 'top' ? 'padding-left: 22px;' : null
      });

      if (this.appInfoPosition === 'top') {
        rightPane.add_actor(this.selectedAppTitle);
        rightPane.add_actor(this.selectedAppDescription);
      }
    }

    this.searchActive = false;

    if (this.searchPosition !== 'none') {
      this.searchBox = new St.BoxLayout({
        style_class: 'menu-search-box'
      });

      if (this.searchPosition === 'top') {
        rightPane.add_actor(this.searchBox);
      }

      this.searchEntry = new St.Entry({
        name: 'menu-search-entry',
        hint_text: _('Type to search...'),
        track_hover: true,
        can_focus: true
      });
      this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
      this.searchBox.add_actor(this.searchEntry);
      this.searchEntryText = this.searchEntry.clutter_text;
      this.searchEntryText.connect('text-changed', function (se, prop) {
        return _this7._onSearchTextChanged(se, prop);
      });
      this.searchEntryText.connect('key-press-event', function (actor, event) {
        return _this7._onMenuKeyPress(actor, event);
      });
      this._previousSearchPattern = '';
    }

    this.categoriesApplicationsBox = new CategoriesApplicationsBox();
    rightPane.add_actor(this.categoriesApplicationsBox.actor);
    this.categoriesBox = new St.BoxLayout({
      style_class: 'menu-categories-box',
      vertical: true,
      accessible_role: Atk.Role.LIST
    });
    this.applicationsScrollBox = new St.ScrollView({
      x_fill: true,
      y_fill: false,
      y_align: St.Align.START,
      style_class: 'vfade menu-applications-scrollbox'
    });

    var appScrollBoxWidth = this.favBoxShow ? this.menuWidth : this.menuWidth + 55;
    this.applicationsScrollBox.set_width(appScrollBoxWidth);

    this.a11y_settings = new Gio.Settings({
      schema_id: 'org.cinnamon.desktop.a11y.applications'
    });
    this.a11y_settings.connect('changed::screen-magnifier-enabled', function () {
      return _this7._updateVFade();
    });
    this.a11y_mag_settings = new Gio.Settings({
      schema_id: 'org.cinnamon.desktop.a11y.magnifier'
    });
    this.a11y_mag_settings.connect('changed::mag-factor', function () {
      return _this7._updateVFade();
    });

    this._updateVFade();

    if (typeof this.settings.bind === 'function') {
      this.settings.bind('enable-autoscroll', 'autoscroll_enabled', this._update_autoscroll);
    } else {
      this.settings.bindProperty(Settings.BindingDirection.IN, 'enable-autoscroll', 'autoscroll_enabled', this._update_autoscroll, null);
    }
    this._update_autoscroll();

    var vscroll = this.applicationsScrollBox.get_vscroll_bar();
    vscroll.connect('scroll-start', function () {
      _this7.menu.passEvents = true;
    });
    vscroll.connect('scroll-stop', function () {
      _this7.menu.passEvents = false;
    });

    this.applicationsBox = new St.BoxLayout({
      style_class: 'menu-applications-inner-box',
      vertical: true
    });
    this.applicationsBox.add_style_class_name('menu-applications-box'); //this is to support old themes
    this.applicationsScrollBox.add_actor(this.applicationsBox);
    this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType[this.showScrollbar ? 'AUTOMATIC' : 'NEVER']);
    this.categoriesApplicationsBox.actor.add_actor(this.categoriesBox);
    this.categoriesApplicationsBox.actor.add_actor(this.applicationsScrollBox);

    var fav_obj = new FavoritesBox();
    this.favoritesBox = fav_obj.actor;
    this.leftBox.add_actor(this.favoritesBox, {
      y_align: St.Align.END,
      y_fill: false
    });

    this.mainBox = new St.BoxLayout({
      style_class: 'menu-applications-outer-box',
      vertical: false
    });
    this.mainBox.add_style_class_name('menu-applications-box'); //this is to support old themes

    this.mainBox.add_actor(this.leftPane, {
      span: 1
    });
    this.mainBox.add_actor(rightPane, {
      span: 1
    });

    section.actor.add_actor(this.mainBox);

    this.selectedAppBox = new St.BoxLayout({
      style_class: 'menu-selected-app-box',
      vertical: true
    });

    if (this.selectedAppBox.peek_theme_node() === null || this.selectedAppBox.get_theme_node().get_length('height') === 0) {
      var appBoxHeight = this.searchPosition === 'bottom' && this.appInfoPosition !== 'none' ? 60 : this.appInfoPosition !== 'bottom' && this.searchPosition !== 'bottom' ? 0 : 30;
      this.selectedAppBox.set_height(appBoxHeight * global.ui_scale);
    }

    if (this.appInfoPosition === 'bottom') {
      this.selectedAppBox.add_actor(this.selectedAppTitle);
      this.selectedAppBox.add_actor(this.selectedAppDescription);
    }

    if (this.searchPosition === 'bottom') {
      this.searchBox.style = 'padding-left: ' + (this.menuWidth - 96) + 'px; padding-top: 4px;';
      this.selectedAppBox.add_actor(this.searchBox);
    }

    section.actor.add_actor(this.selectedAppBox);
    this.appBoxIter = new VisibleChildIterator(this.applicationsBox);
    this.applicationsBox._vis_iter = this.appBoxIter;
    this.catBoxIter = new VisibleChildIterator(this.categoriesBox);
    this.categoriesBox._vis_iter = this.catBoxIter;
    this.favBoxIter = new VisibleChildIterator(this.favoritesBox);
    this.favoritesBox._vis_iter = this.favBoxIter;
    Mainloop.idle_add(function () {
      _this7._clearAllSelections(true);
    });
  },

  _updateVFade: function _updateVFade() {
    var mag_on = this.a11y_settings.get_boolean('screen-magnifier-enabled') && this.a11y_mag_settings.get_double('mag-factor') > 1.0;
    if (mag_on) {
      this.applicationsScrollBox.style_class = 'menu-applications-scrollbox';
    } else {
      this.applicationsScrollBox.style_class = 'vfade menu-applications-scrollbox';
    }
  },

  _update_autoscroll: function _update_autoscroll() {
    this.applicationsScrollBox.set_auto_scrolling(this.autoscroll_enabled);
  },

  _clearAllSelections: function _clearAllSelections(hide_apps) {
    var actors = this.applicationsBox.get_children();
    for (var i = 0, len = actors.length; i < len; i++) {
      var actor = actors[i];
      actor.style_class = 'menu-application-button';
      if (hide_apps) {
        actor.hide();
      }
    }
    actors = this.categoriesBox.get_children();
    for (var _i12 = 0, _len6 = actors.length; _i12 < _len6; _i12++) {
      var _actor = actors[_i12];
      _actor.style_class = 'menu-category-button';
      _actor.show();
    }
    actors = this.favoritesBox.get_children();
    for (var _i13 = 0, _len7 = actors.length; _i13 < _len7; _i13++) {
      var _actor2 = actors[_i13];
      _actor2.remove_style_pseudo_class('hover');
      _actor2.show();
    }
  },

  _select_category: function _select_category(dir, categoryButton) {
    if (dir) {
      this._displayButtons(this._listApplications(dir.get_menu_id()));
    } else {
      this._displayButtons(this._listApplications(null));
    }
    this.closeContextMenus(null, false);
  },

  closeContextMenus: function closeContextMenus(excluded, animate) {
    for (var app in this._applicationsButtons) {
      // TBD
      if (app != excluded && this._applicationsButtons[app].menu.isOpen) {
        if (animate) {
          this._applicationsButtons[app].toggleMenu();
        } else {
          this._applicationsButtons[app].closeMenu();
        }
      }
    }

    if (excluded != this._activeContextMenuItem) {
      if (this.recentContextMenu && this.recentContextMenu.isOpen) {
        if (animate) {
          this.recentContextMenu.sourceActor._delegate.toggleMenu();
        } else {
          this.recentContextMenu.sourceActor._delegate.closeMenu();
        }
      }
    }
  },

  _resize_actor_iter: function _resize_actor_iter(actor) {
    var _actor$get_preferred_ = actor.get_preferred_width(-1.0),
        _actor$get_preferred_2 = _slicedToArray(_actor$get_preferred_, 2),
        min = _actor$get_preferred_2[0],
        nat = _actor$get_preferred_2[1];

    if (nat > this._applicationsBoxWidth) {
      this._applicationsBoxWidth = nat;
      this.applicationsBox.set_width(this._applicationsBoxWidth + 42); // The answer to life...
    }
  },

  _resizeApplicationsBox: function _resizeApplicationsBox() {
    this._applicationsBoxWidth = 0;
    this.applicationsBox.set_width(-1);
    var child = this.applicationsBox.get_first_child();
    this._resize_actor_iter(child);

    while ((child = child.get_next_sibling()) !== null) {
      this._resize_actor_iter(child);
    }
  },

  _displayButtons: function _displayButtons(appCategory, places, recent, apps, autocompletes) {
    if (appCategory) {
      if (appCategory == 'all') {
        for (var i = 0, len = this._applicationsButtons.length; i < len; i++) {
          this._applicationsButtons[i].actor.show();
        }
      } else {
        for (var _i14 = 0, _len8 = this._applicationsButtons.length; _i14 < _len8; _i14++) {
          if (this._applicationsButtons[_i14].category.indexOf(appCategory) != -1) {
            this._applicationsButtons[_i14].actor.show();
          } else {
            this._applicationsButtons[_i14].actor.hide();
          }
        }
      }
    } else if (apps) {
      for (var _i15 = 0, _len9 = this._applicationsButtons.length; _i15 < _len9; _i15++) {
        if (apps.indexOf(this._applicationsButtons[_i15].app.get_id()) != -1) {
          this._applicationsButtons[_i15].actor.show();
        } else {
          this._applicationsButtons[_i15].actor.hide();
        }
      }
    } else {
      for (var _i16 = 0, _len10 = this._applicationsButtons.length; _i16 < _len10; _i16++) {
        this._applicationsButtons[_i16].actor.hide();
      }
    }
    if (places) {
      if (places == -1) {
        for (var _i17 = 0, _len11 = this._placesButtons.length; _i17 < _len11; _i17++) {
          this._placesButtons[_i17].actor.show();
        }
      } else {
        for (var _i18 = 0, _len12 = this._placesButtons.length; _i18 < _len12; _i18++) {
          if (places.indexOf(this._placesButtons[_i18].button_name) !== -1) {
            this._placesButtons[_i18].actor.show();
          } else {
            this._placesButtons[_i18].actor.hide();
          }
        }
      }
    } else {
      for (var _i19 = 0, _len13 = this._placesButtons.length; _i19 < _len13; _i19++) {
        this._placesButtons[_i19].actor.hide();
      }
    }
    if (recent) {
      if (recent === -1) {
        for (var _i20 = 0, _len14 = this._recentButtons.length; _i20 < _len14; _i20++) {
          this._recentButtons[_i20].actor.show();
        }
      } else {
        for (var _i21 = 0, _len15 = this._recentButtons.length; _i21 < _len15; _i21++) {
          if (recent.indexOf(this._recentButtons[_i21].button_name) != -1) {
            this._recentButtons[_i21].actor.show();
          } else {
            this._recentButtons[_i21].actor.hide();
          }
        }
      }
    } else {
      for (var _i22 = 0, _len16 = this._recentButtons.length; _i22 < _len16; _i22++) {
        this._recentButtons[_i22].actor.hide();
      }
    }
    if (autocompletes) {
      for (var _i23 = 0, _len17 = this._transientButtons.length; _i23 < _len17; _i23++) {
        this._transientButtons[_i23].actor.destroy();
      }
      this._transientButtons = [];

      for (var _i24 = 0, _len18 = autocompletes.length; _i24 < _len18; _i24++) {
        var button = new TransientButton(this, autocompletes[_i24]);
        button.actor.connect('leave-event', Lang.bind(this, this._appLeaveEvent, button));
        this._addEnterEvent(button, Lang.bind(this, this._appEnterEvent, button));
        this._transientButtons.push(button);
        this.applicationsBox.add_actor(button.actor);
        button.actor.realize();
      }
    }

    for (var _i25 = 0, _len19 = this._searchProviderButtons.length; _i25 < _len19; _i25++) {
      if (this._searchProviderButtons[_i25].actor.visible) {
        this._searchProviderButtons[_i25].actor.hide();
      }
    }
  },

  _setCategoriesButtonActive: function _setCategoriesButtonActive(active) {
    try {
      var categoriesButtons = this.categoriesBox.get_children();
      for (var i = 0, len = categoriesButtons.length; i < len; i++) {
        if (active) {
          categoriesButtons[i].set_style_class_name('menu-category-button');
        } else {
          categoriesButtons[i].set_style_class_name('menu-category-button-greyed');
        }
      }
    } catch (e) {
      global.log(e);
    }
  },

  resetSearch: function resetSearch() {
    this.searchEntry.set_text('');
    this._previousSearchPattern = '';
    this.searchActive = false;
    this._clearAllSelections(true);
    this._setCategoriesButtonActive(true);
    global.stage.set_key_focus(this.searchEntry);
  },

  _onSearchTextChanged: function _onSearchTextChanged(se, prop) {
    var _this8 = this;

    if (this.menuIsOpening) {
      this.menuIsOpening = false;
      return;
    } else {
      var searchString = this.searchEntry.get_text();
      if (searchString === '' && !this.searchActive) {
        return;
      }
      this.searchActive = searchString !== '';
      this._fileFolderAccessActive = this.searchActive && this.searchFilesystem;
      this._clearAllSelections();

      if (this.searchActive) {
        this.searchEntry.set_secondary_icon(this._searchActiveIcon);
        if (this._searchIconClickedId === 0) {
          this._searchIconClickedId = this.searchEntry.connect('secondary-icon-clicked', function () {
            _this8.resetSearch();
            _this8._select_category(null, _this8._allAppsCategoryButton);
          });
        }
        this._setCategoriesButtonActive(false);
        this._doSearch();
      } else {
        if (this._searchIconClickedId > 0) {
          this.searchEntry.disconnect(this._searchIconClickedId);
        }
        this._searchIconClickedId = 0;
        this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
        this._previousSearchPattern = '';
        this._setCategoriesButtonActive(true);
        this._select_category(null, this._allAppsCategoryButton);
        this._allAppsCategoryButton.actor.style_class = 'menu-category-button-selected';
        this._activeContainer = null;

        if (this.appInfoPosition !== 'none') {
          this.selectedAppTitle.set_text('');
          this.selectedAppDescription.set_text('');
        }
      }
      return;
    }
  },

  _listBookmarks: function _listBookmarks(pattern) {
    var bookmarks = Main.placesManager.getBookmarks();
    var res = [];
    for (var i = 0, len = bookmarks.length; i < len; i++) {
      if (!pattern || bookmarks[i].name.toLowerCase().indexOf(pattern) !== -1) {
        res.push(bookmarks[i]);
      }
    }
    return res;
  },

  _listDevices: function _listDevices(pattern) {
    var devices = Main.placesManager.getMounts();
    var res = [];
    for (var i = 0, len = devices.length; i < len; i++) {
      if (!pattern || devices[i].name.toLowerCase().indexOf(pattern) !== -1) {
        res.push(devices[i]);
      }
    }
    return res;
  },

  _listApplications: function _listApplications(category_menu_id, pattern) {
    var applist = [];
    if (category_menu_id) {
      applist = category_menu_id;
    } else {
      applist = 'all';
    }
    if (pattern) {
      var res = [];
      for (var i = 0, len = this._applicationsButtons.length; i < len; i++) {
        var app = this._applicationsButtons[i].app;
        if (kmp(Util.latinise(app.get_name().toLowerCase()), pattern) !== -1) {
          res.push(app.get_id());
        }
      }
    } else {
      res = applist;
    }
    return res;
  },

  _doSearch: function _doSearch() {
    var _this9 = this;

    this._searchTimeoutId = 0;
    var pattern = this.searchEntryText.get_text().replace(/^\s+/g, '').replace(/\s+$/g, '').toLowerCase();
    pattern = Util.latinise(pattern);
    if (pattern == this._previousSearchPattern) {
      return false;
    }
    this._previousSearchPattern = pattern;
    this._activeContainer = null;
    this._activeActor = null;
    this._selectedItemIndex = null;
    this._previousTreeSelectedActor = null;
    this._previousSelectedActor = null;

    // _listApplications returns all the applications when the search
    // string is zero length. This will happened if you type a space
    // in the search entry.
    if (pattern.length === 0) {
      return false;
    }

    var appResults = this._listApplications(null, pattern);
    var placesResults = [];
    var bookmarks = this._listBookmarks(pattern);
    for (var i = 0, len = bookmarks.length; i < len; i++) {
      placesResults.push(bookmarks[i].name);
    }
    var devices = this._listDevices(pattern);
    for (var _i26 = 0, _len20 = devices.length; _i26 < _len20; _i26++) {
      placesResults.push(devices[_i26].name);
    }
    var recentResults = [];
    for (var _i27 = 0, _len21 = this._recentButtons.length; _i27 < _len21; _i27++) {
      if (!(this._recentButtons[_i27] instanceof RecentClearButton) && this._recentButtons[_i27].button_name.toLowerCase().indexOf(pattern) != -1) {
        recentResults.push(this._recentButtons[_i27].button_name);
      }
    }

    var acResults = []; // search box autocompletion results
    if (this.searchFilesystem) {
      // Don't use the pattern here, as filesystem is case sensitive
      acResults = this._getCompletions(this.searchEntryText.get_text());
    }

    this._displayButtons(null, placesResults, recentResults, appResults, acResults);

    this.appBoxIter.reloadVisible();
    if (this.appBoxIter.getNumVisibleChildren() > 0) {
      var item_actor = this.appBoxIter.getFirstVisible();
      this._selectedItemIndex = this.appBoxIter.getAbsoluteIndexOfChild(item_actor);
      this._activeContainer = this.applicationsBox;
      if (item_actor && item_actor !== this.searchEntry) {
        item_actor._delegate.emit('enter-event');
      }
    } else {
      if (this.appInfoPosition !== 'none') {
        this.selectedAppTitle.set_text('');
        this.selectedAppDescription.set_text('');
      }
    }

    var handleAddSearchEvents = function handleAddSearchEvents(button) {
      button.actor.connect('leave-event', function (a, b) {
        return _this9._appLeaveEvent(a, b, button);
      });
      _this9._addEnterEvent(button, function () {
        return _this9._appEnterEvent(button);
      });
    };

    SearchProviderManager.launch_all(pattern, Lang.bind(this, function (provider, results) {
      try {
        for (var _i28 = 0, _len22 = results.length; _i28 < _len22; _i28++) {
          if (results[_i28].type !== 'software') {
            var button = new SearchProviderResultButton(this, provider, results[_i28]);

            handleAddSearchEvents(button);

            this._searchProviderButtons.push(button);
            this.applicationsBox.add_actor(button.actor);
            button.actor.realize();
          }
        }
      } catch (e) {
        global.log(e);
      }
    }));

    return false;
  },

  _getCompletion: function _getCompletion(text) {
    if (text.indexOf('/') !== -1) {
      if (text.substr(text.length - 1) === '/') {
        return '';
      } else {
        return this._pathCompleter.get_completion_suffix(text);
      }
    } else {
      return false;
    }
  },

  _getCompletions: function _getCompletions(text) {
    if (text.indexOf('/') !== -1) {
      return this._pathCompleter.get_completions(text);
    } else {
      return [];
    }
  },

  _run: function _run(input) {

    this._commandError = false;
    if (input) {
      var path = null;
      if (input.charAt(0) == '/') {
        path = input;
      } else {
        if (input.charAt(0) == '~') {
          input = input.slice(1);
        }
        path = GLib.get_home_dir() + '/' + input;
      }

      if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
        var file = Gio.file_new_for_path(path);
        try {
          Gio.app_info_launch_default_for_uri(file.get_uri(), global.create_app_launch_context());
        } catch (e) {
          // The exception from gjs contains an error string like:
          //     Error invoking Gio.app_info_launch_default_for_uri: No application
          //     is registered as handling this file
          // We are only interested in the part after the first colon.
          //let message = e.message.replace(/[^:]*: *(.+)/, '$1');
          return false;
        }
      } else {
        return false;
      }
    }

    return true;
  }
};

function main(metadata, orientation, panel_height, instance_id) {
  var myApplet = new MyApplet(orientation, panel_height, instance_id);
  return myApplet;
}