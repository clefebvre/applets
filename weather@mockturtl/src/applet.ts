const DEBUG = false;
function importModule(path: string): any {
  if (typeof require !== 'undefined') {
    return require('./' + path);
  } else {
    let AppletDir = imports.ui.appletManager.applets['weather@mockturtl'];
    return AppletDir[path];
  }
}

/**
 * /usr/share/gjs-1.0/
 * /usr/share/gnome-js/
 */
const Cairo = imports.cairo;
const Lang = imports.lang;
// http://developer.gnome.org/glib/unstable/glib-The-Main-Event-Loop.html
const Main = imports.ui.main;
var Mainloop = imports.mainloop;

/**
 * /usr/share/gjs-1.0/overrides/
 * /usr/share/gir-1.0/
 * /usr/lib/cinnamon/
 */
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
// http://developer.gnome.org/libsoup/stable/libsoup-client-howto.html
const Soup = imports.gi.Soup;
// http://developer.gnome.org/st/stable/
const St = imports.gi.St;
/**
 * /usr/share/cinnamon/js/
 */
const Applet = imports.ui.applet;
const Config = imports.misc.config;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;

var utils = importModule("utils");
var GetDayName = utils.GetDayName as (date: Date, locale:string, tz?: string) => string;
var GetHoursMinutes = utils.GetHoursMinutes as (date: Date, locale: string, hours24Format: boolean, tz?: string) => string;
var capitalizeFirstLetter = utils.capitalizeFirstLetter as (description: string) => string;
var TempToUserUnits = utils.TempToUserUnits as (kelvin: number, units: WeatherUnits) => number;
var PressToUserUnits = utils.PressToUserUnits as (hpa: number, units: WeatherPressureUnits) => number;
var compassDirection = utils.compassDirection as (deg: number) => string;
var MPStoUserUnits = utils.MPStoUserUnits as (mps: number, units: WeatherWindSpeedUnits) => number;
var nonempty = utils.nonempty as (str: string) => boolean;

// This always evalueates to True because "var Promise" line exists iinside 
if (typeof Promise != "function") {
  var promisePoly = importModule("promise-polyfill");
  var finallyConstructor = promisePoly.finallyConstructor;
  var setTimeout = promisePoly.setTimeout as (func: any, ms: number) => void;
  var setTimeoutFunc = promisePoly.setTimeoutFunc;
  var isArray = promisePoly.isArray;
  var noop = promisePoly.noop;
  var bind = promisePoly.bind;
  var Promise = promisePoly.Promise as PromiseConstructor;
  var handle = promisePoly.handle;
  var resolve = promisePoly.resolve;
  var reject = promisePoly.reject;
  var finale = promisePoly.finale;
  var Handler = promisePoly.Handler;
  var doResolve = promisePoly.doResolve;
  Promise.prototype['catch'] = promisePoly.Promise.prototype['catch'];
  Promise.prototype.then = promisePoly.Promise.prototype.then;
  Promise.all = promisePoly.Promise.all;
  Promise.resolve = promisePoly.Promise.resolve;
  Promise.reject = promisePoly.Promise.reject;
  Promise.race = promisePoly.Promise.race;
  var globalNS = promisePoly.globalNS;
  if (!('Promise' in globalNS)) {
    globalNS['Promise'] = Promise;
  } else if (!globalNS.Promise.prototype['finally']) {
    globalNS.Promise.prototype['finally'] = finallyConstructor;
  }
}

//----------------------------------------------------------------
//
// l10n
//
//----------------------------------------------------------------------

const GLib = imports.gi.GLib
const Gettext = imports.gettext

// Location lookup service
const ipApi = importModule('ipApi');

//----------------------------------------------------------------------
//
// Constants
//
//----------------------------------------------------------------------

const UUID = "weather@mockturtl"
const APPLET_ICON = "view-refresh-symbolic"
const REFRESH_ICON = "view-refresh";
const CMD_SETTINGS = "cinnamon-settings applets " + UUID

// Magic strings
const BLANK = '   '
const ELLIPSIS = '...'
const EN_DASH = '\u2013'


/* Some Information on More Data Service options to stay in free limit:
APIXU: 10000 calls a month
DarkSky: 1000 calls a day free
WeatherBit: 1000 calls a day, 16 Day foreast Call
AccuWeather: 50 calls a day

Openweather: max 60 calls per minute, Temporary ban and no charge
*/
const DATA_SERVICE = {
  OPEN_WEATHER_MAP: "OpenWeatherMap",
  DARK_SKY: "DarkSky",
}

// Schema keys
const WEATHER_LOCATION = "location"
const WEATHER_USE_SYMBOLIC_ICONS_KEY = 'useSymbolicIcons'

