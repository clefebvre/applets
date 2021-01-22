import { Config } from "./config";
import { CurrentWeather } from "./uiCurrentWeather";
import { Log } from "./logger";
import { WeatherApplet } from "./main";
import { WeatherData, WeatherProvider } from "./types";
import { shadeHexColor, delay, _ } from "./utils";
import { UIForecasts } from "./uiForecasts";
import { UIHourlyForecasts } from "./uiHourlyForecasts";
import { UIBar } from "./uiBar";
import { UISeparator } from "./uiSeparator";

const { PopupMenuManager, PopupSeparatorMenuItem } = imports.ui.popupMenu;
const { BoxLayout, IconType, Label} = imports.gi.St;
const Lang: typeof imports.lang = imports.lang;
const { AppletPopupMenu } = imports.ui.applet;
const { themeManager } = imports.ui.main;
const { SignalManager } = imports.misc.signalManager;

// stylesheet.css
const STYLE_WEATHER_MENU = 'weather-menu'

/** Roll-down Popup Menu */
export class UI {
    // Separators
    private ForecastSeparator: UISeparator;
    private BarSeparator: UISeparator;
    private HourlySeparator: UISeparator;

    private CurrentWeather: CurrentWeather;
    private FutureWeather: UIForecasts;
    private HourlyWeather: UIHourlyForecasts;
    private Bar: UIBar;

    // State variables
    private lightTheme: boolean = false;

    private readonly App: WeatherApplet;

    /** Roll down menu itself */
    private readonly menu: imports.ui.applet.AppletPopupMenu;
    private readonly menuManager: imports.ui.popupMenu.PopupMenuManager;
    private readonly signals: imports.misc.signalManager.SignalManager;

    constructor(app: WeatherApplet, orientation: imports.gi.St.Side) {
        this.App = app;
        this.menuManager = new PopupMenuManager(this.App);
        this.menu = new AppletPopupMenu(this.App, orientation);
        // this.menu.setCustomStyleClass and 
        //this.menu.actor.add_style_class_name(STYLE_WEATHER_MENU);
        // Doesn't do shit, setting class on the box instead.
        this.menu.box.add_style_class_name(STYLE_WEATHER_MENU);
        Log.Instance.Debug("Popup Menu applied classes are: " + this.menu.box.get_style_class_name());
        this.menuManager.addMenu(this.menu);
        this.menuManager._signals.connect(this.menu, "open-state-changed", this.PopupMenuToggled, this);
        this.signals = new SignalManager();
        this.lightTheme = this.IsLightTheme();
        this.BuildPopupMenu();
        // Subscriptions
		this.signals.connect(themeManager, 'theme-set', this.OnThemeChanged, this); // on theme change
    }

    public ShowHourlyWeather(): void {
        this.HourlyWeather.Show();
        this.HourlySeparator.Show();
        this.Bar.SwitchButtonToHide();
    }

    public HideHourlyWeather(): void {
        this.HourlyWeather.Hide();
        this.HourlySeparator.Hide();
        this.Bar.SwitchButtonToShow();
    }

    public ToggleHourlyWeather(): void {
        if (this.HourlyWeather.Toggled) {
            this.HideHourlyWeather();
        }
        else {
            this.ShowHourlyWeather();
        }
    }

	/**
	 * Resetting flags from Hourly scrollview when theme changed to 
	 * prevent incorrect height requests, rebuild 
	 * when switching between light and dark themes
	 * to recolor some of the text
	 */
    private OnThemeChanged(): void {
        this.HideHourlyWeather();
        let newThemeIsLight = this.IsLightTheme();
        // Theme changed between light and dark theme
        if (newThemeIsLight != this.lightTheme) {
            this.lightTheme = newThemeIsLight;
        }
        this.App.RefreshAndRebuild();
    }

	/**
	 * 
	 * @param color Background color
	 */
    private IsLightTheme(): boolean {
        // using foreground color, more reliable than background color (more themes has it)
		let color = this.menu.actor.get_theme_node().get_color("color");
        // luminance between 0 and 1
		let luminance = (2126 * color.red + 7152 * color.green + 722 * color.blue) / 10000 / 255;
		// Inverse, we assume the background color here
		luminance = Math.abs(1 - luminance);
        Log.Instance.Debug("Theme is Light: " + (luminance > 0.5));
        return (luminance > 0.5);
    }

