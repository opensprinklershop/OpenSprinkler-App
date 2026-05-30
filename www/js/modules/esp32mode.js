/* global $, md5 */

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
OSApp.ESP32Mode._radioInfoRequest = null;
OSApp.ESP32Mode._radioInfoRequestId = 0;

/**
 * Cached debug info from /db endpoint
 * Updated by fetchDebugInfo()
 */
OSApp.ESP32Mode._debugInfo = null;

OSApp.ESP32Mode.clearRadioInfo = function() {
	OSApp.ESP32Mode._radioInfo = null;
	OSApp.ESP32Mode._radioInfoRequest = null;
	OSApp.ESP32Mode._radioInfoRequestId++;
};

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
		featureStr.indexOf( "802.15.4" ) !== -1
	);
};

/**
 * Check if RainMaker feature is supported (feature string contains "RAINMAKER")
 */
OSApp.ESP32Mode.isRainMakerSupported = function() {
	if ( !OSApp.currentSession.controller || !OSApp.currentSession.controller.options ) {
		return false;
	}

	var feature = OSApp.currentSession.controller.options.feature;
	if ( !feature ) {
		return false;
	}

	var featureStr = Array.isArray( feature ) ? feature.join( "," ) : String( feature );
	return featureStr.toUpperCase().indexOf( "RAINMAKER" ) !== -1;
};


/**
 * Fetch the current IEEE 802.15.4 radio configuration from the /ir endpoint.
 * Caches the result in _radioInfo.
 * Returns a jQuery Deferred that resolves with the radio info object:
 *   { activeMode, activeModeName, modes[], enabled, matter, zigbee, zigbee_gw, zigbee_client }
 */
OSApp.ESP32Mode.fetchRadioInfo = function( forceRefresh ) {
	var deferred = $.Deferred();

	if ( forceRefresh ) {
		OSApp.ESP32Mode.clearRadioInfo();
	}

	// Return cached data immediately if available and not forced refresh
	if ( !forceRefresh && OSApp.ESP32Mode._radioInfo !== null ) {
		deferred.resolve( OSApp.ESP32Mode._radioInfo );
		return deferred.promise();
	}

	if ( !forceRefresh && OSApp.ESP32Mode._radioInfoRequest !== null ) {
		return OSApp.ESP32Mode._radioInfoRequest;
	}

	var requestId = OSApp.ESP32Mode._radioInfoRequestId;
	OSApp.ESP32Mode._radioInfoRequest = deferred.promise();
	OSApp.Firmware.sendToOS( "/ir?pw=&verbose=0", "json" ).done( function( data ) {
		if ( requestId !== OSApp.ESP32Mode._radioInfoRequestId ) {
			deferred.reject();
			return;
		}
		if ( data && typeof data.activeMode !== "undefined" ) {
			OSApp.ESP32Mode._radioInfo = data;
			deferred.resolve( data );
		} else {
			deferred.reject();
		}
	} ).fail( function() {
		deferred.reject();
	} ).always( function() {
		if ( requestId === OSApp.ESP32Mode._radioInfoRequestId ) {
			OSApp.ESP32Mode._radioInfoRequest = null;
		}
	} );

	return deferred.promise();
};

