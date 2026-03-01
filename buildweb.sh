#!/bin/sh
source ~/.bash_profile
rm ./www/js/*~ 2>/dev/null
rm ./www/js/DEADJOE 2>/dev/null
rm ./www/locale/*~ 2>/dev/null
rm ./www/*~ 2>/dev/null

./scripts/appGMK.sh
grunt makeFW

# Stamp sw.js with build timestamp to bust Service Worker cache
BUILD_TS=$(date +%Y%m%d%H%M%S)
sed -i "s/__BUILD_TIMESTAMP__/$BUILD_TS/g" www/sw.js

#cd www/js
#cat jquery.js libs.js main.js analog.js apexcharts.min.js >app.js
#cd ..
#cd ..

cordova build browser --release
cp build/modules.json platforms/browser/www
chown stefan:www platforms/* -R
./scripts/appGMK2.sh

# Restore sw.js build timestamp placeholder for source control
sed -i "s/OpenSprinkler-v$BUILD_TS/OpenSprinkler-v__BUILD_TIMESTAMP__/g" www/sw.js

rm ./platforms/browser/platform_www/plugins/* -R 2>/dev/null
rm ./platforms/browser/www/cordova.js ./platforms/browser/www/cordova_plugins.js 2>/dev/null
#systemctl restart squid
