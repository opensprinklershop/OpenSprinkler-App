/* global $, ApexCharts */

/*!
 * Analog Sensor API - GUI for OpenSprinkler App
 * https://github.com/opensprinklershop/
 * (c) 2023 OpenSprinklerShop
 * Released under the MIT License
 */

// Configure module
var OSApp = OSApp || {};

OSApp.Analog = {
	analogSensors: [],
	progAdjusts: [],
	monitors : [],
	monitorAlerts : [],
	expandItem : new Set(["sensors"]),
	timer : null,

	lastSensorHtml : "",
	zigbeeClusterData : null,
	chartConvertTemp : 0, // 0=no conversion, 1=F->C, 2=C->F
	chartCombineMoistTemp : false, // combine soil moisture and temperature in one chart

	Constants: {
		CHARTS: 14,
		USERDEF_UNIT: 99,

		CURRENT_FW : "2.3.3(172)",
		CURRENT_FW_ID : 231,
		CURRENT_FW_MIN : 150,

		COLORS : ["#F3B415", "#F27036", "#663F59", "#6A6E94", "#4E88B4", "#00A7C6", "#18D8D8", '#A9D794', '#46AF78', '#A93F55', '#8C5E58', '#2176FF', '#33A1FD', '#7A918D', '#BAFF29'],
		COLCOUNT : 15,

		//detected Analog Sensor Boards:
		ASB_BOARD1 : 0x01,
		ASB_BOARD2 : 0x02,
		OSPI_PCF8591 : 0x04,
		OSPI_ADS1115 : 0x08,
		UART_SC16IS752 : 0x10,
		RS485_TRUEBNER1 : 0x20,
		RS485_TRUEBNER2 : 0x40,
		RS485_TRUEBNER3 : 0x80,
		RS485_TRUEBNER4 : 0x100,
		OSPI_USB_RS485 : 0x200,
		I2C_RS485 : 0x400,

		MONITOR_MIN      : 1,
		MONITOR_MAX      : 2,
		MONITOR_SENSOR12 : 3,
		MONITOR_SET_SENSOR12 : 4,
		MONITOR_AND      : 10,
		MONITOR_OR       : 11,
		MONITOR_XOR      : 12,
		MONITOR_NOT      : 13,
		MONITOR_TIME     : 14,
		MONITOR_REMOTE   : 100,

		//SENSOR TYPES:
		SENSOR_NONE                     : 0,  // None or deleted sensor
		SENSOR_SMT100_MOIS              : 1,  // Truebner SMT100 RS485, moisture mode
		SENSOR_SMT100_TEMP              : 2,  // Truebner SMT100 RS485, temperature mode
		SENSOR_SMT100_PMTY              : 3,  // Truebner SMT100 RS485, permittivity mode
		SENSOR_TH100_MOIS               : 4,  // Truebner TH100 RS485,  humidity mode
		SENSOR_TH100_TEMP               : 5,  // Truebner TH100 RS485,  temperature mode
		SENSOR_ANALOG_EXTENSION_BOARD   : 10, // New OpenSprinkler analog extension board x8 - voltage mode 0..4V
		SENSOR_ANALOG_EXTENSION_BOARD_P : 11, // New OpenSprinkler analog extension board x8 - percent 0..3.3V to 0..100%
		SENSOR_SMT50_MOIS               : 15, // New OpenSprinkler analog extension board x8 - SMT50 VWC [%] = (U * 50) : 3
		SENSOR_SMT50_TEMP               : 16, // New OpenSprinkler analog extension board x8 - SMT50 T [°C] = (U – 0,5) * 100
		SENSOR_SMT100_ANALOG_MOIS       : 17, // New OpenSprinkler analog extension board x8 - SMT100 VWC [%] = (U * 100) : 3
		SENSOR_SMT100_ANALOG_TEMP       : 18, // New OpenSprinkler analog extension board x8 - SMT50 T [°C] = (U * 100) : 3 - 40
		SENSOR_VH400                    : 30, // New OpenSprinkler analog extension board x8 - Vegetronix VH400
		SENSOR_THERM200                 : 31, // New OpenSprinkler analog extension board x8 - Vegetronix THERM200
		SENSOR_AQUAPLUMB                : 32, // New OpenSprinkler analog extension board x8 - Vegetronix Aquaplumb
		SENSOR_USERDEF                  : 49, // New OpenSprinkler analog extension board x8 - User defined sensor
		SENSOR_OSPI_ANALOG              : 50, // Old OSPi analog input - voltage mode 0..3.3V
		SENSOR_OSPI_ANALOG_P            : 51, // Old OSPi analog input - percent 0..3.3V to 0...100%
		SENSOR_OSPI_ANALOG_SMT50_MOIS   : 52, // Old OSPi analog input - SMT50 VWC [%] = (U * 50) : 3
		SENSOR_OSPI_ANALOG_SMT50_TEMP   : 53, // Old OSPi analog input - SMT50 T [°C] = (U – 0,5) * 100
		SENSOR_OSPI_INTERNAL_TEMP       : 54, // Internal OSPI Temperature

		SENSOR_FYTA_MOISTURE            : 60,  // FYTA moisture sensor
	SENSOR_FYTA_TEMPERATURE         : 61,  // FYTA temperature sensor

	SENSOR_MQTT                     : 90, // subscribe to a MQTT server and query a value

	SENSOR_ZIGBEE                   : 95, // ZigBee sensor
	SENSOR_BLUETOOTH                : 96, // Bluetooth sensor

	SENSOR_REMOTE                   : 100, // Remote sensor of an remote opensprinkler
	SENSOR_WEATHER_TEMP_F           : 101, // Weather service - temperature (Fahrenheit)
	SENSOR_WEATHER_TEMP_C           : 102, // Weather service - temperature (Celcius)
	SENSOR_WEATHER_HUM              : 103, // Weather service - humidity (%)
	SENSOR_WEATHER_PRECIP_IN        : 105, // Weather service - precip (inch)
	SENSOR_WEATHER_PRECIP_MM        : 106, // Weather service - precip (mm)
	SENSOR_WEATHER_WIND_MPH         : 107, // Weather service - wind (mph)
	SENSOR_WEATHER_WIND_KMH         : 108, // Weather service - wind (kmh)
	SENSOR_WEATHER_ETO              : 109, // Weather service - ETO
	SENSOR_WEATHER_RADIATION        : 110, // Weather service - radiation

	SENSOR_GROUP_MIN                : 1000,  // Sensor group with min value
	SENSOR_GROUP_MAX                : 1001,  // Sensor group with max value
	SENSOR_GROUP_AVG                : 1002,  // Sensor group with avg value
	SENSOR_GROUP_SUM                : 1003,  // Sensor group with sum value

	SENSOR_FREE_MEMORY              : 10000, // Free memory
	SENSOR_FREE_STORE               : 10001,  // Free storage

		PROG_LINEAR                     : 1, //formula see above
		PROG_DIGITAL_MIN                : 2, //under or equal min : factor1 else factor2
		PROG_DIGITAL_MAX                : 3, //over or equal max  : factor2 else factor1
		PROG_DIGITAL_MINMAX             : 4, //under min or over max : factor1 else factor2
	}
};

OSApp.Analog.success_callback = function() {
};

OSApp.Analog.syncChartOptionsFromController = function() {
	try {
		var stored = localStorage.getItem("OSApp.Analog.chartOptions");
		if ( stored ) {
			var opts = JSON.parse( stored );
			var tmpCo = opts.tmpCo;
			var comb = opts.comb;

			if ( typeof tmpCo === "string" ) {
				tmpCo = parseInt( tmpCo, 10 );
			}
			if ( typeof tmpCo === "number" && !isNaN( tmpCo ) ) {
				OSApp.Analog.chartConvertTemp = Math.max( 0, Math.min( 2, tmpCo ) );
			}

			if ( typeof comb === "string" ) {
				comb = parseInt( comb, 10 );
			}
			if ( typeof comb === "number" && !isNaN( comb ) ) {
				OSApp.Analog.chartCombineMoistTemp = comb === 1;
			}
		}
	} catch ( e ) {
		// Ignore parse errors, use defaults
	}
};

OSApp.Analog.saveChartOptions = function() {
	var payload = {
		tmpCo: OSApp.Analog.chartConvertTemp,
		comb: OSApp.Analog.chartCombineMoistTemp ? 1 : 0
	};

	try {
		localStorage.setItem("OSApp.Analog.chartOptions", JSON.stringify( payload ));
	} catch ( e ) {
		// Ignore storage errors
	}
};


OSApp.Analog.asb_init = function() {
	if (!OSApp.currentDevice.isAndroid && !OSApp.currentDevice.isiOS) return;

	if (OSApp.currentDevice.isAndroid) {
		window.cordova.plugins.notification.local.createChannel({
			channelId: 'os_low',
			channel:   'os_low',
			channelName:'OpenSprinklerLowNotifications',
			vibrate: false, // bool (optional), default is false
			importance: 2, // int (optional) 0 to 4, default is IMPORTANCE_DEFAULT (3)
			soundUsage: 5, // int (optional), default is USAGE_NOTIFICATION
			}, OSApp.Analog.success_callback, this);
		window.cordova.plugins.notification.local.createChannel({
			channelId: 'os_med',
			channel:   'os_med',
			channelName:'OpenSprinklerMedNotifications',
			vibrate: false, // bool (optional), default is false
			importance: 3, // int (optional) 0 to 4, default is IMPORTANCE_DEFAULT (3)
			soundUsage: 5, // int (optional), default is USAGE_NOTIFICATION
			}, OSApp.Analog.success_callback, this);
		window.cordova.plugins.notification.local.createChannel({
			channelId: 'os_high',
			channel:   'os_high',
			channelName:'OpenSprinklerHighNotifications',
			vibrate: true, // bool (optional), default is false
			importance: 4, // int (optional) 0 to 4, default is IMPORTANCE_DEFAULT (3)
			soundUsage: 5, // int (optional), default is USAGE_NOTIFICATION
			}, OSApp.Analog.success_callback, this);
	}
	if (window.cordova && window.cordova.plugins) {

		OSApp.Analog.timer = new window.nativeTimer();
		OSApp.Analog.timer.onTick = function() {
			OSApp.Analog.updateAnalogSensor( function() {
				OSApp.Analog.updateMonitors();
			});
		};

		window.cordova.plugins.backgroundMode.on('activate', function() {
			OSApp.Analog.timer.start(1, 30*1000);
		});
	 	window.cordova.plugins.backgroundMode.on('deactivate', function() {
			OSApp.Analog.timer.stop();
		});

		window.cordova.plugins.backgroundMode.setDefaults({
			title: "OpenSprinklerASB",
			text: OSApp.Language._("OpenSprinkler is running in background mode"),
			subText: OSApp.Language._("active monitor and controlling notifications"),
			channelName: "BackgroundChannel",
			allowClose: false,
			visibility: "public",
		});
	}
	if (window.cordova && window.BackgroundFetch) {
		var BackgroundFetch = window.BackgroundFetch;
		var fetchCallback = function(taskId) {
			console.log('[js] BackgroundFetch event received: ', taskId);
			OSApp.Analog.updateAnalogSensor( function() {
				OSApp.Analog.updateMonitors( function() {
					BackgroundFetch.finish(taskId);
				});
			});
		};

		var failureCallback = function(taskId) {
			console.log('- BackgroundFetch failed');
			BackgroundFetch.finish(taskId);
		};

		BackgroundFetch.configure({
			minimumFetchInterval: 15,
			requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY
		}, fetchCallback, failureCallback);
	}
};

OSApp.Analog.checkAnalogSensorAvail = function() {
	return OSApp.currentSession.controller.options && OSApp.currentSession.controller.options.feature.includes("ASB");
};

OSApp.Analog.isESP32 = function() {
	return OSApp.currentSession.controller.options && OSApp.currentSession.controller.options.feature.includes("ESP32");
};


OSApp.Analog.refresh = function() {
	setTimeout( function() {
		location.reload();
	}, 100 );
};

OSApp.Analog.enc = function(s) {
	//encodeURIComponent does not encode a single "%" !
	if (s) {
		return encodeURIComponent(s);
	}
	return s;
};

OSApp.Analog.updateProgramAdjustments = function( callback ) {
	callback = callback || function() { };
	return OSApp.Firmware.sendToOS( "/se?pw=", "json" ).then( function( data ) {
		OSApp.Analog.progAdjusts = data.progAdjust;
		callback();
	} );
};

OSApp.Analog.checkBackgroundMode = function() {
	if (!OSApp.currentDevice.isAndroid && !OSApp.currentDevice.isiOS) return;
	if (!window.cordova) return;
	//Enable background mode only if we have a monitor configured:
	if (OSApp.Analog.monitors && OSApp.Analog.monitors.length > 0) {
		if (!window.cordova.plugins.backgroundMode.isActive() && !window.cordova.plugins.backgroundMode.isEnabled())
			window.cordova.plugins.backgroundMode.setEnabled(true);
	} else if (window.cordova.plugins.backgroundMode.isEnabled()) {
		window.cordova.plugins.backgroundMode.setEnabled(false);
	}
};

OSApp.Analog.updateMonitors = function(callback) {
	callback = callback || function () { };

	OSApp.Analog.checkBackgroundMode();

	if (OSApp.Firmware.checkOSVersion(233)) {
		return OSApp.Firmware.sendToOS("/ml?pw=", "json").then(function (data) {

			OSApp.Analog.monitors = data.monitors;
			OSApp.Analog.checkMonitorAlerts();
			callback();
		});
	} else callback();
};

OSApp.Analog.updateAnalogSensor = function( callback ) {
	callback = callback || function() { };
	return OSApp.Firmware.sendToOS( "/sl?pw=", "json" ).then( function( data ) {
		OSApp.Analog.analogSensors = data.sensors;
		if (Object.prototype.hasOwnProperty.call(data, "detected"))
			OSApp.Analog.analogSensors.detected = data.detected;
		callback();
	} );
};

OSApp.Analog.notification_action_callback = function() {
	//	monitorAlerts[monitor.nr] = false;
};

OSApp.Analog.checkMonitorAlerts = function() {
	if (!window.cordova || !window.cordova.plugins || !OSApp.Analog.monitors || (!OSApp.currentDevice.isAndroid && !OSApp.currentDevice.isiOS))
		return;

	for (let i = 0; i < OSApp.Analog.monitors.length; i++) {
		var monitor = OSApp.Analog.monitors[i];
		if (monitor.active) {

			if (!OSApp.Analog.monitorAlerts[monitor.nr]) {
				OSApp.Analog.monitorAlerts[monitor.nr] = true;
				var dname, chan;
				if ( typeof OSApp.currentSession.controller.settings.dname !== "undefined" )
					dname = OSApp.currentSession.controller.settings.dname;
				else
				 	dname = "OpenSprinkler";
				let prio = Object.prototype.hasOwnProperty.call(monitor, "prio")?monitor.prio:0;

				if (prio === 0) chan = 'os_low';
				else if (prio === 1) chan = 'os_med';
				else chan = 'os_high';

				window.cordova.plugins.notification.local.schedule({
					id: monitor.nr,
					channelId: chan,
					channel: chan,
					title: dname,
					text: monitor.name,
					priority: prio,
					beep: prio>=2,
					lockscreen: true,
					color: OSApp.Analog.Constants.NOTIFICATION_COLORS[prio],
				}, OSApp.Analog.notification_action_callback, monitor);
			}
		}
		else if (OSApp.Analog.monitorAlerts[monitor.nr]) {
			OSApp.Analog.monitorAlerts[monitor.nr] = false;
		}
	}
};

OSApp.Analog.updateSensorShowArea = function( page ) {
	if (OSApp.Analog.checkAnalogSensorAvail()) {
		var showArea = page.find("#os-sensor-show");
		var html = "", i, j;

		var root = document.documentElement;
		var body = document.body || document.getElementsByTagName('body')[0];
		var isDark = (root.classList.contains("theme-dark") || (body && body.classList.contains("theme-dark")));
		var isColorful = (root.classList.contains("theme-colorful") || (body && body.classList.contains("theme-colorful")));
		var css = getComputedStyle(root);
		var theme = {
			accent: isColorful ? css.getPropertyValue("--theme-colorful-text").trim() || "#7059ff" : (isDark ? "#3a8dde" : "#20E647"),
			surfaceStrong: isColorful ? (css.getPropertyValue("--theme-colorful-surface-strong").trim() || "#fff") : (isDark ? "#151a22" : "#fff"),
			gauge: {
				green: isDark ? "#18c36e" : "#20E647",
				orange: isDark ? "#ff9f43" : "#FF8C00",
				red: isDark ? "#ff6b6b" : "#CD5C5C"
			},
			monitorBg: isColorful ? [
				"rgba(141,120,235,0.15)",
				"rgba(141,120,235,0.25)",
				"rgba(141,120,235,0.35)"
			] : (isDark ? [
				"rgba(58,141,222,0.15)",
				"rgba(58,141,222,0.25)",
				"rgba(58,141,222,0.35)"
			] : [
				"#e8f7ee",
				"#fff6db",
				"#ffe5e7"
			])
		};
		html += "<div class='ui-body ui-body-a center'><table style='margin: 0px auto;'>";
		var cols = Math.round(window.innerWidth / 300);

		for (i = 0; i < OSApp.Analog.progAdjusts.length; i++) {
			if (i % cols == 0) {
				if (i > 0)
					html += "</tr>";
				html += "<tr>";
			}
			html += "<td id='mainpageChart-" + i + "'/>";
		}
		if (i > 0)
			html += "</tr>";
		html += "</table></div>";

		if (OSApp.Firmware.checkOSVersion(233) && OSApp.Analog.monitors) {
			for (i = 0; i < OSApp.Analog.monitors.length; i++) {
				var monitor = OSApp.Analog.monitors[i];
				if (monitor.active) {
					let prio = Object.prototype.hasOwnProperty.call(monitor, "prio")?monitor.prio:0;
					let pcolor = theme.monitorBg[prio];
					var name = monitor.name;
					//if (monitor.ts>0)
					//	name += " "+monitor.ts+"s";
					html += "<div id='monitor-" + monitor.nr + "' class='ui-body ui-body-a center' style='background-color:"+pcolor+"'>";
					html += "<label>" + name + "</label>";
					html += "</div>";
				}
			}
		}

		for (i = 0; i < OSApp.Analog.analogSensors.length; i++) {
			var sensor = OSApp.Analog.analogSensors[i];
			if (sensor.show) {
				html += "<div id='sensor-show-" + sensor.nr + "' class='ui-body ui-body-a center'>";
				html += "<label>" + sensor.name + ": " + OSApp.Analog.formatValUnit(sensor.data, OSApp.Analog.getUnit(sensor)) + "</label>";
				html += "</div>";
			}
		}

		var progAdjustDisp = new Array(OSApp.Analog.progAdjusts.length);

		for (i = 0; i < OSApp.Analog.progAdjusts.length; i++) {
			var progAdjust = OSApp.Analog.progAdjusts[i];
			var disp = {};
			var current = Math.round(progAdjust.current * 100);

			if (!progAdjust.name || progAdjust.name === "") {
				var progName = "?";
				if (progAdjust.prog >= 1 && progAdjust.prog <= OSApp.currentSession.controller.programs.pd.length) {
					progName = OSApp.Programs.readProgram(OSApp.currentSession.controller.programs.pd[progAdjust.prog - 1]).name;
				}

				var sensorName = "";
				for (j = 0; j < OSApp.Analog.analogSensors.length; j++) {
					if (OSApp.Analog.analogSensors[j].nr === progAdjust.sensor) {
						sensorName = OSApp.Analog.analogSensors[j].name;
					}
				}
				disp.label = progName + " (" + sensorName + ")"
			} else
				disp.label = progAdjust.name;

			//current = 80; //testvalue!
			var color = [ theme.gauge.green ];
			if (current > 100)
				color = [ theme.gauge.orange ];
			if (current > 150)
				color = [ theme.gauge.red ];
			disp.color = color;

			var min = Math.min(progAdjust.factor1, progAdjust.factor2) * 100;
			var max = Math.max(progAdjust.factor1, progAdjust.factor2) * 100;
			if (current < min) current = min;
			if (current > max) current = max;
			disp.current = current;
			progAdjustDisp[i] = disp;
		}

		if (OSApp.Analog.lastSensorHtml != html) {
			OSApp.Analog.lastSensorHtml = html;
			while (showArea.firstChild) {
				showArea.removeChild(showArea.firstChild);
			}
			showArea.html(html);

			for (i = 0; i < progAdjustDisp.length; i++) {
				disp = progAdjustDisp[i];
				if (!disp) continue;
				var options = {
					chart: {
						height: 180,
						parentHeightOffset: 0,
						type: "radialBar",
						offsetY: -20,
          				sparkline: {
            				enabled: true
          				},
						animations: {
							enabled: true,
							dynamicAnimation: {
								enabled: true
							}
						}
					},
					series: [disp.current],
					colors: [ theme.gauge.green ],
					plotOptions: {
						radialBar: {
							startAngle: -120,
							endAngle: 120,
							/*hollow: {
								margin: 0,
								size: '60%',
								background: '#fff',
								position: 'front',
								dropShadow: {
									enabled: true,
									top: 3,
									left: 0,
									blur: 4,
									opacity: 0.5
								},
							},*/
							track: {
								background: theme.surfaceStrong,
								startAngle: -120,
								endAngle: 120,
								strokeWidth: '67%',
								margin: 5, // margin is in pixels
								dropShadow: {
									enabled: true,
									top: -3,
									left: 0,
									blur: 4,
									opacity: 0.7
								}
							},
							dataLabels: {
								showOn: "always",
								name: {
									offsetY: -25,
									show: true,
									color: isDark ? "#e6e6e6" : "#222",
									fontSize: "14px"
								},
								value: {
									color: isDark ? "#e6e6e6" : "#111",
									fontSize: "30px",
									offsetY: 0,
									show: true,
									formatter: function (val) {
										return OSApp.Analog.formatValUnit(val, "%");
									}
								}
							}
						}
					},

					fill: {
						type: "gradient",
						gradient: {
							shade: "dark",
							type: "horizontal",
							gradientToColors: disp.color,
							stops: [0, 100]
						}
					},
					stroke: {
						lineCap: "round",
					},
					labels: [disp.label]
				};

				var chart = new ApexCharts(document.querySelector("#mainpageChart-" + i), options);
				chart.render();
				disp.chart = chart;
			}
		} else {
			for (i = 0; i < progAdjustDisp.length; i++) {
				disp = progAdjustDisp[i];
				if (disp && disp.chart) {
					disp.chart.updateSeries([disp.current]);
					disp.chart.updateOptions({labels: [disp.label]});
				}
			}
		}
	}
};

OSApp.Analog.toByteArray = function( b ) {
	var result = [];
	var n = 4;
	while ( n-- ) {
		result.push( Number( b % 0x100 ) );
		b /= 0x100;
	}
	return Uint8Array.from( result );
};

OSApp.Analog.intFromBytes = function( x ) {
	try {
		var val = 0;
		for ( var i = x.length - 1; i >= 0; i-- ) {
			val *= 0x100;
			val += parseInt( x[ i ] );
		}
		return val;
		//eslint-disable-next-line no-unused-vars
	} catch ( e ) {
		return 0;
	}
};

// Restore from Backup - Dialog
OSApp.Analog.getImportMethodSensors = function(restore_type, callback) {

	let storageName = (restore_type == 1) ? "backupSensors" : (restore_type == 2) ? "backupAdjustments" : "backupAll";
	let localData = localStorage.getItem(storageName);

	callback = callback || function () { };
	var getPaste = function () {
		var popup = $(
			"<div data-role='popup' data-theme='a' id='paste_config'>" +
			"<p class='ui-bar'>" +
			"<textarea class='textarea' rows='10' placeholder='" + OSApp.Language._("Paste your backup here") + "'></textarea>" +
			"<button data-mini='true' data-theme='b'>" + OSApp.Language._("Import") + "</button>" +
			"</p>" +
			"</div>"
		),
			width = $.mobile.window.width();

		popup.find("button").on("click", function () {
			var data = popup.find("textarea").val();

			if (data === "") {
				return;
			}

			try {
				data = JSON.parse($.trim(data).replace(/“|”|″/g, "\""));
				popup.popup("close");
				OSApp.Analog.importConfigSensors(data, restore_type, callback);
			} catch {
				popup.find("textarea").val("");
				OSApp.Errors.showError(OSApp.Language._("Unable to read the configuration file. Please check the file and try again."));
			}
		});

		popup.css("width", (width > 600 ? width * 0.4 + "px" : "100%"));
		OSApp.UIDom.openPopup(popup);
		return false;
	},
		popup = $(
			"<div data-role='popup' data-theme='a'>" +
			"<div class='ui-bar ui-bar-a'>" + OSApp.Language._("Select Import Method") + "</div>" +
			"<div data-role='controlgroup' class='tight'>" +
			"<button class='hidden fileMethod'>" + OSApp.Language._("File") + "</button>" +
			"<button class='pasteMethod'>" + OSApp.Language._("Email (copy/paste)") + "</button>" +
			"<button class='hidden localMethod'>" + OSApp.Language._("Internal (within app)") + "</button>" +
			"</div>" +
			"</div>");

	if (OSApp.currentDevice.isFileCapable) {
		popup.find(".fileMethod").removeClass("hidden").on("click", function () {
			popup.popup("close");
			var input = $("<input type='file' id='configInput' data-role='none' style='visibility:hidden;position:absolute;top:-50px;left:-50px'/>")
				.on("change", function () {
					var config = this.files[0],
						reader = new FileReader();

					if (typeof config !== "object") {
						return;
					}

					reader.onload = function (e) {
						try {
							var obj = JSON.parse($.trim(e.target.result));
							OSApp.Analog.importConfigSensors(obj, restore_type, callback);
						} catch (err) {
							OSApp.Errors.showError(OSApp.Language._("Unable to read the configuration file. Please check the file and try again.") + " " + err);
						}
					};

					reader.readAsText(config);
				});

			input.appendTo("#sprinklers-settings");
			input.click();
			return false;
		});
	} else {

		// Handle local storage being unavailable and present paste dialog immediately
		if (!localData) {
			getPaste();
			return;
		}
	}

	popup.find(".pasteMethod").on("click", function () {
		popup.popup("close");
		getPaste();
		return false;
	});

	if (localData) {
		popup.find(".localMethod").removeClass("hidden").on("click", function () {
			popup.popup("close");
			OSApp.Analog.importConfigSensors(JSON.parse(localData), restore_type, callback);
			return false;
		});
	}

	OSApp.UIDom.openPopup(popup);
};

