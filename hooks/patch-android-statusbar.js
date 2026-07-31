#!/usr/bin/env node

/**
 * Overwrites the generated cordova-plugin-statusbar StatusBar.java with the OpenSprinkler
 * edge-to-edge variant (hooks/patches/StatusBar.java) after `cordova prepare`.
 *
 * cordova-plugin-statusbar@3.0.0 calls Window.setStatusBarColor() and
 * View.setSystemUiVisibility(SYSTEM_UI_FLAG_*), which Android 15 (targetSdk 35+) deprecates
 * and Google Play flags as "edge-to-edge display uses deprecated APIs". The patched file keeps
 * the same JavaScript action interface but uses the AndroidX WindowCompat /
 * WindowInsetsControllerCompat inset APIs instead.
 */

const fs = require("fs");
const path = require("path");

module.exports = function (context) {
    const projectRoot = (context && context.opts && context.opts.projectRoot) || process.cwd();

    // Only run when the Android platform is present/being prepared.
    const platforms = (context && context.opts && context.opts.platforms) || [];
    if (platforms.length && !platforms.includes("android")) {
        return;
    }

    const source = path.join(projectRoot, "hooks", "patches", "StatusBar.java");
    const target = path.join(
        projectRoot,
        "platforms", "android", "app", "src", "main",
        "java", "org", "apache", "cordova", "statusbar", "StatusBar.java"
    );

    if (!fs.existsSync(source)) {
        console.warn("[patch-android-statusbar] source not found:", source);
        return;
    }
    if (!fs.existsSync(target)) {
        // Android platform not generated yet; nothing to patch.
        return;
    }

    const patched = fs.readFileSync(source, "utf8");
    const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
    if (current === patched) {
        return;
    }

    fs.writeFileSync(target, patched);
    console.log("\u2713 [patch-android-statusbar] Installed edge-to-edge StatusBar.java");
};