enum KEYS {
  WEATHER_DATA_SERVICE = "dataService",
    WEATHER_API_KEY = "apiKey",
    WEATHER_TEMPERATURE_UNIT_KEY = "temperatureUnit",
    WEATHER_TEMPERATURE_HIGH_FIRST_KEY = "temperatureHighFirst",
    WEATHER_WIND_SPEED_UNIT_KEY = "windSpeedUnit",
    WEATHER_CITY_KEY = "locationLabelOverride",
    WEATHER_TRANSLATE_CONDITION_KEY = "translateCondition",
    WEATHER_VERTICAL_ORIENTATION_KEY = "verticalOrientation",
    WEATHER_SHOW_TEXT_IN_PANEL_KEY = "showTextInPanel",
    WEATHER_SHOW_COMMENT_IN_PANEL_KEY = "showCommentInPanel",
    WEATHER_SHOW_SUNRISE_KEY = "showSunrise",
    WEATHER_SHOW_24HOURS_KEY = "show24Hours",
    WEATHER_FORECAST_DAYS = "forecastDays",
    WEATHER_REFRESH_INTERVAL = "refreshInterval",
    WEATHER_PRESSURE_UNIT_KEY = "pressureUnit",
    WEATHER_SHORT_CONDITIONS_KEY = "shortConditions",
    WEATHER_MANUAL_LOCATION = "manualLocation"
}

// Signals
const SIGNAL_CHANGED = 'changed::'
const SIGNAL_CLICKED = 'clicked'
const SIGNAL_REPAINT = 'repaint'

// stylesheet.css
const STYLE_LOCATION_LINK = 'weather-current-location-link'
const STYLE_SUMMARYBOX = 'weather-current-summarybox'
const STYLE_SUMMARY = 'weather-current-summary'
const STYLE_DATABOX = 'weather-current-databox'
const STYLE_ICON = 'weather-current-icon'
const STYLE_ICONBOX = 'weather-current-iconbox'
const STYLE_DATABOX_CAPTIONS = 'weather-current-databox-captions'
const STYLE_ASTRONOMY = 'weather-current-astronomy'
const STYLE_FORECAST_ICON = 'weather-forecast-icon'
const STYLE_FORECAST_DATABOX = 'weather-forecast-databox'
const STYLE_FORECAST_DAY = 'weather-forecast-day'
const STYLE_CONFIG = 'weather-config'
const STYLE_DATABOX_VALUES = 'weather-current-databox-values'
const STYLE_FORECAST_SUMMARY = 'weather-forecast-summary'
const STYLE_FORECAST_TEMPERATURE = 'weather-forecast-temperature'
const STYLE_FORECAST_BOX = 'weather-forecast-box'
const STYLE_FORECAST_CONTAINER = 'weather-forecast-container'
const STYLE_PANEL_BUTTON = 'panel-button'
const STYLE_POPUP_SEPARATOR_MENU_ITEM = 'popup-separator-menu-item'
const STYLE_CURRENT = 'current'
const STYLE_FORECAST = 'forecast'
const STYLE_WEATHER_MENU = 'weather-menu'

//----------------------------------------------------------------------
//
// Logging
//
//----------------------------------------------------------------------

class Log {
  ID: number;
  debug: boolean = false;

  constructor(_instanceId: number) {
    this.ID = _instanceId;
    this.debug = DEBUG;
  }

  Print(message: string): void {
    let msg = UUID + "#" + this.ID + ": " + message.toString();
    let debug = "";
    if (this.debug) {
      debug = this.GetErrorLine();
      global.log(msg, '\n', "On Line:", debug);
    } else {
      global.log(msg);
    }
  }

  Error(error: string): void {
    global.logError(UUID + "#" + this.ID + ": " + error.toString(), '\n', "On Line:", this.GetErrorLine());
  };

  Debug(message: string): void {
    if (this.debug) {
      this.Print(message);
    }
  }

  GetErrorLine(): string {
    // Couldnt be more ugly, but it returns the file and line number
    let arr = (new Error).stack.split("\n").slice(-2)[0].split('/').slice(-1)[0];
    return arr;
  }
}


Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str: string): string {
  return Gettext.dgettext(UUID, str)
}

//----------------------------------------------------------------------
//
// MyApplet
//
//----------------------------------------------------------------------

class MyApplet extends Applet.TextIconApplet {
  weather: Weather = {
    dateTime: null, // Date object, UTC
    location: {
      city: null,
      country: null, // Country code
      id: null, // API Specific ID, not used
      tzOffset: null, // seconds
      timeZone: null
    },
    coord: {
      lat: null,
      lon: null,
    },
    sunrise: null, // Date object, UTC
    sunset: null, // Date object, UTC
    wind: {
      speed: null, // MPS
      degree: null, // meteorlogical degrees
    },
    main: {
      temperature: null, // Kelvin
      pressure: null, // hPa
      humidity: null, // %
      temp_min: null, // Kelvin, not used
      temp_max: null, // Kelvin, not used
      feelsLike: null // kelvin
    },
    condition: {
      id: null, // ID, not used
      main: null, // What API returns
      description: null, // Longer description, if not available put the same whats in main
      icon: null, // GTK weather icon names
    },
    cloudiness: null, // %
  }

  forecasts: Array < Forecast > = [];

  ///////////////////////////////////////////////////////////////////////
  ///////////////////////////////////////////////////////////////////////  

  errMsg = { // Error messages to use
    label: {
      generic: _("Error"),
      service: _("Service Error"),
      noKey: _("No Api key"),
      noLoc: _("No Location"),
    },
    desc: {
      keyBad: _("Wrong API Key"),
      locBad: _("Wrong Location"),
      locNotFound: _("Location Not found"),
      parse: _("Parsing weather information failed :("),
      keyBlock: _("Key Temp. Blocked"),
      cantGetLoc: _("Could not get location"),
      unknown: _("Unknown Error"),
      noResponse: _("No/Bad response from Data Service")
    }
  }

