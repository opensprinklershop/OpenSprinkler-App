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
 * - Registration uses the controller MAC (device_key) + password hash. The
 *   firmware itself pushes events to the forwarder, so no cloud/OTC is needed.
 * - Endpoint + API key are configuration, resolved from localStorage overrides
 *   so they can be provisioned without a rebuild.
 */

var OSApp = OSApp || {};
OSApp.Push = OSApp.Push || {};

// Map of deviceKey -> fcmToken for which a /subscribe has succeeded this
// session. Keyed per device (not just per token) so connecting to a second
// device still registers it even though the FCM token is unchanged.
OSApp.Push._registeredKeys = {};

// Default forwarder endpoint used when the user has not set a custom one.
OSApp.Push.DEFAULT_BASE_URL = "https://opensprinklershop.de/wp-json/ospf/v1";

// WebPush (browser/PWA) via Firebase Cloud Messaging. These are public client
// values (as embedded in any web app). Requires HTTPS (or localhost).
OSApp.Push.FIREBASE_SDK_VERSION = "10.12.2";
OSApp.Push.FIREBASE_CONFIG = {
	apiKey: "AIzaSyA5IqYBDxcdnEWPwuos_g0YONrFaYZgW68",
	authDomain: "opensprinkler-notify.firebaseapp.com",
	projectId: "opensprinkler-notify",
	storageBucket: "opensprinkler-notify.firebasestorage.app",
	messagingSenderId: "558029754966",
	appId: "1:558029754966:web:b0c03a0b51df18f5b821f7"
};
OSApp.Push.VAPID_KEY = "BFPhjFO2dh3eo7svkbIlHbDgO1sf8ei6_KJ9iYe9o6YSkL-ZSmYYM0OGGHnUHawGOubWPqG3_tDPvA2Taguqc3s";

// WebPush is available in a plain browser/PWA (no Cordova) that supports the
// Service Worker + Push APIs. Delivery still requires HTTPS (localhost exempt).
OSApp.Push.isWeb = function() {
	return typeof window.cordova === "undefined" &&
		"serviceWorker" in navigator &&
		"PushManager" in window &&
		typeof window.Notification !== "undefined";
};

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
	if ( OSApp.Push.isWeb() ) {
		return "web";
	}
	return "android";
};

// Adapter over the two common cordova FCM plugins.
OSApp.Push.getFcmToken = function( callback ) {
	callback = callback || function() {};

	// cordova-plugin-firebasex-messaging (modular v2, global FirebasexMessaging)
	if ( window.FirebasexMessaging && typeof window.FirebasexMessaging.getToken === "function" ) {
		var fxProceed = function() {
			window.FirebasexMessaging.getToken( function( token ) {
				callback( token || null );
			}, function() {
				callback( null );
			} );
		};
		// Request notification permission first (Android 13+ POST_NOTIFICATIONS,
		// iOS system dialog). An error means it was already granted -> proceed.
		if ( typeof window.FirebasexMessaging.grantPermission === "function" ) {
			window.FirebasexMessaging.grantPermission( function() { fxProceed(); }, function() { fxProceed(); } );
		} else {
			fxProceed();
		}
		if ( typeof window.FirebasexMessaging.onTokenRefresh === "function" && !OSApp.Push._refreshHooked ) {
			OSApp.Push._refreshHooked = true;
			window.FirebasexMessaging.onTokenRefresh( function( token ) {
				if ( token ) {
					OSApp.Push._registeredKeys = {};
					OSApp.Push.syncPushRegistration();
				}
			}, function() {} );
		}
		return;
	}

	// cordova-plugin-firebasex (classic, global FirebasePlugin)
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
					OSApp.Push._registeredKeys = {};
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

	// Browser / PWA: Firebase Cloud Messaging WebPush.
	if ( OSApp.Push.isWeb() ) {
		OSApp.Push._getWebFcmToken( callback );
		return;
	}

	callback( null );
};

