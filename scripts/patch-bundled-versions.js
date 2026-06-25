#!/usr/bin/env node
/* OpenSprinkler App — bundled version index.html hardening
 *
 * The mobile apps bundle pinned older UI builds under www/<version>/. Those older
 * index.html files run a "fast-path" redirect in <head> that computes a target URL
 * from window.location.origin. Under Cordova file:// the origin is the literal
 * string "null", so the older bundles build an invalid URL like
 * "null/android_asset/www/2.4.0.213/index.html" and the WebView navigation fails
 * while the body is hidden (#fast-path-hide) -> permanent black screen on relaunch.
 *
 * The current root index.html already guards this case, but the pinned bundles do
 * not. This script idempotently rewrites every bundled versioned index.html so that
 * each `var origin = window.location.origin;` is immediately followed by a guard
 * that rebuilds a valid origin from protocol+host when it is empty or "null".
 *
 * Usage: node scripts/patch-bundled-versions.js <www-dir>
 * It scans <www-dir>/<version>/index.html for all version-looking folders.
 */
"use strict";

var fs = require("fs");
var path = require("path");

var wwwDir = process.argv[2] || "www";

var GUARD =
	"var origin = window.location.origin; " +
	"if (!origin || origin === \"null\") { origin = window.location.protocol + \"//\" + window.location.host; }";

// Matches the unguarded declaration only (so it is safe to run repeatedly and it
// will not touch a line that already has the guard appended right after it).
var UNGUARDED = /var origin = window\.location\.origin;(?!\s*if \(!origin)/g;

function isVersionDir(name) {
	return /^([0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?|dev)$/.test(name);
}

function patchFile(file) {
	var html;
	try {
		html = fs.readFileSync(file, "utf8");
	} catch (e) {
		return false;
	}

	if (!UNGUARDED.test(html)) {
		// Reset lastIndex (test() with /g advances it) and report no change needed.
		UNGUARDED.lastIndex = 0;
		return false;
	}
	UNGUARDED.lastIndex = 0;

	var patched = html.replace(UNGUARDED, GUARD);
	fs.writeFileSync(file, patched, "utf8");
	return true;
}

function main() {
	var entries;
	try {
		entries = fs.readdirSync(wwwDir);
	} catch (e) {
		console.error("patch-bundled-versions: cannot read " + wwwDir + ": " + e.message);
		process.exit(0); // never fail the build
	}

	var patchedCount = 0;
	entries.forEach(function (name) {
		if (!isVersionDir(name)) {
			return;
		}
		var indexFile = path.join(wwwDir, name, "index.html");
		if (!fs.existsSync(indexFile)) {
			return;
		}
		if (patchFile(indexFile)) {
			patchedCount++;
			console.log("   Hardened origin guard in " + indexFile);
		}
	});

	console.log("patch-bundled-versions: hardened " + patchedCount + " version(s) in " + wwwDir);
}

main();
