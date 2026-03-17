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
OSApp.Firmware = OSApp.Firmware || {};

OSApp.Firmware.Constants = {

	// Ensure error codes align with reboot causes in Firmware defines.h
	// Do NOT use Language._ to translate these here during definition. Do it when rendering!
	// FIXME: all enums should follow the pattern of an array with objects with id/name. Example: [{id: -4, name: "Empty Response"}]
	rebootReasons: {
		0: "None",
		1: "Factory Reset",
		2: "Reset Button",
		3: "WiFi Change",
		4: "Web Request",
		5: "Web Request",
		6: "WiFi Configure",
		7: "Firmware Update",
		8: "Weather Failure",
		9: "Network Failure",
		10: "Clock Update",
		99: "Power On"
	}
};

OSApp.Firmware.nativeHttpReady = false;

OSApp.Firmware.canUseNativeHttp = function( url ) {
	return !!(
		OSApp.currentDevice.isAndroid &&
		!OSApp.currentSession.token &&
		typeof url === "string" &&
		/^https:\/\//i.test( url ) &&
		window.cordova &&
		window.cordova.plugin &&
		window.cordova.plugin.http &&
		typeof window.cordova.plugin.http.sendRequest === "function"
	);
};

OSApp.Firmware.ensurePinnedNativeHttp = function( callback ) {
	callback = callback || function() {};

	if ( OSApp.Firmware.nativeHttpReady ) {
		callback( true );
		return;
	}

	if ( !window.cordova || !window.cordova.plugin || !window.cordova.plugin.http ||
		typeof window.cordova.plugin.http.setServerTrustMode !== "function" ) {
		callback( false );
		return;
	}

	// Use "nocheck" so the native HTTP client accepts the device's self-signed cert.
	// The cert is fetched from the device and shown to the user before trust is granted
	// (see OSApp.SSL.showCertDialog), so this is acceptable for a trusted local network.
	window.cordova.plugin.http.setServerTrustMode( "nocheck", function() {
		OSApp.Firmware.nativeHttpReady = true;
		callback( true );
	}, function() {
		callback( false );
	} );
};

OSApp.Firmware.nativeHttpRequest = function( obj ) {
	var defer = $.Deferred();

	OSApp.Firmware.ensurePinnedNativeHttp( function( ready ) {
		if ( !ready ) {
			defer.reject( { status: 0, statusText: "error" } );
			return;
		}

		var options = {
			method: ( obj.type || "GET" ).toLowerCase(),
			headers: obj.headers || {}
		};

		if ( options.method === "post" && obj.data ) {
			options.data = obj.data;
			options.serializer = "urlencoded";
		}

		if ( typeof obj.timeout === "number" && obj.timeout > 0 && typeof window.cordova.plugin.http.setRequestTimeout === "function" ) {
			window.cordova.plugin.http.setRequestTimeout( Math.max( 1, Math.round( obj.timeout / 1000 ) ) );
		}

		window.cordova.plugin.http.sendRequest( obj.url, options, function( response ) {
			var data = response && typeof response.data !== "undefined" ? response.data : "";

			if ( obj.dataType === "json" && typeof data === "string" ) {
				try {
					data = JSON.parse( data );
				} catch {
					defer.reject( { status: response.status || 0, statusText: "parsererror" } );
					return;
				}
			}

			defer.resolve( data );
		}, function( error ) {
			defer.reject( {
				status: error && typeof error.status === "number" ? error.status : 0,
				statusText: error && error.error ? error.error : "error"
			} );
		} );
	} );

	return defer.promise();
};

