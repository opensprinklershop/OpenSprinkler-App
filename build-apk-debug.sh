#!/bin/sh

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

# Copy server certificate to Android raw resources for trust-anchors
mkdir -p /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/
cp cert/server_cert.der /srv/www/htdocs/ui/platforms/android/app/src/main/res/raw/server_cert.der


cordova run android --debug -- --packageType=apk

# Clean up dynamically packaged UI versions from git-tracked workspace (keep versions.json if original exists)
rm -rf www/[0-9]*
git checkout www/versions.json 2>/dev/null || true

cp /srv/www/htdocs/ui/platforms/android/app/build/outputs/apk/debug/app-debug.apk /data/app-debug.apk