OSApp.ESP32Mode.prefetchRadioInfo = function() {
	if ( OSApp.ESP32Mode.isESP32Supported() ) {
		OSApp.ESP32Mode.fetchRadioInfo( false ).fail( function() {} );
	}
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
 * Fetch the current debug info from the /db endpoint.
 * Used to detect whether the controller is currently on Ethernet.
 */
OSApp.ESP32Mode.fetchDebugInfo = function( forceRefresh ) {
	var deferred = $.Deferred();

	if ( !forceRefresh && OSApp.ESP32Mode._debugInfo !== null ) {
		deferred.resolve( OSApp.ESP32Mode._debugInfo );
		return deferred.promise();
 	}

	OSApp.Firmware.sendToOS( "/db?pw=", "json" ).done( function( data ) {
		OSApp.ESP32Mode._debugInfo = data || null;
		deferred.resolve( data || null );
	} ).fail( function() {
		deferred.resolve( null );
	} );

	return deferred.promise();
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
 * Check whether the connected firmware supports the in-app ZigBee gateway
 * device editor / scanner / DB-driven device profiles. Available from
 * firmware 2.4.0 build 203 and later, AND only if the editor UI is loaded.
 */
OSApp.ESP32Mode.supportsZigBeeGatewayDeviceEditor = function() {
	if ( typeof OSApp.ESP32Mode.showZigBeeDeviceEditor !== "function" ) {
		return false;
	}
	if ( !OSApp.currentSession || !OSApp.currentSession.controller || !OSApp.currentSession.controller.options ) {
		return false;
	}
	var opts = OSApp.currentSession.controller.options;
	var fwv = parseInt( opts.fwv, 10 ) || 0;
	var fwm = parseInt( opts.fwm, 10 ) || 0;
	if ( fwv > 240 ) { return true; }
	if ( fwv === 240 && fwm >= 203 ) { return true; }
	return false;
};

/**
 * Setup ESP32 Mode dialog — allows user to switch between IEEE 802.15.4 modes.
 * First fetches the current mode from /ir, then shows the selection popup.
 */
OSApp.ESP32Mode.setupESP32Mode = function() {
	$.mobile.loading( "show" );

	var certDeferred = $.Deferred();
	OSApp.Firmware.sendToOS( "/tg?pw=", "json" ).done( function( data ) {
		certDeferred.resolve( data );
	} ).fail( function() {
		certDeferred.resolve( null );
	} );

	var acmeDeferred = $.Deferred();
	OSApp.Firmware.sendToOS( "/ta?pw=", "json" ).done( function( data ) {
		acmeDeferred.resolve( data );
	} ).fail( function() {
		acmeDeferred.resolve( null );
	} );

	var debugDeferred = $.Deferred();
	OSApp.ESP32Mode.fetchDebugInfo( false ).done( function( debugInfo ) {
		debugDeferred.resolve( debugInfo );
	} ).fail( function() {
		debugDeferred.resolve( null );
	} );

	OSApp.ESP32Mode.fetchRadioInfo( false ).done( function( radioInfo ) {
		$.when( certDeferred, acmeDeferred, debugDeferred ).done( function( certInfo, acmeInfo, debugInfo ) {
			$.mobile.loading( "hide" );
			OSApp.ESP32Mode.showESP32ModePopup( radioInfo, certInfo, acmeInfo, debugInfo );
		} );
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
	} );
};

/**
 * Display the ESP32 Mode / HTTPS Certificate tabbed popup
 */
OSApp.ESP32Mode.showESP32ModePopup = function( radioInfo, certInfo, acmeInfo, debugInfo ) {
	var currentMode = radioInfo.activeMode,
		currentLabel = OSApp.ESP32Mode.getModeLabel( currentMode ),
		isEth = !!( debugInfo && debugInfo.ETH ),
		gatewayAllowed = isEth || currentMode === OSApp.ESP32Mode.MODE_ZIGBEE_GATEWAY,
		isCustom = certInfo && certInfo.type === "custom",
		isAcme = certInfo && certInfo.type === "acme",
		content = "";

	content += "<div class='ui-content' role='main' style='max-width:500px;'>";

	// Tab navigation
	content += "<ul class='tabs'>";
	content += "<li class='current' data-tab='esp32-tab-mode'>" + OSApp.Language._( "IEEE 802.15.4 Mode" ) + "</li>";
	content += "<li data-tab='esp32-tab-cert'>" + OSApp.Language._( "HTTPS Certificate" ) + "</li>";
	content += "</ul>";

	// ── Tab 1: Mode selector ──────────────────────────────────────────────────
	content += "<div id='esp32-tab-mode' class='tab-content current' style='width:auto;'>";
	content += "<p>" + OSApp.Language._( "Current IEEE 802.15.4 Mode" ) + ": <strong>" + currentLabel + "</strong></p>";
	content += "<p>" + OSApp.Language._( "Select the desired operating mode for the IEEE 802.15.4 radio" ) + ":</p>";
	if ( !isEth ) {
		content += "<div style='margin:8px 0;padding:8px 10px;background:#fff3cd;border:1px solid #f0c36d;border-radius:4px;color:#8a5a00;font-size:0.9em;'>" +
			OSApp.Language._( "ZigBee Gateway requires Ethernet. If the controller is connected over WiFi, only Matter or ZigBee Client can be selected." ) +
			"</div>";
	}
	content += "<fieldset data-role='controlgroup'>";

	content += "<label for='esp32-mode-disabled'>";
	content += "<input type='radio' name='esp32-mode' id='esp32-mode-disabled' value='" + OSApp.ESP32Mode.MODE_DISABLED + "'";
	if ( currentMode === OSApp.ESP32Mode.MODE_DISABLED ) { content += " checked='checked'"; }
	content += "> " + OSApp.Language._( "IEEE 802.15.4 Disabled" );
	content += "</label>";

	content += "<label for='esp32-mode-matter'>";
	content += "<input type='radio' name='esp32-mode' id='esp32-mode-matter' value='" + OSApp.ESP32Mode.MODE_MATTER + "'";
	if ( currentMode === OSApp.ESP32Mode.MODE_MATTER ) { content += " checked='checked'"; }
	content += "> " + OSApp.Language._( "Matter" );
	content += " <em style='font-size:0.85em;color:#999'>( " + OSApp.Language._( "experimental / uncertified" ) + " )</em>";
	content += "</label>";

	content += "<label for='esp32-mode-zigbee-gw'>";
	content += "<input type='radio' name='esp32-mode' id='esp32-mode-zigbee-gw' value='" + OSApp.ESP32Mode.MODE_ZIGBEE_GATEWAY + "'";
	if ( currentMode === OSApp.ESP32Mode.MODE_ZIGBEE_GATEWAY ) { content += " checked='checked'"; }
	if ( !gatewayAllowed ) { content += " disabled='disabled'"; }
	content += "> " + OSApp.Language._( "ZigBee Gateway" );
	content += " <em style='font-size:0.85em;color:#999'>( " + OSApp.Language._( "Ethernet required" ) + " )</em>";
	content += "</label>";

	content += "<label for='esp32-mode-zigbee-cl'>";
	content += "<input type='radio' name='esp32-mode' id='esp32-mode-zigbee-cl' value='" + OSApp.ESP32Mode.MODE_ZIGBEE_CLIENT + "'";
	if ( currentMode === OSApp.ESP32Mode.MODE_ZIGBEE_CLIENT ) { content += " checked='checked'"; }
	content += "> " + OSApp.Language._( "ZigBee Client" );
	content += " <em style='font-size:0.85em;color:#999'>( " + OSApp.Language._( "ZigBee Hub required" ) + " )</em>";
	content += "</label>";

	content += "</fieldset>";
	content += "<button class='submit-esp32-mode ui-btn ui-btn-b ui-corner-all'>" + OSApp.Language._( "Apply Mode" ) + "</button>";
	content += "</div>"; // end esp32-tab-mode

	// ── Tab 2: HTTPS Certificate ──────────────────────────────────────────────
	content += "<div id='esp32-tab-cert' class='tab-content' style='width:auto;'>";
	if ( certInfo ) {
		content += "<div style='background:#f5f5f5;padding:8px;border-radius:4px;margin-bottom:10px;font-size:0.9em;'>";
		content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Type" ) + ":</b> " +
			( isCustom ? OSApp.Language._( "Custom" ) : OSApp.Language._( "Internal (built-in)" ) ) + "</p>";
		if ( certInfo.subject ) {
			content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Subject" ) + ":</b> " + $( "<span>" ).text( certInfo.subject ).html() + "</p>";
		}
		if ( certInfo.issuer ) {
			content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Issuer" ) + ":</b> " + $( "<span>" ).text( certInfo.issuer ).html() + "</p>";
		}
		if ( certInfo.not_before ) {
			content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Valid from" ) + ":</b> " + $( "<span>" ).text( certInfo.not_before ).html() + "</p>";
		}
		if ( certInfo.not_after ) {
			content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Valid until" ) + ":</b> " + $( "<span>" ).text( certInfo.not_after ).html() + "</p>";
		}
		content += "</div>";

		content += "<fieldset data-role='controlgroup'>";
		content += "<legend>" + OSApp.Language._( "Certificate Mode" ) + "</legend>";
		content += "<label for='cert-mode-internal'>";
		content += "<input type='radio' name='cert-mode' id='cert-mode-internal' value='internal'";
		if ( !isCustom && !isAcme ) { content += " checked='checked'"; }
		content += "> " + OSApp.Language._( "Internal (built-in)" );
		content += "</label>";
		content += "<label for='cert-mode-custom'>";
		content += "<input type='radio' name='cert-mode' id='cert-mode-custom' value='custom'";
		if ( isCustom ) { content += " checked='checked'"; }
		content += "> " + OSApp.Language._( "Custom Certificate" );
		content += "</label>";
		content += "<label for='cert-mode-acme'>";
		content += "<input type='radio' name='cert-mode' id='cert-mode-acme' value='acme'";
		if ( isAcme ) { content += " checked='checked'"; }
		content += "> " + OSApp.Language._( "Let's Encrypt" );
		content += "</label>";
		content += "</fieldset>";

		content += "<div id='cert-pem-editor' style='" + ( isCustom ? "" : "display:none;" ) + "'>";
		content += "<label for='cert-pem-cert'><b>" + OSApp.Language._( "Certificate (PEM)" ) + ":</b></label>";
		content += "<textarea id='cert-pem-cert' rows='6' style='font-family:monospace;font-size:0.8em;width:100%;' " +
			"placeholder='-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----'></textarea>";
		content += "<label for='cert-pem-key'><b>" + OSApp.Language._( "Private Key (PEM)" ) + ":</b></label>";
		content += "<textarea id='cert-pem-key' rows='6' style='font-family:monospace;font-size:0.8em;width:100%;' " +
			"placeholder='-----BEGIN EC PRIVATE KEY-----&#10;...&#10;-----END EC PRIVATE KEY-----'></textarea>";
		content += "<div style='margin:8px 0;'>";
		content += "<label class='ui-btn ui-btn-inline ui-mini ui-icon-arrow-u ui-btn-icon-left'>" +
			OSApp.Language._( "Load Cert File" ) +
			"<input type='file' id='cert-file-input' accept='.pem,.crt,.cer' style='display:none;'>" +
			"</label> ";
		content += "<label class='ui-btn ui-btn-inline ui-mini ui-icon-arrow-u ui-btn-icon-left'>" +
			OSApp.Language._( "Load Key File" ) +
			"<input type='file' id='key-file-input' accept='.pem,.key' style='display:none;'>" +
			"</label>";
		content += "</div>";
		content += "<button class='cert-upload-btn ui-btn ui-btn-b ui-corner-all'>" +
			OSApp.Language._( "Upload Certificate" ) + "</button>";
		content += "</div>"; // end cert-pem-editor

		// ACME / Let's Encrypt config
		content += "<div id='cert-acme-editor' style='" + ( isAcme ? "" : "display:none;" ) + "'>";

		// ACME status display
		if ( acmeInfo ) {
			var statusLabels = [
				OSApp.Language._( "Not configured" ),
				OSApp.Language._( "Configured" ),
				OSApp.Language._( "Requesting certificate..." ),
				OSApp.Language._( "Active" ),
				OSApp.Language._( "Renewal due" ),
				OSApp.Language._( "Error" )
			];
			var statusClass = acmeInfo.status === 5 ? "color:#c00;" : ( acmeInfo.status === 3 ? "color:#090;" : "" );
			content += "<div style='background:#f5f5f5;padding:8px;border-radius:4px;margin-bottom:10px;font-size:0.9em;'>";
			content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "ACME Status" ) + ":</b> " +
				"<span style='" + statusClass + "'>" + ( statusLabels[ acmeInfo.status ] || "?" ) + "</span></p>";
			if ( acmeInfo.days_left >= 0 ) {
				content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Days until expiry" ) + ":</b> " + acmeInfo.days_left + "</p>";
			}
			if ( acmeInfo.error ) {
				content += "<p style='margin:2px 0;color:#c00;'><b>" + OSApp.Language._( "Error" ) + ":</b> " +
					$( "<span>" ).text( acmeInfo.error ).html() + "</p>";
			}
			content += "</div>";
		}

		content += "<p style='font-size:0.9em;color:#666;margin-bottom:10px;'>" +
			OSApp.Language._( "Automatically obtain and renew a free TLS certificate from Let's Encrypt. Your device must be reachable on port 80 from the internet." ) + "</p>";
		content += "<label for='acme-domain'><b>" + OSApp.Language._( "Domain" ) + ":</b></label>";
		content += "<input type='text' id='acme-domain' value='" + ( acmeInfo && acmeInfo.domain ? $( "<span>" ).text( acmeInfo.domain ).html() : "" ) +
			"' placeholder='sprinkler.example.com' data-mini='true'>";
		content += "<label for='acme-email'><b>" + OSApp.Language._( "E-Mail" ) + ":</b></label>";
		content += "<input type='email' id='acme-email' value='" + ( acmeInfo && acmeInfo.email ? $( "<span>" ).text( acmeInfo.email ).html() : "" ) +
			"' placeholder='admin@example.com' data-mini='true'>";
		content += "<label for='acme-server'><b>" + OSApp.Language._( "ACME Server" ) + ":</b></label>";
		content += "<select id='acme-server' data-mini='true'>";
		var currentServer = acmeInfo && acmeInfo.server ? acmeInfo.server : "";
		content += "<option value='https://acme-v02.api.letsencrypt.org/directory'" +
			( currentServer.indexOf( "staging" ) < 0 ? " selected" : "" ) + ">" +
			OSApp.Language._( "Production" ) + " (Let's Encrypt)</option>";
		content += "<option value='https://acme-staging-v02.api.letsencrypt.org/directory'" +
			( currentServer.indexOf( "staging" ) >= 0 ? " selected" : "" ) + ">" +
			OSApp.Language._( "Staging" ) + " (" + OSApp.Language._( "Testing" ) + ")</option>";
		content += "</select>";
		content += "<button class='acme-save-btn ui-btn ui-btn-b ui-corner-all'>" +
			OSApp.Language._( "Save & Request Certificate" ) + "</button>";
		if ( isAcme ) {
			content += "<button class='acme-delete-btn ui-btn ui-btn-c ui-corner-all' style='color:#c00;'>" +
				OSApp.Language._( "Delete ACME Data" ) + "</button>";
		}
		content += "</div>"; // end cert-acme-editor

		if ( isCustom ) {
			content += "<button class='cert-delete-btn ui-btn ui-btn-c ui-corner-all' style='color:#c00;'>" +
				OSApp.Language._( "Revert to Internal Certificate" ) + "</button>";
		}
	} else {
		content += "<p>" + OSApp.Language._( "Certificate information not available" ) + "</p>";
	}
	content += "</div>"; // end esp32-tab-cert

	// Shared close button
	content += "<button class='cancel-esp32-mode ui-btn ui-corner-all'>" + OSApp.Language._( "Close" ) + "</button>";
	content += "</div>"; // end ui-content

	var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='esp32ModePopup'>" + content + "</div>" );

	// Tab switching
	popup.on( "click", "ul.tabs li", function() {
		var tabId = $( this ).attr( "data-tab" );
		popup.find( "ul.tabs li" ).removeClass( "current" );
		popup.find( ".tab-content" ).removeClass( "current" );
		$( this ).addClass( "current" );
		popup.find( "#" + tabId ).addClass( "current" );
	} );

	// Close button
	popup.on( "click", ".cancel-esp32-mode", function() {
		popup.popup( "close" );
		return false;
	} );

	// Apply mode
	popup.on( "click", ".submit-esp32-mode", function() {
		var selectedMode = parseInt( popup.find( "input[name='esp32-mode']:checked" ).val(), 10 );

		if ( isNaN( selectedMode ) ) {
			OSApp.Errors.showError( OSApp.Language._( "No valid mode selected" ) );
			return;
		}

		if ( selectedMode === currentMode ) {
			popup.popup( "close" );
			return;
		}

		if ( selectedMode === OSApp.ESP32Mode.MODE_ZIGBEE_GATEWAY && !isEth ) {
			OSApp.Errors.showError( OSApp.Language._( "ZigBee Gateway requires Ethernet. Connect the controller with Ethernet first, or choose ZigBee Client instead." ) );
			return;
		}

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

	// Cert tab: toggle PEM editor / ACME editor
	popup.on( "change", "input[name='cert-mode']", function() {
		var mode = $( this ).val();
		if ( mode === "custom" ) {
			popup.find( "#cert-pem-editor" ).show();
			popup.find( "#cert-acme-editor" ).hide();
		} else if ( mode === "acme" ) {
			popup.find( "#cert-pem-editor" ).hide();
			popup.find( "#cert-acme-editor" ).show();
		} else {
			popup.find( "#cert-pem-editor" ).hide();
			popup.find( "#cert-acme-editor" ).hide();
		}
	} );

	// Cert tab: file inputs
	popup.on( "change", "#cert-file-input", function() {
		var file = this.files[ 0 ];
		if ( !file ) { return; }
		var reader = new FileReader();
		reader.onload = function( e ) { popup.find( "#cert-pem-cert" ).val( e.target.result ); };
		reader.readAsText( file );
	} );

	popup.on( "change", "#key-file-input", function() {
		var file = this.files[ 0 ];
		if ( !file ) { return; }
		var reader = new FileReader();
		reader.onload = function( e ) { popup.find( "#cert-pem-key" ).val( e.target.result ); };
		reader.readAsText( file );
	} );

	// Cert tab: Upload & Validate
	// Uses POST to avoid the 1536-byte URL length limit on ESP32 hardware servers.
	// Password is kept in the URL query string; cert/key go in the request body.
	popup.on( "click", ".cert-upload-btn", function() {
		var certPem = popup.find( "#cert-pem-cert" ).val().trim(),
			keyPem = popup.find( "#cert-pem-key" ).val().trim();

		if ( !certPem || !keyPem ) {
			OSApp.Errors.showError( OSApp.Language._( "Please provide both certificate and private key in PEM format" ) );
			return;
		}
		if ( certPem.indexOf( "-----BEGIN CERTIFICATE-----" ) < 0 ) {
			OSApp.Errors.showError( OSApp.Language._( "Invalid certificate format. Must be PEM encoded." ) );
			return;
		}
		if ( keyPem.indexOf( "-----BEGIN" ) < 0 || keyPem.indexOf( "PRIVATE KEY-----" ) < 0 ) {
			OSApp.Errors.showError( OSApp.Language._( "Invalid key format. Must be PEM encoded private key." ) );
			return;
		}

		$.mobile.loading( "show" );

		var pass = encodeURIComponent( OSApp.currentSession.pass ),
			urlBase = OSApp.currentSession.token
				? "https://cloud.openthings.io/forward/v1/" + OSApp.currentSession.token
				: OSApp.currentSession.prefix + OSApp.currentSession.ip,
			ajaxCfg = {
				url: urlBase + "/tl?pw=" + pass,
				type: "POST",
				data: "cert=" + encodeURIComponent( certPem ) + "&key=" + encodeURIComponent( keyPem ),
				contentType: "application/x-www-form-urlencoded",
				dataType: "json",
				timeout: 30000
			};

		if ( OSApp.currentSession.auth ) {
			ajaxCfg.headers = { Authorization: "Basic " + btoa( OSApp.currentSession.authUser + ":" + OSApp.currentSession.authPass ) };
		}

		$.ajax( ajaxCfg ).done( function( resp ) {
			$.mobile.loading( "hide" );
			if ( resp && resp.result === 1 ) {
				popup.popup( "close" );
				setTimeout( function() {
					OSApp.UIDom.areYouSure(
						OSApp.Language._( "Certificate uploaded successfully. A reboot is required to apply the new certificate. Reboot now?" ),
						"",
						function() {
							OSApp.Firmware.sendToOS( "/cv?pw=&rbt=1" );
							OSApp.Errors.showError( OSApp.Language._( "OpenSprinkler is rebooting now" ) );
						}
					);
				}, 400 );
			} else {
				OSApp.Errors.showError( resp && resp.error ? resp.error : OSApp.Language._( "Certificate validation failed" ) );
			}
		} ).fail( function() {
			$.mobile.loading( "hide" );
			OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
		} );
		return false;
	} );

	// Cert tab: Revert to internal certificate
	popup.on( "click", ".cert-delete-btn", function() {
		popup.popup( "close" );
		setTimeout( function() {
			OSApp.UIDom.areYouSure(
				OSApp.Language._( "Revert to the internal (built-in) certificate? A reboot will be required." ),
				"",
				function() {
					$.mobile.loading( "show" );
					OSApp.Firmware.sendToOS( "/td?pw=", "json" ).done( function( resp ) {
						$.mobile.loading( "hide" );
						if ( resp && resp.result === 1 ) {
							OSApp.UIDom.areYouSure(
								OSApp.Language._( "Custom certificate removed. Reboot now to apply?" ),
								"",
								function() {
									OSApp.Firmware.sendToOS( "/cv?pw=&rbt=1" );
									OSApp.Errors.showError( OSApp.Language._( "OpenSprinkler is rebooting now" ) );
								}
							);
						} else {
							OSApp.Errors.showError( OSApp.Language._( "Failed to remove certificate" ) );
						}
					} ).fail( function() {
						$.mobile.loading( "hide" );
						OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
					} );
				}
			);
		}, 400 );
		return false;
	} );

	// ACME: Save & Request Certificate
	popup.on( "click", ".acme-save-btn", function() {
		var domain = popup.find( "#acme-domain" ).val().trim(),
			email = popup.find( "#acme-email" ).val().trim(),
			server = popup.find( "#acme-server" ).val();

		if ( !domain || domain.length < 3 ) {
			OSApp.Errors.showError( OSApp.Language._( "Please enter a valid domain name" ) );
			return;
		}
		if ( !email || email.indexOf( "@" ) < 1 ) {
			OSApp.Errors.showError( OSApp.Language._( "Please enter a valid e-mail address" ) );
			return;
		}

		$.mobile.loading( "show" );

		var pass = encodeURIComponent( OSApp.currentSession.pass ),
			urlBase = OSApp.currentSession.token
				? "https://cloud.openthings.io/forward/v1/" + OSApp.currentSession.token
				: OSApp.currentSession.prefix + OSApp.currentSession.ip,
			ajaxCfg = {
				url: urlBase + "/tc?pw=" + pass,
				type: "POST",
				data: "domain=" + encodeURIComponent( domain ) + "&email=" + encodeURIComponent( email ) +
					"&server=" + encodeURIComponent( server ) + "&enabled=1&request=1",
				contentType: "application/x-www-form-urlencoded",
				dataType: "json",
				timeout: 30000
			};

		if ( OSApp.currentSession.auth ) {
			ajaxCfg.headers = { Authorization: "Basic " + btoa( OSApp.currentSession.authUser + ":" + OSApp.currentSession.authPass ) };
		}

		$.ajax( ajaxCfg ).done( function( resp ) {
			$.mobile.loading( "hide" );
			if ( resp && resp.result === 1 ) {
				popup.popup( "close" );
				setTimeout( function() {
					OSApp.Errors.showError(
						OSApp.Language._( "Certificate request started. This may take up to 2 minutes. The device must be reachable on port 80 from the internet during this process." )
					);
				}, 400 );
			} else {
				OSApp.Errors.showError( resp && resp.error ? resp.error : OSApp.Language._( "Failed to save ACME configuration" ) );
			}
		} ).fail( function() {
			$.mobile.loading( "hide" );
			OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
		} );
		return false;
	} );

	// ACME: Delete all ACME data
	popup.on( "click", ".acme-delete-btn", function() {
		popup.popup( "close" );
		setTimeout( function() {
			OSApp.UIDom.areYouSure(
				OSApp.Language._( "Delete all Let's Encrypt data and revert to internal certificate? A reboot will be required." ),
				"",
				function() {
					$.mobile.loading( "show" );
					OSApp.Firmware.sendToOS( "/tx?pw=", "json" ).done( function( resp ) {
						$.mobile.loading( "hide" );
						if ( resp && resp.result === 1 ) {
							OSApp.UIDom.areYouSure(
								OSApp.Language._( "ACME data removed. Reboot now to apply?" ),
								"",
								function() {
									OSApp.Firmware.sendToOS( "/cv?pw=&rbt=1" );
									OSApp.Errors.showError( OSApp.Language._( "OpenSprinkler is rebooting now" ) );
								}
							);
						} else {
							OSApp.Errors.showError( OSApp.Language._( "Failed to remove ACME data" ) );
						}
					} ).fail( function() {
						$.mobile.loading( "hide" );
						OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
					} );
				}
			);
		}, 400 );
		return false;
	} );

	OSApp.UIDom.openPopup( popup );
};

/**
 * Send mode change command to the controller.
 * Uses /iw?pw=&mode=X to set the mode, which triggers a device reboot after ~2 seconds.
 */
OSApp.ESP32Mode.changeMode = function( newMode ) {
	// Drop cached mode immediately so subsequent UI refreshes cannot show stale menu items.
	OSApp.ESP32Mode.clearRadioInfo();
	$.mobile.loading( "show" );

	OSApp.Firmware.sendToOS( "/iw?pw=&mode=" + newMode, "json" ).done( function( resp ) {
		if ( resp && resp.result === 1 ) {
			// The controller already schedules a reboot, but a direct reboot request
			// makes the transition robust when the deferred timer is lost.
			setTimeout( function() {
				OSApp.Firmware.sendToOS( "/cv?pw=&rbt=1" );
			}, 250 );
			OSApp.Errors.showError( OSApp.Language._( "OpenSprinkler is rebooting now" ) );
		} else {
			OSApp.Errors.showError( resp && resp.error ? resp.error : OSApp.Language._( "Failed to change IEEE 802.15.4 mode" ) );
		}
	} ).fail( function() {
		OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
	} ).always( function() {
		$.mobile.loading( "hide" );
	} );
};

/**
 * Setup RainMaker — standalone menu popup.
 * Fetches /rk and displays status, QR code for provisioning, and provisioning form.
 */
OSApp.ESP32Mode.setupRainMaker = function() {
	$.mobile.loading( "show" );

	OSApp.Firmware.sendToOS( "/rk?pw=", "json" ).done( function( rainmakerInfo ) {
		$.mobile.loading( "hide" );

		if ( !rainmakerInfo ) {
			OSApp.Errors.showError( OSApp.Language._( "RainMaker information not available" ) );
			return;
		}

		OSApp.ESP32Mode.showRainMakerPopup( rainmakerInfo );
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
	} );
};

/**
 * Display the RainMaker popup with status and PoP PIN for On Network provisioning.
 * Users add their OpenSprinkler via the ESP RainMaker phone app using
 * "Add Device" → "On Network" and entering the PoP PIN when prompted.
 */
OSApp.ESP32Mode.showRainMakerPopup = function( rainmakerInfo ) {
	var content = "",
		isEth = !!rainmakerInfo.use_eth,
		mappingState = rainmakerInfo.user_mapping || 0,
		featureEnabled = !!rainmakerInfo.feature_enabled,
		mappingLabel;

	content += "<div class='ui-content' role='main' style='max-width:500px;'>";
	content += "<h3 style='margin-top:0;'>ESP RainMaker</h3>";

	// ── Enable/disable RainMaker feature toggle ───────────────────────────────
	content += "<div style='display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #ddd;margin-bottom:10px;'>";
	content += "<label for='rmaker-feature-toggle' style='margin:0;font-weight:bold;'>" + OSApp.Language._( "Enable RainMaker" ) + "</label>";
	content += "<input type='checkbox' id='rmaker-feature-toggle' " + ( featureEnabled ? "checked" : "" ) + ">";
	content += "</div>";

	if ( featureEnabled ) {
	content += "<div style='background:#f5f5f5;padding:8px;border-radius:4px;margin-bottom:10px;font-size:0.9em;'>";
	content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Status" ) + ":</b> " +
		( rainmakerInfo.unlinking
			? "<span style='color:orange;'>" + OSApp.Language._( "Unlinking (rebooting)" ) + "</span>"
			: rainmakerInfo.enabled
			? "<span style='color:green;'>" + OSApp.Language._( "Enabled" ) + "</span>"
			: "<span style='color:red;'>" + OSApp.Language._( "Not initialized" ) + "</span>" ) + "</p>";
	if ( rainmakerInfo.node_id ) {
		content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Node ID" ) + ":</b> " +
			$( "<span>" ).text( rainmakerInfo.node_id ).html() + "</p>";
	}
	if ( rainmakerInfo.name ) {
		content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Name" ) + ":</b> " +
			$( "<span>" ).text( rainmakerInfo.name ).html() + "</p>";
	}
	if ( rainmakerInfo.fw_version ) {
		content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Firmware" ) + ":</b> " +
			$( "<span>" ).text( rainmakerInfo.fw_version ).html() + "</p>";
	}
	content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "MQTT" ) + ":</b> " +
		( rainmakerInfo.mqtt_connected
			? "<span style='color:green;'>" + OSApp.Language._( "Connected" ) + "</span>"
			: "<span style='color:red;'>" + OSApp.Language._( "Disconnected" ) + "</span>" ) + "</p>";
	content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Connection" ) + ":</b> " +
		( isEth ? "Ethernet" : "WiFi" ) + "</p>";
	content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Local Control" ) + ":</b> " +
		( rainmakerInfo.local_ctrl_active
			? "<span style='color:green;'>" + OSApp.Language._( "Active" ) + "</span>"
			: "<span style='color:red;'>" + OSApp.Language._( "Inactive" ) + "</span>" ) + "</p>";

	switch ( mappingState ) {
		case 0: mappingLabel = OSApp.Language._( "Not started" ); break;
		case 1: mappingLabel = OSApp.Language._( "Started" ); break;
		case 2: mappingLabel = OSApp.Language._( "Request sent" ); break;
		case 3: mappingLabel = "<span style='color:green;'>" + OSApp.Language._( "Done" ) + "</span>"; break;
		default: mappingLabel = OSApp.Language._( "Unknown" );
	}
	content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "User Mapping" ) + ":</b> " + mappingLabel + "</p>";
	content += "</div>";

	// ── Provisioning instructions (On Network) ──────────────────────────────
	if ( rainmakerInfo.enabled ) {

		if ( mappingState >= 3 ) {
			content += "<p style='color:green;font-size:0.9em;margin-bottom:8px;'>" +
				OSApp.Language._( "This device is already linked to a RainMaker account." ) + "</p>";
		} else {
			content += "<p style='font-size:0.85em;color:#555;margin:4px 0 8px;'>" +
				OSApp.Language._( "Add this device via the ESP RainMaker app:" ) + "</p>";
			content += "<ul style='margin:4px 0 8px;padding-left:18px;font-size:0.85em;color:#555;'>";
			content += "<li><b>" + OSApp.Language._( "On Network" ) + ":</b> " +
				OSApp.Language._( "'Add Device' → 'On Network' (device and phone on same WiFi network)" ) + "</li>";
			content += "</ul>";
		}

		if ( rainmakerInfo.pop ) {
			content += "<div style='background:#e8f5e9;padding:10px;border-radius:4px;margin:8px 0;text-align:center;'>";
			content += "<p style='margin:0 0 4px;font-size:0.85em;color:#555;'><b>" + OSApp.Language._( "PoP PIN" ) + "</b></p>";
			content += "<code style='font-size:1.5em;font-weight:bold;letter-spacing:3px;'>" +
				$( "<span>" ).text( rainmakerInfo.pop ).html() + "</code> ";
			content += "<button class='rmaker-copy-pop ui-btn ui-btn-inline ui-mini ui-corner-all' " +
				"data-pop='" + $( "<span>" ).text( rainmakerInfo.pop ).html() + "' " +
				"style='margin:4px 0 0;padding:4px 10px;font-size:0.8em;'>" +
				OSApp.Language._( "Copy" ) + "</button>";
			content += "</div>";
		}

		if ( rainmakerInfo.prov_service ) {
			content += "<p style='margin:2px 0;font-size:0.85em;color:#777;'><b>" + OSApp.Language._( "Service" ) + ":</b> " +
				$( "<span>" ).text( rainmakerInfo.prov_service ).html() + "</p>";
		}

	} else {
		content += "<p style='font-size:0.9em;color:#555;margin:12px 0;'>" +
			OSApp.Language._( "RainMaker is disabled. When enabled, this device can be controlled via the ESP RainMaker cloud. A reboot is required after changing this setting." ) + "</p>";
	}

	content += "<button class='rmaker-refresh-btn ui-btn ui-corner-all'>" +
		OSApp.Language._( "Refresh Status" ) + "</button>";

	// ── Unlink (always visible when RainMaker enabled, shown last) ───────────
	if ( featureEnabled && rainmakerInfo.enabled ) {
		content += "<button class='rmaker-unlink-btn ui-btn ui-corner-all' style='margin-top:12px;background:#fff3f3;color:#b00020;border:1px solid #e0c0c0;'>" +
			OSApp.Language._( "Unlink RainMaker" ) + "</button>";
	}

	} // end if ( featureEnabled )

	content += "<button class='cancel-rmaker ui-btn ui-corner-all'>" + OSApp.Language._( "Close" ) + "</button>";
	content += "</div>";

	var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='rainMakerPopup'>" + content + "</div>" );

	// Feature enable/disable toggle
	popup.on( "change", "#rmaker-feature-toggle", function() {
		var enable = $( this ).prop( "checked" ) ? 1 : 0;
		$.mobile.loading( "show" );
		OSApp.Firmware.sendToOS( "/co?pw=&rken=" + enable ).done( function() {
			$.mobile.loading( "hide" );
			if ( window.confirm( OSApp.Language._( "Reboot required for changes to take effect. Reboot now?" ) ) ) {
				OSApp.Firmware.sendToOS( "/cv?pw=&rbt=1" );
				OSApp.Errors.showError( OSApp.Language._( "OpenSprinkler is rebooting now" ) );
				popup.popup( "close" );
			}
		} ).fail( function() {
			$.mobile.loading( "hide" );
			OSApp.Errors.showError( OSApp.Language._( "Error saving setting" ) );
		} );
		return false;
	} );

	// Close button
	popup.on( "click", ".cancel-rmaker", function() {
		popup.popup( "close" );
		return false;
	} );

	// Copy PoP to clipboard
	popup.on( "click", ".rmaker-copy-pop", function() {
		var pop = $( this ).data( "pop" );
		if ( navigator.clipboard && navigator.clipboard.writeText ) {
			navigator.clipboard.writeText( pop ).then( function() {
				OSApp.Errors.showError( OSApp.Language._( "PoP PIN copied to clipboard" ) );
			} ).catch( function() {
				OSApp.Errors.showError( OSApp.Language._( "Copy failed" ) );
			} );
		} else {
			var tmp = $( "<input>" ).val( pop ).appendTo( "body" );
			tmp[ 0 ].select();
			document.execCommand( "copy" );
			tmp.remove();
			OSApp.Errors.showError( OSApp.Language._( "PoP PIN copied to clipboard" ) );
		}
		return false;
	} );

	// Refresh Status
	popup.on( "click", ".rmaker-refresh-btn", function() {
		$.mobile.loading( "show" );
		OSApp.Firmware.sendToOS( "/rk?pw=", "json" ).done( function( data ) {
			$.mobile.loading( "hide" );
			if ( data ) {
				popup.popup( "close" );
				setTimeout( function() {
					OSApp.ESP32Mode.showRainMakerPopup( data );
				}, 400 );
			}
		} ).fail( function() {
			$.mobile.loading( "hide" );
			OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
		} );
		return false;
	} );

	// Remove current RainMaker account mapping (unlink)
	popup.on( "click", ".rmaker-unlink-btn", function() {
		if ( !window.confirm( OSApp.Language._( "Unlink from RainMaker account? This will reset RainMaker credentials and reboot the device." ) ) ) {
			return false;
		}

		$.mobile.loading( "show" );
		OSApp.Firmware.sendToOS( "/ru?pw=", "json" ).done( function( data ) {
			$.mobile.loading( "hide" );
			if ( data && data.result === 1 ) {
				OSApp.Errors.showError( OSApp.Language._( "RainMaker unlinked. Device is rebooting." ) );
				popup.popup( "close" );
			} else {
				OSApp.Errors.showError( ( data && data.error ) ? data.error : OSApp.Language._( "Failed to unlink RainMaker" ) );
			}
		} ).fail( function() {
			$.mobile.loading( "hide" );
			OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
		} );
		return false;
	} );

	OSApp.UIDom.openPopup( popup );
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
 * Zigbee Device Database — looks up vendor/description from the hosted DB.
 * Caches results in localStorage by IEEE address.
 */
OSApp.ESP32Mode.ZigbeeDeviceDB = {
	API_URL: "https://opensprinklershop.de/zigbee/devices_api.php",
	_mem: {},

	getCached: function( ieee ) {
		if ( this._mem[ ieee ] ) { return this._mem[ ieee ]; }
		try {
			var raw = localStorage.getItem( "zb_dev_" + ieee );
			if ( raw ) {
				this._mem[ ieee ] = JSON.parse( raw );
				return this._mem[ ieee ];
			}
		} catch ( e ) { void e; }
		return null;
	},

	setCached: function( ieee, data ) {
		this._mem[ ieee ] = data;
		try { localStorage.setItem( "zb_dev_" + ieee, JSON.stringify( data ) ); } catch ( e ) { void e; }
		var label = ( data.vendor && data.description )
			? data.vendor + " - " + data.description
			: ( data.vendor || data.description || "" );
		if ( label ) {
			try { localStorage.setItem( "zb_name_" + ieee, label ); } catch ( e ) { void e; }
		}
	},


	/** Returns the cached display label for a device by IEEE address, or null. */
	getCachedLabel: function( ieee ) {
		try { return localStorage.getItem( "zb_name_" + ieee ) || null; } catch ( e ) { void e; return null; }
	},

	lookup: function( manufacturer, model ) {
		var url = this.API_URL + "?manufacturer=" + encodeURIComponent( manufacturer ) + "&model=" + encodeURIComponent( model );
		return $.ajax( { url: url, dataType: "json", timeout: 6000 } );
	},

		/** Returns consolidated cluster_entries for the sensor-editor combobox.
	 *  Secondary DPs (battery, unit, status, consumption) are folded into the
	 *  primary entry as dp_battery / dp_unit / dp_status / dp_consumption fields.
	 *  Resolves with [] on failure so callers don't need to handle errors. */
	lookupForCombobox: function( manufacturer, model ) {
		var self = this;
		var url = this.API_URL +
			"?manufacturer=" + encodeURIComponent( manufacturer ) +
			"&model="        + encodeURIComponent( model ) +
			"&for_combobox=1";
		return $.ajax( { url: url, dataType: "json", timeout: 8000 } )
			.then(
				function( data ) { return self._consolidateEntries( data.cluster_entries || [] ); },
				function()       { return []; }
			);
	},

	/** Folds secondary DPs (battery, unit, status, consumption) into primary entries. */
	_consolidateEntries: function( entries ) {
		var secondaryPat = /^(battery|battery_level|linkquality|unit|unit_select|status|valve_status|power_on_behavior|consumption|water_consumed|current_summation)$/i;
		var primary = [], secondary = [];
		for ( var i = 0; i < entries.length; i++ ) {
			var e = entries[ i ];
			var name = ( e.sensor_name || "" ).toLowerCase();
			if ( e.is_tuya_dp && secondaryPat.test( name ) ) {
				secondary.push( e );
			} else {
				primary.push( e );
			}
		}
		if ( primary.length === 0 ) { return entries; }
		for ( var j = 0; j < secondary.length; j++ ) {
			var s = secondary[ j ];
			var sn = ( s.sensor_name || "" ).toLowerCase();
			var target = primary[ 0 ];
			if ( /battery/.test( sn ) && !target.dp_battery ) {
				target.dp_battery = s.dp;
			} else if ( /unit/.test( sn ) && !target.dp_unit ) {
				target.dp_unit = s.dp;
			} else if ( /status|valve/.test( sn ) && !target.dp_status ) {
				target.dp_status = s.dp;
			} else if ( /consumption|water|summation/.test( sn ) && !target.dp_consumption ) {
				target.dp_consumption = s.dp;
			}
		}
		return primary;
	},

	enrich: function( dev, $li ) {
		var self = this;
		var ieee = dev.ieee || "";
		var mfr  = ( dev.manufacturer && dev.manufacturer !== "unknown" ) ? dev.manufacturer : "";
		var mdl  = ( dev.model        && dev.model        !== "unknown" ) ? dev.model        : "";
		// Skip only if there is nothing useful to look up
		if ( !mfr && !mdl ) { return; }

		var cached = this.getCached( ieee );
		if ( cached ) { self._apply( $li, cached ); return; }

		this.lookup( mfr, mdl ).done( function( data ) {
			if ( data && ( data.vendor || data.description ) ) {
				self.setCached( ieee, data );
				self._apply( $li, data );
			}
		} );
	},

	_apply: function( $li, data ) {
		var label = ( data.vendor && data.description )
			? data.vendor + " — " + data.description
			: ( data.vendor || data.description || "" );
		if ( label ) {
			$li.find( ".zb-db-info" ).text( label ).show();
			// Works for both old <h4> (listview) and new .zg-dev-title (table rows)
			$li.find( "h4, .zg-dev-title" ).text( label );
		}
	}
};

/**
 * Slim ZigBee device editor popup (separate from the full analog sensor editor).
 * Shows only ZigBee-relevant fields: Name, IEEE, Endpoint, Model/Manufacturer,
 * Cluster/Attribute IDs and Tuya DP mappings.
 *
 * @param {Object} device  ZigBee device descriptor or existing sensor object.
 *                         Recognised: ieee/device_ieee, endpoint, model, manufacturer,
 *                         cluster_id, attribute_id, tuya_dp[_value], tuya_dp_batt,
 *                         tuya_dp_unit, tuya_dp_status, tuya_dp_consumption.
 * @param {Function} done  Called after save/cancel.
 */
OSApp.ESP32Mode.showZigBeeDeviceEditor = function( device, done ) {
	done = done || function() {};
	device = device || {};

	if ( !OSApp.Analog || typeof OSApp.Analog.sendToOsObj !== "function" ) {
		OSApp.Errors.showError( OSApp.Language._( "Sensor backend not available" ) );
		return;
	}

	function firstDefined() {
		for ( var i = 0; i < arguments.length; i++ ) {
			if ( arguments[ i ] !== undefined && arguments[ i ] !== null && arguments[ i ] !== "" ) {
				return arguments[ i ];
			}
		}
		return "";
	}

	function toHex4( val, fallback ) {
		if ( val === undefined || val === null || val === "" ) { return fallback; }
		var n = ( typeof val === "string" )
			? ( val.toLowerCase().indexOf( "0x" ) === 0 ? parseInt( val, 16 ) : parseInt( val, 10 ) )
			: parseInt( val, 10 );
		if ( isNaN( n ) ) { return fallback; }
		var s = n.toString( 16 ).toUpperCase();
		while ( s.length < 4 ) { s = "0" + s; }
		return "0x" + s;
	}

	function parseHex( v ) {
		if ( v === undefined || v === null || v === "" ) { return null; }
		var s = String( v ).trim();
		if ( s === "" ) { return null; }
		var n = ( s.toLowerCase().indexOf( "0x" ) === 0 ) ? parseInt( s, 16 ) : parseInt( s, 10 );
		return isNaN( n ) ? null : n;
	}

	function parseDpOrEmpty( v ) {
		if ( v === undefined || v === null || v === "" ) { return ""; }
		var s = String( v ).trim();
		if ( s === "" ) { return ""; }
		var n = parseInt( s, 10 );
		return isNaN( n ) ? "" : n;
	}

	OSApp.Analog.updateAnalogSensor( function() {
		var sensors = OSApp.Analog.analogSensors || [];
		var ZIGBEE_TYPE = ( OSApp.Analog.Constants && OSApp.Analog.Constants.SENSOR_ZIGBEE ) || 95;
		var ieee = firstDefined( device.device_ieee, device.ieee );
		var i;

		// Collect ALL existing sensor rows that share this IEEE — these are the derivatives.
		var existingDerivs = [];
		for ( i = 0; i < sensors.length; i++ ) {
			var sCur = sensors[ i ];
			if ( sCur && sCur.device_ieee && ieee &&
				String( sCur.device_ieee ).toLowerCase() === String( ieee ).toLowerCase() ) {
				existingDerivs.push( sCur );
			}
		}
		var isNewDevice = existingDerivs.length === 0;
		var existingNrs = existingDerivs.map( function( s ) { return s.nr; } );

		var maxNr = 0;
		for ( i = 0; i < sensors.length; i++ ) {
			if ( sensors[ i ] && sensors[ i ].nr > maxNr ) { maxNr = sensors[ i ].nr; }
		}
		var nextNr = maxNr + 1;
		function allocNr() { return nextNr++; }

		// Device-wide metadata (taken from first existing derivative or scan/device hint).
		var src0 = existingDerivs[ 0 ] || device;
		var devName  = firstDefined(
			isNewDevice ? "" : ( src0.device_name || extractDeviceName( src0.name ) ),
			device.model && device.model !== "unknown" ? device.model : "",
			OSApp.Language._( "New ZigBee Device" )
		);
		var devIeee  = firstDefined( src0.device_ieee, ieee );
		var devManuf = firstDefined( src0.manufacturer, device.manufacturer, "" );
		var devModel = firstDefined( src0.model,        device.model,        "" );

		function extractDeviceName( fullName ) {
			if ( !fullName ) { return ""; }
			var sep = String( fullName ).indexOf( " - " );
			return sep > 0 ? String( fullName ).slice( 0, sep ) : String( fullName );
		}
		function extractDerivName( fullName ) {
			if ( !fullName ) { return ""; }
			var sep = String( fullName ).indexOf( " - " );
			return sep > 0 ? String( fullName ).slice( sep + 3 ) : "";
		}

		function derivFromSensor( s ) {
			return {
				origNr:  s.nr,
				nr:      s.nr,
				name:    extractDerivName( s.name ) || s.name || "",
				endpoint: parseInt( firstDefined( s.endpoint, 1 ), 10 ) || 1,
				cluster: toHex4( s.cluster_id,   "0x0408" ),
				attr:    toHex4( s.attribute_id, "0x0000" ),
				dpVal:   parseDpOrEmpty( firstDefined( s.tuya_dp,        s.tuya_dp_value,       s.dp_value ) ),
				dpStat:  parseDpOrEmpty( firstDefined( s.tuya_dp_status, s.dp_status ) ),
				dpCons:  parseDpOrEmpty( firstDefined( s.tuya_dp_consumption, s.dp_consumption ) ),
				dpUnit:  parseDpOrEmpty( firstDefined( s.tuya_dp_unit,   s.dp_unit ) ),
				dpBatt:  parseDpOrEmpty( firstDefined( s.tuya_dp_batt,   s.tuya_dp_battery,     s.dp_battery ) ),
				ri:      parseInt( firstDefined( s.ri, 600 ), 10 ) || 600,
				enable:  ( s.enable === undefined || s.enable === null ) ? 1 : ( s.enable ? 1 : 0 ),
				log:     ( s.log    === undefined || s.log    === null ) ? 1 : ( s.log    ? 1 : 0 ),
				group:   parseInt( firstDefined( s.group, 0 ), 10 ) || 0,
				unitid:  parseInt( firstDefined( s.unitid, 0 ), 10 ) || 0,
				srcSensor: s
			};
		}
		function emptyDeriv() {
			return {
				origNr: 0, nr: allocNr(), name: "",
				endpoint: parseInt( device.endpoint, 10 ) || 1,
				cluster: "0x0408", attr: "0x0000",
				dpVal: "", dpStat: "", dpCons: "", dpUnit: "", dpBatt: "",
				ri: 600, enable: 1, log: 1, group: 0, unitid: 0, srcSensor: null
			};
		}

		var derivs = existingDerivs.map( derivFromSensor );
		if ( derivs.length === 0 ) { derivs.push( emptyDeriv() ); }

		var dpFieldDefs = [
			{ key: "dpVal",  cls: "d-dp-val",  label: "Value DP",       hint: OSApp.Language._( "on/off control" ) },
			{ key: "dpStat", cls: "d-dp-stat", label: "Status DP",      hint: OSApp.Language._( "current state" ) },
			{ key: "dpCons", cls: "d-dp-cons", label: "Consumption DP", hint: OSApp.Language._( "water meter (optional)" ) },
			{ key: "dpUnit", cls: "d-dp-unit", label: "Unit DP",        hint: OSApp.Language._( "°C/°F or L/m³ (optional)" ) },
			{ key: "dpBatt", cls: "d-dp-batt", label: "Battery DP",     hint: OSApp.Language._( "battery level (optional)" ) }
		];

		function renderDerivCard( d, idx ) {
			var title = d.name || ( OSApp.Language._( "Derivative" ) + " " + ( idx + 1 ) );
			var h = "";
			h += "<fieldset data-role='collapsible' data-mini='true' data-collapsed='false' data-idx='" + idx + "' class='zbed-deriv'>";
			h += "<legend>" + OSApp.Utils.htmlEscape( title ) + "</legend>";

			h += "<label>" + OSApp.Language._( "Derivative Name" );
			h += "<input type='text' class='d-name' data-mini='true' maxlength='40' value='" + OSApp.Utils.htmlEscape( d.name ) + "'></label>";

			h += "<div style='display:flex;gap:8px;flex-wrap:wrap;'>";
			h += "<div style='flex:1;min-width:80px;'><label>" + OSApp.Language._( "Endpoint" );
			h += "<input type='number' class='d-ep' data-mini='true' min='1' max='255' value='" + d.endpoint + "' style='width:100%;'></label></div>";
			h += "<div style='flex:2;min-width:130px;'><label>" + OSApp.Language._( "Cluster ID (hex)" );
			h += "<input type='text' class='d-cluster' data-mini='true' value='" + OSApp.Utils.htmlEscape( d.cluster ) + "' style='width:100%;'></label></div>";
			h += "<div style='flex:2;min-width:130px;'><label>" + OSApp.Language._( "Attribute ID (hex)" );
			h += "<input type='text' class='d-attr' data-mini='true' value='" + OSApp.Utils.htmlEscape( d.attr ) + "' style='width:100%;'></label></div>";
			h += "</div>";

			h += "<div style='display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;'>";
			dpFieldDefs.forEach( function( f ) {
				h += "<div style='flex:1;min-width:130px;'><label>" + OSApp.Language._( f.label ) +
					" <span style='color:#888;font-weight:normal;font-size:0.8em;'>(" + f.hint + ")</span>";
				h += "<input type='number' class='" + f.cls + "' data-mini='true' min='0' max='255' style='width:100%;' value='" + d[ f.key ] + "'></label></div>";
			} );
			h += "</div>";

			h += "<div style='margin-top:6px;text-align:right;'>";
			h += "<button type='button' class='zbed-remove-deriv ui-btn ui-mini ui-corner-all ui-icon-delete ui-btn-icon-left' data-idx='" + idx + "'>" +
				OSApp.Language._( "Remove derivative" ) + "</button>";
			h += "</div>";

			h += "</fieldset>";
			return h;
		}

		function renderDerivs() {
			var $list = popup.find( "#zbed-derivs" );
			$list.empty();
			for ( var k = 0; k < derivs.length; k++ ) {
				$list.append( renderDerivCard( derivs[ k ], k ) );
			}
			$list.enhanceWithin();
		}

		function syncDerivsFromUI() {
			popup.find( "#zbed-derivs > fieldset.zbed-deriv" ).each( function() {
				var $f = $( this );
				var idx = parseInt( $f.attr( "data-idx" ), 10 );
				var d = derivs[ idx ];
				if ( !d ) { return; }
				d.name     = String( $f.find( ".d-name" ).val() || "" );
				d.endpoint = parseInt( $f.find( ".d-ep" ).val(), 10 ) || 1;
				d.cluster  = String( $f.find( ".d-cluster" ).val() || "" );
				d.attr     = String( $f.find( ".d-attr"    ).val() || "" );
				d.dpVal    = String( $f.find( ".d-dp-val"  ).val() || "" );
				d.dpStat   = String( $f.find( ".d-dp-stat" ).val() || "" );
				d.dpCons   = String( $f.find( ".d-dp-cons" ).val() || "" );
				d.dpUnit   = String( $f.find( ".d-dp-unit" ).val() || "" );
				d.dpBatt   = String( $f.find( ".d-dp-batt" ).val() || "" );
			} );
		}

		var html = "";
		html += "<div data-role='header' data-theme='b'>";
		html += "<a href='#' data-rel='back' data-role='button' data-theme='a' data-icon='delete' data-iconpos='notext' class='ui-btn-right'>" + OSApp.Language._( "close" ) + "</a>";
		html += "<h1>" + ( isNewDevice ? OSApp.Language._( "New ZigBee Device" ) : OSApp.Language._( "Edit ZigBee Device" ) ) + "</h1>";
		html += "</div>";
		html += "<div class='ui-content'>";

		html += "<label for='zbed-name'>" + OSApp.Language._( "Device Name" ) + "</label>";
		html += "<input type='text' id='zbed-name' data-mini='true' maxlength='40' value='" + OSApp.Utils.htmlEscape( devName ) + "'>";

		html += "<label for='zbed-ieee'>" + OSApp.Language._( "IEEE Address" ) + "</label>";
		html += "<input type='text' id='zbed-ieee' data-mini='true' value='" + OSApp.Utils.htmlEscape( devIeee ) + "'" + ( isNewDevice ? "" : " readonly" ) + ">";

		html += "<div style='display:flex;gap:12px;flex-wrap:wrap;'>";
		html += "<div style='flex:1;min-width:150px;'><label for='zbed-manuf'>" + OSApp.Language._( "Manufacturer" ) + "</label>";
		html += "<input type='text' id='zbed-manuf' data-mini='true' maxlength='40' value='" + OSApp.Utils.htmlEscape( devManuf ) + "' style='width:100%;'></div>";
		html += "<div style='flex:1;min-width:150px;'><label for='zbed-model'>" + OSApp.Language._( "Model" ) + "</label>";
		html += "<input type='text' id='zbed-model' data-mini='true' maxlength='40' value='" + OSApp.Utils.htmlEscape( devModel ) + "' style='width:100%;'></div>";
		html += "</div>";

		html += "<div style='margin:8px 0;'>";
		html += "<button type='button' class='zbed-db-lookup ui-btn ui-mini ui-corner-all ui-icon-search ui-btn-icon-left'>" +
			OSApp.Language._( "Query Device Database" ) + "</button>";
		html += "<div class='zbed-db-result' style='display:none;margin-top:6px;padding:8px;border-radius:4px;background:#f5f5f5;font-size:0.9em;'></div>";
		html += "</div>";

		html += "<h3 style='margin:10px 0 4px;'>" + OSApp.Language._( "Derivatives" ) + "</h3>";
		html += "<p style='margin:0 0 6px;font-size:0.85em;color:#666;'>" +
			OSApp.Language._( "Each derivative is one logical sensor/valve channel of this device (e.g. soil moisture, temperature, valve)." ) + "</p>";
		html += "<div id='zbed-derivs'></div>";
		html += "<div style='margin:6px 0;'>";
		html += "<button type='button' class='zbed-add-deriv ui-btn ui-mini ui-corner-all ui-icon-plus ui-btn-icon-left'>" +
			OSApp.Language._( "Add derivative" ) + "</button>";
		html += "</div>";

		html += "<div style='margin-top:10px;'>";
		html += "<button type='button' class='zbed-save ui-btn ui-btn-b ui-corner-all'>" + OSApp.Language._( "Save" ) + "</button>";
		if ( !isNewDevice ) {
			html += "<button type='button' class='zbed-delete ui-btn ui-corner-all'>" + OSApp.Language._( "Delete device" ) + "</button>";
		}
		html += "<button type='button' class='zbed-cancel ui-btn ui-corner-all'>" + OSApp.Language._( "Cancel" ) + "</button>";
		html += "</div>";
		html += "</div>";

		$( "#zigbeeDeviceEditor" ).remove();
		var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='zigbeeDeviceEditor' style='max-width:95vw;width:640px;max-height:90vh;overflow:auto;'>" + html + "</div>" );

		popup.on( "click", ".zbed-cancel", function() {
			popup.popup( "close" );
			return false;
		} );

		popup.on( "click", ".zbed-add-deriv", function() {
			syncDerivsFromUI();
			derivs.push( emptyDeriv() );
			renderDerivs();
			return false;
		} );

		popup.on( "click", ".zbed-remove-deriv", function() {
			var idx = parseInt( $( this ).attr( "data-idx" ), 10 );
			if ( isNaN( idx ) || !derivs[ idx ] ) { return false; }
			syncDerivsFromUI();
			derivs.splice( idx, 1 );
			if ( derivs.length === 0 ) { derivs.push( emptyDeriv() ); }
			renderDerivs();
			return false;
		} );

		popup.on( "click", ".zbed-db-lookup", function() {
			var $result = popup.find( ".zbed-db-result" );
			var manufQ = String( popup.find( "#zbed-manuf" ).val() || "" ).trim() || devManuf;
			var modelQ = String( popup.find( "#zbed-model" ).val() || "" ).trim() || devModel;
			if ( !manufQ || !modelQ ) {
				$result.show().html( "<em style='color:#a00;'>" +
					OSApp.Language._( "Manufacturer/Model unknown — cannot query database." ) + "</em>" );
				return false;
			}
			if ( !OSApp.ESP32Mode.ZigbeeDeviceDB || typeof OSApp.ESP32Mode.ZigbeeDeviceDB.lookupForCombobox !== "function" ) {
				$result.show().html( "<em style='color:#a00;'>" + OSApp.Language._( "Database not available" ) + "</em>" );
				return false;
			}
			$result.show().html( "<em>" + OSApp.Language._( "Querying database..." ) + "</em>" );
			OSApp.ESP32Mode.ZigbeeDeviceDB.lookupForCombobox( manufQ, modelQ ).done( function( entries ) {
				if ( !entries || !entries.length ) {
					$result.html( "<em>" + OSApp.Language._( "No database entry found." ) + "</em>" );
					return;
				}

				var apply = function() {
					var newDerivs = entries.map( function( e ) {
						return {
							origNr:   0,
							nr:       allocNr(),
							name:     String( firstDefined( e.sensor_name, e.name, e.description, "" ) ),
							endpoint: parseInt( firstDefined( e.endpoint, 1 ), 10 ) || 1,
							cluster:  toHex4( firstDefined( e.cluster_id, e.cluster ), "0x0000" ),
							attr:     toHex4( firstDefined( e.attr_id, e.attribute_id, e.attribute ), "0x0000" ),
							dpVal:    parseDpOrEmpty( firstDefined( e.dp, e.tuya_dp ) ),
							dpStat:   parseDpOrEmpty( firstDefined( e.dp_status, e.tuya_dp_status ) ),
							dpCons:   parseDpOrEmpty( firstDefined( e.dp_consumption, e.tuya_dp_consumption ) ),
							dpUnit:   parseDpOrEmpty( firstDefined( e.dp_unit, e.tuya_dp_unit ) ),
							dpBatt:   parseDpOrEmpty( firstDefined( e.dp_battery, e.tuya_dp_batt ) ),
							ri: 600, enable: 1, log: 1, group: 0, unitid: 0, srcSensor: null
						};
					} );
					// Preserve nr/origNr for existing derivatives where cluster+attr+endpoint match.
					for ( var ni = 0; ni < newDerivs.length; ni++ ) {
						for ( var oi = 0; oi < existingDerivs.length; oi++ ) {
							var oe = derivFromSensor( existingDerivs[ oi ] );
							if ( oe.cluster === newDerivs[ ni ].cluster &&
								oe.attr === newDerivs[ ni ].attr &&
								oe.endpoint === newDerivs[ ni ].endpoint ) {
								newDerivs[ ni ].origNr = oe.origNr;
								newDerivs[ ni ].nr     = oe.nr;
								break;
							}
						}
					}
					derivs = newDerivs;
					renderDerivs();
				};

				var info = "<div><strong>" + OSApp.Language._( "Found" ) + ":</strong> " + entries.length + " " +
					OSApp.Language._( "derivative(s)" ) + "</div>";
				$result.html( info );

				if ( existingDerivs.length > 0 ) {
					OSApp.UIDom.areYouSure(
						OSApp.Language._( "Replace existing derivatives with database entries?" ),
						"",
						apply
					);
				} else {
					apply();
				}
			} ).fail( function() {
				$result.html( "<em style='color:#a00;'>" + OSApp.Language._( "Database query failed" ) + "</em>" );
			} );
			return false;
		} );

		popup.on( "click", ".zbed-save", function() {
			syncDerivsFromUI();

			var ieeeVal  = String( popup.find( "#zbed-ieee"  ).val() || "" ).trim();
			var nameVal  = String( popup.find( "#zbed-name"  ).val() || "" ).trim();
			var manufVal = String( popup.find( "#zbed-manuf" ).val() || "" ).trim();
			var modelVal = String( popup.find( "#zbed-model" ).val() || "" ).trim();

			if ( !ieeeVal ) {
				OSApp.Errors.showError( OSApp.Language._( "IEEE Address is required" ) );
				return false;
			}
			if ( !derivs.length ) {
				OSApp.Errors.showError( OSApp.Language._( "At least one derivative is required" ) );
				return false;
			}

			// Validate & build payloads
			var payloads = [];
			for ( var di = 0; di < derivs.length; di++ ) {
				var d = derivs[ di ];
				var clusterN = parseHex( d.cluster );
				var attrN    = parseHex( d.attr );
				if ( clusterN === null || attrN === null ) {
					OSApp.Errors.showError( OSApp.Language._( "Invalid Cluster/Attribute ID in derivative " ) + ( di + 1 ) );
					return false;
				}
				var derivLabel = d.name || ( OSApp.Language._( "Derivative" ) + " " + ( di + 1 ) );
				var sensorName = ( nameVal && d.name ) ? ( nameVal + " - " + d.name )
					: ( nameVal || derivLabel );
				sensorName = sensorName.slice( 0, 40 );

				var p = {
					nr:        d.nr,
					type:      ZIGBEE_TYPE,
					name:      sensorName,
					group:     d.group,
					ri:        d.ri,
					enable:    d.enable,
					log:       d.log,
					unitid:    d.unitid,
					device_ieee:  ieeeVal,
					manufacturer: manufVal.slice( 0, 40 ),
					model:        modelVal.slice( 0, 40 ),
					endpoint:     d.endpoint,
					cluster_id:   clusterN,
					attribute_id: attrN
				};

				function dpVal( v ) {
					if ( v === "" || v === null || v === undefined ) { return -1; }
					var n = parseInt( v, 10 );
					return ( isNaN( n ) || n < 0 ) ? -1 : n;
				}
				var dpv = dpVal( d.dpVal );
				var dps = dpVal( d.dpStat );
				var dpc = dpVal( d.dpCons );
				var dpu = dpVal( d.dpUnit );
				var dpb = dpVal( d.dpBatt );
				if ( dpv >= 0 ) { p.tuya_dp             = dpv; }
				if ( dps >= 0 ) { p.tuya_dp_status      = dps; }
				if ( dpc >= 0 ) { p.tuya_dp_consumption = dpc; }
				if ( dpu >= 0 ) { p.tuya_dp_unit        = dpu; }
				if ( dpb >= 0 ) { p.tuya_dp_batt        = dpb; }

				if ( d.srcSensor ) {
					p.nativedata = d.srcSensor.nativedata;
					p.data       = d.srcSensor.data;
					p.last       = d.srcSensor.last;
				}
				payloads.push( { payload: p, isNewDeriv: !d.origNr } );
			}

			// Derivatives to delete: existing nrs no longer present in derivs.
			var keptOrig = derivs.filter( function( d ) { return d.origNr; } )
				.map( function( d ) { return d.origNr; } );
			var toDelete = existingNrs.filter( function( n ) { return keptOrig.indexOf( n ) === -1; } );

			$.mobile.loading( "show" );

			function runOps( ops, finishCb ) {
				if ( !ops.length ) { finishCb( true ); return; }
				var op = ops.shift();
				var req;
				if ( op.delNr ) {
					req = OSApp.Firmware.sendToOS( "/sc?pw=&nr=" + op.delNr + "&type=0", "json" );
				} else {
					req = OSApp.Analog.sendToOsObj( "/sc?pw=", op.payload );
				}
				req.done( function( info ) {
					var result = info && info.result;
					if ( !result || result > 1 ) {
						$.mobile.loading( "hide" );
						OSApp.Errors.showError( OSApp.Language._( "Error calling rest service: " ) + " " + result );
						finishCb( false );
						return;
					}
					if ( !op.delNr && op.isNewDeriv && op.payload.enable ) {
						OSApp.Firmware.sendToOS( "/sr?pw=&nr=" + op.payload.nr );
					}
					runOps( ops, finishCb );
				} ).fail( function() {
					$.mobile.loading( "hide" );
					OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
					finishCb( false );
				} );
			}

			var ops = [];
			toDelete.forEach( function( n ) { ops.push( { delNr: n } ); } );
			payloads.forEach( function( pp ) { ops.push( pp ); } );

			runOps( ops, function( ok ) {
				$.mobile.loading( "hide" );
				if ( ok ) {
					popup.popup( "close" );
					OSApp.Analog.updateAnalogSensor( done );
				}
			} );
			return false;
		} );

		popup.on( "click", ".zbed-delete", function() {
			if ( isNewDevice ) { return false; }
			OSApp.UIDom.areYouSure(
				OSApp.Language._( "Delete this ZigBee device and all of its derivatives?" ),
				"",
				function() {
					$.mobile.loading( "show" );
					var nrs = existingNrs.slice();
					( function deleteNext() {
						if ( !nrs.length ) {
							$.mobile.loading( "hide" );
							popup.popup( "close" );
							OSApp.Analog.updateAnalogSensor( done );
							return;
						}
						var nr = nrs.shift();
						OSApp.Firmware.sendToOS( "/sc?pw=&nr=" + nr + "&type=0", "json" )
							.done( function( info ) {
								var result = info && info.result;
								if ( !result || result > 1 ) {
									$.mobile.loading( "hide" );
									OSApp.Errors.showError( OSApp.Language._( "Error calling rest service: " ) + " " + result );
									return;
								}
								deleteNext();
							} )
							.fail( function() {
								$.mobile.loading( "hide" );
								OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
							} );
					} )();
				}
			);
			return false;
		} );

		popup.enhanceWithin();
		// Render derivatives after popup is in the DOM so enhanceWithin works on them too.
		renderDerivs();
		OSApp.UIDom.openPopup( popup, { positionTo: "window" } );

		// Auto-apply DB lookup when opening a freshly scanned device with known manufacturer/model.
		if ( isNewDevice && devManuf && devModel &&
			OSApp.ESP32Mode.ZigbeeDeviceDB &&
			typeof OSApp.ESP32Mode.ZigbeeDeviceDB.lookupForCombobox === "function" ) {
			var $autoResult = popup.find( ".zbed-db-result" );
			$autoResult.show().html( "<em>" + OSApp.Language._( "Querying database..." ) + "</em>" );
			OSApp.ESP32Mode.ZigbeeDeviceDB.lookupForCombobox( devManuf, devModel ).done( function( entries ) {
				if ( !entries || !entries.length ) {
					$autoResult.html( "<em>" + OSApp.Language._( "No database entry found." ) + "</em>" );
					return;
				}
				var newDerivs = entries.map( function( e ) {
					return {
						origNr:   0,
						nr:       allocNr(),
						name:     String( firstDefined( e.sensor_name, e.name, e.description, "" ) ),
						endpoint: parseInt( firstDefined( e.endpoint, 1 ), 10 ) || 1,
						cluster:  toHex4( firstDefined( e.cluster_id, e.cluster ), "0x0000" ),
						attr:     toHex4( firstDefined( e.attr_id, e.attribute_id, e.attribute ), "0x0000" ),
						dpVal:    parseDpOrEmpty( firstDefined( e.dp, e.tuya_dp ) ),
						dpStat:   parseDpOrEmpty( firstDefined( e.dp_status, e.tuya_dp_status ) ),
						dpCons:   parseDpOrEmpty( firstDefined( e.dp_consumption, e.tuya_dp_consumption ) ),
						dpUnit:   parseDpOrEmpty( firstDefined( e.dp_unit, e.tuya_dp_unit ) ),
						dpBatt:   parseDpOrEmpty( firstDefined( e.dp_battery, e.tuya_dp_batt ) ),
						ri: 600, enable: 1, log: 1, group: 0, unitid: 0, srcSensor: null
					};
				} );
				derivs = newDerivs;
				renderDerivs();
				$autoResult.html( "<div><strong>" + OSApp.Language._( "Found" ) + ":</strong> " +
					entries.length + " " + OSApp.Language._( "derivative(s)" ) +
					" — " + OSApp.Language._( "applied from database" ) + "</div>" );
			} ).fail( function() {
				$autoResult.html( "<em style='color:#a00;'>" + OSApp.Language._( "Database query failed" ) + "</em>" );
			} );
		}
	} );
};

/**
 * Show a variant-selection popup after a successful scan.
 *
 * Minimal implementation: directly open the sensor editor for the selected
 * device. (More advanced variants like Tuya DP profiles can be added later
 * via the editor's existing controls.)
 */
OSApp.ESP32Mode.showZigBeeScanVariantPopup = function( selectedDevice, discoveredDevices, done ) {
	void discoveredDevices;
	if ( !selectedDevice ) {
		if ( typeof done === "function" ) { done(); }
		return;
	}
	OSApp.ESP32Mode.showZigBeeDeviceEditor( selectedDevice, done );
};

/**
 * Display the ZigBee Gateway management panel.
 * Compact table list, white background, icon-only action buttons, "New" entry button.
 * Response format: { result:1, action:"list", devices:[ {ieee, short_addr, model, manufacturer, endpoint, device_id, is_new, last_rx_s, online} ], count:N }
 */
OSApp.ESP32Mode.showZigBeeGatewayPanel = function( data ) {
	var content = "";
	var supportsEditor = OSApp.ESP32Mode.supportsZigBeeGatewayDeviceEditor();
	var supportsScan = supportsEditor &&
		typeof OSApp.ESP32Mode.showZigBeeScanVariantPopup === "function" &&
		OSApp.Analog && typeof OSApp.Analog.showZigBeeDeviceScanner === "function";

	content += "<div class='ui-content' role='main'>";
	content += "<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;'>";
	content += "<h3 style='margin:0;'>" + OSApp.Language._( "ZigBee Gateway" ) + "</h3>";
	if ( supportsEditor ) {
		content += "<a href='#' class='zigbee-device-new ui-btn ui-btn-inline ui-mini ui-corner-all ui-icon-plus ui-btn-icon-left' style='margin:0;'>" +
			OSApp.Language._( "New" ) + "</a>";
	}
	content += "</div>";

	if ( data.devices && data.devices.length > 0 ) {
		// Compact list using jQuery Mobile native styling (no custom colours).
		// Each row: device name + IEEE tail + status badge + icon-only actions.
		content += "<ul data-role='listview' data-inset='true' style='margin:0;'>";
		for ( var i = 0; i < data.devices.length; i++ ) {
			var dev = data.devices[ i ];
			var isOnline  = dev.online === 1 || dev.online === true;
			var hasRxInfo = dev.last_rx_s !== undefined && dev.last_rx_s !== null;
			var statusIcon = isOnline
				? "<span class='ui-icon ui-icon-check' style='display:inline-block;width:18px;height:18px;background-color:#4caf50;border-radius:50%;vertical-align:middle;' title='" + OSApp.Language._( "Online" ) + "'></span>"
				: ( hasRxInfo
					? "<span style='display:inline-block;width:14px;height:14px;border:2px solid #999;border-radius:50%;vertical-align:middle;' title='" + OSApp.Language._( "Offline" ) + "'></span>"
					: "" );
			var ieeeAttr = dev.ieee ? " data-ieee='" + dev.ieee.replace( /'/g, "" ) + "'" : "";
			var cachedDevLabel = ( dev.ieee && OSApp.ESP32Mode.ZigbeeDeviceDB.getCachedLabel( dev.ieee ) ) || null;
			var deviceTitle = cachedDevLabel || ( ( dev.model && dev.model !== "unknown" ) ? dev.model : OSApp.Language._( "Unknown Device" ) );
			var ieeeShort = dev.ieee ? "\u2026" + dev.ieee.slice( -8 ) : "";
			var liTheme = dev.is_new ? " data-theme='e'" : "";

			content += "<li" + ieeeAttr + liTheme + " style='padding:6px 8px;'>";
			content += "<div style='display:flex;align-items:center;gap:6px;'>";
			// Status badge
			content += "<div style='flex:0 0 auto;'>" + statusIcon + "</div>";
			// Title + IEEE
			content += "<div style='flex:1 1 auto;min-width:0;'>";
			content += "<div class='zg-dev-title' style='font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>" +
				OSApp.Utils.htmlEscape( deviceTitle ) + "</div>";
			content += "<div class='zb-db-info' style='display:none;font-size:0.8em;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'></div>";
			if ( ieeeShort ) {
				content += "<div style='font-family:monospace;font-size:0.75em;color:#888;'>" + ieeeShort + "</div>";
			}
			content += "</div>";
			// Action buttons (compact icon-only)
			if ( dev.ieee ) {
				var ieee4btn = dev.ieee.replace( /'/g, "" );
				content += "<div style='flex:0 0 auto;white-space:nowrap;'>";
				if ( supportsEditor ) {
					content += "<a href='#' class='zigbee-device-edit ui-btn ui-btn-inline ui-mini ui-corner-all ui-icon-edit ui-btn-icon-notext' " +
						"title='" + OSApp.Language._( "Edit" ) + "' data-ieee='" + ieee4btn + "' style='margin:1px;'></a>";
				}
				content += "<a href='#' class='zigbee-device-rejoin ui-btn ui-btn-inline ui-mini ui-corner-all ui-icon-refresh ui-btn-icon-notext' " +
					"title='" + OSApp.Language._( "Force Rejoin" ) + "' data-ieee='" + ieee4btn + "' style='margin:1px;'></a>";
				content += "<a href='#' class='zigbee-device-remove ui-btn ui-btn-inline ui-mini ui-corner-all ui-icon-delete ui-btn-icon-notext' " +
					"title='" + OSApp.Language._( "Remove" ) + "' data-ieee='" + ieee4btn + "' style='margin:1px;'></a>";
				content += "</div>";
			}
			content += "</div>";
			content += "</li>";
		}
		content += "</ul>";
	} else {
		content += "<p style='text-align:center;'>" + OSApp.Language._( "No ZigBee devices paired" ) + "</p>";
	}

	content += "<div style='margin-top:10px;'>";
	if ( supportsScan ) {
		content += "<button class='zigbee-scan-valve ui-btn ui-btn-b ui-corner-all'>" + OSApp.Language._( "Scan for Zigbee Valve" ) + "</button>";
	}
	content += "<button class='zigbee-permit-join ui-btn ui-btn-b ui-corner-all'>" + OSApp.Language._( "Allow ZigBee Pairing" ) + "</button>";
	content += "<button class='cancel-zigbee-gw ui-btn ui-corner-all'>" + OSApp.Language._( "Cancel" ) + "</button>";
	content += "</div></div>";

	var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='zigbeeGatewayPopup' style='max-width:90vw;'>" + content + "</div>" );

	popup.on( "click", ".cancel-zigbee-gw", function() {
		popup.popup( "close" );
		return false;
	} );

	popup.on( "click", ".zigbee-permit-join", function() {
		popup.popup( "close" );
		OSApp.ESP32Mode.zigBeePermitJoin();
		return false;
	} );

	popup.on( "click", ".zigbee-scan-valve", function() {
		var scanBtn = $( this );
		var origText = scanBtn.text();
		scanBtn.prop( "disabled", true );
		OSApp.Analog.showZigBeeDeviceScanner(
			popup,
			function( selectedDevice, discoveredDevices ) {
				scanBtn.prop( "disabled", false ).text( origText );
				OSApp.ESP32Mode.showZigBeeScanVariantPopup( selectedDevice, discoveredDevices, function() {
					OSApp.ESP32Mode.setupZigBeeGateway();
				} );
			},
			function() {
				scanBtn.prop( "disabled", false ).text( origText );
				OSApp.ESP32Mode.setupZigBeeGateway();
			},
			scanBtn,
			origText
		);
		return false;
	} );

	popup.on( "click", ".zigbee-device-new", function() {
		popup.one( "popupafterclose", function() {
			OSApp.ESP32Mode.showZigBeeDeviceEditor(
				{ ieee: "", endpoint: 1, model: "", manufacturer: "", is_tuya: false },
				function() { OSApp.ESP32Mode.setupZigBeeGateway(); }
			);
		} );
		popup.popup( "close" );
		return false;
	} );

	popup.on( "click", ".zigbee-device-edit", function() {
		var ieee = $( this ).data( "ieee" );
		if ( !ieee ) { return false; }
		var selectedDevice = null;
		for ( var ei = 0; ei < data.devices.length; ei++ ) {
			if ( String( data.devices[ ei ].ieee || "" ).toLowerCase() === String( ieee ).toLowerCase() ) {
				selectedDevice = data.devices[ ei ];
				break;
			}
		}
		if ( !selectedDevice ) { return false; }
		popup.one( "popupafterclose", function() {
			OSApp.ESP32Mode.showZigBeeDeviceEditor( selectedDevice, function() {
				OSApp.ESP32Mode.setupZigBeeGateway();
			} );
		} );
		popup.popup( "close" );
		return false;
	} );

	popup.on( "click", ".zigbee-device-rejoin", function() {
		var ieee = $( this ).data( "ieee" );
		if ( ieee ) {
			$.mobile.loading( "show" );
			OSApp.Firmware.sendToOS( "/zg?pw=&action=rejoin_device&ieee=" + encodeURIComponent( ieee ), "json" ).done( function( resp ) {
				$.mobile.loading( "hide" );
				if ( resp && resp.result === 1 ) {
					OSApp.Errors.showMessage( OSApp.Language._( "Device rejoin initiated with sequence reset (60s window)" ) );
				} else {
					var msg = ( resp && resp.message ) ? resp.message : OSApp.Language._( "Failed to initiate device rejoin" );
					OSApp.Errors.showError( msg );
				}
			} ).fail( function() {
				$.mobile.loading( "hide" );
				OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
			} );
		}
		return false;
	} );

	popup.on( "click", ".zigbee-device-remove", function() {
		var ieee = $( this ).data( "ieee" );
		if ( ieee ) {
			var deviceName = $( this ).closest( "tr" ).find( ".zg-dev-title" ).text() || OSApp.Language._( "Device" );
			if ( confirm( OSApp.Language._( "Remove" ) + " " + deviceName + "?" ) ) {
				$.mobile.loading( "show" );
				OSApp.Firmware.sendToOS( "/zg?pw=&action=remove&ieee=" + encodeURIComponent( ieee ), "json" ).done( function( resp ) {
					$.mobile.loading( "hide" );
					if ( resp && resp.result === 1 ) {
						popup.popup( "close" );
						OSApp.ESP32Mode.setupZigBeeGateway();
					} else {
						OSApp.Errors.showError( OSApp.Language._( "Failed to remove device" ) );
					}
				} ).fail( function() {
					$.mobile.loading( "hide" );
					OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
				} );
			}
		}
		return false;
	} );

	OSApp.UIDom.openPopup( popup );

	if ( data.devices ) {
		for ( var j = 0; j < data.devices.length; j++ ) {
			var d = data.devices[ j ];
			if ( d.ieee ) {
				( function( dev ) {
					var $row = popup.find( "tr[data-ieee='" + dev.ieee.replace( /'/g, "" ) + "']" );
					OSApp.ESP32Mode.ZigbeeDeviceDB.enrich( dev, $row );
				}( d ) );
			}
		}
	}
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
			OSApp.ESP32Mode.showZigBeeClientPanel( {
				result: 0,
				active: OSApp.ESP32Mode.isZigBeeClientActive() ? 1 : 0,
				connected: 0,
				statusUnavailable: true,
				error: ( data && data.error ) ? data.error : OSApp.Language._( "Unable to retrieve ZigBee Client information" )
			} );
		}
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.ESP32Mode.showZigBeeClientPanel( {
			result: 0,
			active: OSApp.ESP32Mode.isZigBeeClientActive() ? 1 : 0,
			connected: 0,
			statusUnavailable: true,
			error: OSApp.Language._( "Error connecting to device" )
		} );
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
	if ( data.statusUnavailable ) {
		content += "<p><strong>" + OSApp.Language._( "Status" ) + ":</strong> " + $( "<span>" ).text( data.error ).html() + "</p>";
	} else if ( data.connected ) {
		content += "<p><strong>" + OSApp.Language._( "Status" ) + ":</strong> " + OSApp.Language._( "Connected to ZigBee network" ) + "</p>";
	} else {
		content += "<p><strong>" + OSApp.Language._( "Status" ) + ":</strong> " + OSApp.Language._( "Not connected to ZigBee network" ) + "</p>";
	}

	// Join/Search network button (uses /zj endpoint)
	if ( !data.connected ) {
		content += "<button class='zigbee-join-network ui-btn ui-btn-b ui-corner-all'>" + OSApp.Language._( "Join ZigBee Network" ) + "</button>";
	}
	content += "<button class='zigbee-leave-network ui-btn ui-corner-all' style='background:#fff3f3;color:#b00020;border:1px solid #e0c0c0;'>" +
		OSApp.Language._( "Leave ZigBee Network" ) + "</button>";

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

	popup.on( "click", ".zigbee-leave-network", function() {
		popup.popup( "close" );
		setTimeout( function() {
			OSApp.ESP32Mode.zigBeeLeaveNetwork();
		}, 400 );
		return false;
	} );

	OSApp.UIDom.openPopup( popup );
};

/**
 * Send command to join/search for a ZigBee network (client mode).
 * Uses /zj?pw=&duration=60
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

/**
 * Send command to leave/disconnect from the current ZigBee network (client mode).
 * Uses /zl?pw= and lets the firmware reboot after the leave request.
 */
OSApp.ESP32Mode.zigBeeLeaveNetwork = function() {
	OSApp.UIDom.areYouSure(
		OSApp.Language._( "Are you sure you want to leave the ZigBee network?" ),
		"",
		function() {
			$.mobile.loading( "show" );
			OSApp.Firmware.sendToOS( "/zl?pw=&reboot=1", "json" ).done( function( data ) {
				$.mobile.loading( "hide" );
				if ( data && data.result === 1 ) {
					OSApp.ESP32Mode.clearRadioInfo();
					OSApp.Errors.showError( OSApp.Language._( "Left ZigBee network" ) );
				} else {
					var errorMsg = ( data && data.error ) ? data.error : OSApp.Language._( "Error connecting to device" );
					OSApp.Errors.showError( errorMsg );
				}
			} ).fail( function() {
				$.mobile.loading( "hide" );
				OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
			} );
		}
	);
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
 * Check if Matter feature is available (feature string contains "MATTER")
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
 * Check if Matter feature is supported (feature string contains "MATTER")
 */
OSApp.ESP32Mode.isMatterSupported = function() {
	return OSApp.ESP32Mode.isMatterAvailable();
};

/**
 * Setup Matter — shows a popup with Matter commissioning status and controls.
 * Calls /jm?pw= to retrieve Matter commissioning data, then shows a popup with:
 *  - Current status (commissioned / not commissioned)
 *  - QR code link and manual pairing code (when available)
 *  - Button to open the commissioning window via /mm?pw=
 */
OSApp.ESP32Mode.setupMatter = function() {
	$.mobile.loading( "show" );

	OSApp.Firmware.sendToOS( "/jm?pw=", "json" ).done( function( data ) {
		$.mobile.loading( "hide" );

		if ( !data || !data.matter_enabled ) {
			OSApp.Errors.showError( OSApp.Language._( "Matter is not the active firmware mode. Use Firmware Mode to switch." ) );
			return;
		}

		var content = "<div class='ui-content'>";
		content += "<h3>" + OSApp.Language._( "Matter Setup" ) + "</h3>";

		if ( data.commissioned ) {
			content += "<p>" + OSApp.Language._( "Status" ) + ": <strong>" + OSApp.Language._( "Commissioned" ) + "</strong></p>";
			content += "<button class='matter-remove-commissioning ui-btn ui-btn-b ui-corner-all'>" +
				OSApp.Language._( "Remove Matter Pairing" ) + "</button>";
		} else {
			content += "<p>" + OSApp.Language._( "Status" ) + ": <strong>" + OSApp.Language._( "Not commissioned" ) + "</strong></p>";
			if ( data.pairing_code ) {
				content += "<p>" + OSApp.Language._( "Pairing Code" ) + ": <code>" +
					$( "<span>" ).text( data.pairing_code ).html() + "</code> " +
					"<button class='matter-copy-pairing-code ui-btn ui-btn-inline ui-mini ui-corner-all' " +
					"data-pairing-code='" + $( "<span>" ).text( data.pairing_code ).html() + "'>" +
					OSApp.Language._( "Copy" ) + "</button></p>";
			}
			if ( data.qr_url ) {
				content += "<p><a href='" + data.qr_url + "' target='_blank' class='ui-btn ui-btn-inline ui-mini ui-corner-all'>" +
					OSApp.Language._( "Open QR Code" ) + "</a></p>";
			}
		}

		content += "<button class='matter-open-commissioning ui-btn ui-btn-b ui-corner-all'>" +
			OSApp.Language._( "Open Commissioning Window" ) + "</button>";
		content += "<button class='matter-write-kvs ui-btn ui-corner-all'>" +
			OSApp.Language._( "Write Matter KVS" ) + "</button>";
		content += "<button class='cancel-matter ui-btn ui-corner-all'>" + OSApp.Language._( "Close" ) + "</button>";
		content += "</div>";

		var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='matterSetupPopup'>" + content + "</div>" );

		popup.on( "click", ".cancel-matter", function() {
			popup.popup( "close" );
			return false;
		} );

		popup.on( "click", ".matter-open-commissioning", function() {
			OSApp.ESP32Mode.matterOpenCommissioningWindow();
			return false;
		} );

		popup.on( "click", ".matter-remove-commissioning", function() {
			OSApp.ESP32Mode.matterRemoveCommissioning();
			return false;
		} );

		popup.on( "click", ".matter-copy-pairing-code", function() {
			var pairingCode = $( this ).data( "pairing-code" );
			if ( navigator.clipboard && navigator.clipboard.writeText ) {
				navigator.clipboard.writeText( pairingCode ).then( function() {
					OSApp.Errors.showError( OSApp.Language._( "Pairing Code copied to clipboard" ) );
				} ).catch( function() {
					OSApp.Errors.showError( OSApp.Language._( "Copy failed" ) );
				} );
			} else {
				var tmp = $( "<input>" ).val( pairingCode ).appendTo( "body" );
				tmp[ 0 ].select();
				document.execCommand( "copy" );
				tmp.remove();
				OSApp.Errors.showError( OSApp.Language._( "Pairing Code copied to clipboard" ) );
			}
			return false;
		} );

		popup.on( "click", ".matter-write-kvs", function() {
			OSApp.ESP32Mode.matterWriteKVS();
			return false;
		} );

		OSApp.UIDom.openPopup( popup );
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
	} );
};

/**
 * Send command to open the Matter commissioning window.
 * Uses /mm?pw=&t=300
 */
OSApp.ESP32Mode.matterOpenCommissioningWindow = function() {
	$.mobile.loading( "show" );

	OSApp.Firmware.sendToOS( "/mm?pw=&t=300", "json" ).done( function( data ) {
		$.mobile.loading( "hide" );
		if ( data && data.result === 1 ) {
			OSApp.Errors.showError( OSApp.Language._( "Matter commissioning window opened (300 s). Use your Matter controller app to pair the device." ) );
		} else {
			OSApp.Errors.showError( OSApp.Language._( "Failed to open Matter commissioning window." ) );
		}
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
	} );
};

/**
 * Remove all Matter fabrics/pairings from the device.
 * Uses /md?pw=
 */
OSApp.ESP32Mode.matterRemoveCommissioning = function() {
	var confirmed = confirm(
		OSApp.Language._( "Remove Matter pairing from this device? You will need to remove it from your Matter controller app as well." )
	);
	if ( confirmed ) {
		$.mobile.loading( "show" );

		OSApp.Firmware.sendToOS( "/md?pw=", "json" ).done( function( data ) {
			$.mobile.loading( "hide" );
			if ( data && data.result === 1 ) {
				OSApp.Errors.showError( OSApp.Language._( "Matter pairing removed. The device can be paired again." ) );
				// Refresh the setup popup state to reflect the decimmisioned status
				if ( $( "#matterSetupPopup" ).parent().hasClass( "ui-popup-active" ) ) {
					$( "#matterSetupPopup" ).popup( "close" );
					setTimeout( function() {
						OSApp.ESP32Mode.setupMatter();
					}, 350 );
				}
			} else {
				var err = ( data && data.error ) ? data.error : OSApp.Language._( "Failed to remove Matter pairing." );
				OSApp.Errors.showError( err );
			}
		} ).fail( function() {
			$.mobile.loading( "hide" );
			OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
		} );
	}
};

/**
 * Download matter_kvs.bin and write it to the matter_kvs partition.
 * Uses /mk?pw=
 */
OSApp.ESP32Mode.matterWriteKVS = function() {
	if ( !window.confirm( OSApp.Language._( "Write Matter KVS to device partition now?" ) ) ) {
		return;
	}

	$.mobile.loading( "show" );

	OSApp.Firmware.sendToOS( "/mk?pw=", "json", 120000 ).done( function( data ) {
		$.mobile.loading( "hide" );
		if ( data && data.result === 1 ) {
			var bytes = ( typeof data.written === "number" ) ? data.written : 0;
			OSApp.Errors.showError( OSApp.Language._( "Matter KVS written successfully" ) + " (" + bytes + " bytes)" );
		} else {
			var err = ( data && data.error ) ? data.error : OSApp.Language._( "Failed to write Matter KVS." );
			OSApp.Errors.showError( err );
		}
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
	} );
};

// ============================================================================
// Online Firmware Update
// ============================================================================

/** OTA status code names matching OnlineUpdateStatus enum in online_update.h */
OSApp.ESP32Mode.OTA_STATUS = {
	IDLE: 0,
	CHECKING: 1,
	AVAILABLE: 2,
	UP_TO_DATE: 3,
	DOWNLOADING_ZIGBEE: 4,
	DOWNLOADING_MATTER: 5,
	FLASHING_ZIGBEE: 6,
	FLASHING_MATTER: 7,
	DONE: 8,
	ERROR_NETWORK: 9,
	ERROR_PARSE: 10,
	ERROR_FLASH_ZIGBEE: 11,
	ERROR_FLASH_MATTER: 12,
	REBOOTING_PHASE2: 13,
	REBOOTING_OTA: 14,
	ERROR_LOW_MEMORY: 15
};

/**
 * Format firmware version from numeric form (e.g. 233 → "2.3.3")
 */
OSApp.ESP32Mode.formatFwVersion = function( v ) {
	var major = Math.floor( v / 100 );
	var minor = Math.floor( ( v % 100 ) / 10 );
	var patch = v % 10;
	return major + "." + minor + "." + patch;
};

OSApp.ESP32Mode.getOnlineUpdateVariantLabel = function() {
	if ( OSApp.Firmware.isOSPi() ) {
		return OSApp.Language._( "OSPi Script Update" );
	}
	if ( OSApp.ESP32Mode.isESP32Supported() ) {
		return OSApp.Language._( "ESP32 OTA" );
	}
	return OSApp.Language._( "ESP8266 Direct OTA" );
};

OSApp.ESP32Mode.getInteractiveOTAOptionsHtml = function() {
	var html = "<div class='ota-auto-restore-area' style='margin:10px 0;padding:10px;background:#eef6ea;border-radius:6px;'>" +
		"<label style='display:flex;align-items:center;gap:8px;font-size:0.95em;cursor:pointer;'>" +
		"<input type='checkbox' class='ota-auto-restore' checked='checked'>" +
		OSApp.Language._( "Automatically restore saved configuration after update" ) +
		"</label>" +
		"<div style='font-size:0.82em;color:#666;margin-top:6px;'>" +
		OSApp.Language._( "If enabled, the saved configuration is restored automatically after the device comes back online." ) +
		"</div>" +
		"</div>";

	if ( OSApp.ESP32Mode.isMatterSupported() ) {
		var activeVariant = OSApp.ESP32Mode.isMatterActive() ? "matter" : "zigbee";
		html += "<div class='ota-variant-area' style='margin:10px 0;padding:10px;background:#e8f0fe;border-radius:6px;'>" +
			"<div style='font-size:0.9em;font-weight:bold;margin-bottom:6px;'>" + OSApp.Language._( "Firmware variant to boot after update" ) + ":</div>" +
			"<label style='display:inline-flex;align-items:center;gap:6px;margin-right:16px;cursor:pointer;font-size:0.95em;'>" +
			"<input type='radio' name='ota-variant' value='zigbee'" + ( activeVariant === "zigbee" ? " checked" : "" ) + "> Zigbee" +
			"</label>" +
			"<label style='display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:0.95em;'>" +
			"<input type='radio' name='ota-variant' value='matter'" + ( activeVariant === "matter" ? " checked" : "" ) + "> Matter" +
			"</label>" +
			"<div style='font-size:0.8em;color:#555;margin-top:6px;'>" +
			OSApp.Language._( "Currently active" ) + ": <b>" + activeVariant + "</b></div>" +
			"</div>";
	}

	return html;
};

OSApp.ESP32Mode.ensureOTAProgressArea = function( popup ) {
	if ( !popup.find( "#ota-progress-area" ).length ) {
		popup.find( "#ota-steps" ).after(
			"<div id='ota-progress-area' style='margin:8px 0;'>" +
			"<div style='background:#ddd;border-radius:4px;height:20px;position:relative;'>" +
			"<div id='ota-progress-bar' style='background:#4CAF50;height:100%;border-radius:4px;width:0%;transition:width 0.3s;'></div>" +
			"<span id='ota-progress-pct' style='position:absolute;top:0;left:0;right:0;text-align:center;line-height:20px;font-size:0.85em;font-weight:bold;color:#333;'>0%</span>" +
			"</div>" +
			"<p id='ota-progress-msg' style='font-size:0.85em;margin:4px 0;'></p>" +
			"</div>"
		);
	}
};

OSApp.ESP32Mode.markOTACompleted = function( popup ) {
	popup.data( "otaFlowCompleted", true );
	popup.find( "#ota-progress-bar" ).css( "width", "100%" );
	popup.find( "#ota-progress-pct" ).text( "100%" );
	if ( !popup.find( "#ota-complete-notice" ).length ) {
		popup.find( "#ota-progress-area" ).append(
			"<p id='ota-complete-notice' style='color:#4CAF50;font-weight:bold;margin-top:8px;text-align:center;font-size:0.95em;'>" +
			"&#9989; " + OSApp.Language._( "Update complete! You can now close this dialog." ) +
			"</p>"
		);
	}
	popup.find( ".ota-cancel" ).text( OSApp.Language._( "Close" ) );
};

OSApp.ESP32Mode.stopOTADurationTimer = function( /* popup */ ) {
	// no-op: time-based progress removed
};

OSApp.ESP32Mode.startOTADurationTimer = function( popup ) {
	OSApp.ESP32Mode.ensureOTAProgressArea( popup );
	popup.data( "otaFlowCompleted", false );
};

OSApp.ESP32Mode.restoreFromAppBackupInPopup = function( popup ) {
	var backup = OSApp.ESP32Mode.hasAppBackup();
	if ( !backup ) {
		popup.find( "#ota-step-5" ).css( "color", "#FF9800" ).html(
			"&#9888; " + OSApp.Language._( "No backup found — manual restore needed" )
		);
		OSApp.ESP32Mode.stopOTADurationTimer( popup );
		return;
	}
	popup.find( "#ota-step-5" ).css( "color", "#1976D2" ).html(
		"&#9658; <b>" + OSApp.Language._( "Restoring configuration..." ) + "</b>"
	);
	popup.find( "#ota-progress-msg" ).text( OSApp.Language._( "Applying saved configuration..." ) );

	OSApp.ESP32Mode.restoreFromAppBackup( backup.data, function() {
		OSApp.Sites.updateController( function() {
			OSApp.ESP32Mode.markOTACompleted( popup );
			OSApp.ESP32Mode.stopOTADurationTimer( popup );
			popup.find( "#ota-step-5" ).css( "color", "#4CAF50" ).html(
				"&#9745; " + OSApp.Language._( "Update complete. Configuration restored." )
			);
			popup.find( "#ota-progress-msg" ).text( OSApp.Language._( "Device is back online." ) );
			popup.find( ".ota-cancel" ).text( OSApp.Language._( "Close" ) );
		}, function() {
			OSApp.ESP32Mode.markOTACompleted( popup );
			OSApp.ESP32Mode.stopOTADurationTimer( popup );
			popup.find( "#ota-step-5" ).css( "color", "#4CAF50" ).html(
				"&#9745; " + OSApp.Language._( "Update complete. Configuration restored." )
			);
			popup.find( "#ota-progress-msg" ).text( OSApp.Language._( "Device is back online." ) );
			popup.find( ".ota-cancel" ).text( OSApp.Language._( "Close" ) );
		} );
	}, function() {
		OSApp.ESP32Mode.stopOTADurationTimer( popup );
		popup.find( "#ota-step-5" ).css( "color", "#FF9800" ).html(
			"&#9888; " + OSApp.Language._( "Auto-restore failed" )
		);
		popup.find( "#ota-progress-msg" ).text( OSApp.Language._( "Restore failed." ) );
		popup.find( ".ota-cancel" ).text( OSApp.Language._( "Close" ) );
	} );
};

/**
 * Show the Online Update popup with interactive backup/restore steps.
 * Calls /uc?pw= to check for updates and displays a stepped process:
 *   Step 1: Backup config to app (localStorage) — flash backup is automatic in firmware
 *   Step 2: Start OTA download & flash with progress
 *   Step 3: After reboot, offer config restore
 */
OSApp.ESP32Mode.setupOnlineUpdate = function() {
	if ( !OSApp.Firmware.isOnlineUpdateSupported() ) {
		OSApp.Errors.showError( OSApp.Language._( "Online firmware update requires firmware version 2.4.0 or newer." ) );
		return;
	}

	// OTC sessions cannot use browser upload to port 8080; use the device-side OTA flow.
	if ( OSApp.currentSession && OSApp.currentSession.token ) {
		OSApp.ESP32Mode.setupLegacyOnlineUpdate();
		return;
	}

	$.mobile.loading( "show" );

	// Fetch radio info (needed for variant selector) only on ESP32 devices.
	// fetchRadioInfo uses a cache so it's instant if already loaded.
	// Always resolves (never rejects) to avoid blocking the update-check flow.
	var radioDeferred = $.Deferred();
	if ( OSApp.ESP32Mode.isESP32Supported() ) {
		OSApp.ESP32Mode.fetchRadioInfo( false ).done( function( info ) {
			radioDeferred.resolve( info );
		} ).fail( function() {
			radioDeferred.resolve( null );
		} );
	} else {
		radioDeferred.resolve( null );
	}

	// Use the shared OTA checker so this dialog stays consistent with the
	// firmware overview and can fall back to versions.json when needed.
	$.when( radioDeferred, OSApp.Firmware.checkOTAUpdate( true ) ).done( function( radioResult, data ) {
		$.mobile.loading( "hide" );

		if ( !data || typeof data.status === "undefined" ) {
			OSApp.Errors.showError( OSApp.Language._( "Error checking for updates" ) );
			return;
		}

		// Handle firmware-side errors (e.g. device can't reach update server)
		var st = OSApp.ESP32Mode.OTA_STATUS;
		if ( data.available !== 1 && ( data.status === st.ERROR_NETWORK || data.status === st.ERROR_PARSE ) ) {
			var errMsg = data.status === st.ERROR_NETWORK
				? OSApp.Language._( "Device could not reach the update server. Check internet connection." )
				: OSApp.Language._( "Failed to parse update information from server." );
			OSApp.Errors.showError( errMsg );
			return;
		}

		var curVer = OSApp.ESP32Mode.formatFwVersion( data.cur_version ) + "." + data.cur_minor;
		var variantLabel = OSApp.ESP32Mode.getOnlineUpdateVariantLabel();
		var content = "<div class='ui-content'>";
		content += "<h3>" + OSApp.Language._( "Online Firmware Update" ) + " - " + variantLabel + "</h3>";
		content += "<p><b>" + OSApp.Language._( "Current version" ) + ":</b> " + curVer;
		if ( data.available === 1 ) {
			var newVer = OSApp.ESP32Mode.formatFwVersion( data.fw_version ) + "." + data.fw_minor;
			content += " &nbsp; | &nbsp; <b>" + OSApp.Language._( "New version" ) + ":</b> " + newVer;
		}
		content += "</p>";

		if ( data.available === 1 ) {
			content += "<p style='color:green;font-weight:bold;'>" + OSApp.Language._( "Update available" ) + ": " + newVer + "</p>";
			if ( data.changelog ) {
				content += "<p><b>" + OSApp.Language._( "Changelog" ) + ":</b><br>" + $( "<span>" ).text( data.changelog ).html() + "</p>";
			}

			// Step indicator
			content += "<div id='ota-steps' style='margin:12px 0;padding:8px;background:#f0f0f0;border-radius:4px;font-size:0.9em;'>";
			content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Update Process" ) + ":</b></p>";
			content += "<p id='ota-step-1' style='margin:2px 0;color:#999;'>" +
				"&#9744; " + OSApp.Language._( "Step 1: Backup configuration" ) + "</p>";
			content += "<p id='ota-step-2' style='margin:2px 0;color:#999;'>" +
				"&#9744; " + OSApp.Language._( "Step 2: Flash partition 1" ) + "</p>";
			content += "<p id='ota-step-3' style='margin:2px 0;color:#999;'>" +
				"&#9744; " + OSApp.Language._( "Step 3: Reboot for phase 2" ) + "</p>";
			content += "<p id='ota-step-4' style='margin:2px 0;color:#999;'>" +
				"&#9744; " + OSApp.Language._( "Step 4: Flash partition 2" ) + "</p>";
			content += "<p id='ota-step-5' style='margin:2px 0;color:#999;'>" +
				"&#9744; " + OSApp.Language._( "Step 5: Reboot & verify" ) + "</p>";
			content += "</div>";
			content += OSApp.ESP32Mode.getInteractiveOTAOptionsHtml();

			content += "<button class='ota-start-interactive ui-btn ui-btn-b'>" + OSApp.Language._( "Start Update" ) + "</button>";
			content += "<button class='ota-reinstall ui-btn ui-mini' style='margin-top:4px;'>" +
				OSApp.Language._( "Reinstall current version" ) + "</button>";
			content += "<button class='ota-older-version ui-btn ui-mini' style='margin-top:4px;'>" +
				OSApp.Language._( "Install older version..." ) + "</button>";
		} else {
			content += "<p style='color:green;'>&#9745; " + OSApp.Language._( "Firmware is up to date" ) + "</p>";
			content += "<button class='ota-reinstall ui-btn ui-mini ui-btn-b' style='margin-top:4px;'>" +
				OSApp.Language._( "Reinstall current version" ) + "</button>";
			content += "<button class='ota-older-version ui-btn ui-mini' style='margin-top:4px;'>" +
				OSApp.Language._( "Install older version..." ) + "</button>";
		}

		content += "<button class='ota-cancel ui-btn'>" + OSApp.Language._( "Close" ) + "</button>";
		content += "</div>";

		var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='otaUpdatePopup'>" + content + "</div>" );

		popup.on( "click", ".ota-cancel", function() {
			if ( !popup.data( "otaFlowCompleted" ) && popup.find( "#ota-progress-area" ).length ) {
				OSApp.UIDom.areYouSure(
					OSApp.Language._( "The firmware update is still running in the background. Are you sure you want to close this window?" ),
					"",
					function() {
						OSApp.ESP32Mode.stopOTADurationTimer( popup );
						popup.popup( "close" );
					}
				);
				return false;
			}
			OSApp.ESP32Mode.stopOTADurationTimer( popup );
			popup.popup( "close" );
			return false;
		} );

		popup.on( "click", ".ota-start-interactive", function() {
			$( this ).prop( "disabled", true ).addClass( "ui-state-disabled" );
			var variantParam = "";
			var selectedVariant = popup.find( "input[name='ota-variant']:checked" ).val();
			if ( selectedVariant ) { variantParam = "&vt=" + encodeURIComponent( selectedVariant ); }
			OSApp.ESP32Mode.runInteractiveOTA( popup, variantParam );
			return false;
		} );

		popup.on( "click", ".ota-reinstall", function() {
			$( this ).prop( "disabled", true ).addClass( "ui-state-disabled" );
			popup.find( ".ota-older-version" ).prop( "disabled", true ).addClass( "ui-state-disabled" );
			// Build the step-indicator and pass current manifest URLs (no override needed — firmware uses cached manifest)
			OSApp.ESP32Mode.showInteractiveOTAfromManifest( popup );
			return false;
		} );

		popup.on( "click", ".ota-older-version", function() {
			popup.popup( "close" );
			setTimeout( function() {
				OSApp.ESP32Mode.showVersionPicker( data );
			}, 400 );
			return false;
		} );

		OSApp.UIDom.openPopup( popup );
	} ).fail( function( e ) {
		$.mobile.loading( "hide" );
		var msg = ( e && e.status === 401 )
			? OSApp.Language._( "Check device password and try again." )
			: OSApp.Language._( "Error connecting to device. The update check may take up to 20 seconds." );
		OSApp.Errors.showError( msg );
	} );
};

/**
 * Build a direct device base URL for classic firmware upload pages.
 * Handles Cordova localhost edge cases by falling back to controller network IP.
 */
OSApp.ESP32Mode.getDirectDeviceBaseUrl = function() {
	var rawIp = ( OSApp.currentSession && OSApp.currentSession.ip ) ? String( OSApp.currentSession.ip ).trim() : "";
	var prefix = ( OSApp.currentSession && OSApp.currentSession.prefix ) ? String( OSApp.currentSession.prefix ).trim() : "http://";

	if ( /^https?:$/i.test( prefix ) ) {
		prefix += "//";
	} else if ( /^https?$/i.test( prefix ) ) {
		prefix += "://";
	}

	if ( !/^https?:\/\//i.test( prefix ) ) {
		prefix = "http://";
	}

	prefix = /^https:/i.test( prefix ) ? "https://" : "http://";

	if ( /^https?:\/\//i.test( rawIp ) ) {
		return rawIp.replace( /\/+$/, "" );
	}

	var isLocalHostIp = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test( rawIp );
	if ( isLocalHostIp ) {
		var opts = OSApp.currentSession && OSApp.currentSession.controller && OSApp.currentSession.controller.options;
		if ( opts && typeof opts.ip1 !== "undefined" ) {
			var ipParts = [ opts.ip1, opts.ip2, opts.ip3, opts.ip4 ];
			if ( ipParts.join( "." ) !== "0.0.0.0" ) {
				rawIp = ipParts.join( "." );
			}
		}
	}

	if ( !rawIp ) {
		return prefix.replace( /\/+$/, "" );
	}

	return ( prefix + rawIp ).replace( /\/+$/, "" );
};

OSApp.ESP32Mode.getDirectDeviceUpdateUrl = function() {
	return OSApp.ESP32Mode.getDirectDeviceBaseUrl() + "/update";
};

OSApp.ESP32Mode.getDirectDeviceUploadUrl = function() {
	var baseUrl = OSApp.ESP32Mode.getDirectDeviceBaseUrl();
	var match = baseUrl.match( /^https?:\/\/([^/:]+)(?::\d+)?/i );
	var host = match ? match[ 1 ] : "";

	if ( !host ) {
		var looseMatch = String( baseUrl || "" ).match( /^(?:https?:\/\/)?([^/:?#]+)(?::\d+)?/i );
		host = looseMatch ? looseMatch[ 1 ] : "";
	}

	if ( host ) {
		// The update server on port 8080 only supports HTTP — always use http://
		return "http://" + host + ":8080/update";
	}

	return "";
};

OSApp.ESP32Mode.getClassicUpdateOptionsHtml = function() {
	var html = "<div class='ota-auto-restore-area' style='margin:10px 0;padding:10px;background:#eef6ea;border-radius:6px;'>" +
		"<label style='display:flex;align-items:center;gap:8px;font-size:0.95em;cursor:pointer;'>" +
		"<input type='checkbox' class='ota-auto-restore' checked='checked'>" +
		OSApp.Language._( "Automatically restore saved configuration after update" ) +
		"</label>" +
		"</div>";

	if ( OSApp.ESP32Mode.isESP32Supported() && !OSApp.Firmware.isESP8266Controller() ) {
		html += "<div style='margin:10px 0;padding:10px;background:#e8f0fe;border-radius:6px;font-size:0.85em;color:#555;'>" +
			OSApp.Language._( "Both firmware variants (Zigbee and Matter) will be updated sequentially." ) +
			"</div>";
	}

	return html;
};

OSApp.ESP32Mode.sanitizeClassicUploadChangelog = function( changelog ) {
	if ( !changelog ) return "";

	// Preserve changelog content exactly as delivered (no trimming/cropping)
	return String( changelog );
};

OSApp.ESP32Mode.getClassicPostedFirmwareUrl = function( entry, variant ) {
	var source = entry || {};

	if ( OSApp.Firmware.isESP8266Controller() ) {
		return source.esp8266_url || "";
	}

	if ( variant === "matter" ) {
		return source.matter_url || "";
	}

	return source.zigbee_url || "";
};

OSApp.ESP32Mode.getClassicUpdateEntryLabel = function( entry ) {
	if ( !entry ) {
		var curFwv = OSApp.currentSession.controller.options.fwv || 0;
		var curFwm = OSApp.currentSession.controller.options.fwm || 0;
		return OSApp.ESP32Mode.formatFwVersion( curFwv ) + "." + curFwm;
	}

	return OSApp.ESP32Mode.formatFwVersion( entry.fw_version ) + "." + ( entry.fw_minor || 0 );
};

OSApp.ESP32Mode.getClassicDefaultEntry = function( data ) {
	if ( !data ) {
		return null;
	}

	return data.latest_entry || data.current_entry || ( data.available === 1 ? data : null );
};

OSApp.ESP32Mode.buildClassicUpdateStepsHtml = function() {
	var isDual = OSApp.ESP32Mode.isESP32Supported() && !OSApp.Firmware.isESP8266Controller();

	return "<div id='ota-steps' style='display:none;margin:12px 0;padding:8px;background:#f0f0f0;border-radius:4px;font-size:0.9em;'>" +
		"<p style='margin:2px 0;'><b>" + OSApp.Language._( "Update Process" ) + ":</b></p>" +
		"<p id='ota-step-1' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 1: Backup configuration" ) + "</p>" +
		"<p id='ota-step-2' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 2: Download firmware image" ) + ( isDual ? " (Zigbee)" : "" ) + "</p>" +
		"<p id='ota-step-3' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 3: Upload firmware to device" ) + ( isDual ? " (Zigbee)" : "" ) + "</p>" +
		( isDual
			? "<p id='ota-step-3b' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 3b: Upload Matter firmware" ) + "</p>"
			: ""
		) +
		"<p id='ota-step-4' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 4: Wait for device reboot" ) + "</p>" +
		"<p id='ota-step-5' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 5: Restore configuration" ) + "</p>" +
		"</div>" +
		"<div id='ota-progress-area' style='display:none;margin:12px 0;padding:8px;background:#f0f0f0;border-radius:4px;'>" +
		"<div style='background:#ddd;border-radius:4px;height:20px;position:relative;'>" +
		"<div id='ota-progress-bar' style='background:#4CAF50;height:100%;border-radius:4px;width:0%;transition:width 0.3s;'></div>" +
		"<span id='ota-progress-pct' style='position:absolute;top:0;left:0;right:0;text-align:center;line-height:20px;font-size:0.85em;font-weight:bold;color:#333;'>0%</span>" +
		"</div>" +
		"<p id='ota-progress-msg' style='font-size:0.85em;margin:4px 0;'></p>" +
		"</div>";
};

OSApp.ESP32Mode.openClassicUpdatePopup = function( data, selectedEntry ) {
	var isOtcConnection = !!OSApp.currentSession.token;
	var curVer = OSApp.ESP32Mode.formatFwVersion( data.cur_version ) + "." + data.cur_minor;
	var variantLabel = OSApp.Language._( "Direct Firmware Upload" );
	var targetEntry = selectedEntry || null;
	var latestEntry = OSApp.ESP32Mode.getClassicDefaultEntry( data );
	var currentEntry = data && data.current_entry ? data.current_entry : null;
	var content = "<div class='ui-content'>";
	content += "<h3>" + OSApp.Language._( "Online Firmware Update" ) + " - " + variantLabel + "</h3>";
	content += "<p><b>" + OSApp.Language._( "Current version" ) + ":</b> " + curVer + "</p>";

	if ( targetEntry ) {
		content += "<p style='color:#1976d2;font-weight:bold;'>" +
			OSApp.Language._( "Selected version" ) + ": " +
			OSApp.ESP32Mode.getClassicUpdateEntryLabel( targetEntry ) + "</p>";
	} else if ( data.available === 1 ) {
		var classicNewVer = OSApp.ESP32Mode.formatFwVersion( data.fw_version ) + "." + data.fw_minor;
		content += "<p style='color:green;font-weight:bold;'>" +
			OSApp.Language._( "Update available" ) + ": " + classicNewVer + "</p>";
	} else {
		content += "<p style='color:green;font-weight:bold;'>" + OSApp.Language._( "Firmware is up to date" ) + "</p>";
	}

	var classicChangelog = "";
	if ( targetEntry && targetEntry.changelog ) {
		classicChangelog = targetEntry.changelog;
	} else if ( data.latest_entry && data.latest_entry.changelog ) {
		classicChangelog = data.latest_entry.changelog;
	} else {
		classicChangelog = data.changelog || "";
	}

	if ( classicChangelog ) {
		var filteredClassicChangelog = OSApp.ESP32Mode.sanitizeClassicUploadChangelog( classicChangelog );
		content += "<div style='max-height:150px;overflow-y:auto;border:1px solid #ccc;padding:8px;margin:8px 0;font-size:0.85em;white-space:pre-wrap;'>" +
			$( "<span>" ).text( filteredClassicChangelog ).html() + "</div>";
	}

	if ( isOtcConnection ) {
		content += "<div style='margin:12px 0;padding:10px;background:#e8f0fe;color:#1f4fa3;border-radius:6px;'>" +
			OSApp.Language._( "OTC connection detected. The update will run via device-side online update flow." ) +
			"</div>";
	}

	content += OSApp.ESP32Mode.getClassicUpdateOptionsHtml();
	content += OSApp.ESP32Mode.buildClassicUpdateStepsHtml();

	if ( !isOtcConnection ) {
		if ( targetEntry ) {
			content += "<button class='classic-ota-start classic-ota-action ui-btn ui-btn-b'>" + OSApp.Language._( "Install Selected Version" ) + "</button>";
		} else {
			if ( latestEntry ) {
				content += "<button class='classic-ota-start classic-ota-action ui-btn ui-btn-b'>" + ( data.available === 1 ? OSApp.Language._( "Start Update" ) : OSApp.Language._( "Install Latest Version" ) ) + "</button>";
			}
			if ( currentEntry ) {
				content += "<button class='classic-ota-reinstall classic-ota-action ui-btn'>" + OSApp.Language._( "Reinstall current version" ) + "</button>";
			}
			content += "<button class='classic-ota-older classic-ota-action ui-btn'>" + OSApp.Language._( "Install older version..." ) + "</button>";
		}
	} else {
		content += "<button class='classic-ota-legacy ui-btn ui-btn-b'>" + OSApp.Language._( "Start Update" ) + "</button>";
	}

	content += "<button class='ota-cancel ui-btn'>" + OSApp.Language._( "Close" ) + "</button>";
	content += "</div>";

	var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='classicOtaPopup'>" + content + "</div>" );

	popup.on( "click", ".ota-cancel", function() {
		popup.popup( "close" );
		return false;
	} );

	popup.on( "click", ".classic-ota-start", function() {
		OSApp.ESP32Mode.runClassicPostedUpdate( popup, targetEntry || latestEntry );
		return false;
	} );

	popup.on( "click", ".classic-ota-legacy", function() {
		popup.popup( "close" );
		setTimeout( function() {
			OSApp.ESP32Mode.setupLegacyOnlineUpdate();
		}, 300 );
		return false;
	} );

	popup.on( "click", ".classic-ota-reinstall", function() {
		OSApp.ESP32Mode.runClassicPostedUpdate( popup, currentEntry );
		return false;
	} );

	popup.on( "click", ".classic-ota-older", function() {
		popup.popup( "close" );
		setTimeout( function() {
			OSApp.ESP32Mode.showClassicVersionPicker( data );
		}, 400 );
		return false;
	} );

	OSApp.UIDom.openPopup( popup );
};

OSApp.ESP32Mode.showClassicVersionPicker = function( checkData ) {
	var versionsUrl = ( checkData && checkData.versions_url )
		? checkData.versions_url
		: OSApp.Firmware.getVersionCatalogUrl();

	// Force HTTPS only if the current page is loaded over HTTPS to prevent Mixed Content blocking,
	// while allowing HTTP for environments where HTTPS might fail/resolve incorrectly.
	if ( window.location.protocol === "https:" && versionsUrl && versionsUrl.indexOf( "http://" ) === 0 ) {
		versionsUrl = versionsUrl.replace( "http://", "https://" );
	}

	$.mobile.loading( "show" );
	$.ajax( { url: versionsUrl, dataType: "json", timeout: 10000 } ).done( function( versions ) {
		$.mobile.loading( "hide" );

		if ( !versions || !versions.length ) {
			OSApp.Errors.showError( OSApp.Language._( "No version history available" ) );
			return;
		}

		var current = OSApp.Firmware.getOTACurrentVersion();
		var content = "<div class='ui-content'>";
		content += "<h3>" + OSApp.Language._( "Install Older Version" ) + "</h3>";
		content += "<ul data-role='listview' data-inset='true' id='ota-version-list' style='margin:8px 0;'>";
		versions.forEach( function( v ) {
			var isCurrent = v.fw_version === current.fwv && ( v.fw_minor || 0 ) === current.fwm;
			var verLabel = OSApp.ESP32Mode.getClassicUpdateEntryLabel( v );
			content += "<li><a href='#' class='classic-version-item' data-index='" + versions.indexOf( v ) + "'>" +
				"<b>" + verLabel + "</b>" +
				( isCurrent ? " <span style='font-size:0.8em;color:#4CAF50;'>[" + OSApp.Language._( "current" ) + "]</span>" : "" ) +
				( v.date ? " <span style='font-size:0.8em;color:#999;'>" + v.date + "</span>" : "" ) +
				( v.changelog ? "<p class='ui-li-desc' style='white-space:pre-wrap;'>" + $( "<span>" ).text( v.changelog ).html() + "</p>" : "" ) +
				"</a></li>";
		} );
		content += "</ul>";
		content += "<button class='ota-version-cancel ui-btn'>&#8592; " + OSApp.Language._( "Back" ) + "</button>";
		content += "</div>";

		var picker = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='classicVersionPicker' style='max-height:80vh;overflow-y:auto;width:90vw;max-width:480px;'>" + content + "</div>" );

		picker.on( "click", ".ota-version-cancel", function() {
			picker.popup( "close" );
			return false;
		} );

		picker.on( "click", ".classic-version-item", function() {
			var selected = versions[ parseInt( $( this ).data( "index" ), 10 ) ];
			picker.popup( "close" );
			setTimeout( function() {
				OSApp.ESP32Mode.openClassicUpdatePopup( checkData, selected );
			}, 400 );
			return false;
		} );

		OSApp.UIDom.openPopup( picker );
		picker.trigger( "create" );
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error loading version history" ) );
	} );
};

OSApp.ESP32Mode.fetchClassicFirmwareBlob = function( url ) {
	var defer = $.Deferred();

	function doFetch( fetchUrl, allowHttpFallback ) {
		var xhr = new XMLHttpRequest();
		xhr.open( "GET", fetchUrl, true );
		xhr.responseType = "blob";
		xhr.timeout = 300000;
		xhr.onload = function() {
			if ( xhr.status >= 200 && xhr.status < 300 && xhr.response ) {
				defer.resolve( xhr.response );
			} else {
				defer.reject( new Error( "download-status-" + xhr.status ) );
			}
		};
		xhr.onerror = function() {
			// If the HTTPS download failed and the URL supports an HTTP fallback, retry once.
			if ( allowHttpFallback && fetchUrl.indexOf( "https://" ) === 0 ) {
				doFetch( fetchUrl.replace( "https://", "http://" ), false );
			} else {
				defer.reject( new Error( "download-error" ) );
			}
		};
		xhr.ontimeout = function() {
			defer.reject( new Error( "download-timeout" ) );
		};
		xhr.send();
	}

	doFetch( url, true );
	return defer.promise();
};

OSApp.ESP32Mode.uploadClassicFirmwareBlob = function( blob, filename, variant ) {
	var defer = $.Deferred();
	var xhr = new XMLHttpRequest();
	var formData = new FormData();

	formData.append( "file", blob, filename );
	formData.append( "pw", OSApp.currentSession.pass || "" );
	if ( !OSApp.Firmware.isESP8266Controller() && variant ) {
		formData.append( "slot", variant );
	}

	xhr.open( "POST", OSApp.ESP32Mode.getDirectDeviceUploadUrl(), true );
	xhr.timeout = 300000;
	xhr.onload = function() {
		var resp = null;
		try {
			resp = JSON.parse( xhr.responseText );
		} catch {
			resp = null;
		}

		if ( xhr.status >= 200 && xhr.status < 300 && resp && ( resp.result === 0 || resp.result === 1 ) ) {
			defer.resolve( resp );
		} else {
			defer.reject( resp && resp.result === 2 ? OSApp.Language._( "Authentication failed. Check device password and try again." ) : OSApp.Language._( "Firmware upload failed." ) );
		}
	};
	xhr.onerror = function() {
		defer.reject( OSApp.Language._( "A network error occurred during the upload." ) );
	};
	xhr.ontimeout = function() {
		defer.reject( OSApp.Language._( "Upload timed out. Please try again." ) );
	};
	xhr.upload.onprogress = function( evt ) {
		if ( evt.lengthComputable ) {
			defer.notify( Math.max( 35, Math.min( 90, Math.round( 35 + ( evt.loaded / evt.total ) * 55 ) ) ) );
		}
	};
	xhr.send( formData );

	return defer.promise();
};

/**
 * Wait for device to come back online after a firmware upload + reboot.
 * Polls /jc until the device responds, then calls onReady().
 * Calls onFail() if the device doesn't respond within ~90 seconds.
 */
OSApp.ESP32Mode.waitForDeviceReady = function( onReady, onFail ) {
	var baseUrl = OSApp.ESP32Mode.getDirectDeviceBaseUrl();
	var originalPass = OSApp.currentSession.pass;
	var defaultPass = md5( "opendoor" );
	var pollCount = 0;
	var maxPolls = 30;
	var polling = false;

	// Wait 7 seconds before first poll (device needs time to reboot)
	setTimeout( function() {
		var rebootPoll = setInterval( function() {
			if ( polling ) { return; }
			pollCount++;
			if ( pollCount > maxPolls ) {
				clearInterval( rebootPoll );
				onFail();
				return;
			}

			polling = true;
			var tryPass = ( pollCount % 2 === 1 ) ? originalPass : defaultPass;

			$.ajax( {
				url: baseUrl + "/jc?pw=" + encodeURIComponent( tryPass ),
				type: "GET",
				dataType: "json",
				timeout: 3000
			} ).done( function( resp ) {
				polling = false;
				if ( !resp ) { return; }
				// result === 2 means auth failed — keep polling with the other password
				if ( resp.result === 2 ) { return; }
				clearInterval( rebootPoll );
				OSApp.currentSession.pass = tryPass;
				onReady();
			} ).fail( function() {
				polling = false;
			} );
		}, 3000 );
	}, 7000 );
};

OSApp.ESP32Mode.waitForClassicUploadReboot = function( popup ) {
	var originalPass = OSApp.currentSession.pass;
	var defaultPass = md5( "opendoor" );
	var baseUrl = OSApp.ESP32Mode.getDirectDeviceBaseUrl();
	var pollCount = 0;
	var maxPolls = 120;
	var polling = false;
	var autoRestore = popup.find( ".ota-auto-restore" ).prop( "checked" );
	var backup = OSApp.ESP32Mode.hasAppBackup();

	popup.find( "#ota-step-4" ).css( "color", "#1976D2" ).html(
		"&#9658; <b>" + OSApp.Language._( "Waiting for device reboot..." ) + "</b>"
	);
	popup.find( "#ota-progress-bar" ).css( "width", "92%" );
	popup.find( "#ota-progress-pct" ).text( "92%" );
	popup.find( "#ota-progress-msg" ).text( OSApp.Language._( "Waiting for device to come back online..." ) );

	setTimeout( function() {
		var rebootPoll = setInterval( function() {
			if ( polling ) { return; }
			pollCount++;
			if ( pollCount > maxPolls ) {
				clearInterval( rebootPoll );
				popup.find( "#ota-step-4" ).css( "color", "#FF9800" ).html(
					"&#9888; " + OSApp.Language._( "Device rebooting — reconnect when ready" )
				);
				popup.find( "#ota-progress-msg" ).text( OSApp.Language._( "The upload finished, but the device did not come back online in time." ) );
				popup.find( ".ota-cancel" ).text( OSApp.Language._( "Close" ) );
				return;
			}

			polling = true;
			var tryPass = ( pollCount % 2 === 1 ) ? originalPass : defaultPass;

			$.ajax( {
				url: baseUrl + "/jc?pw=" + encodeURIComponent( tryPass ),
				type: "GET",
				dataType: "json",
				timeout: 3000
			} ).done( function( resp ) {
				polling = false;
				if ( !resp ) { return; }

				clearInterval( rebootPoll );
				OSApp.currentSession.pass = tryPass;
				popup.find( "#ota-step-4" ).css( "color", "#4CAF50" ).html(
					"&#9745; " + OSApp.Language._( "Device rebooted successfully" )
				);
				popup.find( "#ota-progress-msg" ).text( OSApp.Language._( "Device is back online." ) );

				if ( backup && autoRestore ) {
					popup.find( "#ota-step-5" ).css( "color", "#1976D2" ).html(
						"&#9658; <b>" + OSApp.Language._( "Restoring configuration..." ) + "</b>"
					);
					OSApp.ESP32Mode.directRestoreAfterOTA( backup.data, tryPass, function() {
						localStorage.removeItem( OSApp.ESP32Mode.OTA_BACKUP_KEY );
						OSApp.ESP32Mode.markOTACompleted( popup );
						popup.find( "#ota-step-5" ).css( "color", "#4CAF50" ).html(
							"&#9745; " + OSApp.Language._( "Configuration restored" )
						);
						popup.find( ".ota-cancel" ).text( OSApp.Language._( "Close" ) );
						OSApp.Storage.setItemSync( "otaUpdateCheck", "" );
						OSApp.Firmware._otaCache = null;
						OSApp.Sites.updateController( function() {
							OSApp.UIDom.goHome();
						} );
					}, function() {
						popup.find( "#ota-step-5" ).css( "color", "#FF9800" ).html(
							"&#9888; " + OSApp.Language._( "Auto-restore failed" )
						);
						popup.find( ".ota-cancel" ).text( OSApp.Language._( "Close" ) );
					} );
				} else {
					OSApp.ESP32Mode.markOTACompleted( popup );
					popup.find( "#ota-step-5" ).css( "color", backup ? "#FF9800" : "#4CAF50" ).html(
						backup
							? "&#9888; " + OSApp.Language._( "Configuration backup kept for manual restore" )
							: "&#9745; " + OSApp.Language._( "Update complete" )
					);
					popup.find( ".ota-cancel" ).text( OSApp.Language._( "Close" ) );
					OSApp.Storage.setItemSync( "otaUpdateCheck", "" );
					OSApp.Firmware._otaCache = null;
					OSApp.Sites.updateController();
				}
			} ).fail( function() {
				polling = false;
			} );
		}, 3000 );
	}, 7000 );
};


OSApp.ESP32Mode.runClassicPostedUpdate = function( popup, versionEntry ) {
	var isDual = OSApp.ESP32Mode.isESP32Supported() && !OSApp.Firmware.isESP8266Controller();
	var source = versionEntry || {};
	var currentMode = OSApp.ESP32Mode.getCurrentMode();
	var currentVariantIsMatter = ( currentMode === OSApp.ESP32Mode.MODE_MATTER );

	// For ESP32 dual-partition: upload the non-running variant first so the
	// running slot is not targeted before the reboot completes.
	// For ESP8266 or single-partition: upload one firmware only
	var uploads = [];
	if ( isDual ) {
		if ( currentVariantIsMatter ) {
			if ( source.zigbee_url ) {
				uploads.push( { url: source.zigbee_url, slot: "zigbee", label: "Zigbee" } );
			}
			if ( source.matter_url ) {
				uploads.push( { url: source.matter_url, slot: "matter", label: "Matter" } );
			}
		} else {
			if ( source.matter_url ) {
				uploads.push( { url: source.matter_url, slot: "matter", label: "Matter" } );
			}
			if ( source.zigbee_url ) {
				uploads.push( { url: source.zigbee_url, slot: "zigbee", label: "Zigbee" } );
			}
		}
	} else if ( OSApp.Firmware.isESP8266Controller() ) {
		if ( source.esp8266_url ) {
			// ESP8266 devices cannot handle TLS (BearSSL buffer overflow with Ionos).
			// The app can download the binary fine; use plain HTTP to avoid any
			// WebView/browser TLS issues too.
			var esp8266DlUrl = source.esp8266_url.replace( /^https:\/\//i, "http://" );
			uploads.push( { url: esp8266DlUrl, slot: "", label: "ESP8266" } );
		}
	} else {
		if ( source.zigbee_url ) {
			uploads.push( { url: source.zigbee_url, slot: "zigbee", label: "Zigbee" } );
		}
	}

	if ( uploads.length === 0 ) {
		OSApp.Errors.showError( OSApp.Language._( "No firmware download URL available." ) );
		return;
	}

	OSApp.ESP32Mode.startOTADurationTimer( popup );
	popup.find( "#ota-steps, #ota-progress-area" ).show();
	popup.find( ".classic-ota-action" ).prop( "disabled", true ).addClass( "ui-state-disabled" );
	popup.find( "#ota-progress-msg" ).css( "color", "" );

	var uploadIndex = 0;

	var doUpload = function() {
		var current = uploads[ uploadIndex ];
		var isFirst = ( uploadIndex === 0 );
		var isLast  = ( uploadIndex === uploads.length - 1 );
		var stepLabel = isDual ? " (" + current.label + ")" : "";
		var filename = current.url.split( "/" ).pop() || "firmware.bin";

		// Step label for download
		var dlStep = isFirst ? "#ota-step-2" : "#ota-step-3b";
		var ulStep = isFirst ? "#ota-step-3" : "#ota-step-3b";

		popup.find( dlStep ).css( "color", "#1976D2" ).html(
			"&#9658; <b>" + OSApp.Language._( "Downloading firmware image..." ) + stepLabel + "</b>"
		);
		var dlPct = isDual ? ( isFirst ? "10%" : "48%" ) : "15%";
		popup.find( "#ota-progress-bar" ).css( "width", dlPct );
		popup.find( "#ota-progress-pct" ).text( dlPct );
		popup.find( "#ota-progress-msg" ).text( OSApp.Language._( "Downloading firmware image..." ) + stepLabel );

		OSApp.ESP32Mode.fetchClassicFirmwareBlob( current.url ).done( function( blob ) {
			popup.find( dlStep ).css( "color", "#4CAF50" ).html(
				"&#9745; " + OSApp.Language._( "Firmware image downloaded" ) + stepLabel
			);

			if ( isFirst && isDual ) {
				popup.find( ulStep ).css( "color", "#1976D2" ).html(
					"&#9658; <b>" + OSApp.Language._( "Uploading firmware to device..." ) + stepLabel + "</b>"
				);
			} else if ( !isDual ) {
				popup.find( ulStep ).css( "color", "#1976D2" ).html(
					"&#9658; <b>" + OSApp.Language._( "Uploading firmware to device..." ) + "</b>"
				);
			}
			popup.find( "#ota-progress-msg" ).text( OSApp.Language._( "Uploading firmware to device..." ) + stepLabel );

			OSApp.ESP32Mode.uploadClassicFirmwareBlob( blob, filename, current.slot ).progress( function( progress ) {
				var scaledPct;
				if ( isDual ) {
					// Map raw 35-90 to: first upload 10-45%, second upload 50-85%
					var ratio = Math.max( 0, Math.min( 1, ( progress - 35 ) / 55 ) );
					scaledPct = isFirst
						? Math.round( 10 + ratio * 35 )
						: Math.round( 50 + ratio * 35 );
				} else {
					scaledPct = progress;
				}
				popup.find( "#ota-progress-bar" ).css( "width", scaledPct + "%" );
				popup.find( "#ota-progress-pct" ).text( scaledPct + "%" );
			} ).done( function() {
				if ( isFirst && isDual ) {
					popup.find( ulStep ).css( "color", "#4CAF50" ).html(
						"&#9745; " + OSApp.Language._( "Firmware uploaded to device" ) + stepLabel
					);
				} else if ( !isDual ) {
					popup.find( ulStep ).css( "color", "#4CAF50" ).html(
						"&#9745; " + OSApp.Language._( "Firmware uploaded to device" )
					);
				}

				if ( !isLast ) {
					// Wait for device reboot, then upload next firmware
					popup.find( "#ota-progress-msg" ).text( OSApp.Language._( "Device is rebooting..." ) + " " + OSApp.Language._( "Waiting for device to come back online..." ) );
					popup.find( "#ota-progress-bar" ).css( "width", "46%" );
					popup.find( "#ota-progress-pct" ).text( "46%" );

					OSApp.ESP32Mode.waitForDeviceReady( function() {
						uploadIndex++;
						doUpload();
					}, function() {
						popup.find( "#ota-step-3b" ).css( "color", "#f44336" ).html(
							"&#9746; " + OSApp.Language._( "Device did not come back online after first upload." )
						);
						popup.find( "#ota-progress-msg" ).css( "color", "#c00" ).text( OSApp.Language._( "Device did not come back online after first upload." ) );
						popup.find( ".classic-ota-action" ).prop( "disabled", false ).removeClass( "ui-state-disabled" );
					} );
				} else {
					// Last upload done — wait for final reboot
					popup.find( "#ota-progress-bar" ).css( "width", isDual ? "88%" : "92%" );
					popup.find( "#ota-progress-pct" ).text( isDual ? "88%" : "92%" );
					popup.find( "#ota-progress-msg" ).text( OSApp.Language._( "Upload successful. Device is rebooting..." ) );

					if ( isDual ) {
						popup.find( "#ota-step-3b" ).css( "color", "#4CAF50" ).html(
							"&#9745; " + OSApp.Language._( "Firmware uploaded to device" ) + " (" + current.label + ")"
						);
					}

					OSApp.ESP32Mode.waitForClassicUploadReboot( popup );
				}
			} ).fail( function( message ) {
				var failStep = isFirst ? "#ota-step-3" : "#ota-step-3b";
				popup.find( failStep ).css( "color", "#f44336" ).html(
					"&#9746; " + OSApp.Language._( "Firmware upload failed." ) + stepLabel
				);
				popup.find( "#ota-progress-msg" ).css( "color", "#c00" ).text( message || OSApp.Language._( "Firmware upload failed." ) );
				popup.find( ".classic-ota-action" ).prop( "disabled", false ).removeClass( "ui-state-disabled" );
			} );
		} ).fail( function() {
			popup.find( dlStep ).css( "color", "#f44336" ).html(
				"&#9746; " + OSApp.Language._( "Firmware download failed." ) + stepLabel
			);
			popup.find( "#ota-progress-msg" ).css( "color", "#c00" ).text( OSApp.Language._( "Firmware download failed." ) );
			popup.find( ".classic-ota-action" ).prop( "disabled", false ).removeClass( "ui-state-disabled" );
		} );
	};

	var continueUpload = function() {
		doUpload();
	};

	popup.find( "#ota-step-1" ).css( "color", "#1976D2" ).html(
		"&#9658; <b>" + OSApp.Language._( "Backing up configuration..." ) + "</b>"
	);
	popup.find( "#ota-progress-bar" ).css( "width", "5%" );
	popup.find( "#ota-progress-pct" ).text( "5%" );
	popup.find( "#ota-progress-msg" ).text( OSApp.Language._( "Backing up configuration..." ) );

	OSApp.ESP32Mode.backupConfigToApp().done( function() {
		popup.find( "#ota-step-1" ).css( "color", "#4CAF50" ).html(
			"&#9745; " + OSApp.Language._( "Configuration backed up" )
		);
		continueUpload();
	} ).fail( function( errMsg ) {
		popup.find( "#ota-step-1" ).css( "color", "#FF9800" ).html(
			"&#9888; " + OSApp.Language._( "Backup warning" ) + ": " + $( "<span>" ).text( errMsg ).html()
		);
		popup.popup( "close" );
		setTimeout( function() {
			OSApp.UIDom.areYouSure(
				OSApp.Language._( "Configuration backup failed. Continue with update anyway?" ),
				"",
				function() {
					OSApp.UIDom.openPopup( popup );
					continueUpload();
				}
			);
		}, 400 );
	} );
};

/**
 * Probe whether the on-device OTA upload server (port 8080) is reachable.
 * Resolves with true when the server responds to an OPTIONS pre-flight or GET
 * request within the timeout, false otherwise (connection refused, timeout, or
 * any network error that indicates the server is not running).
 */
OSApp.ESP32Mode.probeUpdateServer = function() {
	var defer = $.Deferred();
	var url = OSApp.ESP32Mode.getDirectDeviceUploadUrl();
	var xhr = new XMLHttpRequest();

	if ( !/^https?:\/\/[^/]+/i.test( String( url || "" ) ) ) {
		defer.resolve( false );
		return defer.promise();
	}

	// Use OPTIONS — the firmware registers on_update_options on port 8080
	// which returns Access-Control-Allow-Origin: * so the CORS check passes.
	// A plain GET has no CORS headers on port 8080, causing the browser to
	// block the response and trigger onerror even when the server IS running.
	try {
		xhr.open( "OPTIONS", url, true );
	} catch ( ignored ) { // eslint-disable-line no-unused-vars
		defer.resolve( false );
		return defer.promise();
	}
	xhr.timeout = 5000;

	xhr.onload = function() {
		// Any HTTP response means the server is up (even 4xx/5xx).
		defer.resolve( true );
	};
	xhr.onerror = function() {
		// Connection refused or network error — server not running.
		defer.resolve( false );
	};
	xhr.ontimeout = function() {
		// No response within 5 s — treat as not available.
		defer.resolve( false );
	};

	try {
		xhr.send();
	} catch ( ignored ) { // eslint-disable-line no-unused-vars
		defer.resolve( false );
	}

	return defer.promise();
};

OSApp.ESP32Mode.startOnlineUpdateFlow = function() {
	if ( OSApp.Firmware.isOSPi() ) {
		OSApp.ESP32Mode.setupOSPiOnlineUpdate();
		return;
	}

	if ( OSApp.currentSession && OSApp.currentSession.token ) {
		OSApp.ESP32Mode.setupLegacyOnlineUpdate();
		return;
	}

	if ( !OSApp.Firmware.isDirectFirmwareUploadSupported() ) {
		OSApp.Errors.showError( OSApp.Language._( "Firmware upload is only available for ESP8266 and ESP32 controllers." ) );
		return;
	}

	// When the UI is loaded over HTTPS, the port-8080 OTA upload server always
	// uses plain HTTP and cannot be reached from an HTTPS page (mixed content).
	// Skip the probe and route directly: ESP32 → interactive OTA (setupOnlineUpdate),
	// ESP8266/legacy → setupLegacyOnlineUpdate.
	if ( window.location.protocol === "https:" ) {
		if ( OSApp.ESP32Mode.isESP32Supported() && !OSApp.Firmware.isESP8266Controller() ) {
			OSApp.ESP32Mode.setupOnlineUpdate();
		} else {
			OSApp.ESP32Mode.setupLegacyOnlineUpdate();
		}
		return;
	}

	$.mobile.loading( "show" );

	OSApp.ESP32Mode.probeUpdateServer().done( function( serverAvailable ) {
		$.mobile.loading( "hide" );

		if ( serverAvailable ) {
			OSApp.ESP32Mode.setupClassicPostedUpdate();
		} else if ( OSApp.Firmware.isOnlineUpdateSupported() ) {
			// Port 8080 not reachable — the device firmware predates the browser-push
			// upload server.  Fall back to device-side download via /uu (the device
			// fetches the binary from the update server itself).
			OSApp.ESP32Mode.setupLegacyOnlineUpdate();
		} else {
			OSApp.Errors.showError(
				OSApp.Language._( "The firmware update server on this device is not reachable (port 8080). Please update the firmware via USB or install a firmware that supports online updates." )
			);
		}
	} );
};

OSApp.ESP32Mode.setupClassicPostedUpdate = function() {
	$.mobile.loading( "show" );
	OSApp.Firmware.checkOTAUpdate( true ).done( function( data ) {
		$.mobile.loading( "hide" );

		if ( !data || typeof data.status === "undefined" ) {
			OSApp.Errors.showError( OSApp.Language._( "Error checking for updates" ) );
			return;
		}

		OSApp.ESP32Mode.openClassicUpdatePopup( data );
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error checking for updates" ) );
	} );
};

/**
 * Legacy online update flow (ESP8266 and non-ESP32 builds).
 * Uses direct online update endpoints (/uc, /uu, /us).
 */
OSApp.ESP32Mode.setupLegacyOnlineUpdate = function( selectedEntry ) {
	if ( !OSApp.Firmware.isOnlineUpdateSupported() ) {
		OSApp.Errors.showError( OSApp.Language._( "Online firmware update requires firmware version 2.4.0 or newer." ) );
		return;
	}

	$.mobile.loading( "show" );
	OSApp.Firmware.checkOTAUpdate( true ).done( function( data ) {
		$.mobile.loading( "hide" );

		if ( !data || typeof data.status === "undefined" ) {
			OSApp.Errors.showError( OSApp.Language._( "Error checking for updates" ) );
			return;
		}

		var targetEntry = selectedEntry || data.latest_entry || data;
		var isOtcConnection = !!OSApp.currentSession.token;
		var curVer = OSApp.ESP32Mode.formatFwVersion( data.cur_version ) + "." + data.cur_minor;
		var variantLabel = OSApp.ESP32Mode.getOnlineUpdateVariantLabel();
		var content = "<div class='ui-content'>";
		content += "<h3>" + OSApp.Language._( "Online Firmware Update" ) + " - " + variantLabel + "</h3>";
		content += "<p><b>" + OSApp.Language._( "Current version" ) + ":</b> " + curVer + "</p>";

		if ( selectedEntry ) {
			var selVerLabel = OSApp.ESP32Mode.formatFwVersion( selectedEntry.fw_version ) + "." + selectedEntry.fw_minor;
			content += "<p style='color:orange;font-weight:bold;'>" +
				OSApp.Language._( "Selected version" ) + ": " + selVerLabel + "</p>";
		} else if ( data.available === 1 ) {
			var legacyNewVer = OSApp.ESP32Mode.formatFwVersion( data.fw_version ) + "." + data.fw_minor;
			content += "<p style='color:green;font-weight:bold;'>" +
				OSApp.Language._( "Update available" ) + ": " + legacyNewVer + "</p>";
		} else {
			content += "<p style='color:green;font-weight:bold;'>" + OSApp.Language._( "Firmware is up to date" ) + "</p>";
		}

		var legacyChangelog = targetEntry.changelog || ( ( data.latest_entry && data.latest_entry.changelog ) ? data.latest_entry.changelog : ( data.changelog || "" ) );
		if ( legacyChangelog ) {
			content += "<div style='max-height:150px;overflow-y:auto;border:1px solid #ccc;padding:8px;margin:8px 0;font-size:0.85em;white-space:pre-wrap;'>" +
				$( "<span>" ).text( legacyChangelog ).html() + "</div>";
		}
		content += "<p style='font-size:0.9em;color:#666;'>" +
			OSApp.Language._( "This device downloads and installs the firmware directly." ) +
			"</p>";
		if ( isOtcConnection ) {
			content += "<div style='margin:12px 0;padding:10px;background:#e8f0fe;color:#1f4fa3;border-radius:6px;'>" +
				OSApp.Language._( "Update over OTC is enabled. The device will download and install firmware directly." ) +
				"</div>";
		}
		content += "<p style='font-size:0.85em;color:#666;'>" +
			OSApp.Language._( "After flashing, WiFi/Ethernet parameters are restored from device flash backup." ) +
			"</p>";

		content += "<div id='ota-steps' style='margin:12px 0;padding:8px;background:#f0f0f0;border-radius:4px;font-size:0.9em;'>";
		content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Update Process" ) + ":</b></p>";
		content += "<p id='ota-step-1' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 1: Backup configuration" ) + "</p>";
		content += "<p id='ota-step-2' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 2: Download and install firmware" ) + "</p>";
		content += "<p id='ota-step-3' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 3: Device reboots" ) + "</p>";
		content += "<p id='ota-step-4' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 4: Restore configuration" ) + "</p>";
		content += "</div>";

		var startBtnLabel = selectedEntry ? OSApp.Language._( "Install Selected Version" ) : OSApp.Language._( "Start Update" );
		content += "<button class='legacy-ota-start ui-btn ui-btn-b'>" + startBtnLabel + "</button>";
		content += "<button class='legacy-ota-reinstall ui-btn ui-mini' style='margin-top:4px;'>" +
			OSApp.Language._( "Reinstall current version" ) + "</button>";
		content += "<button class='legacy-ota-older ui-btn ui-mini' style='margin-top:4px;'>" +
			OSApp.Language._( "Install older version..." ) + "</button>";
		content += "<button class='legacy-ota-after-reboot ui-btn' style='display:none;'>" + OSApp.Language._( "Device rebooted - Restore configuration" ) + "</button>";
		content += "<button class='ota-cancel ui-btn'>" + OSApp.Language._( "Close" ) + "</button>";
		content += "</div>";

		var extraParams = "";
		if ( selectedEntry ) {
			if ( OSApp.Firmware.isESP8266Controller() ) {
				if ( selectedEntry.esp8266_url ) {
					extraParams += "&fu=" + encodeURIComponent( selectedEntry.esp8266_url );
				}
			} else {
				if ( selectedEntry.zigbee_url ) {
					extraParams += "&zu=" + encodeURIComponent( selectedEntry.zigbee_url );
				}
				if ( selectedEntry.matter_url ) {
					extraParams += "&mu=" + encodeURIComponent( selectedEntry.matter_url );
				}
			}
		}

		var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='otaLegacyPopup'>" + content + "</div>" );

		popup.on( "click", ".ota-cancel", function() {
			popup.popup( "close" );
			return false;
		} );

		popup.on( "click", ".legacy-ota-reinstall", function() {
			popup.popup( "close" );
			popup.on( "popupafterclose", function() {
				popup.off( "popupafterclose" );
				var currentEntry = {
					fw_version: OSApp.Firmware.getOSVersion(),
					fw_minor: OSApp.Firmware.getOSMinorVersion()
				};
				var fallbackProtocol = ( window.location.protocol === "https:" ) ? "https:" : "http:";
				var fallbackUrl = fallbackProtocol + "//opensprinklershop.de/upgrade/archive/v" + currentEntry.fw_version + "_" + currentEntry.fw_minor + "/firmware_";
				if ( OSApp.Firmware.isESP8266Controller() ) {
					currentEntry.esp8266_url = fallbackUrl + "esp8266.bin";
				} else {
					var options = OSApp.options || {};
					var featureFlags = options.mopts ? options.mopts[0] : 0;
					var isZigbee = !!( featureFlags & 1 );
					var isMatter = !!( featureFlags & 2 );
					if ( isZigbee ) {
						currentEntry.zigbee_url = fallbackUrl + "zigbee.bin";
					} else if ( isMatter ) {
						currentEntry.matter_url = fallbackUrl + "matter.bin";
					}
				}
				OSApp.ESP32Mode.setupLegacyOnlineUpdate( currentEntry );
			} );
			return false;
		} );

		popup.on( "click", ".legacy-ota-older", function() {
			popup.popup( "close" );
			popup.on( "popupafterclose", function() {
				popup.off( "popupafterclose" );
				OSApp.ESP32Mode.showLegacyVersionPicker( data );
			} );
			return false;
		} );

		popup.on( "click", ".legacy-ota-start", function() {
			var $btn = $( this );
			$btn.prop( "disabled", true ).addClass( "ui-state-disabled" );
			popup.find( "#ota-step-1" ).css( "color", "#1976D2" ).html(
				"&#9658; <b>" + OSApp.Language._( "Backing up configuration..." ) + "</b>"
			);

			OSApp.ESP32Mode.backupConfigToApp().done( function() {
				popup.find( "#ota-step-1" ).css( "color", "#4CAF50" ).html(
					"&#9745; " + OSApp.Language._( "Configuration backed up" )
				);
				OSApp.ESP32Mode.runLegacyDirectOTA( popup, extraParams );
			} ).fail( function( errMsg ) {
				popup.find( "#ota-step-1" ).css( "color", "#FF9800" ).html(
					"&#9888; " + OSApp.Language._( "Backup warning" ) + ": " + $( "<span>" ).text( errMsg ).html()
				);
				OSApp.UIDom.areYouSure(
					OSApp.Language._( "Configuration backup failed. Continue with update anyway?" ),
					"",
					function() {
						OSApp.ESP32Mode.runLegacyDirectOTA( popup, extraParams );
					}
				);
			} );

			return false;
		} );

		popup.on( "click", ".legacy-ota-after-reboot", function() {
			popup.find( "#ota-step-3" ).css( "color", "#4CAF50" ).html(
				"&#9745; " + OSApp.Language._( "Device rebooted" )
			);
			popup.find( "#ota-step-4" ).css( "color", "#1976D2" ).html(
				"&#9658; <b>" + OSApp.Language._( "Restoring configuration..." ) + "</b>"
			);
			popup.popup( "close" );
			setTimeout( function() {
				OSApp.ESP32Mode.showRestorePopup();
			}, 400 );
			return false;
		} );

		OSApp.UIDom.openPopup( popup );
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error checking for updates" ) );
	} );
};

