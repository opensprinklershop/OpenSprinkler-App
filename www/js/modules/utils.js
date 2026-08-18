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
OSApp.Utils = OSApp.Utils || {};

// Transform keys to JSON names for 2.1.9+
OSApp.Utils.transformKeys = function( opt ) {
	var renamedOpt = {};
	Object.keys( opt ).forEach( function( item ) {
		var name = item.match( /^o(\d+)$/ );

		if ( name && name[ 1 ] ) {
			renamedOpt[ Object.keys( OSApp.Constants.keyIndex ).find( function( index ) { return OSApp.Constants.keyIndex[ index ] === parseInt( name[ 1 ], 10 ); } ) ] = opt[ item ];
		} else {
			renamedOpt[ item ] = opt[ item ];
		}
	} );

	return renamedOpt;
};

OSApp.Utils.transformKeysinString = function( co ) {
	var opt = {};
	co.split( "&" ).forEach( function( item ) {
		item = item.split( "=" );
		opt[ item[ 0 ] ] = item[ 1 ];
	} );
	opt = OSApp.Utils.transformKeys( opt );
	var arr = [];
	Object.keys( opt ).forEach( function( key ) { arr.push( key + "=" + opt[ key ] ); } );
	co = arr.join( "&" );
	return co;
};

OSApp.Utils.escapeJSON = function( json ) {
	const j = JSON.stringify( json );
	return j.substring(1, j.length-1).replace( /\{|\}/g, "" );
	 // remove the surrounding brackets for firmware
};

