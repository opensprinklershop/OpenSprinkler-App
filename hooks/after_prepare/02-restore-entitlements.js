#!/usr/bin/env node

/**
 * Hook that restores the custom Entitlements files
 * after Cordova's prepare step, which might have reset them.
 */

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', '..', 'platforms', 'ios', 'App');
const backupDir = path.join(__dirname, '..', '..', 'platforms', 'ios', '.entitlements_backup');

const entitlementsDebug = path.join(sourceDir, 'Entitlements-Debug.plist');
const entitlementsRelease = path.join(sourceDir, 'Entitlements-Release.plist');
const backupDebug = path.join(backupDir, 'Entitlements-Debug.plist');
const backupRelease = path.join(backupDir, 'Entitlements-Release.plist');

// Restore entitlements from backup if they were reset
if (fs.existsSync(backupDebug)) {
  fs.copyFileSync(backupDebug, entitlementsDebug);
  console.log('✓ Restored Entitlements-Debug.plist from backup');
}

if (fs.existsSync(backupRelease)) {
  fs.copyFileSync(backupRelease, entitlementsRelease);
  console.log('✓ Restored Entitlements-Release.plist from backup');
}