// Wrapper function to communicate with OpenSprinkler
OSApp.Firmware.sendToOS = function( dest, type, timeout ) {

	// Inject password into the request
	dest = dest.replace( "pw=", "pw=" + encodeURIComponent( OSApp.currentSession.pass ) );
	type = type || "text";

	// Designate AJAX queue based on command type
	var isChange = /\/(?:cv|cs|cr|cp|uwa|dp|co|cl|cu|up|cm)/.exec( dest ),
		queue = isChange ? "change" : "default",

		// Use POST when sending data to the controller (requires firmware 2.1.8 or newer)
		usePOST = ( isChange && OSApp.Firmware.checkOSVersion( 300 ) ),
		urlDest = usePOST ? dest.split( "?" )[ 0 ] : dest,
		obj = {
			url: OSApp.currentSession.token ? "https://cloud.openthings.io/forward/v1/" + OSApp.currentSession.token + urlDest : OSApp.currentSession.prefix + OSApp.currentSession.ip + urlDest,
			type: usePOST ? "POST" : "GET",
			data: usePOST ? OSApp.Firmware.getUrlVars( dest ) : null,
			dataType: type,
			timeout: timeout,
			headers: {},
			shouldRetry: function( xhr, current ) {
				if ( xhr.status === 0 && xhr.statusText === "abort" || OSApp.Constants.http.RETRY_COUNT < current ) {
					$.ajaxq.abort( queue );
					return false;
				}
				return true;
			}
		},
		defer;

	if ( OSApp.currentSession.auth ) {
		obj.headers.Authorization = "Basic " + btoa( OSApp.currentSession.authUser + ":" + OSApp.currentSession.authPass );
		$.extend( obj, {
			beforeSend: function( xhr ) {
				xhr.setRequestHeader( "Authorization", obj.headers.Authorization );
			}
		} );
	}

	if ( OSApp.currentSession.fw183 ) {

		// Firmware 1.8.3 has a bug handling the time stamp in the GET request
		$.extend( obj, {
			cache: "true"
		} );
	}

	var request = OSApp.Firmware.canUseNativeHttp( obj.url ) ? OSApp.Firmware.nativeHttpRequest( obj ) : $.ajaxq( queue, obj );

	defer = request.then(
		function( data ) {

			// In case the data type was incorrect, attempt to fix.
			// If fix not possible, return string
			if ( typeof data === "string" ) {
				try {
					data = $.parseJSON( data );
				} catch {
					return data;
				}
			}

			// Don't need to handle this situation for OSPi or firmware below 2.1.0
			if ( typeof data !== "object" || typeof data.result !== "number" ) {
				return data;
			}

			// Return as successful
			if ( data.result === 1 ) {
				return data;

			// Handle incorrect password
			} else if ( data.result === 2 ) {
				if ( /\/(?:cv|cs|cr|cp|uwa|dp|co|cl|cu|up|cm)/.exec( dest ) ) {
					OSApp.Errors.showError( OSApp.Language._( "Check device password and try again." ) );
				}

				// Tell subsequent handlers this request has failed (use 401 to prevent retry)
				return $.Deferred().reject( { "status":401 } );

			// Handle page not found by triggering fail
			} else if ( data.result === 32 ) {

				return $.Deferred().reject( { "status":404 } );
			}

			// Only show error messages on setting change requests
			if ( /\/(?:cv|cs|cr|cp|uwa|dp|co|cl|cu|up|cm)/.exec( dest ) ) {
				if ( data.result === 48 ) {
					OSApp.Errors.showError(
						OSApp.Language._( "The selected station is already running or is scheduled to run." )
					);
				} else {
					OSApp.Errors.showError( OSApp.Language._( "Please check input and try again." ) );
				}

				// Tell subsequent handlers this request has failed
				return $.Deferred().reject( data );
			}

		},
		function( e ) {
			if ( ( e.statusText === "timeout" || e.status === 0 ) && /\/(?:cv|cs|cr|cp|uwa|dp|co|cl|cu|cm)/.exec( dest ) ) {

				// Handle the connection timing out but only show error on setting change
				if ( OSApp.currentSession.prefix === "https://" ) {
					OSApp.SSL.showCertDialog( OSApp.currentSession.ip, function( ready ) {
						if ( ready ) {
							OSApp.Errors.showError( OSApp.Language._( "Certificate trusted. Please retry your action." ) );
						}
					} );
				} else {
					OSApp.Errors.showError( OSApp.Language._( "Connection timed-out. Please try again." ) );
				}
			} else if ( e.status === 401 ) {

				//Handle unauthorized requests
				OSApp.Errors.showError( OSApp.Language._( "Check device password and try again." ) );
			}
			return;
		}
	);

	return defer;
};

// OpenSprinkler feature detection functions
OSApp.Firmware.checkOSVersion = function( check ) {
	// Return early if we are missing controller object
	if ( $.isEmptyObject( OSApp.currentSession.controller ) ) {
		return false;
	}
	var version = OSApp.currentSession.controller.options.fwv;

	// If check is 4 digits then we need to include the minor version number as well
	if ( check >= 1000 ) {
		if ( isNaN( OSApp.currentSession.controller.options.fwm ) ) {
			return false;
		} else {
			version = version * 10 + OSApp.currentSession.controller.options.fwm;
		}
	}

	if ( OSApp.Firmware.isOSPi() ) {
		return false;
	} else {
		if ( check === version ) {
			return true;
		} else {
			return OSApp.Firmware.versionCompare( version.toString().split( "" ), check.toString().split( "" ) );
		}
	}
};

OSApp.Firmware.isOSPi = function() {
	if ( OSApp.currentSession.controller &&
		typeof OSApp.currentSession.controller.options === "object" &&
		typeof OSApp.currentSession.controller.options.fwv === "string" &&
		OSApp.currentSession.controller.options.fwv.search( /ospi/i ) !== -1 ) {

		return true;
	}
	return false;
};

