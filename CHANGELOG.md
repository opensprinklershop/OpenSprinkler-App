# Changelog

## [2.4.224] - 2026-08-09

Release 2.4.224 (Android Build 224 / iOS 2.4.224)

### Hinzugefügt

- **Firebase Push-Benachrichtigungen (FCM)**: Native Push-Benachrichtigungen für Android und iOS über Firebase Cloud Messaging mit direkter Geräteschlüssel-Registrierung.
- **WebPush für Browser & PWAs**: Native Browser-Push-Benachrichtigungen über FCM im Web-Interface und als Progressive Web App.
- **Zentrale Push-Einstellungen**: Vereinfachte Konfiguration im UI mit zentralem Ein-/Ausschalter, eigener Push-Server-URL und Schalter für Controller-Push.
- **Erweiterter Einrichtungs-Assistent**: Der Setup-Assistent wurde zu einem mehrstufigen Guide ausgebaut, inklusive verbesserter responsiver Ansicht und dedizierter Browser-Spracherkennung.
- **Monochrome Android-Notification-Icons**: Sauberes Erscheinungsbild von Systembenachrichtigungen auf modernen Android-Versionen (Android 13+).
- **Stabile Zigbee-Geräteauswahl**: Eindeutige Auswahl und Adressierung von Zigbee-Geräten über IEEE-64-bit-Schlüssel.

### Geändert

- **12/24-Stunden-Uhrzeitformatierung**: Verbesserte Handhabung von Zeitangaben in Benachrichtigungseinstellungen und Log-Anzeigen.
- **Dezimal-Eingabemodus ( inputmode)**: Optimierte Tastaturdarstellung auf Mobilgeräten bei Kommazahlen in Sensor- und Wetterkonfigurationen.
- **Multi-Version-Routing**: Automatischer Cache-Bust nach erfolgreichen OTA-Updates verhindert veraltete UI-Weiterleitungen.
- **Cordova iOS 8.1.1 & Android 15 Alignment**: Aktualisierte native App-Plattform-Dependencies, GoogleService-Info.plist Einbindung und iOS-Deployment-Target auf iOS 15.0 angepasst.

### Behoben

- Sprachauswahl-Problem im Setup-Assistenten behoben (Verwendung von  statt ).
- Native HTTP-Requests und Promise-Handling in  bei Fehlerantworten stabilisiert.
- Entfernen veralteter Local-Notification- und Background-Plugins zugunsten von nativem FCM-Push.

## [2.4.221] - 2026-08-01

Release 2.4.221 (Android Build 221 / iOS 2.4.221)

### Hinzugefügt

- **Android 15 & Target API 36**: Upgrade auf Cordova Android 15 mit modernem Edge-to-Edge-Layout und automatischer Berücksichtigung von Systembar-Insets.
- **Hauptseiten-Sichtbarkeit für Monitore ()**: Monitore können nun einzeln auf der Hauptseite ausgeblendet werden (), ohne die Überwachung zu deaktivieren.
- **Minimale Log-Intervalle für Sensoren ()**: Einstellung des Mindest-Log-Intervalls im Analog-Sensor-Editor zur Reduzierung von Log-Volumen bei schnell wechselnden Werten.
- **Weather Underground Station-ID Lookup**: Automatische Suche und Vorschläge von Weather Underground Stations-IDs in den Wetter-Einstellungen.
- **Map Station Viewport Filtering**: Kartenanzeige filtert Wetterstationen dynamisch nach dem sichtbaren Kartenausschnitt.

### Geändert

- **Persistente Sortierreihenfolge**: Anzeige- und Sortierreihenfolge von Sensoren und Monitoren wird direkt auf dem Controller gespeichert.
- **Stale-while-revalidate Caching**: Optimierte Ladezeiten im Web-UI durch intelligentes Caching.

### Behoben

- Automatisches Zurücksetzen des Event-Log-Watermarks nach Controller-Reboot.
- Korrektur von Inset-Berechnungen auf iOS und Android zur Vermeidung doppelter Statusbar-Abstände.
- Selbstheilung des Service-Worker-Build-Zeitstempels.

## [2.4.213] - 2026-07-19

Release 2.4.213 (Android Build 213 / iOS 2.4.213)

### Hinzugefügt

- **KI-Assistent Zonensteuerung**: Direkte Steuerung von Bewässerungszonen über natürliche Sprachbefehle im KI-Assistenten.
- **Stapelverarbeitung bei Backup-Restore**: Wesentlich schnellere und zuverlässigere Wiederherstellung großer Sensor- und Systemkonfigurationen.

### Geändert

- Lade-Schutz für analoge Sensor-Konfigurationen gegen unvollständige Server-Antworten.

### Behoben

- Bereinigung obsoleter und verwaister Log-Einträge während der Wiederherstellung aus Backups.

## [2.4.212] - 2026-07-07

Release 2.4.212 (Android Build 212 / iOS 2.4.212)

### Hinzugefügt

- **ZigBee-Editor mit Steuerungstest**: Neuer Schalter und Testfunktion für ZigBee-Ventile im Editor sowie Unterstützung für .
- **Trust Anchors für Android**: Einbindung lokaler Zertifikate in Android-Ressourcen für vertrauenswürdige HTTPS-Verbindungen.

### Geändert

- **Lazy Loading für Diagramm-Bibliotheken**: Schwere Charting-Bibliotheken (ApexCharts / Chart.js) werden erst geladen, wenn Diagramme tatsächlich geöffnet werden. Das reduziert die initiale Ladezeit und den Speicherverbrauch der App drastisch.
- **Verbindungs-Normalisierung**: Robusteres Handling von direkten IP-Adressen und Hostnamen bei der Verbindungsprüfung und Site-Erstellung.

