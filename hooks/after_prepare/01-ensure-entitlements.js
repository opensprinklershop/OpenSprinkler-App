#!/usr/bin/env node

/**
 * Ensure Entitlements files exist in iOS platform directory.
 * This hook copies entitlements from templates or creates them if missing.
 * Runs: after prepare
 */

const fs = require('fs');
const path = require('path');

const projectRoot = process.argv[2];
const entitlementsDir = path.join(projectRoot, 'platforms/ios/App');
const debugPlist = path.join(entitlementsDir, 'Entitlements-Debug.plist');
const releasePlist = path.join(entitlementsDir, 'Entitlements-Release.plist');

const debugContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
    <dict>
        <key>get-task-allow</key>
        <true/>
        <key>com.apple.developer.networking.HotspotConfiguration</key>
        <true/>
        <key>com.apple.developer.homekit</key>
        <true/>
        <key>com.apple.developer.location.push</key>
        <true/>
        <key>com.apple.external-accessory.wireless-configuration</key>
        <true/>
    </dict>
</plist>`;

const releaseContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
    <dict>
        <key>com.apple.developer.networking.HotspotConfiguration</key>
        <true/>
        <key>com.apple.developer.homekit</key>
        <true/>
        <key>com.apple.developer.location.push</key>
        <true/>
        <key>com.apple.external-accessory.wireless-configuration</key>
        <true/>
    </dict>
</plist>`;

// Ensure directory exists
if (!fs.existsSync(entitlementsDir)) {
    fs.mkdirSync(entitlementsDir, { recursive: true });
}

// Ensure Debug entitlements exist
if (!fs.existsSync(debugPlist)) {
    fs.writeFileSync(debugPlist, debugContent, 'utf8');
    console.log('✓ Entitlements-Debug.plist erstellt');
} else {
    // Verify content is not empty (fix for templates that might be empty)
    const content = fs.readFileSync(debugPlist, 'utf8');
    if (content.trim().length < 50 || !content.includes('get-task-allow')) {
        fs.writeFileSync(debugPlist, debugContent, 'utf8');
        console.log('✓ Entitlements-Debug.plist aktualisiert');
    }
}

// Ensure Release entitlements exist
if (!fs.existsSync(releasePlist)) {
    fs.writeFileSync(releasePlist, releaseContent, 'utf8');
    console.log('✓ Entitlements-Release.plist erstellt');
} else {
    // Verify content is not empty
    const content = fs.readFileSync(releasePlist, 'utf8');
    if (content.trim().length < 50 || !content.includes('com.apple.developer')) {
        fs.writeFileSync(releasePlist, releaseContent, 'utf8');
        console.log('✓ Entitlements-Release.plist aktualisiert');
    }
}

console.log('✓ Entitlements-Hook erfolgreich ausgeführt');