// Restore from backup - send to OS
OSApp.Analog.importConfigSensors = function(data, restore_type, callback) {
	callback = callback || function () { };
	var warning = "";

	if (typeof data !== "object" || !data.backup) {
		OSApp.Errors.showError(OSApp.Language._("Invalid configuration"));
		return;
	}

	OSApp.UIDom.areYouSure(OSApp.Language._("Are you sure you want to restore the configuration?"), warning, function () {
		$.mobile.loading("show");

		if ((restore_type & 1) == 1 && Object.prototype.hasOwnProperty.call(data, "sensors")) { //restore Sensor
			var sensorOut;
			for (let i = 0; i < data.sensors.length; i++) {
				sensorOut = data.sensors[i];
				OSApp.Analog.sendToOsObj("/sc?pw=", sensorOut);
			}
		}

		if ((restore_type & 2) == 2 && Object.prototype.hasOwnProperty.call(data, "progadjust")) { //restore program adjustments
			var progAdjustOut;
			for (let i = 0; i < data.progadjust.length; i++) {
				progAdjustOut = data.progadjust[i];
				OSApp.Analog.sendToOsObj("/sb?pw?=", progAdjustOut);
			}
		}

		if ((restore_type & 4) == 4 && Object.prototype.hasOwnProperty.call(data, "monitors")) { //restore monitors
			var monitor;
			for (var i = 0; i < data.monitors.length; i++) {
				monitor = data.monitors[i];
				OSApp.Analog.sendToOsObj("/mc?pw=", monitor);
			}
		}

		OSApp.Analog.expandItem.add("progadjust");
		OSApp.Analog.updateProgramAdjustments(function () {
			OSApp.Analog.updateMonitors(function () {
				OSApp.Analog.updateAnalogSensor(function () {
					$.mobile.loading("hide");
					OSApp.Errors.showError(OSApp.Language._("Backup restored to your device"));
					callback();
				});

			});
		});

	});
};

OSApp.Analog.sendToOsObj = function(params, obj) {
	for (var key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			var value = obj[key];
			if (typeof value == "object") value = JSON.stringify(obj[key]);
			if (typeof value == "string") value = OSApp.Analog.enc(value);
			params += "&"+key+"="+value;
		}
	}
	return OSApp.Firmware.sendToOS(params, "json");
};


OSApp.Analog.getExportMethodSensors = function(backuptype) {
	let storageName = (backuptype == 1) ? "backupSensors" : (backuptype == 2) ? "backupAdjustments" : (backuptype == 4) ? "backupMonitor" : "backupAll";
	let filename = (backuptype == 1) ? "BackupSensorConfig" : (backuptype == 2) ? "BackupSensorAdjustments" : (backuptype == 4) ? "BackupMonitorConfig" : "BackupAllConfig";

	OSApp.Firmware.sendToOS("/sx?pw=&backup=" + backuptype, "json").then(function (data) {
		var popup = $(
			"<div data-role='popup' data-theme='a'>" +
			"<div class='ui-bar ui-bar-a'>" + OSApp.Language._("Select Export Method") + "</div>" +
			"<div data-role='controlgroup' class='tight'>" +
			"<a class='ui-btn hidden fileMethod'>" + OSApp.Language._("File") + "</a>" +
			"<a class='ui-btn pasteMethod'>" + OSApp.Language._("Email") + "</a>" +
			"<a class='ui-btn localMethod'>" + OSApp.Language._("Internal (within app)") + "</a>" +
			"</div>" +
			"</div>"),
			obj = encodeURIComponent(JSON.stringify(data)),
			subject = "OpenSprinkler Sensor Export on " + OSApp.Dates.dateToString(new Date());

		if (OSApp.currentDevice.isFileCapable) {
			popup.find(".fileMethod").removeClass("hidden").attr({
				href: "data:text/json;charset=utf-8," + obj,
				download: filename + "-" + new Date().toLocaleDateString().replace(/\//g, "-") + ".json"
			}).on("click", function () {
				popup.popup("close");
			});
		}

		var href = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + obj;
		popup.find(".pasteMethod").attr("href", href).on("click", function () {
			window.open(href, OSApp.currentDevice.isOSXApp ? "_system" : undefined);
			popup.popup("close");
		});

		popup.find(".localMethod").on("click", function () {
			popup.popup("close");
			localStorage.setItem(storageName, JSON.stringify(data));
			OSApp.Errors.showError(OSApp.Language._("Backup saved on this device"));
		});

		OSApp.UIDom.openPopup(popup);
	});
};


//Program adjustments editor
OSApp.Analog.showAdjustmentsEditor = function( progAdjust, row, callback, callbackCancel ) {

	OSApp.Firmware.sendToOS("/sh?pw=", "json").then(function (data) {
		var supportedAdjustmentTypes = data.progTypes;
		var i;

		$(".ui-popup-active").find("[data-role='popup']").popup("close");

		var list =
			"<div data-role='popup' data-theme='a' id='progAdjustEditor'>" +
			"<div data-role='header' data-theme='b'>" +
			"<a href='#' data-rel='back' data-role='button' data-theme='a' data-icon='delete' data-iconpos='notext' class='ui-btn-right'>"+OSApp.Language._("close")+"</a>"+
			"<h1>" + (progAdjust.nr > 0 ? OSApp.Language._("Edit Program Adjustment") : OSApp.Language._("New Program Adjustment")) + "</h1>" +
			"</div>" +

			"<div class='ui-content'>" +
			"<form>" +
			"<p class='rain-desc center smaller'>" +
			OSApp.Language._("Notice: If you want to combine multiple sensors, then build a sensor group. ") +
			OSApp.Language._("See help documentation for details.") +
			"</p>" +

			//Adjustment-Nr:
			"<label>" +
			OSApp.Language._("Adjustment-Nr") +
			"</label>" +
			"<input class='nr' type='number' inputmode='decimal' min='1' max='99999' value='" + progAdjust.nr + (progAdjust.nr > 0 ? "' disabled='disabled'>" : "'>");

			//Adjustment-Name:
			if (OSApp.Firmware.checkOSVersion(233)) {
				if (!Object.prototype.hasOwnProperty.call(progAdjust, "name"))
					progAdjust.name = "";
				list += "<label>" +
				OSApp.Language._("Adjustment-Name") +
				"</label>" +
				"<input class='adj-name' type='text' maxlength='29' value='" + progAdjust.name + "' >";
			}

			//Select Type:
			list += "<label for='type' class='select'>" +
			OSApp.Language._("Type") +
			"</label><select data-mini='true' id='type'>";

		for (i = 0; i < supportedAdjustmentTypes.length; i++) {
			list += "<option " + ((progAdjust.type === supportedAdjustmentTypes[i].type) ? "selected" : "") +
				" value='" + supportedAdjustmentTypes[i].type + "'>" +
				OSApp.Language._(supportedAdjustmentTypes[i].name) + "</option>";
		}
		list += "</select>" +

			//Select Sensor:
			"<label for='sensor' class='select'>" +
			OSApp.Language._("Sensor") +
			"</label><select data-mini='true' id='sensor'>";

		for (i = 0; i < OSApp.Analog.analogSensors.length; i++) {
			list += "<option " + ((progAdjust.sensor === OSApp.Analog.analogSensors[i].nr) ? "selected" : "") +
				" value='" + OSApp.Analog.analogSensors[i].nr + "'>" +
				OSApp.Analog.analogSensors[i].nr + " - " + OSApp.Analog.analogSensors[i].name + "</option>";
		}
		list += "</select>" +

			//Select Program:
			"<label for='prog' class='select'>" +
			OSApp.Language._("Program to adjust") +
			"</label><select data-mini='true' id='prog'>";

		for (i = 0; i < OSApp.currentSession.controller.programs.pd.length; i++) {
			var progName = OSApp.Programs.readProgram(OSApp.currentSession.controller.programs.pd[i]).name;
			var progNr = i + 1;

			list += "<option " + ((progAdjust.prog === progNr) ? "selected" : "") +
				" value='" + progNr + "'>" +
				progName + "</option>";
		}
		list += "</select>" +

			"<label>" +
			OSApp.Language._("Factor 1 in % (adjustment for min)") +
			"</label>" +
			"<input class='factor1' type='number' inputmode='decimal' value='" + Math.round(progAdjust.factor1 * 100) + "'>" +

			"<label>" +
			OSApp.Language._("Factor 2 in % (adjustment for max)") +
			"</label>" +
			"<input class='factor2' type='number' inputmode='decimal' value='" + Math.round(progAdjust.factor2 * 100) + "'>" +

			"<label>" +
			OSApp.Language._("Min sensor value") +
			"</label>" +
			"<input class='min' type='number' value='" + progAdjust.min + "'>" +

			"<label>" +
			OSApp.Language._("Max sensor value") +
			"</label>" +
			"<input class='max' type='number' inputmode='decimal' value='" + progAdjust.max + "'>" +

			"</div>" +
			"<div id='adjchart'></div>" +
			"<button class='submit' data-theme='b'>" + OSApp.Language._("Submit") + "</button>" +

			((row < 0) ? "" : ("<a data-role='button' class='black delete-progadjust' value='" + progAdjust.nr + "' row='" + row + "' href='#' data-icon='delete'>" +
				OSApp.Language._("Delete") + "</a>")) +

			"</div>" +
			"</form>" +
			"</div>";

		let popup = $(list),

			changeValue = function (pos, dir) {
				var input = popup.find(".inputs input").eq(pos),
					val = parseInt(input.val());

				if ((dir === -1 && val === 0) || (dir === 1 && val === 100)) {
					return;
				}

				input.val(val + dir);
			};

		//Delete a program adjust:
		popup.find(".delete-progadjust").on("click", function () {
			var dur = $(this),
				value = dur.attr("value"),
				row = dur.attr("row");

			popup.popup("close");

			OSApp.UIDom.areYouSure(OSApp.Language._("Are you sure you want to delete this program adjustment?"), value, function () {
				return OSApp.Firmware.sendToOS("/sb?pw=&nr=" + value + "&type=0", "json").done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
					else
						OSApp.Analog.progAdjusts.splice(row, 1);
					callbackCancel();
				});
			});
		});

		let adjFunc = function () {
			OSApp.Analog.updateAdjustmentChart(popup);
		};

		popup.find("#sensor").change(adjFunc);
		popup.find("#type").change(adjFunc);
		popup.find(".factor1").change(adjFunc);
		popup.find(".factor2").change(adjFunc);
		popup.find(".min").change(adjFunc);
		popup.find(".max").change(adjFunc);

		popup.find(".submit").on("click", function () {

			var progAdjust = OSApp.Analog.getProgAdjust(popup);
			callback(progAdjust);

			popup.popup("close");
			return false;
		});

		popup.on("focus", "input[type='number']", function () {
			this.select();
		}).on("blur", "input[type='number']", function () {

			var min = parseFloat(this.min),
				max = parseFloat(this.max);

			if (this.value === "") {
				this.value = "0";
			}
			if (this.value < min || this.value > max) {
				this.value = this.value < min ? min : max;
			}
		});

		OSApp.UIDom.holdButton(popup.find(".incr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, 1);
			return false;
		});

		OSApp.UIDom.holdButton(popup.find(".decr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, -1);
			return false;
		});

		$("#progAdjustEditor").remove();

		popup.css("max-width", "580px");

		adjFunc();
		OSApp.UIDom.openPopup(popup, { positionTo: "origin" });
	});
};

OSApp.Analog.getProgAdjust = function(popup) {
	return {
		nr: parseInt(popup.find(".nr").val()),
		name: popup.find(".adj-name").val(),
		type: parseInt(popup.find("#type").val()),
		sensor: parseInt(popup.find("#sensor").val()),
		prog: parseInt(popup.find("#prog").val()),
		factor1: parseFloat(popup.find(".factor1").val() / 100),
		factor2: parseFloat(popup.find(".factor2").val() / 100),
		min: parseFloat(popup.find(".min").val()),
		max: parseFloat(popup.find(".max").val())
	};
};

OSApp.Analog.getProgAdjustForCalc = function(popup) {
	return {
		type: parseInt(popup.find("#type").val()),
		sensor: parseInt(popup.find("#sensor").val()),
		factor1: parseFloat(popup.find(".factor1").val() / 100),
		factor2: parseFloat(popup.find(".factor2").val() / 100),
		min: parseFloat(popup.find(".min").val()),
		max: parseFloat(popup.find(".max").val())
	};
};

OSApp.Analog.updateAdjustmentChart = function(popup) {

	let p = OSApp.Analog.getProgAdjustForCalc(popup);
	OSApp.Analog.sendToOsObj("/sd?pw=", p).done(function (values) {
		if (!values || !Object.prototype.hasOwnProperty.call(values, "adjustment"))
			return;
		let adj = values.adjustment;
		if (!Object.prototype.hasOwnProperty.call(adj, "inval"))
			return;

		var sensor;
		for (let i = 0; i < OSApp.Analog.analogSensors.length; i++) {
			if (p.sensor == OSApp.Analog.analogSensors[i].nr) {
				sensor = OSApp.Analog.analogSensors[i];
				break;
			}
		}
		if (sensor === undefined)
			return;

		var yaxis;
		if (Object.prototype.hasOwnProperty.call(adj, 'adjust'))
			yaxis = [
				{
					y: adj.adjust,
					strokeDashArray: 8,
					borderColor: "#00E396",
					borderWidth: 4,
					label: {
						borderColor: "#00E396",
						textAnchor: "end",
						position: "right",
						offsetX: -60,
						text: OSApp.Analog.formatValUnit(adj.adjust*100, "%"),
						style: {
							color: "#fff",
							background: "#00E396"
						}
					}
				}
			];

		let options = {
			chart: {
				height: 200,
				type: 'line',
				zoom: {
					enabled: false
				}
			},
			dataLabels: {
				enabled: false
			},
			stroke: {
				curve: 'straight'
			},
			title: {
				text: OSApp.Language._("Adjustment preview"),
				align: 'left'
			},
			xaxis: {
				categories: adj.inval,
				tickAmount: Math.min(20, Math.min(screen.width / 30, adj.inval.length)),
				labels: {
					formatter: function (value) {
						return OSApp.Analog.formatVal(value);
					},
					rotate: 0
				},
				title: {
					text: sensor.name + " " + adj.unit
				}
			},
			yaxis: {
				forceNiceScale: true,
				labels: {
					formatter: function (value) {
						return OSApp.Analog.formatVal(value * 100);
					}
				},
				title: {
					text: OSApp.Language._("Adjustments in %")
				}
			},
			series: [{
				name: "Adjustment",
				type: "line",
				data: adj.outval
			}],
			annotations: {
				xaxis: [
					{
						x: Math.round(sensor.data),
						strokeDashArray: 8,
						borderColor: "#00E396",
						borderWidth: 4,
						label: {
							borderColor: "#00E396",
							textAnchor: "start",
							position: "left",
							text: sensor.name,
							style: {
								color: "#fff",
								background: "#00E396"
							}
						}
					}
				],
				yaxis: yaxis
			}
		};
		let sel = document.querySelector("#adjchart");
		if (sel) {
			while (sel.firstChild)
				sel.removeChild(sel.lastChild);
			let chart = new ApexCharts(sel, options);
			chart.render();
		}
	});
};

OSApp.Analog.requiredCheck = function(field, obj, property) {
	if (obj['missingValue']) return;
	if (field.is(":visible") && field.prop("required") && !obj[property])
		obj['missingValue'] = field;
};

OSApp.Analog.addToObjectChk = function(popup, fieldId, obj) {
	let field = popup.find(fieldId);
	if (field) {
		let property = fieldId.substring(1);
		obj[property] = field.is(":checked") ? 1 : 0;
		OSApp.Analog.requiredCheck(field, obj, property);
	}
};

OSApp.Analog.addToObjectInt = function(popup, fieldId, obj) {
	let field = popup.find(fieldId);
	if (field) {
		let property = fieldId.substring(1);
		obj[property] = parseInt(field.val());
		OSApp.Analog.requiredCheck(field, obj, property);
	}
};

OSApp.Analog.addToObjectFlt = function(popup, fieldId, obj) {
	let field = popup.find(fieldId);
	if (field) {
		let property = fieldId.substring(1);
		obj[property] = parseFloat(field.val());
		OSApp.Analog.requiredCheck(field, obj, property);
	}
};

OSApp.Analog.addToObjectStr = function(popup, fieldId, obj) {
	let field = popup.find(fieldId);
	if (field) {
		let property = fieldId.substring(1);
		obj[property] = field.val();
		OSApp.Analog.requiredCheck(field, obj, property);
	}
};

OSApp.Analog.addToObjectTime = function(popup, fieldId, obj) {
	let field = popup.find(fieldId);
	if (field) {
		let property = fieldId.substring(1);
		let time = field.val();
		if (time) {
			let timeParts = time.split(":");
			if (timeParts.length === 2) {
				let hours = parseInt(timeParts[0]);
				let minutes = parseInt(timeParts[1]);
				if (!isNaN(hours) && !isNaN(minutes)) {
					obj[property] = (hours * 100) + minutes;
				} else {
					obj[property] = 0;
				}
			} else {
				obj[property] = 0;
			}
		} else {
			obj[property] = 0;
		}
		OSApp.Analog.requiredCheck(field, obj, property);
	}
};


OSApp.Analog.addToObjectIPs = function(popup, fieldId, obj) {
	let field = popup.find(fieldId);
	if (field) {
		let property = fieldId.substring(1);
		var ipstr = field.val();
		obj[property] =  OSApp.Analog.intFromBytes(ipstr?ipstr.split("."):0);
		OSApp.Analog.requiredCheck(field, obj, property);
	}
};

OSApp.Analog.getMonitor = function(popup) {
	var result = {};
	OSApp.Analog.addToObjectInt(popup, "#nr", result);
	OSApp.Analog.addToObjectStr(popup, "#name", result);
	OSApp.Analog.addToObjectInt(popup, "#type", result);
	OSApp.Analog.addToObjectInt(popup, "#sensor", result);
	OSApp.Analog.addToObjectInt(popup, "#prog", result);
	OSApp.Analog.addToObjectInt(popup, "#zone", result);
	OSApp.Analog.addToObjectFlt(popup, "#maxrun", result);
	OSApp.Analog.addToObjectInt(popup, "#prio", result);
	OSApp.Analog.addToObjectInt(popup, "#rs", result);

	//Min+Max
	OSApp.Analog.addToObjectFlt(popup, "#value1", result);
	OSApp.Analog.addToObjectFlt(popup, "#value2", result);
	//Sensor12
	OSApp.Analog.addToObjectInt(popup, "#sensor12", result);
	OSApp.Analog.addToObjectChk(popup, "#invers", result);
	//AND+OR+XOR
	OSApp.Analog.addToObjectInt(popup, "#monitor1", result);
	OSApp.Analog.addToObjectInt(popup, "#monitor2", result);
	OSApp.Analog.addToObjectInt(popup, "#monitor3", result);
	OSApp.Analog.addToObjectInt(popup, "#monitor4", result);
	OSApp.Analog.addToObjectChk(popup, "#invers1", result);
	OSApp.Analog.addToObjectChk(popup, "#invers2", result);
	OSApp.Analog.addToObjectChk(popup, "#invers3", result);
	OSApp.Analog.addToObjectChk(popup, "#invers4", result);
	//NOT
	OSApp.Analog.addToObjectInt(popup, "#monitor", result);
	//TIME
	OSApp.Analog.addToObjectTime(popup, "#from", result);
	OSApp.Analog.addToObjectTime(popup, "#to", result);
	OSApp.Analog.addToObjectInt(popup, "#wdays", result); //todo: weekdays as checkboxes
	//REMOTE
	OSApp.Analog.addToObjectIPs(popup, "#ip", result);
	OSApp.Analog.addToObjectInt(popup, "#port", result);

	return result;
};

OSApp.Analog.monitorSelection = function(id, sel, ignore) {
	var list = "<select data-mini='true' id='"+id+"'>";

	list += "<option " + (!sel ? "selected" : "") +
	" value=''>" + OSApp.Language._("unselected") + "</option>";

	for (let i = 0; i < OSApp.Analog.monitors.length; i++) {
		let monitor = OSApp.Analog.monitors[i];
		if (monitor.nr === ignore) continue;
		list += "<option " + ((monitor.nr === sel) ? "selected" : "") +
			" value='" +monitor.nr + "'>" +
			monitor.name + "</option>";
	}
	list += "</select>";
	return list;
}