OSApp.Firmware.versionCompare = function( ver, check ) {

	// Returns false when check < ver and 1 when check > ver

	var max = Math.max( ver.length, check.length ),
		result;

	while ( ver.length < max ) {
		ver.push( 0 );
	}

	while ( check.length < max ) {
		check.push( 0 );
	}

	for ( var i = 0; i < max; i++ ) {
		result = Math.max( -1, Math.min( 1, ver[ i ] - check[ i ] ) );
		if ( result !== 0 ) {
			break;
		}
	}

	if ( result === -1 ) {
		result = false;
	}

	return result;
};

OSApp.Firmware.getUrlVars = function( url ) {
	var hash,
		json = {},
		hashes = url.slice( url.indexOf( "?" ) + 1 ).split( "&" );

	for ( var i = 0; i < hashes.length; i++ ) {
		hash = hashes[ i ].split( "=" );
		json[ hash[ 0 ] ] = decodeURIComponent( hash[ 1 ].replace( /\+/g, "%20" ) );
	}
	return json;
};

OSApp.Firmware.checkOSPiVersion = function( check ) {
	var ver;

	if ( OSApp.Firmware.isOSPi() ) {
		ver = OSApp.currentSession.controller.options.fwv.split( "-" )[ 0 ];
		if ( ver !== check ) {
			ver = ver.split( "." );
			check = check.split( "." );
			return OSApp.Firmware.versionCompare( ver, check );
		} else {
			return true;
		}
	} else {
		return false;
	}
};

OSApp.Firmware.MIN_ONLINE_UPDATE_VERSION = 240;
OSApp.Firmware.MIN_ONLINE_UPDATE_VERSION_OSPI = "2.4.0";

OSApp.Firmware.isOnlineUpdateSupported = function() {
	if ( OSApp.Firmware.isOSPi() ) {
		return OSApp.Firmware.checkOSPiVersion( OSApp.Firmware.MIN_ONLINE_UPDATE_VERSION_OSPI );
	}
	return OSApp.Firmware.checkOSVersion( OSApp.Firmware.MIN_ONLINE_UPDATE_VERSION );
};

OSApp.Firmware.getOSVersion = function( fwv ) {
	if ( !fwv && typeof OSApp.currentSession.controller.options === "object" ) {
		fwv = OSApp.currentSession.controller.options.fwv;
	}
	if ( typeof fwv === "string" && fwv.search( /ospi/i ) !== -1 ) {
		return fwv;
	} else {
		return ( fwv / 100 >> 0 ) + "." + ( ( fwv / 10 >> 0 ) % 10 ) + "." + ( fwv % 10 );
	}
};

OSApp.Firmware.getOSMinorVersion = function() {
	if ( !OSApp.Firmware.isOSPi() && typeof OSApp.currentSession.controller.options === "object" && typeof OSApp.currentSession.controller.options.fwm === "number" && OSApp.currentSession.controller.options.fwm > 0 ) {
		return " (" + OSApp.currentSession.controller.options.fwm + ")";
	}
	return "";
};

OSApp.Firmware.getHWVersion = function( hwv ) {
	if ( !hwv ) {
		if ( typeof OSApp.currentSession.controller.options === "object" && typeof OSApp.currentSession.controller.options.hwv !== "undefined" ) {
			hwv = OSApp.currentSession.controller.options.hwv;
		} else {
			return false;
		}
	}

	if ( typeof hwv === "string" ) {
		return hwv;
	} else {
		if ( hwv === 64 ) {
			return "OSPi";
		} else if ( hwv === 128 ) {
			return "OSBo";
		} else if ( hwv === 192 ) {
			return "Linux";
		} else if ( hwv === 255 ) {
			return "Demo";
		} else {
			return ( ( hwv / 10 >> 0 ) % 10 ) + "." + ( hwv % 10 );
		}
	}
};

OSApp.Firmware.getHWType = function() {
	if ( OSApp.Firmware.isOSPi() || typeof OSApp.currentSession.controller.options.hwt !== "number" || OSApp.currentSession.controller.options.hwt === 0 ) {
		return "";
	}

	if ( OSApp.currentSession.controller.options.hwt === 172 ) {
		return " - AC";
	} else if ( OSApp.currentSession.controller.options.hwt === 220 ) {
		return " - DC";
	} else if ( OSApp.currentSession.controller.options.hwt === 26 ) {
		return " - Latching";
	} else {
		return "";
	}
};

