/* global $ */

/* OpenSprinkler App
 * Copyright (C) 2015 - present, Samer Albahra. All rights reserved.
 *
 * This file is part of the OpenSprinkler project <http://opensprinkler.com>.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// Configure module
var OSApp = OSApp || {};
OSApp.ESP32Mode = OSApp.ESP32Mode || {};

/**
 * IEEE 802.15.4 Mode constants
 * These correspond to the ESP32-C5 operating modes stored in /ieee802154.json:
 *   0 = Disabled (IEEE 802.15.4 radio off)
 *   1 = Matter (HomeKit, Google Home, Alexa)
 *   2 = ZigBee Gateway (Coordinator — manage devices, receive sensor data)
 *   3 = ZigBee Client (End Device — join existing network e.g. Zigbee2MQTT)
 */
OSApp.ESP32Mode.MODE_DISABLED = 0;
OSApp.ESP32Mode.MODE_MATTER = 1;
OSApp.ESP32Mode.MODE_ZIGBEE_GATEWAY = 2;
OSApp.ESP32Mode.MODE_ZIGBEE_CLIENT = 3;

/**
 * Cached radio info from /ir endpoint
 * Updated by fetchRadioInfo()
 */
OSApp.ESP32Mode._radioInfo = null;

/**
 * Get the mode label for a given mode value
 */
OSApp.ESP32Mode.getModeLabel = function( mode ) {
	switch ( mode ) {
		case OSApp.ESP32Mode.MODE_DISABLED:
			return OSApp.Language._( "IEEE 802.15.4 Disabled" );
		case OSApp.ESP32Mode.MODE_MATTER:
			return OSApp.Language._( "Matter" );
		case OSApp.ESP32Mode.MODE_ZIGBEE_GATEWAY:
			return OSApp.Language._( "ZigBee Gateway" );
		case OSApp.ESP32Mode.MODE_ZIGBEE_CLIENT:
			return OSApp.Language._( "ZigBee Client" );
		default:
			return OSApp.Language._( "Unknown" );
	}
};

/**
 * Check if ESP32 feature is supported (feature string contains "ESP32")
 */
OSApp.ESP32Mode.isESP32Supported = function() {
	if ( !OSApp.currentSession.controller || !OSApp.currentSession.controller.options ) {
		return false;
	}

	var feature = OSApp.currentSession.controller.options.feature;
	if ( !feature ) {
		return false;
	}

	var featureStr = Array.isArray( feature ) ? feature.join( "," ) : String( feature );
	featureStr = featureStr.toUpperCase();

	return (
		featureStr.indexOf( "ESP32" ) !== -1 ||
		featureStr.indexOf( "IEEE802154" ) !== -1 ||
		featureStr.indexOf( "IEEE_802154" ) !== -1 ||
		featureStr.indexOf( "802.15.4" ) !== -1 ||
		featureStr.indexOf( "ZIGBEE" ) !== -1 ||
		featureStr.indexOf( "MATTER" ) !== -1
	);
};

/**
 * Check if Matter is available as an option (feature string contains "MATTER")
 */
OSApp.ESP32Mode.isMatterAvailable = function() {
	if ( !OSApp.currentSession.controller || !OSApp.currentSession.controller.options ) {
		return false;
	}

	var feature = OSApp.currentSession.controller.options.feature;
	if ( !feature ) {
		return false;
	}

	var featureStr = Array.isArray( feature ) ? feature.join( "," ) : String( feature );
	return featureStr.toUpperCase().indexOf( "MATTER" ) !== -1;
};

/**
 * Check if ZigBee is available as an option (feature string contains "ZIGBEE")
 */
OSApp.ESP32Mode.isZigBeeAvailable = function() {
	if ( !OSApp.currentSession.controller || !OSApp.currentSession.controller.options ) {
		return false;
	}

	var feature = OSApp.currentSession.controller.options.feature;
	if ( !feature ) {
		return false;
	}

	var featureStr = Array.isArray( feature ) ? feature.join( "," ) : String( feature );
	return featureStr.toUpperCase().indexOf( "ZIGBEE" ) !== -1;
};

