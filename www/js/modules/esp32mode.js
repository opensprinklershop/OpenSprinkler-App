/* global $, cordova */

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
		featureStr.indexOf( "802.15.4" ) !== -1
	);
};

/**
 * Fetch the current IEEE 802.15.4 radio configuration from the /ir endpoint.
 * Caches the result in _radioInfo.
 * Returns a jQuery Deferred that resolves with the radio info object:
 *   { activeMode, activeModeName, modes[], enabled, matter, zigbee, zigbee_gw, zigbee_client }
 */
OSApp.ESP32Mode.fetchRadioInfo = function( forceRefresh ) {
	var deferred = $.Deferred();

	// Return cached data immediately if available and not forced refresh
	if ( !forceRefresh && OSApp.ESP32Mode._radioInfo !== null ) {
		deferred.resolve( OSApp.ESP32Mode._radioInfo );
		return deferred.promise();
	}

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

	var certDeferred = $.Deferred();
	OSApp.Firmware.sendToOS( "/tg?pw=", "json" ).done( function( data ) {
		certDeferred.resolve( data );
	} ).fail( function() {
		certDeferred.resolve( null );
	} );

	OSApp.ESP32Mode.fetchRadioInfo( true ).done( function( radioInfo ) {
		certDeferred.done( function( certInfo ) {
			$.mobile.loading( "hide" );
			OSApp.ESP32Mode.showESP32ModePopup( radioInfo, certInfo );
		} );
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
	} );
};

/**
 * Display the ESP32 Mode / HTTPS Certificate tabbed popup
 */
