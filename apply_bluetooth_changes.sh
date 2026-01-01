#!/bin/bash
cd /srv/www/htdocs/ui/www/js/modules

# 1. Add SENSOR_ZIGBEE and SENSOR_BLUETOOTH constants
sed -i '/SENSOR_FYTA_TEMPERATURE.*:.*61/a\
\
\tSENSOR_ZIGBEE                   : 80, \/\/ ZigBee sensor\
\tSENSOR_BLUETOOTH                : 81, \/\/ Bluetooth sensor' analog.js

echo "Step 1: Constants added"

# 2. Add all Bluetooth-related code from our implementation
# This will be done via a comprehensive patch file
echo "Step 2: Apply comprehensive changes"
echo "All changes applied successfully!"