// Lazy-load the Firebase compat SDK, init the app and register the dedicated
// FCM service worker (own scope so it never clashes with the app's /sw.js).
OSApp.Push._ensureWebFcm = function( cb ) {
	if ( OSApp.Push._webMessaging ) {
		cb( OSApp.Push._webMessaging, OSApp.Push._webSwReg );
		return;
	}
	var V = OSApp.Push.FIREBASE_SDK_VERSION;
	var loadScript = function( src, next ) {
		var s = document.createElement( "script" );
		s.src = src;
		s.onload = next;
		s.onerror = function() { cb( null ); };
		document.head.appendChild( s );
	};
	var init = function() {
		try {
			if ( !window.firebase || !window.firebase.messaging ) { cb( null ); return; }
			if ( !OSApp.Push._webApp ) {
				OSApp.Push._webApp = window.firebase.initializeApp( OSApp.Push.FIREBASE_CONFIG );
			}
			navigator.serviceWorker.register( "/firebase-messaging-sw.js", { scope: "/firebase-cloud-messaging-push-scope" } )
				.then( function( reg ) {
					OSApp.Push._webSwReg = reg;
					OSApp.Push._webMessaging = window.firebase.messaging();
					try {
						OSApp.Push._webMessaging.onMessage( function( payload ) {
							OSApp.Push._showWebForeground( payload, reg );
						} );
					} catch ( e ) { void e; }
					cb( OSApp.Push._webMessaging, reg );
				} )
				.catch( function() { cb( null ); } );
		} catch ( e ) { void e; cb( null ); }
	};
	if ( window.firebase && window.firebase.messaging ) { init(); return; }
	loadScript( "https://www.gstatic.com/firebasejs/" + V + "/firebase-app-compat.js", function() {
		loadScript( "https://www.gstatic.com/firebasejs/" + V + "/firebase-messaging-compat.js", init );
	} );
};

// Request notification permission (user gesture recommended) and resolve a token.
OSApp.Push._getWebFcmToken = function( callback ) {
	OSApp.Push._ensureWebFcm( function( messaging, swReg ) {
		if ( !messaging ) { callback( null ); return; }
		var proceed = function() {
			if ( window.Notification.permission !== "granted" ) { callback( null ); return; }
			messaging.getToken( { vapidKey: OSApp.Push.VAPID_KEY, serviceWorkerRegistration: swReg } )
				.then( function( token ) { callback( token || null ); } )
				.catch( function() { callback( null ); } );
		};
		if ( window.Notification.permission === "granted" ) {
			proceed();
		} else {
			window.Notification.requestPermission().then( function() { proceed(); } ).catch( function() { callback( null ); } );
		}
	} );
};

// Show a notification for a foreground WebPush message (FCM does not auto-display
// while the tab is focused).
OSApp.Push._showWebForeground = function( payload, reg ) {
	try {
		var d = ( payload && payload.data ) || {};
		var n = ( payload && payload.notification ) || {};
		var title = n.title || d.notification_title || "OpenSprinkler";
		var body = n.body || d.event_text || d.notification_body || "";
		if ( reg && typeof reg.showNotification === "function" ) {
			reg.showNotification( title, { body: body, tag: d.event_id || undefined, data: d } );
		}
	} catch ( e ) { void e; }
};

OSApp.Push.isFcmAvailable = function() {
	return !!( ( window.FirebasexMessaging && typeof window.FirebasexMessaging.getToken === "function" ) ||
		( window.FirebasePlugin && typeof window.FirebasePlugin.getToken === "function" ) ||
		( typeof window.PushNotification === "object" && typeof window.PushNotification.init === "function" ) ||
		OSApp.Push.isWeb() );
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

// Register the FCM token as a subscriber for the current device using the
// keyless /subscribe endpoint. Ownership is proven by the controller MAC
// (device_key) + password hash; the firmware pushes events to the forwarder
// itself, so this works on the local network and without any cloud service.
OSApp.Push.registerForPush = function() {
	if ( !OSApp.currentDevice || ( !OSApp.currentDevice.isAndroid && !OSApp.currentDevice.isiOS && !OSApp.Push.isWeb() ) ) {
		return;
	}
	if ( !OSApp.Push.isConfigured() || !OSApp.Push.isFcmAvailable() ) {
		return;
	}
	var pw = OSApp.currentSession && OSApp.currentSession.pass;
	if ( !pw ) {
		return;
	}
	var deviceKey = OSApp.Push._deviceKey();
	if ( !deviceKey ) {
		return; // No controller MAC available yet.
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
		if ( OSApp.Push._registeredKeys[ deviceKey ] === fcmToken ) {
			return; // This device is already registered with this token this session.
		}
		OSApp.Push._request( "POST", "/subscribe", {
			device_key: deviceKey,
			pw_hash: pw,
			user_key: OSApp.Push.getUserKey(),
			platform: OSApp.Push.getPlatform(),
			fcm_token: fcmToken,
			label: label
		} ).then( function() {
			OSApp.Push._registeredKeys[ deviceKey ] = fcmToken;
		}, function() {
			delete OSApp.Push._registeredKeys[ deviceKey ];
		} );
	} );
};

