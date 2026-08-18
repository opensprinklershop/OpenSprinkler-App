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

// Opens the manual "Add controller" dialog pre-filled with connection hints.
OSApp.Welcome.openAddController = function( mode ) {
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

// Ordered list of the numbered guide steps (the language chooser is a separate intro step).
OSApp.Welcome.getWizardSteps = function() {
	return [
		"welcome",
		"connect",
		"add",
		"cloud",
		"finish"
	];
};

// Builds the inner HTML for a single guide step.
OSApp.Welcome.buildWizardStepContent = function( step, stepNumber, totalSteps ) {
	var _ = OSApp.Language._,
		progress = "<p class='setup-wizard-progress'>" +
			_( "Step" ) + " " + stepNumber + " " + _( "of" ) + " " + totalSteps +
			"</p>",
		html = "";

	switch ( step ) {
		case "welcome":
			html =
				"<div class='setup-wizard-logo logo'></div>" +
				"<h2 class='tight center'>" + _( "Welcome to OpenSprinklerShop" ) + "</h2>" +
				progress +
				"<p class='rain-desc'>" +
					_( "This app is made for the extended OpenSprinklerShop firmware. It unlocks additional features such as advanced sensors, Zigbee/Matter devices, analog inputs and more that are not available in the standard firmware." ) +
				"</p>" +
				"<p class='rain-desc setup-wizard-devices-title'>" + _( "Supported devices:" ) + "</p>" +
				"<ul class='setup-wizard-devices'>" +
					"<li>" +
						"<img class='setup-wizard-device-img' loading='lazy' alt='OpenSprinkler 3.x' src='https://opensprinklershop.de/wp-content/uploads/2018/12/OS34-1-1.avif'>" +
						"<span class='setup-wizard-device-name'>" + _( "OpenSprinkler 3.x with OpenSprinklerShop firmware" ) + "</span>" +
						"<a class='iab iabNoScale ui-btn ui-mini ui-btn-inline' target='_blank' href='https://opensprinklershop.de/en/product/opensprinkler-3-0/'>" + _( "View in Shop" ) + "</a>" +
					"</li>" +
					"<li>" +
						"<img class='setup-wizard-device-img' loading='lazy' alt='OpenSprinkler Pro' src='https://opensprinklershop.de/wp-content/uploads/2026/04/16432-scaled-e1777199276933-247x247.avif'>" +
						"<span class='setup-wizard-device-name'>" + _( "OpenSprinkler Pro" ) + "</span>" +
						"<a class='iab iabNoScale ui-btn ui-mini ui-btn-inline' target='_blank' href='https://opensprinklershop.de/en/product/opensprinkler-pro/'>" + _( "View in Shop" ) + "</a>" +
					"</li>" +
					"<li>" +
						"<img class='setup-wizard-device-img' loading='lazy' alt='ESP32 Upgrade Board' src='https://opensprinklershop.de/wp-content/uploads/2026/03/IMG_20260315_185118-scaled-e1773606716986-247x270.avif'>" +
						"<span class='setup-wizard-device-name'>" + _( "OpenSprinkler with ESP32 Upgrade Board" ) + "</span>" +
						"<a class='iab iabNoScale ui-btn ui-mini ui-btn-inline' target='_blank' href='https://opensprinklershop.de/en/product/esp32-board-fuer-opensprinkler-3-3-upgrade/'>" + _( "View in Shop" ) + "</a>" +
					"</li>" +
				"</ul>" +
				"<p class='rain-desc'>" +
					_( "This short guide walks you through connecting your controller. You can skip any step and change everything later in the settings." ) +
				"</p>" +
				"<a class='iab iabNoScale ui-btn setup-wizard-help' target='_blank' href='https://opensprinklershop.github.io'>" + _( "Help & Documentation" ) + "</a>";
			break;
		case "connect":
			html =
				"<h2 class='tight center'>" + _( "Connect your controller" ) + "</h2>" +
				progress +
				"<p class='rain-desc'>" +
					_( "First bring your OpenSprinkler controller onto your home network. Choose how it is connected." ) +
				"</p>" +
				"<div data-role='collapsible-set' data-inset='false'>" +
					"<div data-role='collapsible' data-collapsed='false'>" +
						"<h3>" + _( "Connect with Wi-Fi" ) + "</h3>" +
						"<ol class='setup-wizard-steps'>" +
							"<li>" + _( "Power on OpenSprinkler and wait for the Wi-Fi network named OS_XYZ to appear. The XYZ part is different on each controller." ) + "</li>" +
							"<li>" + _( "Connect your phone or tablet to that Wi-Fi network." ) + "</li>" +
							"<li>" + _( "After joining the OpenSprinkler Wi-Fi, continue below and enter the device address shown by the controller setup." ) + "</li>" +
						"</ol>" +
						"<a href='#' class='ui-btn ui-btn-b setup-wifi'>" + _( "Continue Wi-Fi Setup" ) + "</a>" +
					"</div>" +
					"<div data-role='collapsible'>" +
						"<h3>" + _( "Connect with Ethernet" ) + "</h3>" +
						"<ol class='setup-wizard-steps'>" +
							"<li>" + _( "Connect the controller to your router with an Ethernet cable." ) + "</li>" +
							"<li>" + _( "Press B1 on the controller to show its IP address." ) + "</li>" +
							"<li>" + _( "Enter that IP address in the next step to connect this app." ) + "</li>" +
						"</ol>" +
						"<a href='#' class='ui-btn ui-btn-b setup-ethernet'>" + _( "Continue Ethernet Setup" ) + "</a>" +
					"</div>" +
				"</div>" +
				"<p class='rain-desc setup-wizard-hint'>" +
					_( "Already connected? Just continue to the next step to add your controller." ) +
				"</p>";
			break;
		case "add":
			html =
				"<h2 class='tight center'>" + _( "Add your controller" ) + "</h2>" +
				progress +
				"<p class='rain-desc'>" +
					_( "Now let this app find your controller on the network so you can control it. You can scan automatically or enter the device address manually." ) +
				"</p>" +
				"<a href='#' class='ui-btn ui-btn-b setup-scan'>" + _( "Scan For Device" ) + "</a>" +
				"<a href='#' class='ui-btn setup-manual'>" + _( "Manually Add Device" ) + "</a>";
			break;
		case "cloud":
			html =
				"<h2 class='tight center'>" + _( "Cloud sync account (optional)" ) + "</h2>" +
				progress +
				"<p class='rain-desc'>" +
					_( "Sign in with your OpenSprinklerShop.de or OpenSprinkler.com account to keep a server-stored copy of your device list and manage several OpenSprinkler controllers across your devices." ) +
				"</p>" +
				"<p class='rain-desc setup-wizard-hint'>" +
					_( "Note: this does not enable remote access on its own. For access from anywhere you additionally need an OTC (OpenThings Cloud) token, which you create at openthings.io and add per device later. This step is optional." ) +
				"</p>" +
				"<a href='#' class='ui-btn ui-btn-b setup-cloud-login'>" + _( "Cloud Sync Login" ) + "</a>";
			break;
		case "finish":
			html =
				"<div class='setup-wizard-logo logo'></div>" +
				"<h2 class='tight center'>" + _( "You're all set" ) + "</h2>" +
				progress +
				"<p class='rain-desc'>" +
					_( "That's it! You can revisit this assistant any time from the Setup Assistant option, and adjust every setting later." ) +
				"</p>" +
				"<a href='#' class='ui-btn ui-btn-b setup-finish'>" + _( "Finish" ) + "</a>";
			break;
	}

	return html;
};

// Resolves the best-matching available language code from the browser settings.
OSApp.Welcome.getBrowserLanguage = function() {
	var nav = navigator.language || navigator.browserLanguage || navigator.systemLanguage || navigator.userLanguage || "en",
		code = String( nav ).substring( 0, 2 ).toLowerCase();

	if ( Object.prototype.hasOwnProperty.call( OSApp.Language.Constants.languageCodes, code ) ) {
		return code;
	}

	return "en";
};

// Native "Continue in <language>" labels, always rendered in the target language itself.
OSApp.Welcome.ContinueNativeLabels = {
	af: "Gaan voort in Afrikaans",
	am: "በአማርኛ ይቀጥሉ",
	bg: "Продължете на български",
	zh: "继续使用中文",
	hr: "Nastavi na hrvatskom",
	cs: "Pokračovat v češtině",
	nl: "Doorgaan in het Nederlands",
	en: "Continue in English",
	et: "Jätka eesti keeles",
	pes: "ادامه به فارسی",
	fr: "Continuer en français",
	de: "Auf Deutsch fortfahren",
	el: "Συνέχεια στα ελληνικά",
	he: "המשך בעברית",
	hu: "Folytatás magyarul",
	is: "Halda áfram á íslensku",
	it: "Continua in italiano",
	lv: "Turpināt latviski",
	mn: "Монголоор үргэлжлүүлэх",
	no: "Fortsett på norsk",
	pl: "Kontynuuj po polsku",
	pt: "Continuar em português",
	ru: "Продолжить на русском",
	sk: "Pokračovať v slovenčine",
	sl: "Nadaljuj v slovenščini",
	es: "Continuar en español",
	ta: "தமிழில் தொடரவும்",
	th: "ดำเนินการต่อเป็นภาษาไทย",
	tr: "Türkçe devam et",
	sv: "Fortsätt på svenska",
	ro: "Continuați în română"
};

// Renders the language-selection intro step.
OSApp.Welcome.buildWizardLanguageStep = function() {
	var _ = OSApp.Language._,
		currentLang = OSApp.currentSession.lang || OSApp.Welcome.getBrowserLanguage() || "en",
		html =
			"<h2 class='tight center'>" + _( "Choose your language" ) + "</h2>" +
			"<p class='rain-desc'>" +
				_( "Select the language you want to use for this app. You can change it later at any time." ) +
			"</p>" +
			"<ul data-role='listview' data-inset='true' class='setup-wizard-langs'>";

	$.each( OSApp.Language.Constants.languageCodes, function( key, name ) {
		var icon = key === currentLang ? "ui-icon-check" : "ui-icon-carat-r";
		html += "<li data-icon='false'><a href='#' class='ui-btn ui-btn-icon-right " + icon + "' " +
			"data-lang-code='" + key + "'>" + OSApp.Language._( name ) + " (" + key.toUpperCase() + ")</a></li>";
	} );

	html += "</ul>";

	return html;
};

// Multi-step first-time setup guide. `state` = { view: "language"|"steps", step: <index> }
OSApp.Welcome.showSetupWizard = function( state ) {
	state = state || { view: "language", step: 0 };

	$( "#setupWizard" ).popup( "destroy" ).remove();

	var _ = OSApp.Language._,
		steps = OSApp.Welcome.getWizardSteps(),
		totalSteps = steps.length,
		isLanguage = state.view === "language",
		stepIndex = isLanguage ? -1 : state.step,
		bodyHtml = isLanguage ?
			OSApp.Welcome.buildWizardLanguageStep() :
			OSApp.Welcome.buildWizardStepContent( steps[ stepIndex ], stepIndex + 1, totalSteps ),
		navHtml = "<div class='setup-wizard-nav'>";

	var browserLang = OSApp.Welcome.getBrowserLanguage();

	if ( isLanguage ) {
		var continueLabel = OSApp.Welcome.ContinueNativeLabels[ browserLang ] || OSApp.Welcome.ContinueNativeLabels.en;
		navHtml += "<a href='#' class='ui-btn ui-btn-inline setup-lang-next'>" + continueLabel + "</a>";
	} else {
		if ( stepIndex > 0 ) {
			navHtml += "<a href='#' class='ui-btn ui-btn-inline setup-back'>" + _( "Back" ) + "</a>";
		}
		if ( stepIndex < totalSteps - 1 ) {
			navHtml += "<a href='#' class='ui-btn ui-btn-inline setup-next'>" + _( "Next" ) + "</a>";
		}
	}

	navHtml += "</div>" +
		"<a href='#' class='ui-btn ui-btn-inline setup-skip'>" + _( "Skip Setup for Now" ) + "</a>";

	var popup = $( "<div data-role='popup' class='modal' id='setupWizard' data-theme='a' data-overlay-theme='b'>" +
			"<div class='ui-content setup-wizard-content'>" +
				bodyHtml +
				navHtml +
			"</div>" +
		"</div>" );

	var goToStep = function( index ) {
		OSApp.Welcome.showSetupWizard( { view: "steps", step: index } );
	};

	var closeAndRun = function( fn ) {
		popup.one( "popupafterclose.setupwizard", function() {
			fn();
		} );
		popup.popup( "close" );
	};

	// Apply the chosen language, then rebuild the guide in that language.
	// showSetupWizard() destroys the current popup at its top, matching how the
	// step navigation already swaps popups reliably.
	var applyLanguage = function( lang ) {
		OSApp.Language.updateLang( lang, function() {
			OSApp.Welcome.showSetupWizard( { view: "steps", step: 0 } );
		} );
	};

	// Language step handlers
	popup.find( "[data-lang-code]" ).on( "click", function() {
		applyLanguage( $( this ).attr( "data-lang-code" ) );
		return false;
	} );

	// "Continue in <browser language>" applies the detected language.
	popup.find( ".setup-lang-next" ).on( "click", function() {
		applyLanguage( browserLang );
		return false;
	} );

	// Step navigation
	popup.find( ".setup-next" ).on( "click", function() {
		goToStep( stepIndex + 1 );
		return false;
	} );

	popup.find( ".setup-back" ).on( "click", function() {
		if ( stepIndex === 0 ) {
			OSApp.Welcome.showSetupWizard( { view: "language", step: 0 } );
		} else {
			goToStep( stepIndex - 1 );
		}
		return false;
	} );

	// Connection step actions (open the add-controller dialog).
	popup.find( ".setup-wifi" ).on( "click", function() {
		closeAndRun( function() {
			OSApp.Welcome.openAddController( "wifi" );
		} );
		return false;
	} );

	popup.find( ".setup-ethernet" ).on( "click", function() {
		closeAndRun( function() {
			OSApp.Welcome.openAddController( "ethernet" );
		} );
		return false;
	} );

	// Add-controller step actions.
	popup.find( ".setup-scan" ).on( "click", function() {
		closeAndRun( function() {
			// Scanning needs a local device IP; fall back to manual add when unavailable.
			OSApp.Network.updateDeviceIP( function( ip ) {
				if ( ip && OSApp.Network.isLocalIP( ip ) ) {
					OSApp.Network.startScan();
				} else {
					OSApp.Sites.showAddNew( false, true );
				}
			} );
		} );
		return false;
	} );

	popup.find( ".setup-manual" ).on( "click", function() {
		closeAndRun( function() {
			OSApp.Sites.showAddNew( false, true );
		} );
		return false;
	} );

	// Cloud login step.
	popup.find( ".setup-cloud-login" ).on( "click", function() {
		closeAndRun( function() {
			OSApp.Network.requestCloudAuth( function( didSucceed ) {
				if ( didSucceed ) {
					OSApp.Welcome.markSetupWizardSeen();
				}
			} );
		} );
		return false;
	} );

	// Finish and skip both dismiss the assistant.
	popup.find( ".setup-finish, .setup-skip" ).on( "click", function() {
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
			"<p class='rain-desc' data-translate='Welcome to the OpenSprinkler application. This app only works with the OpenSprinkler controller which must be installed and setup on your home network.'>" +
			"Welcome to the OpenSprinkler application. This app only works with the OpenSprinkler controller which must be installed and setup on your home network." +
			"</p>" +
			"<a class='iab iabNoScale ui-btn ui-mini center' target='_blank' href='https://opensprinklershop.de/en/product/opensprinkler-3-0/'>" +
			OSApp.Language._( "Purchase OpenSprinkler" ) +
			"</a>" +
			"</li>" +
			"<li class='ui-first-child ui-last-child'>" +
			"<a href='#' class='ui-btn center cloud-login'>" + OSApp.Language._( "Cloud Sync Login" ) + "</a>" +
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