//Monitor editor
OSApp.Analog.showMonitorEditor = function(monitor, row, callback, callbackCancel) {

	OSApp.Firmware.sendToOS("/mt?pw=", "json").then(function (data) {
		var supportedMonitorTypes = data.monitortypes;
		var i;

		$(".ui-popup-active").find("[data-role='popup']").popup("close");

		var list =
			"<div data-role='popup' data-theme='a' id='monitorEditor' style='max-width:580px;'>" +
			"<div data-role='header' data-theme='b'>" +
			"<a href='#' data-rel='back' data-role='button' data-theme='a' data-icon='delete' data-iconpos='notext' class='ui-btn-right'>"+OSApp.Language._("close")+"</a>"+
			"<h1>" + (monitor.nr > 0 ? OSApp.Language._("Edit monitor and control") : OSApp.Language._("New Monitor")) + "</h1>" +
			"</div>" +

			"<div class='ui-content'>" +
			"<p class='rain-desc center smaller'>" +
			OSApp.Language._("Notice: If you want to combine multiple sensors, then build a sensor group. ") +
			OSApp.Language._("See help documentation for details.") +
			"</p>" +

			"<form>" +

			//Monitor-Nr:
			"<label for='id'>" +
			OSApp.Language._("Monitor-Nr") +
			"<input id='nr' type='number' inputmode='decimal' min='1' max='99999' required value='" + monitor.nr + (monitor.nr > 0 ? "' disabled='disabled'>" : "'>") +
			"</label>" +

			//Monitor-Name:
			"<label for='name'>" +
			OSApp.Language._("Monitor-Name") +
			"<input id='name' type='text' maxlength='29' value='" + monitor.name + "' required>" +
			"</label>" +

			//Select Type:
			"<label for='type' class='select'>" +
			OSApp.Language._("Type") +
			"</label><select data-mini='true' id='type' required>";

		for (i = 0; i < supportedMonitorTypes.length; i++) {
			list += "<option " + ((monitor.type === supportedMonitorTypes[i].type) ? "selected" : "") +
				" value='" + supportedMonitorTypes[i].type + "'>" +
				OSApp.Language._(supportedMonitorTypes[i].name) + "</option>";
		}
		list += "</select>" +

			//Select Sensor:
			"<div id='sel_sensor'><label for='sensor' class='select'>" +
			OSApp.Language._("Sensor") +
			"</label><select data-mini='true' id='sensor'>";

		for (i = 0; i < OSApp.Analog.analogSensors.length; i++) {
			list += "<option " + ((monitor.sensor === OSApp.Analog.analogSensors[i].nr) ? "selected" : "") +
				" value='" + OSApp.Analog.analogSensors[i].nr + "'>" +
				OSApp.Analog.analogSensors[i].nr + " - " + OSApp.Analog.analogSensors[i].name + "</option>";
		}
		list += "</select></div>" +

			//Select Program:
			"<label for='prog' class='select'>" +
			OSApp.Language._("Program to start") +
			"</label><select data-mini='true' id='prog'>" +
			"<option " + (monitor.prog == 0? "selected" : "") + " value='0'>" + OSApp.Language._("Disabled") + "</option>";

		for (i = 0; i < OSApp.currentSession.controller.programs.pd.length; i++) {
			var progName = OSApp.Programs.readProgram(OSApp.currentSession.controller.programs.pd[i]).name;
			var progNr = i + 1;

			list += "<option " + ((monitor.prog === progNr) ? "selected" : "") +
				" value='" + progNr + "'>" +
				progName + "</option>";
		}
		list += "</select>" +

			//Select Zone:
			"<label for='zone' class='select'>" +
			OSApp.Language._("Zone to start") +
			"</label><select data-mini='true' id='zone'>" +
			"<option " + (monitor.zone == 0? "selected" : "") + " value='0'>" + OSApp.Language._("Disabled") + "</option>";

		for (i = 0; i < OSApp.currentSession.controller.stations.snames.length; i++) {
			if ( !OSApp.Stations.isMaster( i ) ) {
				list += "<option " + ( monitor.zone == (i + 1) ? "selected" : "" ) + " value='" + ( i + 1 ) + "'>" +
				OSApp.currentSession.controller.stations.snames[ i ] + "</option>";
			}
		}

		//maxrun
		list += "</select>" +
			"<label for='maxrun'>" + OSApp.Language._("Max runtime (s)") +
			"</label><input id='maxrun' type='number' inputmode='decimal' min='1' max='99999' value='" + monitor.maxrun + "'>" +

		//Priority
			"<label>"+OSApp.Language._("Priority") +
			"</label><select data-mini='true' id='prio'>";
		const prios = [OSApp.Language._("Low"), OSApp.Language._("Medium"), OSApp.Language._("High")];
		if (!monitor.prio)
			monitor.prio = 0;
		for (i = 0; i < 3; i++) {
			list += "<option " + (monitor.prio == i ? "selected" : "") + " value='" + i + "'>" + prios[i] + "</option>";
		}
		list += "</select>";

		//reset seconds (rs)
		if (OSApp.Firmware.checkOSVersion(233) && OSApp.currentSession.controller.options.fwm >= 178) {
			list += "<label for='rs'>" + OSApp.Language._("Reset status after (s)") +
			"</label><input id='rs' type='number' inputmode='decimal' min='0' max='99999' value='" + monitor.rs + "'>";
		}

		//typ = MIN+MAX
		list +=	"<div id='type_minmax'>"+
			"<label for='value1'>" +
			OSApp.Language._("Value for activate") +
			"</label><input id='value1' type='number' inputmode='decimal' value='" + OSApp.Analog.formatVal(monitor.value1) + "'>" +

			"<label for='value2'>" +
			OSApp.Language._("Value for deactivate") +
			"</label><input id='value2' type='number' inputmode='decimal' value='" + OSApp.Analog.formatVal(monitor.value2) + "'>" +
			"</div>" +

		//typ = SENSOR12
			"<div id='type_sensor12'>"+
			"<label for='sensor12'>" +
			OSApp.Language._("Digital Sensor Port") +
			"</label>" +
			"<select data-mini='true' id='sensor12'>" +
			"<option " + (monitor.sensor12 <= 1? "selected" : "") + " value='1'>" + OSApp.Language._("Sensor 1") + "</option>" +
			"<option " + (monitor.sensor12 >= 2? "selected" : "") + " value='2'>" + OSApp.Language._("Sensor 2") + "</option>" +
			"</select>"+
			"<label for='invers'>" +
			"<input data-mini='true' id='invers' type='checkbox' " + (monitor.invers ? "checked='checked'" : "") + ">" + OSApp.Language._("inverse") + "</input>" +
			"</label></div>" +

		//typ = SET_SENSOR12
			"<div id='type_set_sensor12'>"+
			"<label for='sensor12'>" +
			OSApp.Language._("Set Digital Sensor Port") +
			"</label>" +
			"<select data-mini='true' id='sensor12'>" +
			"<option " + (monitor.sensor12 <= 1? "selected" : "") + " value='1'>" + OSApp.Language._("Sensor 1") + "</option>" +
			"<option " + (monitor.sensor12 >= 2? "selected" : "") + " value='2'>" + OSApp.Language._("Sensor 2") + "</option>" +
			"</select>"+
			"<label for='monitor'>"+OSApp.Language._("Monitor")+"</label>"+OSApp.Analog.monitorSelection("monitor", monitor.monitor, monitor.nr)+
			"</label></div>" +

		//typ == ANDORXOR
			"<div id='type_andorxor'>"+
			"<label for='monitor1'>"+OSApp.Language._("Monitor 1")+"</label>"+OSApp.Analog.monitorSelection("monitor1", monitor.monitor1, monitor.nr)+
			"<label for='invers1'><input data-mini='true' id='invers1' type='checkbox' " + (monitor.invers1 ? "checked='checked'" : "") + ">" + OSApp.Language._("inverse") + "</input></label>" +
			"<label for='monitor2'>"+OSApp.Language._("Monitor 2")+"</label>"+OSApp.Analog.monitorSelection("monitor2", monitor.monitor2, monitor.nr)+
			"<label for='invers2'><input data-mini='true' id='invers2' type='checkbox' " + (monitor.invers2 ? "checked='checked'" : "") + ">" + OSApp.Language._("inverse") + "</input></label>" +
			"<label for='monitor3'>"+OSApp.Language._("Monitor 3")+"</label>"+OSApp.Analog.monitorSelection("monitor3", monitor.monitor3, monitor.nr)+
			"<label for='invers3'><input data-mini='true' id='invers3' type='checkbox' " + (monitor.invers3 ? "checked='checked'" : "") + ">" + OSApp.Language._("inverse") + "</input></label>" +
			"<label for='monitor4'>"+OSApp.Language._("Monitor 4")+"</label>"+OSApp.Analog.monitorSelection("monitor4", monitor.monitor4, monitor.nr)+
			"<label for='invers4'><input data-mini='true' id='invers4' type='checkbox' " + (monitor.invers4 ? "checked='checked'" : "") + ">" + OSApp.Language._("inverse") + "</input></label>" +
			"</div>" +

		//typ == NOT
			"<div id='type_not'>"+
			"<label for='monitor'>"+OSApp.Language._("Monitor")+"</label>"+OSApp.Analog.monitorSelection("monitor", monitor.monitor, monitor.nr)+
			"</div>"+

		//typ == TIME
			"<div id='type_time'>"+
			"<label for='from'>"+OSApp.Language._("From")+"</label>"+
			"<input id='from' type='text' maxlength='5' value='" + OSApp.Utils.pad(Math.round(monitor.from / 100)) + ":" + OSApp.Utils.pad(monitor.from % 100) + "'>" +
			"<label for='to'>"+OSApp.Language._("To")+"</label>"+
			"<input id='to' type='text' maxlength='5' value='" + OSApp.Utils.pad(Math.round(monitor.to / 100)) + ":" + OSApp.Utils.pad(monitor.to % 100) + "'>" +
			"<label for='wdays'>"+OSApp.Language._("Weekdays")+"</label>"+ //Todo: days as checkboxes
			"<input id='wdays' type='number' inputmode='decimal' min='0' max ='255' value='" + monitor.wdays + "'>" +
			"</div>"+

		//typ == REMOTE
			"<div id='type_remote'>"+
			"<label for='rmonitor'>"+OSApp.Language._("Remote Monitor nr")+"</label>"+
			"<input id='rmonitor' type='number' inputmode='decimal' min='1' max='99999' value='" + monitor.rmonitor + "'>" +
			"<label for='ip'>"+OSApp.Language._("IP")+"</label>"+
			"<input id='ip' type='text'  value='" + (monitor.ip ? OSApp.Analog.toByteArray(monitor.ip).join(".") : "") + "'>" +
			"<label for='port'>"+OSApp.Language._("Port")+"</label>"+
			"<input id='port' type='number' inputmode='decimal' min='1' max='99999' value='" + monitor.port + "'>" +
			"</div>"+

		//END
			"<button class='submit' data-theme='b'>" + OSApp.Language._("Submit") + "</button>" +

			((row < 0) ? "" : ("<a data-role='button' class='black delete-monitor' value='" + monitor.nr + "' row='" + row + "' href='#' data-icon='delete'>" +
				OSApp.Language._("Delete") + "</a>")) +

			"</form>" +
			"</div>" +
			"</div>";

		let popup = $(list),

			changeValue = function (pos, dir) {
				var input = popup.find(".inputs input").eq(pos),
					val = parseInt(input.val());

				if ((dir === -1 && val === 0) || (dir === 1 && val === 100)) {
					return;
				}

				input.val(val + dir);
			};

		//Delete a program adjust:
		popup.find(".delete-monitor").on("click", function () {
			var dur = $(this),
				value = dur.attr("value"),
				row = dur.attr("row");

			popup.popup("close");

			OSApp.UIDom.areYouSure(OSApp.Language._("Are you sure you want to delete this monitor?"), value, function () {
				return OSApp.Firmware.sendToOS("/mc?pw=&nr=" + value + "&type=0", "json").done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
					else
						OSApp.Analog.monitors.splice(row, 1);
					callbackCancel();
				});
			});
		});

		popup.find(".submit").on("click", function () {

			var monitor = OSApp.Analog.getMonitor(popup);
			if (monitor.missingValue) {
				OSApp.Errors.showError(OSApp.Language._('Please fill the required fields'));
				monitor.missingValue.focus();
			} else {
				callback(monitor);
				popup.popup("close");
			}
			return false;
		});

		OSApp.UIDom.holdButton(popup.find(".incr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, 1);
			return false;
		});

		OSApp.UIDom.holdButton(popup.find(".decr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, -1);
			return false;
		});

		popup.find("#type").change(function () {
			var type = parseInt($(this).val());
			OSApp.Analog.updateMonitorEditorType(popup, type);
		});

		$("#monitorEditor").remove();

		OSApp.Analog.updateMonitorEditorType(popup, monitor.type);

		OSApp.UIDom.openPopup(popup, { positionTo: "origin" });
	});
};

OSApp.Analog.updateMonitorEditorType = function(popup, type) {
	popup.find("#type_minmax").hide();
	popup.find("#type_sensor12").hide();
	popup.find("#type_set_sensor12").hide();
	popup.find("#type_andorxor").hide();
	popup.find("#type_not").hide();
	popup.find("#type_time").hide();
	popup.find("#type_remote").hide();
	popup.find("#sel_sensor").hide();
	switch(type) {
		case OSApp.Analog.Constants.MONITOR_MIN:
		case OSApp.Analog.Constants.MONITOR_MAX:
			popup.find("#sel_sensor").show();
			popup.find("#type_minmax").show();
			break;
		case OSApp.Analog.Constants.MONITOR_SENSOR12:
			popup.find("#type_sensor12").show();
			break;
		case OSApp.Analog.Constants.MONITOR_SET_SENSOR12:
			popup.find("#type_set_sensor12").show();
			break;
		case OSApp.Analog.Constants.MONITOR_AND:
		case OSApp.Analog.Constants.MONITOR_OR:
		case OSApp.Analog.Constants.MONITOR_XOR:
			popup.find("#type_andorxor").show();
			break;
		case OSApp.Analog.Constants.MONITOR_NOT:
			popup.find("#type_not").show();
			break;
		case OSApp.Analog.Constants.MONITOR_TIME:
			popup.find("#type_time").show();
			break;
		case OSApp.Analog.Constants.MONITOR_REMOTE:
			popup.find("#type_remote").show();
			break;
		}
};

OSApp.Analog.isSmt100 = function( sensorType ) {
	if ( !sensorType ) {
		return false;
	}
	return sensorType >= OSApp.Analog.Constants.SENSOR_SMT100_MOIS && sensorType <= OSApp.Analog.Constants.SENSOR_TH100_TEMP;
};

OSApp.Analog.isRS485Sensor = function( sensorType ) {
	return OSApp.Analog.isSmt100(sensorType);
};

OSApp.Analog.isIPSensor = function(sensorType) {
	return OSApp.Analog.isSmt100(sensorType) || sensorType == OSApp.Analog.Constants.SENSOR_REMOTE;
}

OSApp.Analog.isIDNeeded = function(sensorType) {
	return sensorType < OSApp.Analog.Constants.SENSOR_OSPI_INTERNAL_TEMP || sensorType == OSApp.Analog.Constants.SENSOR_REMOTE ||
		sensorType == OSApp.Analog.Constants.SENSOR_FYTA_MOISTURE ||
		sensorType == OSApp.Analog.Constants.SENSOR_FYTA_TEMPERATURE;
}

OSApp.Analog.getBatteryPercent = function(value) {
	if (value === undefined || value === null || value === "") {
		return null;
	}
	var parsed = parseFloat(value);
	if (isNaN(parsed)) {
		return null;
	}
	return Math.max(0, Math.min(100, Math.round(parsed)));
};

OSApp.Analog.renderBatteryIcon = function(percent, showText) {
	if (percent === null || percent === undefined || isNaN(percent)) {
		return "";
	}
	var clamped = Math.max(0, Math.min(100, Math.round(percent)));
	var fillColor = clamped <= 20 ? "#d9534f" : (clamped <= 50 ? "#f0ad4e" : "#5cb85c");
	var innerWidth = Math.max(0, Math.round((clamped / 100) * 16));
	var title = OSApp.Language._("Battery") + ": " + clamped + "%";
	return "<span class='battery-icon' title='" + OSApp.Utils.htmlEscape(title) + "' style='display:inline-flex;align-items:center;gap:4px;vertical-align:middle;'>" +
		"<span style='position:relative;display:inline-block;width:18px;height:10px;border:1px solid #444;border-radius:2px;box-sizing:border-box;background:#fff;'>" +
		"<span style='position:absolute;left:1px;top:1px;bottom:1px;width:" + innerWidth + "px;background:" + fillColor + ";'></span>" +
		"<span style='position:absolute;right:-3px;top:3px;width:2px;height:4px;background:#444;border-radius:1px;'></span>" +
		"</span>" +
		(showText ? "<span style='font-size:12px;'>" + clamped + "%</span>" : "") +
		"</span>";
};

//show and hide sensor editor fields
OSApp.Analog.updateSensorVisibility = function(popup, sensortype) {
	// First hide IP/Port/ID related fields (but NOT the always-visible standard fields)
	popup.find(".ip_label, .port_label, .id_label").hide();
	popup.find(".mac_label").hide();
	if (OSApp.Analog.isRS485Sensor(sensortype)) {
		popup.find(".rs485_port_label").show();
		popup.find(".rs485_port").show();
		popup.find(".rs485_id_label").show();
		popup.find(".rs485_id").show();
		popup.find(".rs485_help").show();
		// IP/Port nur für TCP/IP-basierte RS485-Adapter anzeigen
		popup.find(".ip_label").show();
		popup.find(".port_label").show();
		popup.find(".ip").show();
		popup.find(".port").show();
		// ID-Feld verstecken, da wir rs485_id verwenden
		popup.find(".id_label").hide();
		popup.find(".id").hide();
	} else {
		popup.find(".rs485_port_label").hide();
		popup.find(".rs485_port").hide();
		popup.find(".rs485_id_label").hide();
		popup.find(".rs485_id").hide();
		popup.find(".rs485_help").hide();
		// Normale IP-Sensor-Logik
		if (OSApp.Analog.isIPSensor(sensortype)) {
			popup.find(".ip_label").show();
			popup.find(".port_label").show();
			popup.find(".ip").show();
			popup.find(".port").show();
		} else {
			popup.find(".ip_label").hide();
			popup.find(".port_label").hide();
			popup.find(".ip").hide();
			popup.find(".port").hide();
		}
		if (OSApp.Analog.isIDNeeded(sensortype)) {
			popup.find(".id_label").show();
			popup.find(".id").show();
		} else {
			popup.find(".id_label").hide();
			popup.find(".id").hide();
		}
	}

	if (OSApp.Analog.isSmt100(sensortype)) {
		popup.find("#smt100id").show();
	} else {
		popup.find("#smt100id").hide();
	}

	if (sensortype == OSApp.Analog.Constants.SENSOR_FYTA_MOISTURE || sensortype == OSApp.Analog.Constants.SENSOR_FYTA_TEMPERATURE) {
		popup.find("#fytasel").show();
	} else {
		popup.find("#fytasel").hide();
	}

	if (sensortype == OSApp.Analog.Constants.SENSOR_ZIGBEE) {
		popup.find("#zigbeesel").show();
	} else {
		popup.find("#zigbeesel").hide();
	}

	if (sensortype == OSApp.Analog.Constants.SENSOR_BLUETOOTH) {
		popup.find("#bluetoothsel").show();
		popup.find(".mac_label").show();
		popup.find(".mac").show();
	} else {
		popup.find("#bluetoothsel").hide();
	}

	// Hide all optional containers
	popup.find(".fac_container").hide();
	popup.find(".div_container").hide();
	popup.find(".offset_container").hide();
	popup.find(".unit_container").hide();
	popup.find(".topic_container").hide();
	popup.find(".filter_container").hide();
	popup.find(".zigbee_scan_select_container").hide();
	popup.find(".bluetooth_scan_select_container").hide();
	popup.find(".zigbee_device_ieee_container").hide();
	popup.find(".zigbee_known_sensors_container").hide();
	popup.find(".zigbee_endpoint_container").hide();
	popup.find(".zigbee_cluster_id_container").hide();
	popup.find(".zigbee_attribute_id_container").hide();
	popup.find(".bluetooth_char_uuid_container").hide();
	popup.find(".bluetooth_format_container").hide();

	// Standard fields are already visible (never hidden), no need to show them again

	var unitid = popup.find("#unitid").val();

	if (sensortype == OSApp.Analog.Constants.SENSOR_USERDEF) {
		popup.find(".fac_container").show();
		popup.find(".div_container").show();
		popup.find(".offset_container").show();
		popup.find(".unit_container").show();
	} else if (sensortype == OSApp.Analog.Constants.SENSOR_MQTT) {
		popup.find(".unit_container").show();
		popup.find(".topic_container").show();
		popup.find(".filter_container").show();
	} else if (sensortype == OSApp.Analog.Constants.SENSOR_ZIGBEE) {
		popup.find(".zigbee_device_ieee_container").show();
		popup.find(".zigbee_known_sensors_container").show();
		popup.find(".zigbee_endpoint_container").show();
		popup.find(".zigbee_cluster_id_container").show();
		popup.find(".zigbee_attribute_id_container").show();
		popup.find(".fac_container").show();
		popup.find(".div_container").show();
		popup.find(".offset_container").show();
	} else if (sensortype == OSApp.Analog.Constants.SENSOR_BLUETOOTH) {
		popup.find(".bluetooth_char_uuid_container").show();
		popup.find(".bluetooth_format_container").show();
	}

	// Show unit container for custom unit selection (independent of sensor type)
	if (unitid == OSApp.Analog.Constants.USERDEF_UNIT && sensortype != OSApp.Analog.Constants.SENSOR_USERDEF && sensortype != OSApp.Analog.Constants.SENSOR_MQTT) {
		popup.find(".unit_container").show();
	}

	// Also show unit container for ZigBee sensors with custom unit
	if (sensortype == OSApp.Analog.Constants.SENSOR_ZIGBEE && unitid == OSApp.Analog.Constants.USERDEF_UNIT) {
		popup.find(".unit_container").show();
	}
};

OSApp.Analog.saveSensor = function(popup, sensor, callback) {

	if (!sensor.nr) { //New Sensor - check existing Nr to avoid overwriting
		var nr = parseInt(popup.find(".nr").val());
		for (var i = 0; i < OSApp.Analog.analogSensors.length; i++) {
			if (OSApp.Analog.analogSensors[i].nr === nr) {
				OSApp.Errors.showError(OSApp.Language._("Sensor number exists!"));
				return;
			}
		}
	}
	var sensorOut = {};
	OSApp.Analog.addToObjectInt(popup, ".nr", sensorOut);
	OSApp.Analog.addToObjectInt(popup, "#type", sensorOut);
	OSApp.Analog.addToObjectInt(popup, ".group", sensorOut);
	OSApp.Analog.addToObjectStr(popup, ".name", sensorOut);

	// Für RS485-Sensoren: Verwende rs485_port und rs485_id statt port und id
	if (OSApp.Analog.isRS485Sensor(parseInt(popup.find("#type").val()))) {
		OSApp.Analog.addToObjectIPs(popup, ".ip", sensorOut);
		OSApp.Analog.addToObjectInt(popup, ".rs485_port", sensorOut);
		OSApp.Analog.addToObjectInt(popup, ".rs485_id", sensorOut);
		// Kopiere rs485_port nach port und rs485_id nach id für Backend-Kompatibilität
		if (sensorOut.rs485_port !== undefined) {
			sensorOut.port = sensorOut.rs485_port;
			delete sensorOut.rs485_port;
		}
		if (sensorOut.rs485_id !== undefined) {
			sensorOut.id = sensorOut.rs485_id;
			delete sensorOut.rs485_id;
		}
	} else {
		OSApp.Analog.addToObjectIPs(popup, ".ip", sensorOut);
		OSApp.Analog.addToObjectInt(popup, ".port", sensorOut);
		OSApp.Analog.addToObjectInt(popup, ".id", sensorOut);
	}

	OSApp.Analog.addToObjectInt(popup, ".ri", sensorOut);
	OSApp.Analog.addToObjectInt(popup, "#factor", sensorOut);
	OSApp.Analog.addToObjectInt(popup, "#divider", sensorOut);
	OSApp.Analog.addToObjectInt(popup, "#offset", sensorOut);
	OSApp.Analog.addToObjectStr(popup, "#unit", sensorOut);
	OSApp.Analog.addToObjectInt(popup, "#unitid", sensorOut);
	OSApp.Analog.addToObjectChk(popup, "#enable", sensorOut);
	OSApp.Analog.addToObjectChk(popup, "#log", sensorOut);
	OSApp.Analog.addToObjectChk(popup, "#show", sensorOut);
	OSApp.Analog.addToObjectStr(popup, "#topic", sensorOut);
	OSApp.Analog.addToObjectStr(popup, "#filter", sensorOut);

	// ZigBee-specific fields
	if (parseInt(popup.find("#type").val()) == OSApp.Analog.Constants.SENSOR_ZIGBEE) {
		OSApp.Analog.addToObjectStr(popup, "#device_ieee", sensorOut);
		OSApp.Analog.addToObjectInt(popup, "#endpoint", sensorOut);

		// Convert hex strings to integers for cluster_id and attribute_id
		var clusterIdStr = popup.find("#cluster_id").val();
		if (clusterIdStr) {
			sensorOut.cluster_id = parseInt(clusterIdStr, 16);
		}

		var attributeIdStr = popup.find("#attribute_id").val();
		if (attributeIdStr) {
			sensorOut.attribute_id = parseInt(attributeIdStr, 16);
		}

		// poll_interval (ms) is derived from sensor read interval (ri seconds)
		if (sensorOut.ri !== undefined && sensorOut.ri !== null && !isNaN(sensorOut.ri)) {
			sensorOut.poll_interval = sensorOut.ri * 1000;
		}
	}

	// Bluetooth-specific fields
	if (parseInt(popup.find("#type").val()) == OSApp.Analog.Constants.SENSOR_BLUETOOTH) {
		OSApp.Analog.addToObjectStr(popup, ".mac", sensorOut);
		OSApp.Analog.addToObjectStr(popup, "#char_uuid", sensorOut);
		var bleFormatField = popup.find("#format");
		if (bleFormatField && bleFormatField.length) {
			var bleFormat = parseInt(bleFormatField.val(), 10);
			if (!isNaN(bleFormat)) {
				sensorOut.format = bleFormat;
			}
		}
		// poll_interval (ms) is derived from sensor read interval (ri seconds)
		if (sensorOut.ri !== undefined && sensorOut.ri !== null && !isNaN(sensorOut.ri)) {
			sensorOut.poll_interval = sensorOut.ri * 1000;
		}
	}

	if (sensorOut.missingValue) {
		OSApp.Errors.showError(OSApp.Language._('Please fill the required fields'));
		sensorOut.missingValue.focus();
	} else {
		callback(sensorOut);
		popup.popup("close");
	}
	return false;
};

// Load ZigBee cluster definitions from online source
OSApp.Analog.loadZigBeeClusterData = function() {
	if (OSApp.Analog.zigbeeClusterData !== null && OSApp.Analog.zigbeeClusterData !== undefined) {
		return Promise.resolve(OSApp.Analog.zigbeeClusterData);
	}

	// Try to load from external source first, then fallback to local
	return fetch('https://opensprinklershop.de/zigbeeclusterids.json')
		.then(response => {
			if (!response.ok) {
				// If external source fails, try local fallback
				return fetch('zigbeeclusterids.json');
			}
			return response;
		})
		.then(response => {
			if (!response.ok) {
				console.warn('ZigBee cluster database not available (HTTP ' + response.status + ')');
				return null;
			}
			return response.json();
		})
		.then(data => {
			if (data && Array.isArray(data)) {
				OSApp.Analog.zigbeeClusterData = data;
				return data;
			} else {
				// Cache empty result to avoid repeated requests
				OSApp.Analog.zigbeeClusterData = [];
				return [];
			}
		})
		.catch(error => {
			console.warn('ZigBee cluster database not available:', error.message);
			// Cache the failure to avoid repeated requests
			OSApp.Analog.zigbeeClusterData = [];
			// Return empty array as fallback - manual entry still possible
			return [];
		});
};