/**
 * Fetch list of versions and show selection dialog for legacy update.
 */
OSApp.ESP32Mode.showLegacyVersionPicker = function( checkData ) {
	var versionsUrl = ( checkData && checkData.versions_url )
		? checkData.versions_url
		: OSApp.Firmware.getVersionCatalogUrl();

	if ( window.location.protocol === "https:" && versionsUrl && versionsUrl.indexOf( "http://" ) === 0 ) {
		versionsUrl = versionsUrl.replace( "http://", "https://" );
	}

	$.mobile.loading( "show" );
	$.ajax( { url: versionsUrl, dataType: "json", timeout: 10000 } ).done( function( versions ) {
		$.mobile.loading( "hide" );

		if ( !versions || !versions.length ) {
			OSApp.Errors.showError( OSApp.Language._( "No version history available" ) );
			return;
		}

		var curVerNum = checkData ? checkData.cur_version : 0;
		var curMinor  = checkData ? checkData.cur_minor  : 0;

		var content = "<div class='ui-content'>";
		content += "<h3>" + OSApp.Language._( "Install Older Version" ) + "</h3>";
		content += "<p style='font-size:0.9em;color:#666;'>" +
			OSApp.Language._( "Select a firmware version to install:" ) + "</p>";

		content += "<ul data-role='listview' data-inset='true' id='ota-legacy-version-list' style='margin:8px 0;'>";
		versions.forEach( function( v ) {
			var verLabel = OSApp.ESP32Mode.formatFwVersion( v.fw_version ) + "." + v.fw_minor;
			var isCurrent = ( v.fw_version === curVerNum && v.fw_minor === curMinor );
			var badge = isCurrent
				? " <span style='font-size:0.8em;color:#fff;background:#4CAF50;padding:1px 5px;border-radius:3px;'>" +
				  OSApp.Language._( "current" ) + "</span>"
				: "";
			var dateStr = v.date ? " <span style='font-size:0.8em;color:#999;'>(" + v.date + ")</span>" : "";
			var changelogSnippet = v.changelog
				? $( "<span>" ).text( v.changelog ).html()
				: "";

			var itemData = " data-fwv='" + v.fw_version + "' data-fwm='" + v.fw_minor + "'";
			if ( OSApp.Firmware.isESP8266Controller() ) {
				var _archiveBase = ( window.location.protocol === "https:" ? "https:" : "http:" ) + "//opensprinklershop.de/upgrade/archive/v" + v.fw_version + "_" + v.fw_minor;
				var esp8266Url = v.esp8266_url || ( _archiveBase + "/firmware_esp8266.bin" );
				itemData += " data-fu='" + $( "<span>" ).text( esp8266Url ).html() + "'";
			} else {
				var _archiveBase2 = ( window.location.protocol === "https:" ? "https:" : "http:" ) + "//opensprinklershop.de/upgrade/archive/v" + v.fw_version + "_" + v.fw_minor;
				var zigbeeUrl = v.zigbee_url || ( _archiveBase2 + "/firmware_zigbee.bin" );
				var matterUrl = v.matter_url || ( _archiveBase2 + "/firmware_matter.bin" );
				itemData += " data-zu='" + $( "<span>" ).text( zigbeeUrl ).html() + "'";
				itemData += " data-mu='" + $( "<span>" ).text( matterUrl ).html() + "'";
			}

			content += "<li>" +
				"<a href='#' class='ota-legacy-version-item'" + itemData + ">" +
				"<b>v" + verLabel + "</b>" + badge + dateStr;
			if ( changelogSnippet ) {
				content += "<p class='ui-li-desc' style='white-space:pre-wrap;'>" + changelogSnippet + "</p>";
			}
			content += "</a></li>";
		} );
		content += "</ul>";

		content += "<button class='ota-legacy-version-cancel ui-btn'>&#8592; " + OSApp.Language._( "Back" ) + "</button>";
		content += "</div>";

		var picker = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='otaLegacyVersionPicker'" +
			" style='max-height:80vh;overflow-y:auto;width:90vw;max-width:480px;'>" + content + "</div>" );

		picker.on( "click", ".ota-legacy-version-cancel", function() {
			picker.popup( "close" );
			return false;
		} );

		picker.on( "click", ".ota-legacy-version-item", function() {
			var fwv = parseInt( $( this ).data( "fwv" ), 10 );
			var fwm = parseInt( $( this ).data( "fwm" ), 10 );
			var selectedEntry = {
				fw_version: fwv,
				fw_minor: fwm
			};
			if ( OSApp.Firmware.isESP8266Controller() ) {
				selectedEntry.esp8266_url = $( this ).data( "fu" );
				if ( window.location.protocol === "https:" && selectedEntry.esp8266_url && selectedEntry.esp8266_url.indexOf( "http://" ) === 0 ) {
					selectedEntry.esp8266_url = selectedEntry.esp8266_url.replace( "http://", "https://" );
				}
			} else {
				selectedEntry.zigbee_url = $( this ).data( "zu" );
				selectedEntry.matter_url = $( this ).data( "mu" );
				if ( window.location.protocol === "https:" ) {
					if ( selectedEntry.zigbee_url && selectedEntry.zigbee_url.indexOf( "http://" ) === 0 ) {
						selectedEntry.zigbee_url = selectedEntry.zigbee_url.replace( "http://", "https://" );
					}
					if ( selectedEntry.matter_url && selectedEntry.matter_url.indexOf( "http://" ) === 0 ) {
						selectedEntry.matter_url = selectedEntry.matter_url.replace( "http://", "https://" );
					}
				}
			}
			picker.popup( "close" );
			setTimeout( function() {
				OSApp.ESP32Mode.setupLegacyOnlineUpdate( selectedEntry );
			}, 400 );
			return false;
		} );

		OSApp.UIDom.openPopup( picker );
		picker.trigger( "create" );
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error loading version history" ) );
	} );
};

