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
OSApp.Language = OSApp.Language || {};

OSApp.Language.Constants = {
	languageCodes: {
		af: "Afrikaans",
		am: "Amharic",
		bg: "Bulgarian",
		zh: "Chinese",
		hr: "Croatian",
		cs: "Czech",
		nl: "Dutch",
		en: "English",
		et: "Estonian",
		pes: "Farsi",
		fr: "French",
		de: "German",
		el: "Greek",
		he: "Hebrew",
		hu: "Hungarian",
		is: "Icelandic",
		it: "Italian",
		lv: "Latvian",
		mn: "Mongolian",
		no: "Norwegian",
		pl: "Polish",
		pt: "Portuguese",
		ru: "Russian",
		sk: "Slovak",
		sl: "Slovenian",
		es: "Spanish",
		ta: "Tamil",
		th: "Thai",
		tr: "Turkish",
		sv: "Swedish",
		ro: "Romanian"
	}
};

//Localization functions
OSApp.Language._ = function( key ) {

	//Translate item (key) based on currently defined language
	if ( typeof OSApp.uiState.language === "object" && Object.prototype.hasOwnProperty.call(OSApp.uiState.language,  key ) ) {
		var trans = OSApp.uiState.language[ key ];
		return trans ? trans : key;
	} else {

		//If English
		return key;
	}
};

OSApp.Language.setLang = function() {

	//Update all static elements to the current language
	$( "[data-translate]" ).each( function() {
		var el = $( this ),
			txt = el.data( "translate" );

		if ( el.is( "input[type='submit']" ) ) {
			el.val( OSApp.Language._( txt ) );

			// Update button for jQuery Mobile
			if ( el.parent( "div.ui-btn" ).length > 0 ) {
				el.button( "refresh" );
			}
		} else {
			el.text( OSApp.Language._( txt ) );
		}
	} );
	$( ".ui-toolbar-back-btn" ).text( OSApp.Language._( "Back" ) );

	OSApp.Language.checkCurrLang();

	// FIXME: Some elements need to be manually re-rendered to apply language changes. Can this be handled through an event? page reload?
	OSApp.Weather.updateWeatherBox();
	OSApp.Dashboard.updateWaterLevel();
	OSApp.Dashboard.updateRestrictNotice();
};

OSApp.Language.updateUIElements = function() {
	// FIXME: Some elements need to be manually re-rendered to apply language changes. Can this be handled through an event? page reload?
	try {
		if ( typeof OSApp.Weather !== "undefined" && typeof OSApp.Weather.updateWeatherBox === "function" ) {
			OSApp.Weather.updateWeatherBox();
		}
	} catch ( e ) {
		console.warn( "Could not update weather box: ", e );
	}
	try {
		if ( typeof OSApp.Dashboard !== "undefined" && typeof OSApp.Dashboard.updateWaterLevel === "function" ) {
			OSApp.Dashboard.updateWaterLevel();
		}
	} catch ( e ) {
		console.warn( "Could not update water level: ", e );
	}
	try {
		if ( typeof OSApp.Dashboard !== "undefined" && typeof OSApp.Dashboard.updateRestrictNotice === "function" ) {
			OSApp.Dashboard.updateRestrictNotice();
		}
	} catch ( e ) {
		console.warn( "Could not update restrict notice: ", e );
	}
};

OSApp.Language.updateLang = function( lang ) {

	//Empty out the current OSApp.uiState.language (English is provided as the key)
	OSApp.uiState.language = {};

	if ( typeof lang === "undefined" ) {
		OSApp.Storage.get( "lang", function( data ) {

			//Identify the current browser's locale
			var locale = data.lang || navigator.language || navigator.browserLanguage || navigator.systemLanguage || navigator.userLanguage || "en";

			OSApp.Language.updateLang( locale.substring( 0, 2 ) );
		} );
		return;
	}

	OSApp.Storage.set( { "lang": lang } );
	OSApp.currentSession.lang = lang;

	if ( lang === "en" ) {
		OSApp.Language.setLang();
		return;
	}

	var langURL = OSApp.UIDom.getAppURLPath() + "locale/" + lang + ".js";
	console.log( "Loading language file: " + langURL );

	$.getJSON( langURL, function( store ) {
		console.log( "Language file loaded successfully", store );
		if ( store && store.messages ) {
			OSApp.uiState.language = store.messages;
			OSApp.Language.setLang();
		} else {
			console.error( "Language file format error: missing 'messages' object" );
			OSApp.Language.setLang();
		}
	} ).fail( function( jqxhr, textStatus, errorThrown ) {
		console.error( "Failed to load language file: " + textStatus + " - " + errorThrown );
		console.error( "Tried URL: " + langURL );
		console.error( "Response status: " + jqxhr.status );
		alert( "Error loading language file: " + textStatus + "\nURL: " + langURL );
		OSApp.Language.setLang();
	} );
};

OSApp.Language.languageSelect = function() {
	console.log( "languageSelect called" );

	$( "#localization" ).popup( "destroy" ).remove();

	/*
		Commented list of languages used by the string parser to identify strings for translation
	*/

	var popup = "<div data-role='popup' data-theme='a' id='localization' data-corners='false'>" +
				"<div class='ui-header ui-bar-a' role='banner' style='display: flex; justify-content: space-between; align-items: center; padding: 10px;'>" +
				"<h1 data-translate='Localization'>" + OSApp.Language._( "Localization" ) + "</h1>" +
				"<button class='ui-btn ui-corner-all ui-icon-delete ui-btn-icon-right' id='lang-close-btn'>Close</button>" +
				"</div>" +
				"<ul data-inset='true' data-role='listview' id='lang' data-corners='false'>";

	$.each( OSApp.Language.Constants.languageCodes, function( key, name ) {
		popup += "<li><a href='#' data-lang-code='" + key + "'><span data-translate='" + name + "'>" + OSApp.Language._( name ) + "</span> (" + key.toUpperCase() + ")</a></li>";
	} );

	popup += "</ul></div>";

	popup = $( popup );

	popup.find( "a" ).on( "click", function( e ) {
		e.preventDefault();
		var link = $( this ),
			lang = link.data( "lang-code" );

		console.log( "Language selected: " + lang );
		OSApp.Language.updateLang( lang );
	} );

	popup.find( "#lang-close-btn" ).on( "click", function( e ) {
		e.preventDefault();
		console.log( "Closing language popup" );
		popup.popup( "close" );
		return false;
	} );

	console.log( "About to open popup", popup );
	OSApp.UIDom.openPopup( popup );
	console.log( "Popup opened" );

	return false;
};

OSApp.Language.checkCurrLang = function() {
	OSApp.Storage.get( "lang", function( data ) {
		var popup = $( "#localization" );

		// Only update popup if it exists
		if ( popup.length > 0 ) {
			popup.find( "a" ).each( function() {
				var item = $( this );
				if ( item.data( "lang-code" ) === data.lang ) {
					item.removeClass( "ui-icon-carat-r" ).addClass( "ui-icon-check" );
				} else {
					item.removeClass( "ui-icon-check" ).addClass( "ui-icon-carat-r" );
				}
			} );

			popup.find( "li.ui-last-child" ).removeClass( "ui-last-child" );
		}

		OSApp.Language.updateUIElements();
	} );
};