// ZigBee device scanner
OSApp.Analog.showZigBeeDeviceScanner = function(popup, callback, errorCallback, scanButton, originalButtonText) {
	// First, open the ZigBee network for pairing
	OSApp.Firmware.sendToOS("/zo?pw=&duration=10", "json").then(function () {
		var scanDialog = $("<div data-role='popup' data-theme='a' id='zigbeeScanner' data-dismissible='false'>" +
			"<div data-role='header' data-theme='b'>" +
			"<h1>" + OSApp.Language._("ZigBee Device Scanner") + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
			"<p class='rain-desc center smaller'>" +
			OSApp.Language._("Scanning for ZigBee devices...") + "<br>" +
			OSApp.Language._("Please pair your device now.") +
			"</p>" +
			"<div id='scanTimer' class='center' style='font-size: 18px; font-weight: bold; margin: 10px 0; color: #2196F3;'></div>" +
			"<div id='lastDevice' class='center smaller' style='margin: 10px 0; padding: 10px; background-color: #f0f0f0; border-radius: 5px; display: none;'></div>" +
			"<div class='zigbee-device-select-container'>" +
			"<label for='zigbeeDeviceSelectScanner'>" + OSApp.Language._("Discovered devices") + "</label>" +
			"<select data-mini='true' id='zigbeeDeviceSelectScanner'></select>" +
			"</div>" +
			"<button class='close-scanner' data-theme='a'>" + OSApp.Language._("Cancel") + "</button>" +
			"</div>" +
			"</div>");

		var scanInterval = null;
		var uiInterval = null;
		var scanTimeout = null;
		var selectedDevice = null;
		var scanStartTime = Date.now();
		var scanDuration = 10;
		var lastFoundDevice = null;
		var requestInFlight = false;
		var didCleanup = false;
		var lastDeviceCount = 0;

		function normalizeZigBeeDevices(data) {
			if (Array.isArray(data)) {
				return data;
			}
			if (data && Array.isArray(data.devices)) {
				return data.devices;
			}
			if (data && data.devices && typeof data.devices === "object") {
				return Object.values(data.devices);
			}
			return [];
		}

		function normalizeZigBeeCount(data, devices) {
			if (data && typeof data.count === "number") {
				return data.count;
			}
			if (data && typeof data.count === "string") {
				var parsed = parseInt(data.count, 10);
				if (!isNaN(parsed)) {
					return parsed;
				}
			}
			return (devices || []).length;
		}

		// Initialize select
		(function initSelect() {
			var sel = scanDialog.find("#zigbeeDeviceSelectScanner");
			sel.empty().append($("<option>").val("").text(OSApp.Language._("No devices found yet. Please pair your device.")));
			try {
				sel.selectmenu("refresh", true);
			} catch (e) {
				// ignore
			}
		})();

		function updateScanUi() {
			var elapsed = Math.floor((Date.now() - scanStartTime) / 1000);
			var remaining = Math.max(0, scanDuration - elapsed);
			if (scanButton && originalButtonText) {
				scanButton.text(OSApp.Language._("Scanning...") + " " + remaining + "s (" + lastDeviceCount + ")");
			}
		}

		function updateDeviceList() {
			if (requestInFlight) {
				return;
			}
			// Timer + button countdown UI is handled by updateScanUi() so it keeps updating even if /zd is slow.

			requestInFlight = true;
			OSApp.Firmware.sendToOS("/zd?pw=", "json").then(function (data) {
				requestInFlight = false;
				var devices = normalizeZigBeeDevices(data);
				var deviceCount = normalizeZigBeeCount(data, devices);
				lastDeviceCount = deviceCount;
				scanDialog.data("zigbeeDevices", devices);

				// Button countdown text is updated by updateScanUi().
				var sel = scanDialog.find("#zigbeeDeviceSelectScanner");
				if (devices && devices.length > 0) {
					sel.empty();
					sel.append($("<option>").val("").text(OSApp.Language._("Select a device...")));
					for (var i = 0; i < devices.length; i++) {
						var device = devices[i] || {};
						var ieeeAddr = device.ieee || device.ieee_addr || "0x0000000000000000";
						var shortAddr = device.short_addr || "0x0000";
						var modelId = device.model || device.model_id || OSApp.Language._("Unknown");
						var manufacturer = device.manufacturer || OSApp.Language._("Unknown");

						var label = modelId + " (" + manufacturer + ") | IEEE: " + ieeeAddr + " | " + OSApp.Language._("Short Address") + ": " + shortAddr;
						sel.append($("<option>").val(String(i)).text(label));

						// Track last found device
						var isNew = (device.is_new === true || device.is_new === 1 || device.is_new === "1");
						if (isNew && !lastFoundDevice) {
							lastFoundDevice = {
								model: modelId,
								ieee: ieeeAddr,
								manufacturer: manufacturer
							};
							scanDialog.find("#lastDevice").html(
								"<strong style='color: green;'>" + OSApp.Language._("Last found") + ":</strong> " +
								OSApp.Utils.htmlEscape(modelId) + " (" + OSApp.Utils.htmlEscape(manufacturer) + ")<br>" +
								"<small>IEEE: " + OSApp.Utils.htmlEscape(ieeeAddr) + "</small>"
							).show();
						}
					}
					try {
						sel.selectmenu("refresh", true);
					} catch (e) {
						// ignore
					}
				} else {
					sel.empty().append($("<option>").val("").text(OSApp.Language._("No devices found yet. Please pair your device.")));
					try {
						sel.selectmenu("refresh", true);
					} catch (e) {
						// ignore
					}
				}
			}, function () {
				requestInFlight = false;
				var sel = scanDialog.find("#zigbeeDeviceSelectScanner");
				sel.empty().append($("<option>").val("").text(OSApp.Language._("No devices found yet. Please pair your device.")));
				try {
					sel.selectmenu("refresh", true);
				} catch (e) {
					// ignore
				}
			});
		}

		// Immediately apply selected device on combobox change
		scanDialog.find("#zigbeeDeviceSelectScanner").off("change").on("change", function () {
			var idxStr = scanDialog.find("#zigbeeDeviceSelectScanner").val();
			var idx = parseInt(idxStr, 10);
			if (idxStr === "" || isNaN(idx)) {
				return;
			}
			var devices = scanDialog.data("zigbeeDevices") || [];
			if (!devices || idx < 0 || idx >= devices.length) {
				return;
			}
			var dev = devices[idx] || null;
			if (!dev) {
				return;
			}
			selectedDevice = {
				ieee: dev.ieee || dev.ieee_addr || "0x0000000000000000",
				short_addr: dev.short_addr || "0x0000",
				model: dev.model || dev.model_id || OSApp.Language._("Unknown"),
				manufacturer: dev.manufacturer || OSApp.Language._("Unknown")
			};

			if (scanInterval) {
				clearInterval(scanInterval);
				scanInterval = null;
			}
			if (uiInterval) {
				clearInterval(uiInterval);
				uiInterval = null;
			}
			if (scanTimeout) {
				clearTimeout(scanTimeout);
				scanTimeout = null;
			}

			OSApp.Firmware.sendToOS("/zc?pw=", "json").always(function () {
				scanDialog.popup("close");
				$("#zigbeeScanner").remove();
				if (callback) {
					callback(selectedDevice);
				}
			});
		});

		function cleanupScanner() {
			if (didCleanup) {
				return;
			}
			didCleanup = true;
			if (scanInterval) {
				clearInterval(scanInterval);
				scanInterval = null;
			}
			if (uiInterval) {
				clearInterval(uiInterval);
				uiInterval = null;
			}
			if (scanTimeout) {
				clearTimeout(scanTimeout);
				scanTimeout = null;
			}
			if (scanButton && originalButtonText) {
				scanButton.text(originalButtonText).prop("disabled", false);
			}
			// Best-effort: close/clear pairing window on backend
			try {
				OSApp.Firmware.sendToOS("/zc?pw=", "json");
			} catch (e) {
				// ignore
			}
		}

		scanDialog.find(".close-scanner").on("click", function () {
			cleanupScanner();
			scanDialog.popup("close");
			$("#zigbeeScanner").remove();
			if (errorCallback && typeof errorCallback === 'function') {
				errorCallback();
			}
		});

	scanDialog.on("popupafterclose", function () {
		cleanupScanner();
		$("#zigbeeScanner").remove();
		if (!selectedDevice && errorCallback && typeof errorCallback === 'function') {
			errorCallback();
		}
	});

	$("#zigbeeScanner").remove();
	scanDialog.css("max-width", "580px");
	OSApp.UIDom.openPopup(scanDialog, { positionTo: "window" });
	// Countdown is already shown in the scan button; hide the extra timer line
	scanDialog.find("#scanTimer").hide();

	// Update device list immediately
	updateDeviceList();
	updateScanUi();
	uiInterval = setInterval(updateScanUi, 250);

	// Update device list every second
	scanInterval = setInterval(updateDeviceList, 1000);

	// Stop scanning after 10 seconds, keep results visible
	scanTimeout = setTimeout(function() {
		if (scanInterval) {
			clearInterval(scanInterval);
			scanInterval = null;
		}
		if (uiInterval) {
			clearInterval(uiInterval);
			uiInterval = null;
		}
		scanDialog.find("#scanTimer").text(OSApp.Language._("Scan finished"));
		scanDialog.find("#scanTimer").show();
		// Best-effort: close/clear pairing window on backend (do not touch UI list)
		try {
			OSApp.Firmware.sendToOS("/zc?pw=", "json");
		} catch (e) {
			// ignore
		}
		if (scanButton && originalButtonText) {
			scanButton.text(originalButtonText).prop("disabled", false);
		}
		scanTimeout = null;
	}, 10000);
}, function () {
	// Error handler - reset button text on failure
	if (scanButton && originalButtonText) {
		scanButton.text(originalButtonText).prop("disabled", false);
	}
	OSApp.Errors.showError(OSApp.Language._("Failed to start ZigBee scanning. Please ensure ZigBee is supported."));
});
};

// Bluetooth device scanner
OSApp.Analog.showBluetoothDeviceScanner = function(popup, callback, errorCallback, scanButton, originalButtonText) {
	// Start Bluetooth scanning (10 seconds)
	OSApp.Firmware.sendToOS("/bs?pw=&duration=10", "json").then(function () {
		var scanDialog = $("<div data-role='popup' data-theme='a' id='bluetoothScanner' data-dismissible='false'>" +
			"<div data-role='header' data-theme='b'>" +
			"<h1>" + OSApp.Language._("Bluetooth Device Scanner") + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +
			"<p class='rain-desc center smaller'>" +
			OSApp.Language._("Scanning for Bluetooth devices...") + "<br>" +
			OSApp.Language._("Please activate your device now.") +
			"</p>" +
			"<div id='scanTimer' class='center' style='font-size: 18px; font-weight: bold; margin: 10px 0; color: #2196F3;'></div>" +
			"<div id='lastDevice' class='center smaller' style='margin: 10px 0; padding: 10px; background-color: #f0f0f0; border-radius: 5px; display: none;'></div>" +
			"<div class='bluetooth-device-select-container'>" +
			"<label for='bluetoothDeviceSelectScanner'>" + OSApp.Language._("Discovered devices") + "</label>" +
			"<select data-mini='true' id='bluetoothDeviceSelectScanner'></select>" +
			"</div>" +
			"<button class='close-scanner' data-theme='a'>" + OSApp.Language._("Cancel") + "</button>" +
			"</div>" +
			"</div>");

		var scanInterval = null;
		var uiInterval = null;
		var scanTimeout = null;
		var selectedDevice = null;
		var scanStartTime = Date.now();
		var scanDuration = 10;
		var lastFoundDevice = null;
		var requestInFlight = false;
		var didCleanup = false;
		var lastDeviceCount = 0;

		function normalizeBluetoothDevices(data) {
			if (Array.isArray(data)) {
				return data;
			}
			if (data && Array.isArray(data.devices)) {
				return data.devices;
			}
			if (data && data.devices && typeof data.devices === "object") {
				return Object.values(data.devices);
			}
			return [];
		}

		function normalizeBluetoothCount(data, devices) {
			if (data && typeof data.count === "number") {
				return data.count;
			}
			if (data && typeof data.count === "string") {
				var parsed = parseInt(data.count, 10);
				if (!isNaN(parsed)) {
					return parsed;
				}
			}
			return (devices || []).length;
		}

		// Initialize select
		(function initSelect() {
			var sel = scanDialog.find("#bluetoothDeviceSelectScanner");
			sel.empty().append($("<option>").val("").text(OSApp.Language._("No devices found yet. Please activate your device.")));
			try {
				sel.selectmenu("refresh", true);
			} catch (e) {
				// ignore
			}
		})();

		function updateScanUi() {
			var elapsed = Math.floor((Date.now() - scanStartTime) / 1000);
			var remaining = Math.max(0, scanDuration - elapsed);
			if (scanButton && originalButtonText) {
				scanButton.text(OSApp.Language._("Scanning...") + " " + remaining + "s (" + lastDeviceCount + ")");
			}
		}

		function updateDeviceList() {
			if (requestInFlight) {
				return;
			}
			// Timer + button countdown UI is handled by updateScanUi() so it keeps updating even if /bd is slow.

			requestInFlight = true;
			OSApp.Firmware.sendToOS("/bd?pw=", "json").then(function (data) {
				requestInFlight = false;
				var devices = normalizeBluetoothDevices(data);
				var deviceCount = normalizeBluetoothCount(data, devices);
				lastDeviceCount = deviceCount;
				scanDialog.data("bluetoothDevices", devices);

				// Button countdown text is updated by updateScanUi().
				var sel = scanDialog.find("#bluetoothDeviceSelectScanner");
				if (devices && devices.length > 0) {
					sel.empty();
					sel.append($("<option>").val("").text(OSApp.Language._("Select a device...")));
					for (var i = 0; i < devices.length; i++) {
						var device = devices[i] || {};
						var macAddr = device.address || device.mac_addr || device.mac || "00:00:00:00:00:00";
						var name = device.name || OSApp.Language._("Unknown Device");
						var rssi = (device.rssi === undefined || device.rssi === null) ? "N/A" : device.rssi;
						var serviceUuid = device.service_uuid || "";
						var serviceName = device.service_name || "";

						var label = name + " | " + macAddr + " | RSSI: " + rssi;
						if (serviceUuid) {
							label += " | " + (serviceName || OSApp.Language._("Unknown")) + " (" + serviceUuid + ")";
						}
						sel.append($("<option>").val(String(i)).text(label));

						// Track last found device
						var isNew = (device.is_new === true || device.is_new === 1 || device.is_new === "1");
						if (isNew && !lastFoundDevice) {
							lastFoundDevice = {
								name: name,
								mac: macAddr,
								rssi: rssi
							};
							scanDialog.find("#lastDevice").html(
								"<strong style='color: green;'>" + OSApp.Language._("Last found") + ":</strong> " +
								OSApp.Utils.htmlEscape(name) + "<br>" +
								"<small>MAC: " + OSApp.Utils.htmlEscape(macAddr) + " | RSSI: " + OSApp.Utils.htmlEscape(rssi) + " dBm</small>"
							).show();
						}
					}
					try {
						sel.selectmenu("refresh", true);
					} catch (e) {
						// ignore
					}
				} else {
					sel.empty().append($("<option>").val("").text(OSApp.Language._("No devices found yet. Please activate your device.")));
					try {
						sel.selectmenu("refresh", true);
					} catch (e) {
						// ignore
					}
				}
			}, function () {
				requestInFlight = false;
				var sel = scanDialog.find("#bluetoothDeviceSelectScanner");
				sel.empty().append($("<option>").val("").text(OSApp.Language._("No devices found yet. Please activate your device.")));
				try {
					sel.selectmenu("refresh", true);
				} catch (e) {
					// ignore
				}
			});
		}

		// Immediately apply selected device on combobox change
		scanDialog.find("#bluetoothDeviceSelectScanner").off("change").on("change", function () {
			var idxStr = scanDialog.find("#bluetoothDeviceSelectScanner").val();
			var idx = parseInt(idxStr, 10);
			if (idxStr === "" || isNaN(idx)) {
				return;
			}
			var devices = scanDialog.data("bluetoothDevices") || [];
			if (!devices || idx < 0 || idx >= devices.length) {
				return;
			}
			var dev = devices[idx] || null;
			if (!dev) {
				return;
			}
			var charUuid = dev.char_uuid || dev.characteristic_uuid || dev.charUuid || dev.characteristicUuid || "";
			selectedDevice = {
				mac: dev.address || dev.mac_addr || dev.mac || "00:00:00:00:00:00",
				name: dev.name || OSApp.Language._("Unknown Device"),
				rssi: (dev.rssi === undefined || dev.rssi === null) ? "N/A" : dev.rssi,
				service_uuid: dev.service_uuid || "",
				service_name: dev.service_name || "",
				char_uuid: charUuid
			};

			if (scanInterval) {
				clearInterval(scanInterval);
				scanInterval = null;
			}
			if (uiInterval) {
				clearInterval(uiInterval);
				uiInterval = null;
			}
			if (scanTimeout) {
				clearTimeout(scanTimeout);
				scanTimeout = null;
			}

			OSApp.Firmware.sendToOS("/bc?pw=", "json").always(function () {
				scanDialog.popup("close");
				$("#bluetoothScanner").remove();
				if (callback) {
					callback(selectedDevice);
				}
			});
		});

		function cleanupScanner() {
			if (didCleanup) {
				return;
			}
			didCleanup = true;
			if (scanInterval) {
				clearInterval(scanInterval);
				scanInterval = null;
			}
			if (uiInterval) {
				clearInterval(uiInterval);
				uiInterval = null;
			}
			if (scanTimeout) {
				clearTimeout(scanTimeout);
				scanTimeout = null;
			}
			if (scanButton && originalButtonText) {
				scanButton.text(originalButtonText).prop("disabled", false);
			}
			// Clear scan flags on the backend (ignore failures)
			try {
				OSApp.Firmware.sendToOS("/bc?pw=", "json");
			} catch (e) {
				// ignore
			}
		}

		scanDialog.find(".close-scanner").on("click", function () {
			cleanupScanner();
			scanDialog.popup("close");
			$("#bluetoothScanner").remove();
			if (errorCallback && typeof errorCallback === 'function') {
				errorCallback();
			}
		});

	scanDialog.on("popupafterclose", function () {
		cleanupScanner();
		$("#bluetoothScanner").remove();
		if (!selectedDevice && errorCallback && typeof errorCallback === 'function') {
			errorCallback();
		}
	});

	$("#bluetoothScanner").remove();
	scanDialog.css("max-width", "580px");
	OSApp.UIDom.openPopup(scanDialog, { positionTo: "window" });
	// Countdown is already shown in the scan button; hide the extra timer line
	scanDialog.find("#scanTimer").hide();

	// Update device list immediately
	updateDeviceList();
	updateScanUi();
	uiInterval = setInterval(updateScanUi, 250);

	// Update device list every second
	scanInterval = setInterval(updateDeviceList, 1000);

	// Stop scanning after 10 seconds, keep results visible
	scanTimeout = setTimeout(function() {
		if (scanInterval) {
			clearInterval(scanInterval);
			scanInterval = null;
		}
		if (uiInterval) {
			clearInterval(uiInterval);
			uiInterval = null;
		}
		scanDialog.find("#scanTimer").text(OSApp.Language._("Scan finished"));
		scanDialog.find("#scanTimer").show();
		// Best-effort: clear scan flags on backend (do not touch UI list)
		try {
			OSApp.Firmware.sendToOS("/bc?pw=", "json");
		} catch (e) {
			// ignore
		}
		if (scanButton && originalButtonText) {
			scanButton.text(originalButtonText).prop("disabled", false);
		}
		scanTimeout = null;
	}, 10000);
}, function () {
	// Error handler - reset button text on failure
	if (scanButton && originalButtonText) {
		scanButton.text(originalButtonText).prop("disabled", false);
	}
	OSApp.Errors.showError(OSApp.Language._("Failed to start Bluetooth scanning. Please ensure Bluetooth is supported."));
});
};



