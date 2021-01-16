import { WeatherApplet } from "./main";
import { LocationCache, LocationData } from "./types";
import { get, _ } from "./utils";

/**
 * Nominatim communication interface
 */
export class GeoLocation {
    private url = "https://nominatim.openstreetmap.org/search/";
    private params = "?format=json&addressdetails=1&limit=1";
    private app: WeatherApplet = null;
    private cache: LocationCache = {};

    constructor(app: WeatherApplet) {
        this.app = app;
    }

    public async GetLocation(searchText: string): Promise<LocationData> {
        try {
            searchText = searchText.trim();
            let cached = get([searchText], this.cache);
            if (cached != null) {
                this.app.log.Debug("Returning cached geolocation info for '" + searchText + "'.");
                return cached;
            }

            let locationData = await this.app.LoadJsonAsync(this.url + encodeURIComponent(searchText) + this.params);
            if (locationData.length == 0) {
                this.app.HandleError({
                    type: "hard",
                    detail: "bad location format",
                    message: _("Could not find location based on address, please check if it's right")
                })
                return null;
            }
            this.app.log.Debug("Location is found, payload: " + JSON.stringify(locationData, null, 2));
            let result: LocationData = {
                lat: parseFloat(locationData[0].lat),
                lon: parseFloat(locationData[0].lon),
                city: locationData[0].address.city || locationData[0].address.town,
                country: locationData[0].address.country,
                timeZone: null,
                mobile: null,
                address_string: locationData[0].display_name,
                entryText: this.BuildEntryText(locationData[0]),
                locationSource: "address-search"
            }
            this.cache[searchText] = result;
            return result;
        }
        catch (e) {
            this.app.log.Error("Could not geolocate, error: " + JSON.stringify(e, null, 2));
            this.app.HandleError({
                type: "soft",
                detail: "bad api response",
                message: _("Failed to call Geolocation API, see Looking Glass for errors.")
            })
            return null;
        }
	}
	
	/**
	 * Nominatim doesn't return any result if the State district is included in the search 
	 * in specific case, we have to build it from the address details omitting specific
	 * keys
	 * @param locationData 
	 */
	private BuildEntryText(locationData: any): string {
		if (locationData.address == null) return locationData.display_name;
		let entryText: string[] = [];
		for (let key in locationData.address) {
			if (key == "state_district") continue;
			if (key == "county") continue;
			if (key == "country_code") continue;
			entryText.push(locationData.address[key]);
		}
		return entryText.join(", ");
	}
}