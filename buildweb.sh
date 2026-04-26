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

# === Deploy UI to local betaui.opensprinklershop.de (staging) ===
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/platforms/browser/www/"
BETAUI_TARGET="/srv/www/htdocs/ui-test/www"

if [ ! -d "$SRC_DIR" ]; then
	echo "ERROR: build output not found at $SRC_DIR" >&2
	exit 1
fi

echo "=== Deploying UI to betaui.opensprinklershop.de ($BETAUI_TARGET) ==="
mkdir -p "$BETAUI_TARGET"
rsync -a --delete "$SRC_DIR" "$BETAUI_TARGET/"
chown -R stefan:www "$BETAUI_TARGET" 2>/dev/null || true
echo "=== betaui deploy done ==="
