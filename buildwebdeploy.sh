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

resolve_release_version() {
	# 1) Explicit arg has priority.
	if [ -n "$1" ]; then
		echo "$1"
		return
	fi

	# 2) Optional env fallback.
	if [ -n "$RELEASE_VER" ]; then
		echo "$RELEASE_VER"
		return
	fi

	# 3) Optional legacy fallback: only when explicitly enabled.
	# This avoids accidentally reusing stale catalog versions (e.g. 2.4.0.213).
	if [ "${AUTO_RELEASE_FROM_CATALOG:-0}" = "1" ]; then
		local catalog="$SRC_DIR/versions.json"
		if [ -f "$catalog" ]; then
			node -e '
				try {
					const fs = require("fs");
					const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
					if (!Array.isArray(data.versions)) process.exit(0);
					const ver = data.versions.find(v => typeof v === "string" && v !== "dev");
					if (ver) process.stdout.write(ver);
				} catch (_) {}
			' "$catalog"
		fi
	fi
}

echo "=== Promoting betaui -> ui ($DST_DIR) ==="
mkdir -p "$DST_DIR"

# 1. Update/copy the root "Standortverwaltung" (from the root of build output)
# We exclude the dev and version-specific subdirectories during root copy.
rsync -a --delete --exclude="/dev/" --exclude="/[0-9]*/" "$SRC_DIR/" "$DST_DIR/"

# 2. Update/copy the dev version.
mkdir -p "$DST_DIR/dev"
rsync -a --delete "$SRC_DIR/dev/" "$DST_DIR/dev/"

# 3. Create/update release folder in ui-live for each release.
RELEASE_VER="$(resolve_release_version "$1")"
if [ -n "$RELEASE_VER" ]; then
	case "$RELEASE_VER" in
		*[!0-9.]* )
			echo "WARN: Release version '$RELEASE_VER' has unexpected format. Skip release folder creation." >&2
			;;
		* )
			echo "=== Creating Release Version: $RELEASE_VER ==="
			RELEASE_DIR="$DST_DIR/$RELEASE_VER"
			mkdir -p "$RELEASE_DIR"
			rsync -a --delete "$SRC_DIR/dev/" "$RELEASE_DIR/"

			# Automatically update versions.json at root if it exists.
			VERSIONS_JSON="$DST_DIR/versions.json"
			if [ -f "$VERSIONS_JSON" ]; then
				echo "=== Registering version $RELEASE_VER in versions.json ==="
				node -e '
					const fs = require("fs");
					const file = process.argv[1];
					const releaseVer = process.argv[2];
					const data = JSON.parse(fs.readFileSync(file, "utf8"));
					if (!Array.isArray(data.versions)) data.versions = [];
					if (!data.versions.includes(releaseVer)) {
						const devIndex = data.versions.indexOf("dev");
						if (devIndex !== -1) {
							data.versions.splice(devIndex + 1, 0, releaseVer);
						} else {
							data.versions.unshift(releaseVer);
						}
						fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
						console.log("Registered " + releaseVer + " in versions.json");
					} else {
						console.log(releaseVer + " already registered in versions.json");
					}
				' "$VERSIONS_JSON" "$RELEASE_VER"
			fi
			;;
	esac
else
	echo "INFO: No release version specified/detected. Updated root + dev only."
fi

chown -R stefan:www "$DST_DIR" 2>/dev/null || true
echo "=== ui deploy done ==="

