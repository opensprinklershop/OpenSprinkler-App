#!/bin/sh
rm ./www/js/*~
rm ./www/js/DEADJOE
rm ./www/locale/*~

export JAVA_HOME=/usr/lib64/jvm/jre-20-openjdk/
grunt buildFW

# Stamp sw.js with build timestamp to bust Service Worker cache
BUILD_TS=$(date +%Y%m%d%H%M%S)
sed -i "s/__BUILD_TIMESTAMP__/$BUILD_TS/g" www/sw.js

cp build.json platforms/android/build.json
cp network_security_config.xml /srv/www/htdocs/ui/platforms/android/app/src/main/res/xml/

cordova plugin add cordova-plugin-device

# Sync www/ into Android platform assets before building
cordova prepare android

# Apply Android platform patches (e.g. LocalNotification CordovaWebView fix)
for p in patches/*.patch; do
	[ -f "$p" ] && patch -p1 -N --forward -r- < "$p" || true
done

cordova build android --release
cordova run android --release -- --packageType=apk

# Restore sw.js build timestamp placeholder for source control
sed -i "s/OpenSprinkler-v$BUILD_TS/OpenSprinkler-v__BUILD_TIMESTAMP__/g" www/sw.js

chown stefan:www platforms/* -R
cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/bundle/release/app-release.aab /data/app-release.aab
cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/apk/release/app-release.apk /data/app-release.apk
