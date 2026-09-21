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

// Keeps the stored sites and settings across a change of the WebView origin
// (mobile apps only).
//
// localStorage belongs to the page origin. Changing the URL scheme of the app
// (iOS: "ionic://localhost" -> "file://" in August 2026, and back for the
// self-updating UI copies) therefore makes every stored site disappear. This
// module mirrors localStorage into a file in the app data directory, which does
// not depend on the origin, and restores it once when the app comes up under a
// different origin than the one the backup was written from.
//
// It has to ship BEFORE the release that changes the scheme: only a backup written
// under the old origin can be restored under the new one.
//
// Dependency-free: build.sh / buildios.sh inject it into the frozen UI snapshots.

( function() {
	"use strict";

	if ( window.OSStorageGuard ) {
		return;
	}

	var FILE_NAME = "ls-backup.json",
		RESTORED_KEY = "ls_restored_from",
		MAX_ITEM_CHARS = 256 * 1024,
		SAVE_INTERVAL_MS = 60000;

	var lastSaved = null,
		saving = false;

	function log() {
		try {
			var args = Array.prototype.slice.call( arguments );
			args.unshift( "[storage-guard]" );
			console.log.apply( console, args );
		} catch ( e ) { void e; }
	}

	function currentOrigin() {
		return window.location.protocol + "//" + window.location.host;
	}

	function isSupported() {
		return !!window.cordova && !!window.cordova.file && !!window.cordova.file.dataDirectory &&
			typeof window.resolveLocalFileSystemURL === "function";
	}

	// Not worth carrying over: bookkeeping of this module and of the UI copies
	// (paths differ per origin), settings of a copy (they are handed back to the
	// bundled path, see ui-updater.js) and caches.
	function isSkipped( key ) {
		return key === RESTORED_KEY || /^ui_(overlay|update)_/.test( key ) || key === "ui_last_fw" ||
			key.indexOf( "/__cdvfile_files__/" ) === 0 || key.indexOf( "/_app_file_/" ) === 0 ||
			/(^|:)weatherData$/.test( key );
	}

	// OSApp.Storage prefixes keys with the page path. Under "file://" that is the
	// bundle path (".../OpenSprinkler.app/www/2.4.0.228:uiTheme"), under a custom
	// scheme or on Android just "/2.4.0.228:uiTheme". Store the portable form.
	function portableKey( key ) {
		var k = key.replace( /^\/.*?\/www(?=\/[^:]*:|:)/, "" );
		return k.charAt( 0 ) === ":" ? k.substring( 1 ) : k;
	}

	function snapshot() {
		var items = {}, i;
		for ( i = 0; i < localStorage.length; i++ ) {
			var key = localStorage.key( i ),
				value = key === null ? null : localStorage.getItem( key );
			if ( key === null || value === null || isSkipped( key ) || value.length > MAX_ITEM_CHARS ) {
				continue;
			}
			items[ portableKey( key ) ] = value;
		}
		return items;
	}

	function getDataDir() {
		return new Promise( function( resolve, reject ) {
			window.resolveLocalFileSystemURL( window.cordova.file.dataDirectory, resolve, reject );
		} );
	}

	function readBackup() {
		return getDataDir().then( function( dir ) {
			return new Promise( function( resolve ) {
				dir.getFile( FILE_NAME, { create: false }, function( entry ) {
					entry.file( function( file ) {
						var reader = new FileReader();
						reader.onloadend = function() {
							try {
								var data = JSON.parse( reader.result );
								resolve( data && typeof data.origin === "string" && data.items && typeof data.items === "object" ? data : null );
							} catch ( e ) {
								void e;
								resolve( null );
							}
						};
						reader.readAsText( file );
					}, function() { resolve( null ); } );
				}, function() { resolve( null ); } );
			} );
		} );
	}

	function writeBackup( text ) {
		return getDataDir().then( function( dir ) {
			return new Promise( function( resolve, reject ) {
				dir.getFile( FILE_NAME, { create: true, exclusive: false }, function( entry ) {
					entry.createWriter( function( writer ) {
						var blob = new Blob( [ text ], { type: "application/json" } ),
							truncated = false;
						writer.onerror = reject;
						writer.onwriteend = function() {
							// write() does not shrink an existing file
							if ( !truncated ) {
								truncated = true;
								writer.truncate( blob.size );
								return;
							}
							resolve();
						};
						writer.write( blob );
					}, reject );
				}, reject );
			} );
		} );
	}

	function save() {
		if ( saving || !isSupported() ) {
			return Promise.resolve( false );
		}
		var items = snapshot(),
			fingerprint = JSON.stringify( items );

		// Never replace a backup with nothing: an empty store is exactly the
		// situation this module exists for.
		if ( fingerprint === lastSaved || !items.sites ) {
			return Promise.resolve( false );
		}
		saving = true;
		return writeBackup( JSON.stringify( { origin: currentOrigin(), ts: Date.now(), items: items } ) ).then( function() {
			saving = false;
			lastSaved = fingerprint;
			return true;
		}, function( err ) {
			saving = false;
			log( "backup failed", err && err.code ? err.code : err );
			return false;
		} );
	}

	function rootIndexUrl() {
		var path = window.location.pathname;
		if ( window.location.protocol === "file:" ) {
			var cut = path.indexOf( "/www/" );
			return cut === -1 ? window.location.href : "file://" + path.substring( 0, cut ) + "/www/index.html";
		}
		return currentOrigin() + "/index.html";
	}

	// Restores when the backup was written under another origin and has not been
	// applied to this one yet. Returns a promise for true when it restored.
	function restoreIfOriginChanged() {
		return readBackup().then( function( backup ) {
			if ( !backup || backup.origin === currentOrigin() ) {
				return false;
			}
			var stamp = backup.origin + "@" + backup.ts;
			if ( localStorage.getItem( RESTORED_KEY ) === stamp ) {
				return false;
			}

			// The backup is newer than anything this origin may still hold from an
			// earlier life (iOS ran under "ionic://" until August 2026).
			Object.keys( backup.items ).forEach( function( key ) {
				try { localStorage.setItem( key, backup.items[ key ] ); } catch ( e ) { void e; }
			} );
			localStorage.setItem( RESTORED_KEY, stamp );
			log( "restored", Object.keys( backup.items ).length, "items written under", backup.origin );
			return true;
		} );
	}

	function start() {
		if ( !isSupported() ) {
			return;
		}
		restoreIfOriginChanged().then( function( restored ) {
			return save().then( function() {
				if ( restored ) {
					// Whatever is on screen was built from the old state.
					window.location.replace( rootIndexUrl() );
				}
			} );
		} ).catch( function( err ) {
			log( "start failed", err && err.message ? err.message : err );
		} );

		window.setInterval( save, SAVE_INTERVAL_MS );
		document.addEventListener( "pause", save, false );
		document.addEventListener( "visibilitychange", function() {
			if ( document.visibilityState === "hidden" ) {
				save();
			}
		}, false );
	}

	window.OSStorageGuard = {
		save: save,
		_portableKey: portableKey,
		_snapshot: snapshot,
		_restoreIfOriginChanged: restoreIfOriginChanged
	};

	if ( window.cordova ) {
		document.addEventListener( "deviceready", start, false );
	}
} )();