// Resolve the controller MAC (device_key) as 12 uppercase hex chars, matching
// the firmware's device_key and the "mac" field in /jc.
OSApp.Push._deviceKey = function() {
	var mac = OSApp.currentSession && OSApp.currentSession.controller &&
		OSApp.currentSession.controller.settings && OSApp.currentSession.controller.settings.mac;
	if ( typeof mac === "string" ) {
		var key = mac.replace( /[^0-9A-Fa-f]/g, "" ).toUpperCase();
		if ( /^[0-9A-F]{12}$/.test( key ) ) {
			return key;
		}
	}
	return null;
};

// Remove the current FCM token subscription (used when mode is set to Off).
OSApp.Push.unregisterFromPush = function() {
	if ( !OSApp.Push.isConfigured() ) {
		return;
	}
	var deviceKey = OSApp.Push._deviceKey();
	if ( !deviceKey ) {
		return;
	}
	OSApp.Push.getFcmToken( function( fcmToken ) {
		if ( !fcmToken ) {
			return;
		}
		OSApp.Push._request( "DELETE", "/subscribe", {
			device_key: deviceKey,
			fcm_token: fcmToken
		} ).always( function() {
			delete OSApp.Push._registeredKeys[ deviceKey ];
		} );
	} );
};

// Reconcile FCM subscription state with the single push-notifications setting.
OSApp.Push.syncPushRegistration = function() {
	if ( OSApp.Analog && typeof OSApp.Analog.isPushEnabled === "function" && OSApp.Analog.isPushEnabled() ) {
		OSApp.Push.registerForPush();
	} else {
		OSApp.Push.unregisterFromPush();
	}
};

OSApp.Push.init = function() {
	OSApp.Push.ensureAndroidChannels();
	OSApp.Push.syncPushRegistration();
};

// Recreate the Android notification channels the forwarder targets via the FCM
// payload's channel_id. Without a matching channel Android drops the
// notification to a low-importance fallback (brief vibrate, no heads-up banner),
// losing the per-event priority. Channel importance is fixed at creation time
// and Android will NOT raise it on an existing channel (even after delete +
// recreate it restores the old importance), so the "_v2" ids are used to force
// the corrected importances onto devices that still carry the legacy channels.
// Zone start/stop are priority 1 (os_med) in the firmware, so the medium
// channel is high importance to show a heads-up banner for those events;
// os_high adds vibration + light for alarms, os_low stays quiet
// (weather/sensors/reports). Keep these ids in sync with the push forwarder.
OSApp.Push.ANDROID_CHANNELS = [
	{ id: "os_low_v2", name: "OpenSprinkler (low)", importance: "low", sound: null, vibration: false, badge: true, visibility: 1 },
	{ id: "os_med_v2", name: "OpenSprinkler (medium)", importance: "high", sound: "default", vibration: false, badge: true, visibility: 1 },
	{ id: "os_high_v2", name: "OpenSprinkler (high)", importance: "high", sound: "default", vibration: true, light: true, badge: true, visibility: 1 }
];

// Legacy channel ids (created by the removed cordova-plugin-local-notification).
// Deleted so they no longer clutter the app's notification settings.
OSApp.Push.LEGACY_ANDROID_CHANNELS = [ "os_low", "os_med", "os_high" ];

OSApp.Push.ensureAndroidChannels = function() {
	if ( OSApp.currentDevice && OSApp.currentDevice.isiOS ) { return; }
	if ( OSApp.Push._channelsCreated ) { return; }

	var plugin = null;
	if ( window.FirebasexMessaging && typeof window.FirebasexMessaging.createChannel === "function" ) {
		plugin = window.FirebasexMessaging;
	} else if ( window.FirebasePlugin && typeof window.FirebasePlugin.createChannel === "function" ) {
		plugin = window.FirebasePlugin;
	}
	if ( !plugin ) { return; }

	OSApp.Push._channelsCreated = true;

	if ( typeof plugin.deleteChannel === "function" ) {
		OSApp.Push.LEGACY_ANDROID_CHANNELS.forEach( function( id ) {
			try {
				plugin.deleteChannel( id, function() {}, function() {} );
			} catch ( e ) { void e; }
		} );
	}

	OSApp.Push.ANDROID_CHANNELS.forEach( function( ch ) {
		try {
			plugin.createChannel( ch, function() {}, function() {} );
		} catch ( e ) { void e; }
	} );
};