OSApp.ESP32Mode.setupOSPiOnlineUpdate = function() {
	if ( !OSApp.Firmware.isOnlineUpdateSupported() ) {
		OSApp.Errors.showError( OSApp.Language._( "Online firmware update requires firmware version 2.4.0 or newer." ) );
		return;
	}

	var curVer = OSApp.Firmware.getOSVersion();
	var variantLabel = OSApp.ESP32Mode.getOnlineUpdateVariantLabel();
	var content = "<div class='ui-content'>";
	content += "<h3>" + OSApp.Language._( "Online Firmware Update" ) + " - " + variantLabel + "</h3>";
	content += "<p><b>" + OSApp.Language._( "Current version" ) + ":</b> " + curVer + "</p>";
	content += "<p style='color:green;font-weight:bold;'>" + OSApp.Language._( "Firmware is up to date" ) + "</p>";
	content += "<p style='font-size:0.9em;color:#666;'>" +
		OSApp.Language._( "This OSPi device uses updater.sh for online updates." ) +
		"</p>";
	content += "<p style='font-size:0.9em;color:#666;'>" +
		OSApp.Language._( "The update script will be started on the controller." ) +
		"</p>";
	content += "<button class='ospi-ota-start ui-btn ui-btn-b'>" + OSApp.Language._( "Start Update" ) + "</button>";
	content += "<button class='ota-cancel ui-btn'>" + OSApp.Language._( "Close" ) + "</button>";
	content += "</div>";

	var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='ospiOtaPopup'>" + content + "</div>" );

	popup.on( "click", ".ota-cancel", function() {
		popup.popup( "close" );
		return false;
	} );

	popup.on( "click", ".ospi-ota-start", function() {
		var button = $( this );
		button.prop( "disabled", true ).addClass( "ui-state-disabled" );
		OSApp.Firmware.sendToOS( "/cv?pw=&update=1", "json", 30000 ).done( function() {
			var statusHtml = [
				"<div style='margin:0 0 12px 0;padding:10px;background:#e8f5e9;color:#1b5e20;border-radius:6px;'>",
				OSApp.Language._( "The update script has been started on the controller. Reload the page after the device finishes updating." ),
				"</div>"
			].join( "" );
			popup.find( ".ui-content" ).prepend( statusHtml );
			button.remove();
		} ).fail( function() {
			button.prop( "disabled", false ).removeClass( "ui-state-disabled" );
			OSApp.Errors.showError( OSApp.Language._( "Update did not complete." ) );
		} );
		return false;
	} );

	OSApp.UIDom.openPopup( popup );
};

