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
OSApp.Matter = OSApp.Matter || {};

OSApp.Matter.setupMatter = function() {
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

// Check if Matter feature is supported
OSApp.Matter.isMatterSupported = function() {
	if ( !OSApp.currentSession.controller || !OSApp.currentSession.controller.options ) {
		return false;
	}

	var feature = OSApp.currentSession.controller.options.feature;
	return feature && feature.indexOf( "MATTER" ) !== -1;
};
