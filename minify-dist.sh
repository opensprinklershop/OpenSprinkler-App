#!/bin/sh
# minify-dist.sh <src_dir>
# Erzeugt eine minifizierte Kopie <src_dir>-min (JS via terser, CSS via cleancss)
# und gibt deren Pfad auf stdout aus. Nur die App-Assets in js/, vendor-js/, css/
# werden minifiziert; bereits-minifizierte Dateien (*.min.js/*.min.css), der dev/-
# Ordner und die versionierten OTA-Ordner (2.x.y) bleiben unangetastet.
# Bei Fehlern bleibt die Originaldatei erhalten (kein kaputtes Deploy).
set -e

SRC="${1%/}"
if [ -z "$SRC" ] || [ ! -d "$SRC" ]; then
	echo "minify-dist: Quellverzeichnis '$SRC' fehlt" >&2
	exit 1
fi
MIN="$SRC-min"

command -v terser  >/dev/null 2>&1 || { echo "minify-dist: terser fehlt"  >&2; exit 1; }
command -v cleancss >/dev/null 2>&1 || { echo "minify-dist: cleancss fehlt" >&2; exit 1; }

rm -rf "$MIN"
cp -a "$SRC" "$MIN"

jscount=0; jsfail=0
for dir in js vendor-js; do
	[ -d "$MIN/$dir" ] || continue
	find "$MIN/$dir" -type f -name '*.js' ! -name '*.min.js' | while IFS= read -r f; do
		tmp="$f.__min__.js"
		if terser "$f" -c -m -o "$tmp" 2>/dev/null && node --check "$tmp" 2>/dev/null; then
			mv "$tmp" "$f"
		else
			rm -f "$tmp"
			echo "  WARN: terser uebersprungen (Original behalten): ${f#$MIN/}" >&2
		fi
	done
done

for dir in css; do
	[ -d "$MIN/$dir" ] || continue
	find "$MIN/$dir" -type f -name '*.css' ! -name '*.min.css' | while IFS= read -r f; do
		if cleancss -O2 -o "$f.min.tmp" "$f" 2>/dev/null && [ -s "$f.min.tmp" ]; then
			mv "$f.min.tmp" "$f"
		else
			rm -f "$f.min.tmp"
			echo "  WARN: cleancss uebersprungen (Original behalten): ${f#$MIN/}" >&2
		fi
	done
done

echo "$MIN"
