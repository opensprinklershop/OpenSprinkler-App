# Sensor Type / Editor Field Mapping

This table documents which fields are shown/hidden in the sensor editor for each sensor type.

## Field Visibility Logic

The field visibility is controlled by `OSApp.Analog.updateSensorVisibility()` in `www/js/modules/analog.js`.

### Helper Functions

| Function | Logic |
|---|---|
| `isSmt100(type)` | type 1–5 (SMT100/TH100 variants) |
| `isRS485Sensor(type)` | same as `isSmt100()` |
| `isIPSensor(type)` | `isSmt100()` OR type == 100 (REMOTE) |
| `isIDNeeded(type)` | type < 54 (OSPI_INTERNAL_TEMP) OR type == 100 (REMOTE) OR type == 60/61 (FYTA) |

### Field Groups

| Field Group | CSS Class / Container | Contains |
|---|---|---|
| Nr / Name / Group | (always visible) | Sensor number, name, group, sensor type |
| IP / Port | `.ip_port_container` | IP Address, Port |
| RS485 Port / Modbus ID | `.rs485_port_modbus_container` | RS485 Device/Port, Modbus ID |
| ID | `.id_label` | Sensor ID |
| MAC | `.mac_label` | MAC Address |
| Factor / Divider / Offset | `.fac_div_offset_container` | Factor, Divider, Offset |
| Chart Unit | `.chartunit_label` | Unit selector |
| Custom Unit | `.unit_container` | Custom unit text input |
| MQTT Topic | `.topic_container` | MQTT Topic |
| MQTT Filter | `.filter_container` | MQTT Filter |
| ZigBee IEEE | `.zigbee_device_ieee_container` | ZigBee Device IEEE Address |
| Known Sensor Types | `.zigbee_known_sensors_container` | Search + template select |
| ZigBee EP/Cluster/Attr | `.zigbee_endpoint_cluster_attribute_container` | Endpoint, Cluster ID, Attribute ID |
| Bluetooth Char UUID | `.bluetooth_char_uuid_container` | Characteristic UUID |
| Bluetooth Format | `.bluetooth_format_container` | Data format selector |
| Read Interval | `.ri_label` | Read Interval (s) |
| Enable / Log / Show | (always visible) | Checkboxes |
| ZigBee Scan | `#zigbeesel` + `.zigbee_scan_select_container` | Scan button + device list |
| Bluetooth Scan | `#bluetoothsel` + `.bluetooth_scan_select_container` | Scan button + device list |
| RS485 Help | `.rs485_help` | Configuration help text |
| SMT100 ID | `#smt100id` | SMT100-specific ID selector |
| FYTA Select | `#fytasel` | FYTA-specific plant selector |

## Sensor Type → Visible Fields Matrix

Legend: **✓** = shown, **—** = hidden, **always** = always visible