/**
 * Fetch the current IEEE 802.15.4 radio configuration from the /ir endpoint.
 * Caches the result in _radioInfo.
 * Returns a jQuery Deferred that resolves with the radio info object:
 *   { activeMode, activeModeName, modes[], enabled, matter, zigbee, zigbee_gw, zigbee_client }
 */
OSApp.ESP32Mode.fetchRadioInfo = function() {
	var deferred = $.Deferred();

	OSApp.Firmware.sendToOS( "/ir?pw=", "json" ).done( function( data ) {
		if ( data && typeof data.activeMode !== "undefined" ) {
			OSApp.ESP32Mode._radioInfo = data;
			deferred.resolve( data );
		} else {
			deferred.reject();
		}
	} ).fail( function() {
		deferred.reject();
	} );

	return deferred.promise();
};

/**
 * Get the currently active IEEE 802.15.4 mode.
 * Uses cached _radioInfo if available, otherwise returns -1.
 * Returns the mode value (0-3) or -1 if not available.
 */
OSApp.ESP32Mode.getCurrentMode = function() {
	if ( OSApp.ESP32Mode._radioInfo && typeof OSApp.ESP32Mode._radioInfo.activeMode !== "undefined" ) {
		return OSApp.ESP32Mode._radioInfo.activeMode;
	}

	return -1;
};

/**
 * Check if the current mode is ZigBee Gateway
 */
OSApp.ESP32Mode.isZigBeeGatewayActive = function() {
	return OSApp.ESP32Mode.getCurrentMode() === OSApp.ESP32Mode.MODE_ZIGBEE_GATEWAY;
};

/**
 * Check if the current mode is ZigBee Client
 */
OSApp.ESP32Mode.isZigBeeClientActive = function() {
	return OSApp.ESP32Mode.getCurrentMode() === OSApp.ESP32Mode.MODE_ZIGBEE_CLIENT;
};

/**
 * Setup ESP32 Mode dialog — allows user to switch between IEEE 802.15.4 modes.
 * First fetches the current mode from /ir, then shows the selection popup.
 */
OSApp.ESP32Mode.setupESP32Mode = function() {
	$.mobile.loading( "show" );

	OSApp.ESP32Mode.fetchRadioInfo().done( function( radioInfo ) {
		$.mobile.loading( "hide" );
		OSApp.ESP32Mode.showESP32ModePopup( radioInfo );
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
	} );
};

/**
 * Display the ESP32 Mode selection popup
 */
