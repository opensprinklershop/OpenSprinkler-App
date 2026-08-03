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