  // DarkSky Filter words for short conditions, won't work on every language
  DarkSkyFilterWords = [_("and"), _("until"), _("in")];


  // UI elements
  _currentWeather: any;
  _separatorArea: any;
  _futureWeather: any;
  _applet_context_menu: any;
  _icon_type: string;
  _currentWeatherIcon: any;
  _currentWeatherSummary: any;
  _currentWeatherLocation: any;
  _currentWeatherSunrise: any;
  _currentWeatherSunset: any;
  _currentWeatherTemperature: any;
  _currentWeatherHumidity: any;
  _currentWeatherPressure: any;
  _currentWeatherWind: any;
  _currentWeatherApiUnique: any;
  _currentWeatherApiUniqueCap: any;
  _forecast: Array < any > ;
  _forecastBox: any;

  // Settings properties to bind
  _refreshInterval: number;
  _manualLocation: boolean;
  _dataService: string;
  _location: string;
  _translateCondition: boolean;
  _temperatureUnit: WeatherUnits;
  _pressureUnit: WeatherPressureUnits;
  _windSpeedUnit: WeatherWindSpeedUnits;
  _show24Hours: boolean;
  _apiKey: string;
  _forecastDays: number;
  _verticalOrientation: boolean;
  _temperatureHighFirst: boolean;
  _shortConditions: boolean;
  _showSunrise: boolean;
  _showCommentInPanel: boolean;
  _showTextInPanel: boolean;
  _locationLabelOverride: string;

  keybinding: any;
  menu: any;
  menuManager: any;
  settings: any;
  log: Log;
  currentLocale: string = null;
  systemLanguage: string = null;
  // Soup session (see https://bugzilla.gnome.org/show_bug.cgi?id=661323#c64)
  _httpSession = new Soup.SessionAsync();

  provider: WeatherProvider; // API
  locProvider = new ipApi.IpApi(this); // IP location lookup
  lastUpdated: Date = null;
  orientation: any;

  constructor(metadata: any, orientation: any, panelHeight: number, instanceId: number) {
    super(orientation, panelHeight, instanceId);
    this.currentLocale = this.constructJsLocale(GLib.get_language_names()[0]);
    this.systemLanguage = this.currentLocale.split('_')[0];
    this.settings = new Settings.AppletSettings(this, UUID, instanceId)
    this.log = new Log(instanceId);
    this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0"; // ipapi blocks non-browsers agents, imitating browser
    Soup.Session.prototype.add_feature.call(this._httpSession, new Soup.ProxyResolverDefault());


    // Interface: TextIconApplet
    this.set_applet_icon_name(APPLET_ICON);
    this.set_applet_label(_("..."));
    this.set_applet_tooltip(_("Click to open"));

    // PopupMenu
    this.menuManager = new PopupMenu.PopupMenuManager(this)
    this.menu = new Applet.AppletPopupMenu(this, orientation)
    if (typeof this.menu.setCustomStyleClass === "function")
      this.menu.setCustomStyleClass(STYLE_WEATHER_MENU);
    else
      this.menu.actor.add_style_class_name(STYLE_WEATHER_MENU);
    this.menuManager.addMenu(this.menu)

    //----------------------------------
    // bind settings
    //----------------------------------

    for (let k in KEYS) {
      let key = KEYS[k];
      let keyProp = "_" + key;
      this.settings.bindProperty(Settings.BindingDirection.IN,
        key, keyProp, this.refreshAndRebuild, null);
    }

    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
      WEATHER_LOCATION, ("_" + WEATHER_LOCATION), this.refreshAndRebuild, null);

    this.settings.bindProperty(Settings.BindingDirection.IN, "keybinding",
      "keybinding", this._onKeySettingsUpdated, null);

    Main.keybindingManager.addHotKey(
      UUID, this.keybinding, Lang.bind(this, this.on_applet_clicked));

    this.updateIconType()

    this.settings.connect(SIGNAL_CHANGED + WEATHER_USE_SYMBOLIC_ICONS_KEY, Lang.bind(this, function () {
      this.updateIconType()
      this._applet_icon.icon_type = this._icon_type
      this._currentWeatherIcon.icon_type = this._icon_type
      for (let i = 0; i < this._forecastDays; i++) {
        this._forecast[i].Icon.icon_type = this._icon_type
      }
      this.refreshWeather()
    }))

    // Refresh Button in context menu
    let itemLabel = _("Refresh")
    let refreshMenuItem = new Applet.MenuItem(itemLabel, REFRESH_ICON, Lang.bind(this, function () {
      this.refreshWeather();
    }))
    this._applet_context_menu.addMenuItem(refreshMenuItem)

    //------------------------------
    // render graphics container
    //------------------------------

    // build menu
    let mainBox = new St.BoxLayout({
      vertical: true
    })
    this.menu.addActor(mainBox)

    //  today's forecast
    this._currentWeather = new St.Bin({
      style_class: STYLE_CURRENT
    })
    mainBox.add_actor(this._currentWeather)

    //  horizontal rule
    this._separatorArea = new St.DrawingArea({
      style_class: STYLE_POPUP_SEPARATOR_MENU_ITEM
    })
    this._separatorArea.width = 200
    this._separatorArea.connect(SIGNAL_REPAINT, Lang.bind(this, this._onSeparatorAreaRepaint))
    mainBox.add_actor(this._separatorArea)

