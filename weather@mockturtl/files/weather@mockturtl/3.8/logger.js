"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Log = void 0;
const UUID = "weather@mockturtl";
class Log {
    constructor(_instanceId) {
        this.debug = false;
        this.level = 1;
        this.ID = _instanceId;
        this.appletDir = imports.ui.appletManager.appletMeta[UUID].path;
        this.debug = this.DEBUG();
    }
    DEBUG() {
        let path = this.appletDir + "/../DEBUG";
        let _debug = imports.gi.Gio.file_new_for_path(path);
        let result = _debug.query_exists(null);
        if (result)
            this.Print("DEBUG file found in " + path + ", enabling Debug mode");
        return result;
    }
    ;
    Print(message) {
        let msg = "[" + UUID + "#" + this.ID + "]: " + message.toString();
        let debug = "";
        if (this.debug) {
            debug = this.GetErrorLine();
            global.log(msg, '\n', "On Line:", debug);
        }
        else {
            global.log(msg);
        }
    }
    Error(error) {
        global.logError("[" + UUID + "#" + this.ID + "]: " + error.toString(), '\n', "On Line:", this.GetErrorLine());
    }
    ;
    Debug(message) {
        if (this.debug) {
            this.Print(message);
        }
    }
    Debug2(message) {
        if (this.debug && this.level > 1) {
            this.Print(message);
        }
    }
    GetErrorLine() {
        let arr = (new Error).stack.split("\n").slice(-2)[0].split('/').slice(-1)[0];
        return arr;
    }
}
exports.Log = Log;