OSApp.ESP32Mode.showESP32ModePopup = function( radioInfo ) {
	var currentMode = radioInfo.activeMode,
		currentLabel = OSApp.ESP32Mode.getModeLabel( currentMode ),
		content = "";

	content += "<div class='ui-content' role='main'>";
	content += "<p>" + OSApp.Language._( "Current IEEE 802.15.4 Mode" ) + ": <strong>" + currentLabel + "</strong></p>";
	content += "<p>" + OSApp.Language._( "Select the desired operating mode for the IEEE 802.15.4 radio" ) + ":</p>";
	content += "<fieldset data-role='controlgroup'>";

	// Option a) Disabled — always available
	content += "<label for='esp32-mode-disabled'>";
	content += "<input type='radio' name='esp32-mode' id='esp32-mode-disabled' value='" + OSApp.ESP32Mode.MODE_DISABLED + "'";
	if ( currentMode === OSApp.ESP32Mode.MODE_DISABLED ) {
		content += " checked='checked'";
	}
	content += "> " + OSApp.Language._( "IEEE 802.15.4 Disabled" );
	content += "</label>";

	// Option b) Matter — only if MATTER feature is available
	if ( OSApp.ESP32Mode.isMatterAvailable() ) {
		content += "<label for='esp32-mode-matter'>";
		content += "<input type='radio' name='esp32-mode' id='esp32-mode-matter' value='" + OSApp.ESP32Mode.MODE_MATTER + "'";
		if ( currentMode === OSApp.ESP32Mode.MODE_MATTER ) {
			content += " checked='checked'";
		}
		content += "> " + OSApp.Language._( "Matter" );
		content += " <em style='font-size:0.85em;color:#999'>( " + OSApp.Language._( "experimental / uncertified" ) + " )</em>";
		content += "</label>";
	}

	// Options c) + d) ZigBee Gateway & Client — only if ZIGBEE feature is available
	if ( OSApp.ESP32Mode.isZigBeeAvailable() ) {
		content += "<label for='esp32-mode-zigbee-gw'>";
		content += "<input type='radio' name='esp32-mode' id='esp32-mode-zigbee-gw' value='" + OSApp.ESP32Mode.MODE_ZIGBEE_GATEWAY + "'";
		if ( currentMode === OSApp.ESP32Mode.MODE_ZIGBEE_GATEWAY ) {
			content += " checked='checked'";
		}
		content += "> " + OSApp.Language._( "ZigBee Gateway" );
		content += "</label>";

		content += "<label for='esp32-mode-zigbee-cl'>";
		content += "<input type='radio' name='esp32-mode' id='esp32-mode-zigbee-cl' value='" + OSApp.ESP32Mode.MODE_ZIGBEE_CLIENT + "'";
		if ( currentMode === OSApp.ESP32Mode.MODE_ZIGBEE_CLIENT ) {
			content += " checked='checked'";
		}
		content += "> " + OSApp.Language._( "ZigBee Client" );
		content += " <em style='font-size:0.85em;color:#999'>( " + OSApp.Language._( "ZigBee Hub required" ) + " )</em>";
		content += "</label>";
	}

	content += "</fieldset>";
	content += "<button class='submit-esp32-mode ui-btn ui-btn-b ui-corner-all'>" + OSApp.Language._( "Apply Mode" ) + "</button>";
	content += "<button class='cancel-esp32-mode ui-btn ui-corner-all'>" + OSApp.Language._( "Cancel" ) + "</button>";
	content += "</div>";

	var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='esp32ModePopup'>" + content + "</div>" );

	// Cancel button closes the popup
	popup.on( "click", ".cancel-esp32-mode", function() {
		popup.popup( "close" );
		return false;
	} );

	popup.on( "click", ".submit-esp32-mode", function() {
		var selectedMode = parseInt( popup.find( "input[name='esp32-mode']:checked" ).val(), 10 );

		if ( selectedMode === currentMode ) {
			popup.popup( "close" );
			return;
		}

		// Close popup first, then show confirmation after close animation completes
		// (jQuery Mobile can only display one popup at a time)
		popup.popup( "close" );

		setTimeout( function() {
			OSApp.UIDom.areYouSure(
				OSApp.Language._( "Changing the IEEE 802.15.4 mode will reboot OpenSprinkler. Are you sure?" ),
				"",
				function() {
					OSApp.ESP32Mode.changeMode( selectedMode );
				}
			);
		}, 400 );
	} );

	OSApp.UIDom.openPopup( popup );
};

/**
 * Send mode change command to the controller.
 * Uses /iw?pw=&mode=X to set the mode, which triggers a device reboot after ~2 seconds.
 */
OSApp.ESP32Mode.changeMode = function( newMode ) {
	$.mobile.loading( "show" );

	OSApp.Firmware.sendToOS( "/iw?pw=&mode=" + newMode ).always( function() {
		$.mobile.loading( "hide" );

		// The device reboots immediately after receiving the mode change command,
		// so the connection will typically drop (fail handler). Show the reboot
		// notification in both success and failure cases.
		OSApp.Errors.showError( OSApp.Language._( "OpenSprinkler is rebooting now" ) );
	} );
};

/**
 * Setup ZigBee Gateway functionality.
 * Calls /zg?pw= (action=list) to get the device list and shows the management panel.
 */
