/* global $ */

/*
 * Universal, forward-compatible device-side config store.
 *
 * Persists arbitrary UI/HTTP preferences on the controller as a single JSON
 * object (firmware endpoints /ap = get, /au = merge/update). Because the store
 * is schema-less, new settings (24h clock, AI off, hidden panels, sort order,
 * …) can be added without any firmware change.
 *
 * Values are cached in memory after the first load so callers can read
 * synchronously via getCached() once loaded.
 */

var OSApp = OSApp || {};
OSApp.DeviceConfig = OSApp.DeviceConfig || {};

OSApp.DeviceConfig._cache = null;

// Minimum firmware build that ships the /ap and /au endpoints.
OSApp.DeviceConfig.MIN_FW_MINOR = 224;

OSApp.DeviceConfig.isSupported = function() {
	// A 4-digit check encodes fwv*10+fwm, so this gates on 2.4.0 build >= 224
	// (the first firmware that ships the /ap and /au endpoints).
	return typeof OSApp.Firmware.checkOSVersion !== "function" ||
		OSApp.Firmware.checkOSVersion( 2400 + OSApp.DeviceConfig.MIN_FW_MINOR );
};

// Load the whole store from the device. Resolves with the config object.
OSApp.DeviceConfig.load = function() {
	return OSApp.Firmware.sendToOS( "/ap?pw=", "json" ).then( function( data ) {
		OSApp.DeviceConfig._cache = ( data && typeof data === "object" && !Array.isArray( data ) ) ? data : {};
		return OSApp.DeviceConfig._cache;
	}, function() {
		OSApp.DeviceConfig._cache = OSApp.DeviceConfig._cache || {};
		return OSApp.DeviceConfig._cache;
	} );
};

// Return the in-memory cache (may be null if never loaded).
OSApp.DeviceConfig.getCached = function() {
	return OSApp.DeviceConfig._cache;
};

// Read a single key. Falls back to the provided default when missing.
OSApp.DeviceConfig.get = function( key, fallback ) {
	var cache = OSApp.DeviceConfig._cache;
	if ( cache && Object.prototype.hasOwnProperty.call( cache, key ) ) {
		return cache[ key ];
	}
	return fallback;
};

// Merge a partial object into the device store. A key with a null value is
// removed on the device. Updates the local cache on success.
OSApp.DeviceConfig.merge = function( partial ) {
	if ( !partial || typeof partial !== "object" ) {
		return $.Deferred().reject( "invalid config object" ).promise();
	}

	var json = encodeURIComponent( JSON.stringify( partial ) );
	return OSApp.Firmware.sendToOS( "/au?pw=&json=" + json, "json" ).then( function( info ) {
		var result = info && info.result;
		if ( result !== undefined && result !== null && parseInt( result, 10 ) > 1 ) {
			return $.Deferred().reject( info ).promise();
		}
		// Reflect the change locally without a round-trip.
		OSApp.DeviceConfig._cache = OSApp.DeviceConfig._cache || {};
		Object.keys( partial ).forEach( function( k ) {
			if ( partial[ k ] === null ) {
				delete OSApp.DeviceConfig._cache[ k ];
			} else {
				OSApp.DeviceConfig._cache[ k ] = partial[ k ];
			}
		} );
		return OSApp.DeviceConfig._cache;
	} );
};

// Convenience: set a single key.
OSApp.DeviceConfig.set = function( key, value ) {
	var obj = {};
	obj[ key ] = value;
	return OSApp.DeviceConfig.merge( obj );
};

// Convenience: remove a single key.
OSApp.DeviceConfig.remove = function( key ) {
	return OSApp.DeviceConfig.set( key, null );
};

// Clear the whole store on the device.
OSApp.DeviceConfig.reset = function() {
	return OSApp.Firmware.sendToOS( "/au?pw=&reset=1", "json" ).then( function() {
		OSApp.DeviceConfig._cache = {};
		return OSApp.DeviceConfig._cache;
	} );
};