    //  tomorrow's forecast
    this._futureWeather = new St.Bin({
      style_class: STYLE_FORECAST
    })
    mainBox.add_actor(this._futureWeather)

    this.rebuild()

    //------------------------------
    // run
    //------------------------------
    this.refreshLoop();

    this.orientation = orientation;
    try {
      this.setAllowedLayout(Applet.AllowedLayout.BOTH);
      this.update_label_visible();
    } catch (e) {
      // vertical panel not supported
    }
  }

  refreshAndRebuild(): void {
    this.refreshWeather();
  };

  async LoadJsonAsync(query: string): Promise < any > {
    let json = await new Promise((resolve: any, reject: any) => {
      let message = Soup.Message.new('GET', query);
      this._httpSession.queue_message(message, (session: any, message: any) => {
        if (message) {
          try {
            if (message.status_code != 200) {
              reject("http response Code: " + message.status_code + ", reason: " + message.reason_phrase);
              return;
            }

            this.log.Debug("API full response: " + message.response_body.data.toString());
            let payload = JSON.parse(message.response_body.data);
            resolve(payload);
          } catch (e) { // Payload is not JSON
            this.log.Error("Error: API response is not JSON. The response: " + message.response_body.data);
            reject(e);
          }
        } else { // No response
          this.log.Error("Error: No Response from API");
          reject(null);
        }
      });
    });
    return json;
  };

  async locationLookup(): Promise < void > {
    let command = "xdg-open ";
    Util.spawnCommandLine(command + "https://cinnamon-spices.linuxmint.com/applets/view/17");
  }

  refreshLoop(): void {
    // Main independent Loop
    try {
      if (this.lastUpdated == null || new Date(this.lastUpdated.getTime() + this._refreshInterval * 60000) < new Date()) {
        this.refreshWeather();
      }
    } catch (e) {
      this.log.Error("Error in Main loop: " + e);
      this.lastUpdated = null;
    }
    Mainloop.timeout_add_seconds(15, Lang.bind(this, function mainloopTimeout() {
      this.refreshLoop();
    }))
  };

  // Override Methods: Applet

  update_label_visible(): void {
    if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT)
      this.hide_applet_label(true);
    else
      this.hide_applet_label(false);
  };

  on_orientation_changed(orientation: string) {
    this.orientation = orientation;
    this.refreshWeather()
  };

  _onKeySettingsUpdated(): void {
    if (this.keybinding != null) {
      Main.keybindingManager.addHotKey(UUID,
        this.keybinding,
        Lang.bind(this,
          this.on_applet_clicked))
    }
  }

  on_applet_clicked(event: any): void {
    this.menu.toggle()
  }


  _onSeparatorAreaRepaint(area: any) {
    let cr = area.get_context()
    let themeNode = area.get_theme_node()
    let [width, height] = area.get_surface_size()
    let margin = themeNode.get_length('-margin-horizontal')
    let gradientHeight = themeNode.get_length('-gradient-height')
    let startColor = themeNode.get_color('-gradient-start')
    let endColor = themeNode.get_color('-gradient-end')
    let gradientWidth = (width - margin * 2)
    let gradientOffset = (height - gradientHeight) / 2
    let pattern = new Cairo.LinearGradient(margin, gradientOffset, width - margin, gradientOffset + gradientHeight)
    pattern.addColorStopRGBA(0, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255)
    pattern.addColorStopRGBA(0.5, endColor.red / 255, endColor.green / 255, endColor.blue / 255, endColor.alpha / 255)
    pattern.addColorStopRGBA(1, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255)
    cr.setSource(pattern)
    cr.rectangle(margin, gradientOffset, gradientWidth, gradientHeight)
    cr.fill()
  };


  //----------------------------------------------------------------------
  //
  // Methods
  //
  //----------------------------------------------------------------------

  updateIconType(): void {
    this._icon_type = this.settings.getValue(WEATHER_USE_SYMBOLIC_ICONS_KEY) ?
      St.IconType.SYMBOLIC :
      St.IconType.FULLCOLOR
  };

  showError(title: string, msg: string): void {
    this.set_applet_label(title);
    this.set_applet_tooltip("Click to open");
    this.set_applet_icon_name("weather-severe-alert");
    this._currentWeatherSunrise.text = msg;
  };

  constructJsLocale(locale: string): string {
    let jsLocale = locale.split(".")[0];
    let tmp: string[] = jsLocale.split("_");
    jsLocale = "";
    for (let i = 0; i < tmp.length; i++) {
      if (i != 0) jsLocale += "-";
      jsLocale += tmp[i];
    }
    return jsLocale;
  }

  async refreshWeather(): Promise < void > {
    this.wipeCurrentData();
    this.wipeForecastData();
    try {
      if (!this._manualLocation) { // Autmatic location
        // Have to check every time to make sure location is the same
        let haveLocation = await this.locProvider.GetLocation();
        if (!haveLocation) {
          this.log.Error("Couldn't obtain location, retry in 15 seconds...");
          this.showError(this.errMsg.label.noLoc, this.errMsg.desc.cantGetLoc);
          this.lastUpdated = null;
          return;
        }
      } else { // Manual Location
        // Veryfiing User Input
        let loc = this._location.replace(" ", "");
        if (loc == undefined || loc == "") {
          this.showError(this.errMsg.label.noLoc, "");
          this.log.Error("No location given when setting is on Manual Location");
          return;
        }
      }

      switch (this._dataService) {
        case DATA_SERVICE.DARK_SKY:           // No City Info
          if (darkSky == null) var darkSky = importModule('darkSky');
          this.provider = new darkSky.DarkSky(this);
          break;
        case DATA_SERVICE.OPEN_WEATHER_MAP:   // No TZ info
          if (openWeatherMap == null) var openWeatherMap = importModule("openWeatherMap");
          this.provider = new openWeatherMap.OpenWeatherMap(this);
          break;
        default:
          return;
      }

      if (!await this.provider.GetWeather()) { // Failed to get Weather
        this.log.Error("Unable to obtain Weather Information");
        this.lastUpdated = null;
        return;
      }

      this.rebuild();
      if (await this.displayWeather() && await this.displayForecast()) {
        this.log.Print("Weather Information refreshed");
      }
    } catch (e) {
      this.log.Error("Error while refreshing Weather info: " + e);
      this.lastUpdated = null;
      return;
    }

    this.lastUpdated = new Date();
    return;
  };


  displayWeather(): boolean {
    try {
      let mainCondition = "";
      let descriptionCondition = "";
      // Short Condition Name
      if (this.weather.condition.main != null) {
        mainCondition = this.weather.condition.main;
        if (this._translateCondition) {
          mainCondition = capitalizeFirstLetter(_(mainCondition));
        }
      }
      // Condition Description
      if (this.weather.condition.description != null) {
        descriptionCondition = capitalizeFirstLetter(this.weather.condition.description);
        if (this._translateCondition) {
          descriptionCondition = _(descriptionCondition);
        }
      }

      // Displaying Location   
      let location = "";
      if (this.weather.location.city != null && this.weather.location.country != null) {
        location = this.weather.location.city + ", " + this.weather.location.country;
      } else {
        location = Math.round(this.weather.coord.lat * 10000) / 10000 + ", " + Math.round(this.weather.coord.lon * 10000) / 10000;
      }

      // Overriding Location
      if (nonempty(this._locationLabelOverride)) {
        location = this._locationLabelOverride;
      }

      this.set_applet_tooltip(location);

      // Weather Condition
      this._currentWeatherSummary.text = descriptionCondition;

      // Weather icon
      let iconname = this.weather.condition.icon;
      if (iconname == null) {
        iconname = "weather-severe-alert";
      }
      this._currentWeatherIcon.icon_name = iconname;
      this._icon_type == St.IconType.SYMBOLIC ?
        this.set_applet_icon_symbolic_name(iconname) :
        this.set_applet_icon_name(iconname)

      // Temperature
      let temp = "";
      if (this.weather.main.temperature != null) {
        temp = TempToUserUnits(this.weather.main.temperature, this._temperatureUnit).toString();
        this._currentWeatherTemperature.text = temp + ' ' + this.unitToUnicode();
      }

      // Set Applet Label, even if the variables are empty
      let label = "";
      if (this._showCommentInPanel) {
        label += mainCondition;
      }
      if (this._showTextInPanel) {
        if (label != "") {
          label += " ";
        }
        label += (temp + ' ' + this.unitToUnicode());
      }
      this.set_applet_label(label);

      try {
        this.update_label_visible();
      } catch (e) {
        // vertical panel not supported
      }

      // Displaying humidity
      if (this.weather.main.humidity != null) {
        this._currentWeatherHumidity.text = Math.round(this.weather.main.humidity) + "%";
      }

      // Wind
      let wind_direction = compassDirection(this.weather.wind.degree);
      this._currentWeatherWind.text = ((wind_direction != undefined) ? wind_direction + ' ' : '') + MPStoUserUnits(this.weather.wind.speed, this._windSpeedUnit) + ' ' + this._windSpeedUnit;

      // API Unique display
      switch (this._dataService) {
        case DATA_SERVICE.OPEN_WEATHER_MAP:
          if (this.weather.cloudiness != null) {
            this._currentWeatherApiUnique.text = this.weather.cloudiness + "%";
            this._currentWeatherApiUniqueCap.text = _("Cloudiness:");
          }
          break;
        case DATA_SERVICE.DARK_SKY:
          if (this.weather.main.feelsLike != null) {
            this._currentWeatherApiUnique.text = TempToUserUnits(this.weather.main.feelsLike, this._temperatureUnit) + this.unitToUnicode();
            this._currentWeatherApiUniqueCap.text = _("Feels like:");
          }
          break;
        default:
          this._currentWeatherApiUnique.text = "";
          this._currentWeatherApiUniqueCap.text = "";
      }

      // Pressure
      if (this.weather.main.pressure != null) {
        this._currentWeatherPressure.text = PressToUserUnits(this.weather.main.pressure, this._pressureUnit) + ' ' + _(this._pressureUnit);
      }

      // Location
      this._currentWeatherLocation.label = location;
      switch (this._dataService) {
        case DATA_SERVICE.OPEN_WEATHER_MAP:
          this._currentWeatherLocation.url = "https://openweathermap.org/city/" + this.weather.location.id;
          break;
        case DATA_SERVICE.DARK_SKY:
          this._currentWeatherLocation.url = "https://darksky.net/forecast/" + this.weather.coord.lat + "," + this.weather.coord.lon;
          break;
        default:
          this._currentWeatherLocation.url = null;
      }

      // Sunset/Sunrise
      let sunriseText = "";
      let sunsetText = "";
      if (this.weather.sunrise != null && this.weather.sunset != null && this._showSunrise) {
        sunriseText = (_('Sunrise') + ': ' + GetHoursMinutes(this.weather.sunrise, this.currentLocale, this._show24Hours, this.weather.location.timeZone));
        sunsetText = (_('Sunset') + ': ' + GetHoursMinutes(this.weather.sunset, this.currentLocale, this._show24Hours, this.weather.location.timeZone));
      }

      this._currentWeatherSunrise.text = sunriseText;
      this._currentWeatherSunset.text = sunsetText;
      return true;
    } catch (e) {
      this.log.Error("DisplayWeatherError: " + e);
      return false;
    }
  };

  displayForecast(): boolean {
    try {
      for (let i = 0; i < this._forecast.length; i++) {
        let forecastData = this.forecasts[i];
        let forecastUi = this._forecast[i];

        let t_low = TempToUserUnits(forecastData.main.temp_min, this._temperatureUnit);
        let t_high = TempToUserUnits(forecastData.main.temp_max, this._temperatureUnit);

        let first_temperature = this._temperatureHighFirst ? t_high : t_low;
        let second_temperature = this._temperatureHighFirst ? t_low : t_high;

        // Weather Condition
        let comment = "";
        if (forecastData.condition.main != null && forecastData.condition.description != null) {
          comment = (this._shortConditions) ? forecastData.condition.main : forecastData.condition.description;
          comment = capitalizeFirstLetter(comment);
          if (this._translateCondition) comment = _(comment);
        }

        // Day Names
        if (this.weather.location.timeZone == null) forecastData.dateTime.setMilliseconds(forecastData.dateTime.getMilliseconds() + (this.weather.location.tzOffset * 1000));
        let dayName: string = GetDayName(forecastData.dateTime, this.currentLocale, this.weather.location.timeZone);

        if (forecastData.dateTime) {
          let now = new Date();
          if (forecastData.dateTime.getDate() == now.getDate()) dayName = _("Today");
          if (forecastData.dateTime.getDate() == new Date(now.setDate(now.getDate() + 1)).getDate()) dayName = _("Tomorrow");
        }

        forecastUi.Day.text = dayName;
        forecastUi.Temperature.text = first_temperature + ' ' + '\u002F' + ' ' + second_temperature + ' ' + this.unitToUnicode();
        forecastUi.Summary.text = comment;
        forecastUi.Icon.icon_name = forecastData.condition.icon;
      }
      return true;
    } catch (e) {
        this.log.Error("DisplayForecastError " + e);
      return false;
    }
  };

  wipeCurrentData(): void {
    //Reset weather object
    this.weather.dateTime = null;
    this.weather.location.city = null;
    this.weather.location.country = null;
    this.weather.location.id = null;
    this.weather.location.timeZone = null;
    this.weather.location.tzOffset = null;
    this.weather.coord.lat = null;
    this.weather.coord.lon = null;
    this.weather.sunrise = null;
    this.weather.sunset = null;
    this.weather.wind.degree = null;
    this.weather.wind.speed = null;
    this.weather.main.temperature = null;
    this.weather.main.pressure = null;
    this.weather.main.humidity = null;
    this.weather.main.temp_max = null;
    this.weather.main.temp_min = null;
    this.weather.condition.id = null;
    this.weather.condition.main = null;
    this.weather.condition.description = null;
    this.weather.condition.icon = null;
    this.weather.cloudiness = null;
  };

  wipeForecastData(): void {
    this.forecasts = [];
  };

  destroyCurrentWeather(): void {
    if (this._currentWeather.get_child() != null)
      this._currentWeather.get_child().destroy()
  }

  destroyFutureWeather(): void {
    if (this._futureWeather.get_child() != null)
      this._futureWeather.get_child().destroy()
  }

  showLoadingUi(): void {
    this.destroyCurrentWeather()
    this.destroyFutureWeather()
    this._currentWeather.set_child(new St.Label({
      text: _('Loading current weather ...')
    }))
    this._futureWeather.set_child(new St.Label({
      text: _('Loading future weather ...')
    }))
  }

  rebuild(): void {
    this.showLoadingUi()
    this.rebuildCurrentWeatherUi()
    this.rebuildFutureWeatherUi()
  }

  rebuildCurrentWeatherUi(): void {
    this.destroyCurrentWeather()

    // This will hold the icon for the current weather
    this._currentWeatherIcon = new St.Icon({
      icon_type: this._icon_type,
      icon_size: 64,
      icon_name: APPLET_ICON,
      style_class: STYLE_ICON
    })

    // The summary of the current weather
    this._currentWeatherSummary = new St.Label({
      text: _('Loading ...'),
      style_class: STYLE_SUMMARY
    })

    this._currentWeatherLocation = new St.Button({
      reactive: true,
      label: _('Refresh'),
    });

    this._currentWeatherLocation.style_class = STYLE_LOCATION_LINK
    this._currentWeatherLocation.connect(SIGNAL_CLICKED, Lang.bind(this, function () {
      if (this._currentWeatherLocation.url == null) {
        this.refreshWeather();
      } else {
        Gio.app_info_launch_default_for_uri(
          this._currentWeatherLocation.url,
          global.create_app_launch_context()
        )
      }
    }));

    let bb = new St.BoxLayout({
      vertical: true,
      style_class: STYLE_SUMMARYBOX
    })
    bb.add_actor(this._currentWeatherLocation)
    bb.add_actor(this._currentWeatherSummary)


    let textOb = {
      text: ELLIPSIS
    }
    this._currentWeatherSunrise = new St.Label(textOb)
    this._currentWeatherSunset = new St.Label(textOb)

    let ab = new St.BoxLayout({
      style_class: STYLE_ASTRONOMY
    })

    ab.add_actor(this._currentWeatherSunrise)
    let ab_spacerlabel = new St.Label({
      text: BLANK
    })
    ab.add_actor(ab_spacerlabel)
    ab.add_actor(this._currentWeatherSunset)

    let bb_spacerlabel = new St.Label({
      text: BLANK
    })
    bb.add_actor(bb_spacerlabel)
    bb.add_actor(ab)

    // Other labels
    this._currentWeatherTemperature = new St.Label(textOb)
    this._currentWeatherHumidity = new St.Label(textOb)
    this._currentWeatherPressure = new St.Label(textOb)
    this._currentWeatherWind = new St.Label(textOb)
    this._currentWeatherApiUnique = new St.Label({
      text: ''
    })

    // APi Unique Caption
    this._currentWeatherApiUniqueCap = new St.Label({
      text: ''
    });
    let rb = new St.BoxLayout({
      style_class: STYLE_DATABOX
    })
    let rb_captions = new St.BoxLayout({
      vertical: true,
      style_class: STYLE_DATABOX_CAPTIONS
    })
    let rb_values = new St.BoxLayout({
      vertical: true,
      style_class: STYLE_DATABOX_VALUES
    })
    rb.add_actor(rb_captions)
    rb.add_actor(rb_values)

    rb_captions.add_actor(new St.Label({
      text: _('Temperature:')
    }))
    rb_values.add_actor(this._currentWeatherTemperature)
    rb_captions.add_actor(new St.Label({
      text: _('Humidity:')
    }))
    rb_values.add_actor(this._currentWeatherHumidity)
    rb_captions.add_actor(new St.Label({
      text: _('Pressure:')
    }))
    rb_values.add_actor(this._currentWeatherPressure)
    rb_captions.add_actor(new St.Label({
      text: _('Wind:')
    }))
    rb_values.add_actor(this._currentWeatherWind)
    rb_captions.add_actor(this._currentWeatherApiUniqueCap);
    rb_values.add_actor(this._currentWeatherApiUnique)

    let xb = new St.BoxLayout()
    xb.add_actor(bb)
    xb.add_actor(rb)

    let box = new St.BoxLayout({
      style_class: STYLE_ICONBOX
    })
    box.add_actor(this._currentWeatherIcon)
    box.add_actor(xb)
    this._currentWeather.set_child(box)
  };

  rebuildFutureWeatherUi(): void {
    this.destroyFutureWeather();

    this._forecast = []
    this._forecastBox = new St.BoxLayout({
      vertical: this._verticalOrientation,
      style_class: STYLE_FORECAST_CONTAINER
    })
    this._futureWeather.set_child(this._forecastBox)

    for (let i = 0; i < this._forecastDays; i++) {
      let forecastWeather = {
        Icon: new St.Icon,
        Day: new St.Label,
        Summary: new St.Label,
        Temperature: new St.Label,
      }

      forecastWeather.Icon = new St.Icon({
        icon_type: this._icon_type,
        icon_size: 48,
        icon_name: APPLET_ICON,
        style_class: STYLE_FORECAST_ICON
      })
      forecastWeather.Day = new St.Label({
        style_class: STYLE_FORECAST_DAY
      })
      forecastWeather.Summary = new St.Label({
        style_class: STYLE_FORECAST_SUMMARY
      })
      forecastWeather.Temperature = new St.Label({
        style_class: STYLE_FORECAST_TEMPERATURE
      })

      let by = new St.BoxLayout({
        vertical: true,
        style_class: STYLE_FORECAST_DATABOX
      })
      by.add_actor(forecastWeather.Day)
      by.add_actor(forecastWeather.Summary)
      by.add_actor(forecastWeather.Temperature)

      let bb = new St.BoxLayout({
        style_class: STYLE_FORECAST_BOX
      })
      bb.add_actor(forecastWeather.Icon)
      bb.add_actor(by)

      this._forecast[i] = forecastWeather
      this._forecastBox.add_actor(bb)
    }
  }

  //----------------------------------------------------------------------
  //
  // Utility functions
  //
  //----------------------------------------------------------------------

  noApiKey(): boolean {
    if (this._apiKey == undefined || this._apiKey == "") {
      return true;
    }
    return false;
  };

  unitToUnicode(): string {
    return this._temperatureUnit == "fahrenheit" ? '\u2109' : '\u2103'
  }
  
  // Passing appropriate resolver function for the API, and the code
  weatherIconSafely(code: string, iconResolver: (icon: string) => Array < string > ): string {
    let iconname = iconResolver(code);
    for (let i = 0; i < iconname.length; i++) {
      if (this.hasIcon(iconname[i]))
        return iconname[i]
    }
    return 'weather-severe-alert'
  }

  hasIcon(icon: string): boolean {
    return Gtk.IconTheme.get_default().has_icon(icon + (this._icon_type == St.IconType.SYMBOLIC ? '-symbolic' : ''))
  }
}