OSApp.ESP32Mode.runLegacyDirectOTA = function( popup, extraParams ) {
	popup.find( "#ota-step-2" ).css( "color", "#1976D2" ).html(
		"&#9658; <b>" + OSApp.Language._( "Downloading and installing firmware..." ) + "</b>"
	);

	OSApp.Firmware.sendToOS( OSApp.Firmware.buildOTAUpdateRequest( extraParams ), "json" ).done( function( resp ) {
		if ( !resp || resp.result !== 1 ) {
			popup.find( "#ota-step-2" ).css( "color", "#f44336" ).html(
				"&#9746; " + OSApp.Language._( "Failed to start update" ) +
				( resp && resp.message ? ": " + $( "<span>" ).text( resp.message ).html() : "" )
			);
			return;
		}

		// OTA accepted — poll /us for download/flash progress first,
		// then switch to reboot detection once the flash is complete.
		popup.find( "#ota-step-2" ).css( "color", "#1976D2" ).html(
			"&#9658; <b>" + OSApp.Language._( "Downloading and installing firmware..." ) + "</b>"
		);
		popup.find( ".legacy-ota-start" ).hide();

		var originalPass = OSApp.currentSession.pass;
		var defaultPass = md5( "opendoor" );
		var baseUrl = OSApp.currentSession.prefix + OSApp.currentSession.ip;

		// Phase 1: poll /us until flash is done (status 8) or failed (status >= 9).
		// While the device is reachable it serves progress; once it reboots /us stops responding.
		var statusPollCount = 0;
		var maxStatusPolls = 90; // 90 × 2 s = 3 min max for download+flash phase
		var statusTimer = setInterval( function() {
			statusPollCount++;
			OSApp.Firmware.sendToOS( "/us?pw=", "json" ).then( function( data ) {
				if ( !data ) { return; }

				var status = data.status;
				var progress = data.progress || 0;
				var message = data.message || "";

				// Update step 2 label with progress percentage and status message
				var progressText = progress > 0 ? " (" + progress + "%)" : "";
				var labelText = message || OSApp.Language._( "Downloading and installing firmware..." );
				popup.find( "#ota-step-2" ).css( "color", "#1976D2" ).html(
					"&#9658; <b>" + labelText + progressText + "</b>"
				);

				if ( status === 8 ) {
					// Flash complete — device will reboot now
					clearInterval( statusTimer );
					popup.find( "#ota-step-2" ).css( "color", "#4CAF50" ).html(
						"&#9745; " + OSApp.Language._( "Firmware flashed successfully" )
					);
					popup.find( "#ota-step-3" ).css( "color", "#1976D2" ).html(
						"&#9658; <b>" + OSApp.Language._( "Waiting for device reboot..." ) + "</b>"
					);
					startRebootPolling();
				} else if ( status >= 9 ) {
					// Download or flash error reported by firmware
					clearInterval( statusTimer );
					popup.find( "#ota-step-2" ).css( "color", "#f44336" ).html(
						"&#9746; " + OSApp.Language._( "Update failed" ) +
						( message ? ": " + $( "<span>" ).text( message ).html() : " (status " + status + ")" )
					);
				}
			} );

			if ( statusPollCount >= maxStatusPolls ) {
				// Device stopped responding to /us — assume it rebooted mid-flash or timed out
				clearInterval( statusTimer );
				popup.find( "#ota-step-3" ).css( "color", "#1976D2" ).html(
					"&#9658; <b>" + OSApp.Language._( "Waiting for device reboot..." ) + "</b>"
				);
				startRebootPolling();
			}
		}, 2000 );

		function startRebootPolling() {
			var pollCount = 0;
			var maxPolls = 120; // 120 × 3 s = 6 min
			var polling = false;

		setTimeout( function() {
			var rebootPoll = setInterval( function() {
				if ( polling ) { return; } // skip if previous request still pending
				pollCount++;
				polling = true;

				// Try original password first (firmware may have restored it),
				// fall back to default password on alternate attempts.
				var tryPass = ( pollCount % 2 === 1 ) ? originalPass : defaultPass;
				var url = baseUrl + "/jc?pw=" + encodeURIComponent( tryPass );

				$.ajax( {
					url: url,
					type: "GET",
					dataType: "json",
					timeout: 3000
				} ).done( function( data ) {
					if ( !data ) { polling = false; return; }
					clearInterval( rebootPoll );

					// Device is back — update session password
					OSApp.currentSession.pass = tryPass;

					popup.find( "#ota-step-3" ).css( "color", "#4CAF50" ).html(
						"&#9745; " + OSApp.Language._( "Device rebooted successfully" )
					);

					// Auto-restore configuration from app backup
					var backup = OSApp.ESP32Mode.hasAppBackup();
					if ( backup ) {
						popup.find( "#ota-step-4" ).css( "color", "#1976D2" ).html(
							"&#9658; <b>" + OSApp.Language._( "Restoring configuration..." ) + "</b>"
						);
						OSApp.ESP32Mode.directRestoreAfterOTA( backup.data, tryPass, function() {
							// success
							popup.find( "#ota-step-4" ).css( "color", "#4CAF50" ).html(
								"&#9745; " + OSApp.Language._( "Configuration restored" )
							);
							localStorage.removeItem( OSApp.ESP32Mode.OTA_BACKUP_KEY );
							setTimeout( function() {
								popup.popup( "close" );
								OSApp.Sites.updateController( function() {
									OSApp.UIDom.goHome();
								} );
							}, 1500 );
						}, function() {
							// failure — offer manual restore button
							popup.find( "#ota-step-4" ).css( "color", "#FF9800" ).html(
								"&#9888; " + OSApp.Language._( "Auto-restore failed" )
							);
							popup.find( ".legacy-ota-after-reboot" ).show();
						} );
					} else {
						popup.find( "#ota-step-4" ).css( "color", "#FF9800" ).html(
							"&#9888; " + OSApp.Language._( "No backup found — manual restore needed" )
						);
						popup.find( ".legacy-ota-after-reboot" ).show();
					}
				} ).fail( function() {
					polling = false;
				} );

				if ( pollCount >= maxPolls ) {
					clearInterval( rebootPoll );
					popup.find( "#ota-step-3" ).css( "color", "#FF9800" ).html(
						"&#9888; " + OSApp.Language._( "Could not detect device after reboot" )
					);
					popup.find( ".legacy-ota-after-reboot" ).show();
				}
			}, 3000 );
		}, 5000 ); // initial wait before first poll
		} // end startRebootPolling

	} ).fail( function() {
		popup.find( "#ota-step-2" ).css( "color", "#f44336" ).html(
			"&#9746; " + OSApp.Language._( "Error starting update" )
		);
	} );
};

