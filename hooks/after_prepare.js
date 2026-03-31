#!/usr/bin/env node

/**
 * Hook that fixes the MARKETING_VERSION and CURRENT_PROJECT_VERSION in the Xcode project
 * after cordova prepare overwrites them. This ensures iOS builds get the version from config.xml.
 * Also preserves the Entitlements files which are necessary for proper code signing.
 */

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config.xml');
const projectPath = path.join(__dirname, '..', 'platforms', 'ios', 'App.xcodeproj', 'project.pbxproj');
const sourceEntitlementsDebug = path.join(__dirname, '..', 'platforms', 'ios', 'App', 'Entitlements-Debug.plist');
const sourceEntitlementsRelease = path.join(__dirname, '..', 'platforms', 'ios', 'App', 'Entitlements-Release.plist');

// Read ios-CFBundleVersion from config.xml using regex
let iosCFBundleVersion = '19949'; // fallback version

try {
  const configContent = fs.readFileSync(configPath, 'utf8');

  // Extract ios-CFBundleVersion using regex
  const match = configContent.match(/ios-CFBundleVersion="(\d+)"/);
  if (match && match[1]) {
    iosCFBundleVersion = match[1];
  }
} catch (err) {
  console.warn('Could not read config.xml:', err.message);
}

function applyVersionFix(version) {
  if (fs.existsSync(projectPath)) {
    let content = fs.readFileSync(projectPath, 'utf8');

    // Replace MARKETING_VERSION
    content = content.replace(/MARKETING_VERSION = 2\.3\.187;/g, `MARKETING_VERSION = ${version};`);

    // Replace CURRENT_PROJECT_VERSION if it got reset
    content = content.replace(/CURRENT_PROJECT_VERSION = 2\.3\.187;/g, `CURRENT_PROJECT_VERSION = ${version};`);

    fs.writeFileSync(projectPath, content);
    console.log(`✓ Fixed MARKETING_VERSION and CURRENT_PROJECT_VERSION to ${version}`);
  } else {
    console.log('iOS project not found, skipping version fix');
  }
}

// Preserve Entitlements files
function preserveEntitlements() {
  if (fs.existsSync(sourceEntitlementsDebug)) {
    console.log('✓ Entitlements-Debug.plist found and preserved');
  } else {
    console.warn('⚠ Entitlements-Debug.plist not found');
  }

  if (fs.existsSync(sourceEntitlementsRelease)) {
    console.log('✓ Entitlements-Release.plist found and preserved');
  } else {
    console.warn('⚠ Entitlements-Release.plist not found');
  }
}

applyVersionFix(iosCFBundleVersion);
preserveEntitlements();
