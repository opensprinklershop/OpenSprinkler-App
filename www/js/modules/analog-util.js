/**
 * analog-util.js - Utility functions for analog sensor management
 * Contains scanner functions for ZigBee and Bluetooth devices
 */

(function() {
	"use strict";

	// Initialize namespace
	OSApp.AnalogUtil = OSApp.AnalogUtil || {};

	/**
	 * Show ZigBee device scanner dialog
	 * @param {jQuery} popup - The sensor editor popup
	 * @param {Function} callback - Callback function called when device is selected
	 */
	OSApp.AnalogUtil.showZigBeeDeviceScanner = function(popup, callback) {
		// First, open the ZigBee network for pairing
		OSApp.Firmware.sendToOS("/zo?pw=&duration=60", "json").then(function () {
			var scanDialog = $("<div data-role='popup' data-theme='a' id='zigbeeScanner' data-dismissible='false'>" +
				"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._("ZigBee Device Scanner") + "</h1>" +
				"</div>" +
				"<div class='ui-content'>" +
				"<p class='rain-desc center smaller'>" +
				OSApp.Language._("Scanning for ZigBee devices...") + "<br>" +
				OSApp.Language._("Please pair your device now (60 seconds).") +
				"</p>" +
				"<div id='zigbeeDeviceList'></div>" +
				"<button class='close-scanner' data-theme='a'>" + OSApp.Language._("Cancel") + "</button>" +
				"</div>" +
				"</div>");

			var scanInterval = null;
			var selectedDevice = null;

			function updateDeviceList() {
				OSApp.Firmware.sendToOS("/zo?pw=", "json").then(function (data) {
					if (data && data.devices && data.devices.length > 0) {
						var listHtml = "<ul data-role='listview' data-inset='true'>";
						for (var i = 0; i < data.devices.length; i++) {
							var device = data.devices[i];
							var ieeeAddr = device.ieee_addr || device.ieee || "0x0000000000000000";
							var shortAddr = device.short_addr || device.short || "0x0000";
							var modelId = device.model_id || device.model || OSApp.Language._("Unknown");
							var manufacturer = device.manufacturer || OSApp.Language._("Unknown");
							var isNew = device.is_new ? " <span style='color: green;'>[" + OSApp.Language._("NEW") + "]</span>" : "";

							listHtml += "<li><a href='#' class='select-zigbee-device' data-ieee='" + ieeeAddr +
								"' data-short='" + shortAddr +
								"' data-model='" + modelId +
								"' data-manufacturer='" + manufacturer + "'>" +
								"<h3>" + modelId + isNew + "</h3>" +
								"<p><strong>IEEE:</strong> " + ieeeAddr + "</p>" +
								"<p><strong>" + OSApp.Language._("Manufacturer") + ":</strong> " + manufacturer + "</p>" +
								"<p><strong>" + OSApp.Language._("Short Address") + ":</strong> " + shortAddr + "</p>" +
								"</a></li>";
						}
						listHtml += "</ul>";
						scanDialog.find("#zigbeeDeviceList").html(listHtml).enhanceWithin();

						// Handle device selection
						scanDialog.find(".select-zigbee-device").on("click", function (e) {
							e.preventDefault();
							selectedDevice = {
								ieee: $(this).data("ieee"),
								short: $(this).data("short"),
								model: $(this).data("model"),
								manufacturer: $(this).data("manufacturer")
							};

							// Clear interval
							if (scanInterval) {
								clearInterval(scanInterval);
								scanInterval = null;
							}

							// Call zc to clear flags
							OSApp.Firmware.sendToOS("/zc?pw=", "json").then(function () {
								// Close scanner dialog
								scanDialog.popup("close");
								$("#zigbeeScanner").remove();

								// Call callback with selected device
								if (callback) {
									callback(selectedDevice);
								}
							});
						});
					} else {
						scanDialog.find("#zigbeeDeviceList").html(
							"<p class='center'>" + OSApp.Language._("No devices found yet. Please pair your device.") + "</p>"
						);
					}
				});
			}

			scanDialog.find(".close-scanner").on("click", function () {
				if (scanInterval) {
					clearInterval(scanInterval);
					scanInterval = null;
				}
				scanDialog.popup("close");
				$("#zigbeeScanner").remove();
			});

			scanDialog.on("popupafterclose", function () {
				if (scanInterval) {
					clearInterval(scanInterval);
					scanInterval = null;
				}
				$("#zigbeeScanner").remove();
			});

			$("#zigbeeScanner").remove();
			scanDialog.css("max-width", "580px");
			OSApp.UIDom.openPopup(scanDialog, { positionTo: "window" });

			// Update device list immediately
			updateDeviceList();

			// Update device list every second
			scanInterval = setInterval(updateDeviceList, 1000);
		}, function () {
			OSApp.Errors.showError(OSApp.Language._("Failed to start ZigBee scanning. Please ensure ZigBee is supported."));
		});
	};

	/**
	 * Show Bluetooth device scanner dialog
	 * @param {jQuery} popup - The sensor editor popup
	 * @param {Function} callback - Callback function called when device is selected
	 */
	OSApp.AnalogUtil.showBluetoothDeviceScanner = function(popup, callback) {
		// Start Bluetooth scanning (60 seconds)
		OSApp.Firmware.sendToOS("/bo?pw=&duration=60", "json").then(function () {
			var scanDialog = $("<div data-role='popup' data-theme='a' id='bluetoothScanner' data-dismissible='false'>" +
				"<div data-role='header' data-theme='b'>" +
				"<h1>" + OSApp.Language._("Bluetooth Device Scanner") + "</h1>" +
				"</div>" +
				"<div class='ui-content'>" +
				"<p class='rain-desc center smaller'>" +
				OSApp.Language._("Scanning for Bluetooth devices...") + "<br>" +
				OSApp.Language._("Please activate your device now (60 seconds).") +
				"</p>" +
				"<div id='bluetoothDeviceList'></div>" +
				"<button class='close-scanner' data-theme='a'>" + OSApp.Language._("Cancel") + "</button>" +
				"</div>" +
				"</div>");

			var scanInterval = null;
			var selectedDevice = null;

			function updateDeviceList() {
				OSApp.Firmware.sendToOS("/bo?pw=", "json").then(function (data) {
					if (data && data.devices && data.devices.length > 0) {
						var listHtml = "<ul data-role='listview' data-inset='true'>";
						for (var i = 0; i < data.devices.length; i++) {
							var device = data.devices[i];
							var macAddr = device.mac_addr || device.mac || "00:00:00:00:00:00";
							var name = device.name || OSApp.Language._("Unknown Device");
							var rssi = device.rssi || "N/A";
							var isNew = device.is_new ? " <span style='color: green;'>[" + OSApp.Language._("NEW") + "]</span>" : "";

							listHtml += "<li><a href='#' class='select-bluetooth-device' data-mac='" + macAddr +
								"' data-name='" + name +
								"' data-rssi='" + rssi + "'>" +
								"<h3>" + name + isNew + "</h3>" +
								"<p><strong>MAC:</strong> " + macAddr + "</p>" +
								"<p><strong>RSSI:</strong> " + rssi + " dBm</p>" +
								"</a></li>";
						}
						listHtml += "</ul>";
						scanDialog.find("#bluetoothDeviceList").html(listHtml).enhanceWithin();

						// Handle device selection
						scanDialog.find(".select-bluetooth-device").on("click", function (e) {
							e.preventDefault();
							selectedDevice = {
								mac: $(this).data("mac"),
								name: $(this).data("name"),
								rssi: $(this).data("rssi")
							};

							// Clear interval
							if (scanInterval) {
								clearInterval(scanInterval);
								scanInterval = null;
							}

							// Call bc to clear flags
							OSApp.Firmware.sendToOS("/bc?pw=", "json").then(function () {
								// Close scanner dialog
								scanDialog.popup("close");
								$("#bluetoothScanner").remove();

								// Call callback with selected device
								if (callback) {
									callback(selectedDevice);
								}
							});
						});
					} else {
						scanDialog.find("#bluetoothDeviceList").html(
							"<p class='center'>" + OSApp.Language._("No devices found yet. Please activate your device.") + "</p>"
						);
					}
				});
			}

			scanDialog.find(".close-scanner").on("click", function () {
				if (scanInterval) {
					clearInterval(scanInterval);
					scanInterval = null;
				}
				scanDialog.popup("close");
				$("#bluetoothScanner").remove();
			});

			scanDialog.on("popupafterclose", function () {
				if (scanInterval) {
					clearInterval(scanInterval);
					scanInterval = null;
				}
				$("#bluetoothScanner").remove();
			});

			$("#bluetoothScanner").remove();
			scanDialog.css("max-width", "580px");
			OSApp.UIDom.openPopup(scanDialog, { positionTo: "window" });

			// Update device list immediately
			updateDeviceList();

			// Update device list every second
			scanInterval = setInterval(updateDeviceList, 1000);
		}, function () {
			OSApp.Errors.showError(OSApp.Language._("Failed to start Bluetooth scanning. Please ensure Bluetooth is supported."));
		});
	};

})();
