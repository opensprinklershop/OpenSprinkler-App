#!/bin/bash
# Promote betaui staging -> ui production.
# Usage: ./buildwebdeploy.sh [release_version]
# Example: ./buildwebdeploy.sh 2.4.2

set -e

SRC_DIR="/srv/www/htdocs/ui-test/www"
DST_DIR="/srv/www/htdocs/ui-live/www"

if [ ! -d "$SRC_DIR" ]; then
	echo "ERROR: betaui source not found at $SRC_DIR" >&2
	echo "Run ./buildweb.sh first to populate it." >&2
	exit 1
fi

echo "=== Promoting betaui -> ui ($DST_DIR) ==="
mkdir -p "$DST_DIR"

# 1. Update/copy the root "Standortverwaltung" (from the root of build output)
# We exclude the dev and version-specific subdirectories during root copy
rsync -a --delete --exclude="/dev/" --exclude="/[0-9]*/" "$SRC_DIR/" "$DST_DIR/"

# 2. Update/copy the dev version
mkdir -p "$DST_DIR/dev"
rsync -a --delete "$SRC_DIR/dev/" "$DST_DIR/dev/"

# 3. If a release version is specified, create a new release folder and copy dev to it
RELEASE_VER="$1"
if [ -n "$RELEASE_VER" ]; then
	echo "=== Creating Release Version: $RELEASE_VER ==="
	RELEASE_DIR="$DST_DIR/$RELEASE_VER"
	mkdir -p "$RELEASE_DIR"
	rsync -a --delete "$SRC_DIR/dev/" "$RELEASE_DIR/"

	# Automatically update versions.json at root if it exists
	VERSIONS_JSON="$DST_DIR/versions.json"
	if [ -f "$VERSIONS_JSON" ]; then
		echo "=== Registering version $RELEASE_VER in versions.json ==="
		node -e '
			const fs = require("fs");
			const file = "'"$VERSIONS_JSON"'";
			const data = JSON.parse(fs.readFileSync(file, "utf8"));
			if (!data.versions.includes("'"$RELEASE_VER"'")) {
				// Insert after "dev" or at the beginning of active versions
				const devIndex = data.versions.indexOf("dev");
				if (devIndex !== -1) {
					data.versions.splice(devIndex + 1, 0, "'"$RELEASE_VER"'");
				} else {
					data.versions.unshift("'"$RELEASE_VER"'");
				}
				fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
				console.log("Registered '"$RELEASE_VER"' in versions.json");
			} else {
				console.log("'"$RELEASE_VER"' already registered in versions.json");
			}
		'
	fi
fi


# 1. Update/copy the root "Standortverwaltung" (from the root of build output)
# We exclude the dev and version-specific subdirectories during root copy
rsync -a --delete --exclude="/dev/" --exclude="/[0-9]*/" "$SRC_DIR/" "$DST_DIR/"

# 2. Update/copy the dev version
mkdir -p "$DST_DIR/dev"
rsync -a --delete "$SRC_DIR/dev/" "$DST_DIR/dev/"

# 3. If a release version is specified, create a new release folder and copy dev to it
RELEASE_VER="$1"
if [ -n "$RELEASE_VER" ]; then
	echo "=== Creating Release Version: $RELEASE_VER ==="
	RELEASE_DIR="$DST_DIR/$RELEASE_VER"
	mkdir -p "$RELEASE_DIR"
	rsync -a --delete "$SRC_DIR/dev/" "$RELEASE_DIR/"

	# Automatically update versions.json at root if it exists
	VERSIONS_JSON="$DST_DIR/versions.json"
	if [ -f "$VERSIONS_JSON" ]; then
		echo "=== Registering version $RELEASE_VER in versions.json ==="
		node -e '
			const fs = require("fs");
			const file = "'"$VERSIONS_JSON"'";
			const data = JSON.parse(fs.readFileSync(file, "utf8"));
			if (!data.versions.includes("'"$RELEASE_VER"'")) {
				// Insert after "dev" or at the beginning of active versions
				const devIndex = data.versions.indexOf("dev");
				if (devIndex !== -1) {
					data.versions.splice(devIndex + 1, 0, "'"$RELEASE_VER"'");
				} else {
					data.versions.unshift("'"$RELEASE_VER"'");
				}
				fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
				console.log("Registered '"$RELEASE_VER"' in versions.json");
			} else {
				console.log("'"$RELEASE_VER"' already registered in versions.json");
			}
		'
	fi
fi

chown -R stefan:www "$DST_DIR" 2>/dev/null || true
echo "=== ui deploy done ==="