/**
 * Direct restore after OTA reboot — bypasses sendToOS/ajaxq to avoid
 * queue contention and retry loops that can hang the restore step.
 * First restores the password via /sp, then options via /co, using
 * plain $.ajax with explicit password parameter.
 */
OSApp.ESP32Mode.directRestoreAfterOTA = function( data, currentDevicePass, onDone, onFail ) {
	var baseUrl = OSApp.ESP32Mode.getDirectDeviceBaseUrl();
	var pw = encodeURIComponent( currentDevicePass );

	var soptKeyMap = {
		"1": "loc", "4": "wto", "5": "ifkey", "8": "mqtt",
		"9": "otc", "10": "dname", "12": "email", "13": "fyta", "14": "gardena"
	};
	var params = "";
	$.each( data.sopts || {}, function( key, val ) {
		var named = soptKeyMap[ key ];
		if ( named && val ) {
			if ( params ) { params += "&"; }
			params += named + "=" + encodeURIComponent( val );
		}
	} );

	if ( data.iopts && data.iopts.length ) {
		var ioptKeyMap = {
			"3": "dhcp",
			"4": "ip1", "5": "ip2", "6": "ip3", "7": "ip4",
			"8": "gw1", "9": "gw2", "10": "gw3", "11": "gw4",
			"12": "hp0", "13": "hp1",
			"44": "dns1", "45": "dns2", "46": "dns3", "47": "dns4",
			"60": "subn1", "61": "subn2", "62": "subn3", "63": "subn4",
			"69": "wimod"
		};
		$.each( ioptKeyMap, function( idx, keyName ) {
			var v = data.iopts[ parseInt( idx, 10 ) ];
			if ( typeof v !== "undefined" && v !== null && v !== "" ) {
				if ( params ) { params += "&"; }
				params += keyName + "=" + encodeURIComponent( v );
			}
		} );
	}

	var chain = $.Deferred().resolve();

	// Step 1: restore password
	if ( data.sopts && data.sopts[ "0" ] ) {
		chain = chain.then( function() {
			var npw = encodeURIComponent( data.sopts[ "0" ] );
			return $.ajax( {
				url: baseUrl + "/sp?pw=" + pw + "&npw=" + npw + "&cpw=" + npw,
				type: "GET", dataType: "json", timeout: 8000
			} ).then( function( resp ) {
				if ( resp && resp.result === 1 ) {
					// Password changed — use new password for subsequent calls
					pw = npw;
					OSApp.currentSession.pass = data.sopts[ "0" ];
				}
				return resp;
			} );
		} );
	}

	// Step 2: restore options
	if ( params ) {
		chain = chain.then( function() {
			return $.ajax( {
				url: baseUrl + "/co?pw=" + pw + "&" + params,
				type: "GET", dataType: "json", timeout: 8000
			} );
		} );
	}

	chain.done( function() {
		if ( onDone ) { onDone(); }
	} ).fail( function() {
		if ( onFail ) { onFail(); }
	} );
};

