/* eslint-disable */

describe("Remote JSON Sensor Checks", function () {
	it("OSApp.Analog.Constants.SENSOR_REMOTE_JSON should be defined and equal 92", function () {
		assert.equal(92, OSApp.Analog.Constants.SENSOR_REMOTE_JSON);
	});

	it("OSApp.Analog.shortenSensorTypeName should replace 'Remote JSON Data' with 'Remote JSON'", function () {
		var output = OSApp.Analog.shortenSensorTypeName("Remote JSON Data");
		assert.equal("Remote JSON", output);
	});

	it("OSApp.Analog.saveSensor should serialize url and filter for SENSOR_REMOTE_JSON", function () {
		var mockPopup = $(
			"<div>" +
			"<input class='nr' value='42'>" +
			"<select id='type'><option value='92' selected></option></select>" +
			"<input class='group' value='0'>" +
			"<input class='name' value='JSON Test Sensor'>" +
			"<input class='ip' value=''>" +
			"<input class='port' value='80'>" +
			"<input class='id' value='1'>" +
			"<input class='ri' value='600'>" +
			"<input id='factor' value='1'>" +
			"<input id='divider' value='1'>" +
			"<input id='offset' value='0'>" +
			"<input id='unit' value='°C'>" +
			"<select id='unitid'><option value='2' selected></option></select>" +
			"<input id='enable' type='checkbox' checked='checked'>" +
			"<input id='log' type='checkbox' checked='checked'>" +
			"<input id='stdlog' type='checkbox'>" +
			"<input id='show' type='checkbox' checked='checked'>" +
			"<input id='url' value='https://raw.githubusercontent.com/test/data.json'>" +
			"<input id='filter' value='outer|inner|target'>" +
			"</div>"
		);

		// Mock the JQM popup widget wrapper to prevent initialization/close errors.
		mockPopup.popup = function () {};

		var sensorOut = null;
		OSApp.Analog.saveSensor(mockPopup, {}, function (data) {
			sensorOut = data;
		});

		assert.isNotNull(sensorOut);
		assert.equal(92, sensorOut.type);
		assert.equal("https://raw.githubusercontent.com/test/data.json", sensorOut.url);
		assert.equal("outer|inner|target", sensorOut.filter);
	});

	it("OSApp.Analog.updateSensorVisibility should display url_container and filter_container for SENSOR_REMOTE_JSON", function () {
		var mockPopup = $(
			"<div>" +
			"<div class='ip_port_container'></div>" +
			"<div class='id_label'><label></label><input class='id'></div>" +
			"<div class='mac_label'></div>" +
			"<div class='rs485_port_modbus_container'></div>" +
			"<div class='rs485_help'></div>" +
			"<div class='fac_div_offset_container'></div>" +
			"<div class='unit_container'></div>" +
			"<div class='url_container'></div>" +
			"<div class='topic_container'></div>" +
			"<div class='filter_container'><label></label></div>" +
			"<div class='zigbee_scan_select_container'></div>" +
			"<div class='bluetooth_scan_select_container'></div>" +
			"<div class='zigbee_device_ieee_container'></div>" +
			"<div class='zigbee_template_status_container'><div class='zigbee_template_status'></div><select id='known_zigbee_sensors'></select></div>" +
			"<div class='zigbee_cluster_template_container'></div>" +
			"<div class='zigbee_endpoint_cluster_attribute_container'></div>" +
			"<div class='zigbee_tuya_dp_container'></div>" +
			"<div class='bluetooth_char_uuid_container'></div>" +
			"<div class='bluetooth_format_container'></div>" +
			"<div class='stdlog_container'></div>" +
			"<select id='unitid'><option value='2' selected></option></select>" +
			"<button id='smt100id'></button>" +
			"<button id='fytasel'></button>" +
			"<button id='gardenasel'></button>" +
			"<button id='zigbeesel'></button>" +
			"<button id='bluetoothsel'></button>" +
			"</div>"
		).appendTo("body");

		OSApp.Analog.updateSensorVisibility(mockPopup, 92);

		assert.isTrue(mockPopup.find(".url_container").is(":visible"));
		assert.isTrue(mockPopup.find(".filter_container").is(":visible"));
		assert.equal("JSON Filter", mockPopup.find(".filter_container label").text());
		assert.isFalse(mockPopup.find(".topic_container").is(":visible"));

		mockPopup.remove();
	});
});