| Type | Code | IP/Port | RS485 Port/Modbus | ID | MAC | Fac/Div/Offset | MQTT Topic/Filter | ZigBee fields | BT fields | RS485 Help | SMT100 ID | FYTA Sel |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SMT100 Moisture | 1 | ✓ | ✓ | ✓ (Modbus) | — | — | — | — | — | ✓ | ✓ | — |
| SMT100 Temp | 2 | ✓ | ✓ | ✓ (Modbus) | — | — | — | — | — | ✓ | ✓ | — |
| SMT100 Permittivity | 3 | ✓ | ✓ | ✓ (Modbus) | — | — | — | — | — | ✓ | ✓ | — |
| TH100 Humidity | 4 | ✓ | ✓ | ✓ (Modbus) | — | — | — | — | — | ✓ | ✓ | — |
| TH100 Temp | 5 | ✓ | ✓ | ✓ (Modbus) | — | — | — | — | — | ✓ | ✓ | — |
| Analog Ext Board | 10 | — | — | ✓ (ID) | — | — | — | — | — | — | — | — |
| Analog Ext Board % | 11 | — | — | ✓ (ID) | — | — | — | — | — | — | — | — |
| SMT50 Moisture | 15 | — | — | ✓ (ID) | — | — | — | — | — | — | — | — |
| SMT50 Temp | 16 | — | — | ✓ (ID) | — | — | — | — | — | — | — | — |
| SMT100 Analog Mois | 17 | — | — | ✓ (ID) | — | — | — | — | — | — | — | — |
| SMT100 Analog Temp | 18 | — | — | ✓ (ID) | — | — | — | — | — | — | — | — |
| VH400 | 30 | — | — | ✓ (ID) | — | — | — | — | — | — | — | — |
| THERM200 | 31 | — | — | ✓ (ID) | — | — | — | — | — | — | — | — |
| Aquaplumb | 32 | — | — | ✓ (ID) | — | — | — | — | — | — | — | — |
| User Defined | 49 | — | — | ✓ (ID) | — | ✓ | — | — | — | — | — | — |
| OSPi Analog | 50 | — | — | ✓ (ID) | — | — | — | — | — | — | — | — |
| OSPi Analog % | 51 | — | — | ✓ (ID) | — | — | — | — | — | — | — | — |
| OSPi SMT50 Mois | 52 | — | — | ✓ (ID) | — | — | — | — | — | — | — | — |
| OSPi SMT50 Temp | 53 | — | — | ✓ (ID) | — | — | — | — | — | — | — | — |
| Internal Temp | 54 | — | — | — | — | — | — | — | — | — | — | — |
| FYTA Moisture | 60 | — | — | ✓ (ID) | — | — | — | — | — | — | — | ✓ |
| FYTA Temperature | 61 | — | — | ✓ (ID) | — | — | — | — | — | — | — | ✓ |
| MQTT | 90 | — | — | — | — | — | ✓ | — | — | — | — | — |
| **ZigBee** | **95** | **—** | **—** | **—** | **—** | **✓** | **—** | **✓** | **—** | **—** | **—** | **—** |
| Bluetooth | 96 | — | — | — | — | — | — | — | ✓ | — | — | — |
| Remote | 100 | ✓ | — | ✓ (ID) | — | — | — | — | — | — | — | — |
| Weather Temp F | 101 | — | — | — | — | — | — | — | — | — | — | — |
| Weather Temp C | 102 | — | — | — | — | — | — | — | — | — | — | — |
| Weather Humidity | 103 | — | — | — | — | — | — | — | — | — | — | — |
| Weather Precip in | 105 | — | — | — | — | — | — | — | — | — | — | — |
| Weather Precip mm | 106 | — | — | — | — | — | — | — | — | — | — | — |
| Weather Wind mph | 107 | — | — | — | — | — | — | — | — | — | — | — |
| Weather Wind kmh | 108 | — | — | — | — | — | — | — | — | — | — | — |
| Weather ETO | 109 | — | — | — | — | — | — | — | — | — | — | — |
| Weather Radiation | 110 | — | — | — | — | — | — | — | — | — | — | — |
| Group Min | 1000 | — | — | — | — | — | — | — | — | — | — | — |
| Group Max | 1001 | — | — | — | — | — | — | — | — | — | — | — |
| Group Avg | 1002 | — | — | — | — | — | — | — | — | — | — | — |
| Group Sum | 1003 | — | — | — | — | — | — | — | — | — | — | — |
| Free Memory | 10000 | — | — | — | — | — | — | — | — | — | — | — |
| Free Storage | 10001 | — | — | — | — | — | — | — | — | — | — | — |

## ZigBee-specific fields (shown when type == 95)

- ZigBee Device IEEE Address
- ZigBee Scan button + device list
- Known Sensor Types (search + template select)
- Endpoint / Cluster ID / Attribute ID
- Factor / Divider / Offset
- ZigBee Scan Select Container

## Bluetooth-specific fields (shown when type == 96)

- Bluetooth Scan button + device list
- MAC Address
- Characteristic UUID
- Data Format selector
