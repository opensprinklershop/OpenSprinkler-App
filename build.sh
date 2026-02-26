#!/bin/sh
source ~/.bash_profile
rm ./www/js/*~ 2>/dev/null
rm ./www/js/DEADJOE 2>/dev/null
rm ./www/locale/*~ 2>/dev/null

# Build firmware and web assets
./scripts/appGMK.sh
grunt makeFW

# Stamp sw.js with build timestamp to bust Service Worker cache
BUILD_TS=$(date +%Y%m%d%H%M%S)
sed -i "s/__BUILD_TIMESTAMP__/$BUILD_TS/g" www/sw.js

# Copy modules.json to www/ and platforms BEFORE building
cp build/modules.json www/
cp build/modules.json platforms/browser/www/

# Copy Android build configuration
cp build.json platforms/android/build.json
cp network_security_config.xml /srv/www/htdocs/ui/platforms/android/app/src/main/res/xml/

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Sync www/ into Android platform assets before building
cordova prepare android

# Apply Android platform patches (e.g. LocalNotification CordovaWebView fix)
for p in patches/*.patch; do
	[ -f "$p" ] && patch -p1 -N --forward -r- < "$p" || true
done

# Build browser platform
cordova build browser --release

# Build Android platform (release AAB + APK)
cordova build android --release
cordova run android --release -- --packageType=apk

# Post-build cleanup
chown stefan:www platforms/* -R
./scripts/appGMK2.sh

# Restore sw.js build timestamp placeholder for source control
sed -i "s/OpenSprinkler-v$BUILD_TS/OpenSprinkler-v__BUILD_TIMESTAMP__/g" www/sw.js

rm ./platforms/browser/platform_www/plugins/* -R 2>/dev/null
rm ./platforms/browser/www/*.js 2>/dev/null

chown stefan:www platforms/* -R

# Copy build artifacts
sudo rm /data/app-release.*
cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/bundle/release/app-release.aab /data/app-release.aab
cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/apk/release/app-release.apk /data/app-release.apk
