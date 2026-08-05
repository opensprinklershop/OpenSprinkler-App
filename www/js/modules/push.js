/* global $ */

/* OpenSprinkler App - Push registration
 *
 * Registers the device's FCM token with the external OpenSprinkler Push
 * Forwarder (WordPress plugin) so real push notifications can be delivered even
 * when the app is closed or after a device reboot. This is the client side of
 * "Native Notifications = Always".
 *
 * Design notes:
 * - Feature-detects an FCM cordova plugin at runtime (firebasex or havesource
 *   push). Without a plugin (e.g. browser, or a build without FCM) every call
 *   gracefully no-ops so existing builds keep working.
 * - Registration requires an OTC site (currentSession.token) because the
 *   forwarder polls the device through OTC forwarding.
 * - Endpoint + API key are configuration, resolved from localStorage overrides
 *   so they can be provisioned without a rebuild.
 */

var OSApp = OSApp || {};
OSApp.Push = OSApp.Push || {};

OSApp.Push._registeredToken = null;

// Default forwarder endpoint used when the user has not set a custom one.
OSApp.Push.DEFAULT_BASE_URL = "https://opensprinklershop.de/wp-json/ospf/v1";

// Resolve the forwarder base URL, e.g. "https://example.com/wp-json/ospf/v1".
// Unset (null) falls back to the default; an explicitly stored empty string
// means the user disabled server push.
OSApp.Push.getBaseUrl = function() {
	try {
		var v = localStorage.getItem( "OSApp.Push.baseUrl" );
		if ( v === null ) {
			return OSApp.Push.DEFAULT_BASE_URL;
		}
		if ( typeof v === "string" && v !== "" ) {
			return v.replace( /\/+$/, "" );
		}
	} catch ( e ) { void e; }
	return "";
};

// Resolve the forwarder API key (X-OSPF-Key). Only needed for the legacy
// admin endpoints; the app uses the keyless /subscribe path by default.
OSApp.Push.getApiKey = function() {
	try {
		var v = localStorage.getItem( "OSApp.Push.apiKey" );
		if ( typeof v === "string" && v !== "" ) {
			return v;
		}
	} catch ( e ) { void e; }
	return "";
};

// Provision endpoint (+ optional key) at runtime, e.g. from a settings field.
OSApp.Push.configure = function( baseUrl, apiKey ) {
	try {
		if ( typeof baseUrl === "string" ) {
			localStorage.setItem( "OSApp.Push.baseUrl", baseUrl.replace( /\/+$/, "" ) );
		}
		if ( typeof apiKey === "string" ) {
			localStorage.setItem( "OSApp.Push.apiKey", apiKey );
		}
	} catch ( e ) { void e; }
	OSApp.Push.syncPushRegistration();
};

// The keyless subscribe path only needs the endpoint URL.
OSApp.Push.isConfigured = function() {
	return OSApp.Push.getBaseUrl() !== "";
};

// A stable per-install identifier so re-registrations update the same row.
OSApp.Push.getUserKey = function() {
	var key = null;
	try {
		key = localStorage.getItem( "OSApp.Push.userKey" );
	} catch ( e ) { void e; }
	if ( key && typeof key === "string" ) {
		return key;
	}
	key = "u-" + Date.now().toString( 36 ) + "-" + Math.random().toString( 36 ).slice( 2, 10 );
	try {
		localStorage.setItem( "OSApp.Push.userKey", key );
	} catch ( e ) { void e; }
	return key;
};

OSApp.Push.getPlatform = function() {
	if ( OSApp.currentDevice && OSApp.currentDevice.isiOS ) {
		return "ios";
	}
	return "android";
};

// Adapter over the two common cordova FCM plugins.
OSApp.Push.getFcmToken = function( callback ) {
	callback = callback || function() {};

	// cordova-plugin-firebasex
	if ( window.FirebasePlugin && typeof window.FirebasePlugin.getToken === "function" ) {
		var proceed = function() {
			window.FirebasePlugin.getToken( function( token ) {
				callback( token || null );
			}, function() {
				callback( null );
			} );
		};
		// iOS needs an explicit permission grant before a token is issued.
		if ( OSApp.Push.getPlatform() === "ios" && typeof window.FirebasePlugin.grantPermission === "function" ) {
			window.FirebasePlugin.grantPermission( function() { proceed(); }, function() { proceed(); } );
		} else {
			proceed();
		}
		// Keep the forwarder in sync when the token is rotated by FCM.
		if ( typeof window.FirebasePlugin.onTokenRefresh === "function" && !OSApp.Push._refreshHooked ) {
			OSApp.Push._refreshHooked = true;
			window.FirebasePlugin.onTokenRefresh( function( token ) {
				if ( token ) {
					OSApp.Push._registeredToken = null;
					OSApp.Push.syncPushRegistration();
				}
			}, function() {} );
		}
		return;
	}

	// @havesource/cordova-plugin-push (or phonegap-plugin-push)
	if ( typeof window.PushNotification === "object" && typeof window.PushNotification.init === "function" ) {
		if ( !OSApp.Push._pushInstance ) {
			OSApp.Push._pushInstance = window.PushNotification.init( {
				android: {},
				ios: { alert: true, badge: true, sound: true }
			} );
			OSApp.Push._pushInstance.on( "registration", function( data ) {
				callback( ( data && data.registrationId ) || null );
			} );
			OSApp.Push._pushInstance.on( "error", function() {
				callback( null );
			} );
		}
		return;
	}

	callback( null );
};