// Analog sensor editor
OSApp.Analog.showSensorEditor = function(sensor, row, callback, callbackCancel) {

	OSApp.Firmware.sendToOS("/sf?pw=", "json").then(function (data) {
		var supportedSensorTypes = data.sensorTypes;
		var i;
		var sensorFormat = parseInt(sensor.format, 10);
		if (isNaN(sensorFormat)) {
			sensorFormat = 0;
		}
		var batteryPercent = OSApp.Analog.getBatteryPercent(sensor.battery);
		var batteryHtml = batteryPercent !== null ? OSApp.Analog.renderBatteryIcon(batteryPercent, true) : "";
		var batteryStyle = batteryPercent !== null ? "" : "display:none;";

		$(".ui-popup-active").find("[data-role='popup']").popup("close");

		var list = "<div data-role='popup' data-theme='a' id='sensorEditor'>" +
			"<div data-role='header' data-theme='b'>" +
			"<a href='#' data-rel='back' data-role='button' data-theme='a' data-icon='delete' data-iconpos='notext' class='ui-btn-right'>"+OSApp.Language._("close")+"</a>"+
			"<h1>" + (sensor.nr > 0 ? OSApp.Language._("Edit Sensor") : OSApp.Language._("New Sensor")) + "</h1>" +
			"</div>" +
			"<div class='ui-content'>" +

		OSApp.Language._("Edit Sensor Configuration. ") +
		OSApp.Language._("See help documentation for details.") +
		"<br>" +
		OSApp.Language._("Last") + ": " + (sensor.last === undefined ? "" : OSApp.Dates.dateToString(new Date(sensor.last * 1000))) +
		"</p>" +

"<div class='battery_container' style='" + batteryStyle + "'><label>" + OSApp.Language._("Battery") + "</label>" +
	"<div class='battery_value' style='margin-top:4px;'>" + batteryHtml + "</div></div>" +

"<div class='sensor_nr_label'><label for='sensor_nr'>" + OSApp.Language._("Sensor Nr.") + "</label>" +
	"<input class='nr' id='sensor_nr' data-mini='true' type='number' inputmode='decimal' min='1' max='99999' required value='" + sensor.nr + (sensor.nr > 0 ? "' disabled='disabled'></div>" : "'></div>") +

	"<div class='name_label'><label for='sensor_name'>" + OSApp.Language._("Name") + "</label>" +
	"<input class='name' id='sensor_name' data-mini='true' type='text' maxlength='40' value='" + (sensor.name ? sensor.name : "") + "'></div>" +

	"<div class='group_label'><label for='sensor_group'>" + OSApp.Language._("Group") + "</label>" +
	"<input class='group' id='sensor_group' data-mini='true' type='number' inputmode='decimal' min='0' max='255' value='" + (sensor.group ? sensor.group : "0") + "'></div>" +

	"<div class='type_label'><label for='type'>" + OSApp.Language._("Type") + "</label>" +
	"<select id='type' data-mini='true' required>";

for (i = 0; i < supportedSensorTypes.length; i++) {
	list += "<option" + (sensor.type === supportedSensorTypes[i].type ? " selected" : "") +
	" value='" + supportedSensorTypes[i].type + "'>" +
		OSApp.Language._(supportedSensorTypes[i].name) + "</option>";
}
list += "</select></div>" +

		//SMT 100 Edit ID Button:
		"<button data-mini='true' id='smt100id' style='margin:5px 0;'>" + OSApp.Language._("Set SMT100 Modbus ID") + "</button>" +

		//FYTA edit credentials button:
		"<button data-mini='true' id='fytasel' style='margin:5px 0;'>" + OSApp.Language._("Select FYTA plant and sensor") + "</button>" +

		//ZigBee device scanner button:
	"<button data-mini='true' id='zigbeesel' style='display:none;margin:5px 0;'>" + OSApp.Language._("Scan for ZigBee Devices") + "</button>" +
	"<div class='zigbee_scan_select_container' style='display:none; margin: 10px 0;'>" +
	"<div class='zigbee-device-select-container'>" +
	"<label for='zigbeeDeviceSelect'>" + OSApp.Language._("Discovered devices") + "</label>" +
	"<select data-mini='true' id='zigbeeDeviceSelect'></select>" +
	"</div>" +
	"</div>" +
	"<div id='zigbeeScanArea' class='ui-body ui-body-a' style='display:none; margin: 10px 0; padding: 10px; border-radius: 5px;'>" +
	"<div id='zigbeeScanTimer' class='center' style='font-size: 16px; font-weight: bold; margin: 5px 0; color: #2196F3;'></div>" +
	"</div>" +
		//Bluetooth device scanner button:
	"<button data-mini='true' id='bluetoothsel' style='display:none;margin:5px 0;'>" + OSApp.Language._("Scan for Bluetooth Devices") + "</button>" +
	"<div class='bluetooth_scan_select_container' style='display:none; margin: 10px 0;'>" +
	"<div class='bluetooth-device-select-container'>" +
	"<label for='bluetoothDeviceSelect'>" + OSApp.Language._("Discovered devices") + "</label>" +
	"<select data-mini='true' id='bluetoothDeviceSelect'></select>" +
	"</div>" +
	"</div>" +
	"<div id='bluetoothScanArea' class='ui-body ui-body-a' style='display:none; margin: 10px 0; padding: 10px; border-radius: 5px;'>" +
	"<div id='bluetoothScanTimer' class='center' style='font-size: 16px; font-weight: bold; margin: 5px 0; color: #2196F3;'></div>" +
	"</div>" +
"<div class='ip_label'><label for='sensor_ip'>" + OSApp.Language._("IP Address") + "</label>" +
	"<input class='ip' id='sensor_ip' data-mini='true' type='text' value='" + (sensor.ip ? OSApp.Analog.toByteArray(sensor.ip).join(".") : "") + "'></div>" +

"<div class='port_label'><label for='sensor_port'>" + OSApp.Language._("Port") + "</label>" +
	"<input class='port' id='sensor_port' data-mini='true' type='number' inputmode='decimal' min='0' max='65535' value='" + sensor.port + "'></div>" +

"<div class='id_label'><label for='sensor_id'>" + OSApp.Language._("ID") + "</label>" +
	"<input class='id' id='sensor_id' data-mini='true' type='number' inputmode='decimal' min='-2147483647' max='2147483647' value='" + sensor.id + "'></div>" +

"<div class='mac_label'><label for='sensor_mac'>" + OSApp.Language._("MAC Address") + "</label>" +
	"<input class='mac' id='sensor_mac' data-mini='true' type='text' value='" + (sensor.mac ? sensor.mac : "") + "'></div>" +

			"<div class='rs485_help ui-body ui-body-a' style='display:none; margin: 10px 0; padding: 10px; border-radius: 5px;'>" +
			"<p style='margin: 0; font-size: 0.9em;'>" + OSApp.Language._("RS485 Configuration Help:") + "<br>" +
			OSApp.Language._("For TCP/IP RS485 adapter: Enter IP address and port (e.g., 192.168.1.100:502)") + "<br>" +
			OSApp.Language._("For I2C/USB RS485 adapter: Leave IP empty and set Port to device number (0-3)") + "<br>" +
			OSApp.Language._("Modbus ID: The sensor's Modbus address (1-247)") + "</p>" +
			"</div>" +

"<div class='rs485_port_label'><label for='rs485_port'>" + OSApp.Language._("RS485 Device/Port") + "</label>" +
	"<input class='rs485_port' id='rs485_port' data-mini='true' type='number' inputmode='decimal' min='0' max='65535' value='" + (sensor.port ? sensor.port : 0) + "'></div>" +

"<div class='rs485_id_label'><label for='rs485_id'>" + OSApp.Language._("Modbus ID") + "</label>" +
	"<input class='rs485_id' id='rs485_id' data-mini='true' type='number' inputmode='decimal' min='1' max='247' value='" + (sensor.id ? sensor.id : 1) + "'></div>" +

"<div class='fac_container' style='display:none;'><label for='factor'>" + OSApp.Language._("Factor") + "</label>" +
	"<input type='number' id='factor' data-mini='true' inputmode='decimal' min='-32768' max='32767' value='" + sensor.fac + "'></div>" +

"<div class='div_container' style='display:none;'><label for='divider'>" + OSApp.Language._("Divider") + "</label>" +
	"<input type='number' id='divider' data-mini='true' inputmode='decimal' min='-32768' max='32767' value='" + sensor.div + "'></div>" +

"<div class='offset_container' style='display:none;'><label for='offset'>" + OSApp.Language._("Offset (mV)") + "</label>" +
	"<input type='number' id='offset' data-mini='true' inputmode='decimal' min='-32768' max='32767' value='" + sensor.offset + "'></div>" +

	"<div class='chartunit_label'><label for='unitid'>" + OSApp.Language._("Chart Unit") + "</label>" +
	"<select data-mini='true' id='unitid'>" +
			"<option value='0'>" + OSApp.Language._("Default") + "</option>" +
			"<option value='1'>" + OSApp.Language._("Soil Moisture %") + "</option>" +
			"<option value='2'>" + OSApp.Language._("Degree Celsius " + String.fromCharCode(176) + "C") + "</option>" +
			"<option value='3'>" + OSApp.Language._("Degree Fahrenheit " + String.fromCharCode(176) + "F") + "</option>" +
			"<option value='4'>" + OSApp.Language._("Volt V") + "</option>" +
			"<option value='5'>" + OSApp.Language._("Air Humidity %") + "</option>" +
			"<option value='6'>" + OSApp.Language._("Inch in") + "</option>" +
			"<option value='7'>" + OSApp.Language._("Millimeter mm") + "</option>" +
			"<option value='8'>" + OSApp.Language._("MPH") + "</option>" +
			"<option value='9'>" + OSApp.Language._("KM/H") + "</option>" +
			"<option value='10'>" + OSApp.Language._("Level %") + "</option>" +
			"<option value='11'>" + OSApp.Language._("DK") + "</option>" +
			"<option value='12'>" + OSApp.Language._("Lumen (lm)") + "</option>" +
			"<option value='13'>" + OSApp.Language._("LUX (lx)") + "</option>" +
			"<option value='99'>" + OSApp.Language._("Custom Unit") + "</option>" +
		"</select></div>" +
"<div class='unit_container' style='display:none;'><label for='unit'>" + OSApp.Language._("Unit") + "</label>" +
	"<input type='text' id='unit' data-mini='true' maxlength='10' value='" + (sensor.unit ? sensor.unit : "") + "'></div>" +

"<div class='topic_container' style='display:none;'><label for='topic'>" + OSApp.Language._("MQTT Topic") + "</label>" +
	"<input type='text' id='topic' data-mini='true' maxlength='100' value='" + (sensor.topic ? sensor.topic : "") + "'></div>" +

"<div class='filter_container' style='display:none;'><label for='filter'>" + OSApp.Language._("MQTT Filter") + "</label>" +
	"<input type='text' id='filter' data-mini='true' maxlength='100' value='" + (sensor.filter ? sensor.filter : "") + "'></div>" +

"<div class='zigbee_device_ieee_container' style='display:none;'><label for='device_ieee'>" + OSApp.Language._("ZigBee Device IEEE Address") + "</label>" +
		"<input type='text' id='device_ieee' data-mini='true' value='" + (sensor.device_ieee ? sensor.device_ieee : "") + "' readonly></div>" +

"<div class='zigbee_known_sensors_container' style='display:none;'>" +
		"<label for='known_zigbee_sensors'>" + OSApp.Language._("Known Sensor Types") + "</label>" +
		"<select id='known_zigbee_sensors' data-mini='true'>" +
		"<option value=''>" + OSApp.Language._("Sensor Template") + "</option>" +
		"<option value='__report__'>" + OSApp.Language._("Report New Sensor") + "</option>" +
		"</select>" +
			"</div>" +

"<div class='zigbee_endpoint_container' style='display:none;'><label for='endpoint'>" + OSApp.Language._("Endpoint") + "</label>" +
		"<input type='number' id='endpoint' data-mini='true' inputmode='decimal' min='1' max='255' value='" + (sensor.endpoint ? sensor.endpoint : "1") + "'></div>" +

"<div class='zigbee_cluster_id_container' style='display:none;'><label for='cluster_id'>" + OSApp.Language._("Cluster ID (hex)") + "</label>" +
		"<input type='text' id='cluster_id' data-mini='true' value='" + (function() { if (!sensor.cluster_id && sensor.cluster_id !== 0) return "0x0408"; var val = sensor.cluster_id; if (typeof val === 'string') { val = val.startsWith('0x') ? parseInt(val, 16) : parseInt(val, 10); } return isNaN(val) ? "0x0408" : "0x" + val.toString(16).toUpperCase().padStart(4, '0'); })() + "'></div>" +

"<div class='zigbee_attribute_id_container' style='display:none;'><label for='attribute_id'>" + OSApp.Language._("Attribute ID (hex)") + "</label>" +
		"<input type='text' id='attribute_id' data-mini='true' value='" + (function() { if (!sensor.attribute_id && sensor.attribute_id !== 0) return "0x0000"; var val = sensor.attribute_id; if (typeof val === 'string') { val = val.startsWith('0x') ? parseInt(val, 16) : parseInt(val, 10); } return isNaN(val) ? "0x0000" : "0x" + val.toString(16).toUpperCase().padStart(4, '0'); })() + "'></div>" +

"<div class='bluetooth_char_uuid_container' style='display:none;'><label for='char_uuid'>" + OSApp.Language._("Characteristic UUID") + "</label>" +
		"<input type='text' id='char_uuid' data-mini='true' value='" + (sensor.char_uuid ? sensor.char_uuid : "") + "'></div>" +

"<div class='bluetooth_format_container' style='display:none;'><label for='format'>" + OSApp.Language._("Format") + "</label>" +
		"<select id='format' data-mini='true'>" +
		"<option value='0' " + ((sensorFormat === 0) ? "selected" : "") + ">FORMAT_RAW (0)</option>" +
		"<option value='1' " + ((sensorFormat === 1) ? "selected" : "") + ">FORMAT_UINT8 (1)</option>" +
		"<option value='2' " + ((sensorFormat === 2) ? "selected" : "") + ">FORMAT_INT8 (2)</option>" +
		"<option value='3' " + ((sensorFormat === 3) ? "selected" : "") + ">FORMAT_UINT16_LE (3)</option>" +
		"<option value='4' " + ((sensorFormat === 4) ? "selected" : "") + ">FORMAT_INT16_LE (4)</option>" +
		"<option value='5' " + ((sensorFormat === 5) ? "selected" : "") + ">FORMAT_UINT16_BE (5)</option>" +
		"<option value='6' " + ((sensorFormat === 6) ? "selected" : "") + ">FORMAT_INT16_BE (6)</option>" +
		"<option value='7' " + ((sensorFormat === 7) ? "selected" : "") + ">FORMAT_UINT32_LE (7)</option>" +
		"<option value='8' " + ((sensorFormat === 8) ? "selected" : "") + ">FORMAT_INT32_LE (8)</option>" +
		"<option value='9' " + ((sensorFormat === 9) ? "selected" : "") + ">FORMAT_FLOAT_LE (9)</option>" +
		"<option value='10' " + ((sensorFormat === 10) ? "selected" : "") + ">FORMAT_TEMP_001 (10)</option>" +
		"<option value='11' " + ((sensorFormat === 11) ? "selected" : "") + ">FORMAT_HUM_001 (11)</option>" +
		"<option value='12' " + ((sensorFormat === 12) ? "selected" : "") + ">FORMAT_PRESS_PA (12)</option>" +
		"<option value='20' " + ((sensorFormat === 20) ? "selected" : "") + ">FORMAT_XIAOMI_TEMP (20)</option>" +
		"<option value='21' " + ((sensorFormat === 21) ? "selected" : "") + ">FORMAT_XIAOMI_HUM (21)</option>" +
		"<option value='30' " + ((sensorFormat === 30) ? "selected" : "") + ">FORMAT_TUYA_SOIL (30)</option>" +
		"</select></div>" +

"<div class='ri_label'><label for='sensor_ri'>" + OSApp.Language._("Read Interval (s)") + "</label>" +
	"<input class='ri' id='sensor_ri' data-mini='true' type='number' inputmode='decimal' min='1' max='999999' value='" + sensor.ri + "'></div>" +

			"<label for='enable'><input data-mini='true' id='enable' type='checkbox' " + ((sensor.enable === 1) ? "checked='checked'" : "") + ">" +
			OSApp.Language._("Sensor Enabled") + "</label>" +

			"<label for='log'><input data-mini='true' id='log' type='checkbox' " + ((sensor.log === 1) ? "checked='checked'" : "") + ">" +
			OSApp.Language._("Enable Data Logging") +
			//"<a href='#' data-role='button' data-mini='true' id='display-log' value='"+sensor.nr+"' data-icon='action' data-inline='true' style='margin-left: 9px;'>" +
			//OSApp.Language._("display log") + "</a>" +
			"<a href='#' data-role='button' data-mini='true' id='download-log' data-icon='action' data-inline='true' style='margin-left: 9px;'>" +
			OSApp.Language._("download log") + "</a>" +
			"<a href='#' data-role='button' data-mini='true' id='delete-sen-log' value='" + sensor.nr + "' data-icon='delete' data-inline='true' style='margin-left: 9px;'>" +
			OSApp.Language._("delete log") + "</a>" +
			"</label>" +

			"<label for='show'><input data-mini='true' id='show' type='checkbox' " + ((sensor.show === 1) ? "checked='checked'" : "") + ">" +
			OSApp.Language._("Show on Mainpage") +	"</label>" +

			"</form>" +

			"<button class='submit' data-theme='b'>" + OSApp.Language._("Submit") + "</button>" +

			((row < 0) ? "" : ("<a data-role='button' class='show-sensor-log' value='" + sensor.nr + "' href='#' data-mini='true' data-icon='grid'>" +
				OSApp.Language._("Show Analog Sensor Log") + "</a>")) +

			((row < 0) ? "" : ("<a data-role='button' class='copy-sensor' value='" + sensor.nr + "' href='#' data-mini='true' data-icon='plus'>" +
				OSApp.Language._("Copy Sensor") + "</a>")) +

			((row < 0) ? "" : ("<a data-role='button' class='black delete-sensor' value='" + sensor.nr + "' row='" + row + "' href='#' data-icon='delete'>" +
				OSApp.Language._("Delete") + "</a>")) +

			"</div>" +
			"</div>";

		var popup = $(list),

			changeValue = function (pos, dir) {
				var input = popup.find(".inputs input").eq(pos),
					val = parseInt(input.val());

				if ((dir === -1 && val === 0) || (dir === 1 && val === 100)) {
					return;
				}

				input.val(val + dir);
			};

		popup.find("#type").change(function () {
			var sensortype = parseInt($(this).val());
			OSApp.Analog.updateSensorVisibility(popup, sensortype);
		});

		popup.find("#unitid").change(function () {
			var sensortype = parseInt(popup.find("#type").val());
			OSApp.Analog.updateSensorVisibility(popup, sensortype);
		});

		//SMT 100 Toolbox function: SET ID
		popup.find("#smt100id").on("click", function () {
			var nr = parseInt(popup.find(".nr").val()),
				newid = parseInt(popup.find(".id").val());
			OSApp.Analog.saveSensor(popup, sensor, callback);
			OSApp.UIDom.areYouSure(OSApp.Language._("This function sets the Modbus ID for one SMT100 sensor. Disconnect all other sensors on this Modbus port. Please confirm."),
				"new id=" + newid, function () {
					OSApp.Firmware.sendToOS("/sa?pw=&nr=" + nr + "&id=" + newid).done(function () {
						window.alert(OSApp.Language._("SMT100 id assigned!"));
						OSApp.Analog.updateAnalogSensor(callbackCancel);
					});
				});
		});

		//ZigBee: Scan for devices
		popup.find("#zigbeesel").on("click", function (e) {
			e.preventDefault();
			var btn = $(this);
			var originalText = btn.text();
			btn.text(OSApp.Language._("Scanning...") + " 10s (0)").prop("disabled", true);

			// Show scan area + selection
			popup.find("#zigbeeScanArea").show();
			// Countdown is already shown in the scan button; hide the extra timer line
			popup.find("#zigbeeScanTimer").hide().text("");
			popup.find(".zigbee_scan_select_container").show();

			var scanStartTime = Date.now();
			var scanDuration = 10;
			var lastFoundDevice = null;
			var scanInterval = null;
			var uiInterval = null;
			var scanTimeout = null;
			var requestInFlight = false;
			var didCleanup = false;
			var lastDeviceCount = 0;

			function updateScanUi() {
				var elapsed = Math.floor((Date.now() - scanStartTime) / 1000);
				var remaining = Math.max(0, scanDuration - elapsed);
				btn.text(OSApp.Language._("Scanning...") + " " + remaining + "s (" + lastDeviceCount + ")");
			}

			// Start countdown UI immediately (even if /zo is slow)
			updateScanUi();
			uiInterval = setInterval(updateScanUi, 250);

			function normalizeZigBeeDevices(data) {
				if (Array.isArray(data)) {
					return data;
				}
				if (data && Array.isArray(data.devices)) {
					return data.devices;
				}
				if (data && data.devices && typeof data.devices === "object") {
					return Object.values(data.devices);
				}
				return [];
			}

			function normalizeZigBeeCount(data, devices) {
				if (data && typeof data.count === "number") {
					return data.count;
				}
				if (data && typeof data.count === "string") {
					var parsed = parseInt(data.count, 10);
					if (!isNaN(parsed)) {
						return parsed;
					}
				}
				return (devices || []).length;
			}

			// Start ZigBee scan
			OSApp.Firmware.sendToOS("/zo?pw=&duration=10", "json").then(function () {

				// Prepare UI elements
				var deviceSelect = popup.find("#zigbeeDeviceSelect");
				deviceSelect.empty();
				popup.data("zigbeeDevices", []);
				deviceSelect.append($("<option>").val("").text(OSApp.Language._("No devices found yet. Please pair your device.")));
				try {
					deviceSelect.selectmenu("refresh", true);
				} catch (e) {
					// ignore
				}

				function updateDeviceList() {
					if (requestInFlight) {
						return;
					}
					// Timer UI is handled by updateScanUi() so it keeps updating even if /zd is slow.

					requestInFlight = true;
					OSApp.Firmware.sendToOS("/zd?pw=", "json").then(function (data) {
						requestInFlight = false;
						var devices = normalizeZigBeeDevices(data);
						popup.data("zigbeeDevices", devices);
						lastDeviceCount = normalizeZigBeeCount(data, devices);

						var deviceSelect = popup.find("#zigbeeDeviceSelect");

						if (devices && devices.length > 0) {
							deviceSelect.empty();
							deviceSelect.append($("<option>").val("").text(OSApp.Language._("Select a device...")));
							for (var i = 0; i < devices.length; i++) {
								var device = devices[i] || {};
								var ieeeAddr = device.ieee || device.ieee_addr || "0x0000000000000000";
								var modelId = device.model || device.model_id || OSApp.Language._("Unknown");
								var manufacturer = device.manufacturer || OSApp.Language._("Unknown");

								var label = modelId + " (" + manufacturer + ") | IEEE: " + ieeeAddr;
								deviceSelect.append($("<option>").val(String(i)).text(label));
							}
							try {
								deviceSelect.selectmenu("refresh", true);
							} catch (e) {
								// ignore
							}
						} else {
							deviceSelect.empty().append($("<option>").val("").text(OSApp.Language._("No devices found yet. Please pair your device.")));
							try {
								deviceSelect.selectmenu("refresh", true);
							} catch (e) {
								// ignore
							}
						}
					}, function () {
						requestInFlight = false;
						var deviceSelectErr = popup.find("#zigbeeDeviceSelect");
						deviceSelectErr.empty().append($("<option>").val("").text(OSApp.Language._("No devices found yet. Please pair your device.")));
						try {
							deviceSelectErr.selectmenu("refresh", true);
						} catch (e) {
							// ignore
						}
					});
				}

				// Immediately apply selected ZigBee device to fields on combobox change
				popup.find("#zigbeeDeviceSelect").off("change").on("change", function () {
					var idxStr = popup.find("#zigbeeDeviceSelect").val();
					var idx = parseInt(idxStr, 10);
					if (idxStr === "" || isNaN(idx)) {
						return;
					}
					var devices = popup.data("zigbeeDevices") || [];
					if (!devices || idx < 0 || idx >= devices.length) {
						return;
					}
					var dev = devices[idx] || null;
					if (!dev) {
						return;
					}
					var selectedDevice = {
						ieee: dev.ieee || dev.ieee_addr || "0x0000000000000000",
						model: dev.model || dev.model_id || OSApp.Language._("Unknown"),
						manufacturer: dev.manufacturer || OSApp.Language._("Unknown")
					};

					// Stop scanning timers but keep the device list visible
					if (scanInterval) {
						clearInterval(scanInterval);
						scanInterval = null;
					}
					if (uiInterval) {
						clearInterval(uiInterval);
						uiInterval = null;
					}
					if (scanTimeout) {
						clearTimeout(scanTimeout);
						scanTimeout = null;
					}

					OSApp.Firmware.sendToOS("/zc?pw=", "json").always(function () {
						popup.find("#zigbeeScanArea").hide();
						btn.text(originalText).prop("disabled", false);

						popup.find("#device_ieee").val(selectedDevice.ieee).trigger("change");

						var currentName = popup.find(".name").val();
						if (!currentName || currentName.trim() === "") {
							var nameField = popup.find(".name");
							nameField.val(selectedDevice.model).trigger("change");
							try {
								nameField.textinput("refresh");
							} catch (e) {
								// ignore
							}
						}

						if (selectedDevice.model.toLowerCase().includes("temp")) {
							popup.find("#cluster_id").val("0x0402");
							popup.find("#attribute_id").val("0x0000");
						} else if (selectedDevice.model.toLowerCase().includes("humid")) {
							popup.find("#cluster_id").val("0x0405");
							popup.find("#attribute_id").val("0x0000");
						} else if (selectedDevice.model.toLowerCase().includes("soil") || selectedDevice.model.toLowerCase().includes("moist")) {
							popup.find("#cluster_id").val("0x0408");
							popup.find("#attribute_id").val("0x0000");
						}

						popup.find(".name").focus();
					});
				});

				// Update device list immediately
				updateDeviceList();

				// Update device list every second
				scanInterval = setInterval(updateDeviceList, 1000);

				// Stop scanning after 10 seconds, keep results visible
				scanTimeout = setTimeout(function() {
					// Stop scanning, but keep discovered devices visible for selection
					if (scanInterval) {
						clearInterval(scanInterval);
						scanInterval = null;
					}
					if (uiInterval) {
						clearInterval(uiInterval);
						uiInterval = null;
					}
					popup.find("#zigbeeScanTimer").text(OSApp.Language._("Scan finished"));
					// Collapse scan area, keep select visible
					popup.find("#zigbeeScanArea").hide();
					// Best-effort: close/clear pairing window on backend (do not touch UI list)
					try {
						OSApp.Firmware.sendToOS("/zc?pw=", "json");
					} catch (e) {
						// ignore
					}
					btn.text(originalText).prop("disabled", false);
					scanTimeout = null;
				}, 10000);

			}, function () {
				// Error handler
				if (uiInterval) {
					clearInterval(uiInterval);
					uiInterval = null;
				}
				btn.text(originalText).prop("disabled", false);
				popup.find("#zigbeeScanArea").hide();
				popup.find(".zigbee_scan_select_container").hide();
				OSApp.Errors.showError(OSApp.Language._("Failed to start ZigBee scanning. Please ensure ZigBee is supported."));
			});

			return false;
		});
	// Load ZigBee cluster data and populate dropdown
	OSApp.Analog.populateZigBeeKnownSensors = function(targetPopup) {
		var knownSensorsSelect = targetPopup.find("#known_zigbee_sensors");
		if (!knownSensorsSelect.length) return;
		// Only populate if not already populated (check for existing sensor options)
		if (knownSensorsSelect.find("option").filter(function() { return $(this).data("sensor"); }).length > 0) {
			try { knownSensorsSelect.selectmenu("refresh"); } catch(e) { /* widget not yet initialized */ }
			return;
		}
		OSApp.Analog.loadZigBeeClusterData().then(function(clusterData) {
			if (clusterData && clusterData.length > 0) {
				var reportOption = knownSensorsSelect.find("option[value='__report__']");
				clusterData.forEach(function(sensorDef) {
					var optionText = sensorDef.name + " (" + sensorDef.description + ")";
					var option = $("<option>").val(sensorDef.id).text(optionText).data("sensor", sensorDef);
					if (reportOption.length) {
						reportOption.before(option);
					} else {
						knownSensorsSelect.append(option);
					}
				});
				try { knownSensorsSelect.selectmenu("refresh"); } catch(e) { /* widget not yet initialized */ }
			}
		});
	};
	var lazyLoadZigBeeKnownSensors = function() {
		OSApp.Analog.populateZigBeeKnownSensors(popup);
	};
	popup.find("#known_zigbee_sensors").one("focusin click", lazyLoadZigBeeKnownSensors);
	popup.on("selectmenubeforeopen", "#known_zigbee_sensors", lazyLoadZigBeeKnownSensors);

	// Handle known sensor selection
		function reportZigBeeSensorFromPopup() {
			var deviceIeee = popup.find("#device_ieee").val();
			var endpoint = popup.find("#endpoint").val();
			var clusterId = popup.find("#cluster_id").val();
			var attributeId = popup.find("#attribute_id").val();
			var sensorName = popup.find(".name").val();
			var readInterval = popup.find(".ri").val();
			var unitId = popup.find("#unitid").val();
			var unit = popup.find("#unit").val();
			var factor = popup.find("#factor").val();
			var divider = popup.find("#divider").val();
			var offset = popup.find("#offset").val();

			var emailBody = "New ZigBee Sensor Report:\\n\\n" +
				"Sensor Name: " + (sensorName || "N/A") + "\\n" +
				"Device IEEE: " + (deviceIeee || "N/A") + "\\n" +
				"Endpoint: " + (endpoint || "N/A") + "\\n" +
				"Cluster ID: " + (clusterId || "N/A") + "\\n" +
				"Attribute ID: " + (attributeId || "N/A") + "\\n" +
				"Read Interval: " + (readInterval || "N/A") + " s\\n" +
				"Unit ID: " + (unitId || "N/A") + "\\n" +
				"Unit: " + (unit || "N/A") + "\\n" +
				"Factor: " + (factor || "N/A") + "\\n" +
				"Divider: " + (divider || "N/A") + "\\n" +
				"Offset: " + (offset || "N/A") + "\\n\\n" +
				"Please add this sensor to the database.";

			var subject = "New ZigBee Sensor: " + (sensorName || "Unknown");
			var mailtoLink = "mailto:info@opensprinklershop.de?subject=" +
				encodeURIComponent(subject) +
				"&body=" + encodeURIComponent(emailBody);

			window.location.href = mailtoLink;
		}

		popup.find("#known_zigbee_sensors").on("change", function() {
			var selectedOption = $(this).find("option:selected");
			if (selectedOption.val() === "__report__") {
				reportZigBeeSensorFromPopup();
				$(this).val("");
				try { $(this).selectmenu("refresh"); } catch(e) { /* widget not yet initialized */ }
				return;
			}
			var sensorData = selectedOption.data("sensor");

			if (sensorData) {
				// Update endpoint, cluster_id, and attribute_id fields
				popup.find("#endpoint").val(sensorData.endpoint || "1");
				// Convert cluster_id and attribute_id from integer to hex string
				var clusterId = sensorData.cluster_id;
				var clusterId_num = clusterId ? (typeof clusterId === 'string' ? (clusterId.startsWith('0x') ? parseInt(clusterId, 16) : parseInt(clusterId, 10)) : clusterId) : null;
				popup.find("#cluster_id").val(clusterId_num !== null && !isNaN(clusterId_num) ? "0x" + clusterId_num.toString(16).toUpperCase().padStart(4, '0') : "0x0000");

				var attributeId = sensorData.attribute_id;
				var attributeId_num = attributeId ? (typeof attributeId === 'string' ? (attributeId.startsWith('0x') ? parseInt(attributeId, 16) : parseInt(attributeId, 10)) : attributeId) : null;
				popup.find("#attribute_id").val(attributeId_num !== null && !isNaN(attributeId_num) ? "0x" + attributeId_num.toString(16).toUpperCase().padStart(4, '0') : "0x0000");

				// Set unit ID if provided
				if (sensorData.unitid) {
					popup.find("#unitid").val(sensorData.unitid);
					// Trigger change to show/hide unit field
					popup.find("#unitid").change();
				}

				// Set custom unit if provided
				if (sensorData.unit) {
					popup.find("#unit").val(sensorData.unit);
				}

				// Set factor if provided
				if (sensorData.factor) {
					popup.find("#factor").val(sensorData.factor);
				}

				// Set divider if provided
				if (sensorData.divider) {
					popup.find("#divider").val(sensorData.divider);
				}

				// Set offset if provided
				if (sensorData.offset) {
					popup.find("#offset").val(sensorData.offset);
				}

				// Update sensor name if empty
				var currentName = popup.find(".name").val();
				if (!currentName || currentName.trim() === "") {
					popup.find(".name").val(sensorData.name);
				}
			}
		});



		//Bluetooth: Scan for devices
		popup.find("#bluetoothsel").on("click", function (e) {
			e.preventDefault();
			var btn = $(this);
			var originalText = btn.text();
			btn.text(OSApp.Language._("Scanning...") + " 10s (0)").prop("disabled", true);

			// Show scan area
			popup.find("#bluetoothScanArea").show();
			// Countdown is already shown in the scan button; hide the extra timer line
			popup.find("#bluetoothScanTimer").hide().text("");
			popup.find(".bluetooth_scan_select_container").show();

			var scanStartTime = Date.now();
			var scanDuration = 10;
			var lastFoundDevice = null;
			var scanInterval = null;
			var uiInterval = null;
			var scanTimeout = null;
			var requestInFlight = false;
			var didCleanup = false;
			var lastDeviceCount = 0;

			function updateScanUi() {
				var elapsed = Math.floor((Date.now() - scanStartTime) / 1000);
				var remaining = Math.max(0, scanDuration - elapsed);
				btn.text(OSApp.Language._("Scanning...") + " " + remaining + "s (" + lastDeviceCount + ")");
			}

			// Start countdown UI immediately (even if /bs is slow)
			updateScanUi();
			uiInterval = setInterval(updateScanUi, 250);

			function normalizeBluetoothDevices(data) {
				if (Array.isArray(data)) {
					return data;
				}
				if (data && Array.isArray(data.devices)) {
					return data.devices;
				}
				if (data && data.devices && typeof data.devices === "object") {
					return Object.values(data.devices);
				}
				return [];
			}

			function normalizeBluetoothCount(data, devices) {
				if (data && typeof data.count === "number") {
					return data.count;
				}
				if (data && typeof data.count === "string") {
					var parsed = parseInt(data.count, 10);
					if (!isNaN(parsed)) {
						return parsed;
					}
				}
				return (devices || []).length;
			}

			// Start Bluetooth scan
			OSApp.Firmware.sendToOS("/bs?pw=&duration=10", "json").then(function () {

				// Prepare UI elements
				var deviceSelect = popup.find("#bluetoothDeviceSelect");
				deviceSelect.empty();
				popup.data("bluetoothDevices", []);

				// Ensure select has at least a placeholder
				deviceSelect.append($("<option>").val("").text(OSApp.Language._("No devices found yet. Please activate your device.")));
				try {
					deviceSelect.selectmenu("refresh", true);
				} catch (e) {
					// ignore
				}

				function updateDeviceList() {
					if (requestInFlight) {
						return;
					}
					// Timer UI is handled by updateScanUi() so it keeps updating even if /bd is slow.

					requestInFlight = true;
					OSApp.Firmware.sendToOS("/bd?pw=", "json").then(function (data) {
						requestInFlight = false;
						var devices = normalizeBluetoothDevices(data);
						popup.data("bluetoothDevices", devices);
						lastDeviceCount = normalizeBluetoothCount(data, devices);

							if (devices && devices.length > 0) {
								var deviceSelect = popup.find("#bluetoothDeviceSelect");
								deviceSelect.empty();
								deviceSelect.append($("<option>").val("").text(OSApp.Language._("Select a device...")));
								popup.data("bluetoothDevices", devices);

								for (var i = 0; i < devices.length; i++) {
									var device = devices[i] || {};
									var macAddr = device.address || device.mac_addr || device.mac || "00:00:00:00:00:00";
									var name = device.name || OSApp.Language._("Unknown Device");
									var rssi = (device.rssi === undefined || device.rssi === null) ? "N/A" : device.rssi;
									var serviceUuid = device.service_uuid || "";
									var serviceName = device.service_name || "";

									var label = name + " | " + macAddr + " | RSSI: " + rssi;
									if (serviceUuid) {
										label += " | " + (serviceName || OSApp.Language._("Unknown")) + " (" + serviceUuid + ")";
									}

									deviceSelect.append($("<option>").val(String(i)).text(label));
								}

								try {
									deviceSelect.selectmenu("refresh", true);
								} catch (e) {
									// ignore
								}
							} else {
								var deviceSelectEmpty = popup.find("#bluetoothDeviceSelect");
								deviceSelectEmpty.empty().append($("<option>").val("").text(OSApp.Language._("No devices found yet. Please activate your device.")));
								try {
									deviceSelectEmpty.selectmenu("refresh", true);
								} catch (e) {
									// ignore
								}
							}
					}, function () {
						requestInFlight = false;
							var deviceSelectErr = popup.find("#bluetoothDeviceSelect");
							deviceSelectErr.empty().append($("<option>").val("").text(OSApp.Language._("No devices found yet. Please activate your device.")));
							try {
								deviceSelectErr.selectmenu("refresh", true);
							} catch (e) {
								// ignore
							}
					});
				}

				// Immediately apply selected device to fields on combobox change
				popup.find("#bluetoothDeviceSelect").off("change").on("change", function () {
					var idxStr = popup.find("#bluetoothDeviceSelect").val();
					var idx = parseInt(idxStr, 10);
					if (idxStr === "" || isNaN(idx)) {
						return;
					}
					var currentDevices = popup.data("bluetoothDevices") || [];
					if (!currentDevices || idx < 0 || idx >= currentDevices.length) {
						return;
					}
					var dev = currentDevices[idx] || null;
					if (!dev) {
						return;
					}

					var selectedCharUuid = dev.char_uuid || dev.characteristic_uuid || dev.charUuid || dev.characteristicUuid || dev.charUUID || dev.characteristicUUID || dev.service_uuid || dev.serviceUuid || "";
					if (Array.isArray(selectedCharUuid)) {
						selectedCharUuid = selectedCharUuid[0] || "";
					}
					selectedCharUuid = String(selectedCharUuid || "");

					// Stop scanning timers but keep the device list visible
					if (scanInterval) {
						clearInterval(scanInterval);
						scanInterval = null;
					}
					if (uiInterval) {
						clearInterval(uiInterval);
						uiInterval = null;
					}
					if (scanTimeout) {
						clearTimeout(scanTimeout);
						scanTimeout = null;
					}

					// Apply values
					var charField = popup.find("#char_uuid");
					if (charField.length && selectedCharUuid) {
						charField.val(selectedCharUuid).trigger("change");
						try {
							charField.textinput("refresh");
						} catch (e) {
							// ignore
						}
					}

					// Apply MAC address to MAC field
					var mac = dev.address || dev.mac_addr || dev.mac || "";
					if (mac) {
						var macField = popup.find(".mac");
						if (macField.length) {
							macField.val(mac).trigger("change");
						}
					}

					var deviceName = dev.name || OSApp.Language._("Unknown Device");
					var currentName = popup.find(".name").val();
					if (!currentName || currentName.trim() === "") {
						var nameField = popup.find(".name");
						nameField.val(deviceName).trigger("change");
						try {
							nameField.textinput("refresh");
						} catch (e) {
							// ignore
						}
					}

					// Clear flags on backend after selection (ignore failures)
					OSApp.Firmware.sendToOS("/bc?pw=", "json").always(function () {
						popup.find("#bluetoothScanArea").hide();
						btn.text(originalText).prop("disabled", false);
					});
				});

				// Update device list immediately
				updateDeviceList();

				// Countdown UI already running via uiInterval

				// Update device list every second
				scanInterval = setInterval(updateDeviceList, 1000);

				// Stop scanning after 10 seconds, keep results visible
				scanTimeout = setTimeout(function() {
					// Stop scanning, but keep discovered devices visible for selection
					if (scanInterval) {
						clearInterval(scanInterval);
						scanInterval = null;
					}
					if (uiInterval) {
						clearInterval(uiInterval);
						uiInterval = null;
					}
					popup.find("#bluetoothScanTimer").text(OSApp.Language._("Scan finished"));
					// Collapse scan area, keep select visible
					popup.find("#bluetoothScanArea").hide();
					// Best-effort: clear scan flags on backend (do not touch UI list)
					try {
						OSApp.Firmware.sendToOS("/bc?pw=", "json");
					} catch (e) {
						// ignore
					}
					btn.text(originalText).prop("disabled", false);
					scanTimeout = null;
				}, 10000);

			}, function () {
				// Error handler
				if (uiInterval) {
					clearInterval(uiInterval);
					uiInterval = null;
				}
				btn.text(originalText).prop("disabled", false);
				popup.find("#bluetoothScanArea").hide();
				popup.find(".bluetooth_scan_select_container").hide();
				OSApp.Errors.showError(OSApp.Language._("Failed to start Bluetooth scanning. Please ensure Bluetooth is supported."));
			});

			return false;
		});

	//FYTA: Select Sensor
	popup.find("#fytasel").on("click", function () {

		return OSApp.Firmware.sendToOS("/fy?pw=", "json").then(function (result) {
				var token = result.token;
				var sel = "<ul class='fyta-plants' data-role='listview'>";
				for (let i = 0; i < result.plants.length; i++) {
					let plant = result.plants[i];
					sel += "<li value='" + i + "'><a href='#'>" +
						"<img id='thumb"+i+"' src='#' class='ui-li-thumb'>" +
						"<h2>" + plant.nickname + "</h2>" +
						"<p>" + plant.scientific_name + "</p>" +
						"</a></li>";
					var request = new XMLHttpRequest();
					request.open('GET', plant.thumb, true);
					request.setRequestHeader('Authorization', 'Bearer ' + token);
					request.responseType = 'arraybuffer';
					request.onload = function() {
					    var data = new Uint8Array(this.response);
					    var raw = String.fromCharCode.apply(null, data);
					    var base64 = btoa(raw);
					    var src = "data:image;base64," + base64;
					    $("#thumb"+i).attr("src", src);
					};
					request.send();
				}
				sel += "</ul>";
				popup.find("#fytasel").html(sel).enhanceWithin();
				$("ul.fyta-plants li").click(function() {
					let plant = result.plants[this.value];
					popup.find(".id").val(plant.id);
					var type = parseInt(popup.find("#type").val());
					var str = plant.nickname;
					switch(type) {
					case OSApp.Analog.Constants.SENSOR_FYTA_MOISTURE:
						str += " " + OSApp.Language._("Soil Moisture");
						break;
					case OSApp.Analog.Constants.SENSOR_FYTA_TEMPERATURE:
						str += " " + OSApp.Language._("Temperature");
						break;
					}
					popup.find(".name").val( str );
					popup.find(".name").focus();
				});
			});
		});





		//download log:
		popup.find("#download-log").on("click", function () {
			var link = document.createElement("a");
			link.style.display = "none";
			link.setAttribute("download", "sensorlog-" + sensor.name + "-" + new Date().toLocaleDateString().replace(/\//g, "-") + ".csv");

			var limit = OSApp.currentSession.token ? "&max=5500" : ""; //download limit is 140kb, 5500 lines ca 137kb
			var dest = "/so?pw=&csv=1&nr="+ sensor.nr + limit;
			dest = dest.replace("pw=", "pw=" + OSApp.Analog.enc(OSApp.currentSession.pass));
			link.target = "_blank";
			link.href = OSApp.currentSession.token ? ("https://cloud.openthings.io/forward/v1/" + OSApp.currentSession.token + dest) : (OSApp.currentSession.prefix + OSApp.currentSession.ip + dest);
			document.body.appendChild(link); // Required for FF
			link.click();
			return false;
		});

		//delete sensor log:
		popup.find("#delete-sen-log").on("click", function () {
			var dur = $(this),
			value = dur.attr("value");

			OSApp.Analog.saveSensor(popup, sensor, callback);
			OSApp.UIDom.areYouSure(OSApp.Language._("Are you sure you want to delete the log?"), value, function () {
				return OSApp.Firmware.sendToOS("/sn?pw=&nr=" + value, "json").done(function (info) {
					var result = info.deleted;
					if (!result)
						OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + result);
					else
						OSApp.Errors.showError(OSApp.Language._("Deleted log values: ") + result);
				});
			});
			return false;
		});

		//Show Analog Sensor Log:
		popup.find(".show-sensor-log").on("click", function () {
			var sensorNr = $(this).attr("value");
			popup.popup("close");
			OSApp.Analog.showAnalogSensorCharts(sensorNr);
			return false;
		});

		//Copy a sensor:
		popup.find(".copy-sensor").on("click", function () {
			OSApp.Analog.saveSensor(popup, sensor, function (sensorOut) {
				var maxNr = 0;
				for (var i = 0; i < OSApp.Analog.analogSensors.length; i++) {
					if (OSApp.Analog.analogSensors[i].nr > maxNr) {
						maxNr = OSApp.Analog.analogSensors[i].nr;
					}
				}

				var newSensor = $.extend(true, {}, sensorOut);
				newSensor.nr = maxNr + 1;
				var baseName = newSensor.name && newSensor.name.trim() !== "" ? newSensor.name : OSApp.Language._("Sensor");
				newSensor.name = baseName + " (" + OSApp.Language._("copy") + ")";
				delete newSensor.last;
				delete newSensor.data;
				delete newSensor.nativedata;

				OSApp.Analog.showSensorEditor(newSensor, -1, function (sensorOutNew) {
					return OSApp.Analog.sendToOsObj("/sc?pw=", sensorOutNew).done(function (info) {
						var result = info.result;
						if (!result || result > 1)
							OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
						OSApp.Analog.updateAnalogSensor(callbackCancel);
					});
				}, callbackCancel);
			});
			return false;
		});

		//Delete a sensor:
		popup.find(".delete-sensor").on("click", function () {

			var dur = $(this),
				value = dur.attr("value"),
				row = dur.attr("row");

			popup.popup("close");

			OSApp.UIDom.areYouSure(OSApp.Language._("Are you sure you want to delete the sensor?"), value, function () {
				return OSApp.Firmware.sendToOS("/sc?pw=&nr=" + value + "&type=0", "json").done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
					else
					OSApp.Analog.analogSensors.splice(row, 1);
					OSApp.Analog.updateAnalogSensor(callbackCancel);
				});
			});
		});

		popup.find("#unitid").val(sensor.unitid ? sensor.unitid : 0).change();

		popup.find(".submit").on("click", function () {
			OSApp.Analog.saveSensor(popup, sensor, callback);
		});

		popup.on("focus", "input[type='number']", function () {
			this.select();
		}).on("blur", "input[type='number']", function () {

			var min = parseFloat(this.min),
				max = parseFloat(this.max);

			if (this.value === "") {
				this.value = "0";
			}
			if (this.value < min || this.value > max) {
				this.value = this.value < min ? min : max;
			}
		});

		OSApp.UIDom.holdButton(popup.find(".incr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, 1);
			return false;
		});

		OSApp.UIDom.holdButton(popup.find(".decr").children(), function (e) {
			var pos = $(e.currentTarget).index();
			changeValue(pos, -1);
			return false;
		});

		$("#sensorEditor").remove();

	popup.css("max-width", "576px");

		// Initial visibility update based on sensor type
		OSApp.Analog.updateSensorVisibility(popup, sensor.type);

		// Enhance jQuery Mobile elements before opening
		popup.enhanceWithin();

		// Re-populate ZigBee known sensors after enhanceWithin if data already loaded
		if (sensor.type == OSApp.Analog.Constants.SENSOR_ZIGBEE && OSApp.Analog.zigbeeClusterData && OSApp.Analog.zigbeeClusterData.length > 0) {
			OSApp.Analog.populateZigBeeKnownSensors(popup);
		}

		OSApp.UIDom.openPopup(popup, { positionTo: "origin" });
	});
};


