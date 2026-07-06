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
# The bundled versioned UIs are pinned older builds that do not contain the
# startup watchdog / JavaScript error console. Inject the self-contained
# boot-diagnostics.js into each one so a frozen/black screen can recover to the
# main menu and the captured JS errors stay viewable. This is idempotent and
# only touches the (untracked) bundled copies under www/$v.
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
# Pinned older bundles compute their fast-path redirect URL from
# window.location.origin, which is the literal "null" under file://. That yields an
# invalid target like "null/.../<ver>/index.html" and a permanent black screen on
# relaunch. This idempotently injects an origin null-guard into each bundle.
echo "=== Hardening bundled version origin guards ==="
node scripts/patch-bundled-versions.js www

# Copy modules.json to www/ and platforms BEFORE building
cp build/modules.json www/
cp build/modules.json platforms/browser/www/

# Copy Android build configuration
cp build.json platforms/android/build.json
cp network_security_config.xml /srv/www/htdocs/ui/platforms/android/app/src/main/res/xml/

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Force a JDK version compatible with Android lint (Java 25 currently breaks lint).
for jdk in /usr/lib64/jvm/java-17-openjdk /usr/lib/jvm/java-17-openjdk /usr/lib64/jvm/java-21-openjdk /usr/lib/jvm/java-21-openjdk; do
	if [ -x "$jdk/bin/java" ]; then
		export JAVA_HOME="$jdk"
		export PATH="$JAVA_HOME/bin:$PATH"
		break
	fi
done
echo "Using JAVA_HOME=${JAVA_HOME}"

# Ensure Gradle does not reuse a daemon started with an incompatible JDK.
if [ -x "platforms/android/gradlew" ]; then
	(cd platforms/android && ./gradlew --stop >/dev/null 2>&1 || true)
fi

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der

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

# Clean up dynamically packaged UI versions from git-tracked workspace (keep versions.json if original exists)
rm -rf www/[0-9]*
git checkout www/versions.json 2>/dev/null || true

rm ./platforms/browser/platform_www/plugins/* -R 2>/dev/null
rm ./platforms/browser/www/*.js 2>/dev/null

chown stefan:www platforms/* -R

# Copy build artifacts
sudo rm /data/app-release.*
cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/bundle/release/app-release.aab /data/app-release.aab
cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/apk/release/app-release.apk /data/app-release.apk
