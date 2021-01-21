"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UIForecasts = void 0;
const consts_1 = require("./consts");
const logger_1 = require("./logger");
const utils_1 = require("./utils");
const { Bin, BoxLayout, Side, IconType, Label, ScrollView, Icon, Align, Widget } = imports.gi.St;
const { GridLayout } = imports.gi.Clutter;
const STYLE_FORECAST_ICON = 'weather-forecast-icon';
const STYLE_FORECAST_DATABOX = 'weather-forecast-databox';
const STYLE_FORECAST_DAY = 'weather-forecast-day';
const STYLE_FORECAST_SUMMARY = 'weather-forecast-summary';
const STYLE_FORECAST_TEMPERATURE = 'weather-forecast-temperature';
const STYLE_FORECAST_BOX = 'weather-forecast-box';
const STYLE_FORECAST_CONTAINER = 'weather-forecast-container';
const STYLE_FORECAST = 'forecast';
class UIForecasts {
    constructor(app) {
        this.app = app;
        this.actor = new Bin({ style_class: STYLE_FORECAST });
    }
    UpdateIconType(iconType) {
        for (let i = 0; i < this._forecast.length; i++) {
            this._forecast[i].Icon.icon_type = iconType;
        }
    }
    Display(weather, config) {
        try {
            if (!weather.forecasts)
                return false;
            let len = Math.min(this._forecast.length, weather.forecasts.length);
            for (let i = 0; i < len; i++) {
                let forecastData = weather.forecasts[i];
                let forecastUi = this._forecast[i];
                let t_low = utils_1.TempToUserConfig(forecastData.temp_min, config.TemperatureUnit, config._tempRussianStyle);
                let t_high = utils_1.TempToUserConfig(forecastData.temp_max, config.TemperatureUnit, config._tempRussianStyle);
                let first_temperature = config._temperatureHighFirst ? t_high : t_low;
                let second_temperature = config._temperatureHighFirst ? t_low : t_high;
                let comment = "";
                if (forecastData.condition.main != null && forecastData.condition.description != null) {
                    comment = (config._shortConditions) ? forecastData.condition.main : forecastData.condition.description;
                    comment = utils_1.capitalizeFirstLetter(comment);
                    if (config._translateCondition)
                        comment = utils_1._(comment);
                }
                let dayName = utils_1.GetDayName(forecastData.date, config.currentLocale, config._showForecastDates, weather.location.timeZone);
                forecastUi.Day.text = dayName;
                forecastUi.Temperature.text = first_temperature;
                forecastUi.Temperature.text += ((config._tempRussianStyle) ? consts_1.ELLIPSIS : " " + consts_1.FORWARD_SLASH + " ");
                forecastUi.Temperature.text += second_temperature + ' ' + utils_1.UnitToUnicode(config.TemperatureUnit);
                forecastUi.Summary.text = comment;
                forecastUi.Icon.icon_name = (config._useCustomMenuIcons) ? forecastData.condition.customIcon : forecastData.condition.icon;
            }
            return true;
        }
        catch (e) {
            this.app.ShowError({
                type: "hard",
                detail: "unknown",
                message: "Forecast parsing failed: " + e.toString(),
                userError: false
            });
            logger_1.Log.Instance.Error("DisplayForecastError " + e);
            return false;
        }
    }
    ;
    Rebuild(config, textColorStyle) {
        this.Destroy();
        this._forecast = [];
        this._forecastBox = new GridLayout({
            orientation: config._verticalOrientation
        });
        this._forecastBox.set_column_homogeneous(true);
        let table = new Widget({
            layout_manager: this._forecastBox,
            style_class: STYLE_FORECAST_CONTAINER
        });
        this.actor.set_child(table);
        let maxDays = this.app.GetMaxForecastDays();
        let maxRow = config._forecastRows;
        let maxCol = config._forecastColumns;
        if (config._verticalOrientation) {
            [maxRow, maxCol] = [maxCol, maxRow];
        }
        let curRow = 0;
        let curCol = 0;
        for (let i = 0; i < maxDays; i++) {
            let forecastWeather = {};
            if (curCol >= maxCol) {
                curRow++;
                curCol = 0;
            }
            if (curRow >= maxRow)
                break;
            forecastWeather.Icon = new Icon({
                icon_type: config.IconType,
                icon_size: 48,
                icon_name: consts_1.APPLET_ICON,
                style_class: STYLE_FORECAST_ICON
            });
            forecastWeather.Day = new Label({
                style_class: STYLE_FORECAST_DAY,
                reactive: true,
                style: textColorStyle
            });
            forecastWeather.Summary = new Label({
                style_class: STYLE_FORECAST_SUMMARY,
                reactive: true
            });
            forecastWeather.Temperature = new Label({
                style_class: STYLE_FORECAST_TEMPERATURE
            });
            let by = new BoxLayout({
                vertical: true,
                style_class: STYLE_FORECAST_DATABOX
            });
            by.add_actor(forecastWeather.Day);
            by.add_actor(forecastWeather.Summary);
            by.add_actor(forecastWeather.Temperature);
            let bb = new BoxLayout({
                style_class: STYLE_FORECAST_BOX
            });
            bb.add_actor(forecastWeather.Icon);
            bb.add_actor(by);
            this._forecast[i] = forecastWeather;
            if (!config._verticalOrientation) {
                this._forecastBox.attach(bb, curCol, curRow, 1, 1);
            }
            else {
                this._forecastBox.attach(bb, curRow, curCol, 1, 1);
            }
            curCol++;
        }
    }
    Destroy() {
        if (this.actor.get_child() != null)
            this.actor.get_child().destroy();
    }
}
exports.UIForecasts = UIForecasts;
