#!/bin/sh

if [ -z "$GOOGLEMAPSAPIKEY" ]; then
	[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc"
	[ -z "$GOOGLEMAPSAPIKEY" ] && [ -f "$HOME/.zshrc" ] && . "$HOME/.zshrc"
fi

if [ -z "$GOOGLEMAPSAPIKEY" ]; then
	echo "GOOGLEMAPSAPIKEY ist leer; Ersetzung wird übersprungen."
	exit 0
fi
echo "GOOGLEMAPSAPIKEY geladen; ersetze Platzhalter in JS-Dateien."

if [ "${OSTYPE#darwin}" != "$OSTYPE" ]; then
	find www/js -type f -name "*.js" -exec sed -i "" "s|GOOGLEMAPSAPIKEY|$GOOGLEMAPSAPIKEY|g" {} +
	echo "macos"
else
	find www/js -type f -name "*.js" -exec sed -i "s|GOOGLEMAPSAPIKEY|$GOOGLEMAPSAPIKEY|g" {} +
	echo "linux"
fi