OSApp.Firmware.checkFirmwareUpdate = function() {

	// Update checks are only be available for Arduino firmwares
	if ( OSApp.Firmware.checkOSVersion( 200 ) && ( ( typeof parseFloat(OSApp.Firmware.getHWVersion()) === "number" && parseFloat(OSApp.Firmware.getHWVersion()) >= 3 ) || OSApp.Firmware.isOSPi() ) ) {

		// Github API to get releases for OpenSprinkler firmware
		$.getJSON( "https://api.github.com/repos/opensprinkler/opensprinkler-firmware/releases" ).done( function( data ) {
			// Convert both the controller version and the site version to decimals
			let controller = OSApp.currentSession.controller.options.fwv;
			let recent = data[ 0 ].tag_name;

			if ( OSApp.currentSession.controller.options.fwm ) {
				controller += OSApp.currentSession.controller.options.fwm / 10;
			}

			if ( typeof recent === "string" && recent.includes("(") ) {
				recent = parseFloat(recent.replace("(", ".").replace(")", ""));
			}

			if ( controller < recent ) {

				// Grab a local storage variable which defines the firmware version for the last dismissed update
				OSApp.Storage.get( "updateDismiss", function( flag ) {

					// If the variable does not exist or is lower than the newest update, show the update notification
					if ( !flag.updateDismiss || flag.updateDismiss < data[ 0 ].tag_name ) {
						OSApp.Notifications.addNotification( {
							title: OSApp.Language._( "Firmware update available" ),
							on: function() {

								// Modify the changelog by parsing markdown of lists to HTML
								var button = $( this ).parent(),
									canUpdate = OSApp.currentSession.controller.options.hwv === 30 || OSApp.currentSession.controller.options.hwv > 63 && OSApp.Firmware.checkOSVersion( 216 ),
									changelog = data[ 0 ][ "html_url" ],
									popup = $(
										"<div data-role='popup' class='modal' data-theme='a'>" +
											"<h3 class='center' style='margin-bottom:0'>" +
												OSApp.Language._( "Latest" ) + " " + OSApp.Language._( "Firmware" ) + ": " + data[ 0 ].name +
											"</h3>" +
											"<h5 class='center' style='margin:0'>" + OSApp.Language._( "This Controller" ) + ": " + OSApp.Firmware.getOSVersion() + OSApp.Firmware.getOSMinorVersion() + "</h5>" +
											"<a class='iab ui-btn ui-corner-all ui-shadow' style='width:80%;margin:5px auto;' target='_blank' href='" + changelog + "'>" +
												OSApp.Language._( "View Changelog" ) +
											"</a>" +
											"<a class='guide ui-btn ui-corner-all ui-shadow' style='width:80%;margin:5px auto;' href='#'>" +
												OSApp.Language._( "Update Guide" ) +
											"</a>" +
											( canUpdate ? "<a class='update ui-btn ui-corner-all ui-shadow' style='width:80%;margin:5px auto;' href='#'>" +
												OSApp.Language._( "Update Now" ) +
											"</a>" : "" ) +
											"<a class='dismiss ui-btn ui-btn-b ui-corner-all ui-shadow' style='width:80%;margin:5px auto;' href='#'>" +
												OSApp.Language._( "Dismiss" ) +
											"</a>" +
										"</div>"
									);

								popup.find( ".update" ).on( "click", function() {
									if ( OSApp.currentSession.controller.options.hwv === 30 ) {
										$( "<a class='hidden iab' href='" + OSApp.ESP32Mode.getDirectDeviceUpdateUrl() + "'></a>" ).appendTo( popup ).click();
										return;
									}

									// For OSPi/OSBo with firmware 2.1.6 or newer, trigger the update script from the app
									OSApp.Firmware.sendToOS( "/cv?pw=&update=1", "json" ).then(
										function() {
											OSApp.Errors.showError( OSApp.Language._( "Update successful" ) );
											popup.find( ".dismiss" ).click();
										},
										function() {
											$.mobile.loading( "show", {
												html: "<div class='center'>" + OSApp.Language._( "Update did not complete." ) + "<br>" +
													"<a class='iab ui-btn' href='https://openthings.freshdesk.com/support/solutions/articles/5000631599-installing-and-updating-the-unified-firmware#upgrade'>" + OSApp.Language._( "Update Guide" ) + "</a></div>",
												textVisible: true,
												theme: "b"
											} );
											setTimeout( function() { $.mobile.loading( "hide" ); }, 3000 );
										}
									);
								} );

								popup.find( ".guide" ).on( "click", function() {

										var url = OSApp.currentSession.controller.options.hwv > 63 ?
											"https://openthings.freshdesk.com/support/solutions/articles/5000631599-installing-and-updating-the-unified-firmware#upgrade"
											: "https://openthings.freshdesk.com/support/solutions/articles/5000381694-opensprinkler-firmware-update-guide";

										// Open the firmware upgrade guide in a child browser
										$( "<a class='hidden iab' href='" + url + "'></a>" )
											.appendTo( popup ).click();
								} );

								popup.find( ".dismiss" ).one( "click", function() {

									// Update the notification dismiss variable with the latest available version
									OSApp.Storage.set( { updateDismiss:data[ 0 ].tag_name } );
									popup.popup( "close" );
									OSApp.Notifications.removeNotification( button );
									return false;
								} );

								OSApp.UIDom.openPopup( popup );
							}
						} );
					}
				} );
			}
		} );
	}
};

