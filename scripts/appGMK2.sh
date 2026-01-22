#!/bin/sh

<<<<<<< HEAD
if [[ $OSTYPE == 'darwin'* ]]; then
	sed -i "" "s/$GOOGLEMAPSAPIKEY/GOOGLEMAPSAPIKEY/g" www/js/*.js
=======
if [ -z "$GOOGLEMAPSAPIKEY" ]; then
	echo "GOOGLEMAPSAPIKEY ist leer; Ersetzung wird übersprungen."
	exit 0
fi

if [ "${OSTYPE#darwin}" != "$OSTYPE" ]; then
	sed -i "" "s/$GOOGLEMAPSAPIKEY/GOOGLEMAPSAPIKEY/g" www/js/modules/*.js
>>>>>>> e6c4cf6c60c358c264282b4352f50af8519a1f76
else
	sed -i "s/$GOOGLEMAPSAPIKEY/GOOGLEMAPSAPIKEY/g" www/js/*.js
fi
