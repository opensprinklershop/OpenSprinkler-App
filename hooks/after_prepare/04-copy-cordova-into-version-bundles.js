#!/usr/bin/env node

/**
 * Copies the Cordova native bridge (cordova.js, cordova_plugins.js and the
 * plugins/ folder) from the platform www root into each bundled UI version
 * folder (e.g. assets/www/2.4.0.224/, assets/www/dev/).
 *
 * The app's index.html redirects to a firmware-matched version bundle
 * (http://localhost/<version>/index.html). Those bundles are web deployments
 * copied from ui-live and do NOT contain the Cordova files, so their relative
 * `<script src="cordova.js">` 404s -> window.cordova.plugins is undefined ->
 * native local notifications (and every other Cordova plugin) silently fail
 * ("System notifications are only available in the installed app").
 *
 * Copying the bridge into each version folder keeps every bundle self-contained
 * so plugin module paths stay relative and resolve correctly.
 */

const fs = require("fs");
const path = require("path");

function wwwRootFor(projectRoot, platform) {
	if (platform === "android") {
		return path.join(projectRoot, "platforms", "android", "app", "src", "main", "assets", "www");
	}
	if (platform === "ios") {
		return path.join(projectRoot, "platforms", "ios", "www");
	}
	return null;
}

module.exports = function (context) {
	const projectRoot = (context && context.opts && context.opts.projectRoot) || process.cwd();
	const platforms = (context && context.opts && context.opts.platforms) || [ "android" ];

	platforms.forEach(function (platform) {
		const wwwRoot = wwwRootFor(projectRoot, platform);
		if (!wwwRoot || !fs.existsSync(wwwRoot)) {
			return;
		}

		const bridgeFiles = [ "cordova.js", "cordova_plugins.js" ];
		const pluginsDir = path.join(wwwRoot, "plugins");

		// Nothing to copy if the native bridge itself is missing.
		if (!fs.existsSync(path.join(wwwRoot, "cordova.js"))) {
			return;
		}

		const versionDirs = fs.readdirSync(wwwRoot, { withFileTypes: true })
			.filter(function (e) {
				return e.isDirectory() && /^(\d+\.\d+\.\d+(\.\d+)?|dev)$/.test(e.name);
			})
			.map(function (e) { return e.name; });

		let patched = 0;
		versionDirs.forEach(function (version) {
			const dest = path.join(wwwRoot, version);

			bridgeFiles.forEach(function (file) {
				const src = path.join(wwwRoot, file);
				if (fs.existsSync(src)) {
					fs.copyFileSync(src, path.join(dest, file));
				}
			});

			if (fs.existsSync(pluginsDir)) {
				fs.cpSync(pluginsDir, path.join(dest, "plugins"), { recursive: true });
			}
			patched++;
		});

		if (patched > 0) {
			console.log("\u2713 [copy-cordova-into-version-bundles] " + platform + ": bridged " + patched + " version bundle(s)");
		}
	});
};
