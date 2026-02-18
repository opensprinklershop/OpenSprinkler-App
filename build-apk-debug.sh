#!/bin/sh
cp build.json platforms/android/build.json
cp network_security_config.xml /srv/www/htdocs/ui/platforms/android/app/src/main/res/xml/

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der


cordova run android --debug -- --packageType=apk

cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/apk/debug/app-debug.apk /data/app-debug.apk