// Config Page
OSApp.Analog.showAnalogSensorConfig = function() {

	var page = $("<div data-role='page' id='analogsensorconfig'>" +
		"<div class='ui-content' role='main' id='analogsensorlist'>" +
		"</div></div>");

	page
		.on("sensorrefresh", updateSensorContent)
		.on("pagehide", function () {
			page.detach();
		});

	function updateSensorContent() {
		OSApp.Analog.syncChartOptionsFromController();
		var list = $(OSApp.Analog.buildSensorConfig());

		// Apply saved section order
		OSApp.Analog.applySectionOrder(list);

		//Edit a sensor:
		list.find(".edit-sensor").on("click", function () {
			var dur = $(this),
				nr = parseInt(dur.attr("value"), 10);

			// Find sensor by nr instead of row index (row index becomes incorrect after sorting)
			var row = -1;
			var sensor = null;
			for (var i = 0; i < OSApp.Analog.analogSensors.length; i++) {
				if (OSApp.Analog.analogSensors[i].nr === nr) {
					row = i;
					sensor = OSApp.Analog.analogSensors[i];
					break;
				}
			}
			if (!sensor) return;

			OSApp.Analog.expandItem.add("sensors");
			OSApp.Analog.showSensorEditor(sensor, row, function (sensorOut) {
				sensorOut.nativedata = sensor.nativedata;
				sensorOut.data = sensor.data;
				sensorOut.last = sensor.last;
				return OSApp.Analog.sendToOsObj("/sc?pw=", sensorOut).done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
					else
						OSApp.Analog.analogSensors[row] = sensorOut;
					updateSensorContent();
				});
			}, updateSensorContent);
		});

		// Add a new analog sensor:
		list.find(".add-sensor").on("click", function () {
			// Find highest sensor number and add 1
			var maxNr = 0;
			for (var i = 0; i < OSApp.Analog.analogSensors.length; i++) {
				if (OSApp.Analog.analogSensors[i].nr > maxNr) {
					maxNr = OSApp.Analog.analogSensors[i].nr;
				}
			}
			var sensor = {
				nr: maxNr + 1,
				name: OSApp.Language._("new sensor"),
				type: 1,
				ri: 600,
				enable: 1,
				log: 1
			};

			OSApp.Analog.showSensorEditor(sensor, -1, function (sensorOut) {
				return OSApp.Analog.sendToOsObj("/sc?pw=", sensorOut).done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
					OSApp.Analog.updateAnalogSensor(function () {
						updateSensorContent();
					});
				});
			}, updateSensorContent);
		});

		// Refresh sensor data:
		list.find(".refresh-sensor").on("click", function () {
			OSApp.Analog.expandItem.add("sensors");
			OSApp.Analog.updateProgramAdjustments(function () {
				OSApp.Analog.updateMonitors(function () {
					OSApp.Analog.updateAnalogSensor(function () {
						updateSensorContent();
					});
				});
			});
		});

		//Edit a program adjust:
		list.find(".edit-progadjust").on("click", function () {
			var dur = $(this),
				nr = parseInt(dur.attr("value"), 10);

			// Find progAdjust by nr instead of row index (row index becomes incorrect after sorting)
			var row = -1;
			var progAdjust = null;
			for (var i = 0; i < OSApp.Analog.progAdjusts.length; i++) {
				if (OSApp.Analog.progAdjusts[i].nr === nr) {
					row = i;
					progAdjust = OSApp.Analog.progAdjusts[i];
					break;
				}
			}
			if (!progAdjust) return;

			OSApp.Analog.expandItem.add("progadjust");
			OSApp.Analog.showAdjustmentsEditor(progAdjust, row, function (progAdjustOut) {

				return OSApp.Analog.sendToOsObj("/sb?pw=", progAdjustOut).done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
					else
						OSApp.Analog.progAdjusts[row] = progAdjustOut;
					OSApp.Analog.updateProgramAdjustments(updateSensorContent);
				});
			}, updateSensorContent);
		});

		//Add a new program adjust:
		list.find(".add-progadjust").on("click", function () {
			// Find highest program adjustment number and add 1
			var maxNr = 0;
			for (var i = 0; i < OSApp.Analog.progAdjusts.length; i++) {
				if (OSApp.Analog.progAdjusts[i].nr > maxNr) {
					maxNr = OSApp.Analog.progAdjusts[i].nr;
				}
			}
			var progAdjust = {
				nr: maxNr + 1,
				type: 1
			};

			OSApp.Analog.expandItem.add("progadjust");
			OSApp.Analog.showAdjustmentsEditor(progAdjust, -1, function (progAdjustOut) {
				return OSApp.Analog.sendToOsObj("/sb?pw=", progAdjustOut).done(function (info) {
					var result = info.result;
					if (!result || result > 1)
						OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
					else
						OSApp.Analog.progAdjusts.push(progAdjustOut);
						OSApp.Analog.updateProgramAdjustments(updateSensorContent);
				});
			}, updateSensorContent);
		});

		if (OSApp.Firmware.checkOSVersion(233) && OSApp.Analog.monitors)
		{
			//Edit a monitor:
			list.find(".edit-monitor").on("click", function () {
				var dur = $(this),
					nr = parseInt(dur.attr("value"), 10);

				// Find monitor by nr instead of row index (row index becomes incorrect after sorting)
				var row = -1;
				var monitor = null;
				for (var i = 0; i < OSApp.Analog.monitors.length; i++) {
					if (OSApp.Analog.monitors[i].nr === nr) {
						row = i;
						monitor = OSApp.Analog.monitors[i];
						break;
					}
				}
				if (!monitor) return;

				OSApp.Analog.expandItem.add("monitors");
				OSApp.Analog.showMonitorEditor(monitor, row, function (monitorOut) {

					return OSApp.Analog.sendToOsObj("/mc?pw=", monitorOut).done(function (info) {
						var result = info.result;
						if (!result || result > 1)
							OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
						else
							OSApp.Analog.monitors[row] = monitorOut;
							OSApp.Analog.updateProgramAdjustments(updateSensorContent);
					});
				}, updateSensorContent);
			});

			//Add a monitor:
			list.find(".add-monitor").on("click", function () {
				// Find highest monitor number and add 1
				var maxNr = 0;
				for (var i = 0; i < OSApp.Analog.monitors.length; i++) {
					if (OSApp.Analog.monitors[i].nr > maxNr) {
						maxNr = OSApp.Analog.monitors[i].nr;
					}
				}
				var monitor = {
					nr: maxNr + 1,
					type: 1,
				};
				if (OSApp.Firmware.checkOSVersion(233) && OSApp.currentSession.controller.options.fwm >= 178) {
					monitor.rs = 0;
				}


				OSApp.Analog.expandItem.add("monitors");
				OSApp.Analog.showMonitorEditor(monitor, -1, function (monitorOut) {
					return OSApp.Analog.sendToOsObj("/mc?pw=", monitorOut).done(function (info) {
						var result = info.result;
						if (!result || result > 1)
							OSApp.Errors.showError(OSApp.Language._("Error calling rest service: ") + " " + result);
						else
							OSApp.Analog.monitors.push(monitorOut);
						OSApp.Analog.updateMonitors(updateSensorContent);
					});
				}, updateSensorContent);
			});
		}
		// Clear sensor log
		list.find(".clear_sensor_logs").on("click", function () {
			OSApp.Analog.expandItem.add("sensorlog");
			OSApp.UIDom.areYouSure(OSApp.Language._("Are you sure you want to clear the sensor log?"), "", function () {
				return OSApp.Firmware.sendToOS("/sn?pw=&", "json").done(function (result) {
					window.alert(OSApp.Language._("Log cleared:") + " " + result.deleted + " " + OSApp.Language._("records"));
					updateSensorContent();
				});
			});
		});

		list.find(".download-log").on("click", function () {
			OSApp.Analog.expandItem.add("sensorlog");
			var link = document.createElement("a");
			link.style.display = "none";
			link.setAttribute("download", "sensorlog-" + new Date().toLocaleDateString().replace(/\//g, "-") + ".csv");

			var limit = OSApp.currentSession.token ? "&max=5500" : ""; //download limit is 140kb, 5500 lines ca 137kb
			var dest = "/so?pw=&csv=1" + limit;
			dest = dest.replace("pw=", "pw=" + OSApp.Analog.enc(OSApp.currentSession.pass));
			link.target = "_blank";
			link.href = OSApp.currentSession.token ? ("https://cloud.openthings.io/forward/v1/" + OSApp.currentSession.token + dest) : (OSApp.currentSession.prefix + OSApp.currentSession.ip + dest);
			document.body.appendChild(link); // Required for FF
			link.click();
			return false;
		});

		list.find(".show-log").on("click", function () {
			OSApp.Analog.expandItem.add("sensorlog");
			OSApp.UIDom.changePage("#analogsensorchart");
			return false;
		});

		// Chart option: Temperature conversion
		list.find("input[name='chart-temp-convert']").on("change", function () {
			OSApp.Analog.chartConvertTemp = parseInt($(this).val(), 10);
			OSApp.Analog.saveChartOptions();
		});

		// Chart option: Combine soil moisture and temperature
		list.find(".chart-combine-moist-temp").on("change", function () {
			OSApp.Analog.chartCombineMoistTemp = $(this).is(":checked");
			OSApp.Analog.saveChartOptions();
		});

		// Chart options from Chart Options section
		list.find("#tempconvert").on("change", function () {
			OSApp.Analog.chartConvertTemp = parseInt($(this).val(), 10);
			OSApp.Analog.saveChartOptions();
		});

		list.find("#combinemoisttemp").on("change", function () {
			OSApp.Analog.chartCombineMoistTemp = $(this).is(":checked");
			OSApp.Analog.saveChartOptions();
		});

		list.find(".fytasetup").on("click", function () {
			OSApp.Analog.expandItem.add("fytasetup");
			OSApp.Analog.setupFytaCredentials();
			return false;
		});

		list.find(".backup-all").on("click", function () {
			OSApp.Analog.expandItem.add("backup");
			OSApp.Analog.getExportMethodSensors(1+2+4);
			return false;
		});

		list.find(".restore-all").on("click", function () {
			OSApp.Analog.expandItem.add("backup");
			OSApp.Analog.getImportMethodSensors(1+2+4, updateSensorContent);
			return false;
		});

		list.find(".backup-sensors").on("click", function () {
			OSApp.Analog.expandItem.add("backup");
			OSApp.Analog.getExportMethodSensors(1);
			return false;
		});

		list.find(".restore-sensors").on("click", function () {
			OSApp.Analog.expandItem.add("backup");
			OSApp.Analog.getImportMethodSensors(1, updateSensorContent);
			return false;
		});

		list.find(".backup-adjustments").on("click", function () {
			OSApp.Analog.expandItem.add("backup");
			OSApp.Analog.getExportMethodSensors(2);
			return false;
		});

		list.find(".restore-adjustments").on("click", function () {
			OSApp.Analog.expandItem.add("backup");
			OSApp.Analog.getImportMethodSensors(2, updateSensorContent);
			return false;
		});

		list.find(".backup-monitors").on("click", function () {
			OSApp.Analog.expandItem.add("backup");
			OSApp.Analog.getExportMethodSensors(4);
			return false;
		});

		list.find(".restore-monitors").on("click", function () {
			OSApp.Analog.expandItem.add("backup");
			OSApp.Analog.getImportMethodSensors(4, OSApp.Analog.updateMonitors);
			return false;
		});

		page.find("#analogsensorlist").html(list).enhanceWithin();

		// Sort button handlers - bind after DOM elements are ready
		page.find(".sort-section-toggle").on("click", function(e) {
			e.preventDefault();
			e.stopPropagation();
			var container = page.find("#analogsensorlist");
			OSApp.Analog.toggleSortMode(container);
			return false;
		});
	}

	OSApp.UIDom.changeHeader({
		title: OSApp.Language._("Analog Sensor Config"),
		leftBtn: {
			icon: "carat-l",
			text: OSApp.Language._("Back"),
			class: "ui-toolbar-back-btn",
			on: function() { OSApp.UIDom.goBack(); }
		},
		rightBtn: {
			icon: "refresh",
			text: screen.width >= 500 ? OSApp.Language._("Refresh") : "",
			on: function() { updateSensorContent(); }
		}
	});

	$("#analogsensorconfig").remove();

	$.mobile.pageContainer.append(page);

	// Load sensor data before displaying content
	var loadData = function() {
		var pa = $.Deferred(), mo = $.Deferred(), se = $.Deferred();

		OSApp.Analog.updateProgramAdjustments(function() { pa.resolve(); })
			.fail(function() { pa.resolve(); });

		pa.done(function() {
			OSApp.Analog.updateMonitors(function() { mo.resolve(); })
				.fail(function() { mo.resolve(); });
		});

		mo.done(function() {
			OSApp.Analog.updateAnalogSensor(function() { se.resolve(); })
				.fail(function() { se.resolve(); });
		});

		se.done(function() {
			updateSensorContent();
		});
	};

	loadData();
};

OSApp.Analog.checkFirmwareUpdate = function() {
	if (OSApp.Firmware.checkOSVersion(OSApp.Analog.Constants.CURRENT_FW_ID) && OSApp.currentSession.controller.options.fwm >= OSApp.Analog.Constants.CURRENT_FW_MIN)
		return "";
	return OSApp.Language._("Please update firmware to ") + OSApp.Analog.Constants.CURRENT_FW;
};

OSApp.Analog.setupFytaCredentials = function() {

	OSApp.Firmware.sendToOS("/fc?pw=", "json").then(function (data) {
		$(".ui-popup-active").find("[data-role='popup']").popup("close");

		var fytacred = data.fyta;
		var list =
			"<div data-role='popup' data-theme='a' id='fytacred'>" +
			"<div data-role='header' data-theme='b'>" +
			"<a href='#' data-rel='back' data-role='button' data-theme='a' data-icon='delete' data-iconpos='notext' class='ui-btn-right'>"+OSApp.Language._("close")+"</a>"+
			"<h1>" + OSApp.Language._("Setup FYTA credentials") + "</h1>" +
			"</div>" +

			"<div class='ui-content'>" +
			"<form>" +
			"<label>" + OSApp.Language._("API Token - get your Token from ") +
			"<a target='_blank' rel='noopener noreferrer' href='https://web.fyta.de/api-token'>The FYTA Site</a></label>" +
			"<input class='fytatoken' type='text' value='" + (fytacred.token?fytacred.token:"") + "'>" +

			"<hr>" +
			"<label>" + OSApp.Language._("Alternatively, you can enter your user login details") + "</label>" +
			"<label>" + OSApp.Language._("Leave empty if you have a token!") + "</label>" +

			"<label>" + OSApp.Language._("E-Mail") + "</label>" +
			"<input class='email' type='text' value='" + (fytacred.email?fytacred.email:"") + "'>" +

			"<label>" + OSApp.Language._("Password") + "</label>" +
			"<input class='password' type='password' value='" + (fytacred.password?fytacred.password:"") + "'>" +
			"</div>" +
            "<button class='submit' data-theme='b'>" + OSApp.Language._("Submit") + "</button>" +

            "</form" +
            "</div>";

                let popup = $(list);

		popup.find(".submit").on("click", function () {
			var newData = {}, t, e, p;
			newData.fyta = {};
			t = popup.find(".fytatoken").val();
			e = popup.find(".email").val();
			p = popup.find(".password").val();
			if (t.length > 0) newData.fyta.token = t;
			if (e.length > 0) newData.fyta.email = e;
			if (p.length > 0) newData.fyta.password = p;
			OSApp.Analog.sendToOsObj("/co?pw=", newData);
			popup.popup("close");
			return false;
		});

		$("#fytacred").remove();

		popup.css("max-width", "580px");

		OSApp.UIDom.openPopup(popup, { positionTo: "origin" });
		popup.find(".fytatoken").focus();

	}, function() {
		var resetFyta = {};
		resetFyta.fyta = {};
		resetFyta.fyta.email = "";
		resetFyta.fyta.password = "";
		OSApp.Analog.sendToOsObj("/co?pw=", resetFyta);
	});
};

