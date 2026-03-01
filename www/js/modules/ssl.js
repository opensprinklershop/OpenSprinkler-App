/* global $ */
var OSApp = OSApp || {};
OSApp.SSL = OSApp.SSL || {};

// Bundled OpenSprinkler self-signed certificate (DER format, base64 encoded).
// CN=opensprinkler.local, SAN=opensprinkler.local + 192.168.0.86, valid until 2036-02-22.
// This is the default certificate shipped with OpenSprinkler firmware.
OSApp.SSL.BUNDLED_CERT_B64 = "MIICVTCCAfugAwIBAgIUVERt7mwUkFEKx9fP6SY3Gg+q8lgwCgYIKoZIzj0EAwIw" +
	"ZzELMAkGA1UEBhMCREUxDDAKBgNVBAgMA05SVzEUMBIGA1UEBwwLRHVlc3NlbGRvcmYxFjAUBgNVBAoMDU9w" +
	"ZW5TcHJpbmtsZXIxHDAaBgNVBAMME29wZW5zcHJpbmtsZXIubG9jYWwwHhcNMjYwMjI0MjE1MDQ0WhcNMzYw" +
	"MjIyMjE1MDQ0WjBnMQswCQYDVQQGEwJERTEMMAoGA1UECAwDTlJXMRQwEgYDVQQHDAtEdWVzc2VsZG9yZjEW" +
	"MBQGA1UECgwNT3BlblNwcmlua2xlcjEcMBoGA1UEAwwTb3BlbnNwcmlua2xlci5sb2NhbDBZMBMGByqGSM49" +
	"AgEGCCqGSM49AwEHA0IABEqfCH4YTiJMurie1J1RigJqf3ObYR6fbV1xwtd+vHySIW7ZlFaR651H21BooCTR" +
	"F+I6WSOXBrnjiIMnmzpkJ5WjgYQwgYEwMwYDVR0RBCwwKoITb3BlbnNwcmlua2xlci5sb2NhbIINb3BlbnNw" +
	"cmlua2xlcocEwKgAVjAJBgNVHRMEAjAAMAsGA1UdDwQEAwIHgDATBgNVHSUEDDAKBggrBgEFBQcDATAdBgNV" +
	"HQ4EFgQUUJH+04dMQgCzoKr93Co/8Zh9NG4wCgYIKoZIzj0EAwIDSAAwRQIhAPQ7btQyr8MBiElWSAkHHjXo" +
	"TylqRePG2v1wf0FmvPlzAiBz1S9tYSB8A04U4b2i85okYJy/LDx4yi6CCXXtSWUp";

/**
 * Show the platform-appropriate certificate trust dialog for an HTTPS device.
 *
 * - Cordova (Android/iOS): Resets and re-applies native HTTP cert pinning using
 *   the bundled OpenSprinkler certificate. Calls onComplete(true) on success.
 * - Web browser: Guides the user to open the device HTTPS URL directly so the
 *   browser can show its "Accept risk" flow, and offers the cert for download.
 *
 * @param {string}   host       - Device IP or hostname without protocol prefix.
 * @param {Function} [onComplete] - Called with true when trusted, false on cancel.
 */
OSApp.SSL.showCertDialog = function( host, onComplete ) {
	var isCordova = !!window.cordova,
		instructions, buttons;

	if ( isCordova ) {
		instructions =
			"<p>" + OSApp.Language._( "This device uses a self-signed security certificate. The app includes the standard OpenSprinkler certificate for secure HTTPS access." ) + "</p>" +
			"<p class='smaller' style='color:#c80'>" +
				OSApp.Language._( "Only proceed if this is your own device on a trusted local network." ) +
			"</p>";
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
			"<a data-role='button' id='ssl-download-btn' href='#'>" + OSApp.Language._( "Download Certificate" ) + "</a>" +
			"<a data-role='button' data-theme='a' id='ssl-cancel-btn' href='#'>" + OSApp.Language._( "Cancel" ) + "</a>";
	}

	var popup = $(
		"<div data-role='popup' id='ssl-cert-popup' class='ui-content' style='max-width:320px'>" +
			"<h3>" + OSApp.Language._( "Self-Signed Certificate" ) + "</h3>" +
			instructions + buttons +
		"</div>"
	);

	$( "body" ).append( popup );
	popup.enhanceWithin();
	popup.one( "popupafterclose", function() {
		popup.popup( "destroy" ).remove();
	} );

	if ( isCordova ) {
		popup.find( "#ssl-trust-btn" ).on( "click", function() {
			popup.popup( "close" );
			// Reset nativeHttpReady so ensurePinnedNativeHttp re-applies the trust mode
			OSApp.Firmware.nativeHttpReady = false;
			OSApp.Firmware.ensurePinnedNativeHttp( function( ready ) {
				if ( typeof onComplete === "function" ) {
					onComplete( ready );
				}
			} );
		} );
	} else {
		// Set href via jQuery - prevents XSS from host value embedded in HTML
		popup.find( "#ssl-open-btn" )
			.attr( "href", "https://" + host )
			.attr( "target", "_blank" )
			.attr( "rel", "noopener" );
		popup.find( "#ssl-download-btn" ).on( "click", function( e ) {
			e.preventDefault();
			OSApp.SSL.downloadBundledCert();
		} );
	}

	popup.find( "#ssl-cancel-btn" ).on( "click", function() {
		popup.popup( "close" );
		if ( typeof onComplete === "function" ) {
			onComplete( false );
		}
	} );

	popup.popup( { history: false, positionTo: "window" } ).popup( "open" );
};

/**
 * Trigger a browser download of the bundled OpenSprinkler DER certificate
 * as an installable .cer file. The user can then install it in their OS or
 * browser trust store to enable HTTPS access without warnings.
 */
OSApp.SSL.downloadBundledCert = function() {
	var binary = atob( OSApp.SSL.BUNDLED_CERT_B64 ),
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
