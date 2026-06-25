#!/bin/sh
rm ./www/js/*~
rm ./www/js/DEADJOE
rm ./www/locale/*~

export JAVA_HOME=/usr/lib64/jvm/jre-20-openjdk/
grunt buildFW

# Stamp sw.js with build timestamp to bust Service Worker cache
BUILD_TS=$(date +%Y%m%d%H%M%S)
sed -i "s/__BUILD_TIMESTAMP__/$BUILD_TS/g" www/sw.js

# === Dynamically package UI versions inside mobile app ===
echo "=== Syncing UI Versions for Mobile App Bundle ==="
VERSIONS_SRC="/srv/www/htdocs/ui-live/www/versions.json"
if [ -f "$VERSIONS_SRC" ]; then
	cp "$VERSIONS_SRC" www/versions.json
else
	curl -s -o www/versions.json "https://ui.opensprinklershop.de/versions.json"
fi

VERSIONS=$(node -e '
	try {
		const data = JSON.parse(require("fs").readFileSync("www/versions.json", "utf8"));
		console.log(data.versions.filter(v => v !== "dev").join(" "));
	} catch(e) {
		console.log("2.4.0.213 2.4.0.212 2.3.0 2.2.1");
	}
')

for v in $VERSIONS; do
	echo "   Syncing version $v ... "
	mkdir -p "www/$v"
	VER_SRC_DIR="/srv/www/htdocs/ui-live/www/$v"
	if [ -d "$VER_SRC_DIR" ]; then
		rsync -a --delete "$VER_SRC_DIR/" "www/$v/"
	else
		echo "   [WARN] Local path $VER_SRC_DIR not found. Skipping local copy."
	fi
done

# === Inject boot diagnostics & startup watchdog into each bundled UI version ===
echo "=== Injecting boot watchdog into bundled UI versions ==="
for v in $VERSIONS; do
	VER_DIR="www/$v"
	[ -d "$VER_DIR" ] || continue
	[ -f "$VER_DIR/index.html" ] || continue
	mkdir -p "$VER_DIR/js"
	cp www/js/boot-diagnostics.js "$VER_DIR/js/boot-diagnostics.js"
	if ! grep -q "js/boot-diagnostics.js" "$VER_DIR/index.html"; then
		perl -0777 -pi -e 's{<head>}{<head>\n\t\t<script src="js/boot-diagnostics.js"></script>}' "$VER_DIR/index.html"
		echo "   Injected watchdog into $VER_DIR/index.html"
	fi
done

# === Harden bundled versioned index.html against Cordova file:// origin "null" ===
echo "=== Hardening bundled version origin guards ==="
node scripts/patch-bundled-versions.js www

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

# Clean up dynamically packaged UI versions from git-tracked workspace (keep versions.json if original exists)
rm -rf www/[0-9]*
git checkout www/versions.json 2>/dev/null || true

chown stefan:www platforms/* -R
cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/bundle/release/app-release.aab /data/app-release.aab
cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/apk/release/app-release.apk /data/app-release.apk