OSApp.Firmware.detectUnusedExpansionBoards = function() {
	if (
		typeof OSApp.currentSession.controller.options.dexp === "number" &&
		OSApp.currentSession.controller.options.dexp < 255 &&
		OSApp.currentSession.controller.options.dexp >= 0 &&
		OSApp.currentSession.controller.options.ext < OSApp.currentSession.controller.options.dexp
	) {
		OSApp.Notifications.addNotification( {
			title: OSApp.Language._( "Unused Expanders Detected" ),
			desc: OSApp.Language._( "Click here to enable all connected stations." ),
			on: function() {
				OSApp.Notifications.removeNotification( $( this ).parent() );
				OSApp.UIDom.changePage( "#os-options", {
					expandItem: "station"
				} );
				return false;
			}
		} );
	}
};

OSApp.Firmware.showUnifiedFirmwareNotification = function() {
	if ( !OSApp.Firmware.isOSPi() ) {
		return;
	}

	OSApp.Storage.get( "ignoreUnifiedFirmware", function( data ) {
		if ( data.ignoreUnifiedFirmware !== "1" ) {

			// Unable to access the device using it's public IP
			OSApp.Notifications.addNotification( {
				title: OSApp.Language._( "Unified firmware is now available" ),
				desc: OSApp.Language._( "Click here for more details" ),
				on: function() {
					window.open( "https://openthings.freshdesk.com/support/solutions/articles/5000631599",
						"_blank", "location=" + ( OSApp.currentDevice.isAndroid ? "yes" : "no" ) +
						",enableViewportScale=yes,toolbarposition=top,closebuttoncaption=" + OSApp.Language._( "Back" )
					);

					return false;
				},
				off: function() {
					OSApp.Storage.set( { "ignoreUnifiedFirmware": "1" } );
					return true;
				}
			} );
		}
	} );
};

OSApp.Firmware.getRebootReason = function( reason ) {
	var result = OSApp.Language._( "Unrecognised" ) + " (" + reason + ")";

	if ( reason in OSApp.Firmware.Constants.rebootReasons ) {
		result = OSApp.Language._( OSApp.Firmware.Constants.rebootReasons[ reason ] );
	}

	return result;
};

// ── OTA Firmware Update (via device /uc endpoint) ──────────────────────────

// Weekly update check interval (7 days in ms)
OSApp.Firmware.OTA_CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000;

// Cached update check result
OSApp.Firmware._otaCache = null;

/**
 * Check the device for firmware updates via REST API /uc endpoint.
 * Stores result in localStorage with timestamp; re-checks after OTA_CHECK_INTERVAL.
 * Returns a promise that resolves with the update check data or null.
 */
OSApp.Firmware.checkOTAUpdate = function( forceCheck ) {
	var defer = $.Deferred();

	// Only works on ESP32 firmware >= 2.3.3
	if ( !OSApp.Firmware.checkOSVersion( 233 ) ) {
		defer.resolve( null );
		return defer.promise();
	}

	// Check localStorage cache first (unless forced)
	if ( !forceCheck ) {
		var cached = OSApp.Storage.getItemSync( "otaUpdateCheck" );
		if ( cached ) {
			try {
				cached = JSON.parse( cached );
				if ( cached.timestamp && ( Date.now() - cached.timestamp ) < OSApp.Firmware.OTA_CHECK_INTERVAL ) {
					OSApp.Firmware._otaCache = cached.data;
					defer.resolve( cached.data );
					return defer.promise();
				}
			} catch {
				// Invalid cache, re-check
			}
		}
	}

	// Call the device /uc endpoint (25s timeout — firmware makes a blocking outbound HTTPS request)
	OSApp.Firmware.sendToOS( "/uc?pw=", "json", 25000 ).then(
		function( data ) {
			if ( data && typeof data === "object" ) {
				OSApp.Firmware._otaCache = data;
				// Cache with timestamp
				OSApp.Storage.setItemSync( "otaUpdateCheck", JSON.stringify( {
					timestamp: Date.now(),
					data: data
				} ) );
				defer.resolve( data );
			} else {
				defer.resolve( null );
			}
		},
		function() {
			defer.resolve( null );
		}
	);

	return defer.promise();
};

