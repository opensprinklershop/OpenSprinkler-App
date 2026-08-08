#!/usr/bin/env node

/**
 * Adds android:usesCleartextTraffic and android:networkSecurityConfig to the
 * <application> element of the generated AndroidManifest.xml.
 *
 * These used to be set via an <edit-config mode="merge" target="/manifest/application">
 * in config.xml. That edit-config rewrites the whole <application> element on every
 * `cordova prepare` and drops the plugin-injected children (e.g.
 * cordova-plugin-firebasex-messaging's FirebaseMessagingService), which silently broke
 * push notifications. This hook only touches the <application> opening-tag attributes, so
 * plugin receivers/services survive.
 */

const fs = require("fs");
const path = require("path");

module.exports = function (context) {
	const projectRoot = (context && context.opts && context.opts.projectRoot) || process.cwd();

	const platforms = (context && context.opts && context.opts.platforms) || [];
	if (platforms.length && !platforms.includes("android")) {
		return;
	}

	const manifest = path.join(
		projectRoot,
		"platforms", "android", "app", "src", "main", "AndroidManifest.xml"
	);
	if (!fs.existsSync(manifest)) {
		return;
	}

	let xml = fs.readFileSync(manifest, "utf8");

	const wanted = {
		"android:usesCleartextTraffic": "true",
		"android:networkSecurityConfig": "@xml/network_security_config"
	};

	xml = xml.replace(/<application\b([^>]*)>/, function (full, attrs) {
		let updated = attrs;
		Object.keys(wanted).forEach(function (name) {
			if (new RegExp("\\b" + name.replace(":", "\\:") + "\\s*=").test(updated)) {
				return;
			}
			updated += " " + name + '="' + wanted[name] + '"';
		});
		return "<application" + updated + ">";
	});

	fs.writeFileSync(manifest, xml);
	console.log("\u2713 [android-application-security-attrs] ensured usesCleartextTraffic + networkSecurityConfig on <application>");
};
