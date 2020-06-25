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
const UUID = "weather@mockturtl";
imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
    return imports.gettext.dgettext(UUID, str);
}
var utils = importModule("utils");
var isCoordinate = utils.isCoordinate;
var weatherIconSafely = utils.weatherIconSafely;
var SunCalc = importModule("sunCalc").SunCalc;
var IsNight = utils.IsNight;
var CelsiusToKelvin = utils.CelsiusToKelvin;
var MPHtoMPS = utils.MPHtoMPS;
var compassToDeg = utils.compassToDeg;
var GetDistance = utils.GetDistance;
class MetUk {
    constructor(_app) {
        this.prettyName = "Met Office UK";
        this.name = "Met Office UK";
        this.maxForecastSupport = 5;
        this.website = "https://www.metoffice.gov.uk/";
        this.maxHourlyForecastSupport = 36;
        this.baseUrl = "http://datapoint.metoffice.gov.uk/public/data/val/";
        this.forecastPrefix = "wxfcs/all/json/";
        this.threeHourlyUrl = "?res=3hourly";
        this.dailyUrl = "?res=daily";
        this.currentPrefix = "wxobs/all/json/";
        this.sitesUrl = "sitelist";
        this.key = "key=05de1ee8-de70-46aa-9b41-299d4cc60219";
        this.hourlyAccess = true;
        this.forecastSite = null;
        this.observationSite = null;
        this.app = _app;
        this.sunCalc = new SunCalc();
    }
    async GetWeather() {
        if (!isCoordinate(this.app.config._location)) {
            this.app.HandleError({
                detail: "bad location format",
                type: "hard",
                userError: true,
                service: "met-uk",
                message: "Please make sure location is in the correct format"
            });
            this.app.log.Error("MET UK - Location is not coordinate, aborting");
            return null;
        }
        let forecastSitelist = await this.app.LoadJsonAsync(this.baseUrl + this.forecastPrefix + this.sitesUrl + "?" + this.key);
        let currentSitelist = await this.app.LoadJsonAsync(this.baseUrl + this.currentPrefix + this.sitesUrl + "?" + this.key);
        this.forecastSite = this.GetClosestSite(forecastSitelist, this.app.config._location);
        this.observationSite = this.GetClosestSite(currentSitelist, this.app.config._location);
        this.app.log.Debug("Forecast site found: " + JSON.stringify(this.forecastSite, null, 2));
        this.app.log.Debug("Observation site found: " + JSON.stringify(this.observationSite, null, 2));
        if (this.forecastSite.dist > 100000 || this.observationSite.dist > 100000) {
            this.app.log.Error("User is probably not in UK, aborting");
            this.app.HandleError({
                type: "hard",
                userError: true,
                detail: "location not found",
                message: "MET Office UK only covers the UK, please make sure your location is in the country",
                service: "met-uk"
            });
            return null;
        }
        let forecastPromise = this.GetData(this.baseUrl + this.forecastPrefix + this.forecastSite.id + this.dailyUrl + "&" + this.key, this.ParseForecast);
        let hourlyPromise = null;
        if (!!this.hourlyAccess)
            hourlyPromise = this.GetData(this.baseUrl + this.forecastPrefix + this.forecastSite.id + this.threeHourlyUrl + "&" + this.key, this.ParseHourlyForecast);
        let currentResult = await this.GetData(this.baseUrl + this.currentPrefix + this.observationSite.id + "?res=hourly&" + this.key, this.ParseCurrent);
        if (!currentResult)
            return null;
        let forecastResult = await forecastPromise;
        currentResult.forecasts = (!forecastResult) ? [] : forecastResult;
        let hourlyResult = await hourlyPromise;
        currentResult.hourlyForecasts = (!hourlyResult) ? [] : hourlyResult;
        return currentResult;
    }
    ;
    async GetData(query, ParseFunction) {
        let json;
        if (query != null) {
            this.app.log.Debug("Query: " + query);
            try {
                json = await this.app.LoadJsonAsync(query);
            }
            catch (e) {
                this.app.HandleHTTPError("met-uk", e, this.app, null);
                return null;
            }
            if (json == null) {
                this.app.HandleError({ type: "soft", detail: "no api response", service: "met-uk" });
                return null;
            }
            return ParseFunction(json, this);
        }
        else {
            return null;
        }
    }
    ;
    ParseCurrent(json, self) {
        let timestamp = new Date(json.SiteRep.DV.dataDate);
        let observation = self.GetLatestObservation(json.SiteRep.DV.Location.Period, timestamp);
        if (!observation) {
            return null;
        }
        let times = self.sunCalc.getTimes(new Date(), parseFloat(json.SiteRep.DV.Location.lat), parseFloat(json.SiteRep.DV.Location.lon), parseFloat(json.SiteRep.DV.Location.elevation));
        try {
            let weather = {
                coord: {
                    lat: parseFloat(json.SiteRep.DV.Location.lat),
                    lon: parseFloat(json.SiteRep.DV.Location.lon)
                },
                location: {
                    city: null,
                    country: null,
                    url: null,
                    timeZone: null
                },
                date: timestamp,
                sunrise: times.sunrise,
                sunset: times.sunset,
                wind: {
                    speed: MPHtoMPS(parseFloat(observation.S)),
                    degree: compassToDeg(observation.D)
                },
                temperature: CelsiusToKelvin(parseFloat(observation.T)),
                pressure: parseFloat(observation.P),
                humidity: parseFloat(observation.H),
                condition: self.ResolveCondition(observation.W),
                extra_field: {
                    name: _("Visibility"),
                    value: self.VisibilityToText(observation.V),
                    type: "string"
                },
                forecasts: []
            };
            return weather;
        }
        catch (e) {
            self.app.log.Error("Met UK Weather Parsing error: " + e);
            self.app.HandleError({ type: "soft", service: "met-uk", detail: "unusal payload", message: _("Failed to Process Current Weather Info") });
            return null;
        }
    }
    ;
    ParseForecast(json, self) {
        let forecasts = [];
        try {
            for (let i = 0; i < json.SiteRep.DV.Location.Period.length; i++) {
                let element = json.SiteRep.DV.Location.Period[i];
                let day = element.Rep[0];
                let night = element.Rep[1];
                let forecast = {
                    date: new Date(self.PartialToISOString(element.value)),
                    temp_min: CelsiusToKelvin(parseFloat(night.Nm)),
                    temp_max: CelsiusToKelvin(parseFloat(day.Dm)),
                    condition: self.ResolveCondition(day.W),
                };
                forecasts.push(forecast);
            }
            return forecasts;
        }
        catch (e) {
            self.app.log.Error("MET UK Forecast Parsing error: " + e);
            self.app.HandleError({ type: "soft", service: "met-uk", detail: "unusal payload", message: _("Failed to Process Forecast Info") });
            return null;
        }
    }
    ;
    ParseHourlyForecast(json, self) {
        let forecasts = [];
        try {
            for (let i = 0; i < json.SiteRep.DV.Location.Period.length; i++) {
                let day = json.SiteRep.DV.Location.Period[i];
                let date = new Date(self.PartialToISOString(day.value));
                for (let index = 0; index < day.Rep.length; index++) {
                    const hour = day.Rep[index];
                    let timestamp = new Date(date.getTime());
                    timestamp.setHours(timestamp.getHours() + (parseInt(hour.$) / 60));
                    if (timestamp < new Date())
                        continue;
                    let forecast = {
                        date: timestamp,
                        temp: CelsiusToKelvin(parseFloat(hour.T)),
                        condition: self.ResolveCondition(hour.W),
                        precipation: {
                            type: "rain",
                            volume: null,
                            chance: parseFloat(hour.Pp)
                        }
                    };
                    forecasts.push(forecast);
                }
            }
            return forecasts;
        }
        catch (e) {
            self.app.log.Error("MET UK Forecast Parsing error: " + e);
            self.app.HandleError({ type: "soft", service: "met-uk", detail: "unusal payload", message: _("Failed to Process Forecast Info") });
            return null;
        }
    }
    VisibilityToText(dist) {
        let distance = parseInt(dist);
        if (distance < 1000)
            return _("Very poor - Less than 1 km");
        if (distance < 4000)
            return _("Poor - Between 1-4 km");
        if (distance < 10000)
            return _("Moderate - Between 4-10 km");
        if (distance < 20000)
            return _("Good - Between 10-20 km");
        if (distance < 40000)
            return _("Very good - Between 20-40 km");
        return _("Excellent - More than 40 km");
    }
    GetLatestObservation(observations, day) {
        for (let index = 0; index < observations.length; index++) {
            const element = observations[index];
            let date = new Date(this.PartialToISOString(element.value));
            if (date.toLocaleDateString() != day.toLocaleDateString())
                continue;
            return element.Rep[element.Rep.length - 1];
        }
        return null;
    }
    PartialToISOString(date) {
        return (date.replace("Z", "")) + "T00:00:00Z";
    }
    GetClosestSite(siteList, loc) {
        let sites = siteList.Locations.Location;
        let latlong = loc.split(",");
        let closest = sites[0];
        closest.dist = GetDistance(parseFloat(closest.latitude), parseFloat(closest.longitude), parseFloat(latlong[0]), parseFloat(latlong[1]));
        for (let index = 0; index < sites.length; index++) {
            const element = sites[index];
            element.dist = GetDistance(parseFloat(element.latitude), parseFloat(element.longitude), parseFloat(latlong[0]), parseFloat(latlong[1]));
            if (element.dist < closest.dist) {
                closest = element;
            }
        }
        return closest;
    }
    ResolveCondition(icon) {
        let iconType = this.app.config.IconType();
        switch (icon) {
            case "NA":
                return {
                    main: _("Unknown"),
                    description: _("Unknown"),
                    customIcon: "cloud-refresh-symbolic",
                    icon: weatherIconSafely(["weather-severe-alert"], iconType)
                };
            case "0":
                return {
                    main: _("Clear"),
                    description: _("Clear"),
                    customIcon: "night-clear-symbolic",
                    icon: weatherIconSafely(["weather-clear-night", "weather-severe-alert"], iconType)
                };
            case "1":
                return {
                    main: _("Sunny"),
                    description: _("Sunny"),
                    customIcon: "day-sunny-symbolic",
                    icon: weatherIconSafely(["weather-clear", "weather-severe-alert"], iconType)
                };
            case "2":
                return {
                    main: _("Partly Cloudy"),
                    description: _("Partly Cloudy"),
                    customIcon: "night-alt-cloudy-symbolic",
                    icon: weatherIconSafely(["weather-clouds-night", "weather-overcast", "weather-severe-alert"], iconType)
                };
            case "3":
                return {
                    main: _("Partly Cloudy"),
                    description: _("Partly Cloudy"),
                    customIcon: "day-cloudy-symbolic",
                    icon: weatherIconSafely(["weather-clouds", "weather-overcast", "weather-severe-alert"], iconType)
                };
            case "4":
                return {
                    main: _("Unknown"),
                    description: _("Unknown"),
                    customIcon: "cloud-refresh-symbolic",
                    icon: weatherIconSafely(["weather-severe-alert"], iconType)
                };
            case "5":
                return {
                    main: _("Mist"),
                    description: _("Mist"),
                    customIcon: "fog-symbolic",
                    icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
                };
            case "6":
                return {
                    main: _("Fog"),
                    description: _("Fog"),
                    customIcon: "fog-symbolic",
                    icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
                };
            case "7":
                return {
                    main: _("Cloudy"),
                    description: _("Cloudy"),
                    customIcon: "cloud-symbolic",
                    icon: weatherIconSafely(["weather-overcast", "weather-many-clouds", "weather-severe-alert"], iconType)
                };
            case "8":
                return {
                    main: _("Overcast"),
                    description: _("Overcast"),
                    customIcon: "cloudy-symbolic",
                    icon: weatherIconSafely(["weather-overcast", "weather-many-clouds", "weather-severe-alert"], iconType)
                };
            case "9":
                return {
                    main: _("Light Rain"),
                    description: _("Light rain shower"),
                    customIcon: "night-alt-showers-symbolic",
                    icon: weatherIconSafely(["weather-showers-scattered-night", "weather-showers-night", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "10":
                return {
                    main: _("Light Rain"),
                    description: _("Light rain shower"),
                    customIcon: "day-showers-symbolic",
                    icon: weatherIconSafely(["weather-showers-scattered-day", "weather-showers-day", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "11":
                return {
                    main: _("Drizzle"),
                    description: _("Drizzle"),
                    customIcon: "showers-symbolic",
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "12":
                return {
                    main: _("Light Rain"),
                    description: _("Light rain"),
                    customIcon: "showers-symbolic",
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "13":
                return {
                    main: _("Heavy Rain"),
                    description: _("Heavy rain shower"),
                    customIcon: "night-alt-rain-symbolic",
                    icon: weatherIconSafely(["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "14":
                return {
                    main: _("Heavy Rain"),
                    description: _("Heavy rain shower"),
                    customIcon: "day-rain-symbolic",
                    icon: weatherIconSafely(["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "15":
                return {
                    main: _("Heavy Rain"),
                    description: _("Heavy Rain"),
                    customIcon: "rain-symbolic",
                    icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "16":
                return {
                    main: _("Sleet"),
                    description: _("Sleet shower"),
                    customIcon: "night-alt-rain-mix-symbolic",
                    icon: weatherIconSafely(["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "17":
                return {
                    main: _("Sleet"),
                    description: _("Sleet shower"),
                    customIcon: "day-rain-mix-symbolic",
                    icon: weatherIconSafely(["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "18":
                return {
                    main: _("Sleet"),
                    description: _("Sleet"),
                    customIcon: "rain-mix-symbolic",
                    icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "19":
                return {
                    main: _("Hail"),
                    description: _("Hail shower"),
                    customIcon: "night-alt-hail-symbolic",
                    icon: weatherIconSafely(["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "20":
                return {
                    main: _("Hail"),
                    description: _("Hail shower"),
                    customIcon: "day-hail-symbolic",
                    icon: weatherIconSafely(["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "21":
                return {
                    main: _("Hail"),
                    description: _("Hail"),
                    customIcon: "hail-symbolic",
                    icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "22":
                return {
                    main: _("Light Snow"),
                    description: _("Light snow shower"),
                    customIcon: "night-alt-snow-symbolic",
                    icon: weatherIconSafely(["weather-snow-scattered", "weather-snow", "weather-severe-alert"], iconType)
                };
            case "23":
                return {
                    main: _("Light Snow"),
                    description: _("Light snow shower"),
                    customIcon: "day-snow-symbolic",
                    icon: weatherIconSafely(["weather-snow-scattered", "weather-snow", "weather-severe-alert"], iconType)
                };
            case "24":
                return {
                    main: _("Light Snow"),
                    description: _("Light snow"),
                    customIcon: "snow-symbolic",
                    icon: weatherIconSafely(["weather-snow-scattered", "weather-snow", "weather-severe-alert"], iconType)
                };
            case "25":
                return {
                    main: _("Heavy Snow"),
                    description: _("Heavy snow shower"),
                    customIcon: "night-alt-snow-symbolic",
                    icon: weatherIconSafely(["weather-snow", "weather-snow-scattered", "weather-severe-alert"], iconType)
                };
            case "26":
                return {
                    main: _("Heavy Snow"),
                    description: _("Heavy snow shower"),
                    customIcon: "day-snow-symbolic",
                    icon: weatherIconSafely(["weather-snow", "weather-snow-scattered", "weather-severe-alert"], iconType)
                };
            case "27":
                return {
                    main: _("Heavy Snow"),
                    description: _("Heavy snow"),
                    customIcon: "snow-symbolic",
                    icon: weatherIconSafely(["weather-snow", "weather-snow-scattered", "weather-severe-alert"], iconType)
                };
            case "28":
                return {
                    main: _("Thunder"),
                    description: _("Thunder shower"),
                    customIcon: "day-storm-showers-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
                };
            case "29":
                return {
                    main: _("Thunder"),
                    description: _("Thunder shower"),
                    customIcon: "night-alt-storm-showers-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
                };
            case "30":
                return {
                    main: _("Thunder"),
                    description: _("UnThunderknown"),
                    customIcon: "thunderstorm-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
                };
            default:
                return {
                    main: _("Unknown"),
                    description: _("Unknown"),
                    customIcon: "cloud-refresh-symbolic",
                    icon: weatherIconSafely(["weather-severe-alert"], iconType)
                };
        }
    }
    ;
}
;
