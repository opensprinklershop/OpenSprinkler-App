#!/usr/bin/env node
/* OpenSprinkler App — signed file lists for the self-updating UI snapshots
 *
 * The mobile apps keep updated copies of the versioned UI snapshots
 * (www/js/ui-updater.js). For every snapshot folder this script writes
 *
 *   <version>/filelist.json   { version, generated, files: { path: { sha256, size } } }
 *   <version>/filelist.sig    base64 ECDSA P-256 signature (IEEE P1363) over the
 *                             exact bytes of filelist.json
 *
 * The apps install nothing unless the signature matches the public key compiled
 * into ui-updater.js, so the private key must never live on the web host or in
 * this repository.
 *
 * Usage:
 *   node scripts/gen-ui-filelist.js <www-dir> [version ...]     sign snapshots
 *   node scripts/gen-ui-filelist.js --genkey <private.pem>      create a key pair
 *   node scripts/gen-ui-filelist.js --pubkey <private.pem>      print the public JWK
 *
 * Key: $UI_UPDATE_KEY, default /data/Workspace/App-Keys/ui-update-signing.pem.
 * filelist.json is only rewritten when the files changed, so an unchanged
 * snapshot keeps its id and the apps do not reinstall it.
 */
"use strict";

var fs = require( "fs" );
var path = require( "path" );
var crypto = require( "crypto" );

var DEFAULT_KEY = "/data/Workspace/App-Keys/ui-update-signing.pem";

// Not part of a copy: the native bridge and the injected helpers come from the
// installed app, service workers and leftovers have no business in it.
var EXCLUDE = [
	/^cordova\.js$/, /^cordova_plugins\.js$/, /^plugins\//, /^platform\.js$/, /^exec\.js$/,
	/^confighelper\.js$/, /^config\.xml$/, /^js\/boot-diagnostics\.js$/, /^js\/ui-updater\.js$/, /^js\/storage-guard\.js$/,
	/^sw\.js$/, /^firebase-messaging-sw\.js$/, /^filelist\.(json|sig)$/,
	/\.(bak|orig|md|map)$/i, /~$/, /(^|\/)\./, /^irrigation-db-test\.html$/
];

function isVersionDir( name ) {
	return /^[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?$/.test( name );
}

function walk( root, rel, out ) {
	fs.readdirSync( path.join( root, rel ) ).sort().forEach( function( name ) {
		var r = rel ? rel + "/" + name : name,
			st = fs.statSync( path.join( root, r ) );
		if ( st.isDirectory() ) {
			walk( root, r, out );
		} else if ( st.isFile() && !EXCLUDE.some( function( re ) { return re.test( r ); } ) ) {
			out.push( r );
		}
	} );
	return out;
}

function buildList( dir, version ) {
	var files = {};
	walk( dir, "", [] ).forEach( function( rel ) {
		if ( !/^[A-Za-z0-9._/-]+$/.test( rel ) ) {
			console.warn( "   skipped (unsupported characters): " + rel );
			return;
		}
		var data = fs.readFileSync( path.join( dir, rel ) );
		files[ rel ] = { sha256: crypto.createHash( "sha256" ).update( data ).digest( "hex" ), size: data.length };
	} );
	return { version: version, files: files };
}

function publicJwk( privatePem ) {
	var jwk = crypto.createPublicKey( crypto.createPrivateKey( privatePem ) ).export( { format: "jwk" } );
	return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
}

function main() {
	var args = process.argv.slice( 2 );

	if ( args[ 0 ] === "--genkey" ) {
		var target = args[ 1 ] || DEFAULT_KEY;
		if ( fs.existsSync( target ) ) {
			console.error( "refusing to overwrite " + target );
			process.exit( 1 );
		}
		var pair = crypto.generateKeyPairSync( "ec", { namedCurve: "prime256v1" } );
		fs.writeFileSync( target, pair.privateKey.export( { type: "pkcs8", format: "pem" } ), { mode: 0o600 } );
		console.log( JSON.stringify( publicJwk( fs.readFileSync( target ) ) ) );
		return;
	}
	if ( args[ 0 ] === "--pubkey" ) {
		console.log( JSON.stringify( publicJwk( fs.readFileSync( args[ 1 ] || process.env.UI_UPDATE_KEY || DEFAULT_KEY ) ) ) );
		return;
	}

	var wwwDir = args[ 0 ],
		keyFile = process.env.UI_UPDATE_KEY || DEFAULT_KEY;

	if ( !wwwDir || !fs.existsSync( wwwDir ) ) {
		console.error( "usage: gen-ui-filelist.js <www-dir> [version ...]" );
		process.exit( 1 );
	}
	if ( !fs.existsSync( keyFile ) ) {
		// Never fail a deploy over this: without a file list the apps simply keep
		// their bundled snapshots.
		console.warn( "gen-ui-filelist: signing key " + keyFile + " not found, no file lists written" );
		return;
	}

	var key = crypto.createPrivateKey( fs.readFileSync( keyFile ) ),
		versions = args.slice( 1 );

	if ( !versions.length ) {
		versions = fs.readdirSync( wwwDir ).filter( isVersionDir );
	}

	versions.forEach( function( version ) {
		var dir = path.join( wwwDir, version );
		if ( !isVersionDir( version ) || !fs.existsSync( path.join( dir, "index.html" ) ) ) {
			console.warn( "   skipped " + version + " (no snapshot)" );
			return;
		}

		var list = buildList( dir, version ),
			listFile = path.join( dir, "filelist.json" ),
			sigFile = path.join( dir, "filelist.sig" ),
			previous = null;

		try { previous = JSON.parse( fs.readFileSync( listFile, "utf8" ) ); } catch ( e ) { previous = null; }

		var unchanged = previous && fs.existsSync( sigFile ) &&
			JSON.stringify( previous.files ) === JSON.stringify( list.files );

		if ( !unchanged ) {
			list.generated = new Date().toISOString();
			fs.writeFileSync( listFile, JSON.stringify( { version: list.version, generated: list.generated, files: list.files } ) );
		}

		// (Re)sign the bytes on disk; cheap, and it repairs a missing signature.
		var bytes = fs.readFileSync( listFile ),
			sig = crypto.sign( "sha256", bytes, { key: key, dsaEncoding: "ieee-p1363" } );
		if ( unchanged && crypto.verify( "sha256", bytes, { key: crypto.createPublicKey( key ), dsaEncoding: "ieee-p1363" },
			Buffer.from( fs.readFileSync( sigFile, "utf8" ), "base64" ) ) ) {
			console.log( "   " + version + ": unchanged (" + Object.keys( list.files ).length + " files)" );
			return;
		}
		fs.writeFileSync( sigFile, sig.toString( "base64" ) );
		console.log( "   " + version + ": " + Object.keys( list.files ).length + " files, id " +
			crypto.createHash( "sha256" ).update( bytes ).digest( "hex" ).substring( 0, 16 ) );
	} );
}

main();