OSApp.Utils.escapeJSON2 = function( json ) {
	return JSON.stringify( json ).replace(/#/g, "%23").replace(/=/g, "%3D").replace( /\{|\}/g, "" );
};

OSApp.Utils.unescapeJSON = function( string ) {
	return JSON.parse( "{" + string + "}" );
};

OSApp.Utils.isMD5 = function( pass ) {
	return /^[a-f0-9]{32}$/i.test( pass );
};

OSApp.Utils.sortByStation = function( a, b ) {
	if ( a.station < b.station ) {
		return -1;
	} else if ( a.station > b.station ) {
		return 1;
	} else {
		return 0;
	}
};

OSApp.Utils.getBitFromByte = function( byte, bit ) {
	return ( byte & ( 1 << bit ) ) !== 0;
};

// Pad digit with leading zeros
OSApp.Utils.pad = function( number, len=2 ) {
	var r = String( number );
	while ( r.length < len ) {
		r = "0" + r;
	}
	return r;
};

OSApp.Utils.lim = function( number, len=2 ) {
	var r = String( number );
	while ( r.length < len ) {
		r = "0" + r;
	}
	if ( r.length > len ) {
		r = r.substring(r.length-len);
	}
	return r;
};

// Escape characters for HTML support
OSApp.Utils.htmlEscape = function( str ) {

	// FIXME: this is not an extensive list and should be rewritten to use native DOM js htmlEncode. see https://www.w3docs.com/snippets/javascript/how-to-html-encode-a-string.html
	return String( str )
		.replace( /&/g, "&amp;" )
		.replace( /"/g, "&quot;" )
		.replace( /'/g, "&#39;" )
		.replace( /</g, "&lt;" )
		.replace( />/g, "&gt;" );
};

// Generate export link for JSON data
OSApp.Utils.exportObj = function( ele, obj, subject ) {
	obj = encodeURIComponent( JSON.stringify( obj ) );

	if ( OSApp.currentDevice.isFileCapable ) {
		$( ele ).attr( {
			href: "data:text/json;charset=utf-8," + obj,
			download: "backup-" + new Date().toLocaleDateString().replace( /\//g, "-" ) + ".json"
		} );
	} else {
		subject = subject || "OpenSprinkler Data Export on " + OSApp.Dates.dateToString( new Date() );
		var href = "mailto:?subject=" + encodeURIComponent( subject ) + "&body=" + obj;
		$( ele ).attr( "href", href ).on( "click", function() {
			window.open( href );
		} );
	}
};

OSApp.Utils.sortObj = function( obj, type ) {
	var tempArray = [];

	for ( var key in obj ) {
		if ( Object.prototype.hasOwnProperty.call(obj,  key ) ) {
			tempArray.push( key );
		}
	}

	if ( typeof type === "function" ) {
		tempArray.sort( type );
	} else if ( type === "value" ) {
		tempArray.sort( function( a, b ) {
			var x = obj[ a ];
			var y = obj[ b ];
			return ( ( x < y ) ? -1 : ( ( x > y ) ? 1 : 0 ) );
		} );
	} else {
		tempArray.sort();
	}

	var tempObj = {};

	for ( var i = 0; i < tempArray.length; i++ ) {
		tempObj[ tempArray[ i ] ] = obj[ tempArray[ i ] ];
	}

	return tempObj;
};

// Convert all elements in array to integer
OSApp.Utils.parseIntArray = function( arr ) {
	for ( var i = 0; i < arr.length; i++ ) {arr[ i ] = +arr[ i ];}
	return arr;
};

OSApp.Utils.getNumberLocale = function() {
	var lang = "en";

	if ( OSApp.currentSession && OSApp.currentSession.lang ) {
		lang = OSApp.currentSession.lang;
	} else if ( typeof navigator !== "undefined" && navigator.language ) {
		lang = navigator.language;
	}

	if ( typeof lang === "string" && lang.length > 2 ) {
		lang = lang.substring( 0, 2 );
	}

	return lang || "en";
};

OSApp.Utils.formatNumber = function( value, options ) {
	var locale = OSApp.Utils.getNumberLocale(),
		formatOptions = $.extend( { useGrouping: false }, options || {} ),
		number;

	if ( typeof value === "undefined" || value === null || value === "" ) {
		return "";
	}

	number = typeof value === "number" ? value : Number( value );
	if ( isNaN( number ) ) {
		return "";
	}

	return new Intl.NumberFormat( locale, formatOptions ).format( number );
};

OSApp.Utils.parseNumber = function( value ) {
	var locale = OSApp.Utils.getNumberLocale(),
		decimalSeparator = ( locale === "de" || locale === "fr" || locale === "es" || locale === "it" || locale === "nl" || locale === "pt" || locale === "pl" || locale === "cs" || locale === "sk" || locale === "sv" || locale === "ru" || locale === "tr" || locale === "sl" || locale === "hr" || locale === "ro" || locale === "hu" || locale === "fi" || locale === "no" ) ? "," : ".",
		otherSeparator = decimalSeparator === "," ? "." : ",",
		normalized,
		sanitized;

	if ( value === null || typeof value === "undefined" ) {
		return NaN;
	}

	if ( typeof value === "number" ) {
		return value;
	}

	normalized = String( value ).trim().replace( /\s/g, "" );
	if ( normalized === "" ) {
		return NaN;
	}

	var hasDecimal = normalized.lastIndexOf( decimalSeparator ) > -1,
		hasOther = normalized.lastIndexOf( otherSeparator ) > -1;

	if ( hasDecimal && hasOther ) {
		if ( normalized.lastIndexOf( decimalSeparator ) > normalized.lastIndexOf( otherSeparator ) ) {
			normalized = normalized.replace( new RegExp( "\\" + otherSeparator, "g" ), "" );
			normalized = normalized.replace( decimalSeparator, "." );
		} else {
			normalized = normalized.replace( new RegExp( "\\" + decimalSeparator, "g" ), "" );
			normalized = normalized.replace( otherSeparator, "." );
		}
	} else if ( hasDecimal ) {
		normalized = normalized.replace( new RegExp( "\\" + decimalSeparator, "g" ), "." );
	} else if ( hasOther ) {
		normalized = normalized.replace( new RegExp( "\\" + otherSeparator, "g" ), "" );
	}

	sanitized = normalized.replace( /[^0-9\-+.]/g, "" );
	if ( sanitized === "" || sanitized === "-" || sanitized === "+" ) {
		return NaN;
	}

	return parseFloat( sanitized );
};

OSApp.Utils.isValidOTC = function( token ) {
	return /^OT[a-f0-9]{30}$/i.test( token );
};

// OTC config token format: must start with "OT" followed by at least 30
// alphanumeric chars (32+ total). Both OpenThings.io and OpenSprinklerShop.de
// now issue "OT"-prefixed tokens. Firmware accepts length >= 32.
OSApp.Utils.isOtcTokenFormat = function( token ) {
	return /^OT[A-Za-z0-9]{30,}$/.test( token );
};

// Default OTC (OpenThings Cloud) server used when a site/token has none configured.
OSApp.Utils.DEFAULT_OTC_SERVER = "ws.cloud.openthings.io";
OSApp.Utils.DEFAULT_OTC_PORT = 80;

OSApp.Utils.getOtcServersList = function() {
	var defaultServers = [
		{ name: "USA (OpenThings.io)", server: "ws.cloud.openthings.io", port: 80, account: "https://opensprinkler.com/my-account", tokenUrl: "https://openthings.io/my-account/" },
		{ name: "Germany (OpenSprinklerShop.de)", server: "io.opensprinklershop.de", port: 443, account: "https://opensprinklershop.de/my-account", tokenUrl: "https://opensprinklershop.de/my-account" }
	];
	var customStr = OSApp.Storage.getItemSync("otc_custom_servers");
	var custom = [];
	if (customStr) {
		try {
			custom = JSON.parse(customStr);
		} catch(err) { void err; }
	}
	return {
		defaults: defaultServers,
		custom: custom,
		all: defaultServers.concat(custom)
	};
};

OSApp.Utils.saveOtcServersList = function(customList) {
	OSApp.Storage.set({"otc_custom_servers": JSON.stringify(customList)});
};

// Derive the OTC websocket port for a server. ESP8266 always uses 80. For
// OpenSprinklerShop.de, TLS/443 requires the OTC SSL support added in firmware
// 2.4.0.227; older firmware can only use plain ws on port 80. Everything else 80.
OSApp.Utils.deriveOtcPort = function(server) {
	var host = String(server || "").toLowerCase();
	if (OSApp.Firmware && typeof OSApp.Firmware.isESP8266Controller === "function" && OSApp.Firmware.isESP8266Controller()) {
		return 80;
	}
	if (host.indexOf("opensprinklershop.de") !== -1) {
		var fwv = (OSApp.Firmware && typeof OSApp.Firmware.getControllerFwvNumber === "function") ? OSApp.Firmware.getControllerFwvNumber() : 0;
		var fwm = (OSApp.Firmware && typeof OSApp.Firmware.getControllerOptions === "function") ? (OSApp.Firmware.getControllerOptions().fwm || 0) : 0;
		if (fwv > 240 || (fwv === 240 && fwm >= 227)) {
			return 443;
		}
		return 80;
	}
	return 80;
};

OSApp.Utils.buildOtcServerSelectHtml = function(id, selectedServer, selectedPort, options) {
	options = options || {};
	var servers = OSApp.Utils.getOtcServersList();
	var html = "<select name='" + id + "' id='" + id + "'>";

	var addOption = function(srv, idx, isCustom) {
		var val = isCustom ? "custom_" + idx : "default_" + idx;
		var isSelected = false;
		if (selectedServer) {
			if (selectedServer === srv.server) {
				isSelected = true;
			}
		} else if (!isCustom && idx === 0) {
			isSelected = true;
		}

		html += "<option value='" + val + "' data-server='" + OSApp.Utils.htmlEscape(srv.server) + "' data-port='" + (srv.port || "") + "' data-account='" + OSApp.Utils.htmlEscape(srv.account || "") + "' data-token='" + OSApp.Utils.htmlEscape(srv.tokenUrl || "") + "'" + (isSelected ? " selected='selected'" : "") + ">" + OSApp.Utils.htmlEscape(srv.name) + "</option>";
	};
	void selectedPort;

	servers.defaults.forEach(function(s, i) { addOption(s, i, false); });
	servers.custom.forEach(function(s, i) { addOption(s, i, true); });

	if (!options.noEdit) {
		html += "<option value='edit_list'>" + OSApp.Language._( "Edit Server List..." ) + "</option>";
	}
	html += "</select>";
	return html;
};

OSApp.Utils.showOtcServerManager = function(onCloseCallback) {
	$( "#otc-server-manager-popup" ).popup( "destroy" ).remove();

	var servers = OSApp.Utils.getOtcServersList();

	var popup = $( "<div data-role='popup' id='otc-server-manager-popup' data-theme='a' data-overlay-theme='b' class='modal'>" +
		"<div data-role='header' data-theme='b'>" +
			"<h1>" + OSApp.Language._( "Manage OTC Servers" ) + "</h1>" +
		"</div>" +
		"<div class='ui-content'>" +
			"<ul data-role='listview' id='otc_custom_server_list' data-inset='true'>" +
			"</ul>" +
			"<form id='otc_add_custom_server_form' style='margin-top: 15px; border-top: 1px solid #ccc; padding-top: 15px;'>" +
				"<h4>" + OSApp.Language._("Add Custom Server") + "</h4>" +
				"<input type='text' id='new_server_name' placeholder='" + OSApp.Language._("Name") + "' required>" +
				"<input type='text' id='new_server_host' placeholder='" + OSApp.Language._("Server host (e.g. ws.example.com)") + "' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false' required>" +
				"<input type='submit' data-theme='b' value='" + OSApp.Language._("Add") + "'>" +
			"</form>" +
			"<a href='#' class='ui-btn ui-corner-all ui-btn-a' id='otc_server_manager_close'>" + OSApp.Language._( "Close" ) + "</a>" +
		"</div>" +
	"</div>" );

	var renderList = function() {
		var ul = popup.find("#otc_custom_server_list");
		ul.empty();
		servers.custom.forEach(function(s, idx) {
			var li = $("<li>" + OSApp.Utils.htmlEscape(s.name) + "<br><span style='font-size:0.8em;font-weight:normal;color:#666;'>" + OSApp.Utils.htmlEscape(s.server) + "</span><a href='#' data-idx='" + idx + "' class='delete-custom-server ui-btn ui-btn-icon-notext ui-icon-delete' title='Delete'>Delete</a></li>");
			ul.append(li);
		});
		if (servers.custom.length === 0) {
			ul.append("<li><span style='font-weight:normal;color:#666;'>" + OSApp.Language._("No custom servers defined.") + "</span></li>");
		}
		try { ul.listview("refresh"); } catch(err) { void err; }
	};

	popup.find("#otc_add_custom_server_form").on("submit", function(e) {
		e.preventDefault();
		var n = popup.find("#new_server_name").val().trim();
		var h = popup.find("#new_server_host").val().trim();
		if (n && h) {
			servers.custom.push({name: n, server: h});
			OSApp.Utils.saveOtcServersList(servers.custom);
			popup.find("#new_server_name").val("");
			popup.find("#new_server_host").val("");
			renderList();
		}
	});

	popup.on("click", ".delete-custom-server", function(e) {
		e.preventDefault();
		var idx = parseInt($(this).data("idx"), 10);
		servers.custom.splice(idx, 1);
		OSApp.Utils.saveOtcServersList(servers.custom);
		renderList();
	});

	popup.find("#otc_server_manager_close").on("click", function(e) {
		e.preventDefault();
		popup.popup("close");
	});

	popup.one("popupafterclose", function() {
		$(this).popup("destroy").remove();
		if (typeof onCloseCallback === "function") onCloseCallback();
	}).popup({
		history: false,
		positionTo: "window"
	}).enhanceWithin();

	renderList();
	popup.popup("open");
};

OSApp.Utils.getSyncServersList = function() {
	var defaultServers = [
		{ name: "OpenSprinklerShop.de", server: "opensprinklershop.de", register: "https://opensprinklershop.de/my-account/" },
		{ name: "OpenSprinkler.com", server: "opensprinkler.com", register: "https://opensprinkler.com/my-account/" }
	];
	var customStr = OSApp.Storage.getItemSync("sync_custom_servers");
	var custom = [];
	if (customStr) {
		try {
			custom = JSON.parse(customStr);
		} catch(err) { void err; }
	}
	return {
		defaults: defaultServers,
		custom: custom,
		all: defaultServers.concat(custom)
	};
};

OSApp.Utils.saveSyncServersList = function(customList) {
	OSApp.Storage.set({"sync_custom_servers": JSON.stringify(customList)});
};

OSApp.Utils.buildSyncServerSelectHtml = function(id, selectedServer) {
	var servers = OSApp.Utils.getSyncServersList();
	var html = "<select name='" + id + "' id='" + id + "'>";
	var foundMatch = false;

	var addOption = function(srv, idx, isCustom) {
		var val = isCustom ? "custom_" + idx : "default_" + idx;
		var isSelected = false;
		if (selectedServer) {
			if (selectedServer === srv.server) {
				isSelected = true;
				foundMatch = true;
			}
		} else if (!isCustom && idx === 0) {
			isSelected = true;
			foundMatch = true;
		}

		html += "<option value='" + val + "' data-server='" + OSApp.Utils.htmlEscape(srv.server) + "' data-register='" + OSApp.Utils.htmlEscape(srv.register || "") + "'" + (isSelected ? " selected='selected'" : "") + ">" + OSApp.Utils.htmlEscape(srv.name) + "</option>";
	};

	servers.defaults.forEach(function(s, i) { addOption(s, i, false); });
	servers.custom.forEach(function(s, i) { addOption(s, i, true); });

	html += "<option value='custom'" + (!foundMatch && selectedServer ? " selected='selected'" : "") + ">" + OSApp.Language._( "Custom server" ) + "</option>";
	html += "<option value='edit_list'>" + OSApp.Language._( "Edit Server List..." ) + "</option>";
	html += "</select>";
	return html;
};

OSApp.Utils.showSyncServerManager = function(onCloseCallback) {
	$( "#sync-server-manager-popup" ).popup( "destroy" ).remove();

	var servers = OSApp.Utils.getSyncServersList();

	var popup = $( "<div data-role='popup' id='sync-server-manager-popup' data-theme='a' data-overlay-theme='b' class='modal'>" +
		"<div data-role='header' data-theme='b'>" +
			"<h1>" + OSApp.Language._( "Manage Sync Servers" ) + "</h1>" +
		"</div>" +
		"<div class='ui-content'>" +
			"<ul data-role='listview' id='sync_custom_server_list' data-inset='true'>" +
			"</ul>" +
			"<form id='sync_add_custom_server_form' style='margin-top: 15px; border-top: 1px solid #ccc; padding-top: 15px;'>" +
				"<h4>" + OSApp.Language._("Add Custom Server") + "</h4>" +
				"<input type='text' id='new_sync_server_name' placeholder='" + OSApp.Language._("Name") + "' required>" +
				"<input type='text' id='new_sync_server_host' placeholder='" + OSApp.Language._("Server host (e.g. example.com)") + "' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false' required>" +
				"<input type='url' id='new_sync_server_register' placeholder='" + OSApp.Language._("Registration URL (optional)") + "' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false'>" +
				"<input type='submit' data-theme='b' value='" + OSApp.Language._("Add") + "'>" +
			"</form>" +
			"<a href='#' class='ui-btn ui-corner-all ui-btn-a' id='sync_server_manager_close'>" + OSApp.Language._( "Close" ) + "</a>" +
		"</div>" +
	"</div>" );

	var renderList = function() {
		var ul = popup.find("#sync_custom_server_list");
		ul.empty();
		servers.custom.forEach(function(s, idx) {
			var li = $("<li>" + OSApp.Utils.htmlEscape(s.name) + "<br><span style='font-size:0.8em;font-weight:normal;color:#666;'>" + OSApp.Utils.htmlEscape(s.server) + "</span><a href='#' data-idx='" + idx + "' class='delete-custom-sync-server ui-btn ui-btn-icon-notext ui-icon-delete' title='Delete'>Delete</a></li>");
			ul.append(li);
		});
		if (servers.custom.length === 0) {
			ul.append("<li><span style='font-weight:normal;color:#666;'>" + OSApp.Language._("No custom servers defined.") + "</span></li>");
		}
		try { ul.listview("refresh"); } catch(err) { void err; }
	};

	popup.find("#sync_add_custom_server_form").on("submit", function(e) {
		e.preventDefault();
		var n = popup.find("#new_sync_server_name").val().trim();
		var h = popup.find("#new_sync_server_host").val().trim();
		var r = popup.find("#new_sync_server_register").val().trim();
		if (n && h) {
			servers.custom.push({name: n, server: h, register: r});
			OSApp.Utils.saveSyncServersList(servers.custom);
			popup.find("#new_sync_server_name").val("");
			popup.find("#new_sync_server_host").val("");
			popup.find("#new_sync_server_register").val("");
			renderList();
		}
	});

	popup.on("click", ".delete-custom-sync-server", function(e) {
		e.preventDefault();
		var idx = parseInt($(this).data("idx"), 10);
		servers.custom.splice(idx, 1);
		OSApp.Utils.saveSyncServersList(servers.custom);
		renderList();
	});

	popup.find("#sync_server_manager_close").on("click", function(e) {
		e.preventDefault();
		popup.popup("close");
	});

	popup.one("popupafterclose", function() {
		$(this).popup("destroy").remove();
		if (typeof onCloseCallback === "function") onCloseCallback();
	}).popup({
		history: false,
		positionTo: "window"
	}).enhanceWithin();

	renderList();
	popup.popup("open");
};

// Build the HTTPS forward base URL (".../forward/v1/<token>") for an OTC token.
// The stored server is the WebSocket host (e.g. "ws.cloud.openthings.io" or
// "io.opensprinklershop.de"); the HTTPS forward host is derived by stripping a
// leading "ws." label. Verified: ws.cloud.openthings.io -> cloud.openthings.io,
// io.opensprinklershop.de stays identical.
OSApp.Utils.otcForwardBase = function( token, server ) {
	var host = String( server || OSApp.Utils.DEFAULT_OTC_SERVER ).trim();

	// Strip protocol/path if a full URL was accidentally provided.
	host = host.replace( /^wss?:\/\//i, "" ).replace( /^https?:\/\//i, "" ).replace( /\/.*$/, "" );

	// Strip an explicit :port suffix (forward always uses HTTPS/443).
	host = host.replace( /:\d+$/, "" );

	// WebSocket subdomain -> HTTPS forward host.
	host = host.replace( /^ws\./i, "" );

	if ( !host ) {
		host = "cloud.openthings.io";
	}

	return "https://" + host + "/forward/v1/" + token;
};

OSApp.Utils.getFlowPrecision = function() {
	if ( !OSApp.currentSession || !OSApp.currentSession.controller || !OSApp.currentSession.controller.options ) {
		return 2;
	}
	var divisor = ( OSApp.currentSession.controller.options.fpd1 !== undefined && OSApp.currentSession.controller.options.fpd0 !== undefined ) ?
		( ( OSApp.currentSession.controller.options.fpd1 << 8 ) + OSApp.currentSession.controller.options.fpd0 ) : 1;
	if ( !divisor ) { divisor = 1; }
	var vol_per_pulse = ( ( OSApp.currentSession.controller.options.fpr1 << 8 ) + OSApp.currentSession.controller.options.fpr0 ) / ( 100 * divisor );
	if ( vol_per_pulse < 0.001 ) {
		return 5;
	} else if ( vol_per_pulse < 0.01 ) {
		return 4;
	} else if ( vol_per_pulse < 0.1 ) {
		return 3;
	}
	return 2;
};

OSApp.Utils.flowCountToVolume = function( count ) {
	var divisor = ( OSApp.currentSession.controller.options.fpd1 !== undefined && OSApp.currentSession.controller.options.fpd0 !== undefined ) ?
		( ( OSApp.currentSession.controller.options.fpd1 << 8 ) + OSApp.currentSession.controller.options.fpd0 ) : 1;
	if ( !divisor ) { divisor = 1; }
	var vol = count * ( ( OSApp.currentSession.controller.options.fpr1 << 8 ) + OSApp.currentSession.controller.options.fpr0 ) / ( 100 * divisor );
	return parseFloat( vol.toFixed( OSApp.Utils.getFlowPrecision() ) );
};

// Convert flow rate (sensor pulses per minute) to volume per minute
OSApp.Utils.flowRateToVolume = function( rate ) {
	var divisor = ( OSApp.currentSession.controller.options.fpd1 !== undefined && OSApp.currentSession.controller.options.fpd0 !== undefined ) ?
		( ( OSApp.currentSession.controller.options.fpd1 << 8 ) + OSApp.currentSession.controller.options.fpd0 ) : 1;
	if ( !divisor ) { divisor = 1; }
	var vol = rate * ( ( OSApp.currentSession.controller.options.fpr1 << 8 ) + OSApp.currentSession.controller.options.fpr0 ) / ( 100 * divisor );
	return parseFloat( vol.toFixed( OSApp.Utils.getFlowPrecision() ) );
};

/*
Returns true when currentSession.controller.settings is populated
*/
OSApp.Utils.isSessionValid = function() {
	return !$.isEmptyObject(OSApp.currentSession?.controller?.settings || {});
};