/**
 * Inject the OTA step-indicator into a popup that currently only shows
 * the "up to date" message, then launch the interactive OTA flow.
 * Used for "Reinstall current version" — no URL override needed.
 * @param {jQuery} popup  The existing OTA popup.
 * @param {Object} data   Response from /uc (contains cur_version, cur_minor etc.)
 */
OSApp.ESP32Mode.showInteractiveOTAfromManifest = function( popup ) {
	// Remove existing content that is no longer relevant
	popup.find( ".ota-reinstall, .ota-older-version, p" ).remove();

	// Inject step indicator
	var stepHtml =
		"<div id='ota-steps' style='margin:12px 0;padding:8px;background:#f0f0f0;border-radius:4px;font-size:0.9em;'>" +
		"<p style='margin:2px 0;'><b>" + OSApp.Language._( "Update Process" ) + ":</b></p>" +
		"<p id='ota-step-1' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 1: Backup configuration" ) + "</p>" +
		"<p id='ota-step-2' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 2: Flash partition 1" ) + "</p>" +
		"<p id='ota-step-3' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 3: Reboot for phase 2" ) + "</p>" +
		"<p id='ota-step-4' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 4: Flash partition 2" ) + "</p>" +
		"<p id='ota-step-5' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 5: Reboot & verify" ) + "</p>" +
		"</div>" +
		OSApp.ESP32Mode.getInteractiveOTAOptionsHtml();
	popup.find( "h3" ).after( stepHtml );

	var variantParam = "";
	var selectedVariant = popup.find( "input[name='ota-variant']:checked" ).val();
	if ( selectedVariant ) { variantParam = "&vt=" + encodeURIComponent( selectedVariant ); }
	OSApp.ESP32Mode.runInteractiveOTA( popup, variantParam );
};

/**
 * Fetch versions.json and show a popup that lets the user pick an older
 * firmware version to install.
 * @param {Object} checkData  Response from /uc (contains cur_version etc.)
 */
OSApp.ESP32Mode.showVersionPicker = function( checkData ) {
	var versionsUrl = ( checkData && checkData.versions_url )
		? checkData.versions_url
		: OSApp.Firmware.getVersionCatalogUrl();

	// Force HTTPS only if the current page is loaded over HTTPS to prevent Mixed Content blocking,
	// while allowing HTTP for environments where HTTPS might fail/resolve incorrectly.
	if ( window.location.protocol === "https:" && versionsUrl && versionsUrl.indexOf( "http://" ) === 0 ) {
		versionsUrl = versionsUrl.replace( "http://", "https://" );
	}

	$.mobile.loading( "show" );
	$.ajax( { url: versionsUrl, dataType: "json", timeout: 10000 } ).done( function( versions ) {
		$.mobile.loading( "hide" );

		if ( !versions || !versions.length ) {
			OSApp.Errors.showError( OSApp.Language._( "No version history available" ) );
			return;
		}

		var curVerNum = checkData ? checkData.cur_version : 0;
		var curMinor  = checkData ? checkData.cur_minor  : 0;

		var content = "<div class='ui-content'>";
		content += "<h3>" + OSApp.Language._( "Install Older Version" ) + "</h3>";
		content += "<p style='font-size:0.9em;color:#666;'>" +
			OSApp.Language._( "Select a firmware version to install:" ) + "</p>";

		content += "<ul data-role='listview' data-inset='true' id='ota-version-list' style='margin:8px 0;'>";
		versions.forEach( function( v ) {
			var verLabel = OSApp.ESP32Mode.formatFwVersion( v.fw_version ) + "." + v.fw_minor;
			var isCurrent = ( v.fw_version === curVerNum && v.fw_minor === curMinor );
			var badge = isCurrent
				? " <span style='font-size:0.8em;color:#fff;background:#4CAF50;padding:1px 5px;border-radius:3px;'>" +
				  OSApp.Language._( "current" ) + "</span>"
				: "";
			var dateStr = v.date ? " <span style='font-size:0.8em;color:#999;'>(" + v.date + ")</span>" : "";
			var changelogSnippet = v.changelog
				? $( "<span>" ).text( v.changelog ).html()
				: "";

			content += "<li>" +
				"<a href='#' class='ota-version-item'" +
				" data-zu='" + $( "<span>" ).text( v.zigbee_url || "" ).html() + "'" +
				" data-mu='" + $( "<span>" ).text( v.matter_url  || "" ).html() + "'" +
				" data-zs='" + $( "<span>" ).text( v.zigbee_sha256 || "" ).html() + "'" +
				" data-ms='" + $( "<span>" ).text( v.matter_sha256  || "" ).html() + "'" +
				" data-ver='" + verLabel + "'>" +
				"<b>v" + verLabel + "</b>" + badge + dateStr;
			if ( changelogSnippet ) {
				content += "<p class='ui-li-desc' style='white-space:pre-wrap;'>" + changelogSnippet + "</p>";
			}
			content += "</a></li>";
		} );
		content += "</ul>";

		content += "<button class='ota-version-cancel ui-btn'>&#8592; " + OSApp.Language._( "Back" ) + "</button>";
		content += "</div>";

		var picker = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='otaVersionPicker'" +
			" style='max-height:80vh;overflow-y:auto;width:90vw;max-width:480px;'>" + content + "</div>" );

		picker.on( "click", ".ota-version-cancel", function() {
			picker.popup( "close" );
			return false;
		} );

		picker.on( "click", ".ota-version-item", function() {
			var zu  = $( this ).data( "zu" );
			var mu  = $( this ).data( "mu" );
			var zs  = $( this ).data( "zs" );
			var ms  = $( this ).data( "ms" );
			var ver = $( this ).data( "ver" );
			picker.popup( "close" );
			setTimeout( function() {
				OSApp.ESP32Mode.startOTAwithURLs( zu, mu, ver, zs, ms );
			}, 400 );
			return false;
		} );

		OSApp.UIDom.openPopup( picker );
		picker.trigger( "create" );
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error loading version history" ) );
	} );
};

/**
 * Open the interactive OTA popup pre-configured for specific firmware URLs.
 * @param {string} zigbeeUrl   URL for the zigbee/main firmware binary.
 * @param {string} matterUrl   URL for the matter firmware binary (C5 only).
 * @param {string} verLabel    Human-readable version string shown in the popup title.
 * @param {string} [zigbeeSha256]  Optional expected SHA-256 for the zigbee binary (64 hex chars).
 * @param {string} [matterSha256]  Optional expected SHA-256 for the matter binary (64 hex chars).
 */
OSApp.ESP32Mode.startOTAwithURLs = function( zigbeeUrl, matterUrl, verLabel, zigbeeSha256, matterSha256 ) {
	var urlParams = "";
	if ( zigbeeUrl ) { urlParams += "&zu=" + encodeURIComponent( zigbeeUrl ); }
	if ( matterUrl  ) { urlParams += "&mu=" + encodeURIComponent( matterUrl  ); }
	if ( zigbeeSha256 && zigbeeSha256.length === 64 ) { urlParams += "&zs=" + encodeURIComponent( zigbeeSha256 ); }
	if ( matterSha256  && matterSha256.length  === 64 ) { urlParams += "&ms=" + encodeURIComponent( matterSha256  ); }

	var content = "<div class='ui-content'>";
	content += "<h3>" + OSApp.Language._( "Install Firmware" ) + " v" + verLabel + "</h3>";

	content += "<div id='ota-steps' style='margin:12px 0;padding:8px;background:#f0f0f0;border-radius:4px;font-size:0.9em;'>";
	content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Update Process" ) + ":</b></p>";
	content += "<p id='ota-step-1' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 1: Backup configuration" ) + "</p>";
	content += "<p id='ota-step-2' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 2: Flash partition 1" ) + "</p>";
	content += "<p id='ota-step-3' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 3: Reboot for phase 2" ) + "</p>";
	content += "<p id='ota-step-4' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 4: Flash partition 2" ) + "</p>";
	content += "<p id='ota-step-5' style='margin:2px 0;color:#999;'>&#9744; " + OSApp.Language._( "Step 5: Reboot & verify" ) + "</p>";
	content += "</div>";
	content += OSApp.ESP32Mode.getInteractiveOTAOptionsHtml();

	content += "<button class='ota-start-specific ui-btn ui-btn-b'>" + OSApp.Language._( "Start Install" ) + "</button>";
	content += "<button class='ota-cancel ui-btn'>" + OSApp.Language._( "Cancel" ) + "</button>";
	content += "</div>";

	var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='otaUpdatePopup'>" + content + "</div>" );

	popup.on( "click", ".ota-cancel", function() {
		if ( !popup.data( "otaFlowCompleted" ) && popup.find( "#ota-progress-area" ).length ) {
			OSApp.UIDom.areYouSure(
				OSApp.Language._( "The firmware update is still running in the background. Are you sure you want to close this window?" ),
				"",
				function() {
					OSApp.ESP32Mode.stopOTADurationTimer( popup );
					popup.popup( "close" );
				}
			);
			return false;
		}
		OSApp.ESP32Mode.stopOTADurationTimer( popup );
		popup.popup( "close" );
		return false;
	} );

	popup.on( "click", ".ota-start-specific", function() {
		$( this ).prop( "disabled", true ).addClass( "ui-state-disabled" );
		var extraParams = urlParams || "";
		var selectedVariant = popup.find( "input[name='ota-variant']:checked" ).val();
		if ( selectedVariant ) { extraParams += "&vt=" + encodeURIComponent( selectedVariant ); }
		OSApp.ESP32Mode.runInteractiveOTA( popup, extraParams );
		return false;
	} );

	OSApp.UIDom.openPopup( popup );
};

/**
 * Run the interactive OTA process inside the existing popup.
 * Steps: backup → start OTA → poll progress → notify reboot.
 * @param {jQuery} popup  The OTA popup element.
 * @param {string} [urlParams]  Optional extra query params for /uu (e.g. "&zu=...&mu=...").
 */
OSApp.ESP32Mode.runInteractiveOTA = function( popup, urlParams ) {
	OSApp.ESP32Mode.ensureOTAProgressArea( popup );
	OSApp.ESP32Mode.startOTADurationTimer( popup );
	// --- Step 1: Backup config to app ---
	popup.find( "#ota-step-1" ).css( "color", "#1976D2" ).html(
		"&#9658; <b>" + OSApp.Language._( "Backing up configuration..." ) + "</b>"
	);

	OSApp.ESP32Mode.backupConfigToApp().done( function() {
		popup.find( "#ota-step-1" ).css( "color", "#4CAF50" ).html(
			"&#9745; " + OSApp.Language._( "Configuration backed up" )
		);
		popup.find( "#ota-progress-bar" ).css( "width", "2%" );
		popup.find( "#ota-progress-pct" ).text( "2%" );

		// --- Step 2: Start OTA download & flash ---
		popup.find( "#ota-step-2" ).css( "color", "#1976D2" ).html(
			"&#9658; <b>" + OSApp.Language._( "Starting firmware download..." ) + "</b>"
		);

		OSApp.ESP32Mode.runInteractiveOTA_step2( popup, urlParams );
	} ).fail( function( errMsg ) {
		OSApp.ESP32Mode.stopOTADurationTimer( popup );
		// Backup failed — warn but allow continuing
		popup.find( "#ota-step-1" ).css( "color", "#FF9800" ).html(
			"&#9888; " + OSApp.Language._( "Backup warning" ) + ": " + $( "<span>" ).text( errMsg ).html()
		);

		popup.popup( "close" );
		setTimeout( function() {
			OSApp.UIDom.areYouSure(
				OSApp.Language._( "Configuration backup failed. Continue with update anyway?" ),
				"",
				function() {
					OSApp.UIDom.openPopup( popup );
					popup.find( "#ota-step-2" ).css( "color", "#1976D2" ).html(
						"&#9658; <b>" + OSApp.Language._( "Starting firmware download..." ) + "</b>"
					);
					OSApp.ESP32Mode.runInteractiveOTA_step2( popup, urlParams );
				}
			);
		}, 400 );
	} );
};

/**
 * Step 2+ of interactive OTA — download, flash, and poll progress across all phases.
 * Firmware reports overall progress 0-100% covering both partitions.
 * @param {jQuery} popup  The OTA popup element.
 * @param {string} [urlParams]  Optional extra query params for /uu (e.g. "&zu=...&mu=...").
 */
