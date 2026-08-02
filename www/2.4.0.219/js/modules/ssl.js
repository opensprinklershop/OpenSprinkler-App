/* global $ */
var OSApp = OSApp || {};
OSApp.SSL = OSApp.SSL || {};

/**
 * Fetch the device certificate (DER format) from http://<host>/ca.der.
 * The firmware serves this endpoint over plain HTTP without authentication.
 * Calls callback with a base64-encoded DER string on success, or null on failure.
 *
 * @param {string}   host     - Device IP or hostname (no protocol prefix).
 * @param {Function} callback - Called with base64 string or null.
 */
OSApp.SSL.fetchDeviceCert = function( host, callback ) {
	var h = host.replace( /^https?:\/\//i, "" ).replace( /\/$/, "" );
	$.ajax( {
		url: "http://" + h + "/ca.der",
		type: "GET",
		xhrFields: { responseType: "arraybuffer" },
		timeout: 8000,
		success: function( data ) {
			try {
				var bytes = new Uint8Array( data ),
					binary = Array.from( bytes ).map( function( b ) {
						return String.fromCharCode( b );
					} ).join( "" );
				callback( btoa( binary ) );
			} catch ( err ) {
				window.console.error( err );
				callback( null );
			}
		},
		error: function() {
			callback( null );
		}
	} );
};

/**
 * Compute the SHA-256 fingerprint of a base64-encoded DER certificate.
 * Calls callback with a colon-separated uppercase hex string, or null on failure.
 *
 * @param {string}   derB64   - Base64-encoded DER certificate bytes.
 * @param {Function} callback - Called with hex fingerprint string or null.
 */
OSApp.SSL.getCertFingerprint = function( derB64, callback ) {
	try {
		var binary = atob( derB64 ),
			len = binary.length,
			bytes = new Uint8Array( len ),
			i;
		for ( i = 0; i < len; i++ ) {
			bytes[ i ] = binary.charCodeAt( i );
		}
		window.crypto.subtle.digest( "SHA-256", bytes.buffer ).then( function( hashBuffer ) {
			var hex = Array.from( new Uint8Array( hashBuffer ) )
				.map( function( b ) { return b.toString( 16 ).padStart( 2, "0" ).toUpperCase(); } )
				.join( ":" );
			callback( hex );
		} ).catch( function() {
			callback( null );
		} );
	} catch ( err ) {
		window.console.error( err );
		callback( null );
	}
};

/**
 * Show the platform-appropriate certificate trust dialog for an HTTPS device.
 *
 * The certificate is fetched live from http://<host>/ca.der so the user sees
 * the actual fingerprint of the device they are connecting to.
 *
 * - Cordova (Android/iOS): Sets native HTTP trust mode to 'nocheck' so that
 *   subsequent cordova-plugin-advanced-http requests accept the self-signed cert.
 *   Calls onComplete(true) on success.
 * - Web browser: Guides the user to open the device HTTPS URL directly so the
 *   browser can show its 'Accept risk' flow, and offers the live cert for download.
 *
 * @param {string}   host        - Device IP or hostname without protocol prefix.
 * @param {Function} [onComplete] - Called with true when trusted, false on cancel.
 */
OSApp.SSL.showCertDialog = function( host, onComplete ) {
	var isCordova = !!window.cordova;

	var popup = $(
		"<div data-role='popup' id='ssl-cert-popup' class='ui-content' style='max-width:320px'>" +
			"<h3>" + OSApp.Language._( "Self-Signed Certificate" ) + "</h3>" +
			"<p id='ssl-cert-info'>" + OSApp.Language._( "Fetching certificate from device\u2026" ) + "</p>" +
			"<div id='ssl-cert-buttons'></div>" +
		"</div>"
	);

	$( "body" ).append( popup );
	popup.enhanceWithin();
	popup.one( "popupafterclose", function() {
		popup.popup( "destroy" ).remove();
	} );
	popup.popup( { history: false, positionTo: "window" } ).popup( "open" );

	// Fetch the certificate live from the device and then populate the dialog
	OSApp.SSL.fetchDeviceCert( host, function( derB64 ) {
		var instructions, buttons, infoEl = popup.find( "#ssl-cert-info" );

		if ( isCordova ) {
			if ( derB64 ) {
				instructions =
					"<p>" + OSApp.Language._( "This device uses a self-signed security certificate." ) + "</p>" +
					"<p id='ssl-cert-fp' class='smaller' style='word-break:break-all'>" +
						OSApp.Language._( "Computing fingerprint\u2026" ) +
					"</p>" +
					"<p class='smaller' style='color:#c80'>" +
						OSApp.Language._( "Only proceed if this is your own device on a trusted local network." ) +
					"</p>";
			} else {
				instructions =
					"<p>" + OSApp.Language._( "Could not fetch certificate from device. You can still proceed with HTTPS on a trusted local network." ) + "</p>" +
					"<p class='smaller' style='color:#c80'>" +
						OSApp.Language._( "Only proceed if this is your own device on a trusted local network." ) +
					"</p>";
			}
			buttons =
				"<a data-role='button' data-theme='b' id='ssl-trust-btn' href='#'>" + OSApp.Language._( "Trust Certificate" ) + "</a>" +
				"<a data-role='button' data-theme='a' id='ssl-cancel-btn' href='#'>" + OSApp.Language._( "Cancel" ) + "</a>";
		} else {
			instructions =
				"<p>" + OSApp.Language._( "Your browser blocks HTTPS connections to devices with self-signed certificates." ) + "</p>" +
				"<ol class='left smaller' style='padding-left:1.5em'>" +
					"<li>" + OSApp.Language._( "Click 'Open Device URL' and accept the security warning in your browser." ) + "</li>" +
					"<li>" + OSApp.Language._( "Return here and try connecting again." ) + "</li>" +
				"</ol>";
			buttons =
				"<a data-role='button' data-theme='b' id='ssl-open-btn' href='#'>" + OSApp.Language._( "Open Device URL" ) + "</a>" +
				( derB64 ? "<a data-role='button' id='ssl-download-btn' href='#'>" + OSApp.Language._( "Download Certificate" ) + "</a>" : "" ) +
				"<a data-role='button' data-theme='a' id='ssl-cancel-btn' href='#'>" + OSApp.Language._( "Cancel" ) + "</a>";
		}

		infoEl.html( instructions );
		popup.find( "#ssl-cert-buttons" ).html( buttons ).trigger( "create" );

		// Show SHA-256 fingerprint asynchronously once computed
		if ( derB64 ) {
			OSApp.SSL.getCertFingerprint( derB64, function( fp ) {
				var fpEl = popup.find( "#ssl-cert-fp" );
				if ( fpEl.length && fp ) {
					fpEl.text( "SHA-256: " + fp );
				}
			} );
		}

		if ( isCordova ) {
			popup.find( "#ssl-trust-btn" ).on( "click", function() {
				popup.popup( "close" );
				OSApp.Firmware.nativeHttpReady = false;
				OSApp.Firmware.ensurePinnedNativeHttp( function( ready ) {
					if ( ready ) {
						OSApp.Errors.showError( OSApp.Language._( "Certificate trusted. HTTPS connection enabled." ) );
					} else {
						OSApp.Errors.showError( OSApp.Language._( "Failed to apply certificate trust. Please try again." ) );
					}
					if ( typeof onComplete === "function" ) {
						onComplete( ready );
					}
				} );
			} );
		} else {
			// Set href via jQuery — prevents XSS from host value embedded in HTML
			popup.find( "#ssl-open-btn" )
				.attr( "href", "https://" + host )
				.attr( "target", "_blank" )
				.attr( "rel", "noopener" );
			if ( derB64 ) {
				popup.find( "#ssl-download-btn" ).on( "click", function( e ) {
					e.preventDefault();
					OSApp.SSL.downloadDeviceCert( derB64 );
				} );
			}
		}

		popup.find( "#ssl-cancel-btn" ).on( "click", function() {
			popup.popup( "close" );
			if ( typeof onComplete === "function" ) {
				onComplete( false );
			}
		} );
	} );
};

/**
 * Trigger a browser download of a DER certificate (base64-encoded) as an
 * installable .cer file. The user can then install it in their OS or browser
 * trust store to enable HTTPS access without warnings.
 *
 * @param {string} derB64 - Base64-encoded DER certificate bytes.
 */
OSApp.SSL.downloadDeviceCert = function( derB64 ) {
	var binary = atob( derB64 ),
		len = binary.length,
		bytes = new Uint8Array( len ),
		blob, url, link, i;

	for ( i = 0; i < len; i++ ) {
		bytes[ i ] = binary.charCodeAt( i );
	}

	blob = new Blob( [ bytes ], { type: "application/x-x509-ca-cert" } );
	url = URL.createObjectURL( blob );
	link = document.createElement( "a" );
	link.href = url;
	link.download = "OpenSprinkler.cer";
	document.body.appendChild( link );
	link.click();
	document.body.removeChild( link );
	setTimeout( function() { URL.revokeObjectURL( url ); }, 1000 );
};