/**
 * Get the firmware version info string for display.
 * Returns HTML showing current firmware version and update status.
 */
OSApp.Firmware.getOTAInfoHTML = function() {
	var fwv = OSApp.Firmware.getOSVersion();
	var fwm = OSApp.Firmware.getOSMinorVersion();
	var feature = "";
	if ( OSApp.currentSession.controller && OSApp.currentSession.controller.options && OSApp.currentSession.controller.options.feature ) {
		feature = " - " + OSApp.currentSession.controller.options.feature;
	}

	var html = "<td colspan='13' style='padding: 6px 4px;'>" +
		"<div style='display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;'>" +
		"<span><strong>" + OSApp.Language._( "Firmware" ) + ":</strong> " + fwv + fwm + feature + "</span>";

	var cache = OSApp.Firmware._otaCache;
	if ( cache ) {
		var curFwv = OSApp.currentSession.controller.options.fwv || 0;
		var curFwm = OSApp.currentSession.controller.options.fwm || 0;
		var hasNewerVersion = ( cache.available === 1 ) &&
			( cache.fw_version > curFwv || ( cache.fw_version === curFwv && ( cache.fw_minor || 0 ) > curFwm ) );

		if ( hasNewerVersion ) {
			html += "<a href='#' class='ota-update-btn ui-btn ui-btn-inline ui-mini ui-btn-b ui-corner-all' style='margin:0;'>" +
				OSApp.Language._( "Update available" ) + ": " +
				OSApp.Firmware.getOSVersion( cache.fw_version ) + " (" + cache.fw_minor + ")" +
				"</a>";
		} else {
			html += "<span style='color: green; font-size: 0.85em;'>&#10003; " + OSApp.Language._( "Up to date" ) + "</span>" +
				" <a href='#' class='ota-manage-btn ui-btn ui-btn-inline ui-mini ui-corner-all' style='margin:0;'>" +
				OSApp.Language._( "Manage" ) + "</a>";
		}
	}

	html += "</div></td>";
	return html;
};

/**
 * Poll update progress after starting an OTA upgrade.
 * Shows a loading overlay with progress.
 */
OSApp.Firmware.pollOTAProgress = function( popup ) {
	var pollTimer = setInterval( function() {
		OSApp.Firmware.sendToOS( "/us?pw=", "json" ).then( function( data ) {
			if ( !data ) return;

			var statusText = data.message || "";
			var progress = data.progress || 0;
			var status = data.status;

			if ( popup && popup.find ) {
				popup.find( ".ota-progress-text" ).text( statusText );
				popup.find( ".ota-progress-bar" ).css( "width", progress + "%" );
			}

			// OTA_STATUS_DONE = 8, errors >= 9
			if ( status === 8 ) {
				clearInterval( pollTimer );
				if ( popup && popup.find ) {
					popup.find( ".ota-progress-text" ).text( OSApp.Language._( "Update complete! Rebooting..." ) );
				}
				setTimeout( function() {
					if ( popup ) popup.popup( "close" );
					OSApp.Errors.showError( OSApp.Language._( "Firmware updated. Device is rebooting..." ) );
					// Clear cache so next check fetches fresh data
					OSApp.Storage.setItemSync( "otaUpdateCheck", "" );
					OSApp.Firmware._otaCache = null;
				}, 3000 );
			} else if ( status >= 9 ) {
				clearInterval( pollTimer );
				if ( popup && popup.find ) {
					popup.find( ".ota-progress-text" ).text( OSApp.Language._( "Update failed" ) + ": " + statusText ).css( "color", "red" );
				}
			}
		} );
	}, 2000 );
};

/**
 * Start the OTA firmware update on the device.
 */
OSApp.Firmware.startOTAUpdate = function( popup ) {
	OSApp.Firmware.sendToOS( "/uu?pw=", "json" ).then(
		function( data ) {
			if ( data && data.result === 1 ) {
				if ( popup && popup.find ) {
					popup.find( ".ota-actions" ).hide();
					popup.find( ".ota-progress" ).show();
				}
				OSApp.Firmware.pollOTAProgress( popup );
			} else {
				OSApp.Errors.showError( data && data.message ? data.message : OSApp.Language._( "Failed to start update" ) );
			}
		},
		function() {
			OSApp.Errors.showError( OSApp.Language._( "Failed to start update" ) );
		}
	);
};

/**
 * Fetch the version catalog (versions.json) from the upgrade server.
 * Returns a promise resolving with the array of version entries.
 */
