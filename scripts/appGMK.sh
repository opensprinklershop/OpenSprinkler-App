#!/bin/sh

echo "$GOOGLEMAPSAPIKEY"
if [ -z "$GOOGLEMAPSAPIKEY" ]; then
	echo "GOOGLEMAPSAPIKEY ist leer; Ersetzung wird übersprungen."
	exit 0
fi

if [ "${OSTYPE#darwin}" != "$OSTYPE" ]; then
	sed -i "" "s/GOOGLEMAPSAPIKEY/$GOOGLEMAPSAPIKEY/g" www/js/modules/*.js
	echo "macos"
else
	sed -i "s/GOOGLEMAPSAPIKEY/$GOOGLEMAPSAPIKEY/g" www/js/modules/*.js
	echo "linux"
fi
