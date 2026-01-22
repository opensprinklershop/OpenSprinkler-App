if [ -n "$XCODE_26_PATH" ]; then
	export DEVELOPER_DIR="$XCODE_26_PATH"
fi

XCODE_VERSION=$(xcodebuild -version | head -n 1 | awk '{print $2}')
XCODE_MAJOR=${XCODE_VERSION%%.*}
if [ -z "$XCODE_MAJOR" ] || [ "$XCODE_MAJOR" -lt 26 ]; then
	echo "Fehler: Xcode 26+ erforderlich (gefunden: ${XCODE_VERSION:-unbekannt})."
	exit 1
fi

scripts/appGMK.sh
grunt makeFW
cordova build ios --device --release --buildConfig build.json
scripts/appGMK2.sh
