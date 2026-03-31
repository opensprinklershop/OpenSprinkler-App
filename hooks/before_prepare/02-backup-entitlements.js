#!/usr/bin/env node

/**
 * Hook that preserves the custom Entitlements files
 * from being overwritten by Cordova during the prepare step.
 */

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'platforms', 'ios', 'App');
const entitlementsDebug = path.join(sourceDir, 'Entitlements-Debug.plist');
const entitlementsRelease = path.join(sourceDir, 'Entitlements-Release.plist');

// Backup the entitlements before they might be overwritten
const backupDir = path.join(__dirname, '..', 'platforms', 'ios', '.entitlements_backup');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

if (fs.existsSync(entitlementsDebug)) {
  fs.copyFileSync(entitlementsDebug, path.join(backupDir, 'Entitlements-Debug.plist'));
}

if (fs.existsSync(entitlementsRelease)) {
  fs.copyFileSync(entitlementsRelease, path.join(backupDir, 'Entitlements-Release.plist'));
}

console.log('✓ Entitlements files backed up');
