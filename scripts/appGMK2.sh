#!/bin/sh

if [ -z "$GOOGLEMAPSAPIKEY" ]; then
	echo "GOOGLEMAPSAPIKEY ist leer; Ersetzung wird übersprungen."
	exit 0
fi

if [ "${OSTYPE#darwin}" != "$OSTYPE" ]; then
	sed -i "" "s/$GOOGLEMAPSAPIKEY/GOOGLEMAPSAPIKEY/g" www/js/modules/*.js
else
	sed -i "s/$GOOGLEMAPSAPIKEY/GOOGLEMAPSAPIKEY/g" www/js/*.js
fi
