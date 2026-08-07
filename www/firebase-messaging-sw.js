/* OpenSprinkler WebPush - Firebase Cloud Messaging service worker.
 *
 * Handles background push (tab/PWA not focused). Registered by push.js under the
 * dedicated scope "/firebase-cloud-messaging-push-scope" so it never clashes
 * with the app's own /sw.js. The forwarder sends web events as DATA-ONLY, so FCM
 * does not auto-display them and we render exactly one notification here.
 *
 * Keep the SDK version in sync with OSApp.Push.FIREBASE_SDK_VERSION (push.js).
 */
importScripts( "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js" );
importScripts( "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js" );

firebase.initializeApp( {
	apiKey: "AIzaSyA5IqYBDxcdnEWPwuos_g0YONrFaYZgW68",
	authDomain: "opensprinkler-notify.firebaseapp.com",
	projectId: "opensprinkler-notify",
	storageBucket: "opensprinkler-notify.firebasestorage.app",
	messagingSenderId: "558029754966",
	appId: "1:558029754966:web:b0c03a0b51df18f5b821f7"
} );

const messaging = firebase.messaging();

messaging.onBackgroundMessage( function( payload ) {
	var d = ( payload && payload.data ) || {};
	var n = ( payload && payload.notification ) || {};
	var title = n.title || d.notification_title || "OpenSprinkler";
	var body = n.body || d.event_text || d.notification_body || "";
	return self.registration.showNotification( title, {
		body: body,
		icon: "/res/android/icons/xhdpi.png",
		badge: "/res/android/icons/mdpi.png",
		tag: d.event_id || undefined,
		data: d
	} );
} );

// Focus/open the app when a notification is clicked.
self.addEventListener( "notificationclick", function( event ) {
	event.notification.close();
	event.waitUntil(
		self.clients.matchAll( { type: "window", includeUncontrolled: true } ).then( function( list ) {
			for ( var i = 0; i < list.length; i++ ) {
				if ( "focus" in list[ i ] ) { return list[ i ].focus(); }
			}
			if ( self.clients.openWindow ) { return self.clients.openWindow( "/" ); }
		} )
	);
} );
