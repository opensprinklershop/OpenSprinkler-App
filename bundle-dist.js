#!/usr/bin/env node
/* bundle-dist.js <dist_dir> [version]
 *
 * Buendelt die im <head> von index.html eager geladenen App-/Vendor-Scripts
 * (js/... und vendor-js/..., ausser js/boot-diagnostics.js) zu EINER Datei
 * js/bundle.js und schreibt index.html sowie den Service-Worker-Precache
 * (sw.js) entsprechend um. Erwartet ein bereits (optional) minifiziertes
 * Verzeichnis. Nicht-Bundle-Scripts (boot-diagnostics, Inline-Bloecke,
 * cordova.js) bleiben unveraendert. Reihenfolge wird exakt erhalten.
 *
 * Exit != 0 => Aufrufer soll unveraendert (unbundled) deployen.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const dir = process.argv[2];
const version = process.argv[3] || new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);

if (!dir || !fs.existsSync(path.join(dir, "index.html"))) {
	console.error("bundle-dist: index.html nicht in '" + dir + "' gefunden");
	process.exit(1);
}

const indexPath = path.join(dir, "index.html");
let html = fs.readFileSync(indexPath, "utf8");

// Alle <script src="..."></script> in Dokumentreihenfolge finden.
const tagRe = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/gi;
const tags = [];
let m;
while ((m = tagRe.exec(html)) !== null) {
	tags.push({ full: m[0], src: m[1], index: m.index });
}

// Kandidaten: js/... oder vendor-js/..., aber NICHT boot-diagnostics.
const isBundleSrc = (src) => {
	const clean = src.split("?")[0];
	if (clean === "js/boot-diagnostics.js") { return false; }
	return /^(js\/|vendor-js\/)/.test(clean);
};

const bundleTags = tags.filter((t) => isBundleSrc(t.src));
if (bundleTags.length < 2) {
	console.error("bundle-dist: zu wenige Bundle-Scripts gefunden (" + bundleTags.length + ") - Abbruch");
	process.exit(1);
}

// Dateien einlesen (in Reihenfolge) und Existenz pruefen.
const pieces = [];
const bundledPaths = []; // "/js/..." Form fuer sw.js
for (const t of bundleTags) {
	const rel = t.src.split("?")[0];
	const fp = path.join(dir, rel);
	if (!fs.existsSync(fp)) {
		console.error("bundle-dist: Datei fehlt, Abbruch: " + rel);
		process.exit(1);
	}
	let code = fs.readFileSync(fp, "utf8");
	pieces.push("\n/* ==== " + rel + " ==== */\n" + code);
	bundledPaths.push("/" + rel);
}

// Mit ";\n" trennen, um ASI-Fallen zwischen zwei Programmen zu vermeiden.
const header = "/* OpenSprinkler UI bundle - autogeneriert (bundle-dist.js), v" + version + " */\n";
const bundleCode = header + pieces.join("\n;\n") + "\n";
const bundleRel = "js/bundle.js";
const bundleFp = path.join(dir, bundleRel);
fs.writeFileSync(bundleFp, bundleCode);

// Syntaxpruefung des Bundles.
try {
	execFileSync(process.execPath, ["--check", bundleFp], { stdio: "pipe" });
} catch (e) {
	console.error("bundle-dist: Syntaxfehler im Bundle - Abbruch\n" + (e.stderr ? e.stderr.toString() : e.message));
	process.exit(1);
}

// index.html umschreiben: erstes Bundle-Tag -> Bundle-Tag, restliche entfernen.
let replaced = false;
for (const t of bundleTags) {
	if (!replaced) {
		html = html.replace(t.full, '<script src="' + bundleRel + "?v=" + version + '"></script>');
		replaced = true;
	} else {
		// leere Zeile vermeiden: Tag + evtl. fuehrende Tabs/folgender Zeilenumbruch
		html = html.replace(t.full + "\n", "");
		html = html.replace(t.full, "");
	}
}
fs.writeFileSync(indexPath, html);

// sw.js Precache anpassen.
const swPath = path.join(dir, "js", "sw.js");
const swPathAlt = path.join(dir, "sw.js");
const swFile = fs.existsSync(swPath) ? swPath : (fs.existsSync(swPathAlt) ? swPathAlt : null);
if (swFile) {
	let sw = fs.readFileSync(swFile, "utf8");
	// cacheName bumpen.
	sw = sw.replace(/cacheName\s*=\s*"[^"]*"/, 'cacheName = "OpenSprinkler-v' + version + '-bundle"');
	// Zeilen entfernen, die eine gebuendelte Datei referenzieren.
	const bundledSet = new Set(bundledPaths);
	sw = sw.split("\n").filter((line) => {
		const lm = line.match(/["'](\/[^"']+)["']/);
		if (lm && bundledSet.has(lm[1])) { return false; }
		return true;
	}).join("\n");
	// Bundle + boot-diagnostics direkt nach 'var cacheFiles = [' einfuegen.
	sw = sw.replace(/var cacheFiles = \[/,
		'var cacheFiles = [\n  "/js/bundle.js",\n  "/js/boot-diagnostics.js",');
	fs.writeFileSync(swFile, sw);
	console.error("bundle-dist: sw.js aktualisiert (" + path.relative(dir, swFile) + ")");
} else {
	console.error("bundle-dist: WARN sw.js nicht gefunden - Precache nicht angepasst");
}

// Ergebnis auf stdout: Anzahl gebuendelter Dateien + Bundle-Groesse.
const sz = fs.statSync(bundleFp).size;
console.log(JSON.stringify({ bundled: bundleTags.length, bundleBytes: sz, version: version }));
