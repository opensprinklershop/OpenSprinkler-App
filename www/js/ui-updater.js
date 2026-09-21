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

// Self-updating copies of the versioned UI bundles (mobile apps only).
//
// The apps ship frozen UI snapshots under www/<version>/ and route a controller
// to the snapshot matching its firmware. A fix in a snapshot used to reach users
// only with the next store release. This module keeps an updated copy of the
// snapshot in the app's data directory and lets the router prefer it:
//
//   dataDirectory/ui/<id>/<version>/...   served on the app origin, so
//   localStorage with the stored sites keeps working:
//     Android  http://localhost/__cdvfile_files__/ui/<id>/<version>/index.html
//              (cordova-plugin-file path handler)
//     iOS      <scheme>://localhost/_app_file_<dataDirectory>/ui/<id>/<version>/index.html
//              (cordova-ios scheme handler; needs a custom scheme, not "file")
//
// - The file list of a snapshot (path -> sha256) is published next to it as
//   filelist.json with a detached ECDSA P-256 signature (filelist.sig). Nothing
//   is installed unless the signature matches the public key below: the web host
//   alone must not be able to push code into the apps.
// - Unchanged files are copied from the bundled snapshot, only changed or new
//   files are downloaded. Every file is hash-checked before it is written.
// - The copy never contains the Cordova bridge. Its index.html references
//   /cordova.js, /js/boot-diagnostics.js and /js/ui-updater.js from the app root,
//   so the native side always matches the installed app.
// - A copy goes live by writing one localStorage pointer after everything has
//   been verified. If it does not boot, the startup watchdog blocks its id and
//   the bundled snapshot is used again.
//
// The file is dependency-free on purpose: build.sh injects it into the frozen
// snapshots (like boot-diagnostics.js), which predate any helper it could use.

