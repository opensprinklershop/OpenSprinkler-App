#!/bin/sh
rm ./www/js/*~
rm ./www/js/DEADJOE
rm ./www/locale/*~

#export JAVA_HOME=/usr/lib64/jvm/jre-21-openjdk/
#export JAVA_HOME=/etc/alternatives/java_sdk_21/

grunt prepareFW
cordova build browser --release
#cp build.json platforms/android/build.json
#cp network_security_config.xml /srv/www/htdocs/ui/platforms/android/app/src/main/res/xml/

#Kompatible Version für alte Android:
#mv config.xml config.xml.sav -f
#xmlstarlet edit \
#--update '//*[local-name()="preference"][@name="android-minSdkVersion"]/@value' \
#--value "25" \
#--update '//*[local-name()="preference"][@name="android-targetSdkVersion"]/@value' \
#--value "34" \
#config.xml.sav >config.xml

#cordova platform remove android
#cordova platform add android
#cordova plugin add https://github.com/katzer/cordova-plugin-local-notifications.git
#cordova plugin add cordova-plugin-background-fetch
#cordova plugin add https://bitbucket.org/TheBosZ/cordova-plugin-run-in-background
#cordova plugin add cordova-plugin-inappbrowser
#cordova plugin add https://github.com/kitolog/cordova-plugin-timer
#cordova build --release
##cordova run android --release
#cordova run android --release -- --packageType=apk

#cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/apk/release/app-release.apk /srv/www/htdocs/opensprinklershop/firmware/ -v

#Und wieder zurück:
#mv config.xml config.xml.sav -f
#xmlstarlet edit \
#--update '//*[local-name()="preference"][@name="android-minSdkVersion"]/@value' \
#--value "29" \
#--update '//*[local-name()="preference"][@name="android-targetSdkVersion"]/@value' \
#--value "34" \
#config.xml.sav >config.xml

#cordova platform remove android
#cordova platform add android
#cordova plugin add https://github.com/katzer/cordova-plugin-local-notifications.git
#cordova plugin add cordova-plugin-background-fetch
#cordova plugin add https://bitbucket.org/TheBosZ/cordova-plugin-run-in-background
#cordova plugin add cordova-plugin-inappbrowser
#cordova plugin add https://github.com/kitolog/cordova-plugin-timer
cordova build --release
cordova build browser --release
cordova run android --release
cordova run android --release -- --packageType=apk

cp build/modules.json platforms/browser/www
chown stefan:www platforms/* -R
#./scripts/appGMK2.sh

rm ./platforms/browser/platform_www/plugins/* -R 2>/dev/null
rm ./platforms/browser/www/*.js 2>/dev/null


#rm ./platforms/browser/platform_www/plugins/* 2>/dev/null
#rm ./platforms/browser/www/*.js 2>/dev/null

chown stefan:www platforms/* -R
cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/bundle/release/app-release.aab /data/app-release.aab
cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/apk/release/app-release.apk /data/app-release.apk
#cp /srv/www/htdocs/ui-test/platforms/android/app/build/outputs/apk/release/app-release-unsigned.apk /data/app-release-unsigned.apk

#./scripts/appGMK2.sh