OSApp.ESP32Mode.runInteractiveOTA_step2 = function( popup, urlParams ) {
	OSApp.ESP32Mode.ensureOTAProgressArea( popup );

	var uuCmd = OSApp.Firmware.buildOTAUpdateRequest( urlParams || "" );
	OSApp.Firmware.sendToOS( uuCmd, "json" ).done( function( resp ) {
		if ( !resp || resp.result !== 1 ) {
			OSApp.ESP32Mode.stopOTADurationTimer( popup );
			popup.find( "#ota-step-2" ).css( "color", "#f44336" ).html(
				"&#9746; " + OSApp.Language._( "Failed to start update" ) +
				( resp && resp.message ? ": " + $( "<span>" ).text( resp.message ).html() : "" )
			);
			return;
		}

		var failCount = 0;
		var maxFails = 45; // 45 × 2s = 90s tolerance for mid-update reboot
		var sawRebootPhase2 = false;
		var sawRebootOTA = false;
		var phase2Started = false;
		var lastProgress = 0;
		var finalReconnectStarted = false;
		var reconnectPoll = null;
		var reconnectPending = false;

		var startFinalReconnectWait = function() {
			if ( finalReconnectStarted ) {
				return;
			}
			finalReconnectStarted = true;
			clearInterval( pollInterval );

			// Abort any stale in-flight /us?pw= requests still in the default
			// AJAX queue — they would otherwise block or abort the upcoming
			// /jo?pw= reconnect probes.
			try { $.ajaxq.abort( "default" ); } catch ( ignore ) { void ignore; }

			popup.find( "#ota-step-2" ).css( "color", "#4CAF50" ).html(
				"&#9745; " + OSApp.Language._( "Partition 1 flashed" )
			);
			popup.find( "#ota-step-3" ).css( "color", "#4CAF50" ).html(
				"&#9745; " + OSApp.Language._( "Rebooted for phase 2" )
			);
			popup.find( "#ota-step-4" ).css( "color", "#4CAF50" ).html(
				"&#9745; " + OSApp.Language._( "Partition 2 flashed" )
			);
			popup.find( "#ota-step-5" ).css( "color", "#FF9800" ).html(
				"&#9658; <b>" + OSApp.Language._( "Waiting for device to come back online..." ) + "</b>"
			);
			popup.find( "#ota-progress-bar" ).css( "width", "95%" );
			popup.find( "#ota-progress-pct" ).text( "95%" );
			popup.find( ".ota-start-interactive, .ota-start-specific" ).remove();

			// Minimum grace period (seconds) before probing — gives the device
			// time to physically finish its reboot before a connection check.
			var MIN_REBOOT_WAIT = 12;
			var reconnectSeconds = 0;
			var probeCount = 0;

			// After OTA the device may have reset the password to default.
			// Alternate between the original session password and the default
			// password on each probe attempt (same strategy as legacy OTA).
			var originalPass = OSApp.currentSession.pass;
			var defaultPass = md5( "opendoor" );
			var baseUrl = OSApp.currentSession.token
				? "https://cloud.openthings.io/forward/v1/" + OSApp.currentSession.token
				: OSApp.currentSession.prefix + OSApp.currentSession.ip;

			reconnectPoll = setInterval( function() {
				reconnectSeconds += 3;

				popup.find( "#ota-progress-msg" ).text(
					OSApp.Language._( "Waiting for device to restart..." ) +
					" (" + reconnectSeconds + "s)"
				);

				// Skip probing during the minimum grace period or while a
				// request is already in flight.
				if ( reconnectSeconds < MIN_REBOOT_WAIT || reconnectPending ) {
					return;
				}
				reconnectPending = true;
				probeCount++;

				var tryPass = ( probeCount % 2 === 1 ) ? originalPass : defaultPass;

				$.ajax( {
					url: baseUrl + "/jo?pw=" + encodeURIComponent( tryPass ),
					type: "GET",
					dataType: "json",
					timeout: 5000
				} ).done( function( data ) {
					reconnectPending = false;
					if ( !data ) { return; }
					clearInterval( reconnectPoll );

					// Update session password to whichever one worked
					OSApp.currentSession.pass = tryPass;

					popup.find( "#ota-progress-msg" ).text( OSApp.Language._( "Device is back online." ) );
					if ( OSApp.ESP32Mode.hasAppBackup() && popup.find( ".ota-auto-restore" ).prop( "checked" ) ) {
						// Auto-restore enabled — 100% will be set by restoreFromAppBackupInPopup after restore completes
						OSApp.ESP32Mode.restoreFromAppBackupInPopup( popup );
					} else {
						// No restore step — this is the final step, set 100% now
						OSApp.ESP32Mode.markOTACompleted( popup );
						OSApp.ESP32Mode.stopOTADurationTimer( popup );
						popup.find( "#ota-step-5" ).css( "color", "#4CAF50" ).html(
							"&#9745; " + OSApp.Language._( "Update complete. Device is back online." )
						);
						popup.find( ".ota-cancel" ).text( OSApp.Language._( "Close" ) );
					}
				} ).fail( function() {
					reconnectPending = false;
					if ( reconnectSeconds >= 120 ) {
						clearInterval( reconnectPoll );
						OSApp.ESP32Mode.stopOTADurationTimer( popup );
						popup.find( "#ota-step-5" ).css( "color", "#FF9800" ).html(
							"&#9658; <b>" + OSApp.Language._( "Device rebooting \u2014 reconnect when ready" ) + "</b>"
						);
						popup.find( ".ota-cancel" ).text( OSApp.Language._( "Close" ) );
					}
				} );
			}, 3000 );
		};

		var pollInterval = setInterval( function() {
			OSApp.Firmware.sendToOS( "/us?pw=", "json" ).done( function( st ) {
				if ( !st ) { return; }
				failCount = 0;
				lastProgress = Math.max( lastProgress, st.progress || 0 );

				popup.find( "#ota-progress-msg" ).text( st.message || "" );
				popup.find( "#ota-progress-bar" ).css( "width", lastProgress + "%" );
				popup.find( "#ota-progress-pct" ).text( lastProgress + "%" );

				// Phase 1: flashing first partition (progress 5-48%)
				if ( !sawRebootPhase2 && !phase2Started &&
					( st.status === OSApp.ESP32Mode.OTA_STATUS.DOWNLOADING_ZIGBEE ||
					  st.status === OSApp.ESP32Mode.OTA_STATUS.DOWNLOADING_MATTER ) ) {

					// Fallback phase-2 detection: if progress jumped past 50%
					// we missed the REBOOTING_PHASE2 status during the reboot
					if ( st.progress > 50 ) {
						sawRebootPhase2 = true;
						phase2Started = true;
						popup.find( "#ota-step-2" ).css( "color", "#4CAF50" ).html(
							"&#9745; " + OSApp.Language._( "Partition 1 flashed" )
						);
						popup.find( "#ota-step-3" ).css( "color", "#4CAF50" ).html(
							"&#9745; " + OSApp.Language._( "Rebooted for phase 2" )
						);
						popup.find( "#ota-step-4" ).css( "color", "#1976D2" ).html(
							"&#9658; <b>" + OSApp.Language._( "Flashing partition 2" ) + "...</b>"
						);
					} else {
						popup.find( "#ota-step-2" ).css( "color", "#1976D2" ).html(
							"&#9658; <b>" + OSApp.Language._( "Flashing partition 1" ) + "...</b>"
						);
					}
				}

				// Reboot for phase 2 (progress ~50%)
				if ( st.status === OSApp.ESP32Mode.OTA_STATUS.REBOOTING_PHASE2 ) {
					sawRebootPhase2 = true;
					popup.find( "#ota-step-2" ).css( "color", "#4CAF50" ).html(
						"&#9745; " + OSApp.Language._( "Partition 1 flashed" )
					);
					popup.find( "#ota-step-3" ).css( "color", "#1976D2" ).html(
						"&#9658; <b>" + OSApp.Language._( "Rebooting for phase 2..." ) + "</b>"
					);
					popup.find( "#ota-progress-bar" ).css( "width", "50%" );
					popup.find( "#ota-progress-pct" ).text( "50%" );
				}

				// Pre-flash reboot: device rebooting to free internal RAM for OTA task
				if ( st.status === OSApp.ESP32Mode.OTA_STATUS.REBOOTING_OTA ) {
					sawRebootOTA = true;
					popup.find( "#ota-step-2" ).css( "color", "#1976D2" ).html(
						"&#9658; <b>" + OSApp.Language._( "Rebooting to free memory for OTA..." ) + "</b>"
					);
				}

				// Phase 2: flashing second partition (progress 52-98%)
				if ( sawRebootPhase2 && st.progress > 50 &&
					( st.status === OSApp.ESP32Mode.OTA_STATUS.DOWNLOADING_ZIGBEE ||
					  st.status === OSApp.ESP32Mode.OTA_STATUS.DOWNLOADING_MATTER ) ) {
					if ( !phase2Started ) {
						phase2Started = true;
						popup.find( "#ota-step-3" ).css( "color", "#4CAF50" ).html(
							"&#9745; " + OSApp.Language._( "Rebooted for phase 2" )
						);
					}
					popup.find( "#ota-step-4" ).css( "color", "#1976D2" ).html(
						"&#9658; <b>" + OSApp.Language._( "Flashing partition 2" ) + "...</b>"
					);
				}

				// Done (progress 100%)
				if ( st.status === OSApp.ESP32Mode.OTA_STATUS.DONE ) {
					startFinalReconnectWait();
				} else if ( st.status === OSApp.ESP32Mode.OTA_STATUS.ERROR_LOW_MEMORY ) {
					// Not enough internal RAM — tell user to disable IEEE802.15.4
					clearInterval( pollInterval );
					OSApp.ESP32Mode.stopOTADurationTimer( popup );
					popup.find( "#ota-progress-bar" ).css( "background", "#FF9800" );
					popup.find( "#ota-step-2" ).css( "color", "#f44336" ).html(
						"&#9746; <b>" + OSApp.Language._( "Not enough memory for OTA update" ) + "</b>"
					);
					popup.find( "#ota-progress-msg" ).html(
						OSApp.Language._( "Disable IEEE802.15.4 (Zigbee/Matter) in settings, reboot the device, then retry the update." )
					).css( "color", "#c00" );
					popup.find( ".ota-start-interactive, .ota-start-specific" ).remove();
					popup.find( ".ota-cancel" ).text( OSApp.Language._( "Close" ) );
				} else if ( st.status >= OSApp.ESP32Mode.OTA_STATUS.ERROR_NETWORK &&
							st.status <= OSApp.ESP32Mode.OTA_STATUS.ERROR_FLASH_MATTER ) {
					clearInterval( pollInterval );
					OSApp.ESP32Mode.stopOTADurationTimer( popup );
					popup.find( "#ota-progress-bar" ).css( "background", "#f44336" );
					var failStep = phase2Started ? "#ota-step-4" : "#ota-step-2";
					popup.find( failStep ).css( "color", "#f44336" ).html(
						"&#9746; " + OSApp.Language._( "Update failed" ) + ": " +
						$( "<span>" ).text( st.message ).html()
					);
				}
			} ).fail( function() {
				failCount++;
				if ( sawRebootPhase2 || sawRebootOTA ) {
					if ( phase2Started && lastProgress >= 90 ) {
						startFinalReconnectWait();
						return;
					}
					popup.find( "#ota-progress-msg" ).text(
						OSApp.Language._( "Waiting for device to restart..." ) +
						" (" + ( failCount * 2 ) + "s)"
					);
					// Mark step 3 as in-progress when we lose connection after phase 1
					if ( !phase2Started ) {
						popup.find( "#ota-step-3" ).css( "color", "#1976D2" ).html(
							"&#9658; <b>" + OSApp.Language._( "Waiting for device..." ) +
							" (" + ( failCount * 2 ) + "s)</b>"
						);
					}
				}
				if ( failCount >= maxFails ) {
					clearInterval( pollInterval );
					OSApp.ESP32Mode.stopOTADurationTimer( popup );
					popup.find( "#ota-step-2" ).css( "color", "#FF9800" ).html(
						"&#9745; " + OSApp.Language._( "Firmware update sent" )
					);
					popup.find( "#ota-step-5" ).css( "color", "#FF9800" ).html(
						"&#9658; <b>" + OSApp.Language._( "Device rebooting — reconnect when ready" ) + "</b>"
					);
					popup.find( ".ota-start-interactive" ).remove();
					popup.find( ".ota-cancel" ).text( OSApp.Language._( "Close" ) );
				}
			} );
		}, 2000 );
	} ).fail( function() {
		OSApp.ESP32Mode.stopOTADurationTimer( popup );
		popup.find( "#ota-step-2" ).css( "color", "#f44336" ).html(
			"&#9746; " + OSApp.Language._( "Error starting update" )
		);
	} );
};

/** localStorage key for OTA config backup */
OSApp.ESP32Mode.OTA_BACKUP_KEY = "os_ota_config_backup";

/**
 * Save controller config to localStorage before OTA update.
 * Fetches /ub?pw= from device and stores the backup locally.
 * Returns a jQuery Deferred.
 */
OSApp.ESP32Mode.backupConfigToApp = function() {
	var defer = $.Deferred();

	OSApp.Firmware.sendToOS( "/ub?pw=", "json" ).done( function( data ) {
		if ( data && data.backup === 1 ) {
			try {
				var backupObj = {
					timestamp: new Date().toISOString(),
					ip: OSApp.currentSession.ip,
					data: data
				};
				localStorage.setItem( OSApp.ESP32Mode.OTA_BACKUP_KEY, JSON.stringify( backupObj ) );
				defer.resolve( data );
			} catch ( e ) {
				defer.reject( "localStorage error: " + e.message );
			}
		} else {
			defer.reject( "Invalid backup response" );
		}
	} ).fail( function() {
		defer.reject( "Error fetching backup from device" );
	} );

	return defer.promise();
};

/**
 * Check if an OTA config backup exists in localStorage.
 */
OSApp.ESP32Mode.hasAppBackup = function() {
	try {
		var stored = localStorage.getItem( OSApp.ESP32Mode.OTA_BACKUP_KEY );
		return stored ? JSON.parse( stored ) : null;
	} catch ( e ) {
		void e;
		return null;
	}
};

/**
 * Show a restore popup offering to restore config from localStorage backup.
 * WiFi/Ethernet config is auto-restored by firmware from flash backup.
 * This restores remaining settings (programs, stations, options).
 */
OSApp.ESP32Mode.showRestorePopup = function() {
	var backup = OSApp.ESP32Mode.hasAppBackup();
	if ( !backup ) {
		OSApp.Errors.showError( OSApp.Language._( "No backup found" ) );
		return;
	}

	var content = "<div class='ui-content'>";
	content += "<h3>" + OSApp.Language._( "Restore Configuration" ) + "</h3>";
	content += "<p>" + OSApp.Language._( "A configuration backup from" ) + " <b>" +
		$( "<span>" ).text( backup.timestamp ).html() + "</b> " +
		OSApp.Language._( "is available." ) + "</p>";
	content += "<p style='font-size:0.9em;color:#666;'>" +
		OSApp.Language._( "WiFi/Ethernet settings are automatically restored by the device from flash backup." ) + "</p>";
	content += "<p>" + OSApp.Language._( "Restore remaining configuration (options, programs, stations) from app backup?" ) + "</p>";

	content += "<button class='restore-confirm ui-btn ui-btn-b'>" + OSApp.Language._( "Restore from App Backup" ) + "</button>";
	content += "<button class='restore-delete ui-btn' style='color:#c00;'>" + OSApp.Language._( "Delete Backup" ) + "</button>";
	content += "<button class='restore-cancel ui-btn'>" + OSApp.Language._( "Cancel" ) + "</button>";
	content += "</div>";

	var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='otaRestorePopup'>" + content + "</div>" );

	popup.on( "click", ".restore-cancel", function() {
		popup.popup( "close" );
		return false;
	} );

	popup.on( "click", ".restore-delete", function() {
		localStorage.removeItem( OSApp.ESP32Mode.OTA_BACKUP_KEY );
		popup.popup( "close" );
		OSApp.Errors.showError( OSApp.Language._( "Backup deleted" ) );
		return false;
	} );

	popup.on( "click", ".restore-confirm", function() {
		popup.popup( "close" );
		setTimeout( function() {
			OSApp.ESP32Mode.restoreFromAppBackup( backup.data );
		}, 400 );
		return false;
	} );

	OSApp.UIDom.openPopup( popup );
};

/**
 * Restore controller options from a backup data object.
 * Sends string options (sopts) back using their named /co keys,
 * and restores the password separately via /sp.
 * @param {Object}   data       Backup data (from backupConfigToApp)
 * @param {Function} [onDone]   Optional success callback
 * @param {Function} [onFail]   Optional failure callback
 */
OSApp.ESP32Mode.restoreFromAppBackup = function( data, onDone, onFail ) {
	if ( !data || !data.sopts ) {
		OSApp.Errors.showError( OSApp.Language._( "Invalid backup data" ) );
		if ( onFail ) { onFail(); }
		return;
	}

	$.mobile.loading( "show" );

	// Map sopt indices to /co parameter names.
	// Indices not listed here are either handled separately (password)
	// or auto-restored by firmware (WiFi SSID/pass/BSSID).
	var soptKeyMap = {
		"1": "loc",     // SOPT_LOCATION
		"4": "wto",     // SOPT_WEATHER_OPTS
		"5": "ifkey",   // SOPT_IFTTT_KEY
		"8": "mqtt",    // SOPT_MQTT_OPTS
		"9": "otc",     // SOPT_OTC_OPTS
		"10": "dname",  // SOPT_DEVICE_NAME
		"12": "email",  // SOPT_EMAIL_OPTS
		"13": "fyta",   // SOPT_FYTA_OPTS
		"14": "gardena" // SOPT_GARDENA_OPTS
	};

	// Build /co command with named sopt keys
	var params = "";
	$.each( data.sopts, function( key, val ) {
		var namedKey = soptKeyMap[ key ];
		if ( namedKey && val ) {
			if ( params ) { params += "&"; }
			params += namedKey + "=" + encodeURIComponent( val );
		}
	} );

	// Restore network-relevant iopts (WiFi/Ethernet addressing + mode)
	if ( data.iopts && data.iopts.length ) {
		var ioptKeyMap = {
			"3": "dhcp",
			"4": "ip1",  "5": "ip2",  "6": "ip3",  "7": "ip4",
			"8": "gw1",  "9": "gw2",  "10": "gw3", "11": "gw4",
			"12": "hp0", "13": "hp1",
			"44": "dns1", "45": "dns2", "46": "dns3", "47": "dns4",
			"60": "subn1", "61": "subn2", "62": "subn3", "63": "subn4",
			"69": "wimod"
		};
		$.each( ioptKeyMap, function( idx, keyName ) {
			var v = data.iopts[ parseInt( idx, 10 ) ];
			if ( typeof v !== "undefined" && v !== null && v !== "" ) {
				if ( params ) { params += "&"; }
				params += keyName + "=" + encodeURIComponent( v );
			}
		} );
	}

	// Build sequential restore chain: first password, then options
	var restoreChain = $.Deferred().resolve();

	// Restore password via /sp if present in backup (sopt index 0)
	if ( data.sopts[ "0" ] ) {
		restoreChain = restoreChain.then( function() {
			var pwHash = encodeURIComponent( data.sopts[ "0" ] );
			return OSApp.Firmware.sendToOS( "/sp?pw=&npw=" + pwHash + "&cpw=" + pwHash, "json" ).then( function( resp ) {
				// After password change succeeds, update the session so
				// subsequent requests (e.g. /co) authenticate correctly.
				OSApp.currentSession.pass = data.sopts[ "0" ];
				return resp;
			} );
		} );
	}

	// Restore other options via /co
	if ( params ) {
		restoreChain = restoreChain.then( function() {
			return OSApp.Firmware.sendToOS( "/co?pw=&" + params, "json" );
		} );
	}

	restoreChain.done( function() {
		$.mobile.loading( "hide" );
		localStorage.removeItem( OSApp.ESP32Mode.OTA_BACKUP_KEY );
		if ( onDone ) {
			onDone();
		} else {
			OSApp.Errors.showError( OSApp.Language._( "Configuration restored successfully" ) );
			OSApp.Sites.updateController( function() {
				OSApp.UIDom.goHome();
			} );
		}
	} ).fail( function() {
		$.mobile.loading( "hide" );
		if ( onFail ) {
			onFail();
		} else {
			OSApp.Errors.showError( OSApp.Language._( "Error restoring configuration" ) );
		}
	} );
};

// ============================================================================
// HTTPS Certificate Management
// ============================================================================

/**
 * Show the HTTPS Certificate management popup.
 * Calls /tg?pw= to get current cert info, then displays options
 * for internal (built-in) or custom certificate.
 */
OSApp.ESP32Mode.setupCertManagement = function() {
	$.mobile.loading( "show" );

	OSApp.Firmware.sendToOS( "/tg?pw=", "json" ).done( function( data ) {
		$.mobile.loading( "hide" );

		if ( !data ) {
			OSApp.Errors.showError( OSApp.Language._( "Error reading certificate info" ) );
			return;
		}

		OSApp.ESP32Mode.showCertManagementPopup( data );
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
	} );
};

/**
 * Display the certificate management popup.
 */
OSApp.ESP32Mode.showCertManagementPopup = function( certInfo ) {
	var isCustom = certInfo.type === "custom",
		content = "";

	content += "<div class='ui-content' role='main' style='max-width:500px;'>";
	content += "<h3>" + OSApp.Language._( "HTTPS Certificate" ) + "</h3>";

	// Current cert info
	content += "<div style='background:#f5f5f5;padding:8px;border-radius:4px;margin-bottom:10px;font-size:0.9em;'>";
	content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Type" ) + ":</b> " +
		( isCustom ? OSApp.Language._( "Custom" ) : OSApp.Language._( "Internal (built-in)" ) ) + "</p>";
	if ( certInfo.subject ) {
		content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Subject" ) + ":</b> " + $( "<span>" ).text( certInfo.subject ).html() + "</p>";
	}
	if ( certInfo.issuer ) {
		content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Issuer" ) + ":</b> " + $( "<span>" ).text( certInfo.issuer ).html() + "</p>";
	}
	if ( certInfo.not_before ) {
		content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Valid from" ) + ":</b> " + $( "<span>" ).text( certInfo.not_before ).html() + "</p>";
	}
	if ( certInfo.not_after ) {
		content += "<p style='margin:2px 0;'><b>" + OSApp.Language._( "Valid until" ) + ":</b> " + $( "<span>" ).text( certInfo.not_after ).html() + "</p>";
	}
	content += "</div>";

	// Certificate type selection
	content += "<fieldset data-role='controlgroup'>";
	content += "<legend>" + OSApp.Language._( "Certificate Mode" ) + "</legend>";
	content += "<label for='cert-mode-internal'>";
	content += "<input type='radio' name='cert-mode' id='cert-mode-internal' value='internal'";
	if ( !isCustom ) { content += " checked='checked'"; }
	content += "> " + OSApp.Language._( "Internal (built-in)" );
	content += "</label>";
	content += "<label for='cert-mode-custom'>";
	content += "<input type='radio' name='cert-mode' id='cert-mode-custom' value='custom'";
	if ( isCustom ) { content += " checked='checked'"; }
	content += "> " + OSApp.Language._( "Custom Certificate" );
	content += "</label>";
	content += "</fieldset>";

	// PEM editor area (shown when "Custom" is selected)
	content += "<div id='cert-pem-editor' style='" + ( isCustom ? "" : "display:none;" ) + "'>";
	content += "<label for='cert-pem-cert'><b>" + OSApp.Language._( "Certificate (PEM)" ) + ":</b></label>";
	content += "<textarea id='cert-pem-cert' rows='6' style='font-family:monospace;font-size:0.8em;width:100%;' " +
		"placeholder='-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----'></textarea>";

	content += "<label for='cert-pem-key'><b>" + OSApp.Language._( "Private Key (PEM)" ) + ":</b></label>";
	content += "<textarea id='cert-pem-key' rows='6' style='font-family:monospace;font-size:0.8em;width:100%;' " +
		"placeholder='-----BEGIN EC PRIVATE KEY-----&#10;...&#10;-----END EC PRIVATE KEY-----'></textarea>";

	// File upload buttons
	content += "<div style='margin:8px 0;'>";
	content += "<label class='ui-btn ui-btn-inline ui-mini ui-icon-arrow-u ui-btn-icon-left'>" +
		OSApp.Language._( "Load Cert File" ) +
		"<input type='file' id='cert-file-input' accept='.pem,.crt,.cer' style='display:none;'>" +
		"</label> ";
	content += "<label class='ui-btn ui-btn-inline ui-mini ui-icon-arrow-u ui-btn-icon-left'>" +
		OSApp.Language._( "Load Key File" ) +
		"<input type='file' id='key-file-input' accept='.pem,.key' style='display:none;'>" +
		"</label>";
	content += "</div>";

	content += "<button class='cert-upload-btn ui-btn ui-btn-b ui-corner-all'>" + OSApp.Language._( "Upload & Validate" ) + "</button>";
	content += "</div>";

	// Delete button (only if custom cert is active)
	if ( isCustom ) {
		content += "<button class='cert-delete-btn ui-btn ui-btn-c ui-corner-all' style='color:#c00;'>" +
			OSApp.Language._( "Revert to Internal Certificate" ) + "</button>";
	}

	content += "<button class='cert-close-btn ui-btn ui-corner-all'>" + OSApp.Language._( "Close" ) + "</button>";
	content += "</div>";

	var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='certManagementPopup'>" + content + "</div>" );

	// Toggle PEM editor visibility based on radio selection
	popup.on( "change", "input[name='cert-mode']", function() {
		if ( $( this ).val() === "custom" ) {
			popup.find( "#cert-pem-editor" ).show();
		} else {
			popup.find( "#cert-pem-editor" ).hide();
		}
	} );

	// File input handlers
	popup.on( "change", "#cert-file-input", function() {
		var file = this.files[ 0 ];
		if ( !file ) { return; }
		var reader = new FileReader();
		reader.onload = function( e ) {
			popup.find( "#cert-pem-cert" ).val( e.target.result );
		};
		reader.readAsText( file );
	} );

	popup.on( "change", "#key-file-input", function() {
		var file = this.files[ 0 ];
		if ( !file ) { return; }
		var reader = new FileReader();
		reader.onload = function( e ) {
			popup.find( "#cert-pem-key" ).val( e.target.result );
		};
		reader.readAsText( file );
	} );

	// Upload & Validate
	popup.on( "click", ".cert-upload-btn", function() {
		var certPem = popup.find( "#cert-pem-cert" ).val().trim(),
			keyPem = popup.find( "#cert-pem-key" ).val().trim();

		if ( !certPem || !keyPem ) {
			OSApp.Errors.showError( OSApp.Language._( "Please provide both certificate and private key in PEM format" ) );
			return;
		}

		if ( certPem.indexOf( "-----BEGIN CERTIFICATE-----" ) < 0 ) {
			OSApp.Errors.showError( OSApp.Language._( "Invalid certificate format. Must be PEM encoded." ) );
			return;
		}

		if ( keyPem.indexOf( "-----BEGIN" ) < 0 || keyPem.indexOf( "PRIVATE KEY-----" ) < 0 ) {
			OSApp.Errors.showError( OSApp.Language._( "Invalid key format. Must be PEM encoded private key." ) );
			return;
		}

		$.mobile.loading( "show" );

		// Use POST to avoid the 1536-byte URL length limit on ESP32 hardware servers.
		// Password stays in the URL query string; cert/key go in the request body.
		var pass = encodeURIComponent( OSApp.currentSession.pass ),
			urlBase = OSApp.currentSession.token
				? "https://cloud.openthings.io/forward/v1/" + OSApp.currentSession.token
				: OSApp.currentSession.prefix + OSApp.currentSession.ip,
			ajaxCfg = {
				url: urlBase + "/tl?pw=" + pass,
				type: "POST",
				data: "cert=" + encodeURIComponent( certPem ) + "&key=" + encodeURIComponent( keyPem ),
				contentType: "application/x-www-form-urlencoded",
				dataType: "json",
				timeout: 30000
			};

		if ( OSApp.currentSession.auth ) {
			ajaxCfg.headers = { Authorization: "Basic " + btoa( OSApp.currentSession.authUser + ":" + OSApp.currentSession.authPass ) };
		}

		$.ajax( ajaxCfg ).done( function( resp ) {
			$.mobile.loading( "hide" );

			if ( resp && resp.result === 1 ) {
				popup.popup( "close" );
				setTimeout( function() {
					OSApp.UIDom.areYouSure(
						OSApp.Language._( "Certificate uploaded successfully. A reboot is required to apply the new certificate. Reboot now?" ),
						"",
						function() {
							OSApp.Firmware.sendToOS( "/cv?pw=&rbt=1" );
							OSApp.Errors.showError( OSApp.Language._( "OpenSprinkler is rebooting now" ) );
						}
					);
				}, 400 );
			} else {
				OSApp.Errors.showError( resp && resp.error ? resp.error : OSApp.Language._( "Certificate validation failed" ) );
			}
		} ).fail( function() {
			$.mobile.loading( "hide" );
			OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
		} );

		return false;
	} );

	// Delete custom cert
	popup.on( "click", ".cert-delete-btn", function() {
		popup.popup( "close" );
		setTimeout( function() {
			OSApp.UIDom.areYouSure(
				OSApp.Language._( "Revert to the internal (built-in) certificate? A reboot will be required." ),
				"",
				function() {
					$.mobile.loading( "show" );
					OSApp.Firmware.sendToOS( "/td?pw=", "json" ).done( function( resp ) {
						$.mobile.loading( "hide" );
						if ( resp && resp.result === 1 ) {
							OSApp.UIDom.areYouSure(
								OSApp.Language._( "Custom certificate removed. Reboot now to apply?" ),
								"",
								function() {
									OSApp.Firmware.sendToOS( "/cv?pw=&rbt=1" );
									OSApp.Errors.showError( OSApp.Language._( "OpenSprinkler is rebooting now" ) );
								}
							);
						} else {
							OSApp.Errors.showError( OSApp.Language._( "Failed to remove certificate" ) );
						}
					} ).fail( function() {
						$.mobile.loading( "hide" );
						OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
					} );
				}
			);
		}, 400 );
		return false;
	} );

	// Close
	popup.on( "click", ".cert-close-btn", function() {
		popup.popup( "close" );
		return false;
	} );

	OSApp.UIDom.openPopup( popup );
};
