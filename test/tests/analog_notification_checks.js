/* eslint-disable */

describe("Analog Notification Checks", function () {
	var originalCordova;
	var originalCurrentDevice;
	var originalCurrentSession;
	var originalMonitors;
	var originalMonitorAlerts;

	beforeEach(function () {
		originalCordova = window.cordova;
		originalCurrentDevice = OSApp.currentDevice;
		originalCurrentSession = OSApp.currentSession;
		originalMonitors = OSApp.Analog.monitors;
		originalMonitorAlerts = OSApp.Analog.monitorAlerts;
	});

	afterEach(function () {
		window.cordova = originalCordova;
		OSApp.currentDevice = originalCurrentDevice;
		OSApp.currentSession = originalCurrentSession;
		OSApp.Analog.monitors = originalMonitors;
		OSApp.Analog.monitorAlerts = originalMonitorAlerts;
	});

	it("OSApp.Analog.checkMonitorAlerts() should schedule monitor notifications with a valid color", function () {
		var scheduled = null;

		window.cordova = {
			plugins: {
				notification: {
					local: {
						schedule: function (options) {
							scheduled = options;
						}
					}
				}
			}
		};

		OSApp.currentDevice = {
			isAndroid: true,
			isiOS: false
		};
		OSApp.currentSession = {
			controller: {
				settings: {
					dname: "My OpenSprinkler"
				}
			}
		};
		OSApp.Analog.monitors = [{
			nr: 7,
			active: true,
			name: "Moisture alert",
			prio: 99
		}];
		OSApp.Analog.monitorAlerts = [];

		OSApp.Analog.checkMonitorAlerts();

		assert.equal(7, scheduled.id);
		assert.equal("os_high", scheduled.channelId);
		assert.equal("#C62828", scheduled.color);
		assert.equal(true, OSApp.Analog.monitorAlerts[7]);
	});

	it("OSApp.Analog.asb_init() should not throw when notification plugins are unavailable", function () {
		window.cordova = undefined;
		OSApp.currentDevice = {
			isAndroid: true,
			isiOS: false
		};

		assert.doesNotThrow(function () {
			OSApp.Analog.asb_init();
		});
	});
});
