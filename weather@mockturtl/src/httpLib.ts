import { Logger } from "./logger";
import { ErrorDetail } from "./types";
import { _ } from "./utils";

const { Message, Session, ProxyResolverDefault, SessionAsync } = imports.gi.Soup;

export class HttpLib {
	/** Soup session (see https://bugzilla.gnome.org/show_bug.cgi?id=661323#c64) */
	private readonly _httpSession = new SessionAsync();

	constructor() {
		this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0"; // ipapi blocks non-browsers agents, imitating browser
        this._httpSession.timeout = 10;
		this._httpSession.idle_timeout = 10;
		Session.prototype.add_feature.call(this._httpSession, new ProxyResolverDefault());
	}

	/**
	 * Handles obtaining JSON over http. 
	 * returns HTTPError object on fail.
	 * @param query fully constructed url
	 * @param errorCallback do checking before generic error checking by this function, to display API specific UI errors. should return null if
	 * everything is ok, AppletError to display if there is an error
	 */
    public async LoadJsonAsync<T>(url: string, params?: any, method: Method = "GET"): Promise<Response<T>> {
		let response = await this.LoadAsync(url, params, method);
		
		if (!response.Success) {
			return response;
		}

		try {
			let payload = JSON.parse(response.Data);
			response.Data = payload;
		} 
		catch (e) { // Payload is not JSON
			Logger.Error("Error: API response is not JSON. The response: " + response.Data);
			response.Success = false;
			response.ErrorData = {
				code: -1,
				message: "bad api response - non json",
				reason_phrase: null,
			}
		}
		finally {
			return response as Response<T>;
		}
	}
	
	/**
	 * Handles obtaining data over http. 
	 * @returns HTTPError object on fail.
	 * @param query fully constructed url
	 */
    public async LoadAsync(url: string, params?: any, method: Method = "GET"): Promise<GenericResponse> {
		let message = await this.Send(url, params, method);

		let error: HttpError = null;

		// Error regenration
		if (!message) {
			error = {
				code: 0,
				message: "no network response",
				reason_phrase: "no network response",
				response: null
			}
		}
		else if (message.status_code > 300 || message.status_code < 200) {
			error = {
				code: message.status_code,
				message: "bad status code",
				reason_phrase: message.reason_phrase,
				response: message
			}
		}
		else if (!message.response_body) {
			error = { 
				code: message.status_code,
				message: "no response body",
				reason_phrase: message.reason_phrase,
				response: message
			}
		}
		else if (!message.response_body.data) {
			error = {
				code: message.status_code,
				message: "no response data",
				reason_phrase: message.reason_phrase,
				response: message
			}
		}

		Logger.Debug2("API full response: " + message?.response_body?.data?.toString());
        return {
			Success: (error == null),
			Data: message?.response_body?.data,
			ErrorData: error
		}
	}
	
	/**
	 * Send a http request
	 * @param url 
	 * @param params 
	 * @param method 
	 */
	public async Send(url: string, params?: any, method: Method = "GET"): Promise<imports.gi.Soup.Message> {
		// Add params to url
		if (params != null) {
			url += "?"
			let items = Object.keys(params);
			for (let index = 0; index < items.length; index++) {
				const item = items[index];
				url += (index == 0) ? "?" : "&";
				url += (item) + "=" + params[item]
			}
		}

		let query = encodeURI(url);
		Logger.Debug("URL called: " + query);
		let data: imports.gi.Soup.Message = await new Promise((resolve, reject) => {
			let message = Message.new(method, query);
			this._httpSession.queue_message(message, (session, message) => {
                resolve(message);
			});
		});

		return data;
	}
}

export const Http = new HttpLib();

// Declaarations

export type Method = "GET" | "POST" | "PUT" | "DELETE";
export type NetworkError = "";

export interface Response<T> extends GenericResponse {
	Data: T,
}

interface GenericResponse {
	Success: boolean;
	Data: any;
	ErrorData: HttpError;
}

export interface HttpError {
    code: number;
    message: ErrorDetail;
    reason_phrase: string;
	data?: any;
	response?: imports.gi.Soup.Message
}