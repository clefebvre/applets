"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UI = void 0;
const uiCurrentWeather_1 = require("./uiCurrentWeather");
const logger_1 = require("./logger");
const utils_1 = require("./utils");
const uiForecasts_1 = require("./uiForecasts");
const uiHourlyForecasts_1 = require("./uiHourlyForecasts");
const uiBar_1 = require("./uiBar");
const { PopupMenuManager, PopupSeparatorMenuItem } = imports.ui.popupMenu;
const { BoxLayout, IconType, Label } = imports.gi.St;
const Lang = imports.lang;
const { AppletPopupMenu } = imports.ui.applet;
const { themeManager } = imports.ui.main;
const { SignalManager } = imports.misc.signalManager;
const STYLE_WEATHER_MENU = 'weather-menu';
class UI {
    constructor(app, orientation) {
        this.lightTheme = false;
        this.App = app;
        this.menuManager = new PopupMenuManager(this.App);
        this.menu = new AppletPopupMenu(this.App, orientation);
        this.menu.box.add_style_class_name(STYLE_WEATHER_MENU);
        logger_1.Log.Instance.Debug("Popup Menu applied classes are: " + this.menu.box.get_style_class_name());
        this.menuManager.addMenu(this.menu);
        this.menuManager._signals.connect(this.menu, "open-state-changed", this.PopupMenuToggled, this);
        this.signals = new SignalManager();
        this.lightTheme = this.IsLightTheme();
        this.BuildPopupMenu();
        this.signals.connect(themeManager, 'theme-set', this.OnThemeChanged, this);
    }
    ShowHourlyWeather() {
        this.HourlyWeather.Show();
        this._separatorAreaHourly.actor.show();
        this.Bar.SwitchButtonToHide();
    }
    HideHourlyWeather() {
        this.HourlyWeather.Hide();
        this._separatorAreaHourly.actor.hide();
        this.Bar.SwitchButtonToShow();
    }
    ToggleHourlyWeather() {
        if (this.HourlyWeather.Toggled) {
            this.HideHourlyWeather();
        }
        else {
            this.ShowHourlyWeather();
        }
    }
    OnThemeChanged() {
        this.HideHourlyWeather();
        let newThemeIsLight = this.IsLightTheme();
        if (newThemeIsLight != this.lightTheme) {
            this.lightTheme = newThemeIsLight;
        }
        this.App.RefreshAndRebuild();
    }
    IsLightTheme() {
        let color = this.menu.actor.get_theme_node().get_color("color");
        let luminance = (2126 * color.red + 7152 * color.green + 722 * color.blue) / 10000 / 255;
        luminance = Math.abs(1 - luminance);
        logger_1.Log.Instance.Debug("Theme is Light: " + (luminance > 0.5));
        return (luminance > 0.5);
    }
    ForegroundColor() {
        let hex = this.menu.actor.get_theme_node().get_foreground_color().to_string().substring(0, 7);
        return hex;
    }
    GetTextColorStyle() {
        let hexColor = null;
        if (this.lightTheme) {
            hexColor = utils_1.shadeHexColor(this.ForegroundColor(), -0.40);
        }
        return "color: " + hexColor;
    }
    async PopupMenuToggled(caller, data) {
        if (data == false) {
            await utils_1.delay(100);
            this.HideHourlyWeather();
        }
    }
    BuildPopupMenu() {
        this.CurrentWeather = new uiCurrentWeather_1.CurrentWeather(this.App, this);
        this.FutureWeather = new uiForecasts_1.UIForecasts(this.App);
        this.HourlyWeather = new uiHourlyForecasts_1.UIHourlyForecasts(this.App, this.menu);
        this.Bar = new uiBar_1.UIBar(this.App);
        this.Bar.ToggleClicked.Subscribe(Lang.bind(this, this.ToggleHourlyWeather));
        this._separatorArea = new PopupSeparatorMenuItem();
        this._separatorAreaHourly = new PopupSeparatorMenuItem();
        this._separatorArea2 = new PopupSeparatorMenuItem();
        this._separatorArea.actor.remove_style_class_name("popup-menu-item");
        this._separatorAreaHourly.actor.remove_style_class_name("popup-menu-item");
        this._separatorArea2.actor.remove_style_class_name("popup-menu-item");
        this._separatorAreaHourly.actor.hide();
        let mainBox = new BoxLayout({ vertical: true });
        mainBox.add_actor(this.CurrentWeather.actor);
        mainBox.add_actor(this._separatorAreaHourly.actor);
        mainBox.add_actor(this.HourlyWeather.actor);
        mainBox.add_actor(this._separatorArea.actor);
        mainBox.add_actor(this.FutureWeather.actor);
        mainBox.add_actor(this._separatorArea2.actor);
        mainBox.add_actor(this.Bar.Actor);
        this.menu.addActor(mainBox);
    }
    Toggle() {
        this.menu.toggle();
    }
    Rebuild(config) {
        this.ShowLoadingUi();
        this.CurrentWeather.Rebuild(config, this.GetTextColorStyle());
        this.HourlyWeather.Rebuild(config, this.GetTextColorStyle());
        this.FutureWeather.Rebuild(config, this.GetTextColorStyle());
        this.Bar.Rebuild(config);
    }
    UpdateIconType(iconType) {
        if (iconType == IconType.FULLCOLOR && this.App.config._useCustomMenuIcons)
            return;
        this.CurrentWeather.UpdateIconType(iconType);
        this.FutureWeather.UpdateIconType(iconType);
        this.HourlyWeather.UpdateIconType(iconType);
    }
    DisplayErrorMessage(msg) {
        this.Bar.DisplayErrorMessage(msg);
    }
    Display(weather, config, provider) {
        this.CurrentWeather.Display(weather, config);
        this.FutureWeather.Display(weather, config);
        let shouldShowToggle = this.HourlyWeather.Display(weather.hourlyForecasts, config, weather.location.timeZone);
        this.Bar.Display(weather, provider, config, shouldShowToggle);
        return true;
    }
    ShowLoadingUi() {
        this.CurrentWeather.Destroy();
        this.FutureWeather.Destroy();
        this.Bar.Destroy();
        this.CurrentWeather.actor.set_child(new Label({
            text: utils_1._('Loading current weather ...')
        }));
        this.FutureWeather.actor.set_child(new Label({
            text: utils_1._('Loading future weather ...')
        }));
    }
}
exports.UI = UI;
