# Analog Sensor API Documentation

## Overview

The Analog Sensor API is a comprehensive JavaScript module for managing analog sensors, monitors, and program adjustments in the OpenSprinkler application. The API consists of two main files:

- **`analog.js`** - Core functionality for sensor management, data visualization, and configuration

---

## Table of Contents

1. [Core Modules](#core-modules)
2. [Data Structures](#data-structures)
3. [Constants](#constants)
4. [API Functions](#api-functions)
5. [Sensor Types](#sensor-types)
6. [Monitor System](#monitor-system)
7. [Program Adjustments](#program-adjustments)
8. [Data Visualization](#data-visualization)
9. [ZigBee Integration](#zigbee-integration)
10. [Bluetooth Integration](#bluetooth-integration)
11. [Configuration Management](#configuration-management)

---

## Core Modules

### OSApp.Analog

Main namespace for all analog sensor functionality.

**Properties:**
- `analogSensors` - Array of all configured sensors
- `progAdjusts` - Array of program adjustments
- `monitors` - Array of monitor configurations
- `monitorAlerts` - Object tracking active monitor alerts
- `expandItem` - Set of expanded UI items
- `timer` - Background timer for updates
- `zigbeeClusterData` - Cached ZigBee cluster definitions

### Firmware runtime behavior (BLE/ZigBee)
- **Scan/Register mode**: scan is only started on explicit request.
- **Data mode**: sensor data pipeline is active.
- **BLE remains active permanently** in firmware runtime to support asynchronous updates.
- **BLE active query + passive report devices are both supported**:
  - passive/reporting devices push updates spontaneously;
  - active/query devices are read on interval.
- If new data arrives before the next scheduled interval, firmware accepts the new values immediately.

---

## Data Structures

### Sensor Object

```javascript
{
  nr: Number,           // Sensor number (unique ID)
  type: Number,         // Sensor type (see Constants)
  name: String,         // Display name
  group: Number,        // Group ID for sensor grouping
  ip: String,           // IP address (for network sensors)
  port: Number,         // Port number
  id: Number,           // Device ID / Modbus ID
  enable: Number,       // 1 = enabled, 0 = disabled
  log: Number,          // 1 = logging enabled, 0 = disabled
  show: Number,         // 1 = show on main page, 0 = hidden
  ri: Number,           // Read interval in seconds
  fac: Number,          // Factor for value conversion
  div: Number,          // Divider for value conversion
  offset: Number,       // Offset in millivolts
  unitid: Number,       // Chart unit ID
  unit: String,         // Custom unit string

  // ZigBee specific
  device_ieee: String,  // IEEE address
  endpoint: Number,     // ZigBee endpoint
  cluster_id: Number,   // Cluster ID (hex)
  attribute_id: Number, // Attribute ID (hex)
  poll_interval: Number,// Poll interval in ms

  // Bluetooth specific
  device_mac: String,   // MAC address
  service_uuid: String, // Service UUID
  char_uuid: String,    // Characteristic UUID

  // MQTT specific
  topic: String,        // MQTT topic
  filter: String,       // JSON filter path

  // Runtime data
  value: Number,        // Current sensor value
  last: Number,         // Last update timestamp
}
```

### Monitor Object

```javascript
{
  nr: Number,           // Monitor number (unique ID)
  name: String,         // Monitor name
  type: Number,         // Monitor type (AND, OR, XOR, etc.)
  enable: Number,       // 1 = enabled, 0 = disabled
  active: Number,       // Current state (1 = active, 0 = inactive)
  prio: Number,         // Priority (0 = low, 1 = medium, 2 = high)

  // Sensor references
  s1: Number,           // Sensor 1 ID
  s2: Number,           // Sensor 2 ID (for logical operations)

  // Thresholds
  min: Number,          // Minimum threshold
  max: Number,          // Maximum threshold

  // Time window
  time1: String,        // Start time (HH:MM)
  time2: String,        // End time (HH:MM)
}
```

### Program Adjustment Object

```javascript
{
  nr: Number,           // Adjustment number (unique ID)
  name: String,         // Adjustment name
  type: Number,         // Adjustment type
  sensor: Number,       // Sensor ID to monitor
  prog: Number,         // Program ID to adjust
  enable: Number,       // 1 = enabled, 0 = disabled

  // Factors
  fac1: Number,         // Factor 1 (for minimum)
  fac2: Number,         // Factor 2 (for maximum)

  // Thresholds
  min: Number,          // Minimum sensor value
  max: Number,          // Maximum sensor value
}
```

---

## Constants

### Sensor Types

```javascript
// RS485 Sensors
SENSOR_SMT100_MOIS: 1       // Truebner SMT100 - moisture
SENSOR_SMT100_TEMP: 2       // Truebner SMT100 - temperature
SENSOR_SMT100_PMTY: 3       // Truebner SMT100 - permittivity
SENSOR_TH100_MOIS: 4        // Truebner TH100 - humidity
SENSOR_TH100_TEMP: 5        // Truebner TH100 - temperature

// Analog Extension Board (0-4V)
SENSOR_ANALOG_EXTENSION_BOARD: 10    // Voltage mode
SENSOR_ANALOG_EXTENSION_BOARD_P: 11  // Percent mode
SENSOR_SMT50_MOIS: 15                // SMT50 moisture
SENSOR_SMT50_TEMP: 16                // SMT50 temperature
SENSOR_SMT100_ANALOG_MOIS: 17        // SMT100 analog moisture
SENSOR_SMT100_ANALOG_TEMP: 18        // SMT100 analog temperature
SENSOR_VH400: 30                      // Vegetronix VH400
SENSOR_THERM200: 31                   // Vegetronix THERM200
SENSOR_AQUAPLUMB: 32                  // Vegetronix Aquaplumb
SENSOR_USERDEF: 49                    // User-defined sensor

// OSPi Analog Input (0-3.3V)
SENSOR_OSPI_ANALOG: 50               // Voltage mode
SENSOR_OSPI_ANALOG_P: 51             // Percent mode
SENSOR_OSPI_ANALOG_SMT50_MOIS: 52    // SMT50 moisture
SENSOR_OSPI_ANALOG_SMT50_TEMP: 53    // SMT50 temperature
SENSOR_OSPI_INTERNAL_TEMP: 54        // Internal temperature

// Cloud Sensors
SENSOR_FYTA_MOISTURE: 60             // FYTA moisture
SENSOR_FYTA_TEMPERATURE: 61          // FYTA temperature

// Wireless Sensors
SENSOR_ZIGBEE: 80                    // ZigBee sensor
SENSOR_BLUETOOTH: 81                 // Bluetooth sensor
SENSOR_MQTT: 90                      // MQTT sensor

// Remote/Weather Sensors
SENSOR_REMOTE: 100                   // Remote OpenSprinkler sensor
SENSOR_WEATHER_TEMP_F: 101           // Weather temperature (°F)
SENSOR_WEATHER_TEMP_C: 102           // Weather temperature (°C)
SENSOR_WEATHER_HUM: 103              // Weather humidity
SENSOR_WEATHER_PRECIP_IN: 105        // Weather precipitation (inch)
SENSOR_WEATHER_PRECIP_MM: 106        // Weather precipitation (mm)
SENSOR_WEATHER_WIND_MPH: 107         // Weather wind (mph)
SENSOR_WEATHER_WIND_KMH: 108         // Weather wind (km/h)
SENSOR_WEATHER_ETO: 109              // Weather ETO
SENSOR_WEATHER_RADIATION: 110        // Weather radiation

// Sensor Groups
SENSOR_GROUP_MIN: 1000               // Group minimum value
SENSOR_GROUP_MAX: 1001               // Group maximum value
SENSOR_GROUP_AVG: 1002               // Group average value
SENSOR_GROUP_SUM: 1003               // Group sum value

// System Sensors
SENSOR_FREE_MEMORY: 10000            // Free memory
SENSOR_FREE_STORE: 10001             // Free storage
```

### Monitor Types

```javascript
MONITOR_AND: 10         // Logical AND
MONITOR_OR: 11          // Logical OR
MONITOR_XOR: 12         // Logical XOR
MONITOR_NOT: 13         // Logical NOT
MONITOR_TIME: 14        // Time-based
MONITOR_REMOTE: 100     // Remote monitor
```

### Program Adjustment Types

```javascript
PROG_LINEAR: 1          // Linear adjustment
PROG_DIGITAL_MIN: 2     // Digital minimum threshold
PROG_DIGITAL_MAX: 3     // Digital maximum threshold
PROG_DIGITAL_MINMAX: 4  // Digital min/max range
```

### Unit IDs

```javascript
0:  Default
1:  Soil Moisture %
2:  Degree Celsius °C
3:  Degree Fahrenheit °F
4:  Volt V
5:  Air Humidity %
6:  Inch in
7:  Millimeter mm
8:  MPH
9:  KM/H
10: Level %
11: DK
12: Lumen (lm)
13: LUX (lx)
99: Custom Unit
```

---

## API Functions

### Initialization & Status

#### `OSApp.Analog.asb_init()`
Initializes the analog sensor board functionality, including background mode and notifications.

**Parameters:** None
**Returns:** void

**Usage:**
```javascript
OSApp.Analog.asb_init();
```

#### `OSApp.Analog.checkAnalogSensorAvail()`
Checks if analog sensor functionality is available.

**Returns:** `Boolean` - true if ASB feature is available

**Usage:**
```javascript
if (OSApp.Analog.checkAnalogSensorAvail()) {
  // Initialize sensors
}
```

#### `OSApp.Analog.isESP32()`
Checks if the controller is ESP32-based.

**Returns:** `Boolean` - true if ESP32 controller

---

### Data Management

#### `OSApp.Analog.updateAnalogSensor(callback)`
Updates all sensor data from the controller.

**Parameters:**
- `callback` (Function, optional) - Callback function after update

**Returns:** `Promise`

**Usage:**
```javascript
OSApp.Analog.updateAnalogSensor(function() {
  console.log('Sensors updated:', OSApp.Analog.analogSensors);
});
```

#### `OSApp.Analog.updateProgramAdjustments(callback)`
Updates program adjustment data.

**Parameters:**
- `callback` (Function, optional) - Callback function after update

**Returns:** `Promise`

**Usage:**
```javascript
OSApp.Analog.updateProgramAdjustments(function() {
  console.log('Adjustments updated');
});
```

#### `OSApp.Analog.updateMonitors(callback)`
Updates monitor configurations and checks alerts.

**Parameters:**
- `callback` (Function, optional) - Callback function after update

**Returns:** `Promise`

**Usage:**
```javascript
OSApp.Analog.updateMonitors(function() {
  console.log('Monitors updated');
});
```

---

### Sensor Configuration

#### `OSApp.Analog.showSensorEditor(sensor, row, callback, callbackCancel)`
Displays the sensor editor dialog.

**Parameters:**
- `sensor` (Object) - Sensor object to edit (or empty object for new sensor)
- `row` (Number) - Row index in sensor list (-1 for new sensor)
- `callback` (Function) - Callback function after save
- `callbackCancel` (Function) - Callback function on cancel

**Returns:** void

**Usage:**
```javascript
// Edit existing sensor
OSApp.Analog.showSensorEditor(sensor, 0, function() {
  console.log('Sensor saved');
});

// Create new sensor
OSApp.Analog.showSensorEditor({}, -1, function() {
  console.log('New sensor created');
});
```

#### `OSApp.Analog.saveSensor(popup, sensor, callback)`
Saves sensor configuration to controller.

**Parameters:**
- `popup` (jQuery) - The editor popup element
- `sensor` (Object) - Sensor object
- `callback` (Function) - Callback function after save

**Returns:** void

#### `OSApp.Analog.updateSensorVisibility(popup, type)`
Updates field visibility in sensor editor based on sensor type.

**Parameters:**
- `popup` (jQuery) - The editor popup element
- `type` (Number) - Sensor type

**Returns:** void

---

### Monitor Configuration

#### `OSApp.Analog.showMonitorEditor(monitor, row, callback, callbackCancel)`
Displays the monitor editor dialog.

**Parameters:**
- `monitor` (Object) - Monitor object to edit
- `row` (Number) - Row index in monitor list
- `callback` (Function) - Callback function after save
- `callbackCancel` (Function) - Callback function on cancel

**Returns:** void

**Usage:**
```javascript
OSApp.Analog.showMonitorEditor(monitor, 0, function() {
  console.log('Monitor saved');
});
```

#### `OSApp.Analog.checkMonitorAlerts()`
Checks monitor states and triggers notifications.

**Returns:** void

**Usage:**
```javascript
OSApp.Analog.checkMonitorAlerts();
```

#### `OSApp.Analog.getMonitorName(monitorNr)`
Gets the name of a monitor by its number.

**Parameters:**
- `monitorNr` (Number) - Monitor number

**Returns:** `String` - Monitor name

---

### Program Adjustments

#### `OSApp.Analog.showAdjustmentsEditor(progAdjust, row, callback, callbackCancel)`
Displays the program adjustment editor dialog.

**Parameters:**
- `progAdjust` (Object) - Program adjustment object
- `row` (Number) - Row index
- `callback` (Function) - Callback after save
- `callbackCancel` (Function) - Callback on cancel

**Returns:** void

**Usage:**
```javascript
OSApp.Analog.showAdjustmentsEditor(adjustment, 0, function() {
  console.log('Adjustment saved');
});
```

#### `OSApp.Analog.updateAdjustmentChart(popup)`
Updates the adjustment preview chart.

**Parameters:**
- `popup` (jQuery) - The editor popup element

**Returns:** void

---

### Data Visualization

#### `OSApp.Analog.showAnalogSensorCharts(limit2sensor)`
Displays sensor data charts.

**Parameters:**
- `limit2sensor` (Number, optional) - Limit display to specific sensor number

**Returns:** void

**Usage:**
```javascript
// Show all sensor charts
OSApp.Analog.showAnalogSensorCharts();

// Show specific sensor chart
OSApp.Analog.showAnalogSensorCharts(1);
```

#### `OSApp.Analog.updateCharts(limit2sensor)`
Updates chart data.

**Parameters:**
- `limit2sensor` (Number, optional) - Limit to specific sensor

**Returns:** void

#### `OSApp.Analog.buildGraph(prefix, chart, csv, titleAdd, timestr, tzo, lvl)`
Builds ApexCharts graph from CSV data.

**Parameters:**
- `prefix` (String) - Container element ID prefix
- `chart` (Number) - Chart index
- `csv` (String) - CSV data
- `titleAdd` (String) - Additional title text
- `timestr` (String) - Time range string
- `tzo` (Number) - Timezone offset
- `lvl` (Number) - Detail level

**Returns:** void

---

### ZigBee Integration

#### `OSApp.Analog.loadZigBeeClusterData()`
Loads ZigBee cluster definitions from online database.

**Returns:** `Promise<Array>` - Array of cluster definitions

**Usage:**
```javascript
OSApp.Analog.loadZigBeeClusterData().then(function(data) {
  console.log('Cluster data loaded:', data);
});
```

#### `OSApp.Analog.showZigBeeDeviceScanner(popup, callback)`
Displays ZigBee device scanner.

**Parameters:**
- `popup` (jQuery) - Parent popup element
- `callback` (Function) - Callback with selected device

**Returns:** void

**Usage:**
```javascript
OSApp.Analog.showZigBeeDeviceScanner(popup, function(device) {
  console.log('Selected device:', device.ieee, device.model);
});
```

**Callback receives:**
```javascript
{
  ieee: String,         // IEEE address (primary field from backend)
  short_addr: String,   // Short address (from backend)
  model: String,        // Model ID (primary field from backend)
  manufacturer: String, // Manufacturer name
  endpoint: Number,     // ZigBee endpoint
  device_id: Number,    // Device ID
  is_new: Number        // 1 if newly paired, 0 if existing
}
```

**Backend Response Format:**
```javascript
{
  "devices": [
    {
      "ieee": "0x00158D0001234567",
      "short_addr": 12345,
      "model": "lumi.sensor_motion.aq2",
      "manufacturer": "LUMI",
      "endpoint": 1,
      "device_id": 263,
      "is_new": 1
    }
  ]
}
```

---

### Bluetooth Integration

#### `OSApp.Analog.showBluetoothDeviceScanner(popup, callback)`
Displays Bluetooth device scanner.

**Parameters:**
- `popup` (jQuery) - Parent popup element
- `callback` (Function) - Callback with selected device

**Returns:** void

**Usage:**
```javascript
OSApp.Analog.showBluetoothDeviceScanner(popup, function(device) {
  console.log('Selected device:', device.mac, device.name);
});
```

**Callback receives:**
```javascript
{
  mac: String,   // MAC address (from backend)
  name: String,  // Device name
  rssi: Number   // Signal strength in dBm
}
```

**Backend Response Format:**
```javascript
{
  "devices": [
    {
      "mac": "AA:BB:CC:DD:EE:FF",
      "name": "Temperature Sensor",
      "rssi": -65
    }
  ]
}
```

---

### Configuration Management

#### `OSApp.Analog.showAnalogSensorConfig()`
Displays main sensor configuration page.

**Returns:** void

**Usage:**
```javascript
OSApp.Analog.showAnalogSensorConfig();
```

#### `OSApp.Analog.buildSensorConfig()`
Builds sensor configuration UI.

**Returns:** void

#### `OSApp.Analog.getExportMethodSensors(backuptype)`
Exports sensor configuration.

**Parameters:**
- `backuptype` (String) - Export format ('json', 'csv')

**Returns:** String - Exported configuration

**Usage:**
```javascript
var config = OSApp.Analog.getExportMethodSensors('json');
```

#### `OSApp.Analog.importConfigSensors(data, restore_type, callback)`
Imports sensor configuration.

**Parameters:**
- `data` (String) - Configuration data
- `restore_type` (String) - Import format
- `callback` (Function) - Callback after import

**Returns:** void

**Usage:**
```javascript
OSApp.Analog.importConfigSensors(jsonData, 'json', function() {
  console.log('Import completed');
});
```

---

### Utility Functions

#### `OSApp.Analog.toByteArray(b)`
Converts 32-bit integer to byte array (IP address).

**Parameters:**
- `b` (Number) - 32-bit integer

**Returns:** `Array<Number>` - [byte1, byte2, byte3, byte4]

**Usage:**
```javascript
var ip = OSApp.Analog.toByteArray(0xC0A80101); // [192, 168, 1, 1]
```

#### `OSApp.Analog.intFromBytes(x)`
Converts byte array to 32-bit integer.

**Parameters:**
- `x` (Array<Number>) - Byte array [b1, b2, b3, b4]

**Returns:** `Number` - 32-bit integer

**Usage:**
```javascript
var int = OSApp.Analog.intFromBytes([192, 168, 1, 1]);
```

#### `OSApp.Analog.getUnit(sensor)`
Gets the unit string for a sensor.

**Parameters:**
- `sensor` (Object) - Sensor object

**Returns:** `String` - Unit string

**Usage:**
```javascript
var unit = OSApp.Analog.getUnit(sensor); // "°C", "%", etc.
```

#### `OSApp.Analog.formatVal(val)`
Formats sensor value for display.

**Parameters:**
- `val` (Number) - Value to format

**Returns:** `String` - Formatted value

**Usage:**
```javascript
var formatted = OSApp.Analog.formatVal(25.67); // "25.7"
```

#### `OSApp.Analog.formatValUnit(val, unit)`
Formats value with unit.

**Parameters:**
- `val` (Number) - Value
- `unit` (String) - Unit string

**Returns:** `String` - Formatted value with unit

**Usage:**
```javascript
var text = OSApp.Analog.formatValUnit(25.7, "°C"); // "25.7°C"
```

#### `OSApp.Analog.isNumber(n)`
Checks if value is a number.

**Parameters:**
- `n` (Any) - Value to check

**Returns:** `Boolean`

---

## API Endpoints

The API communicates with the controller via these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sl?pw=` | GET | List all sensors |
| `/ss?pw=` | POST | Save sensor |
| `/sd?pw=&nr=X` | POST | Delete sensor |
| `/se?pw=` | GET | Get program adjustments |
| `/sp?pw=` | POST | Save program adjustment |
| `/sd?pw=&nr=X` | POST | Delete program adjustment |
| `/ml?pw=` | GET | List monitors |
| `/ms?pw=` | POST | Save monitor |
| `/md?pw=&nr=X` | POST | Delete monitor |
| `/sf?pw=` | GET | Get supported sensor types |
| `/sa?pw=&nr=X&id=Y` | POST | Set SMT100 Modbus ID |
| `/zo?pw=&duration=X` | POST | Open ZigBee network (start pairing) |
| `/zd?pw=` | GET | Get ZigBee devices list |
| `/zc?pw=` | POST | Clear ZigBee flags |
| `/bs?pw=&duration=X` | POST | Start Bluetooth scan |
| `/bd?pw=` | GET | Get Bluetooth devices list |
| `/bc?pw=` | POST | Clear Bluetooth flags |
| `/fy?pw=` | GET | Get FYTA credentials |

---

## Background Operations

### Background Mode (Mobile)

On Android and iOS devices, the API supports background monitoring:

```javascript
// Automatically enabled when monitors are configured
OSApp.Analog.checkBackgroundMode();
```

**Features:**
- 30-second update interval in background
- Push notifications for monitor alerts
- Three priority levels (low, medium, high)

### Background Fetch (Mobile)

```javascript
// Configured with 15-minute minimum interval
BackgroundFetch.configure({
  minimumFetchInterval: 15,
  requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY
}, fetchCallback, failureCallback);
```

---

## Event Handling

### Sensor Value Updates

```javascript
OSApp.Analog.updateAnalogSensor(function() {
  // Access updated sensor data
  OSApp.Analog.analogSensors.forEach(function(sensor) {
    console.log(sensor.name, sensor.value);
  });
});
```

### Monitor Alerts

```javascript
OSApp.Analog.updateMonitors(function() {
  OSApp.Analog.monitors.forEach(function(monitor) {
    if (monitor.active) {
      console.log('Alert:', monitor.name);
    }
  });
});
```

---

## Best Practices

### 1. Error Handling

Always include error handlers when calling API functions:

```javascript
OSApp.Analog.updateAnalogSensor()
  .then(function() {
    // Success
  })
  .catch(function(error) {
    console.error('Failed to update sensors:', error);
  });
```

### 2. Update Frequency

Respect sensor read intervals to avoid overwhelming the controller:

```javascript
// Sensor with 60-second read interval
sensor.ri = 60;
```

### 3. Data Caching

The API caches data to reduce network requests:

```javascript
// Data is cached after first load
OSApp.Analog.updateAnalogSensor(); // Network request
// Subsequent access uses cached data
var sensors = OSApp.Analog.analogSensors;
```

### 4. Cleanup

Remove event handlers and stop timers when not needed:

```javascript
if (OSApp.Analog.timer) {
  OSApp.Analog.timer.stop();
}
```

---

## Examples

### Example 1: Create a Temperature Sensor

```javascript
var tempSensor = {
  nr: 1,
  type: OSApp.Analog.Constants.SENSOR_ZIGBEE,
  name: "Living Room Temperature",
  group: 0,
  enable: 1,
  log: 1,
  show: 1,
  ri: 60,
  device_ieee: "0x00158D0001234567",
  endpoint: 1,
  cluster_id: 0x0402,
  attribute_id: 0x0000,
  poll_interval: 60000,
  unitid: 2,
  factor: 100,
  divider: 1,
  offset: 0
};

OSApp.Analog.showSensorEditor(tempSensor, -1, function() {
  console.log('Temperature sensor created');
});
```

### Example 2: Create a Monitor

```javascript
var monitor = {
  nr: 1,
  name: "High Temperature Alert",
  type: OSApp.Analog.Constants.MONITOR_AND,
  enable: 1,
  prio: 2,
  s1: 1,  // Temperature sensor
  min: 0,
  max: 30 // Alert when > 30°C
};

OSApp.Analog.showMonitorEditor(monitor, -1, function() {
  console.log('Monitor created');
});
```

### Example 3: Create Program Adjustment

```javascript
var adjustment = {
  nr: 1,
  name: "Water Based on Moisture",
  type: OSApp.Analog.Constants.PROG_LINEAR,
  sensor: 2,  // Soil moisture sensor
  prog: 1,    // Program to adjust
  enable: 1,
  fac1: 50,   // 50% at minimum
  fac2: 150,  // 150% at maximum
  min: 20,    // 20% moisture
  max: 60     // 60% moisture
};

OSApp.Analog.showAdjustmentsEditor(adjustment, -1, function() {
  console.log('Adjustment created');
});
```

### Example 4: Display Sensor Charts

```javascript
// Show all sensor charts
OSApp.Analog.showAnalogSensorCharts();

// Show specific sensor (sensor #3)
OSApp.Analog.showAnalogSensorCharts(3);

// Update charts with latest data
OSApp.Analog.updateCharts();
```

---

## Version Compatibility

- **Minimum Firmware Version:** 2.3.0 (ID: 150)
- **Current Firmware Version:** 2.3.3 (ID: 172)
- **Recommended Firmware:** 2.3.3 or later

Check firmware version:

```javascript
if (OSApp.Firmware.checkOSVersion(233)) {
  // Features requiring firmware 2.3.3+
}
```

---

## Troubleshooting

### Common Issues

**1. Sensors not updating**
- Check read interval (ri) setting
- Verify network connectivity
- Check controller firmware version

**2. Bluetooth devices not found**
- Start scan with `/bs?pw=&duration=60` (scan for 60 seconds)
- Check device list with `/bd?pw=` (retrieve found devices)
- Ensure device is in discoverable/advertising mode
- Check Bluetooth is enabled on controller
- Clear flags with `/bc?pw=` after device selection

**4. Monitor alerts not working**
- Verify background mode is enabled
- Check notification permissions
- Ensure monitors are enabled

**5lear flags with `/zc?pw=` after device selection

**3. Monitor alerts not working**
- Verify background mode is enabled
- Check notification permissions
- Ensure monitors are enabled

**4. Charts not displaying**
- Verify data logging is enabled (`log: 1`)
- Check if ApexCharts library is loaded
- Ensure sufficient data points exist

---

## Support

For issues and feature requests:
- GitHub: https://github.com/opensprinklershop/OpenSprinkler-App
- Email: info@opensprinklershop.de

---

## License

Released under the MIT License
Copyright (c) 2023 OpenSprinklerShop