//
// For Translators
//

const openWeatherMapConditionLibrary = [
  // Group 2xx: Thunderstorm
  _("Thunderstorm with light rain"),
  _("Thunderstorm with rain"),
  _("Thunderstorm with heavy rain"),
  _("Light thunderstorm"),
  _("Thunderstorm"),
  _("Heavy thunderstorm"),
  _("Ragged thunderstorm"),
  _("Thunderstorm with light drizzle"),
  _("Thunderstorm with drizzle"),
  _("Thunderstorm with heavy drizzle"),
  // Group 3xx: Drizzle
  _("Light intensity drizzle"),
  _("Drizzle"),
  _("Heavy intensity drizzle"),
  _("Light intensity drizzle rain"),
  _("Drizzle rain"),
  _("Heavy intensity drizzle rain"),
  _("Shower rain and drizzle"),
  _("Heavy shower rain and drizzle"),
  _("Shower drizzle"),
  // Group 5xx: Rain
  _("Light rain"),
  _("Moderate rain"),
  _("Heavy intensity rain"),
  _("Very heavy rain"),
  _("Extreme rain"),
  _("Freezing rain"),
  _("Light intensity shower rain"),
  _("Shower rain"),
  _("Heavy intensity shower rain"),
  _("Ragged shower rain"),
  // Group 6xx: Snow 
  _("Light snow"),
  _("Snow"),
  _("Heavy snow"),
  _("Sleet"),
  _("Shower sleet"),
  _("Light rain and snow"),
  _("Rain and snow"),
  _("Light shower snow"),
  _("Shower snow"),
  _("Heavy shower snow"),
  // Group 7xx: Atmosphere 
  _("Mist"),
  _("Smoke"),
  _("Haze"),
  _("Sand, dust whirls"),
  _("Fog"),
  _("Sand"),
  _("Dust"),
  _("Volcanic ash"),
  _("Squalls"),
  _("Tornado"),
  // Group 800: Clear 
  _("Clear"),
  _("Clear sky"),
  _("Sky is clear"),
  // Group 80x: Clouds
  _("Few clouds"),
  _("Scattered clouds"),
  _("Broken clouds"),
  _("Overcast clouds")
];


