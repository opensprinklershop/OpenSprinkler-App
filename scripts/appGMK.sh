#!/bin/sh

echo "$GOOGLEMAPSAPIKEY"
if [[ $OSTYPE == 'darwin'* ]]; then
	sed -i "" "s/GOOGLEMAPSAPIKEY/$GOOGLEMAPSAPIKEY/g" www/js/modules/*.js
	echo "macos"
else
	sed -i "s/GOOGLEMAPSAPIKEY/$GOOGLEMAPSAPIKEY/g" www/js/modules/*.js
	echo "linux"
fi
