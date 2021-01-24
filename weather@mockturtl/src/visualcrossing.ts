import { Services } from "./config";
import { HttpError, HTTPParams } from "./httpLib";
import { WeatherApplet } from "./main";
import { BuiltinIcons, Condition, ForecastData, HourlyForecastData, LocationData, PrecipitationType, WeatherData, WeatherProvider } from "./types";
import { CelsiusToKelvin, IsLangSupported, WeatherIconSafely, _ } from "./utils";



export class VisualCrossing implements WeatherProvider {
    readonly prettyName: string = "Visual Crossing";
    readonly name: Services = "Visual Crossing";
    readonly maxForecastSupport: number = 15;
    readonly maxHourlyForecastSupport: number = 336;
    readonly website: string = "https://weather.visualcrossing.com/";
    readonly needsApiKey: boolean = true;

    private url: string = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/";
    private params: HTTPParams = {
        unitGroup: "metric",
        key: null,
        include: "fcst,hours,current",
        /** Raw descriptor ID */
        lang: "id"
    }

    private supportedLangs: string[] = [ "en", "de", "fr", "es"]

    private app: WeatherApplet;

    constructor(app: WeatherApplet) {
        this.app = app;
    }
    
    public async GetWeather(loc: LocationData): Promise<WeatherData> {
        if (loc == null) return null;
        this.params['key'] = this.app.config.ApiKey;
        let translate = true;
        if (IsLangSupported(this.app.config.Language, this.supportedLangs)) {
            this.params['lang'] = this.app.config.Language;
            translate = false;
        }

        let url = this.url + loc.lat + "," + loc.lon;
        let json = await this.app.LoadJsonAsync<VisualCrossingPayload>(url, this.params, (e) => this.HandleHttpError(e));

        if (!json) return null;
        return this.ParseWeather(json, translate);
    }

    private ParseWeather(weather: VisualCrossingPayload, translate: boolean): WeatherData {
        let result: WeatherData = {
            date: new Date(weather.currentConditions.datetimeEpoch * 1000),
            location: {
                url: encodeURI("https://www.visualcrossing.com/weather-history/" + weather.latitude + "," + weather.longitude + "/"),
                timeZone: weather.timezone,
                tzOffset: weather.tzoffset,
            },
            coord: {
                lat: weather.latitude,
                lon: weather.longitude,
            },
            humidity: weather.currentConditions.humidity,
            pressure: weather.currentConditions.pressure,
            wind: {
                degree: weather.currentConditions.winddir,
                speed: weather.currentConditions.windspeed,
            },
            temperature: CelsiusToKelvin(weather.currentConditions.temp),
            sunrise: new Date(weather.currentConditions.sunriseEpoch * 1000),
            sunset: new Date(weather.currentConditions.sunsetEpoch * 1000),
            condition: this.GenerateCondition(weather.currentConditions.icon, weather.currentConditions.conditions, translate),
            extra_field: {
                name: _("Feels Like"),
                type: "temperature",
                value: CelsiusToKelvin(weather.currentConditions.feelslike)
            },
            forecasts: this.ParseForecasts(weather.days, translate),
            hourlyForecasts: this.ParseHourlyForecasts(weather.days, translate)
        }

        return result;
    }

    private ParseForecasts(forecasts: DayForecast[], translate: boolean): ForecastData[] {
        let result: ForecastData[] = [];
        for (let index = 0; index < forecasts.length; index++) {
            const element = forecasts[index];
            result.push({
                date: new Date(element.datetimeEpoch * 1000),
                condition: this.GenerateCondition(element.icon, element.conditions, translate),
                temp_max: CelsiusToKelvin(element.tempmax),
                temp_min: CelsiusToKelvin(element.tempmin)
            });
        }

        return result;
    }

    private ParseHourlyForecasts(forecasts: DayForecast[], translate: boolean): HourlyForecastData[] {
        let currentHour = new Date();
        currentHour.setMinutes(0, 0, 0);
        
        let result: HourlyForecastData[] = [];
        for (let index = 0; index < forecasts.length; index++) {
            const element = forecasts[index];
            for (let index = 0; index < element.hours.length; index++) {
                const hour = element.hours[index];
                let time = new Date(hour.datetimeEpoch * 1000);
                if (time < currentHour) continue;
                let item: HourlyForecastData = {
                    date: time,
                    temp: CelsiusToKelvin(hour.temp),
                    condition: this.GenerateCondition(hour.icon, hour.conditions, translate)
                }

                if (hour.preciptype != null) {
                    item.precipitation = {
                        type: hour.preciptype[0],
                        chance: hour.precipprob,
                        volume: hour.precip
                    }

                    /*if (item.precipitation.type == "snow")
                    item.precipitation.volume = hour.snow;*/
                }

                result.push(item);
            } 
        }
        return result;
    }

