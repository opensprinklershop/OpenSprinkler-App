#!/bin/bash
# Upload firmware binaries / manifest to IONOS upgrade/ folder.
# Usage: ./fw.sh [FILE ...]
#   - No args: syncs the entire local /srv/www/htdocs/upgrade/ tree
#   - Args:    uploads each given file directly into the remote upgrade/ root
#
# Reads credentials from ./.env (IONOS_SSH_*, IONOS_UPGRADE_TARGET).

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$SCRIPT_DIR/.env" ]; then
	echo "ERROR: $SCRIPT_DIR/.env not found" >&2
	exit 1
fi
# shellcheck disable=SC1091
set -a
. "$SCRIPT_DIR/.env"
set +a

: "${IONOS_SSH_HOST:?IONOS_SSH_HOST missing in .env}"
: "${IONOS_SSH_USER:?IONOS_SSH_USER missing in .env}"
: "${IONOS_SSH_PORT:=22}"
: "${IONOS_SSH_PASS:?IONOS_SSH_PASS missing in .env}"
: "${IONOS_UPGRADE_TARGET:=/home/www/public/upgrade}"

export SSHPASS="$IONOS_SSH_PASS"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -p $IONOS_SSH_PORT"
REMOTE="$IONOS_SSH_USER@$IONOS_SSH_HOST"

echo "=== Ensuring $IONOS_UPGRADE_TARGET exists on $IONOS_SSH_HOST ==="
sshpass -e ssh $SSH_OPTS "$REMOTE" "mkdir -p '$IONOS_UPGRADE_TARGET'"

if [ "$#" -eq 0 ]; then
	LOCAL_SRC="${LOCAL_UPGRADE_SRC:-/srv/www/htdocs/upgrade/}"
	echo "=== Syncing $LOCAL_SRC -> $REMOTE:$IONOS_UPGRADE_TARGET/ ==="
	sshpass -e rsync -az --info=stats2 \
		-e "ssh $SSH_OPTS" \
		"$LOCAL_SRC" \
		"$REMOTE:$IONOS_UPGRADE_TARGET/"
else
	echo "=== Uploading $# file(s) to $REMOTE:$IONOS_UPGRADE_TARGET/ ==="
	sshpass -e rsync -az --info=stats2 \
		-e "ssh $SSH_OPTS" \
		"$@" \
		"$REMOTE:$IONOS_UPGRADE_TARGET/"
fi

echo "=== Done ==="
