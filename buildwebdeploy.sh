#!/bin/sh
# Promote betaui staging -> ui production (LOCAL).
# Source:  /srv/www/htdocs/ui-test/www/  (= betaui.opensprinklershop.de docroot)
# Target:  /srv/www/htdocs/ui-live/www/  (= ui.opensprinklershop.de docroot)
set -e

SRC_DIR="/srv/www/htdocs/ui-test/www/"
DST_DIR="/srv/www/htdocs/ui-live/www"

if [ ! -d "$SRC_DIR" ]; then
	echo "ERROR: betaui source not found at $SRC_DIR" >&2
	echo "Run ./buildweb.sh first to populate it." >&2
	exit 1
fi

echo "=== Promoting betaui -> ui ($DST_DIR) ==="
mkdir -p "$DST_DIR"
rsync -a --delete "$SRC_DIR" "$DST_DIR/"
chown -R stefan:www "$DST_DIR" 2>/dev/null || true
echo "=== ui deploy done ==="

