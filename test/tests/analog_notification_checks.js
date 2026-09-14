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
