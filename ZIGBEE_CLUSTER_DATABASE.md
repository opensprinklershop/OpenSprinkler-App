# ZigBee Cluster ID Database

## Overview

This system enables centralized management of ZigBee sensor configurations via an online JSON file. Users can select known sensors from a dropdown list instead of manually entering Cluster IDs and Attribute IDs.

## How It Works

### 1. Online Data Source

ZigBee cluster data is loaded from a central JSON file:
```
https://opensprinklershop.de/zigbeeclusterids.json
```

### 2. JSON File Format

The JSON file contains an array of sensor definitions. Example:

```json
[
  {
    "id": "aqara_temp_humidity",
    "name": "Aqara Temperature & Humidity Sensor",
    "description": "Temperature measurement",
    "endpoint": "1",
    "cluster_id": "0x0402",
    "attribute_id": "0x0000",
    "poll_interval": "60000",
    "unitid": "2",
    "unit": "°C",
    "factor": "100",
    "divider": "1",
    "offset": "0"
  },
  {
    "id": "tuya_soil_moisture",
    "name": "Tuya Soil Moisture Sensor",
    "description": "Soil moisture measurement",
    "endpoint": "1",
    "cluster_id": "0x0408",
    "attribute_id": "0x0000",
    "poll_interval": "60000",
    "unitid": "1",
    "unit": "%",
    "factor": "100",
    "divider": "1",
    "offset": "0"
  }
]
```

### 3. Field Descriptions

- **id**: Unique identifier for the sensor (not displayed in UI)
- **name**: Sensor name (displayed in dropdown list)
- **description**: Measurement description (displayed in parentheses)
- **endpoint**: ZigBee Endpoint (typically "1")
- **cluster_id**: Cluster ID in hexadecimal format (e.g., "0x0402" for temperature)
- **attribute_id**: Attribute ID in hexadecimal format (e.g., "0x0000")
- **poll_interval**: Poll interval in milliseconds (optional, default: 60000 = 60 seconds)
- **unitid**: Chart unit ID (0=Default, 1=Soil Moisture %, 2=°C, 3=°F, 4=Volt, 5=Air Humidity %, 6=Inch, 7=mm, 8=MPH, 9=KM/H, 10=Level %, 11=DK, 12=Lumen, 13=LUX, 99=Custom)
- **unit**: Custom unit string (used when unitid=99)
- **factor**: Multiplication factor for sensor value conversion
- **divider**: Division factor for sensor value conversion
- **offset**: Offset in millivolt for sensor calibration

### 4. UI Usage

When a user configures a ZigBee sensor:

1. The app automatically loads the JSON file from the URL
2. Data is cached to avoid repeated requests
3. A dropdown list "Known Sensor Types" is populated with sensor names
4. When selecting a sensor, the following fields are automatically populated:
   - Endpoint
   - Cluster ID
   - Attribute ID
   - Poll Interval
   - Unit ID
   - Unit (if custom)
   - Factor
   - Divider
   - Offset
   - Sensor Name (if the name field is empty)

### 5. Reporting New Sensors

Users can click the "Report New Sensor" button to:
- Send an email to info@opensprinklershop.de with current sensor data
- This data can then be added to the central JSON file

## Common ZigBee Cluster IDs

### Temperature
- **Cluster ID**: 0x0402
- **Attribute ID**: 0x0000
- **Value**: Temperature in hundredths of degrees Celsius
- **Factor**: 100, **Divider**: 1 (to convert to °C)

### Humidity
- **Cluster ID**: 0x0405
- **Attribute ID**: 0x0000
- **Value**: Relative humidity in hundredths of percent
- **Factor**: 100, **Divider**: 1 (to convert to %)

### Soil Moisture
- **Cluster ID**: 0x0408
- **Attribute ID**: 0x0000
- **Value**: Soil moisture in percent
- **Factor**: 100, **Divider**: 1

### Illuminance
- **Cluster ID**: 0x0400
- **Attribute ID**: 0x0000
- **Value**: Illuminance in Lux
- **Factor**: 1, **Divider**: 1

## File Hosting

The file `zigbeeclusterids.json` should be accessible on a web server at:
```
https://opensprinklershop.de/zigbeeclusterids.json
```

### Apache/nginx Configuration

Ensure that:
1. The file is accessible via HTTPS
2. CORS headers are set to allow cross-origin requests:
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET
   Content-Type: application/json
   ```

## Maintenance

### Adding New Sensors

1. Edit the JSON file on the server
2. Add a new entry with all required fields
3. Save and upload
4. Changes are immediately available to all users (on next load)

### Cache

The app caches JSON data during the session. To update the cache, the page must be reloaded.

## Security

- JSON file is loaded via HTTPS
- Only read access is performed
- On loading errors, an empty array is returned
- Errors are logged in the browser console
