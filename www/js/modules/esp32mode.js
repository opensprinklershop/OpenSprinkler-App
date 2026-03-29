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

	var acmeDeferred = $.Deferred();
	OSApp.Firmware.sendToOS( "/ta?pw=", "json" ).done( function( data ) {
		acmeDeferred.resolve( data );
	} ).fail( function() {
		acmeDeferred.resolve( null );
	} );

	OSApp.ESP32Mode.fetchRadioInfo( true ).done( function( radioInfo ) {
		$.when( certDeferred, acmeDeferred ).done( function( certInfo, acmeInfo ) {
			$.mobile.loading( "hide" );
			OSApp.ESP32Mode.showESP32ModePopup( radioInfo, certInfo, acmeInfo );
		} );
	} ).fail( function() {
		$.mobile.loading( "hide" );
		OSApp.Errors.showError( OSApp.Language._( "Error connecting to device" ) );
	} );
};

/**
 * Display the ESP32 Mode / HTTPS Certificate tabbed popup
 */
OSApp.ESP32Mode.showESP32ModePopup = function( radioInfo, certInfo, acmeInfo ) {
	var currentMode = radioInfo.activeMode,
		currentLabel = OSApp.ESP32Mode.getModeLabel( currentMode ),
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
			if ( raw ) { return ( this._mem[ ieee ] = JSON.parse( raw ) ); }
		} catch ( e ) { void e; }
		return null;
	},

	setCached: function( ieee, data ) {
		this._mem[ ieee ] = data;
		try { localStorage.setItem( "zb_dev_" + ieee, JSON.stringify( data ) ); } catch ( e ) { void e; }
		// Also cache the human-readable display label for quick h4 pre-population
		var label = ( data.vendor && data.description )
			? data.vendor + " — " + data.description
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
			// Update main device title so it shows the proper product name
			$li.find( "h4" ).text( label );
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
			// Pre-populate from cached DB label (persisted by IEEE across page reloads)
			var cachedDevLabel = ( dev.ieee && OSApp.ESP32Mode.ZigbeeDeviceDB.getCachedLabel( dev.ieee ) ) || null;
			var deviceTitle = cachedDevLabel || ( ( dev.model && dev.model !== "unknown" ) ? dev.model : OSApp.Language._( "Unknown Device" ) );
			content += "<h4>" + OSApp.Utils.htmlEscape( deviceTitle ) + "</h4>";
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
			if ( d.ieee ) {
				var $li = popup.find( "li[data-ieee='" + d.ieee.replace( /'/g, "" ) + "']" );
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

OSApp.ESP32Mode.getOnlineUpdateVariantLabel = function() {
	if ( OSApp.Firmware.isOSPi() ) {
		return OSApp.Language._( "OSPi Script Update" );
	}
	if ( OSApp.ESP32Mode.isESP32Supported() ) {
		return OSApp.Language._( "ESP32 OTA" );
	}
	return OSApp.Language._( "ESP8266 Direct OTA" );
};

OSApp.ESP32Mode.OTA_EXPECTED_DURATION_SECONDS = 180;

OSApp.ESP32Mode.getInteractiveOTAOptionsHtml = function() {
	var html = "<div class='ota-auto-restore-area' style='margin:10px 0;padding:10px;background:#eef6ea;border-radius:6px;'>" +
		"<label style='display:flex;align-items:center;gap:8px;font-size:0.95em;cursor:pointer;'>" +
		"<input type='checkbox' class='ota-auto-restore' checked='checked'>" +
		OSApp.Language._( "Automatically restore saved configuration after update" ) +
		"</label>" +
		"<div style='font-size:0.82em;color:#666;margin-top:6px;'>" +
		OSApp.Language._( "If enabled, the saved configuration is restored automatically after the device comes back online." ) +
		"</div>" +
		"</div>" +
		"<button class='ota-inline-restore ui-btn ui-mini' style='display:none;'>" + OSApp.Language._( "Restore Configuration" ) + "</button>";

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
			"<div style='background:#ddd;border-radius:4px;height:20px;'>" +
			"<div id='ota-progress-bar' style='background:#4CAF50;height:100%;border-radius:4px;width:0%;transition:width 0.3s;'></div>" +
			"</div>" +
			"<div style='margin-top:6px;background:#ddd;border-radius:4px;height:14px;'>" +
			"<div id='ota-overall-progress-bar' style='background:#1976D2;height:100%;border-radius:4px;width:0%;transition:width 0.3s;'></div>" +
			"</div>" +
			"<p id='ota-overall-msg' style='font-size:0.78em;margin:4px 0;color:#666;'></p>" +
			"<p id='ota-progress-msg' style='font-size:0.85em;margin:4px 0;'></p>" +
			"<p id='ota-elapsed-msg' style='font-size:0.8em;margin:4px 0;color:#666;'></p>" +
			"</div>"
		);
	}
};

OSApp.ESP32Mode.markOTACompleted = function( popup ) {
	popup.data( "otaFlowCompleted", true );
	popup.find( "#ota-overall-progress-bar" ).css( "width", "100%" );
	popup.find( "#ota-overall-msg" ).text(
		OSApp.Language._( "Overall progress" ) + ": 100%"
	);
};

OSApp.ESP32Mode.stopOTADurationTimer = function( popup ) {
	var timerId = popup.data( "otaElapsedTimer" );
	if ( timerId ) {
		clearInterval( timerId );
		popup.removeData( "otaElapsedTimer" );
	}
};

OSApp.ESP32Mode.startOTADurationTimer = function( popup ) {
	OSApp.ESP32Mode.ensureOTAProgressArea( popup );
	OSApp.ESP32Mode.stopOTADurationTimer( popup );

	var startedAt = Date.now();
	popup.data( "otaElapsedStartedAt", startedAt );
	popup.data( "otaFlowCompleted", false );

	var updateElapsed = function() {
		var elapsedSeconds = Math.max( 0, Math.floor( ( Date.now() - startedAt ) / 1000 ) );
		var isDone = !!popup.data( "otaFlowCompleted" );
		var overallPct = isDone
			? 100
			: Math.min( 99, Math.floor( ( elapsedSeconds / OSApp.ESP32Mode.OTA_EXPECTED_DURATION_SECONDS ) * 100 ) );

		popup.find( "#ota-elapsed-msg" ).text(
			OSApp.Language._( "Elapsed time" ) + ": " + elapsedSeconds + "s"
		);
		popup.find( "#ota-overall-progress-bar" ).css( "width", overallPct + "%" );
		popup.find( "#ota-overall-msg" ).text(
			OSApp.Language._( "Overall progress" ) + ": " + overallPct + "%"
		);
	};

	updateElapsed();
	popup.data( "otaElapsedTimer", setInterval( updateElapsed, 1000 ) );
};

OSApp.ESP32Mode.restoreFromAppBackupInPopup = function( popup ) {
	var backup = OSApp.ESP32Mode.hasAppBackup();
	if ( !backup ) {
		popup.find( "#ota-step-5" ).css( "color", "#FF9800" ).html(
			"&#9888; " + OSApp.Language._( "No backup found — manual restore needed" )
		);
		popup.find( ".ota-inline-restore" ).hide();
		OSApp.ESP32Mode.stopOTADurationTimer( popup );
		return;
	}

	popup.find( ".ota-inline-restore" ).hide();
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
		popup.find( "#ota-progress-msg" ).text( OSApp.Language._( "Restore failed. You can retry it below." ) );
		popup.find( ".ota-inline-restore" ).show();
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

	// Timeout 25s — firmware makes a blocking HTTPS request (15s timeout) to check the update server
	$.when( radioDeferred, OSApp.Firmware.sendToOS( "/uc?pw=", "json", 25000 ) ).done( function( radioResult, data ) {
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

		popup.on( "click", ".ota-restore-backup", function() {
			OSApp.ESP32Mode.stopOTADurationTimer( popup );
			popup.popup( "close" );
			setTimeout( function() {
				OSApp.ESP32Mode.showRestorePopup();
			}, 400 );
			return false;
		} );

		popup.on( "click", ".ota-inline-restore", function() {
			OSApp.ESP32Mode.restoreFromAppBackupInPopup( popup );
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
	var prefix = ( OSApp.currentSession && OSApp.currentSession.prefix ) ? OSApp.currentSession.prefix : "http://";

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

	return ( prefix + rawIp ).replace( /\/+$/, "" );
};

OSApp.ESP32Mode.getDirectDeviceUpdateUrl = function() {
	return OSApp.ESP32Mode.getDirectDeviceBaseUrl() + "/update";
};

/**
 * Legacy online update flow (ESP8266 and non-ESP32 builds).
 * Uses direct online update endpoints (/uc, /uu, /us).
 */
OSApp.ESP32Mode.setupLegacyOnlineUpdate = function() {
	if ( !OSApp.Firmware.isOnlineUpdateSupported() ) {
		OSApp.Errors.showError( OSApp.Language._( "Online firmware update requires firmware version 2.4.0 or newer." ) );
		return;
	}

	var existingBackup = OSApp.ESP32Mode.hasAppBackup();
	var isOtcConnection = !!OSApp.currentSession.token;
	var curVer = OSApp.Firmware.getOSVersion() + OSApp.Firmware.getOSMinorVersion();
	var variantLabel = OSApp.ESP32Mode.getOnlineUpdateVariantLabel();
	var content = "<div class='ui-content'>";
	content += "<h3>" + OSApp.Language._( "Online Firmware Update" ) + " - " + variantLabel + "</h3>";
	content += "<p><b>" + OSApp.Language._( "Current version" ) + ":</b> " + curVer + "</p>";
	content += "<p style='color:green;font-weight:bold;'>" + OSApp.Language._( "Firmware is up to date" ) + "</p>";
	content += "<p style='font-size:0.9em;color:#666;'>" +
		OSApp.Language._( "This device downloads and installs the firmware directly." ) +
		"</p>";
	if ( isOtcConnection ) {
		content += "<div style='margin:12px 0;padding:10px;background:#fff3e0;color:#b26a00;border-radius:6px;'>" +
			OSApp.Language._( "Firmware update is only available over a direct connection to the device. OTC connections are not supported for firmware updates." ) +
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

	if ( !isOtcConnection ) {
		content += "<button class='legacy-ota-start ui-btn ui-btn-b'>" + OSApp.Language._( "Start Update" ) + "</button>";
	}
	content += "<button class='legacy-ota-after-reboot ui-btn' style='display:none;'>" + OSApp.Language._( "Device rebooted - Restore configuration" ) + "</button>";

	if ( existingBackup ) {
		content += "<div style='margin-top:10px;padding:8px;background:#fff3cd;border-radius:4px;'>";
		content += "<p style='margin:2px 0;font-size:0.9em;'><b>" + OSApp.Language._( "Previous backup found" ) + "</b> (" +
			$( "<span>" ).text( existingBackup.timestamp ).html() + ")</p>";
		content += "<button class='ota-restore-backup ui-btn ui-mini'>" + OSApp.Language._( "Restore Configuration" ) + "</button>";
		content += "</div>";
	}

	content += "<button class='ota-cancel ui-btn'>" + OSApp.Language._( "Close" ) + "</button>";
	content += "</div>";

	var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='otaLegacyPopup'>" + content + "</div>" );

	popup.on( "click", ".ota-cancel", function() {
		popup.popup( "close" );
		return false;
	} );

	popup.on( "click", ".ota-restore-backup", function() {
		popup.popup( "close" );
		setTimeout( function() {
			OSApp.ESP32Mode.showRestorePopup();
		}, 400 );
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
			OSApp.ESP32Mode.runLegacyDirectOTA( popup );
		} ).fail( function( errMsg ) {
			popup.find( "#ota-step-1" ).css( "color", "#FF9800" ).html(
				"&#9888; " + OSApp.Language._( "Backup warning" ) + ": " + $( "<span>" ).text( errMsg ).html()
			);
			OSApp.UIDom.areYouSure(
				OSApp.Language._( "Configuration backup failed. Continue with update anyway?" ),
				"",
				function() {
					OSApp.ESP32Mode.runLegacyDirectOTA( popup );
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

OSApp.ESP32Mode.runLegacyDirectOTA = function( popup ) {
	popup.find( "#ota-step-2" ).css( "color", "#1976D2" ).html(
		"&#9658; <b>" + OSApp.Language._( "Downloading and installing firmware..." ) + "</b>"
	);

	OSApp.Firmware.sendToOS( "/uu?pw=", "json" ).done( function( resp ) {
		if ( !resp || resp.result !== 1 ) {
			popup.find( "#ota-step-2" ).css( "color", "#f44336" ).html(
				"&#9746; " + OSApp.Language._( "Failed to start update" ) +
				( resp && resp.message ? ": " + $( "<span>" ).text( resp.message ).html() : "" )
			);
			return;
		}

		// OTA accepted — the device will now download, flash and reboot.
		// It cannot serve HTTP while flashing, so skip progress polling
		// and go straight to reboot detection.
		popup.find( "#ota-step-2" ).css( "color", "#4CAF50" ).html(
			"&#9745; " + OSApp.Language._( "Update initiated on device" )
		);
		popup.find( "#ota-step-3" ).css( "color", "#1976D2" ).html(
			"&#9658; <b>" + OSApp.Language._( "Waiting for device reboot..." ) + "</b>"
		);
		popup.find( ".legacy-ota-start" ).hide();

		// Start reboot detection polling after a short initial delay.
		var originalPass = OSApp.currentSession.pass;
		var defaultPass = md5( "opendoor" );
		var baseUrl = OSApp.currentSession.prefix + OSApp.currentSession.ip;
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
	var baseUrl = OSApp.currentSession.prefix + OSApp.currentSession.ip;
	var pw = encodeURIComponent( currentDevicePass );

	var soptKeyMap = {
		"1": "loc", "4": "wto", "5": "ifkey", "8": "mqtt",
		"9": "otc", "10": "dname", "12": "email", "13": "fyta"
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
	content += OSApp.ESP32Mode.getInteractiveOTAOptionsHtml();

	content += "<button class='ota-start-specific ui-btn ui-btn-b'>" + OSApp.Language._( "Start Install" ) + "</button>";
	content += "<button class='ota-cancel ui-btn'>" + OSApp.Language._( "Cancel" ) + "</button>";
	content += "</div>";

	var popup = $( "<div data-role='popup' data-theme='a' data-overlay-theme='b' id='otaUpdatePopup'>" + content + "</div>" );

	popup.on( "click", ".ota-cancel", function() {
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

	popup.on( "click", ".ota-inline-restore", function() {
		OSApp.ESP32Mode.restoreFromAppBackupInPopup( popup );
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
	popup.find( ".ota-inline-restore" ).hide();

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

	var uuCmd = "/uu?pw=" + ( urlParams || "" );
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
			popup.find( "#ota-progress-bar" ).css( "width", "100%" );
			popup.find( "#ota-progress-msg" ).text( OSApp.Language._( "Waiting for device to restart..." ) );
			popup.find( ".ota-start-interactive, .ota-start-specific" ).remove();

			var reconnectSeconds = 0;
			reconnectPoll = setInterval( function() {
				if ( reconnectPending ) {
					return;
				}
				reconnectPending = true;
				reconnectSeconds += 3;
				popup.find( "#ota-progress-msg" ).text(
					OSApp.Language._( "Waiting for device to restart..." ) +
					" (" + reconnectSeconds + "s)"
				);

				OSApp.Firmware.sendToOS( "/jo?pw=", "json", 5000 ).done( function() {
					reconnectPending = false;
					clearInterval( reconnectPoll );
					OSApp.ESP32Mode.markOTACompleted( popup );
					popup.find( "#ota-progress-msg" ).text( OSApp.Language._( "Device is back online." ) );
					if ( OSApp.ESP32Mode.hasAppBackup() ) {
						if ( popup.find( ".ota-auto-restore" ).prop( "checked" ) ) {
							OSApp.ESP32Mode.restoreFromAppBackupInPopup( popup );
						} else {
							OSApp.ESP32Mode.stopOTADurationTimer( popup );
							popup.find( "#ota-step-5" ).css( "color", "#4CAF50" ).html(
								"&#9745; " + OSApp.Language._( "Update complete. Device is back online." )
							);
							popup.find( ".ota-inline-restore" ).show();
							popup.find( ".ota-cancel" ).text( OSApp.Language._( "Close" ) );
						}
					} else {
						OSApp.ESP32Mode.stopOTADurationTimer( popup );
						popup.find( "#ota-step-5" ).css( "color", "#4CAF50" ).html(
							"&#9745; " + OSApp.Language._( "Update complete. Device is back online." )
						);
						popup.find( ".ota-cancel" ).text( OSApp.Language._( "Close" ) );
					}
				} ).fail( function() {
					reconnectPending = false;
					if ( reconnectSeconds >= 180 ) {
						clearInterval( reconnectPoll );
						OSApp.ESP32Mode.stopOTADurationTimer( popup );
						popup.find( "#ota-step-5" ).css( "color", "#FF9800" ).html(
							"&#9658; <b>" + OSApp.Language._( "Device rebooting — reconnect when ready" ) + "</b>"
						);
						if ( OSApp.ESP32Mode.hasAppBackup() ) {
							popup.find( ".ota-inline-restore" ).show();
						}
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
					startFinalReconnectWait();
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
				if ( sawRebootPhase2 ) {
					if ( phase2Started && lastProgress >= 98 ) {
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
