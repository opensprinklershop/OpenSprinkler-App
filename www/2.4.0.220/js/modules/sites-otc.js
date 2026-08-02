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
OSApp.Sites = OSApp.Sites || {};

// Show popup for adding OTC connection to existing local site
OSApp.Sites.showAddOTCConnection = function( siteName, siteData ) {
	$( "#add-otc-popup" ).popup( "destroy" ).remove();

	var popup = $( "<div data-role='popup' id='add-otc-popup' data-theme='a' data-overlay-theme='b'>" +
		"<div data-role='header' data-theme='b'>" +
			"<h1>" + OSApp.Language._( "Add OTC Connection" ) + "</h1>" +
		"</div>" +
		"<div class='ui-content'>" +
			"<form method='post' novalidate>" +
				"<p class='smaller'>" +
					OSApp.Language._( "To add an OTC (OpenThings Cloud) connection to this local device, you need an OTC token." ) +
				"</p>" +
				"<p class='smaller'>" +
					"<strong>" + OSApp.Language._( "Step 1:" ) + "</strong> " +
					OSApp.Language._( "Register an account at:" ) +
				"</p>" +
				"<a href='#' class='ui-btn ui-btn-b ui-corner-all open-link' data-url='https://opensprinkler.com/my-account'>" +
					"opensprinkler.com/my-account" +
				"</a>" +
				"<p class='smaller'>" +
					"<strong>" + OSApp.Language._( "Step 2:" ) + "</strong> " +
					OSApp.Language._( "Create an entry and get your token at:" ) +
				"</p>" +
				"<a href='#' class='ui-btn ui-btn-b ui-corner-all open-link' data-url='https://openthings.io/my-account/'>" +
					"openthings.io/my-account" +
				"</a>" +
				"<p class='smaller'>" +
					"<strong>" + OSApp.Language._( "Step 3:" ) + "</strong> " +
					OSApp.Language._( "Enter your OTC token below:" ) +
				"</p>" +
				"<label for='otc_token'>" + OSApp.Language._( "OTC Token:" ) + "</label>" +
				"<input autocomplete='off' autocorrect='off' autocapitalize='off' " +
					"spellcheck='false' type='text' name='otc_token' id='otc_token' " +
					"placeholder='OT...' pattern='^OT[A-Za-z0-9]{30}$'>" +
				"<input type='submit' data-theme='b' value='" + OSApp.Language._( "Add Connection" ) + "'>" +
			"</form>" +
		"</div>" +
	"</div>" );

	popup.find( ".open-link" ).on( "click", function( e ) {
		e.preventDefault();
		var url = $( this ).data( "url" );
		if ( typeof cordova !== "undefined" && cordova.InAppBrowser ) {
			cordova.InAppBrowser.open( url, "_system" );
		} else {
			window.open( url, "_blank" );
		}
		return false;
	} );

	popup.find( "form" ).on( "submit", function() {
		var token = $( "#otc_token" ).val().trim();

		// Validate token format (OT followed by 30 alphanumeric characters)
		if ( !token.match( /^OT[A-Za-z0-9]{30}$/ ) ) {
			OSApp.Errors.showError( OSApp.Language._( "Invalid OTC token format. Token must start with 'OT' followed by 30 alphanumeric characters." ) );
			return false;
		}

		popup.popup( "close" );
		OSApp.Sites.registerOTCToken( siteName, siteData, token );
		return false;
	} );

	popup.one( "popupafterclose", function() {
		$( this ).popup( "destroy" ).remove();
	} ).popup( {
		history: false,
		"positionTo": "window"
	} ).enhanceWithin();

	popup.popup( "open" );

	OSApp.UIDom.fixInputClick( popup );

	return false;
};

// Register OTC token with local device and create new OTC site entry
OSApp.Sites.registerOTCToken = function( siteName, siteData, token ) {
	$.mobile.loading( "show" );

	// Prepare the JSON data to send to the device
	var otcConfig = {
		"en": 1,
		"token": token,
		"server": "ws.cloud.openthings.io",
		"port": 80
	};

	// URL encode the JSON
	var encodedJson = encodeURIComponent( JSON.stringify( otcConfig ).slice(1,-1) );

	// Store current session to restore later
	var originalIp = OSApp.currentSession.ip;
	var originalToken = OSApp.currentSession.token;
	var originalPass = OSApp.currentSession.pass;
	var originalPrefix = OSApp.currentSession.prefix;
	var originalAuth = OSApp.currentSession.auth;
	var originalAuthUser = OSApp.currentSession.authUser;
	var originalAuthPass = OSApp.currentSession.authPass;

	// Temporarily set session to the local site
	OSApp.currentSession.ip = siteData.os_ip;
	OSApp.currentSession.token = null;
	OSApp.currentSession.pass = siteData.os_pw;
	OSApp.currentSession.prefix = siteData.ssl === "1" ? "https://" : "http://";
	OSApp.currentSession.auth = typeof siteData.auth_user !== "undefined" && typeof siteData.auth_pw !== "undefined";
	OSApp.currentSession.authUser = siteData.auth_user || "";
	OSApp.currentSession.authPass = siteData.auth_pw || "";

	// Send token registration to the device
	OSApp.Firmware.sendToOS( "/co?pw=&otc=" + encodedJson ).then(
		function( response ) {
			void response;
			// Token registration successful, now reboot the device (ignore response)
			OSApp.Firmware.sendToOS( "/cv?pw=&rbt=1" );

			// Create new OTC site entry
			OSApp.Storage.get( [ "sites", "current_site" ], function( data ) {
				var sites = OSApp.Sites.parseSites( data.sites );

				// Generate a name for the new OTC site
				var otcSiteName = siteName + " (OTC)";
				var counter = 1;
				while ( otcSiteName in sites ) {
					counter++;
					otcSiteName = siteName + " (OTC " + counter + ")";
				}

				// Create new OTC site entry
				sites[ otcSiteName ] = {
					os_token: token,
					os_pw: siteData.os_pw
				};

				// Save the updated sites
				OSApp.Storage.set( { "sites": JSON.stringify( sites ) }, function() {
					OSApp.Network.cloudSaveSites();
					OSApp.Sites.updateSiteList( Object.keys( sites ), data.current_site );

					// Restore original session
					OSApp.currentSession.ip = originalIp;
					OSApp.currentSession.token = originalToken;
					OSApp.currentSession.pass = originalPass;
					OSApp.currentSession.prefix = originalPrefix;
					OSApp.currentSession.auth = originalAuth;
					OSApp.currentSession.authUser = originalAuthUser;
					OSApp.currentSession.authPass = originalAuthPass;

					$.mobile.loading( "hide" );
					OSApp.Errors.showError( OSApp.Language._( "OTC connection added successfully as" ) + " '" + otcSiteName + "'" );

					// Trigger refresh of site control page
					$( "html" ).trigger( "siterefresh" );
				} );
			} );
		},
		function( error ) {
			void error;
			// Restore original session
			OSApp.currentSession.ip = originalIp;
			OSApp.currentSession.token = originalToken;
			OSApp.currentSession.pass = originalPass;
			OSApp.currentSession.prefix = originalPrefix;
			OSApp.currentSession.auth = originalAuth;
			OSApp.currentSession.authUser = originalAuthUser;
			OSApp.currentSession.authPass = originalAuthPass;

			$.mobile.loading( "hide" );
			OSApp.Errors.showError( OSApp.Language._( "Failed to register OTC token with the device. Please check your connection and try again." ) );
		}
	);
};