// ---------------------------------------------------------------------------
// App settings bridge
//
// Maps well-known app/UI preferences that used to live only in localStorage
// onto the shared device store so they persist device-wide and are available
// through the plain HTTP interface too. The device is the source of truth;
// localStorage stays as a fast local cache. Missing device keys are migrated
// from the local value once.
// ---------------------------------------------------------------------------
OSApp.DeviceConfig.APP_SETTINGS = {
	is24Hour: {
		toLocal: function( v ) {
			OSApp.uiState.is24Hour = ( v === true || v === 1 || v === "1" || v === "true" );
			if ( OSApp.Storage && OSApp.Storage.set ) {
				OSApp.Storage.set( { is24Hour: OSApp.uiState.is24Hour } );
			}
		},
		fromLocal: function() {
			return !!OSApp.uiState.is24Hour;
		}
	},
	osai_enabled: {
		toLocal: function( v ) {
			var on = !( v === 0 || v === "0" || v === false );
			localStorage.setItem( "osai_enabled", on ? "1" : "0" );
			if ( OSApp.AIAssistant ) {
				if ( OSApp.AIAssistant.applyMenuVisibility ) { OSApp.AIAssistant.applyMenuVisibility(); }
				if ( OSApp.AIAssistant.applyFabVisibility ) { OSApp.AIAssistant.applyFabVisibility(); }
			}
		},
		fromLocal: function() {
			return localStorage.getItem( "osai_enabled" ) === "0" ? 0 : 1;
		}
	},
	displayOption: {
		toLocal: function( v ) {
			localStorage.setItem( "displayOption", v );
		},
		fromLocal: function() {
			return Object.prototype.hasOwnProperty.call( localStorage, "displayOption" ) ?
				localStorage.getItem( "displayOption" ) : undefined;
		}
	},
	chartOptions: {
		toLocal: function( v ) {
			try {
				localStorage.setItem( "OSApp.Analog.chartOptions", typeof v === "string" ? v : JSON.stringify( v ) );
			} catch ( e ) { void e; }
			if ( OSApp.Analog && OSApp.Analog.syncChartOptionsFromController ) {
				OSApp.Analog.syncChartOptionsFromController();
			}
		},
		fromLocal: function() {
			var s = localStorage.getItem( "OSApp.Analog.chartOptions" );
			if ( s === null ) { return undefined; }
			try { return JSON.parse( s ); } catch ( e ) { void e; return undefined; }
		}
	},
	pushMode: {
		toLocal: function( v ) {
			var n = parseInt( v, 10 );
			if ( isNaN( n ) ) { return; }
			try {
				localStorage.setItem( "OSApp.Analog.pushNotificationMode", String( n ) );
			} catch ( e ) { void e; }
		},
		fromLocal: function() {
			var s = localStorage.getItem( "OSApp.Analog.pushNotificationMode" );
			if ( s === null ) { return undefined; }
			var n = parseInt( s, 10 );
			return isNaN( n ) ? undefined : n;
		}
	}
};

// Apply a single known setting coming from the device to the local state.
OSApp.DeviceConfig.applySetting = function( key, value ) {
	var def = OSApp.DeviceConfig.APP_SETTINGS[ key ];
	if ( def && typeof def.toLocal === "function" ) {
		def.toLocal( value );
	}
};

// Persist a known app setting to the device (best-effort) and update the cache.
OSApp.DeviceConfig.saveSetting = function( key, value ) {
	if ( !OSApp.DeviceConfig.APP_SETTINGS[ key ] ) {
		return $.Deferred().reject( "unknown setting" ).promise();
	}
	return OSApp.DeviceConfig.set( key, value );
};

// One-shot per session: load the device store, push known local settings onto
// the local state, and migrate any locally-set values the device does not have
// yet. Safe to call when disconnected (it just resolves without applying).
OSApp.DeviceConfig._synced = false;
OSApp.DeviceConfig.syncAppSettings = function( force ) {
	if ( OSApp.DeviceConfig._synced && !force ) {
		return $.Deferred().resolve( OSApp.DeviceConfig._cache || {} ).promise();
	}
	OSApp.DeviceConfig._synced = true;

	return OSApp.DeviceConfig.load().then( function( cfg ) {
		var toPush = {};
		Object.keys( OSApp.DeviceConfig.APP_SETTINGS ).forEach( function( key ) {
			if ( Object.prototype.hasOwnProperty.call( cfg, key ) ) {
				OSApp.DeviceConfig.applySetting( key, cfg[ key ] );
			} else {
				var local = OSApp.DeviceConfig.APP_SETTINGS[ key ].fromLocal();
				if ( local !== undefined && local !== null ) {
					toPush[ key ] = local;
				}
			}
		} );
		if ( Object.keys( toPush ).length ) {
			OSApp.DeviceConfig.merge( toPush );
		}
		return cfg;
	} );
};