OSApp.Push.isFcmAvailable = function() {
	return !!( ( window.FirebasePlugin && typeof window.FirebasePlugin.getToken === "function" ) ||
		( typeof window.PushNotification === "object" && typeof window.PushNotification.init === "function" ) );
};

OSApp.Push._request = function( method, path, body ) {
	var base = OSApp.Push.getBaseUrl();
	if ( base === "" ) {
		return $.Deferred().reject( { reason: "not_configured" } ).promise();
	}
	var headers = {};
	// The keyless /subscribe path needs no key; admin paths still accept one.
	var apiKey = OSApp.Push.getApiKey();
	if ( apiKey !== "" ) {
		headers[ "X-OSPF-Key" ] = apiKey;
	}
	return $.ajax( {
		url: base + path,
		method: method,
		contentType: "application/json",
		dataType: "json",
		timeout: 20000,
		headers: headers,
		data: body ? JSON.stringify( body ) : undefined
	} );
};

// Register the FCM token as a subscriber for the current OTC device using the
// keyless /subscribe endpoint (ownership proven by OTC token + password hash).
OSApp.Push.registerForPush = function() {
	if ( !OSApp.currentDevice || ( !OSApp.currentDevice.isAndroid && !OSApp.currentDevice.isiOS ) ) {
		return;
	}
	if ( !OSApp.Push.isConfigured() || !OSApp.Push.isFcmAvailable() ) {
		return;
	}
	var otcToken = OSApp.currentSession && OSApp.currentSession.token;
	var pw = OSApp.currentSession && OSApp.currentSession.pass;
	if ( !otcToken || !pw ) {
		return; // Only OTC sites can be reached by the forwarder.
	}

	var label = "OpenSprinkler";
	if ( OSApp.currentSession.controller && OSApp.currentSession.controller.settings &&
		typeof OSApp.currentSession.controller.settings.dname === "string" &&
		OSApp.currentSession.controller.settings.dname !== "" ) {
		label = OSApp.currentSession.controller.settings.dname;
	}

	OSApp.Push.getFcmToken( function( fcmToken ) {
		if ( !fcmToken ) {
			return;
		}
		if ( OSApp.Push._registeredToken === fcmToken ) {
			return; // Already registered this token for this session.
		}
		OSApp.Push._request( "POST", "/subscribe", {
			otc_token: otcToken,
			pw_hash: pw,
			user_key: OSApp.Push.getUserKey(),
			platform: OSApp.Push.getPlatform(),
			fcm_token: fcmToken,
			label: label
		} ).then( function() {
			OSApp.Push._registeredToken = fcmToken;
		}, function() {
			OSApp.Push._registeredToken = null;
		} );
	} );
};

// Remove the current FCM token subscription (used when mode is set to Off).
OSApp.Push.unregisterFromPush = function() {
	if ( !OSApp.Push.isConfigured() ) {
		return;
	}
	var otcToken = OSApp.currentSession && OSApp.currentSession.token;
	if ( !otcToken ) {
		return;
	}
	OSApp.Push.getFcmToken( function( fcmToken ) {
		if ( !fcmToken ) {
			return;
		}
		OSApp.Push._request( "DELETE", "/subscribe", {
			otc_token: otcToken,
			fcm_token: fcmToken
		} ).always( function() {
			OSApp.Push._registeredToken = null;
		} );
	} );
};

// Reconcile registration state with the current push notification mode.
OSApp.Push.syncPushRegistration = function() {
	if ( !OSApp.Analog || typeof OSApp.Analog.getPushNotificationMode !== "function" ) {
		return;
	}
	var mode = OSApp.Analog.getPushNotificationMode();
	if ( mode === OSApp.Analog.Constants.PUSH_MODE_ALWAYS ) {
		OSApp.Push.registerForPush();
	} else {
		OSApp.Push.unregisterFromPush();
	}
};

OSApp.Push.init = function() {
	OSApp.Push.syncPushRegistration();
};