### Behoben

- Syntaxfehler im ZigBee-Editor behoben und Timer-Updates im Dashboard entprellt (Debounce).
- Fehlende ESP32Mode-Referenzprüfungen ergänzt zur Vermeidung von Laufzeitfehlern.

## [2.4.210] - 2026-06-30

Release 2.4.210 (Android Build 210 / iOS 2.4.210)

### Hinzugefügt

- **Integrierter KI-Assistent**: Neues Modul für natürliche Sprachsteuerung von OpenSprinkler zur Abfrage von Systemstatus, Wetterbeschränkungen und Sensorwerten.
- **MCP (Model Context Protocol) Support**: Unterstützung für MCP-Anfragen und strukturierte Antworten im KI-Assistenten.
- **Dynamische Sprachunterstützung**: Automatische Übersetzung von KI-Antworten und Sprachübermittlung.
- **Import / Export Erweiterungen**: Verbesserter Daten-Import und -Export für Konfigurationen.

### Geändert

- Überarbeitetes Hauptseiten-Layout mit integriertem KI-Chat-Overlay.
- ZigBee-Datenbanksuche unterstützt UND-Verknüpfungen bei Mehrfach-Suchbegriffen.

### Behoben

- ZigBee-Gateway Status-Refresh und Handhabung unbekannter Geräte nach Rejoin stabilisiert.

## [2.4.204] - 2026-06-25

Release 2.4.204 (Android Build 204 / iOS 2.4.204)

### Hinzugefügt

- **Boot-Diagnose & Startup-Watchdog**: Integrierte Startdiagnose erkennt hängende Skripte oder Ladefehler beim App-Start und bietet automatische Wiederherstellungsoptionen.
- **Gardena Assistant Integration**: Erleichterte Einrichtung von Gardena Smart Home Systemen mit verbesserter OAuth2-URL-Handhabung.
- **WLAN-Energiesparmodus Option**: Option zum Aktivieren/Deaktivieren des WiFi Modem Sleep auf ESP8266/ESP32.

### Geändert

- Verbessertes OTA-Update-Handling mit expliziten Timeouts.
- Aktualisierte Build- und Launch-Skripte für iOS-Simulator und Android-Builds.

### Behoben

- Fehlerhafte URL-Pfade bei Gardena-OAuth2-Callbacks korrigiert.

## [2.4.203] - 2026-06-16

Release 2.4.203 (Android Build 203 / iOS 2.4.203)

### Hinzugefügt

- **Live-Debug-Modul**: Integrierter Log-Monitor im Web-UI für Echtzeit-Diagnose von Controller-Ereignissen und System-Meldungen.
- **HTTP Remote JSON Sensor UI**: Vollständige UI-Unterstützung für Remote-JSON-Sensoren inklusive verschachtelter Schlüssel und Array-Index-Adressierung.
- **Dynamische Version-Sync**: Automatische Synchronisation der UI-Versionen zwischen App-Bundle und Web-Server.

### Geändert

- Bereinigung von Abfrage-Parametern in App-URL-Pfaden.
- Erweiterte OSPi-Verfügbarkeitsprüfungen.

### Behoben

- Korrektur der HTML-Tag-Schließung im Sensor-Konfigurationsformular.

## [2.4.202] - 2026-06-08

Release 2.4.202 (Android Build 202 / iOS 2.4.202)

### Hinzugefügt

- **GIEX / GX02 Smart Irrigation Valves**: Unterstützung für Tuya/GIEX Bewässerungsventile mit Durchfluss- und Wasserverbrauchsmessung (DP2) in Zigbee-Templates.
- **Erweiterte ZigBee-Geräteverwaltung**: Funktionen für 'Force Rejoin', Gerät entfernen, Impulsteiler-Einstellung und Anzeige des Batterie-Ladestands.
- **Wochentags-Auswahl im Monitor-Editor**: Checkboxen für einzelne Wochentage im Monitor-Editor.

### Geändert

- Überarbeitete Durchflussmengen-Präzision und angepasste Eingabelimits für Wetter-Einstellungen.
- Verbesserte Handhabung von ZigBee IEEE-Adressen.

### Behoben

- Dashboard-Anzeige für ZigBee-Stationen und Status-Synchronisation optimiert.

## [2.4.199] - 2026-05-25

Release 2.4.199 (Android Build 199 / iOS 2.4.199)

### Hinzugefügt

- **Gardena-Sensor-Integration**: Einrichtungsoberfläche für Gardena-Credentials und Token-Handling.
- **Wasserverbrauchs-Berechnungen**: Anzeige des kumulierten Wasserverbrauchs in Bewässerungsprotokollen und Log-Grafiken.
- **OTA über OTC-Verbindung**: Unterstützung von Firmware-Updates über Cloud-Verbindungen (OpenThings Cloud) mit automatischem Port-8080-Fall-Back.
- **Matter-Entkopplung**: Option zum Entfernen von Matter-Pairings in der ESP32-Oberfläche.
- **Sensorname in Chart-Kopfzeile**: Anzeige des Sensornamens als Titel in Analog-Sensor-Diagrammen.

### Geändert

- ESP32-Modusverwaltung erweitert (Radio-Info-Caching, sanfter Moduswechsel).
- Relevante Übersetzungen für alle unterstützten Sprachen ergänzt.

### Behoben

- Gehärtete OTA-Upload-URLs zur Vermeidung von Javascript-Exceptions bei unvollständigen Session-IDs.
