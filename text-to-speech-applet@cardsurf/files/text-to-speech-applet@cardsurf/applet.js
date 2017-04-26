
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;
const Gettext = imports.gettext;
const uuid = "text-to-speech-applet@cardsurf";

Gettext.bindtextdomain(uuid, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(uuid, str);
}

const AppletDirectory = imports.ui.appletManager.applets[uuid];
const AppletGui = AppletDirectory.appletGui;
const Clipboard = AppletDirectory.clipboard;
const ShellUtils = AppletDirectory.shellUtils;

function MyApplet(metadata, orientation, panel_height, instance_id) {
	this._init(metadata, orientation, panel_height, instance_id);
};

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextApplet.prototype._init.call(this, orientation, panel_height, instance_id);

		this.panel_height = panel_height;
		this.orientation = orientation;

		this.clipboard_reader = new Clipboard.ClipboardReader();
		this.voice_process = null;
		this.previous_text = "";
		this.current_text = "";
		this.line_resume_reading = 0;
		this.line_separator_regex = null;
		this.hover_popup = null;
		this.applet_gui = null;

		this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
		this.clipboard_type = 0;
		this.read_lines_and_stop = false;
		this.number_lines_to_read = 1;
		this.line_separator = "";
		this.voice_command = "";
		this.gui_idle_icon_filename = "";
		this.gui_pause_icon_filename = "";
		this.gui_reading_icon_filename = "";

		this._bind_settings();
		this._init_voice_process();
		this._init_line_separator_regex();
		this._init_hover_popup();
		this._init_gui();
    },

	_bind_settings: function () {
		for(let [binding, property_name, callback] of [
						[Settings.BindingDirection.IN, "clipboard_type", null],
						[Settings.BindingDirection.IN, "read_lines_and_stop", null],
						[Settings.BindingDirection.IN, "number_lines_to_read", null],
						[Settings.BindingDirection.IN, "voice_command", null],
						[Settings.BindingDirection.IN, "line_separator", this.on_line_separator_changed],
						[Settings.BindingDirection.IN, "gui_idle_icon_filename", this.on_gui_idle_icon_changed],
						[Settings.BindingDirection.IN, "gui_pause_icon_filename", this.on_gui_pause_icon_changed],
						[Settings.BindingDirection.IN, "gui_reading_icon_filename", this.on_gui_reading_icon_changed] ]){
			    this.settings.bindProperty(binding, property_name, property_name, callback, null);
		}
	},

	on_line_separator_changed: function () {
		this.line_separator_regex = new RegExp(this.line_separator,"g");
	},

	on_gui_idle_icon_changed: function () {
		let is_running = this.is_voice_process_running();
		if(!is_running){
			this.set_gui_idle();
		}
	},

	on_gui_pause_icon_changed: function () {
		let is_paused = this.is_voice_process_paused();
		if(is_paused){
			this.set_gui_paused();
		}
	},

	on_gui_reading_icon_changed: function () {
		let is_running = this.is_voice_process_running();
		if(is_running){
			this.set_gui_reading();
		}
	},

	is_voice_process_running: function () {
		let is_running = this.voice_process.is_running();
		return is_running;
	},

	is_voice_process_paused: function () {
		let is_paused = this.voice_process.is_paused();
		return is_paused;
	},

	set_gui_idle: function () {
		this.applet_gui.set_icon(this.gui_idle_icon_filename);
	},

	set_gui_paused: function () {
		this.applet_gui.set_icon(this.gui_pause_icon_filename);
	},

	set_gui_reading: function () {
		this.applet_gui.set_icon(this.gui_reading_icon_filename);
	},

	_init_line_separator_regex: function () {
		this.on_line_separator_changed();
	},

	_init_voice_process: function () {
		this.voice_process = new ShellUtils.BackgroundProcess();
		this.voice_process.set_callback_process_finished(this, this.on_voice_process_finished);
	},

	_init_hover_popup: function () {
		this.hover_popup = new AppletGui.UnfreezeCinnamonHoverMenu(this, this.orientation);
	},

	_init_gui: function () {
		this.applet_gui = new AppletGui.AppletGui(this.panel_height);
		this.actor.destroy_all_children();
		this.actor.add(this.applet_gui.actor, { x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE, y_fill: false });
		this.set_gui_idle();
	},

	on_voice_process_finished: function (pid, status) {
        this.set_gui_idle();
	},

	// Override
    _onButtonPressEvent: function (actor, event) {
		let handled = false;
		let button = event.get_button();
        if (button == Clutter.BUTTON_MIDDLE) {
        	handled = this.on_middle_mouse_button_clicked(actor, event);
		}
		else {
			handled = Applet.TextApplet.prototype._onButtonPressEvent.call(this, actor, event);
		}
		return handled;
	},

    on_middle_mouse_button_clicked: function (actor, event) {
		let is_running = this.is_voice_process_running();
        if (is_running && this._applet_enabled) {
			this.pause_or_resume_reading();
        }
		return true;
    },

	pause_or_resume_reading: function () {
		let is_paused = this.is_voice_process_paused();
		if(is_paused){
			this.resume_reading();
		}
		else {
			this.pause_reading();
		}
	},

	resume_reading: function () {
		this.voice_process.resume();
		this.set_gui_reading();
	},

	pause_reading: function () {
		this.voice_process.pause();
		this.set_gui_paused();
	},

	on_applet_clicked: function(event) {
		this.start_or_stop_reading_text();
	},

	start_or_stop_reading_text: function () {
		let is_running = this.is_voice_process_running();
		if(is_running){
			this.stop_reading();
		}
		else {
			this.start_reading();
		}
	},

	stop_reading: function () {
		this.voice_process.kill();
	},

	start_reading: function () {
		let argv = this.get_voice_command_argv();
		if(argv != null) {
			this.update_text();
			this.spawn_voice_process(argv);
		}
		else {
			this.notify_parse_error();
		}
	},

	get_voice_command_argv: function () {
		let [success, argv] = this.parse_command_to_argv();
		if(success) {
			argv = this.append_text_to_read(argv);
			return argv;
		}
		return null;
	},

	parse_command_to_argv: function () {
		let [success, argv] = [true, []];
		if(this.voice_command.length > 0) {
			[success, argv] = GLib.shell_parse_argv(this.voice_command);
		}
		return [success, argv];
	},

	append_text_to_read: function (argv) {
		let text = this.get_text_to_read();
		argv.push(text);
		return argv;
	},

	get_text_to_read: function () {
		this.update_current_text();
		text = this.get_lines_to_read();
		text = this.remove_dash_from_beggining(text);
		return text;
	},

	update_current_text: function () {
		let text = this.clipboard_reader.read_text(this.clipboard_type);
		this.current_text = text.trim();
	},

	get_lines_to_read: function () {
		text = this.current_text;
		if(this.read_lines_and_stop) {
			let start = this.get_start_line();
			let stop = this.get_stop_line(start);
			text = this.get_lines(start, stop);
		}
		return text;
	},

	get_start_line: function () {
		return this.previous_text == this.current_text ? this.line_resume_reading : 0;
	},

	get_stop_line: function (start) {
		return start + this.number_lines_to_read;
	},

	get_lines: function (start, stop) {
		let array_lines = this.split_lines();
		let lines = this.get_lines_from_array(array_lines, start, stop);
		return lines;
	},

	split_lines: function () {
		let array_lines = this.current_text.split(this.line_separator_regex);
		let array_lines = this.remove_last_line_if_whitespace(array_lines);
		return array_lines;
	},

	remove_last_line_if_whitespace: function (array_lines) {
		let last_index = array_lines.length - 1;
        let last_line = array_lines[last_index];
		if(array_lines.length > 1 && this.is_whitespace_string(last_line)) {
			array_lines.pop();
		}
		return array_lines;
	},

	is_whitespace_string: function (str) {
		trimmed_string = str.trim();
		return trimmed_string.length == 0;
	},

	get_lines_from_array: function (array_lines, start, stop) {
		let join_character = "\n";
		array_lines = array_lines.slice(start, stop);
		let lines = array_lines.join(join_character);
		return lines;
	},

	remove_dash_from_beggining: function (lines) {
		lines = lines.replace(/^[\s-]+/i, "");
		return lines;
	},

	update_text: function () {
		this.update_line_resume();
		this.update_previous_text();
	},

	update_line_resume: function () {
		if(this.read_lines_and_stop) {
			let start = this.get_start_line();
			let stop = this.get_stop_line(start);
			let array_lines = this.split_lines();
			this.update_line_resume_reading(array_lines, stop);
		}
	},

	update_line_resume_reading: function (array_lines, stop) {
		if(stop < array_lines.length) {
			this.line_resume_reading = stop;
		}
		else {
			this.line_resume_reading = 0;
		}
	},

	update_previous_text: function () {
		this.previous_text = this.current_text;
	},

	notify_parse_error: function () {
		let title = _("Error parsing command parameters");
		let msg = _("Try to use less parameters to determine which one is causing the error");
    	Main.notifyError(title, msg);
	},

	spawn_voice_process: function (argv) {
		this.voice_process.command_argv = argv;
		this.voice_process.spawn_async();
		this.set_gui_reading();
	},

};





function main(metadata, orientation, panel_height, instance_id) {
	let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
	return myApplet;
}