OSApp.ESP32Mode.setupZigBeeGateway = function() {
	$.mobile.loading( "show" );

	OSApp.Firmware.sendToOS( "/zg?pw=", "json" ).done( function( data ) {
		$.mobile.loading( "hide" );

		if ( data && data.result === 1 ) {
			OSApp.ESP32Mode.showZigBeeGatewayPanel( data );
		} else {
			var errorMsg = ( data && data.error ) ? data.error : OSApp.Language._( "Unable to retrieve ZigBee Gateway information" );
			OSApp.Errors.showError( errorMsg );
		}
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
	} );
};

/**
 * Display the ZigBee Gateway management panel.
 * Shows the device list from /zg (action=list) response and a permit-join button.
 * Response format: { result:1, action:"list", devices:[ {ieee, short_addr, model, manufacturer, endpoint, device_id, is_new} ], count:N }
 */
OSApp.ESP32Mode.showZigBeeGatewayPanel = function( data ) {
	var content = "";

	content += "<div class='ui-content' role='main'>";
	content += "<h3>" + OSApp.Language._( "ZigBee Gateway" ) + "</h3>";

	// Show paired devices list
	if ( data.devices && data.devices.length > 0 ) {
		content += "<ul data-role='listview' data-inset='true'>";
		for ( var i = 0; i < data.devices.length; i++ ) {
			var dev = data.devices[ i ];
			content += "<li" + ( dev.is_new ? " data-theme='b'" : "" ) + ">";
			content += "<h4>" + ( dev.model || OSApp.Language._( "Unknown Device" ) ) + "</h4>";
			if ( dev.ieee ) {
				content += "<p>" + OSApp.Language._( "IEEE Address" ) + ": " + dev.ieee + "</p>";
			}
			if ( dev.manufacturer ) {
				content += "<p>" + OSApp.Language._( "Manufacturer" ) + ": " + dev.manufacturer + "</p>";
			}
			content += "<p class='ui-li-aside'>" + OSApp.Language._( "Endpoint" ) + ": " + dev.endpoint + "</p>";
			content += "</li>";
		}
		content += "</ul>";
	} else {
		content += "<p>" + OSApp.Language._( "No ZigBee devices paired" ) + "</p>";
	}

	// Permit join button
	content += "<button class='zigbee-permit-join ui-btn ui-btn-b ui-corner-all'>" + OSApp.Language._( "Allow ZigBee Pairing" ) + "</button>";
	content += "<button class='cancel-zigbee-gw ui-btn ui-corner-all'>" + OSApp.Language._( "Cancel" ) + "</button>";
	content += "</div>";

	var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='zigbeeGatewayPopup'>" + content + "</div>" );

	popup.on( "click", ".cancel-zigbee-gw", function() {
		popup.popup( "close" );
		return false;
	} );

	popup.on( "click", ".zigbee-permit-join", function() {
		popup.popup( "close" );
		OSApp.ESP32Mode.zigBeePermitJoin();
		return false;
	} );

	OSApp.UIDom.openPopup( popup );
};

/**
 * Send permit-join command to open the ZigBee network for pairing.
 * Uses /zg?pw=&action=permit&duration=60
 */
OSApp.ESP32Mode.zigBeePermitJoin = function() {
	$.mobile.loading( "show" );

	OSApp.Firmware.sendToOS( "/zg?pw=&action=permit&duration=60", "json" ).done( function( data ) {
		$.mobile.loading( "hide" );
		if ( data && data.result === 1 ) {
			OSApp.Errors.showError( OSApp.Language._( "ZigBee pairing mode enabled for 60 seconds" ) );
		} else {
			OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
		}
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
	} );
};

/**
 * Setup ZigBee Client functionality.
 * Calls /zs?pw= to get the connection status and shows the client panel.
 */
OSApp.ESP32Mode.setupZigBeeClient = function() {
	$.mobile.loading( "show" );

	OSApp.Firmware.sendToOS( "/zs?pw=", "json" ).done( function( data ) {
		$.mobile.loading( "hide" );

		if ( data && data.result === 1 ) {
			OSApp.ESP32Mode.showZigBeeClientPanel( data );
		} else {
			var errorMsg = ( data && data.error ) ? data.error : OSApp.Language._( "Unable to retrieve ZigBee Client information" );
			OSApp.Errors.showError( errorMsg );
		}
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
	} );
};

