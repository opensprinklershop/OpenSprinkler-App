#!/bin/sh

if [[ $OSTYPE == 'darwin'* ]]; then
	sed -i "" "s/$GOOGLEMAPSAPIKEY/GOOGLEMAPSAPIKEY/g" www/js/modules/*.js
else
	sed -i "s/$GOOGLEMAPSAPIKEY/GOOGLEMAPSAPIKEY/g" www/js/modules/*.js
fi