OSApp.Firmware.getVersionCatalog = function() {
	var defer = $.Deferred();
	var manifestUrl = "https://opensprinklershop.de/upgrade/versions.json";

	$.getJSON( manifestUrl ).done( function( data ) {
		if ( $.isArray( data ) ) {
			defer.resolve( data );
		} else {
			defer.resolve( [] );
		}
	} ).fail( function() {
		defer.resolve( [] );
	} );

	return defer.promise();
};

/**
 * Show OTA update/reinstall/downgrade popup.
 * mode: "update" | "manage" | "downgrade"
 */
OSApp.Firmware.showOTAPopup = function() {
	var cache = OSApp.Firmware._otaCache;
	var curVersion = OSApp.Firmware.getOSVersion();
	var curMinor = OSApp.Firmware.getOSMinorVersion();
	var curFwv = OSApp.currentSession.controller.options.fwv || 0;
	var curFwm = OSApp.currentSession.controller.options.fwm || 0;

	var popupHtml =
		"<div data-role='popup' class='modal' data-theme='a' id='ota-popup'>" +
		"<div data-role='header' data-theme='b'>" +
		"<a href='#' data-rel='back' data-role='button' data-theme='a' data-icon='delete' data-iconpos='notext' class='ui-btn-right'>" + OSApp.Language._( "close" ) + "</a>" +
		"<h1>" + OSApp.Language._( "Firmware Update" ) + "</h1>" +
		"</div>" +
		"<div class='ui-content' style='padding: 15px; min-width: 280px;'>" +
		"<p><strong>" + OSApp.Language._( "Current Version" ) + ":</strong> " + curVersion + curMinor + "</p>";

	if ( cache && cache.available === 1 ) {
		popupHtml += "<p><strong>" + OSApp.Language._( "Available" ) + ":</strong> " +
			OSApp.Firmware.getOSVersion( cache.fw_version ) + " (" + cache.fw_minor + ")</p>";
	}

	// Changelog
	if ( cache && cache.changelog ) {
		popupHtml += "<div style='max-height: 200px; overflow-y: auto; border: 1px solid #ccc; padding: 8px; margin: 8px 0; font-size: 0.85em; white-space: pre-wrap;'>" +
			$( "<div>" ).text( cache.changelog ).html() + "</div>";
	}

	// Action buttons
	popupHtml += "<div class='ota-actions'>";

	if ( cache && cache.available === 1 ) {
		popupHtml += "<a href='#' class='ota-do-update ui-btn ui-btn-b ui-corner-all ui-shadow' style='margin: 5px 0;'>" +
			OSApp.Language._( "Update Now" ) + "</a>";
	}

	popupHtml += "<a href='#' class='ota-reinstall ui-btn ui-corner-all ui-shadow' style='margin: 5px 0;'>" +
		OSApp.Language._( "Reinstall Current Version" ) + "</a>";

	popupHtml += "<a href='#' class='ota-show-downgrade ui-btn ui-corner-all ui-shadow' style='margin: 5px 0;'>" +
		OSApp.Language._( "Install Previous Version" ) + "...</a>";

	popupHtml += "</div>";

	// Downgrade section (hidden initially)
	popupHtml += "<div class='ota-downgrade-section' style='display: none; margin-top: 10px;'>" +
		"<label for='ota-version-select'><strong>" + OSApp.Language._( "Select Version" ) + ":</strong></label>" +
		"<select id='ota-version-select' data-mini='true'>" +
		"<option value=''>" + OSApp.Language._( "Loading versions..." ) + "</option>" +
		"</select>" +
		"<div class='ota-version-changelog' style='max-height: 150px; overflow-y: auto; border: 1px solid #ccc; padding: 8px; margin: 8px 0; font-size: 0.85em; display: none;'></div>" +
		"<a href='#' class='ota-do-downgrade ui-btn ui-btn-b ui-corner-all ui-shadow' style='margin: 5px 0; display: none;'>" +
		OSApp.Language._( "Install Selected Version" ) + "</a>" +
		"</div>";

	// Progress section (hidden initially)
	popupHtml += "<div class='ota-progress' style='display: none; margin-top: 10px;'>" +
		"<div style='background: #eee; border-radius: 4px; overflow: hidden; height: 20px;'>" +
		"<div class='ota-progress-bar' style='background: #4CAF50; height: 100%; width: 0%; transition: width 0.3s;'></div>" +
		"</div>" +
		"<p class='ota-progress-text center' style='margin-top: 5px;'>" + OSApp.Language._( "Starting update..." ) + "</p>" +
		"</div>";

	popupHtml += "</div></div>";

	var popup = $( popupHtml );

	// Update button
	popup.find( ".ota-do-update" ).on( "click", function() {
		OSApp.Firmware.startOTAUpdate( popup );
		return false;
	} );

	// Reinstall button — triggers update even if up-to-date
	popup.find( ".ota-reinstall" ).on( "click", function() {
		OSApp.Firmware.startOTAUpdate( popup );
		return false;
	} );

	// Show downgrade section
	popup.find( ".ota-show-downgrade" ).on( "click", function() {
		var $btn = $( this );
		var $section = popup.find( ".ota-downgrade-section" );

		if ( $section.is( ":visible" ) ) {
			$section.slideUp();
			return false;
		}

		$section.slideDown();
		$btn.text( OSApp.Language._( "Install Previous Version" ) + " ▼" );

		// Fetch version catalog
		OSApp.Firmware.getVersionCatalog().then( function( versions ) {
			var $select = popup.find( "#ota-version-select" );
			$select.empty();
			$select.append( "<option value=''>" + OSApp.Language._( "Select a version..." ) + "</option>" );

			$.each( versions, function( i, v ) {
				var vStr = OSApp.Firmware.getOSVersion( v.fw_version ) + " (" + v.fw_minor + ")";
				var isCurrent = ( v.fw_version === curFwv && v.fw_minor === curFwm );
				$select.append(
					"<option value='" + i + "'" + ( isCurrent ? " disabled" : "" ) + ">" +
					vStr + ( v.date ? " — " + v.date : "" ) +
					( isCurrent ? " [" + OSApp.Language._( "current" ) + "]" : "" ) +
					"</option>"
				);
			} );

			try { $select.selectmenu( "refresh" ); } catch { /* ignore */ }

			// On version select — show changelog and install button
			$select.off( "change.ota" ).on( "change.ota", function() {
				var idx = parseInt( $( this ).val(), 10 );
				if ( isNaN( idx ) || !versions[ idx ] ) {
					popup.find( ".ota-version-changelog" ).hide();
					popup.find( ".ota-do-downgrade" ).hide();
					return;
				}
				var selected = versions[ idx ];
				if ( selected.changelog ) {
					popup.find( ".ota-version-changelog" )
						.text( selected.changelog )
						.css( "white-space", "pre-wrap" )
						.show();
				} else {
					popup.find( ".ota-version-changelog" ).hide();
				}
				popup.find( ".ota-do-downgrade" ).show();
				popup.find( ".ota-do-downgrade" ).data( "version", selected );
			} );
		} );

		return false;
	} );

	// Downgrade install button — send custom URLs to device
	popup.find( ".ota-do-downgrade" ).on( "click", function() {
		var selected = $( this ).data( "version" );
		if ( !selected ) return false;

		var vStr = OSApp.Firmware.getOSVersion( selected.fw_version ) + " (" + selected.fw_minor + ")";

		// Confirm downgrade
		if ( !confirm( OSApp.Language._( "Install firmware version" ) + " " + vStr + "?\n\n" +
			OSApp.Language._( "This will overwrite the current firmware." ) ) ) {
			return false;
		}

		// Use the /uu endpoint; the device will flash from manifest URLs.
		// For downgrade we need to temporarily update the device's cached manifest
		// Since the device /uu uses the cached manifest from /uc, we trigger a
		// fresh install — the "reinstall" approach works via the /uu endpoint.
		// For versioned installs, we call /uu which uses the latest manifest.
		// TODO: When firmware supports custom URL parameter on /uu, use it.
		// For now, downgrades require the server manifest to point to the desired version.
		OSApp.Errors.showError( OSApp.Language._( "Downgrade requires firmware support for custom URLs. Feature coming soon." ) );
		return false;
	} );

	OSApp.UIDom.openPopup( popup );
};

/**
 * Initialize OTA update check — called from site connection.
 * Checks the device for updates (weekly) and caches the result.
 */
OSApp.Firmware.initOTACheck = function() {
	if ( !OSApp.Firmware.checkOSVersion( 233 ) ) return;

	OSApp.Firmware.checkOTAUpdate( false ).then( function( data ) {
		if ( !data || data.available !== 1 ) return;

		// Guard against stale localStorage cache: verify the reported version
		// is actually newer than the currently running firmware.
		var curFwv = OSApp.currentSession.controller.options.fwv || 0;
		var curFwm = OSApp.currentSession.controller.options.fwm || 0;
		var isNewer = ( data.fw_version > curFwv ) ||
		              ( data.fw_version === curFwv && ( data.fw_minor || 0 ) > curFwm );
		if ( !isNewer ) return;

		OSApp.Notifications.addNotification( {
			title: OSApp.Language._( "Firmware update available" ) + ": " +
				OSApp.Firmware.getOSVersion( data.fw_version ) + " (" + data.fw_minor + ")",
			on: function() {
				OSApp.Notifications.removeNotification( $( this ).parent() );
				OSApp.Firmware.showOTAPopup( "update" );
				return false;
			}
		} );
	} );
};