/**
 * Display the ZigBee Client status panel.
 * Uses /zs response: { result:1, active:0|1, connected:0|1, mode:"client" }
 */
OSApp.ESP32Mode.showZigBeeClientPanel = function( data ) {
	var content = "";

	content += "<div class='ui-content' role='main'>";
	content += "<h3>" + OSApp.Language._( "ZigBee Client" ) + "</h3>";

	// Show connection status (data.active, data.connected from /zs)
	if ( data.connected ) {
		content += "<p><strong>" + OSApp.Language._( "Status" ) + ":</strong> " + OSApp.Language._( "Connected to ZigBee network" ) + "</p>";
	} else {
		content += "<p><strong>" + OSApp.Language._( "Status" ) + ":</strong> " + OSApp.Language._( "Not connected to ZigBee network" ) + "</p>";
	}

	// Join/Search network button (uses /zj endpoint)
	if ( !data.connected ) {
		content += "<button class='zigbee-join-network ui-btn ui-btn-b ui-corner-all'>" + OSApp.Language._( "Join ZigBee Network" ) + "</button>";
	}

	content += "<button class='cancel-zigbee-cl ui-btn ui-corner-all'>" + OSApp.Language._( "Cancel" ) + "</button>";
	content += "</div>";

	var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='zigbeeClientPopup'>" + content + "</div>" );

	popup.on( "click", ".cancel-zigbee-cl", function() {
		popup.popup( "close" );
		return false;
	} );

	popup.on( "click", ".zigbee-join-network", function() {
		popup.popup( "close" );
		OSApp.ESP32Mode.zigBeeJoinNetwork();
		return false;
	} );

	OSApp.UIDom.openPopup( popup );
};

/**
 * Send command to join/search for a ZigBee network (client mode).
 * Uses /zj?pw=&duration=60
 * Note: This triggers a factory reset and re-join attempt.
 */
OSApp.ESP32Mode.zigBeeJoinNetwork = function() {
	$.mobile.loading( "show" );

	OSApp.Firmware.sendToOS( "/zj?pw=&duration=60", "json" ).done( function( data ) {
		$.mobile.loading( "hide" );
		if ( data && data.result === 1 ) {
			OSApp.Errors.showError( OSApp.Language._( "Attempting to join ZigBee network..." ) );
		} else {
			var errorMsg = ( data && data.error ) ? data.error : OSApp.Language._( "Error connecting to device" );
			OSApp.Errors.showError( errorMsg );
		}
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
	} );
};

// ============================================================================
// Matter Integration
// ============================================================================

/**
 * Check if Matter mode is currently active (activeMode === 1)
 */
OSApp.ESP32Mode.isMatterActive = function() {
	return OSApp.ESP32Mode.getCurrentMode() === OSApp.ESP32Mode.MODE_MATTER;
};

/**
 * Check if Matter feature is supported (feature string contains "MATTER")
 */
OSApp.ESP32Mode.isMatterSupported = function() {
	return OSApp.ESP32Mode.isMatterAvailable();
};

/**
 * Setup Matter — opens the Matter QR code / pairing information.
 * Calls /jm?pw= to retrieve Matter commissioning data.
 */
OSApp.ESP32Mode.setupMatter = function() {
	$.mobile.loading( "show" );

	OSApp.Firmware.sendToOS( "/jm?pw=", "json" ).done( function( data ) {
		$.mobile.loading( "hide" );

		if ( data && data.qr_url ) {
			// Open the QR code URL in the in-app browser or new window
			if ( typeof cordova !== "undefined" && cordova.InAppBrowser ) {
				// For mobile apps, use InAppBrowser
				cordova.InAppBrowser.open( data.qr_url, "_blank", "location=yes" );
			} else {
				// For web browsers, open in new tab
				window.open( data.qr_url, "_blank" );
			}
		} else {
			OSApp.Errors.showError( OSApp.Language._( "Unable to retrieve Matter setup information" ) );
		}
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
	} );
};