const icons = {
  clear_day: 'weather-clear',
  clear_night: 'weather-clear-night',
  few_clouds_day: 'weather-few-clouds',
  few_clouds_night: 'weather-few-clouds-night',
  clouds: 'weather-clouds',
  overcast: 'weather_overcast',
  showers_scattered: 'weather-showers-scattered',
  showers: 'weather-showers',
  rain: 'weather-rain',
  rain_freezing: 'weather-freezing-rain',
  snow: 'weather-snow',
  storm: 'weather-storm',
  fog: 'weather-fog',
  alert: 'weather-severe-alert'
}

//----------------------------------------------------------------------
//
// Entry point
//
//----------------------------------------------------------------------

function main(metadata: any, orientation: string, panelHeight: number, instanceId: number) {
  //log("v" + metadata.version + ", cinnamon " + Config.PACKAGE_VERSION)
  return new MyApplet(metadata, orientation, panelHeight, instanceId);
}

/** Units Used in Options. Change Options list if You change this! */
type WeatherUnits = 'celsius' | 'fahrenheit';

/** Units Used in Options. Change Options list if You change this! */
type WeatherWindSpeedUnits = 'kph' | 'mph' | 'm/s' | 'Knots';

/** Units used in Options. Change Options list if You change this! */
type WeatherPressureUnits = 'hPa'|'mm Hg'|'in Hg'|'Pa'|'psi'|'atm'|'at';