    private GenerateCondition(icon: string, condition: string, translate: boolean): Condition {
        let result: Condition = {
            main: (translate) ? this.ResolveTypeID(this.GetFirstCondition(condition)) : this.GetFirstCondition(condition),
            description: (translate) ? this.ResolveTypeIDs(condition) : condition,
            icon: "weather-clear",
            customIcon: "refresh-symbolic"
        };
        let icons: BuiltinIcons[] = [];
        
        switch(icon) {
            case "clear-day":
                icons = ["weather-clear"];
                result.customIcon = "day-sunny-symbolic";
                break;
            case "clear-night":
                icons = ["weather-clear-night"];
                result.customIcon = "night-clear-symbolic";
                break;
            case "partly-cloudy-day":
                icons = ["weather-few-clouds"];
                result.customIcon = "day-cloudy-symbolic";
                break;
            case "partly-cloudy-night":
                icons = ["weather-few-clouds-night"];
                result.customIcon = "night-alt-cloudy-symbolic";
                break;
            case "cloudy":
                icons = ["weather-overcast", "weather-clouds", "weather-many-clouds"];
                result.customIcon = "cloudy-symbolic";
                break;
            case "wind":
                icons = ["weather-windy", "weather-breeze"];
                result.customIcon = "windy-symbolic";
                break;
            case "fog":
                icons = ["weather-fog"];
                result.customIcon = "fog-symbolic";
                break;
            case "rain":
                icons = ["weather-rain", "weather-freezing-rain", "weather-snow-rain",  "weather-showers"];
                result.customIcon = "rain-symbolic";
                break;
            case "snow":
                icons = ["weather-snow"];
                result.customIcon = "snow-symbolic";
                break;
        }

        result.icon = WeatherIconSafely(icons, this.app.config.IconType);
        return result;
    }

    private GetFirstCondition(condition: string): string {
        let split = condition.split(", ");
        return split[0];
    }

    private ResolveTypeID(condition: string): string {
        switch(condition.toLowerCase()) {
            case "type_1":
                return _("Blowing Or Drifting Snow");
            case "type_2":
                return _("Drizzle");
            case "type_3":	
                return _("Heavy Drizzle");
            case "type_4":
                return _("Light Drizzle");
            case "type_5":
                return _("Heavy Drizzle/Rain");
            case "type_6":
                return _("Light Drizzle/Rain");
            case "type_7":
                return _("Duststorm");
            case "type_8":
                return _("Fog");
            case "type_9":
                return _("Freezing Drizzle/Freezing Rain");
            case "type_10":
                return _("Heavy Freezing Drizzle/Freezing Rain");
            case "type_11":
                return _("Light Freezing Drizzle/Freezing Rain");
            case "type_12":
                return _("Freezing Fog");
            case "type_13":
                return _("Heavy Freezing Rain");
            case "type_14":
                return _("Light Freezing Rain");
            case "type_15":
                return _("Funnel Cloud/Tornado");
            case "type_16":
                return _("Hail Showers");
            case "type_17":
                return _("Ice");
            case "type_18":
                return _("Lightning Without Thunder");
            case "type_19":
                return _("Mist");
            case "type_20":
                return _("Precipitation In Vicinity");
            case "type_21":
                return _("Rain");
            case "type_22":
                return _("Heavy Rain And Snow");
            case "type_23":
                return _("Light Rain And Snow");
            case "type_24":
                return _("Rain Showers");
            case "type_25":
                return _("Heavy Rain");
            case "type_26":
                return _("Light Rain");
            case "type_27":
                return _("Sky Coverage Decreasing");
            case "type_28":
                return _("Sky Coverage Increasing");
            case "type_29":
                return _("Sky Unchanged");
            case "type_30":
                return _("Smoke Or Haze");
            case "type_31":
                return _("Snow");
            case "type_32":
                return _("Snow And Rain Showers");
            case "type_33":
                return _("Snow Showers");
            case "type_34":
                return _("Heavy Snow");
            case "type_35":
                return _("Light Snow");
            case "type_36":
                return _("Squalls");
            case "type_37":
                return _("Thunderstorm");
            case "type_38":
                return _("Thunderstorm Without Precipitation");
            case "type_39":
                return _("Diamond Dust");
            case "type_40":
                return _("Hail");
            case "type_41":
                return _("Overcast");
            case "type_42":
                return _("Partially cloudy");
            case "type_43":
                return _("Clear");
        }
        return condition;
    }

