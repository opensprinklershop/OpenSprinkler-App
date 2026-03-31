#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -f "$SCRIPT_DIR/../../.bashrc" ]; then
	source "$SCRIPT_DIR/../../.bashrc"
fi

if [ -n "$XCODE_26_PATH" ]; then
	export DEVELOPER_DIR="$XCODE_26_PATH"
fi

XCODE_VERSION=$(xcodebuild -version | head -n 1 | awk '{print $2}')
XCODE_MAJOR=${XCODE_VERSION%%.*}
if [ -z "$XCODE_MAJOR" ] || [ "$XCODE_MAJOR" -lt 26 ]; then
	echo "Fehler: Xcode 26+ erforderlich (gefunden: ${XCODE_VERSION:-unbekannt})."
	exit 1
fi

read -r -p "Versionsnummer in config.xml erhöhen? [y/N]: " BUMP_VERSION
BUMP_VERSION=${BUMP_VERSION:-n}

if [[ "$BUMP_VERSION" =~ ^[Yy]$ ]]; then
	CURRENT_VERSION=$(sed -n 's/.*<widget[^>]* version="\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)".*/\1/p' "$SCRIPT_DIR/config.xml" | head -n 1)
	CURRENT_VERSION_CODE=$(sed -n 's/.* versionCode="\([0-9][0-9]*\)".*/\1/p' "$SCRIPT_DIR/config.xml" | head -n 1)

	if [ -z "$CURRENT_VERSION" ] || [ -z "$CURRENT_VERSION_CODE" ]; then
		echo "Fehler: Versionsinformationen in config.xml konnten nicht gelesen werden."
		exit 1
	fi

	IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
	NEXT_PATCH=$((PATCH + 1))
	NEXT_VERSION="$MAJOR.$MINOR.$NEXT_PATCH"
	NEXT_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))

	sed -i '' -E "0,/version=\"[0-9]+\.[0-9]+\.[0-9]+\"/{s/version=\"[0-9]+\.[0-9]+\.[0-9]+\"/version=\"$NEXT_VERSION\"/}" "$SCRIPT_DIR/config.xml"
	sed -i '' -E "0,/android-versionCode=\"[0-9]+\"/{s/android-versionCode=\"[0-9]+\"/android-versionCode=\"$NEXT_VERSION_CODE\"/}" "$SCRIPT_DIR/config.xml"
	sed -i '' -E "0,/ versionCode=\"[0-9]+\"/{s/ versionCode=\"[0-9]+\"/ versionCode=\"$NEXT_VERSION_CODE\"/}" "$SCRIPT_DIR/config.xml"

	echo "Version erhöht: $CURRENT_VERSION -> $NEXT_VERSION"
	echo "VersionCode erhöht: $CURRENT_VERSION_CODE -> $NEXT_VERSION_CODE"
else
	echo "Version bleibt unverändert."
fi

# --- CFBundleShortVersionString für App Store ---
# Cordova setzt MARKETING_VERSION aus dem version-Attribut in config.xml.
# Da MARKETING_VERSION=$(MARKETING_VERSION) in der Info.plist-Vorlage steht,
# überschreibt es zur Buildzeit jeden edit-config-Wert.
# Lösung: version-Attribut temporär auf YYYYMMDD setzen (z. B. 20260331 >> 19959),
# damit Cordova das korrekte MARKETING_VERSION ins Xcode-Projekt schreibt.
# Nach dem Build wird der originale Wert per trap wiederhergestellt.

ORIG_APP_VERSION=$(sed -n 's/.*<widget[^>]* version="\([^"]*\)".*/\1/p' "$SCRIPT_DIR/config.xml" | head -1)
BUILD_CF_VERSION=$(date +%Y%m%d)

sed -i '' -E "s/(<widget[^>]+ version=\")[^\"]*(\")/\1$BUILD_CF_VERSION\2/" "$SCRIPT_DIR/config.xml"
echo "CFBundleShortVersionString temporär: $ORIG_APP_VERSION -> $BUILD_CF_VERSION"

restore_app_version() {
	sed -i '' -E "s/(<widget[^>]+ version=\")[^\"]*(\")/\1$ORIG_APP_VERSION\2/" "$SCRIPT_DIR/config.xml"
	echo "config.xml version wiederhergestellt: $BUILD_CF_VERSION -> $ORIG_APP_VERSION"
}
trap restore_app_version EXIT

scripts/appGMK.sh
grunt makeFW

# Remove stale res/ symlinks in platform dirs to prevent EINVAL during cordova prepare.
# platforms/ios/www/res and www/res both point to the same physical directory;
# cordova would try to cp a file onto itself → EINVAL.
for PLAT_RES in platforms/ios/www/res platforms/browser/www/res; do
	if [ -L "$PLAT_RES" ]; then
		rm -f "$PLAT_RES"
		echo "Removed stale symlink: $PLAT_RES"
	fi
done

cordova build ios --device --release --buildConfig build.json
scripts/appGMK2.sh