interface Forecast {
  dateTime: Date, //Required
    main: {
      /** Kelvin */
      temp: number,
      /**Kelvin */
      temp_min: number, //Required
      /**Kelvin */
      temp_max: number, //Required
      pressure ?: number,
      sea_level: number,
      grnd_level: number,
      humidity: number,
    },
    condition: {
      id: string,
      main: string, //Required
      description: string, //Required
      icon: string, //Required
    },
    clouds: number,
    wind: {
      speed: number,
      deg: number,
    }
}

interface Weather {
  dateTime: Date,
    location: {
      city: string,
      country: string,
      id: string, // API Specific ID, not used
      tzOffset: number, // seconds
      timeZone: string
    },
    coord: {
      lat: number,
      lon: number,
    },
    sunrise: Date, // Date object, UTC
    sunset: Date, // Date object, UTC
    wind: {
      speed: number, // MPS
      degree: number, // meteorlogical degrees
    },
    main: {
      temperature: number, // Kelvin
      pressure: number, // hPa
      humidity: number, // %
      temp_min: number, // Kelvin, not used
      temp_max: number, // Kelvin, not used
      feelsLike: number // kelvin
    },
    condition: {
      id: string, // ID, not used
      main: string, // What API returns
      description: string, // Longer description, if not available put the same whats in main
      icon: string, // GTK weather icon names
    },
    cloudiness: number,
}

interface WeatherProvider {
  GetWeather(): Promise<boolean>;
}