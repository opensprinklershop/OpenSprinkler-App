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
OSApp.Welcome = OSApp.Welcome || {};
OSApp.Welcome.Constants = {
	setupWizardSeenKey: "setupWizardSeen"
};

OSApp.Welcome.markSetupWizardSeen = function() {
	OSApp.Storage.set( { "setupWizardSeen": "true" } );
};

OSApp.Welcome.shouldShowSetupWizard = function() {
	var sites = OSApp.Sites.parseSites( OSApp.Storage.getItemSync( "sites" ) ),
		hasCloudLogin = typeof OSApp.Storage.getItemSync( "cloudToken" ) === "string";

	return OSApp.Storage.getItemSync( OSApp.Welcome.Constants.setupWizardSeenKey ) !== "true" &&
		$.isEmptyObject( sites ) &&
		!hasCloudLogin;
};

OSApp.Welcome.showSetupWizard = function() {
	$( "#setupWizard" ).popup( "destroy" ).remove();

	var popup = $( "<div data-role='popup' class='modal' id='setupWizard' data-theme='a' data-overlay-theme='b'>" +
			"<div class='ui-content'>" +
				"<h2 class='tight center'>" + OSApp.Language._( "First-Time Setup Assistant" ) + "</h2>" +
				"<p class='rain-desc'>" +
					OSApp.Language._( "Choose how you want to connect your new OpenSprinkler controller. You can also sign in to OpenSprinkler.com or leave setup for later." ) +
				"</p>" +
				"<div data-role='collapsible-set' data-inset='false'>" +
					"<div data-role='collapsible' data-collapsed='false'>" +
						"<h3>" + OSApp.Language._( "Connect with Wi-Fi" ) + "</h3>" +
						"<ol class='setup-wizard-steps'>" +
							"<li>" + OSApp.Language._( "Power on OpenSprinkler and wait for the Wi-Fi network named OS_XYZ to appear. The XYZ part is different on each controller." ) + "</li>" +
							"<li>" + OSApp.Language._( "Connect your phone or tablet to that Wi-Fi network." ) + "</li>" +
							"<li>" + OSApp.Language._( "After joining the OpenSprinkler Wi-Fi, continue below and enter the device address shown by the controller setup." ) + "</li>" +
						"</ol>" +
						"<a href='#' class='ui-btn ui-btn-b setup-wifi'>" + OSApp.Language._( "Continue Wi-Fi Setup" ) + "</a>" +
					"</div>" +
					"<div data-role='collapsible'>" +
						"<h3>" + OSApp.Language._( "Connect with Ethernet" ) + "</h3>" +
						"<ol class='setup-wizard-steps'>" +
							"<li>" + OSApp.Language._( "Connect the controller to your router with an Ethernet cable." ) + "</li>" +
							"<li>" + OSApp.Language._( "Press B1 on the controller to show its IP address." ) + "</li>" +
							"<li>" + OSApp.Language._( "Enter that IP address in the next step to connect this app." ) + "</li>" +
						"</ol>" +
						"<a href='#' class='ui-btn ui-btn-b setup-ethernet'>" + OSApp.Language._( "Continue Ethernet Setup" ) + "</a>" +
					"</div>" +
				"</div>" +
				"<a href='#' class='ui-btn setup-cloud-login'>" + OSApp.Language._( "OpenSprinkler.com Login" ) + "</a>" +
				"<a href='#' class='ui-btn ui-btn-inline setup-skip'>" + OSApp.Language._( "Skip Setup for Now" ) + "</a>" +
			"</div>" +
		"</div>" ),
		openAddController = function( mode ) {
			var options = {
				password: "opendoor",
				passwordHelp: OSApp.Language._( "The factory default password is opendoor. Please change it when convenient." )
			};

			if ( mode === "wifi" ) {
				options.helperText = OSApp.Language._( "Connect to the OpenSprinkler Wi-Fi named OS_XYZ first, then enter the device address you were given during setup." );
				options.addressPlaceholder = "192.168.4.1";
			} else {
				options.helperText = OSApp.Language._( "Press B1 on the controller to display its IP address, then enter that address here." );
				options.addressPlaceholder = "192.168.1.50";
			}

			OSApp.Sites.showAddNew( false, true, options );
		};

	popup.find( ".setup-wifi" ).on( "click", function() {
		openAddController( "wifi" );
		return false;
	} );

	popup.find( ".setup-ethernet" ).on( "click", function() {
		openAddController( "ethernet" );
		return false;
	} );

	popup.find( ".setup-cloud-login" ).on( "click", function() {
		// jQuery Mobile does not support nested popups. Close the wizard first,
		// then open the cloud login popup once the wizard has fully closed.
		popup.one( "popupafterclose.cloudlogin", function() {
			OSApp.Network.requestCloudAuth( function( didSucceed ) {
				if ( didSucceed ) {
					OSApp.Welcome.markSetupWizardSeen();
				}
			} );
		} );
		popup.popup( "close" );
		return false;
	} );

	popup.find( ".setup-skip" ).on( "click", function() {
		OSApp.Welcome.markSetupWizardSeen();
		popup.popup( "close" );
		return false;
	} );

	OSApp.UIDom.openPopup( popup );
};

