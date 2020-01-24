var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
function importModule(path) {
    if (typeof require !== 'undefined') {
        return require('./' + path);
    }
    else {
        if (!AppletDir)
            var AppletDir = imports.ui.appletManager.applets['weather@mockturtl'];
        return AppletDir[path];
    }
}
var utils = importModule("utils");
var isCoordinate = utils.isCoordinate;
var icons = utils.icons;
var weatherIconSafely = utils.weatherIconSafely;
var CelsiusToKelvin = utils.CelsiusToKelvin;
var spawn_async = imports.misc.util.spawn_async;
var MetNorway = (function () {
    function MetNorway(app) {
        this.baseUrl = "https://api.met.no/weatherapi/locationforecast/1.9/?";
        this.ctx = this;
        this.app = app;
        this.appletDir = app.appletDir + "/../";
    }
    MetNorway.prototype.GetWeather = function () {
        return __awaiter(this, void 0, void 0, function () {
            var query, json, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = this.GetUrl();
                        if (!(query != "" && query != null)) return [3, 6];
                        this.app.log.Debug("MET Norway API query: " + query);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4, this.SpawnProcess(this.GetUrl())];
                    case 2:
                        json = _a.sent();
                        return [3, 4];
                    case 3:
                        e_1 = _a.sent();
                        this.app.HandleHTTPError("met-norway", e_1, this.app);
                        return [2, null];
                    case 4:
                        if (!json) {
                            this.app.HandleError({ type: "soft", detail: "no api response", service: "met-norway" });
                            return [2, null];
                        }
                        json = JSON.parse(json);
                        if (json.error) {
                            this.app.HandleError({ type: "hard", detail: "bad api response", "service": "met-norway" });
                            return [2, null];
                        }
                        return [4, this.ParseWeather(json)];
                    case 5: return [2, _a.sent()];
                    case 6: return [2, null];
                }
            });
        });
    };
    MetNorway.prototype.SpawnProcess = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var json;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        global.log(this.appletDir);
                        return [4, new Promise(function (resolve, reject) {
                                spawn_async(['python', _this.appletDir + '/xmlParser.py', url], function (aStdout) {
                                    resolve(aStdout);
                                });
                            })];
                    case 1:
                        json = _a.sent();
                        return [2, json];
                }
            });
        });
    };
    MetNorway.prototype.ParseWeather = function (json) {
        return __awaiter(this, void 0, void 0, function () {
            var parsedWeathers, parsed6hourly, parsedHourly, i, element, fromDate, toDate, item, temp, minTemp, symbol, forecasts, result;
            return __generator(this, function (_a) {
                json = json.weatherdata.product.time;
                parsedWeathers = [];
                parsed6hourly = [];
                parsedHourly = [];
                for (i = 0; i < json.length; i++) {
                    element = json[i];
                    fromDate = new Date(element["@from"]);
                    toDate = new Date(element["@to"]);
                    item = element.location;
                    temp = item.temperature;
                    minTemp = item.minTemperature;
                    symbol = item.symbol;
                    if (!!temp) {
                        parsedWeathers.push(this.ParseCurrentWeather(item, fromDate, toDate));
                    }
                    else if (!!minTemp && !!symbol) {
                        parsed6hourly.push(this.Parse6HourForecast(item, fromDate, toDate));
                    }
                    else if (!minTemp && !!symbol) {
                        parsedHourly.push(this.ParseHourlyForecast(item, fromDate, toDate));
                    }
                }
                forecasts = this.BuildForecasts(parsed6hourly);
                result = {
                    temperature: CelsiusToKelvin(parsedWeathers[0].temperature),
                    coord: {
                        lat: parsedWeathers[0].lat,
                        lon: parsedWeathers[0].lon
                    },
                    date: parsedWeathers[0].from,
                    condition: this.ResolveCondition(parsedHourly[0].symbol),
                    humidity: parsedWeathers[0].humidity,
                    pressure: parsedWeathers[0].pressure,
                    extra_field: {
                        name: _("Cloudiness:"),
                        type: "percent",
                        value: parsedWeathers[0].cloudiness
                    },
                    sunrise: null,
                    sunset: null,
                    wind: {
                        degree: parsedWeathers[0].windDirection,
                        speed: parsedWeathers[0].windSpeed
                    },
                    location: {
                        url: null,
                    },
                    forecasts: forecasts
                };
                return [2, result];
            });
        });
    };
    MetNorway.prototype.GetEarliestData = function (events) {
        var earliest = 0;
        for (var i = 0; i < events.length; i++) {
            var element = events[i];
            var earliestElement = events[earliest];
            if (earliestElement.from < element.from)
                continue;
            earliest = i;
        }
        return events[earliest];
    };
    MetNorway.prototype.BuildForecasts = function (forecastsData) {
        var forecasts = [];
        var days = [];
        var currentDay = this.GetEarliestData(forecastsData).from.toDateString();
        var dayIndex = 0;
        days.push([]);
        for (var i = 0; i < forecastsData.length; i++) {
            var element = forecastsData[i];
            if (element.from.toDateString() == currentDay && element.to.toDateString() == currentDay) {
                days[dayIndex].push(element);
            }
            else if (element.from.toDateString() != currentDay && element.to.toDateString() != currentDay) {
                dayIndex++;
                currentDay = element.from.toDateString();
                days.push([]);
                days[dayIndex].push(element);
            }
        }
        for (var i = 0; i < days.length; i++) {
            var forecast = {
                condition: {
                    customIcon: "Cloud",
                    description: "",
                    icon: "weather-severe-alert",
                    main: ""
                },
                date: null,
                temp_max: Number.NEGATIVE_INFINITY,
                temp_min: Number.POSITIVE_INFINITY
            };
            var conditionCounter = {};
            for (var j = 0; j < days[i].length; j++) {
                var element = days[i][j];
                forecast.date = element.from;
                if (element.maxTemperature > forecast.temp_max)
                    forecast.temp_max = element.maxTemperature;
                if (element.minTemperature < forecast.temp_min)
                    forecast.temp_min = element.minTemperature;
                conditionCounter[element.symbol] = (!!conditionCounter[element.symbol]) ? conditionCounter[element.symbol]++ : 1;
            }
            forecast.temp_max = CelsiusToKelvin(forecast.temp_max);
            forecast.temp_min = CelsiusToKelvin(forecast.temp_min);
            forecast.condition = this.ResolveCondition(this.GetMostCommonCondition(conditionCounter));
            forecasts.push(forecast);
        }
        return forecasts;
    };
    MetNorway.prototype.GetMostCommonCondition = function (count) {
        var result = null;
        for (var key in count) {
            if (result == null)
                result = key;
            if (count[result] < count[key])
                result = key;
        }
        return result;
    };
    MetNorway.prototype.ParseCurrentWeather = function (element, from, to) {
        return {
            temperature: parseFloat(element.temperature['@value']),
            lat: element["@latitude"],
            lon: element["@longitude"],
            windDirection: parseFloat(element.windDirection["@deg"]),
            windSpeed: parseFloat(element.windSpeed["@mps"]),
            humidity: parseFloat(element.humidity["@value"]),
            pressure: parseFloat(element.pressure["@value"]),
            cloudiness: parseFloat(element.cloudiness["@percent"]),
            lowClouds: parseFloat(element.lowClouds["@percent"]),
            mediumClouds: parseFloat(element.mediumClouds["@percent"]),
            highClouds: parseFloat(element.highClouds["@percent"]),
            dewpointTemperature: parseFloat(element.dewpointTemperature["@value"]),
            from: from,
            to: to
        };
    };
    MetNorway.prototype.Parse6HourForecast = function (element, from, to) {
        return {
            precipitation: parseFloat(element.precipitation["@value"]),
            minTemperature: parseFloat(element.minTemperature["@value"]),
            maxTemperature: parseFloat(element.maxTemperature["@value"]),
            from: from,
            to: to,
            symbol: element.symbol["@id"]
        };
    };
    MetNorway.prototype.ParseHourlyForecast = function (element, from, to) {
        return {
            precipitation: parseFloat(element.precipitation["@value"]),
            from: from,
            to: to,
            symbol: element.symbol["@id"]
        };
    };
    MetNorway.prototype.GetUrl = function () {
        var location = this.app._location.replace(" ", "");
        var url = this.baseUrl + "lat=";
        if (!isCoordinate(location))
            return "";
        var latLon = location.split(",");
        url += (latLon[0] + "&lon=" + latLon[1]);
        return url;
    };
    MetNorway.prototype.ResolveCondition = function (icon) {
        var condition = icon.replace("Dark_", "");
        switch (condition) {
            case "Cloud":
                return {
                    customIcon: "Cloud",
                    main: _("Cloudy"),
                    description: _("Cloudy"),
                    icon: weatherIconSafely([icons.overcast, icons.clouds, icons.few_clouds_day], this.app._icon_type)
                };
            case "Drizzle":
                return {
                    customIcon: "Cloud-Drizzle",
                    main: _("Drizzle"),
                    description: _("Drizzle"),
                    icon: weatherIconSafely([icons.rain, icons.showers_scattered, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "DrizzleSun":
                return {
                    customIcon: "Cloud-Drizzle-Sun",
                    main: _("Drizzle"),
                    description: _("Drizzle"),
                    icon: weatherIconSafely([icons.showers_scattered, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "DrizzleThunder":
                return {
                    customIcon: "Cloud-Drizzle",
                    main: _("Drizzle"),
                    description: _("Drizzle with Thunderstorms"),
                    icon: weatherIconSafely([icons.showers_scattered, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "DrizzleThunderSun":
                return {
                    customIcon: "Cloud-Drizzle",
                    main: _("Mostly Drizzle"),
                    description: _("Mostly Drizzle with Thunderstorms"),
                    icon: weatherIconSafely([icons.rain, icons.showers_scattered, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "Fog":
                return {
                    customIcon: "Cloud-Fog",
                    main: _("Fog"),
                    description: _("Fog"),
                    icon: weatherIconSafely([icons.fog, icons.alert], this.app._icon_type)
                };
            case "HeavySleet":
                return {
                    customIcon: "Cloud-Hail",
                    main: _("Heavy Sleet"),
                    description: _("Heavy Sleet"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.rain, icons.alert], this.app._icon_type)
                };
            case "HeavySleetSun":
                return {
                    customIcon: "Cloud-Hail-Sun",
                    main: _("Heavy Sleet"),
                    description: _("Mostly Heavy Sleet"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.rain, icons.alert], this.app._icon_type)
                };
            case "HeavySleetThunder":
                return {
                    customIcon: "Cloud-Hail",
                    main: _("Heavy Sleet"),
                    description: _("Heavy Sleet with Thundertorms"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.rain, icons.alert], this.app._icon_type)
                };
            case "HeavySleetThunderSun":
                return {
                    customIcon: "Cloud-Hail-Sun",
                    main: _("Heavy Sleet"),
                    description: _("Mostly Heavy Sleet with Thunderstorms"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.rain, icons.alert], this.app._icon_type)
                };
            case "HeavySnow":
                return {
                    customIcon: "Cloud-Snow",
                    main: _("heavy Snow"),
                    description: _("Heavy Snow"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "HeavySnowThunder":
                return {
                    customIcon: "Cloud-Snow",
                    main: _("Heavy Snow"),
                    description: _("Heavy Snow with Thunderstorm"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "HeavySnowThunderSun":
                return {
                    customIcon: "Cloud-Snow-Sun",
                    main: _("Heavy Snow"),
                    description: _("Heavy Snow with Thunderstorm"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "HeavysnowSun":
                return {
                    customIcon: "Cloud-Snow-Sun",
                    main: _("Heavy Snow"),
                    description: _("Heavy Snow"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "LightCloud":
                return {
                    customIcon: "Cloud-Sun",
                    main: _("Mostly Sunny"),
                    description: _("Mostly Sunny"),
                    icon: weatherIconSafely([icons.few_clouds_day, icons.alert], this.app._icon_type)
                };
            case "LightRain":
                return {
                    customIcon: "Cloud-Rain-Sun",
                    main: _("Light Rain"),
                    description: _("Light Rain"),
                    icon: weatherIconSafely([icons.showers_scattered, icons.rain, icons.alert], this.app._icon_type)
                };
            case "LightRainSun":
                return {
                    customIcon: "Cloud-Rain-Sun",
                    main: _("Light Rain"),
                    description: _(""),
                    icon: weatherIconSafely([icons.showers_scattered, icons.rain, icons.alert], this.app._icon_type)
                };
            case "LightRainThunder":
                return {
                    customIcon: "Cloud-Rain",
                    main: _("Light Rain"),
                    description: _("Light Rain with Thunderstorms"),
                    icon: weatherIconSafely([icons.showers_scattered, icons.rain, icons.alert], this.app._icon_type)
                };
            case "LightRainThunderSun":
                return {
                    customIcon: "Cloud-Rain-Sun",
                    main: _("Light Rain"),
                    description: _("Mostly Ligh Rain with Thunderstorms"),
                    icon: weatherIconSafely([icons.showers_scattered, icons.rain, icons.alert], this.app._icon_type)
                };
            case "LightSleet":
                return {
                    customIcon: "Cloud-Hail",
                    main: _("Light Sleet"),
                    description: _("Light Sleet"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
                };
            case "LightSleetSun":
                return {
                    customIcon: "Cloud-Hail-Sun",
                    main: _("Light Sleet"),
                    description: _("Mostly Light Sleet"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
                };
            case "LightSleetThunder":
                return {
                    customIcon: "Cloud-Hail",
                    main: _("Light Sleet"),
                    description: _("Light Sleet with Thunderstorms"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
                };
            case "LightSleetThunderSun":
                return {
                    customIcon: "Cloud-Hail-Sun",
                    main: _("Light Sleet"),
                    description: _("Mostly Light Sleet with Thunderstorms"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
                };
            case "LightSnow":
                return {
                    customIcon: "Cloud-Snow",
                    main: _("Light Snow"),
                    description: _("Light Snow"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "LightSnowSun":
                return {
                    customIcon: "Cloud-Snow-Sun",
                    main: _("Light Snow"),
                    description: _("Mostly Light Snow"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "LightSnowThunder":
                return {
                    customIcon: "Cloud-Snow",
                    main: _("Light Snow"),
                    description: _("Light Snow with Thunderstorms"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "LightSnowThunderSun":
                return {
                    customIcon: "Cloud-Snow-Sun",
                    main: _("Light Snow"),
                    description: _("Mostly Light Snow with Thunderstorms"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "PartlyCloud":
                return {
                    customIcon: "Cloud-Sun",
                    main: _("Partly Cloudy"),
                    description: _("Partly Cloudy"),
                    icon: weatherIconSafely([icons.few_clouds_day, icons.clouds, icons.overcast, icons.alert], this.app._icon_type)
                };
            case "Rain":
                return {
                    customIcon: "Cloud-Rain",
                    main: _("Rain"),
                    description: _("Rain"),
                    icon: weatherIconSafely([icons.rain, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "RainSun":
                return {
                    customIcon: "Cloud-Rain-Sun",
                    main: _("Mostly Rainy"),
                    description: _("Mostly Rainy"),
                    icon: weatherIconSafely([icons.rain, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "RainThunder":
                return {
                    customIcon: "Cloud-Lightning",
                    main: _("Rain"),
                    description: _("Rain with Thunderstorm"),
                    icon: weatherIconSafely([icons.storm, icons.rain, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "RainThunderSun":
                return {
                    customIcon: "Cloud-Lightning-Sun",
                    main: _("Rain"),
                    description: _("Mostly Rainy with Thunderstorms"),
                    icon: weatherIconSafely([icons.storm, icons.rain, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "Sleet":
                return {
                    customIcon: "Cloud-Hail",
                    main: _("Sleet"),
                    description: _("Sleet"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
                };
            case "SleetSun":
                return {
                    customIcon: "Cloud-Hail-Sun",
                    main: _("Sleet"),
                    description: _("Mostly Sleet"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
                };
            case "SleetSunThunder":
                return {
                    customIcon: "Cloud-Hail-Sun",
                    main: _("Sleet"),
                    description: _("Mostly Sleet with Thunderstorms"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
                };
            case "SleetThunder":
                return {
                    customIcon: "Cloud-Hail",
                    main: _("Sleet"),
                    description: _("Sleet with Thunderstorms"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
                };
            case "Snow":
                return {
                    customIcon: "Cloud-Snow",
                    main: _("Snow"),
                    description: _("Snowy"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "SnowSun":
                return {
                    customIcon: "Cloud-Snow-Sun",
                    main: _("Mostly Snowy"),
                    description: _("Mostly Snowy"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "SnowSunThunder":
                return {
                    customIcon: "Cloud-Snow-Sun",
                    main: _("Mostly Snowy"),
                    description: _("Mostly Snowy with Thunder"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "SnowThunder":
                return {
                    customIcon: "Cloud-Snow",
                    main: _("Snow"),
                    description: _("Snowy with Thunder"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "Sun":
                return {
                    customIcon: "Sun",
                    main: _("Sunny"),
                    description: _("Sunny"),
                    icon: weatherIconSafely([icons.clear_day, icons.alert], this.app._icon_type)
                };
        }
    };
    return MetNorway;
}());