OSApp.ESP32Mode.showESP32ModePopup = function( radioInfo, certInfo ) {
	var currentMode = radioInfo.activeMode,
		currentLabel = OSApp.ESP32Mode.getModeLabel( currentMode ),
		isCustom = certInfo && certInfo.type === "custom",
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
		if ( !isCustom ) { content += " checked='checked'"; }
		content += "> " + OSApp.Language._( "Internal (built-in)" );
		content += "</label>";
		content += "<label for='cert-mode-custom'>";
		content += "<input type='radio' name='cert-mode' id='cert-mode-custom' value='custom'";
		if ( isCustom ) { content += " checked='checked'"; }
		content += "> " + OSApp.Language._( "Custom Certificate" );
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
		content += "<button class='cert-upload-btn ui-btn ui-btn-b ui-corner-all'>" + OSApp.Language._( "Upload & Validate" ) + "</button>";
		content += "</div>"; // end cert-pem-editor

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

		if ( selectedMode === currentMode ) {
			popup.popup( "close" );
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

	// Cert tab: toggle PEM editor
	popup.on( "change", "input[name='cert-mode']", function() {
		if ( $( this ).val() === "custom" ) {
			popup.find( "#cert-pem-editor" ).show();
		} else {
			popup.find( "#cert-pem-editor" ).hide();
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
		OSApp.Firmware.sendToOS( "/tl?pw=&cert=" + encodeURIComponent( certPem ) + "&key=" + encodeURIComponent( keyPem ), "json" ).done( function( resp ) {
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
				OSApp.Errors.showError( resp && resp.message ? resp.message : OSApp.Language._( "Certificate validation failed" ) );
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
			if ( raw ) { return ( this._mem[ ieee ] = JSON.parse( raw ) ); }
		} catch ( e ) { void e; }
		return null;
	},

	setCached: function( ieee, data ) {
		this._mem[ ieee ] = data;
		try { localStorage.setItem( "zb_dev_" + ieee, JSON.stringify( data ) ); } catch ( e ) { void e; }
	},

	lookup: function( manufacturer, model ) {
		var url = this.API_URL + "?manufacturer=" + encodeURIComponent( manufacturer ) + "&model=" + encodeURIComponent( model );
		return $.ajax( { url: url, dataType: "json", timeout: 6000 } );
	},

	/** Returns cluster_entries array for the sensor-editor combobox.
	 *  Each entry has: label, cluster_id, attr_id, sensor_name, unit, unitid,
	 *  factor, divider, is_tuya_dp, dp, endpoint, vendor, model_name, fingerprint.
	 *  Resolves with [] on failure so callers don't need to handle errors. */
	lookupForCombobox: function( manufacturer, model ) {
		var url = this.API_URL +
			"?manufacturer=" + encodeURIComponent( manufacturer ) +
			"&model="        + encodeURIComponent( model ) +
			"&for_combobox=1";
		return $.ajax( { url: url, dataType: "json", timeout: 8000 } )
			.then(
				function( data ) { return data.cluster_entries || []; },
				function()       { return []; }
			);
	},

	enrich: function( dev, $li ) {
		var self = this;
		var ieee = dev.ieee || "";
		var mfr  = dev.manufacturer || "";
		var mdl  = dev.model || "";
		if ( !mfr || mfr === "unknown" ) { return; }

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
		}
	}
};

/**
 * Display the ZigBee Gateway management panel.
 * Shows the device list from /zg (action=list) response and a permit-join button.
 * Response format: { result:1, action:"list", devices:[ {ieee, short_addr, model, manufacturer, endpoint, device_id, is_new, last_rx_s, online} ], count:N }
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
			var isOnline  = dev.online === 1 || dev.online === true;
			var hasRxInfo = dev.last_rx_s !== undefined && dev.last_rx_s !== null;
			var onlineBadge = isOnline
				? "<span style='color:#4caf50'>&#9679; " + OSApp.Language._( "Online" ) + "</span>"
				: ( hasRxInfo
					? "<span style='color:#9e9e9e'>&#9675; " + OSApp.Language._( "Offline" ) + "</span>"
					: "" );
			var ieeeAttr = dev.ieee ? " data-ieee='" + dev.ieee.replace( /'/g, "" ) + "'" : "";

			content += "<li" + ( dev.is_new ? " data-theme='b'" : "" ) + ieeeAttr + ">";
			content += "<h4>" + ( ( dev.model && dev.model !== "unknown" ) ? dev.model : OSApp.Language._( "Unknown Device" ) ) + "</h4>";
			if ( onlineBadge ) {
				content += "<p>" + onlineBadge + "</p>";
			}
			content += "<p class='zb-db-info' style='display:none;color:#888;font-size:0.85em;margin:2px 0;'></p>";
			if ( dev.ieee ) {
				content += "<p>" + OSApp.Language._( "IEEE" ) + ": " + dev.ieee + "</p>";
			}
			if ( dev.manufacturer && dev.manufacturer !== "unknown" ) {
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

	// Async: enrich each device with vendor / description from the Zigbee Device DB
	if ( data.devices ) {
		for ( var j = 0; j < data.devices.length; j++ ) {
			var d = data.devices[ j ];
			if ( d.ieee && d.manufacturer && d.manufacturer !== "unknown" ) {
				var $li = popup.find( "li[data-ieee='" + d.ieee + "']" );
				OSApp.ESP32Mode.ZigbeeDeviceDB.enrich( d, $li );
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
		} else {
			content += "<p>" + OSApp.Language._( "Status" ) + ": <strong>" + OSApp.Language._( "Not commissioned" ) + "</strong></p>";
			if ( data.pairing_code ) {
				content += "<p>" + OSApp.Language._( "Pairing Code" ) + ": <code>" + data.pairing_code + "</code></p>";
			}
			if ( data.qr_url ) {
				content += "<p><a href='" + data.qr_url + "' target='_blank' class='ui-btn ui-btn-inline ui-mini ui-corner-all'>" +
					OSApp.Language._( "Open QR Code" ) + "</a></p>";
			}
		}

		content += "<button class='matter-open-commissioning ui-btn ui-btn-b ui-corner-all'>" +
			OSApp.Language._( "Open Commissioning Window" ) + "</button>";
		content += "<button class='cancel-matter ui-btn ui-corner-all'>" + OSApp.Language._( "Close" ) + "</button>";
		content += "</div>";

		var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='matterSetupPopup'>" + content + "</div>" );

		popup.on( "click", ".cancel-matter", function() {
			popup.popup( "close" );
			return false;
		} );

		popup.on( "click", ".matter-open-commissioning", function() {
			popup.popup( "close" );
			OSApp.ESP32Mode.matterOpenCommissioningWindow();
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
	REBOOTING_PHASE2: 13
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

/**
 * Show the Online Update popup with interactive backup/restore steps.
 * Calls /uc?pw= to check for updates and displays a stepped process:
 *   Step 1: Backup config to app (localStorage) — flash backup is automatic in firmware
 *   Step 2: Start OTA download & flash with progress
 *   Step 3: After reboot, offer config restore
 */
OSApp.ESP32Mode.setupOnlineUpdate = function() {
	$.mobile.loading( "show" );

	// Timeout 25s — firmware makes a blocking HTTPS request (15s timeout) to check the update server
	OSApp.Firmware.sendToOS( "/uc?pw=", "json", 25000 ).done( function( data ) {
		$.mobile.loading( "hide" );

		if ( !data || typeof data.status === "undefined" ) {
			OSApp.Errors.showError( OSApp.Language._( "Error checking for updates" ) );
			return;
		}

		// Handle firmware-side errors (e.g. device can't reach update server)
		var st = OSApp.ESP32Mode.OTA_STATUS;
		if ( data.status === st.ERROR_NETWORK || data.status === st.ERROR_PARSE ) {
			var errMsg = data.status === st.ERROR_NETWORK
				? OSApp.Language._( "Device could not reach the update server. Check internet connection." )
				: OSApp.Language._( "Failed to parse update information from server." );
			OSApp.Errors.showError( errMsg );
			return;
		}

		var curVer = OSApp.ESP32Mode.formatFwVersion( data.cur_version ) + "." + data.cur_minor;
		var content = "<div class='ui-content'>";
		content += "<h3>" + OSApp.Language._( "Online Firmware Update" ) + "</h3>";
		content += "<p><b>" + OSApp.Language._( "Current version" ) + ":</b> " + curVer + "</p>";

		if ( data.available === 1 ) {
			var newVer = OSApp.ESP32Mode.formatFwVersion( data.fw_version ) + "." + data.fw_minor;
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

			content += "<button class='ota-start-interactive ui-btn ui-btn-b'>" + OSApp.Language._( "Start Update" ) + "</button>";
		} else {
			content += "<p style='color:green;'>&#9745; " + OSApp.Language._( "Firmware is up to date" ) + "</p>";
			content += "<button class='ota-reinstall ui-btn ui-mini ui-btn-b' style='margin-top:4px;'>" +
				OSApp.Language._( "Reinstall current version" ) + "</button>";
			content += "<button class='ota-older-version ui-btn ui-mini' style='margin-top:4px;'>" +
				OSApp.Language._( "Install older version..." ) + "</button>";
		}

		// Show restore option if a prior backup exists
		var existingBackup = OSApp.ESP32Mode.hasAppBackup();
		if ( existingBackup ) {
			content += "<div style='margin-top:10px;padding:8px;background:#fff3cd;border-radius:4px;'>";
			content += "<p style='margin:2px 0;font-size:0.9em;'><b>" + OSApp.Language._( "Previous backup found" ) + "</b> (" +
				$( "<span>" ).text( existingBackup.timestamp ).html() + ")</p>";
			content += "<button class='ota-restore-backup ui-btn ui-mini'>" + OSApp.Language._( "Restore Configuration" ) + "</button>";
			content += "</div>";
		}

		content += "<button class='ota-cancel ui-btn'>" + OSApp.Language._( "Close" ) + "</button>";
		content += "</div>";

		var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='otaUpdatePopup'>" + content + "</div>" );

		popup.on( "click", ".ota-cancel", function() {
			popup.popup( "close" );
			return false;
		} );

		popup.on( "click", ".ota-start-interactive", function() {
			$( this ).prop( "disabled", true ).addClass( "ui-state-disabled" );
			OSApp.ESP32Mode.runInteractiveOTA( popup );
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

		popup.on( "click", ".ota-restore-backup", function() {
			popup.popup( "close" );
			setTimeout( function() {
				OSApp.ESP32Mode.showRestorePopup();
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
		"</div>";
	popup.find( "h3" ).after( stepHtml );

	OSApp.ESP32Mode.runInteractiveOTA( popup );
};

/**
 * Fetch versions.json and show a popup that lets the user pick an older
 * firmware version to install.
 * @param {Object} checkData  Response from /uc (contains cur_version etc.)
 */
OSApp.ESP32Mode.showVersionPicker = function( checkData ) {
	var versionsUrl = ( checkData && checkData.versions_url )
		? checkData.versions_url
		: "https://opensprinklershop.de/upgrade/versions.json";

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
				? $( "<span>" ).text( v.changelog.substring( 0, 120 ) ).html() + ( v.changelog.length > 120 ? "…" : "" )
				: "";

			content += "<li>" +
				"<a href='#' class='ota-version-item'" +
				" data-zu='" + $( "<span>" ).text( v.zigbee_url || "" ).html() + "'" +
				" data-mu='" + $( "<span>" ).text( v.matter_url  || "" ).html() + "'" +
				" data-ver='" + verLabel + "'>" +
				"<b>v" + verLabel + "</b>" + badge + dateStr;
			if ( changelogSnippet ) {
				content += "<p class='ui-li-desc' style='white-space:normal;'>" + changelogSnippet + "</p>";
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
			var ver = $( this ).data( "ver" );
			picker.popup( "close" );
			setTimeout( function() {
				OSApp.ESP32Mode.startOTAwithURLs( zu, mu, ver );
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
 * @param {string} zigbeeUrl  URL for the zigbee/main firmware binary.
 * @param {string} matterUrl  URL for the matter firmware binary (C5 only).
 * @param {string} verLabel   Human-readable version string shown in the popup title.
 */
OSApp.ESP32Mode.startOTAwithURLs = function( zigbeeUrl, matterUrl, verLabel ) {
	var urlParams = "";
	if ( zigbeeUrl ) { urlParams += "&zu=" + encodeURIComponent( zigbeeUrl ); }
	if ( matterUrl  ) { urlParams += "&mu=" + encodeURIComponent( matterUrl  ); }

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

	content += "<button class='ota-start-specific ui-btn ui-btn-b'>" + OSApp.Language._( "Start Install" ) + "</button>";
	content += "<button class='ota-cancel ui-btn'>" + OSApp.Language._( "Cancel" ) + "</button>";
	content += "</div>";

	var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='otaUpdatePopup'>" + content + "</div>" );

	popup.on( "click", ".ota-cancel", function() {
		popup.popup( "close" );
		return false;
	} );

	popup.on( "click", ".ota-start-specific", function() {
		$( this ).prop( "disabled", true ).addClass( "ui-state-disabled" );
		OSApp.ESP32Mode.runInteractiveOTA( popup, urlParams );
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

	// --- Step 1: Backup config to app ---
	popup.find( "#ota-step-1" ).css( "color", "#1976D2" ).html(
		"&#9658; <b>" + OSApp.Language._( "Backing up configuration..." ) + "</b>"
	);

	OSApp.ESP32Mode.backupConfigToApp().done( function() {
		popup.find( "#ota-step-1" ).css( "color", "#4CAF50" ).html(
			"&#9745; " + OSApp.Language._( "Configuration backed up" )
		);

		// --- Step 2: Start OTA download & flash ---
		popup.find( "#ota-step-2" ).css( "color", "#1976D2" ).html(
			"&#9658; <b>" + OSApp.Language._( "Starting firmware download..." ) + "</b>"
		);

		OSApp.ESP32Mode.runInteractiveOTA_step2( popup, urlParams );
	} ).fail( function( errMsg ) {
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
	// Add progress bar if not already present
	if ( !popup.find( "#ota-progress-area" ).length ) {
		popup.find( "#ota-steps" ).after(
			"<div id='ota-progress-area' style='margin:8px 0;'>" +
			"<div style='background:#ddd;border-radius:4px;height:20px;'>" +
			"<div id='ota-progress-bar' style='background:#4CAF50;height:100%;border-radius:4px;width:0%;transition:width 0.3s;'></div>" +
			"</div>" +
			"<p id='ota-progress-msg' style='font-size:0.85em;margin:4px 0;'></p>" +
			"</div>"
		);
	}

	var uuCmd = "/uu?pw=" + ( urlParams || "" );
	OSApp.Firmware.sendToOS( uuCmd, "json" ).done( function( resp ) {
		if ( !resp || resp.result !== 1 ) {
			popup.find( "#ota-step-2" ).css( "color", "#f44336" ).html(
				"&#9746; " + OSApp.Language._( "Failed to start update" ) +
				( resp && resp.message ? ": " + $( "<span>" ).text( resp.message ).html() : "" )
			);
			return;
		}

		var failCount = 0;
		var maxFails = 45; // 45 × 2s = 90s tolerance for mid-update reboot
		var sawRebootPhase2 = false;
		var phase2Started = false;

		var pollInterval = setInterval( function() {
			OSApp.Firmware.sendToOS( "/us?pw=", "json" ).done( function( st ) {
				if ( !st ) { return; }
				failCount = 0;

				popup.find( "#ota-progress-msg" ).text( st.message || "" );
				popup.find( "#ota-progress-bar" ).css( "width", st.progress + "%" );

				// Phase 1: flashing first partition (progress 5-48%)
				if ( !sawRebootPhase2 && !phase2Started &&
					( st.status === OSApp.ESP32Mode.OTA_STATUS.DOWNLOADING_ZIGBEE ||
					  st.status === OSApp.ESP32Mode.OTA_STATUS.DOWNLOADING_MATTER ) ) {
					popup.find( "#ota-step-2" ).css( "color", "#1976D2" ).html(
						"&#9658; <b>" + OSApp.Language._( "Flashing partition 1" ) + "... " + st.progress + "%</b>"
					);
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
						"&#9658; <b>" + OSApp.Language._( "Flashing partition 2" ) + "... " + st.progress + "%</b>"
					);
				}

				// Done (progress 100%)
				if ( st.status === OSApp.ESP32Mode.OTA_STATUS.DONE ) {
					clearInterval( pollInterval );
					popup.find( "#ota-step-2" ).css( "color", "#4CAF50" ).html(
						"&#9745; " + OSApp.Language._( "Partition 1 flashed" )
					);
					popup.find( "#ota-step-3" ).css( "color", "#4CAF50" ).html(
						"&#9745; " + OSApp.Language._( "Rebooted for phase 2" )
					);
					popup.find( "#ota-step-4" ).css( "color", "#4CAF50" ).html(
						"&#9745; " + OSApp.Language._( "Partition 2 flashed" )
					);
					popup.find( "#ota-progress-bar" ).css( "width", "100%" );

					popup.find( "#ota-step-5" ).css( "color", "#FF9800" ).html(
						"&#9658; <b>" + OSApp.Language._( "Device is rebooting..." ) + "</b>"
					);

					setTimeout( function() {
						popup.find( "#ota-step-5" ).css( "color", "#4CAF50" ).html(
							"&#9745; " + OSApp.Language._( "Update complete. Restore configuration from the menu when ready." )
						);
						popup.find( ".ota-start-interactive" ).remove();
						popup.find( ".ota-cancel" ).text( OSApp.Language._( "Close" ) );
					}, 8000 );
				} else if ( st.status >= OSApp.ESP32Mode.OTA_STATUS.ERROR_NETWORK &&
							st.status <= OSApp.ESP32Mode.OTA_STATUS.ERROR_FLASH_MATTER ) {
					clearInterval( pollInterval );
					popup.find( "#ota-progress-bar" ).css( "background", "#f44336" );
					var failStep = phase2Started ? "#ota-step-4" : "#ota-step-2";
					popup.find( failStep ).css( "color", "#f44336" ).html(
						"&#9746; " + OSApp.Language._( "Update failed" ) + ": " +
						$( "<span>" ).text( st.message ).html()
					);
				}
			} ).fail( function() {
				failCount++;
				if ( sawRebootPhase2 ) {
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
 */
OSApp.ESP32Mode.restoreFromAppBackup = function( data ) {
	if ( !data || !data.sopts ) {
		OSApp.Errors.showError( OSApp.Language._( "Invalid backup data" ) );
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
		"13": "fyta"    // SOPT_FYTA_OPTS
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

	// Build sequential restore chain: first password, then options
	var restoreChain = $.Deferred().resolve();

	// Restore password via /sp if present in backup (sopt index 0)
	if ( data.sopts[ "0" ] ) {
		restoreChain = restoreChain.then( function() {
			var pwHash = encodeURIComponent( data.sopts[ "0" ] );
			return OSApp.Firmware.sendToOS( "/sp?pw=&npw=" + pwHash + "&cpw=" + pwHash, "json" );
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
		OSApp.Errors.showError( OSApp.Language._( "Configuration restored successfully" ) );
		// Refresh controller data
		OSApp.Sites.updateController( function() {
			OSApp.UIDom.goHome();
		} );
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error restoring configuration" ) );
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

		// Send PEM data URL-encoded via GET
		OSApp.Firmware.sendToOS( "/tl?pw=&cert=" + encodeURIComponent( certPem ) + "&key=" + encodeURIComponent( keyPem ), "json" ).done( function( resp ) {
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
				OSApp.Errors.showError( resp && resp.message ? resp.message : OSApp.Language._( "Certificate validation failed" ) );
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