    private ResolveTypeIDs(condition: string): string {
        let result = "";
        let split = condition.split(", ");
        for (let index = 0; index < split.length; index++) {
            const element = split[index];
            result += this.ResolveTypeID(element);
            // not the last
            if (index < split.length - 1)
                result += ", ";
        }
        return result;
    }

    private HandleHttpError(error: HttpError): boolean {
        if (error?.code == 401) {
            this.app.ShowError({
                type: "hard",
                userError: true,
                detail: "bad key",
                message: _("Please make sure you entered the API key correctly")
            })
            return false;
        }

        return true;
    }
}

interface VisualCrossingPayload {
    queryCost: number;
    remainingCost: number;
    remainingCredits: number;
    latitude: number;
    longitude: number;
    resolvedAddress: string;
    address: string;
    timezone: string;
    tzoffset: number;
    days?: DayForecast[];
    alerts?: any;
    currentConditions: CurrentObservation;
    stations: {
        [key: string]: Station
    };
}

interface Station {
    distance: number;
    latitude: number;
    longitude: number;
    useCount: number;
    id: string;
    name: string;
    contribution: number;
}

interface CurrentObservation {
    datetime: string;
    datetimeEpoch: number;
    /** C */
    temp: number;
    /** C */
    feelslike: number;
    /** C */
    dew: number;
    /** Percent */
    humidity: number;
    precip: number;
    preciptype?: PrecipitationType[];
    snow?: number;
    snowdepth?: number;
    windgust: number;
    windspeed: number;
    /** degree */
    winddir: number;
    /** hPa */
    pressure: number;
    /** % */
    cloudcover: number;
    visibility: number;
    solarradiation: number;
    solarenergy: number;
    sunrise: string;
    sunriseEpoch: number;
    sunset: string;
    sunsetEpoch: number;
    /** ranging from 0 (the new moon) to 0.5 (the full moon) and back to 1 (the next new moon) */
    moonphase: number;
    conditions: string;
    icon: string;
    stations: null;
    source: Source;
}

interface DayForecast {
    datetime: string;
    datetimeEpoch: number;
    /** C */
    tempmax: number;
    /** C */
    tempmin: number;
    /** C */
    temp: number;
    /** C */
    feelslikemax: number;
    /** C */
    feelslikemin: number;
    /** C */
    feelslike: number;
    dew: number;
    /** Percent */
    humidity: number;
    precip: number;
    precipprob: number;
    precipcover?: number;
    preciptype?: PrecipitationType[];
    snow?: number;
    snowdepth?: number;
    rain?: number;
    windgust: number;
    windspeed: number;
    /** degree */
    winddir: number;
    /** hPa */
    pressure: number;
    /** % */
    cloudcover: number;
    visibility: number;
    solarradiation: number;
    solarenergy: number;
    sunrise: string;
    sunriseEpoch: number;
    sunset: string;
    sunsetEpoch: number;
    moonphase: number;
    conditions: string;
    icon: string;
    stations: null;
    source: Source;
    hours?: HourForecast[];
}

interface HourForecast {
    datetime: string;
    datetimeEpoch: number;
    /** C */
    temp: number;
    /** C */
    feelslike: number;
    dew: number;
    /** Percent */
    humidity: number;
    precip: number;
    precipprob: number;
    preciptype?: PrecipitationType[];
    snow: number;
    snowdepth: number;
    windgust: number;
    windspeed: number;
    /** degree */
    winddir: number;
    /** hPa */
    pressure: number;
    /** % */
    cloudcover: number;
    visibility: number;
    solarradiation: number;
    solarenergy: number;
    conditions: string;
    icon: string;
    stations: null;
    source: Source;
    moonphase: number;
}

type Source = "fcst" | "";