// Section sorting functionality
OSApp.Analog.getSectionOrder = function() {
	var stored = localStorage.getItem("OSApp.Analog.sectionOrder");
	if (stored) {
		try {
			return JSON.parse(stored);
		} catch (e) {
			return ["sensors", "progadjust", "monitors"];
		}
	}
	return ["sensors", "progadjust", "monitors"];
};

OSApp.Analog.setSectionOrder = function(order) {
	localStorage.setItem("OSApp.Analog.sectionOrder", JSON.stringify(order));
};

// Persist per-section row order (by item number)
OSApp.Analog.getRowOrder = function(sectionId) {
	var stored = localStorage.getItem("OSApp.Analog.rowOrder." + sectionId);
	if (stored) {
		try {
			return JSON.parse(stored);
		} catch (e) {
			return [];
		}
	}
	return [];
};

OSApp.Analog.setRowOrder = function(sectionId, order) {
	localStorage.setItem("OSApp.Analog.rowOrder." + sectionId, JSON.stringify(order));
};

// Reorder in-memory data arrays according to saved order
OSApp.Analog.applyRowOrderToData = function(sectionId) {
	var order = OSApp.Analog.getRowOrder(sectionId);
	if (!order || !order.length) return;

	var target;
	switch (sectionId) {
		case "sensors":
			target = OSApp.Analog.analogSensors;
			break;
		case "progadjust":
			target = OSApp.Analog.progAdjusts;
			break;
		case "monitors":
			target = OSApp.Analog.monitors;
			break;
		default:
			return;
	}

	if (!Array.isArray(target)) return;

	// Build a lookup for quick positioning
	var pos = new Map();
	for (var i = 0; i < order.length; i++) pos.set(order[i], i);

	target.sort(function(a, b) {
		var pa = pos.has(a.nr) ? pos.get(a.nr) : Number.POSITIVE_INFINITY;
		var pb = pos.has(b.nr) ? pos.get(b.nr) : Number.POSITIVE_INFINITY;
		if (pa === pb) return (a.nr || 0) - (b.nr || 0);
		return pa - pb;
	});
};

OSApp.Analog.applySectionOrder = function(container) {
	var order = OSApp.Analog.getSectionOrder();
	var fieldsets = container.find("fieldset[data-section-id]");

	if (fieldsets.length >= 2) {
		var fieldsetMap = {};
		fieldsets.each(function() {
			var id = $(this).attr("data-section-id");
			fieldsetMap[id] = $(this).detach();
		});

		// Reorder fieldsets based on saved order
		for (var i = 0; i < order.length; i++) {
			if (fieldsetMap[order[i]]) {
				container.append(fieldsetMap[order[i]]);
			}
		}
	}
};

OSApp.Analog.toggleSortMode = function(container) {
	var sections = container.find("fieldset[data-section-id]");

	sections.each(function() {
		var section = $(this);
		var table = section.find("table").first();
		var rows = table.find("tbody tr, tr").not(":has(th)"); // Get all data rows (not header rows)
		var sortButton = section.find(".sort-section-toggle");
		var sectionId = section.attr("data-section-id");

		// Helper: capture positions for FLIP animation
		var capturePositions = function(rowSet) {
			var pos = {};
			rowSet.each(function() {
				var key = $(this).attr("data-sort-key");
				if (!key) return;
				pos[key] = this.getBoundingClientRect().top;
			});
			return pos;
		};

		var animateFlip = function(rowSet, oldPos) {
			rowSet.each(function() {
				var key = $(this).attr("data-sort-key");
				if (!key || oldPos[key] === undefined) return;
				var newTop = this.getBoundingClientRect().top;
				var delta = oldPos[key] - newTop;
				if (!delta) return;
				var row = $(this);
				row.css("transform", "translateY(" + delta + "px)");
				requestAnimationFrame(function() {
					row.css("transition", "transform 150ms ease, background-color 120ms ease");
					row.css("transform", "");
				});
			});
		};

		if (rows.length === 0) return; // Skip if no rows

		var isSortMode = section.data("sort-mode") === true;

		if (!isSortMode) {
			section.data("sort-mode", true);
			// Enter sort mode - add handles to each row
			// Remove any stale handles to avoid duplicates
			rows.find(".sort-handle").remove();
			rows.each(function() {
				var row = $(this);
				var firstCell = row.find("td, th").first();
				var keyText = firstCell.text();
				row.attr("data-sort-key", keyText);
				row.css({"transition": "transform 150ms ease, background-color 120ms ease", "will-change": "transform"});

				// Create handle element - use HTML entity for better compatibility
				var handle = $("<span class='sort-handle' style='cursor: grab; padding: 5px 8px; margin-right: 5px; display: inline-block; font-size: 18px; user-select: none;' draggable='true' title='Drag to reorder'>&#9776;</span>");

				// Add handle to first cell
				firstCell.prepend(handle);
				row.css("opacity", "1");
			});

			// Add drag event handlers to rows
			rows.on("dragstart", function(e) {
				// Only allow drag if started from handle
				if (!$(e.target).hasClass("sort-handle")) {
					e.preventDefault();
					return false;
				}

				var row = $(this);
				row.addClass("dragging");
				row.css("opacity", "0.3");

				// Create a visual drag image - a clone of the row
				var dragImage = row.clone();
				dragImage.css({
					"position": "absolute",
					"top": "-9999px",
					"left": "-9999px",
					"background-color": "rgba(33, 150, 243, 0.3)",
					"border": "2px solid #2196F3",
					"box-shadow": "0 4px 8px rgba(0, 0, 0, 0.2)",
					"opacity": "1"
				});
				$("body").append(dragImage);

				var handleEl = $(e.target).closest(".sort-handle")[0] || this;
				var rect = handleEl.getBoundingClientRect();
				var offsetX = e.originalEvent.clientX - rect.left;
				var offsetY = e.originalEvent.clientY - rect.top;

				e.originalEvent.dataTransfer.effectAllowed = "move";
				e.originalEvent.dataTransfer.setDragImage(dragImage[0], offsetX, offsetY);

				// Remove the temporary element after a short delay
				setTimeout(function() {
					dragImage.remove();
				}, 0);
			});

			rows.on("dragover", function(e) {
				var targetRow = $(e.target).closest("tr");
				var dragging = table.find(".dragging");
				if (!dragging.length || targetRow.hasClass("dragging")) return;
				e.preventDefault();
				e.originalEvent.dataTransfer.dropEffect = "move";

				// FLIP: capture before
				var beforePos = capturePositions(rows);

				// Reorder immediately so the user sees the new order (partial overlap triggers)
				if (targetRow.index() < dragging.index()) {
					dragging.insertBefore(targetRow);
				} else {
					dragging.insertAfter(targetRow);
				}

				// Animate to new positions
				animateFlip(rows, beforePos);

				// Highlight target row
				targetRow.stop(true, true).css({
					"background-color": "rgba(33, 150, 243, 0.25)",
					"transition": "background-color 120ms ease"
				});
			});

			rows.on("dragleave", function(e) {
				$(this).css({
					"background-color": "",
					"border-top": ""
				});
			});

			rows.on("drop", function(e) {
				e.preventDefault();
				$(this).css({
					"background-color": "",
					"border-top": ""
				});
				var dragging = table.find(".dragging");
				if (dragging.length && dragging[0] !== this) {
					dragging.insertBefore($(this));
				}
			});

			rows.on("dragend", function(e) {
				$(this).removeClass("dragging");
				$(this).css("opacity", "1");
				table.find("tr").css({
					"background-color": "",
					"border-top": ""
				});
			});

			// Change button text to "Sort completed"
			sortButton.text(OSApp.Language._("Sort completed"));
			sortButton.css("color", "#4CAF50");
		} else {
			section.data("sort-mode", false);
			// Exit sort mode - remove handles
			rows.find(".sort-handle").remove();
			rows.off("dragstart dragover dragleave drop dragend");
			rows.css("opacity", "1");
			rows.css({ "background-color": "", "border-top": "", "transform": "", "transition": "", "will-change": "" });

			// Persist new order based on first cell (Nr)
			var newOrder = [];
			rows.each(function() {
				var txt = $(this).find("td, th").first().text();
				var nr = parseInt(txt, 10);
				if (!isNaN(nr)) newOrder.push(nr);
			});
			OSApp.Analog.setRowOrder(sectionId, newOrder);
			OSApp.Analog.applyRowOrderToData(sectionId);

			// Reset button text to "Sort" and exit visual state
			sortButton.text(OSApp.Language._("Sort"));
			sortButton.css("color", "");
		}
	});
};

OSApp.Analog.buildSensorConfig = function() {

	// Apply saved row orders to data before rendering
	OSApp.Analog.applyRowOrderToData("sensors");
	OSApp.Analog.applyRowOrderToData("progadjust");
	OSApp.Analog.applyRowOrderToData("monitors");

	//detected Analog Sensor Boards:
	var detected_boards = "";
	if (Object.prototype.hasOwnProperty.call(OSApp.Analog.analogSensors, "detected")) {
		var boards = [];
		let detected = OSApp.Analog.analogSensors.detected;
		if (detected & OSApp.Analog.Constants.ASB_BOARD1) boards.push("ASB 1");
		if (detected & OSApp.Analog.Constants.ASB_BOARD2) boards.push("ASB 2");
		if (detected & OSApp.Analog.Constants.OSPI_PCF8591) boards.push("OSPI PCF8591");
		if (detected & OSApp.Analog.Constants.OSPI_ADS1115) boards.push("OSPI 2xADS1115");
		if (detected & OSApp.Analog.Constants.UART_SC16IS752) boards.push("UART-Adapter I2C");
		if (detected & OSApp.Analog.Constants.RS485_TRUEBNER1) boards.push("RS485-Adapter Truebner");
		if (detected & OSApp.Analog.Constants.RS485_TRUEBNER2) boards.push("RS485-Adapter Truebner 2");
		if (detected & OSApp.Analog.Constants.RS485_TRUEBNER3) boards.push("RS485-Adapter Truebner 3");
		if (detected & OSApp.Analog.Constants.RS485_TRUEBNER4) boards.push("RS485-Adapter Truebner 4");
		if (detected & OSApp.Analog.Constants.OSPI_USB_RS485) boards.push("OSPI USB-RS485-Adapter");
		if (detected & OSApp.Analog.Constants.I2C_RS485) boards.push("I2C-RS485-Adapter");
		if (detected == 0) boards.push("No Boards detected");
		if (detected && boards.length == 0) boards.push("Unknown Adapter");
		detected_boards = ": " + boards.filter(Boolean).join(", ");
	}

	var list = "<fieldset data-role='collapsible' data-section-id='sensors' data-iconpos='left'" + (OSApp.Analog.expandItem.has("sensors") ? " data-collapsed='false'" : "") + ">" +
		"<legend>" + OSApp.Language._("Sensors") + detected_boards + "</legend>";

	var info = OSApp.Analog.checkFirmwareUpdate();
	if (info === undefined)
		info = "";
	list +=
		"<table style='width: 100%; clear: both;' id='analog_sensor_table'><tr>" +
		info +
		"<tr><th>" + OSApp.Language._("Nr") + "</th><th class=\"hidecol\">" + OSApp.Language._("Type") + "</th><th class=\"hidecol\">" + OSApp.Language._("Group") + "</th><th>" + OSApp.Language._("Name") + "</th>" +
		"<th class=\"hidecol\">" + OSApp.Language._("IP") + "</th><th class=\"hidecol\">" + OSApp.Language._("Port") + "</th><th class=\"hidecol\">" + OSApp.Language._("ID") + "</th>" +
		"<th class=\"hidecol\">" + OSApp.Language._("Read") + "<br>" + OSApp.Language._("Interval") + "</th><th>" + OSApp.Language._("Data") + "</th><th>" + OSApp.Language._("En") + "</th>" +
		"<th class=\"hidecol\">" + OSApp.Language._("Log") + "</th><th class=\"hidecol\">" + OSApp.Language._("Show") + "</th><th class=\"hidecol2\">" + OSApp.Language._("Last") + "</th></tr>";

	var checkpng = "<img src=\"" + OSApp.UIDom.getAppURLPath() + "img/check-blue.png\">";

	var row = 0;
	$.each(OSApp.Analog.analogSensors, function (_i, item) {
		var batteryPercent = OSApp.Analog.getBatteryPercent(item.battery);
		var dataCell = $("<td>");
		if (!isNaN(item.data)) {
			dataCell.text(OSApp.Analog.formatVal(item.data) + item.unit);
		}
		if (batteryPercent !== null) {
			dataCell.append(" ").append($(OSApp.Analog.renderBatteryIcon(batteryPercent, false)));
		}

		var $tr = $("<tr>").append(
			$("<td>").text(item.nr),
			$("<td class=\"hidecol\">").text(item.type),
			$("<td class=\"hidecol\">").text(item.group ? item.group : ""),
			"<td><a data-role='button' class='edit-sensor wraptext' value='" + item.nr + "' row='" + row + "' href='#' data-mini='true' data-icon='edit'>" +
			item.name + "</a></td>",
			$("<td class=\"hidecol\">").text(item.ip ? OSApp.Analog.toByteArray(item.ip).join(".") : ""),
			$("<td class=\"hidecol\">").text(item.port ? (":" + item.port) : ""),
			$("<td class=\"hidecol\">").text(isNaN(item.id) ? "" : (item.type < 1000 ? item.id : "")),
			$("<td class=\"hidecol\">").text(isNaN(item.ri) ? "" : item.ri),
			dataCell,
			"<td>" + (item.enable ? checkpng : "") + "</td>",
			"<td class=\"hidecol\">" + (item.log ? checkpng : "") + "</td>",
			"<td class=\"hidecol\">" + (item.show ? checkpng : "") + "</td>",
			$("<td class=\"hidecol2\">").text(item.last === undefined ? "" : (item.data_ok ? OSApp.Dates.dateToString(new Date(item.last * 1000)) : ""), null, 2)
		);
		list += $tr.wrap("<p>").html() + "</tr>";
		row++;
	});
	list += "</table>";
	list += "<div style='margin-top: 10px;'>" +
		"<a data-role='button' class='sort-section-toggle' data-section='sensors' href='#' data-mini='true' data-icon='bars' style='display: inline-block; margin-right: 5px;'>" + OSApp.Language._("Sort") + "</a>" +
		"<a data-role='button' class='add-sensor' href='#' data-mini='true' data-icon='plus' style='display: inline-block; margin-right: 5px;'>" +
		OSApp.Language._("Add Sensor") + "</a>" +
		"<a data-role='button' class='refresh-sensor' href='#' data-mini='true' data-icon='refresh' style='display: inline-block;'>" +
		OSApp.Language._("Refresh Sensordata") + "</a>" +
		"</div>";
	list += "</fieldset>";

	//Program adjustments table:
	list += "<fieldset data-role='collapsible' data-section-id='progadjust' data-iconpos='left'" + (OSApp.Analog.expandItem.has("progadjust") ? " data-collapsed='false'" : "") + ">" +
		"<legend>" + OSApp.Language._("Program Adjustments") + "</legend>";
	list +=
		"<table style='width: 100%; clear: both;' id='progadjusttable'><tr style='width:100%;vertical-align: top;'>" +
		"<tr><th>" + OSApp.Language._("Nr") + "</th>" +
		"<th class=\"hidecol\">" + OSApp.Language._("Type") + "</th>" +
		"<th class=\"hidecol2\">" + OSApp.Language._("S.Nr") + "</th>" +
		"<th class=\"hidecol2\">" + OSApp.Language._("Sensor") + "</th>" +
		"<th>" + OSApp.Language._("Name") + "</th>" +
		"<th class=\"hidecol2\">" + OSApp.Language._("Program") + "</th>" +
		"<th class=\"hidecol2\">" + OSApp.Language._("Factor 1") + "</th>" +
		"<th class=\"hidecol2\">" + OSApp.Language._("Factor 2") + "</th>" +
		"<th class=\"hidecol2\">" + OSApp.Language._("Min Value") + "</th>" +
		"<th class=\"hidecol2\">" + OSApp.Language._("Max Value") + "</th>" +
		"<th>" + OSApp.Language._("Cur") + "</th></tr>";

	row = 0;
	$.each(OSApp.Analog.progAdjusts, function (_i, item) {

		var sensorName = "";
		for (var j = 0; j < OSApp.Analog.analogSensors.length; j++) {
			if (OSApp.Analog.analogSensors[j].nr === item.sensor) {
				sensorName = OSApp.Analog.analogSensors[j].name;
			}
		}
		var progName = "?";
		if (item.prog >= 1 && item.prog <= OSApp.currentSession.controller.programs.pd.length) {
			progName = OSApp.Programs.readProgram(OSApp.currentSession.controller.programs.pd[item.prog - 1]).name;
		}

		if (!OSApp.Firmware.checkOSVersion(233))
			item.name = sensorName+"/"+progName;

		var $tr = $("<tr>").append(
			$("<td>").text(item.nr),
			$("<td class=\"hidecol\">").text(item.type),
			$("<td class=\"hidecol2\">").text(item.sensor),
			$("<td class=\"hidecol2\">").text(sensorName),
			"<td><a data-role='button' class='edit-progadjust wraptext' value='" + item.nr + "' row='" + row + "' href='#' data-mini='true' data-icon='edit'>" +
			item.name + "</a></td>",
			$("<td class=\"hidecol2\">").text(progName),
			$("<td class=\"hidecol2\">").text(Math.round(item.factor1 * 100) + "%"),
			$("<td class=\"hidecol2\">").text(Math.round(item.factor2 * 100) + "%"),
			$("<td class=\"hidecol2\">").text(item.min),
			$("<td class=\"hidecol2\">").text(item.max),
			$("<td>").text(item.current === undefined ? "" : (Math.round(item.current * 100.0) + "%"))
		);
		list += $tr.wrap("<p>").html() + "</tr>";
		row++;
	});
	list += "</table>";
	list += "<div style='margin-top: 10px;'>" +
		"<a data-role='button' class='sort-section-toggle' data-section='progadjust' href='#' data-mini='true' data-icon='bars' style='display: inline-block; margin-right: 5px;'>" + OSApp.Language._("Sort") + "</a>" +
		"<a data-role='button' class='add-progadjust' href='#' data-mini='true' data-icon='plus' style='display: inline-block;'>" + OSApp.Language._("Add program adjustment") + "</a>" +
		"</div>";
	list += "</fieldset>";

	//Monitors table:
	if (OSApp.Firmware.checkOSVersion(233) && OSApp.Analog.monitors) {
		list += "<fieldset data-role='collapsible' data-section-id='monitors' data-iconpos='left'" + (OSApp.Analog.expandItem.has("monitors") ? " data-collapsed='false'" : "") + ">" +
			"<legend>" + OSApp.Language._("Monitoring and control") + "</legend>";
		list += "<table style='width: 100%;' id='monitorstable'><tr style='width:100%;vertical-align: top;'>" +
			"<tr><th>" + OSApp.Language._("Nr") + "</th>" +
			"<th class=\"hidecol\">" + OSApp.Language._("Type") + "</th>" +
			"<th class=\"hidecol2\">" + OSApp.Language._("S.Nr") + "</th>" +
			"<th class=\"hidecol2\">" + OSApp.Language._("Source") + "</th>" +
			"<th>" + OSApp.Language._("Name") + "</th>" +
			"<th class=\"hidecol2\">" + OSApp.Language._("Program") + "</th>" +
			"<th class=\"hidecol2\">" + OSApp.Language._("Zone") + "</th>" +
			"<th class=\"hidecol2\">" + OSApp.Language._("Value 1") + "</th>" +
			"<th class=\"hidecol2\">" + OSApp.Language._("Value 2") + "</th>" +
			"<th>" + OSApp.Language._("Activated") + "</th></tr>";

		row = 0;
		$.each(OSApp.Analog.monitors, function (_i, item) {
			var progName = "";
			if (item.prog > 0 && item.prog <= OSApp.currentSession.controller.programs.pd.length) {
				progName = OSApp.Programs.readProgram(OSApp.currentSession.controller.programs.pd[item.prog - 1]).name;
			}
			var zoneName = "";
			if (item.zone > 0 && item.zone <= OSApp.currentSession.controller.stations.snames.length) {
				zoneName = OSApp.currentSession.controller.stations.snames[item.zone - 1];
			}
			var source = "";
			var unit = "";
			var sensorNr = "";
			switch(item.type) {
				case OSApp.Analog.Constants.MONITOR_MIN:
				case OSApp.Analog.Constants.MONITOR_MAX: {
					for (var j = 0; j < OSApp.Analog.analogSensors.length; j++) {
						if (OSApp.Analog.analogSensors[j].nr === item.sensor) {
							source = OSApp.Analog.analogSensors[j].name;
							unit = OSApp.Analog.analogSensors[j].unit;
						}
					}
					sensorNr = item.sensor;
					break;
				}
				case OSApp.Analog.Constants.MONITOR_SENSOR12: {
					if (item.sensor12 == 1)
						source = OSApp.currentSession.controller.options.sn1t === 3 ? OSApp.Language._( "Soil" ) : OSApp.Language._( "Rain" );
					else if (item.sensor12 == 2)
						source = OSApp.currentSession.controller.options.sn2t === 3 ? OSApp.Language._( "Soil" ) : OSApp.Language._( "Rain" );
					else
						source = "??";
					if (item.invers) source = OSApp.Language._("NOT") + " " + source;
					break;
				}
				case OSApp.Analog.Constants.MONITOR_SET_SENSOR12: {
					source = OSApp.Analog.getMonitorName(item.monitor);
					break;
				}

				case OSApp.Analog.Constants.MONITOR_AND:
				case OSApp.Analog.Constants.MONITOR_OR:
				case OSApp.Analog.Constants.MONITOR_XOR: {
					source = OSApp.Analog.combineWithSep(" " + OSApp.Analog.getMonitorLogical(item.type) + " ",
						OSApp.Analog.getMonitorSourceName(item.invers1, item.monitor1),
						OSApp.Analog.getMonitorSourceName(item.invers2, item.monitor2),
						OSApp.Analog.getMonitorSourceName(item.invers3, item.monitor3),
						OSApp.Analog.getMonitorSourceName(item.invers4, item.monitor4));
					break;
				}
				case OSApp.Analog.Constants.MONITOR_NOT: {
					source = OSApp.Analog.getMonitorLogical(item.type)+" "+OSApp.Analog.getMonitorName(item.monitor);
					break;
				}
				case OSApp.Analog.Constants.MONITOR_REMOTE: {
					source = OSApp.Analog.getMonitorLogical(item.type)+" "+OSApp.Analog.getMonitorName(item.monitor);
					break;
				}
			}
			var $tr = $("<tr>").append(
				$("<td>").text(item.nr),
				$("<td class=\"hidecol\">").text(item.type),
				$("<td class=\"hidecol2\">").text(sensorNr),
				$("<td class=\"hidecol2\">").text(source),
				"<td><a data-role='button' class='edit-monitor wraptext' value='" + item.nr + "' row='" + row + "' href='#' data-mini='true' data-icon='edit'>" +
				item.name + "</a></td>",
				$("<td class=\"hidecol2\">").text(progName),
				$("<td class=\"hidecol2\">").text(zoneName),
				$("<td class=\"hidecol2\">").text(OSApp.Analog.formatValUnit(item.value1, unit)),
				$("<td class=\"hidecol2\">").text(OSApp.Analog.formatValUnit(item.value2, unit)),
				$("<td>"+(item.active ? checkpng : ""))
			);
			list += $tr.wrap("<p>").html() + "</tr>";
			row++;
		});
		list += "</table>";
		list += "<div style='margin-top: 10px;'>" +
			"<a data-role='button' class='sort-section-toggle' data-section='monitors' href='#' data-mini='true' data-icon='bars' style='display: inline-block; margin-right: 5px;'>" + OSApp.Language._("Sort") + "</a>" +
			"<a data-role='button' class='add-monitor' href='#' data-mini='true' data-icon='plus' style='display: inline-block;'>" + OSApp.Language._("Add monitor") + "</a>" +
			"</div>";
		list += "</fieldset>";
	}

	//Chart options (Diagramm-Optionen):
	{
		var tmpCo = OSApp.Analog.chartConvertTemp;
		var comb = OSApp.Analog.chartCombineMoistTemp ? 1 : 0;

		list += "<fieldset data-role='collapsible' data-iconpos='left'" + (OSApp.Analog.expandItem.has("chartoptions") ? " data-collapsed='false'" : "") + ">" +
			"<legend>" + OSApp.Language._("Chart Options") + "</legend>" +

			"<label for='tempconvert'>" + OSApp.Language._("Temperature Conversion") + ":</label>" +
			"<select id='tempconvert' data-mini='true'>" +
			"<option value='0' " + (tmpCo === 0 ? "selected" : "") + ">" + OSApp.Language._("No conversion") + "</option>" +
			"<option value='1' " + (tmpCo === 1 ? "selected" : "") + ">" + OSApp.Language._("Fahrenheit to Celsius") + "</option>" +
			"<option value='2' " + (tmpCo === 2 ? "selected" : "") + ">" + OSApp.Language._("Celsius to Fahrenheit") + "</option>" +
			"</select>" +

			"<label for='combinemoisttemp'><input id='combinemoisttemp' type='checkbox' " + (comb === 1 ? "checked='checked'" : "") + ">" +
			OSApp.Language._("Combine Soil Moisture and Temperature in one chart") + "</label>" +

			"</fieldset>";
	}

	//Analog sensor logs:
	list += "<fieldset data-role='collapsible' data-iconpos='left'" + (OSApp.Analog.expandItem.has("sensorlog") ? " data-collapsed='false'" : "") + ">" +
		"<legend>" + OSApp.Language._("Sensor Log") + "</legend>";
	list += "<a data-role='button' class='red clear_sensor_logs' href='#' data-mini='true' data-icon='alert'>" +
		OSApp.Language._("Clear Log") +
		"</a>" +
		"<a data-role='button' data-icon='action' class='download-log' href='#' data-mini='true'>" + OSApp.Language._("Download Log") + "</a>" +
		"<a data-role='button' data-icon='grid' class='show-log' href='#' data-mini='true'>" + OSApp.Language._("Show Log") + "</a>";

	// Chart options: Temperature conversion and combined chart
	list += "<div style='margin-top: 10px; padding: 8px; border: 1px solid #ccc; border-radius: 5px;'>" +
		"<label><b>" + OSApp.Language._("Chart Options") + "</b></label>";

	list += "<fieldset data-role='controlgroup' data-type='vertical' data-mini='true'>" +
		"<legend>" + OSApp.Language._("Temperature Conversion") + "</legend>" +
		"<input type='radio' name='chart-temp-convert' id='chart-temp-none' value='0'" + (OSApp.Analog.chartConvertTemp === 0 ? " checked='checked'" : "") + ">" +
		"<label for='chart-temp-none'>" + OSApp.Language._("No conversion") + "</label>" +
		"<input type='radio' name='chart-temp-convert' id='chart-temp-f2c' value='1'" + (OSApp.Analog.chartConvertTemp === 1 ? " checked='checked'" : "") + ">" +
		"<label for='chart-temp-f2c'>" + OSApp.Language._("Fahrenheit to Celsius") + "</label>" +
		"<input type='radio' name='chart-temp-convert' id='chart-temp-c2f' value='2'" + (OSApp.Analog.chartConvertTemp === 2 ? " checked='checked'" : "") + ">" +
		"<label for='chart-temp-c2f'>" + OSApp.Language._("Celsius to Fahrenheit") + "</label>" +
		"</fieldset>";

	list += "<label for='chart-combine-moist-temp'>" +
		"<input type='checkbox' id='chart-combine-moist-temp' class='chart-combine-moist-temp'" + (OSApp.Analog.chartCombineMoistTemp ? " checked='checked'" : "") + ">" +
		OSApp.Language._("Combine Soil Moisture and Temperature in one chart") +
		"</label>";

	list += "</div>";

	list += "</fieldset>";

	//FYTA Setup:
	if (OSApp.Firmware.checkOSVersion(233) && OSApp.currentSession.controller.options.fwm >= 181) {
		list += "<fieldset data-role='collapsible' data-iconpos='left'" + (OSApp.Analog.expandItem.has("fytasetup") ? " data-collapsed='false'" : "") + ">" +
			"<legend>" + OSApp.Language._("FYTA Setup") + "</legend>";
		list += "<a data-role='button' data-icon='grid' class='fytasetup' href='#' data-mini='true'>" + OSApp.Language._("Setup FYTA credentials") + "</a>" +
			"</fieldset>";
	}

	//backup:
	if (OSApp.Firmware.checkOSVersion(231)) {
		list += "<fieldset data-role='collapsible' data-iconpos='left'" + (OSApp.Analog.expandItem.has("backup") ? " data-collapsed='false'" : "") + ">" +
			"<legend>" + OSApp.Language._("Backup and Restore") + "</legend>";
		list += "<a data-role='button' data-icon='arrow-d-r' class='backup-all wraptext'  href='#' data-mini='true'>" + OSApp.Language._("Backup Config") + "</a>" +
			"<a data-role='button' data-icon='back'      class='restore-all wraptext' href='#' data-mini='true'>" + OSApp.Language._("Restore Config") + "</a>";
		list += "<a data-role='button' data-icon='arrow-d-r' class='backup-sensors wraptext'  href='#' data-mini='true'>" + OSApp.Language._("Backup Sensor Config") + "</a>" +
			"<a data-role='button' data-icon='back'      class='restore-sensors wraptext' href='#' data-mini='true'>" + OSApp.Language._("Restore Sensor Config") + "</a>";
		list += "<a data-role='button' data-icon='arrow-d-r' class='backup-adjustments wraptext'  href='#' data-mini='true'>" + OSApp.Language._("Backup Program Adjustments") + "</a>" +
			"<a data-role='button' data-icon='back'      class='restore-adjustments wraptext' href='#' data-mini='true'>" + OSApp.Language._("Restore Program Adjustments") + "</a>";
		if (OSApp.Firmware.checkOSVersion(233)) {
			list += "<a data-role='button' data-icon='arrow-d-r' class='backup-monitors'  href='#' data-mini='true'>" + OSApp.Language._("Backup Monitors") + "</a>" +
				"<a data-role='button' data-icon='back'      class='restore-monitors' href='#' data-mini='true'>" + OSApp.Language._("Restore Monitors") + "</a>";
			list += "</div></fieldset>";
		}
	}
	return list;
};