	/**
	 * @returns color in hex styling
	 */
    private ForegroundColor(): string {
        // Get hex color without alpha, because it is not supported in css
        let hex = this.menu.actor.get_theme_node().get_foreground_color().to_string().substring(0, 7);
        return hex;
    }

    private GetTextColorStyle(): string {
        let hexColor = null;
        if (this.lightTheme) {
            // Darken default foreground color
            hexColor = shadeHexColor(this.ForegroundColor(), -0.40);
        }
        return "color: " + hexColor;
    }

    private async PopupMenuToggled(caller: any, data: any) {
        // data - true is opened, false is closed
        if (data == false) {
            await delay(100); // Closing after popup menu is closed 
            this.HideHourlyWeather();
        }
	}

    /** Creates th skeleton of the popup menu */
    private BuildPopupMenu(): void {
        this.CurrentWeather = new CurrentWeather(this.App, this);
        this.FutureWeather = new UIForecasts(this.App);
        this.HourlyWeather = new UIHourlyForecasts(this.App, this.menu);
        this.Bar = new UIBar(this.App);
        this.Bar.ToggleClicked.Subscribe(Lang.bind(this, this.ToggleHourlyWeather));

        this.ForecastSeparator = new UISeparator();
        this.HourlySeparator = new UISeparator();
        this.BarSeparator = new UISeparator();        
        this.HourlySeparator.Hide();

        // Add everything to the PopupMenu
        let mainBox = new BoxLayout({ vertical: true })
        mainBox.add_actor(this.CurrentWeather.actor)
        mainBox.add_actor(this.HourlySeparator.Actor);
        mainBox.add_actor(this.HourlyWeather.actor);
        mainBox.add_actor(this.ForecastSeparator.Actor)
        mainBox.add_actor(this.FutureWeather.actor)
        mainBox.add_actor(this.BarSeparator.Actor)
        mainBox.add_actor(this.Bar.Actor)
        this.menu.addActor(mainBox)
	}
	
	public Toggle(): void {
		this.menu.toggle();
	}

    /** Fully rebuilds UI */
    public Rebuild(config: Config): void {
        this.ShowLoadingUi();
        this.CurrentWeather.Rebuild(config, this.GetTextColorStyle());
        this.HourlyWeather.Rebuild(config, this.GetTextColorStyle());
        this.FutureWeather.Rebuild(config, this.GetTextColorStyle());
        this.Bar.Rebuild(config);
    }

	/** Changes all icon's type what are affected by
	 * the "use symbolic icons" setting
	 */
    public UpdateIconType(iconType: imports.gi.St.IconType): void {
		if (iconType == IconType.FULLCOLOR && this.App.config._useCustomMenuIcons) return;
		this.CurrentWeather.UpdateIconType(iconType);
		this.FutureWeather.UpdateIconType(iconType);
        this.HourlyWeather.UpdateIconType(iconType);
    }

    public DisplayErrorMessage(msg: string) {
        this.Bar.DisplayErrorMessage(msg);
	}

	public Display(weather: WeatherData, config: Config, provider: WeatherProvider): boolean {
		this.CurrentWeather.Display(weather, config);
		this.FutureWeather.Display(weather, config);
        let shouldShowToggle = this.HourlyWeather.Display(weather.hourlyForecasts, config, weather.location.timeZone);
		this.Bar.Display(weather, provider, config, shouldShowToggle);
		return true;
	}

    /** Destroys UI first then shows initial UI */
    private ShowLoadingUi(): void {
        this.CurrentWeather.Destroy();
        this.FutureWeather.Destroy();
        this.Bar.Destroy()
        this.CurrentWeather.actor.set_child(new Label({
            text: _('Loading current weather ...')
        }))
        this.FutureWeather.actor.set_child(new Label({
            text: _('Loading future weather ...')
        }))
    }
}