( function() {
	"use strict";

	if ( window.OSUIUpdater ) {
		return;
	}

	var POINTER_KEY = "ui_overlay_v1",       // { version: { id, rel, ts } }, rel below the copy base
		BASE_KEY = "ui_overlay_base",         // iOS: "/_app_file_<dataDirectory>", refreshed on deviceready
		BLOCKED_KEY = "ui_overlay_bad",       // { id: timestamp } copies that failed to boot
		CHECKED_KEY = "ui_update_checked",    // { version: timestamp of the last check }
		FIRMWARE_KEY = "ui_last_fw",          // { fwv, fwm } stored by the router
		OVERLAY_ROOT = "ui",
		CDV_PREFIX = "/__cdvfile_files__/",
		IOS_PREFIX = "/_app_file_",
		CHECK_INTERVAL_MS = 12 * 3600 * 1000,

		// The watchdog can misfire (controller offline during startup); a blocked
		// copy gets another chance after a week.
		BLOCK_EXPIRY_MS = 7 * 24 * 3600 * 1000,
		START_DELAY_MS = 20000,
		REQUEST_TIMEOUT_MS = 30000,
		MAX_FILES = 2000,
		MAX_FILE_BYTES = 8 * 1024 * 1024;

	var config = {
		remoteBase: "https://ui.opensprinklershop.de/",

		// ECDSA P-256 public key (JWK) matching the private key used by
		// scripts/gen-ui-filelist.js (--pubkey prints it).
		publicKey: /*UI_UPDATE_PUBLIC_KEY*/{"kty":"EC","crv":"P-256","x":"X34h5oj-0D2w6KRUDQ20T6Byn-BfT1VwEs-JVe2CTos","y":"HngMMEkMsU9dJeNYuNwiG5gA7-EfTl-nKsqn7dwuRQY"}/*END*/
	};

	var running = false,
		adapter = null;

	function log() {
		try {
			var args = Array.prototype.slice.call( arguments );
			args.unshift( "[ui-updater]" );
			console.log.apply( console, args );
		} catch ( e ) { void e; }
	}

	function readJSON( key, fallback ) {
		try {
			var value = JSON.parse( localStorage.getItem( key ) || "null" );
			return ( value && typeof value === "object" ) ? value : fallback;
		} catch ( e ) {
			void e;
			return fallback;
		}
	}

	function writeJSON( key, value ) {
		try { localStorage.setItem( key, JSON.stringify( value ) ); } catch ( e ) { void e; }
	}

	// OSApp.Storage namespaces every non-global key with the page path
	// ("/2.4.0.228:uiTheme"). A copy lives under another path, so the settings
	// have to travel with it or they would look reset after every update.
	function storagePrefix( href ) {
		return String( href ).replace( /\/index\.html$/, "" ).replace( /\/$/, "" ) + ":";
	}

	function copyKeys( from, to ) {
		if ( !from || !to || from === to ) {
			return;
		}
		try {
			var keys = [], i;
			for ( i = 0; i < localStorage.length; i++ ) {
				var key = localStorage.key( i );
				if ( key && key.indexOf( from ) === 0 ) {
					keys.push( key );
				}
			}
			keys.forEach( function( key ) {
				localStorage.setItem( to + key.substring( from.length ), localStorage.getItem( key ) );
			} );
		} catch ( e ) { void e; }
	}

	function removeKeys( prefix ) {
		try {
			var keys = [], i;
			for ( i = 0; i < localStorage.length; i++ ) {
				var key = localStorage.key( i );
				if ( key && key.indexOf( prefix ) === 0 ) {
					keys.push( key );
				}
			}
			keys.forEach( function( key ) { localStorage.removeItem( key ); } );
		} catch ( e ) { void e; }
	}

	function isVersion( name ) {
		return /^[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?$/.test( String( name ) );
	}

	// Relative, normalised, no traversal, no query: the only path form accepted
	// from a (signed) file list.
	function isSafePath( path ) {
		return typeof path === "string" && path.length > 0 && path.length < 200 &&
			/^[A-Za-z0-9._/-]+$/.test( path ) &&
			path.charAt( 0 ) !== "/" && path.indexOf( ".." ) === -1 && path.indexOf( "//" ) === -1;
	}

	// Files that belong to the installed app, never to a downloaded copy.
	function isPlatformPath( path ) {
		return path === "cordova.js" || path === "cordova_plugins.js" || path.indexOf( "plugins/" ) === 0 ||
			path === "js/boot-diagnostics.js" || path === "js/ui-updater.js" || path === "js/storage-guard.js" ||
			path === "sw.js" || path === "firebase-messaging-sw.js" ||
			path === "filelist.json" || path === "filelist.sig";
	}

	// Where the data directory is reachable on the app origin. Known before
	// deviceready, because the routers ask synchronously during page load:
	// cordova-android serves http(s)://localhost, cordova-ios announces its custom
	// scheme as window.CDV_ASSETS_URL (absent under scheme "file", where a page
	// outside the bundle cannot be loaded and WebCrypto is missing).
	function platform() {
		if ( /^https?:$/.test( window.location.protocol ) && window.location.hostname === "localhost" ) {
			return "android";
		}
		if ( typeof window.CDV_ASSETS_URL === "string" && window.location.protocol !== "file:" &&
			window.CDV_ASSETS_URL.indexOf( window.location.protocol + "//" + window.location.host ) === 0 ) {
			return "ios";
		}
		return null;
	}

	// Path prefix of the data directory, with a trailing slash, or null.
	function copyBase() {
		var where = platform();
		if ( where === "android" ) {
			return CDV_PREFIX;
		}
		if ( where === "ios" ) {
			var base = null;
			try { base = localStorage.getItem( BASE_KEY ); } catch ( e ) { void e; }
			return ( base && base.indexOf( IOS_PREFIX + "/" ) === 0 && base.charAt( base.length - 1 ) === "/" ) ? base : null;
		}
		return null;
	}

	// iOS: the container path changes with app updates and restores. Refresh the
	// base once the file plugin is up and move the per-path settings along.
	function refreshBase() {
		if ( platform() !== "ios" || !window.cordova || !window.cordova.file || !window.cordova.file.dataDirectory ) {
			return;
		}
		var native = String( window.cordova.file.dataDirectory ).replace( /^file:\/\//, "" ),
			base = IOS_PREFIX + ( native.charAt( 0 ) === "/" ? "" : "/" ) + native + ( native.charAt( native.length - 1 ) === "/" ? "" : "/" ),
			previous = null;

		try { previous = localStorage.getItem( BASE_KEY ); } catch ( e ) { void e; }
		if ( previous === base ) {
			return;
		}
		if ( previous ) {
			var pointers = readJSON( POINTER_KEY, {} );
			Object.keys( pointers ).forEach( function( v ) {
				if ( pointers[ v ] && pointers[ v ].rel ) {
					copyKeys( storagePrefix( previous + pointers[ v ].rel ), storagePrefix( base + pointers[ v ].rel ) );
					removeKeys( storagePrefix( previous + pointers[ v ].rel ) );
				}
			} );
		}
		try { localStorage.setItem( BASE_KEY, base ); } catch ( e ) { void e; }
	}

	// Everywhere else (hosted web UI, iOS under scheme "file", device-served UI)
	// the updater stays idle.
	function isSupported() {
		return !!adapter || (
			!!platform() && !!window.cordova && !!window.cordova.file && !!window.cordova.file.dataDirectory &&
			typeof window.resolveLocalFileSystemURL === "function" );
	}

	function hasCrypto() {
		return !!( window.crypto && window.crypto.subtle && window.Uint8Array && window.Promise );
	}

	// ---------------------------------------------------------------------
	// Pointer handling (also used synchronously by the routers)
	// ---------------------------------------------------------------------

	function isBlocked( id ) {
		var blocked = readJSON( BLOCKED_KEY, {} );
		return typeof blocked[ id ] === "number" && Date.now() - blocked[ id ] < BLOCK_EXPIRY_MS;
	}

	function getPointer( version ) {
		var pointers = readJSON( POINTER_KEY, {} ),
			p = pointers[ version ];

		if ( !p || typeof p.id !== "string" ) {
			return null;
		}
		// Builds before the iOS support stored an absolute Android href.
		if ( typeof p.rel !== "string" && typeof p.href === "string" && p.href.indexOf( CDV_PREFIX ) === 0 ) {
			p.rel = p.href.substring( CDV_PREFIX.length );
		}
		if ( isBlocked( p.id ) || p.rel !== OVERLAY_ROOT + "/" + p.id + "/" + version + "/index.html" ) {
			return null;
		}
		var base = copyBase();
		if ( !base ) {
			return null;
		}
		p.href = base + p.rel;
		return p;
	}

	// Absolute URL of the updated copy for a version, or null. The caller should
	// still probe it (the data directory can be wiped independently).
	function resolve( version ) {
		var p = getPointer( version );
		return p ? window.location.protocol + "//" + window.location.host + p.href : null;
	}

	// Versions that exist only as an updated copy (snapshot newer than the app).
	function extraVersions() {
		var pointers = readJSON( POINTER_KEY, {} );
		return Object.keys( pointers ).filter( function( v ) {
			return isVersion( v ) && !!getPointer( v );
		} );
	}

	// Id of the copy the current page runs from, or null for a bundled page.
	function currentCopyId() {
		var base = copyBase(),
			path = window.location.pathname;
		if ( !base || path.indexOf( base + OVERLAY_ROOT + "/" ) !== 0 ) {
			return null;
		}
		var m = path.substring( base.length + OVERLAY_ROOT.length + 1 ).match( /^([0-9a-f]{8,64})\// );
		return m ? m[ 1 ] : null;
	}

	// Called by the startup watchdog when the page it runs in never came up.
	function blockCurrentCopy( reason ) {
		var id = currentCopyId();
		if ( !id ) {
			return false;
		}

		// The bundled snapshot takes over again: hand the settings back first
		// (a blocked pointer no longer resolves), then drop the pointer.
		var pointers = readJSON( POINTER_KEY, {} );
		Object.keys( pointers ).forEach( function( v ) {
			if ( pointers[ v ] && pointers[ v ].id === id ) {
				var active = getPointer( v );
				if ( active ) {
					copyKeys( storagePrefix( active.href ), "/" + v + ":" );
				}
				delete pointers[ v ];
			}
		} );
		writeJSON( POINTER_KEY, pointers );

		var blocked = readJSON( BLOCKED_KEY, {} ),
			now = Date.now();
		if ( Array.isArray( blocked ) ) {
			blocked = {};
		}
		Object.keys( blocked ).forEach( function( key ) {
			if ( !( now - blocked[ key ] < BLOCK_EXPIRY_MS ) ) {
				delete blocked[ key ];
			}
		} );
		blocked[ id ] = now;
		writeJSON( BLOCKED_KEY, blocked );

		log( "blocked copy", id, reason || "" );
		return true;
	}

	// ---------------------------------------------------------------------
	// Helpers: network, hashing, signature
	// ---------------------------------------------------------------------

	function fetchBuffer( url, timeout ) {
		return new Promise( function( resolvePromise, reject ) {
			var xhr = new XMLHttpRequest();
			xhr.open( "GET", url, true );
			xhr.responseType = "arraybuffer";
			xhr.timeout = timeout || REQUEST_TIMEOUT_MS;
			xhr.onload = function() {
				if ( xhr.status >= 200 && xhr.status < 300 && xhr.response ) {
					resolvePromise( xhr.response );
				} else {
					reject( new Error( "HTTP " + xhr.status + " for " + url ) );
				}
			};
			xhr.onerror = xhr.ontimeout = xhr.onabort = function() {
				reject( new Error( "request failed: " + url ) );
			};
			xhr.send();
		} );
	}

	function toHex( buffer ) {
		var bytes = new Uint8Array( buffer ), out = "";
		for ( var i = 0; i < bytes.length; i++ ) {
			out += ( bytes[ i ] < 16 ? "0" : "" ) + bytes[ i ].toString( 16 );
		}
		return out;
	}

	function sha256( buffer ) {
		return window.crypto.subtle.digest( "SHA-256", buffer ).then( toHex );
	}

	function base64ToBuffer( text ) {
		var bin = window.atob( String( text ).replace( /\s+/g, "" ) ),
			bytes = new Uint8Array( bin.length );
		for ( var i = 0; i < bin.length; i++ ) {
			bytes[ i ] = bin.charCodeAt( i );
		}
		return bytes.buffer;
	}

	function bufferToText( buffer ) {
		if ( window.TextDecoder ) {
			return new TextDecoder( "utf-8" ).decode( buffer );
		}
		var bytes = new Uint8Array( buffer ), out = "";
		for ( var i = 0; i < bytes.length; i++ ) {
			out += String.fromCharCode( bytes[ i ] );
		}
		return decodeURIComponent( escape( out ) );
	}

	function textToBuffer( text ) {
		if ( window.TextEncoder ) {
			return new TextEncoder().encode( text ).buffer;
		}
		var bin = unescape( encodeURIComponent( text ) ), bytes = new Uint8Array( bin.length );
		for ( var i = 0; i < bin.length; i++ ) {
			bytes[ i ] = bin.charCodeAt( i );
		}
		return bytes.buffer;
	}

	// signature: raw r||s (IEEE P1363), base64. data: exact bytes of filelist.json.
	function verifySignature( data, signatureB64 ) {
		if ( !config.publicKey ) {
			return Promise.reject( new Error( "no update key configured" ) );
		}
		return window.crypto.subtle.importKey( "jwk", config.publicKey, { name: "ECDSA", namedCurve: "P-256" }, false, [ "verify" ] )
			.then( function( key ) {
				return window.crypto.subtle.verify( { name: "ECDSA", hash: "SHA-256" }, key, base64ToBuffer( signatureB64 ), data );
			} ).then( function( ok ) {
				if ( !ok ) {
					throw new Error( "file list signature mismatch" );
				}
			} );
	}

	// ---------------------------------------------------------------------
	// Storage adapter on top of cordova-plugin-file
	// ---------------------------------------------------------------------

	function cordovaAdapter() {
		var root = null;

		function getRoot() {
			if ( root ) {
				return Promise.resolve( root );
			}
			return new Promise( function( resolvePromise, reject ) {
				window.resolveLocalFileSystemURL( window.cordova.file.dataDirectory, function( dir ) {
					root = dir;
					resolvePromise( dir );
				}, reject );
			} );
		}

		function getDir( path, create ) {
			return getRoot().then( function( dir ) {
				var parts = path.split( "/" ).filter( Boolean );
				return parts.reduce( function( chain, part ) {
					return chain.then( function( parent ) {
						return new Promise( function( resolvePromise, reject ) {
							parent.getDirectory( part, { create: !!create }, resolvePromise, reject );
						} );
					} );
				}, Promise.resolve( dir ) );
			} );
		}

		return {
			write: function( path, buffer ) {
				var cut = path.lastIndexOf( "/" ),
					dirPath = cut === -1 ? "" : path.substring( 0, cut ),
					name = path.substring( cut + 1 );

				return getDir( dirPath, true ).then( function( dir ) {
					return new Promise( function( resolvePromise, reject ) {
						dir.getFile( name, { create: true, exclusive: false }, function( entry ) {
							entry.createWriter( function( writer ) {
								var truncated = false;
								writer.onerror = reject;
								writer.onwriteend = function() {
									// write() does not shrink an existing file
									if ( !truncated ) {
										truncated = true;
										writer.truncate( buffer.byteLength );
										return;
									}
									resolvePromise();
								};
								writer.write( new Blob( [ buffer ] ) );
							}, reject );
						}, reject );
					} );
				} );
			},
			removeDir: function( path ) {
				return getDir( path, false ).then( function( dir ) {
					return new Promise( function( resolvePromise ) {
						dir.removeRecursively( resolvePromise, resolvePromise );
					} );
				}, function() { /* not there */ } );
			},
			list: function( path ) {
				return getDir( path, false ).then( function( dir ) {
					return new Promise( function( resolvePromise ) {
						dir.createReader().readEntries( function( entries ) {
							resolvePromise( entries.filter( function( e ) { return e.isDirectory; } ).map( function( e ) { return e.name; } ) );
						}, function() { resolvePromise( [] ); } );
					} );
				}, function() { return []; } );
			}
		};
	}

	function getAdapter() {
		if ( !adapter ) {
			adapter = cordovaAdapter();
		}
		return adapter;
	}

	// ---------------------------------------------------------------------
	// Version selection (same rules as OSApp.Sites.mapFirmwareToUIVersion)
	// ---------------------------------------------------------------------

	function mapVersion( fwv, fwm, versions ) {
		fwv = parseInt( fwv, 10 );
		if ( !fwv || fwv < 240 ) {
			return null;
		}
		var base = Math.floor( fwv / 100 ) + "." + Math.floor( ( fwv % 100 ) / 10 ) + "." + ( fwv % 10 ),
			build = parseInt( fwm, 10 );

		if ( isNaN( build ) ) {
			return null;
		}
		if ( versions.indexOf( base + "." + build ) !== -1 ) {
			return base + "." + build;
		}
		var snaps = versions.filter( function( v ) { return v.indexOf( base + "." ) === 0; } )
			.map( function( v ) { return { v: v, n: parseInt( v.split( "." )[ 3 ], 10 ) }; } )
			.filter( function( x ) { return !isNaN( x.n ) && x.n < build; } )
			.sort( function( x, y ) { return x.n - y.n; } );

		return snaps.length ? snaps[ snaps.length - 1 ].v : null;
	}

	function currentPageVersion() {
		var m = window.location.pathname.match( /\/([0-9]+\.[0-9]+\.[0-9]+(?:\.[0-9]+)?)\/(?:index\.html)?$/ );
		return m ? m[ 1 ] : null;
	}

	function pickTargetVersion() {
		var pageVersion = currentPageVersion(),
			fw = readJSON( FIRMWARE_KEY, null );

		// A snapshot published after this app was built is unknown to the bundled
		// catalog; ask the server which snapshot belongs to the last firmware.
		if ( fw && fw.fwv ) {
			return fetchBuffer( config.remoteBase + "versions.json?t=" + Date.now(), 15000 ).then( function( buffer ) {
				var data = JSON.parse( bufferToText( buffer ) ),
					versions = ( data && Array.isArray( data.versions ) ) ? data.versions.filter( isVersion ) : [];
				return mapVersion( fw.fwv, fw.fwm, versions ) || pageVersion;
			} ).catch( function() {
				return pageVersion;
			} );
		}
		return Promise.resolve( pageVersion );
	}

	// ---------------------------------------------------------------------
	// Install
	// ---------------------------------------------------------------------

	// index.html of a copy: native bridge, watchdog and updater come from the app
	// root; the origin guard is the one scripts/patch-bundled-versions.js applies.
	function transformIndex( html ) {
		html = html.replace( /<script\s+src="cordova\.js"/g, "<script src=\"/cordova.js\"" );
		html = html.replace( /<script\s+src="js\/(boot-diagnostics|ui-updater|storage-guard)\.js"><\/script>\s*/g, "" );
		html = html.replace( /<head>/, "<head>\n\t\t<script src=\"/js/boot-diagnostics.js\"></script>\n\t\t<script src=\"/js/ui-updater.js\"></script>" +
			"\n\t\t<script src=\"/js/storage-guard.js\"></script>" );
		html = html.replace( /var origin = window\.location\.origin;(?!\s*if \(!origin)/g,
			"var origin = window.location.origin; if (!origin || origin === \"null\") { origin = window.location.protocol + \"//\" + window.location.host; }" );
		return html;
	}

	// Frozen snapshots leave for the site manager via "<parent of version>/index.html".
	var ROOT_STUB = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><script>" +
		"window.location.replace(\"/index.html\" + window.location.hash);</script></head><body></body></html>";

	function loadFileList( version ) {
		var base = config.remoteBase + version + "/",
			bust = "?t=" + Date.now();

		return Promise.all( [
			fetchBuffer( base + "filelist.json" + bust, 20000 ),
			fetchBuffer( base + "filelist.sig" + bust, 20000 )
		] ).then( function( res ) {
			return verifySignature( res[ 0 ], bufferToText( res[ 1 ] ) ).then( function() {
				return sha256( res[ 0 ] ).then( function( digest ) {
					var list = JSON.parse( bufferToText( res[ 0 ] ) );
					if ( !list || list.version !== version || !list.files || typeof list.files !== "object" ) {
						throw new Error( "file list does not describe " + version );
					}
					var paths = Object.keys( list.files );
					if ( !paths.length || paths.length > MAX_FILES || !list.files[ "index.html" ] ) {
						throw new Error( "implausible file list" );
					}
					paths.forEach( function( path ) {
						var f = list.files[ path ];
						if ( !isSafePath( path ) || isPlatformPath( path ) || !f || !/^[0-9a-f]{64}$/.test( f.sha256 ) ||
							!( f.size >= 0 && f.size <= MAX_FILE_BYTES ) ) {
							throw new Error( "invalid file list entry: " + path );
						}
					} );
					return { id: digest.substring( 0, 16 ), files: list.files, paths: paths };
				} );
			} );
		} );
	}

	// Bundled copy when it is byte-identical, else the download. Translations come
	// from the app root (build.sh syncs them into the bundled snapshots as well).
	function obtainFile( version, path, expected ) {
		var fromRemote = function() {
			return fetchBuffer( config.remoteBase + version + "/" + path + "?h=" + expected.sha256.substring( 0, 12 ) ).then( function( buffer ) {
				return sha256( buffer ).then( function( digest ) {
					if ( digest !== expected.sha256 ) {
						throw new Error( "hash mismatch: " + path );
					}
					return { buffer: buffer, downloaded: true };
				} );
			} );
		};

		if ( path.indexOf( "locale/" ) === 0 ) {
			return fetchBuffer( "/" + path, 10000 ).then( function( buffer ) {
				return { buffer: buffer, downloaded: false };
			}, fromRemote );
		}

		return fetchBuffer( "/" + version + "/" + path, 10000 ).then( function( buffer ) {
			return sha256( buffer ).then( function( digest ) {
				return digest === expected.sha256 ? { buffer: buffer, downloaded: false } : fromRemote();
			} );
		}, fromRemote );
	}

	function install( version, list ) {
		var store = getAdapter(),
			dir = OVERLAY_ROOT + "/" + list.id,
			downloaded = 0,
			index = 0;

		function next() {
			if ( index >= list.paths.length ) {
				return Promise.resolve();
			}
			var path = list.paths[ index++ ];
			return obtainFile( version, path, list.files[ path ] ).then( function( file ) {
				var buffer = file.buffer;
				if ( file.downloaded ) {
					downloaded++;
				}
				if ( path === "index.html" ) {
					buffer = textToBuffer( transformIndex( bufferToText( buffer ) ) );
				}
				return store.write( dir + "/" + version + "/" + path, buffer );
			} ).then( next );
		}

		return store.removeDir( dir ).then( next ).then( function() {
			return store.write( dir + "/index.html", textToBuffer( ROOT_STUB ) );
		} ).then( function() {
			// Read back through the same URL the router will use.
			return fetchBuffer( copyBase() + dir + "/" + version + "/index.html?t=" + Date.now(), 10000 );
		} ).then( function() {
			var pointers = readJSON( POINTER_KEY, {} ),
				active = getPointer( version ),
				rel = dir + "/" + version + "/index.html";

			copyKeys( active ? storagePrefix( active.href ) : "/" + version + ":", storagePrefix( copyBase() + rel ) );
			pointers[ version ] = { id: list.id, rel: rel, ts: Date.now() };
			writeJSON( POINTER_KEY, pointers );
			log( "installed", version, list.id, "files:", list.paths.length, "downloaded:", downloaded );
			return { version: version, id: list.id, downloaded: downloaded };
		} ).catch( function( err ) {
			// Nothing points at a half-written copy; do not leave it on the device.
			return store.removeDir( dir ).then( function() { throw err; }, function() { throw err; } );
		} );
	}

	function cleanup() {
		var pointers = readJSON( POINTER_KEY, {} ),
			keep = Object.keys( pointers ).map( function( v ) { return pointers[ v ] && pointers[ v ].id; } ),
			store = getAdapter();

		return store.list( OVERLAY_ROOT ).then( function( names ) {
			return names.filter( function( n ) { return keep.indexOf( n ) === -1; } ).reduce( function( chain, name ) {
				return chain.then( function() {
					removeKeys( ( copyBase() || CDV_PREFIX ) + OVERLAY_ROOT + "/" + name + "/" );
					return store.removeDir( OVERLAY_ROOT + "/" + name );
				} );
			}, Promise.resolve() );
		} ).catch( function() { /* best effort */ } );
	}

	// Returns a promise for { status, ... }. force skips the 12 h throttle.
	function check( force ) {
		if ( running ) {
			return Promise.resolve( { status: "busy" } );
		}
		refreshBase();
		if ( !isSupported() || !hasCrypto() || !config.publicKey || !copyBase() ) {
			return Promise.resolve( { status: "unsupported" } );
		}
		running = true;

		return pickTargetVersion().then( function( version ) {
			if ( !version || !isVersion( version ) ) {
				return { status: "no-version" };
			}
			var checked = readJSON( CHECKED_KEY, {} );
			if ( !force && checked[ version ] && Date.now() - checked[ version ] < CHECK_INTERVAL_MS ) {
				return { status: "throttled", version: version };
			}

			return loadFileList( version ).then( function( list ) {
				checked[ version ] = Date.now();
				writeJSON( CHECKED_KEY, checked );

				var pointer = getPointer( version );

				if ( isBlocked( list.id ) ) {
					return { status: "blocked", version: version, id: list.id };
				}
				if ( pointer && pointer.id === list.id ) {
					return { status: "current", version: version, id: list.id };
				}
				return install( version, list ).then( function( result ) {
					return cleanup().then( function() {
						result.status = "installed";
						return result;
					} );
				} );
			} );
		} ).then( function( result ) {
			running = false;
			return result;
		}, function( err ) {
			running = false;
			log( "check failed:", err && err.message ? err.message : err );
			return { status: "error", message: String( err && err.message ? err.message : err ) };
		} );
	}

	function schedule() {
		refreshBase();
		if ( !isSupported() ) {
			return;
		}
		window.setTimeout( function() { check( false ); }, START_DELAY_MS );
	}

	window.OSUIUpdater = {
		config: config,
		resolve: resolve,
		extraVersions: extraVersions,
		currentCopyId: currentCopyId,
		blockCurrentCopy: blockCurrentCopy,
		check: check,
		isSupported: isSupported,
		_setAdapter: function( a ) { adapter = a; },
		_transformIndex: transformIndex,
		_mapVersion: mapVersion
	};

	// cordova.file only exists after deviceready.
	if ( window.cordova ) {
		document.addEventListener( "deviceready", schedule, false );
	} else {
		window.addEventListener( "load", function() {
			if ( adapter ) {
				schedule();
			}
		} );
	}
} )();