/*
	Combines all parameters to a string. First parameter is the separator
*/
OSApp.Analog.combineWithSep = function(sep, ...args) {
	if (!args.length) return "";
	var result = "";
	for (var i = 0; i < args.length; i++) {
		let arg = args[i];
		if (!arg) continue;
		if (result.length > 0) result += sep;
		result += arg;
	}
	return result;
};

OSApp.Analog.getMonitorLogical = function(type) {
	switch(type) {
		case OSApp.Analog.Constants.MONITOR_MIN: return OSApp.Language._("Min");
		case OSApp.Analog.Constants.MONITOR_MAX: return OSApp.Language._("Max");
		case OSApp.Analog.Constants.MONITOR_SENSOR12: return OSApp.Language._("SN 1/2");
		case OSApp.Analog.Constants.MONITOR_SET_SENSOR12: return OSApp.Language._("SET SN 1/2");
		case OSApp.Analog.Constants.MONITOR_AND: return OSApp.Language._("AND");
		case OSApp.Analog.Constants.MONITOR_OR: return OSApp.Language._("OR");
		case OSApp.Analog.Constants.MONITOR_XOR: return OSApp.Language._("XOR");
		case OSApp.Analog.Constants.MONITOR_NOT: return OSApp.Language._("NOT");
		case OSApp.Analog.Constants.MONITOR_TIME: return OSApp.Language._("TIME");
		case OSApp.Analog.Constants.MONITOR_REMOTE: return OSApp.Language._("REMOTE");
		default: return "??";
	}
};

OSApp.Analog.getMonitorSourceName = function(invers, monitorNr) {
	if (!monitorNr) return "";
	return (invers? (OSApp.Language._("NOT") + " ") : "")+ OSApp.Analog.getMonitorName(monitorNr);
};

OSApp.Analog.getMonitorName = function(monitorNr) {
	for (var i = 0; i < OSApp.Analog.monitors.length; i++) {
		let monitor = OSApp.Analog.monitors[i];
		if (monitor.nr === monitorNr)
			return monitor.name;
	}
	return "";
};

// Show Sensor Charts with apexcharts
OSApp.Analog.showAnalogSensorCharts = function(limit2sensor) {

	var max = OSApp.Analog.Constants.CHARTS;
	for (let j = 0; j < OSApp.Analog.analogSensors.length; j++) {
		if (!OSApp.Analog.analogSensors[j].log || !OSApp.Analog.analogSensors[j].enable)
			continue;
		var unitid = OSApp.Analog.analogSensors[j].unitid;
		if (unitid === OSApp.Analog.Constants.USERDEF_UNIT) max++;
	}

	var last = "", week = "", month = "";
	for (let j = 0; j <= max; j++) {
		last += "<div id='myChart" + j + "'></div>";
		week += "<div id='myChartW" + j + "'></div>";
		month += "<div id='myChartM" + j + "'></div>";
	}

	var page = $("<div data-role='page' id='analogsensorchart'>" +
		"<div class='ui-content' role='main' style='width: 95%'>" +
		last + week + month +
		"</div></div>");

	OSApp.UIDom.changeHeader({
		title: OSApp.Language._("Analog Sensor Log"),
		leftBtn: {
			icon: "carat-l",
			text: OSApp.Language._("Back"),
			class: "ui-toolbar-back-btn",
			on: function() {
				OSApp.UIDom.goBack();
			},
		},
		rightBtn: {
			icon: "refresh",
			text: screen.width >= 500 ? OSApp.Language._("Refresh") : "",
			class: "refresh-sensorlog",
			on: function() {
				OSApp.Analog.updateCharts(limit2sensor);
			},
		}
	});

	page.one("pagehide", function () {
		page.detach();
	});

	$("#analogsensorchart").remove();
	$.mobile.pageContainer.append(page);
	$.mobile.pageContainer.pagecontainer("change", page);

	OSApp.Analog.updateCharts(limit2sensor);
}
OSApp.Analog.updateCharts = function(limit2sensor) {
	var chart1 = new Array(OSApp.Analog.Constants.CHARTS),
		chart2 = new Array(OSApp.Analog.Constants.CHARTS),
		chart3 = new Array(OSApp.Analog.Constants.CHARTS);

	var esp32 = OSApp.Analog.isESP32();
	var limit = (OSApp.currentSession.token && !esp32) ? "&max=5500" : ""; //download limit is 140kb, 5500 lines ca 137kb
	var lvl0 = esp32 ? "/so?pw=&lasthours=96&csv=2" : "/so?pw=&lasthours=48&csv=2";
	var lvl0text = esp32 ? OSApp.Language._("last 96h") : OSApp.Language._("last 48h");
	var tzo = OSApp.Dates.getTimezoneOffsetOS() * 60;
	if (limit2sensor)
		limit += "&nr="+limit2sensor;

	OSApp.UIDom.showLoading( "#myChart0" );
	OSApp.Firmware.sendToOS( lvl0 + limit, "text", 90000).then(function (csv1) {
		OSApp.Analog.buildGraph("#myChart", chart1, csv1, lvl0text, "HH:mm", tzo, 0);

		OSApp.UIDom.showLoading( "#myChartW0" );
		OSApp.Firmware.sendToOS("/so?pw=&csv=2&log=1" + limit, "text", 90000).then(function (csv2) {
			OSApp.Analog.buildGraph("#myChartW", chart2, csv2, OSApp.Language._("last weeks"), "dd.MM.yyyy", tzo, 1);

			OSApp.UIDom.showLoading( "#myChartM0" );
			OSApp.Firmware.sendToOS("/so?pw=&csv=2&log=2" + limit, "text", 90000).then(function (csv3) {
				OSApp.Analog.buildGraph("#myChartM", chart3, csv3, OSApp.Language._("last months"), "MM.yyyy", tzo, 2);
			});
		});
	});
}

OSApp.Analog.buildGraph = function(prefix, chart, csv, titleAdd, timestr, tzo, lvl) {
	var csvlines = csv.split(/(?:\r\n|\n)+/).filter(function (el) { return el.length !== 0; });

	var legends = [], opacities = [], widths = [], colors = [], coloridx = 0;
	let canExport = !OSApp.currentDevice.isAndroid && !OSApp.currentDevice.isiOS;
	let combine = OSApp.Analog.chartCombineMoistTemp ? 1 : 0;
	let AllOptions = [];
	for (var j = 0; j < OSApp.Analog.analogSensors.length; j++) {
		var sensor = OSApp.Analog.analogSensors[j];
		let color = OSApp.Analog.Constants.COLORS[coloridx++ % OSApp.Analog.Constants.COLCOUNT];
		if (!sensor.log || !sensor.enable) {
			continue;
		}
		var nr = sensor.nr,
			logdata = [],
			rngdata = [],
			logmap = new Map(),
			unitid = sensor.unitid,
			lastdate = 0;

		// Temperature conversion: determine if this sensor needs conversion
		var convertTemp = 0; // 0=none, 1=F->C, 2=C->F
		if (OSApp.Analog.chartConvertTemp === 1 && unitid === 3) convertTemp = 1; // F->C
		if (OSApp.Analog.chartConvertTemp === 2 && unitid === 2) convertTemp = 2; // C->F
		// Override unitid for chart grouping when converting
		if (convertTemp === 1) unitid = 2; // show in Celsius chart
		if (convertTemp === 2) unitid = 3; // show in Fahrenheit chart

		for (var k = 1; k < csvlines.length; k++) {
			var line = csvlines[k].split(";");
			if (line.length >= 3 && Number(line[0]) === nr) {
				let date = Number(line[1]);
				if (date < lastdate) continue;
				lastdate = date;
				let value = Number(line[2]);
				if (value === undefined || date === undefined) continue;
				// Apply temperature conversion
				if (convertTemp === 1) value = (value - 32) * 5 / 9; // F->C
				else if (convertTemp === 2) value = value * 9 / 5 + 32; // C->F
				if (unitid != 3 && unitid != OSApp.Analog.Constants.USERDEF_UNIT && value > 100) continue;
				if (unitid == 1 && value < 0) continue;
				if (lvl == 0) //day values
					logdata.push({ x: (date - tzo) * 1000, y: value });
				else {
					var key;
					var fac;
					if (lvl === 1) //week values
						fac = 7 * 24 * 60 * 60;
					else //month values
						fac = 30 * 24 * 60 * 60;
					key = Math.trunc(date / fac) * fac * 1000;

					var minmax = logmap.get(key);
					if (!minmax)
						minmax = { min: value, max: value };
					else
						minmax = { min: Math.min(minmax.min, value), max: Math.max(minmax.max, value) };
					logmap.set(key, minmax);
				}
			}
		}

		if (lvl > 0) {
			for (let [key, value] of logmap) {
				rngdata.push({ x: key, y: [value.min, value.max] });
				logdata.push({ x: key, y: (value.max + value.min) / 2 });
			}
		}

		if (logdata.length < 2) continue;

		//add current value as forecast data:
		let date = new Date();
		date.setMinutes(date.getMinutes() - date.getTimezoneOffset() - tzo / 60);

		let value = sensor.data ? sensor.data : logdata.slice(-1)[0].y;
		logdata.push({ x: date, y: value });
		var fkdp = lvl < 1 ? 1 : 0;

		if (lvl > 0) {
			let rng = rngdata.slice(-1)[0].y;
			let diff = (rng[1] - rng[0]) / 2;
			rngdata.push({ x: date, y: [value - diff, value + diff] });
		}

		// User defined sensor:
		if (unitid === OSApp.Analog.Constants.USERDEF_UNIT) {
			unitid = chart.length;
			chart.push(undefined);
		} else if (unitid >= OSApp.Analog.Constants.CHARTS) {
			unitid = 0;
		}

		if (!legends[unitid])
			legends[unitid] = [sensor.name];
		else
			legends[unitid].push(sensor.name);
		if (!opacities[unitid])
			opacities[unitid] = [1];
		else
			opacities[unitid].push(1);
		if (!widths[unitid])
			widths[unitid] = [4];
		else
			widths[unitid].push(4);

		if (!colors[unitid])
			colors[unitid] = [color];
		else
			colors[unitid].push(color);

		var series = { name: sensor.name, type: (sensor.unitid === OSApp.Analog.Constants.USERDEF_UNIT? "area" : "line"), data: logdata, color: color };

		if (!AllOptions[unitid]) {
			var unit, title, unitStr,
				minFunc = function (val) { return Math.floor(val > 0 ? Math.max(0, val - 4) : val - 1); },
				maxFunc = function (val) { return Math.ceil(val); },
				autoY = true;
			switch (unitid) {
				case 1: unit = OSApp.Language._("Soil moisture");
					title = OSApp.Language._("Soil moisture") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + " %"; };
					minFunc = 0;
					maxFunc = 100;
					break;
				case 2: unit = OSApp.Language._("degree celsius temperature");
					title = OSApp.Language._("Temperature") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + String.fromCharCode(176) + "C"; };
					break;
				case 3: unit = OSApp.Language._("degree fahrenheit temperature");
					title = OSApp.Language._("Temperature") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + String.fromCharCode(176) + "F"; };
					break;
				case 4: unit = OSApp.Language._("Volt");
					title = OSApp.Language._("Voltage") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + " V"; };
					minFunc = 0;
					maxFunc = 4;
					autoY = false;
					break;
				case 5: unit = OSApp.Language._("Humidity");
					title = OSApp.Language._("Air Humidity") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + " %"; };
					minFunc = 0;
					maxFunc = 100;
					break;
				case 6: unit = OSApp.Language._("Rain");
					title = OSApp.Language._("Rainfall") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + " in"; };
					break;
				case 7: unit = OSApp.Language._("Rain");
					title = OSApp.Language._("Rainfall") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + " mm"; };
					minFunc = 0;
					break;
				case 8: unit = OSApp.Language._("Wind");
					title = OSApp.Language._("Wind") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + " mph"; };
					minFunc = 0;
					break;
				case 9: unit = OSApp.Language._("Wind");
					title = OSApp.Language._("Wind") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + " kmh"; };
					minFunc = 0;
					break;
				case 10: unit = OSApp.Language._("Level");
					title = OSApp.Language._("Level") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val) + " %"; };
					minFunc = 0;
					maxFunc = 100;
					autoY = false;
					break;
				case 11: unit = OSApp.Language._("DK");
					title = OSApp.Language._("DK") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val); };
					minFunc = 0;
					break;
				case 12: unit = OSApp.Language._("lm");
					title = OSApp.Language._("Lumen") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val); };
					minFunc = 0;
					break;
				case 13: unit = OSApp.Language._("lx");
					title = OSApp.Language._("LUX") + " " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val); };
					minFunc = 0;
					break;


				default: unit = sensor.unit;
					title = sensor.name + "~ " + titleAdd;
					unitStr = function (val) { return OSApp.Analog.formatVal(val); };
			};

			let options = {
				chart: {
					type: lvl > 0 ? 'rangeArea' : 'area',
					animations: {
						speed: 500
					},
					stacked: false,
					width: '100%',
					height: (screen.height > screen.width ? screen.height : screen.width) / 3,
					toolbar: {
						show: canExport,
						tools: {
							download: canExport,
							selection: canExport,
							zoom: canExport,
							zoomin: canExport,
							zoomout: canExport,
							pan: canExport
						},
					},
					zoom: {
						enabled: canExport
					},
					dropShadow: {
						enabled: true
					}
				},
				forecastDataPoints: {
					count: fkdp
				},
				dataLabels: {
					enabled: false
				},
				fill: {
					colors: colors[unitid],
					opacity: opacities[unitid],
					type: 'solid'
				},
				series: [series],
				stroke: {
					curve: "smooth",
					colors: colors[unitid],
					width: widths[unitid],
					dashArray: 0
				},
				grid: {
					xaxis: {
						lines: {
							show: true
						}
					},
					yaxis: {
						lines: {
							show: true
						}
					}
				},
				plotOptions: {
					bar: {
						columnWidth: "20%"
					}
				},
				tooltip: {
					x: {
						datetimeUTC: false,
						format: timestr
					}
				},
				xaxis: {
					type: "datetime",
					labels: {
						datetimeUTC: false,
						format: timestr
					}
				},
				yaxis: {
					title: { text: unit },
					decimalsInFloat: 0,
					forceNiceScale: autoY,
					labels: {
						formatter: unitStr
					},
					seriesName: [series.name],
					min: minFunc,
					max: autoY ? undefined : maxFunc
				},
				legend: {
					showForSingleSeries: true,
					fontSize: "10px"
				},
				title: { text: title }
			};
			AllOptions[unitid] = options;
		} else {
			AllOptions[unitid].yaxis.seriesName = AllOptions[unitid].yaxis.seriesName.concat(series.name);
			AllOptions[unitid].series = AllOptions[unitid].series.concat(series);
		}

		if (lvl > 0) {
			opacities[unitid].push(0.24);
			widths[unitid].push(0);
			colors[unitid].push(color);
			let rangeArea = {
				type: 'rangeArea',
				name: [],
				color: color,
				data: rngdata
			};
			let otherOptions = {
				fill: {
					colors: colors[unitid],
					opacity: opacities[unitid]
				},
				stroke: {
					curve: "smooth",
					colors: colors[unitid],
					width: widths[unitid],
					dashArray: 0
				}
			};
			AllOptions[unitid].series = AllOptions[unitid].series.concat(rangeArea);
			AllOptions[unitid] = Object.assign(AllOptions[unitid], otherOptions);
		}
	}

	for (let p = 0; p < OSApp.Analog.progAdjusts.length; p++) {
		var adjust = OSApp.Analog.progAdjusts[p];
		sensor = adjust.sensor;
		for (let j = 0; j < OSApp.Analog.analogSensors.length; j++) {
			if (OSApp.Analog.analogSensors[j].nr == sensor && AllOptions[OSApp.Analog.analogSensors[j].unitid]) {
				let unitid = OSApp.Analog.analogSensors[j].unitid;
				let unitStr = OSApp.Analog.analogSensors[j].unit;

				//var progName = "";
				//if ( adjust.prog >= 1 && adjust.prog <= controller.programs.pd.length ) {
				//	progName = readProgram( controller.programs.pd[ adjust.prog - 1 ] ).name;
				//}

				var options = {
					annotations: {
						yaxis: [
							{
								y: adjust.min,
								strokeDashArray: 8,
								borderColor: "#00E396",
								borderWidth: 4,
								label: {
									borderColor: "#00E396",
									textAnchor: "start",
									position: "left",
									offsetX: 60,
									text: OSApp.Language._("Min") + " " + adjust.min + " " + unitStr,
									style: {
										color: "#fff",
										background: "#00E396"
									}
								}
							},
							{
								y: adjust.max,
								strokeDashArray: 8,
								borderColor: "#ffadad",
								borderWidth: 4,
								label: {
									borderColor: "#ffadad",
									textAnchor: "start",
									position: "left",
									offsetX: 60,
									text: OSApp.Language._("Max") + " " + adjust.max + " " + unitStr,
									style: {
										color: "#fff",
										background: "#ffadad"
									}
								}
							}
						]
					}
				};
				AllOptions[unitid] = Object.assign(AllOptions[unitid], options);
			}
		}
	}

	// When combining, determine which temperature unit is available (2=Celsius, 3=Fahrenheit)
	var tempUnitId = AllOptions[2] ? 2 : (AllOptions[3] ? 3 : 2);
	var moistUnitId = 1; // Soil moisture

	// Combine Soil Moisture (unitid 1) and Temperature in one chart when option is enabled
	if (combine && AllOptions[moistUnitId] && AllOptions[tempUnitId]) {

		let series = AllOptions[moistUnitId].series.concat(AllOptions[tempUnitId].series);
		let yaxis = [AllOptions[moistUnitId].yaxis, AllOptions[tempUnitId].yaxis];
		yaxis[1].opposite = true;
		let annotations = [];
		if (AllOptions[moistUnitId].annotations)
			annotations = annotations.concat(AllOptions[moistUnitId].annotations.yaxis);
		if (AllOptions[tempUnitId].annotations)
			annotations = annotations.concat(AllOptions[tempUnitId].annotations.yaxis);

		let options = {
			chart: {
				type: 'area',
				animations: { speed: 500 },
				stacked: false,
				width: '100%',
				height: (screen.height > screen.width ? screen.height : screen.width) / 3,
				toolbar: { show: canExport, tools: { download: canExport, selection: canExport, zoom: canExport, zoomin: canExport, zoomout: canExport, pan: canExport } },
				zoom: { enabled: canExport },
				dropShadow: { enabled: true }
			},
			forecastDataPoints: { count: 1 },
			dataLabels: { enabled: false },
			fill: {
				colors: (colors[moistUnitId]||[]).concat(colors[tempUnitId]||[]),
				opacity: (opacities[moistUnitId]||[]).concat(opacities[tempUnitId]||[]),
				type: 'solid'
			},
			stroke: {
				curve: "smooth",
				colors: (colors[moistUnitId]||[]).concat(colors[tempUnitId]||[]),
				width: (widths[moistUnitId]||[]).concat(widths[tempUnitId]||[]),
				dashArray: 0
			},
			grid: { xaxis: { lines: { show: true } }, yaxis: { lines: { show: true } } },
			plotOptions: { bar: { columnWidth: "20%" } },
			tooltip: { x: { datetimeUTC: false, format: timestr } },
			xaxis: { type: "datetime", labels: { datetimeUTC: false, format: timestr } },
			legend: { showForSingleSeries: true, fontSize: "10px" },
			series: series,
			yaxis: yaxis,
			title: { text: AllOptions[moistUnitId].title.text + " / " + AllOptions[tempUnitId].title.text },
			annotations: { yaxis: annotations },
		};
		AllOptions[moistUnitId] = options;
		AllOptions[tempUnitId] = null;
	}

	for (var c = 0; c < chart.length; c++) {
		var x = document.querySelector(prefix + c);
		if (x) x.replaceChildren();
		let options = AllOptions[c];
		if (options) {
			chart[c] = new ApexCharts(document.querySelector(prefix + c), options);
			chart[c].render();
		}
	}
};

OSApp.Analog.isNumber = function(n) { return !isNaN(parseFloat(n)) && !isNaN(n - 0) };

/**
* format value output with 2 decimals.
* Empty string result if value is undefined or invalid
*/
OSApp.Analog.formatVal = function(val) {
	if (val === undefined || isNaN(val))
		return "";
	return (+(Math.round(val + "e+2") + "e-2"));
};

/**
* format value output. unit is only printed, if value valid
*/
OSApp.Analog.formatValUnit = function(val, unit) {
	if (val === undefined || isNaN(val))
		return "";
	return (+(Math.round(val + "e+2") + "e-2")) + unit;
};

OSApp.Analog.getUnit = function(sensor) {
	var unitid = sensor.unitid;
	switch (unitid) {
		case 1: return "%";
		case 2: return String.fromCharCode(176) + "C";
		case 3: return String.fromCharCode(176) + "F";
		case 4: return "V";
		case 5: return "%";
		case 6: return "in";
		case 7: return "mm";
		case 8: return "mph";
		case 9: return "kmh";
		case 10: return "%";
		case 11: return "DK";
		case 12: return "lm";
		case 13: return "lx";
		default: return sensor.unit;
	}
};