OSApp.Welcome.displayPage = function() {
	// Welcome page, start configuration screen
	var page = $( "<div data-role='page' id='start'>" +
			"<ul data-role='none' id='welcome_list' class='ui-listview ui-listview-inset ui-corner-all'>" +
			"<li><div class='logo' id='welcome_logo'></div></li>" +
			"<li class='ui-li-static ui-body-inherit ui-first-child ui-last-child ui-li-separate'>" +
			"<p class='rain-desc'>" +
			OSApp.Language._( "Welcome to the OpenSprinkler application. This app only works with the OpenSprinkler controller which must be installed and setup on your home network." ) +
			"</p>" +
			"<a class='iab iabNoScale ui-btn ui-mini center' target='_blank' href='https://opensprinkler.com/product/opensprinkler/'>" +
			OSApp.Language._( "Purchase OpenSprinkler" ) +
			"</a>" +
			"</li>" +
			"<li class='ui-first-child ui-last-child'>" +
			"<a href='#' class='ui-btn center cloud-login'>" + OSApp.Language._( "OpenSprinkler.com Login" ) + "</a>" +
			"</li>" +
			"<hr class='content-divider'>" +
			"<li id='auto-scan' class='ui-first-child'>" +
			"<a href='#' class='ui-btn ui-btn-icon-right ui-icon-carat-r'>" +
			OSApp.Language._( "Scan For Device" ) +
			"</a>" +
			"</li>" +
			"<li class='ui-first-child ui-last-child'>" +
			"<a class='ui-btn ui-btn-icon-right ui-icon-carat-r' data-rel='popup' href='#addnew'>" +
			OSApp.Language._( "Add Controller" ) +
			"</a>" +
			"</li>" +
			"</ul>" +
			"</div>" ),
		checkAutoScan = function() {
			OSApp.Network.updateDeviceIP( function( ip ) {
				if ( ip === undefined ) {
					resetStartMenu();
					return;
				}

				// Check if the IP is on a private network, if not don't enable automatic scanning
				if ( !OSApp.Network.isLocalIP( ip ) ) {
					resetStartMenu();
					return;
				}

				//Change main menu items to reflect ability to automatically scan
				next.removeClass( "ui-first-child" ).find( "a.ui-btn" ).text( OSApp.Language._( "Manually Add Device" ) );
				auto.show();
			} );
		},
		resetStartMenu = function() {
			next.addClass( "ui-first-child" ).find( "a.ui-btn" ).text( OSApp.Language._( "Add Controller" ) );
			auto.hide();
		},
		auto = page.find( "#auto-scan" ),
		next = auto.next();

	page.find( "#auto-scan" ).find( "a" ).on( "click", function() {
		OSApp.Network.startScan();
		return false;
	} );

	page.find( "a[href='#addnew']" ).on( "click", function() {
		OSApp.Sites.showAddNew();
	} );

	page.find( ".cloud-login" ).on( "click", function() {
		OSApp.Network.requestCloudAuth();
		return false;
	} );

	page.on( "pagehide", function() {
		page.detach();
	} );

	function begin() {
		if ( OSApp.currentSession.isControllerConnected() ) {
			return false;
		}

		$( "#start" ).remove();

		$.mobile.pageContainer.append( page );

		checkAutoScan();

		if ( OSApp.Welcome.shouldShowSetupWizard() ) {
			page.one( "pageshow", function() {
				OSApp.Welcome.showSetupWizard();
			} );
		}
	}

	return begin();
};
