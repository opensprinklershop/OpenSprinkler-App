# Changelog

## [2.4.199] - 2026-05-21

Änderungen seit dem 3. Mai 2026.

### Hinzugefügt

- Firmware-Updates über OTC-Verbindungen aktiviert. Bei OTC wird nun der geräteseitige Online-Update-Flow verwendet, statt den lokalen Browser-Upload über Port 8080 zu erwarten.
- OTA-Update-Flow erweitert: Die App prüft den Update-Server auf Port 8080 und fällt bei nicht erreichbarem Upload-Server auf den geräteseitigen Download-/Update-Flow zurück.
- Matter-Pairing kann nun über die ESP32-/IEEE-802.15.4-Oberfläche entfernt werden.
- ESP32-Modusverwaltung erweitert, inklusive besserer Radio-Info-Erkennung, Caching und Aktualisierung nach Moduswechseln.
- Zusätzliche Debug-Informationen und Ethernet-Prüfungen für ESP32-/ZigBee-/Matter-Modi.
- ZigBee-Sensorunterstützung verbessert, inklusive Tuya-Datenpunkten.
- Analog-Sensor-Editor um Stale-Timeouts und Policy-Anpassungen erweitert.
- Durchflussmengen- und Volumenberechnungen ergänzt sowie die Anzeige des gesamten Wasserverbrauchs in Logs verbessert.
- Sensorname als Überschrift im Analog-Sensor-Diagramm ergänzt.

### Geändert

- OTA-Changelog-Anzeige bereinigt und stabilisiert.
- Auswahllogik für ESP32-/IEEE-802.15.4-Modi validiert ungültige Kombinationen besser, insbesondere bei Ethernet-Anforderungen für ZigBee-Gateway.
- Firmware-, Netzwerk-, Site- und UI-DOM-Logik für ESP32-Radiozustände und Moduswechsel robuster gemacht.
- `fw.sh` verbessert: stabilere Fehlerbehandlung, Dokumentation und lokale Sync-Pfade aktualisiert.
- API-URL der Irrigation-DB-Integration aktualisiert.
- Optionsvalidierung verbessert.
- App-Version in `config.xml` auf `2.4.199` aktualisiert.

### Behoben

- Fehlerhafte OTA-Upload-URL-Erzeugung gehärtet, damit ungültige Session-Präfixe keine `XMLHttpRequest.open`-Exception mehr auslösen.
- OTA-Probe löst bei ungültiger URL oder nicht erreichbarem Update-Server sauber einen Fallback aus.
- CORS-Verhalten beim OTA-Update-Server berücksichtigt, indem der Port-8080-Probe per `OPTIONS` erfolgt.
- Changelog-Inhalte aus Update-Manifesten werden vor der Anzeige sanitisiert.
- Frische Radio-Informationen werden nach ESP32-Moduswechseln zuverlässiger abgerufen.

### Lokalisierung

- Übersetzungen für alle Sprachen in `www/locale` erweitert.
- Neue OTA-/OTC-Texte in allen Locale-Dateien ergänzt.
- Matter-Pairing-, IEEE-802.15.4-, ZigBee- und ESP32-Modus-Texte lokalisiert.
- `messages_en.po` um neue UI-Strings erweitert.

### Technische Hinweise

- Relevante Hauptbereiche: `www/js/modules/esp32mode.js`, `www/js/modules/analog.js`, `www/js/modules/firmware.js`, `www/js/modules/logs.js`, `www/js/modules/network.js`, `www/js/modules/sites.js`, `www/js/modules/ui-dom.js`, `www/locale/*`.
- Grundlage: Git-Historie des UI-Projekts ab `2026-05-03` bis `2026-05-21`.