# Changelog

## [2.4.234] - 2026-09-21

Release 2.4.234 (Android Build 234)

### Hinzugefügt
- **Selbstaktualisierende Oberflächenstände in der Android-App**: Die App liefert die eingefrorenen Oberflächenstände (`2.4.0.228` usw.) mit aus; eine Korrektur darin erreichte Nutzer bisher erst mit dem nächsten Store-Release (siehe 2.4.233). Jetzt gleicht die App den Stand zur verbundenen Firmware im Hintergrund mit `ui.opensprinklershop.de` ab und hält eine aktualisierte Kopie im App-Datenverzeichnis (`js/ui-updater.js`). Unveränderte Dateien kommen aus dem mitgelieferten Stand, nur geänderte werden geladen; jede Datei wird gegen eine signierte Dateiliste (`filelist.json` + `filelist.sig`, ECDSA P-256) geprüft – der Webserver allein kann der App keinen Code unterschieben. Die Kopie wird erst nach vollständiger Prüfung aktiv, enthält nie die native Cordova-Bridge (die kommt immer aus der installierten App) und läuft unter demselben Ursprung, sodass Standorte und Passwörter erhalten bleiben. Startet eine Kopie nicht, sperrt der Start-Watchdog sie und die App nutzt wieder den mitgelieferten Stand. Auch ein Stand, der erst nach dem App-Build veröffentlicht wurde (neue Firmware), kann so nachgeladen werden. iOS und die Web-Oberfläche sind unverändert.
- **Einstellungen wandern mit**: Die App speichert viele Einstellungen (Design, 12/24 h, Einheiten, Ansichten, Cloud-Server …) pro Oberflächenpfad. Beim Wechsel in eine aktualisierte Kopie werden sie übernommen, beim Rückfall auf den mitgelieferten Stand zurückgegeben; Reste nicht mehr vorhandener Kopien werden entfernt.
- **Sicherung der gespeicherten Standorte (`js/storage-guard.js`)**: Die App spiegelt Standorte und Einstellungen in eine Datei im App-Datenverzeichnis und stellt sie einmalig wieder her, wenn sie unter einem anderen WebView-Ursprung startet. Das ist die Voraussetzung, um iOS wieder auf das eigene URL-Schema (`ionic://localhost`, versehentlich im August auf `file://` umgestellt) zurückzustellen, ohne dass Standorte verloren gehen – und damit für die selbstaktualisierenden Oberflächenstände auf iOS. Ablauf in zwei Releases, siehe `BUILD_IOS.md`. Eine leere Standortliste überschreibt die Sicherung nie.
- **iOS-Ladeweg im Updater vorbereitet**: Unter einem eigenen URL-Schema liefert cordova-ios das Datenverzeichnis als `/_app_file_<Pfad>` aus; der Updater merkt sich die Kopien nur noch relativ und frischt die Basis bei jedem Start auf (der Container-Pfad ändert sich bei App-Updates). Unter `file://` bleibt er inaktiv.
- **`scripts/gen-ui-filelist.js`**: Erzeugt und signiert die Dateilisten; `buildwebdeploy.sh` ruft es vor dem Upload auf. Der private Schlüssel liegt außerhalb des Repositorys (`UI_UPDATE_KEY`).
- **Headless-Test `test/headless/updater.js`**: Installation, Routing in die Kopie, Rückweg in die Standortverwaltung, abgewiesene Manipulationen und Watchdog-Rückfall.

### Behoben
- **iOS-App: Kopfzeile mit Zurück/Speichern/Hinzufügen liegt unter der Statusleiste**: `cordova-plugin-statusbar` (3.0.0 wie 4.0.0) liest die Höhe der Statusleiste über `[UIApplication sharedApplication].statusBarFrame`, seit iOS 13 veraltet. cordova-ios 8 startet die App über den UIScene-Lebenszyklus (`SceneDelegate`); dort liefert die Eigenschaft auf aktuellen iOS-Versionen ein Null-Rechteck, `StatusBar.overlaysWebView(false)` schiebt die WebView nicht mehr nach unten, und die farbige Fläche hinter der Statusleiste bekommt die Höhe 0. Der neue Hook `hooks/patch-ios-statusbar.js` (after_prepare, wie `patch-android-statusbar.js`) ersetzt die drei Lesestellen und die veraltete `statusBarOrientation`-Abfrage durch den `UIStatusBarManager` der Fenster-Szene, in der Plattformkopie und in `plugins/`. Upstream: apache/cordova-plugin-statusbar#294; das Plugin gilt dort seit cordova-ios 8 als veraltet, der Umstieg auf die eingebaute Statusleiste von cordova-ios/cordova-android steht noch aus.

## [2.4.233] - 2026-09-21

Release 2.4.233 (Android Build 233)

### Behoben
- **„Programme ändern“ zeigt weiterhin einen schwarzen Bildschirm (alle Plattformen mit Firmware 2.4.0(228))**: Die Korrektur aus 2.4.232 lag nur in der aktuellen Oberfläche. Controller mit Firmware 2.4.0(228) – ESP32-C5, ESP8266 und OSPi – werden aber auf den eingefrorenen Oberflächenstand `2.4.0.228` geleitet, der den Fehler noch enthielt; die Korrektur erreichte dadurch praktisch kein Gerät. Der Stand `2.4.0.228` enthält jetzt dieselbe Korrektur (Seitenaufbau vor dem Seitenwechsel, Chart.js wird bei Bedarf erst geladen und der Wechsel danach erneut ausgelöst), und die App liefert ihn mit aus.

## [2.4.232] - 2026-09-18

Release 2.4.232 (Android Build 232)

### Behoben
- **„Programme ändern“ zeigt nur einen schwarzen Bildschirm**: Auf Controllern mit Sensor-API wird Chart.js für den Sensoranpassungs-Editor erst bei Bedarf nachgeladen. Die Seiten `#programs`, `#addprogram` und `#sensor-logs` wurden dadurch erst *nach* dem Nachladen aufgebaut, jQuery Mobile sucht die Zielseite aber sofort beim Seitenwechsel. Der Wechsel schlug fehl: Die Kopfzeile zeigte bereits „Programme“, der Inhalt blieb leer bzw. schwarz. Ist Chart.js schon geladen, wird die Seite jetzt wieder sofort aufgebaut; andernfalls wird der Wechsel angehalten, Chart.js geladen und der Wechsel danach erneut ausgelöst. Schlägt das Nachladen fehl, öffnet die Seite ohne Diagramm statt gar nicht.

## [2.4.231] - 2026-09-16

Release 2.4.231 (Android Build 231 / iOS 2.4.231)

### Behoben
- **Android/iOS-App hängt beim Start in „Connecting to <Name>…“ (OTC-Standort)**: Der Schnellstart in `index.html` probte einen OTC-Standort immer über `cloud.openthings.io`, unabhängig vom eingestellten OTC-Server (z. B. `io.opensprinklershop.de`). Die Anfrage schlug sofort mit 404 fehl, und weil die Antwort vor `DOMContentLoaded` eintraf, wurde das Verbindungs-Overlay erst *nach* dem Aufräumen eingefügt und nie wieder entfernt; darunter war die Standortverwaltung längst benutzbar. Der Schnellstart nutzt jetzt denselben Server wie die App (`os_otc_server`, Abbildung wie `OSApp.Utils.otcForwardBase`), fügt das Overlay nach einem bereits beendeten Versuch nicht mehr ein, und der Start-Watchdog behandelt ein verwaistes Overlay wie einen schwarzen Bildschirm.
- **Firmware neuer als alle gebündelten Bundles**: Die Apps bündeln nur die Release-Snapshots, nicht `dev`. Für eine Firmware neuer als der neueste Snapshot leitete der Schnellstart in den nicht vorhandenen Ordner `dev/` um (leere Seite bzw. Navigationsfehler), und `routeToVersion` → `updateSite` → `routeToVersion` drehte sich endlos. Außerhalb von opensprinklershop.de wird das Ziel-Bundle jetzt vor der Weiterleitung geprüft; fehlt es, verbindet die App mit dem aktuellen (neuesten) Bundle. `connectInCurrentBundle` lädt den Controller direkt statt über `updateSite`.

### Geändert
- **`OSApp.Sites.applySiteToSession`**: Gemeinsame Übernahme eines gespeicherten Standorts in die Sitzung (Token/OTC-Server, Adresse, Passwort inkl. Sitzungs-Fallback, SSL-Präfix, HTTP-Auth, 1.8.3-Flag); `updateSite` nutzt sie statt einer eigenen Kopie.

## [2.4.230] - 2026-09-15

Release 2.4.230 (Android Build 230 / iOS 2.4.230)

### Behoben
- **Verbindung über ui.opensprinklershop.de mit älterer Firmware**: Controller mit Firmware 2.4.0(227) und älter liefen beim Verbinden in „Verbindungstimeout“. Ursache war die Sensor-API-Abfrage (`/jsn`, `/jsd`) der neuesten Oberfläche: Die Firmware antwortet mit 404 ohne CORS-Header, der Browser meldet Status 0, und die Wiederholungslogik räumte die gemeinsame Anfrage-Warteschlange ab, sodass die Verbindung bis zum 15-Sekunden-Watchdog hing. Sensor-API-Anfragen werden jetzt weder wiederholt noch brechen sie die Warteschlange ab.
- **„Verbinden“ klärt zuerst die Version**: In der Standortverwaltung fragt „verbinden“ jetzt zuerst `/jo` ab, wählt anhand von `fwv`/`fwm` das exakt passende Oberflächen-Bundle (sonst den nächst-älteren Stand, für neuere Entwicklungsfirmware `dev`) und leitet erst dann weiter. Ohne Build-Nummer wird nicht mehr das neueste Bundle geraten. Bei nicht erreichbarem Gerät oder unbekannter Version bleibt man mit klarer Meldung in der Standortverwaltung.
- **Falsches Passwort**: Die Firmware beantwortet ein abgelehntes Passwort mit HTTP 200 und nur `{"fwv"}`; das wurde bisher als Erfolg gewertet. Jetzt erscheint der Passwortdialog, und das akzeptierte Passwort wird für die Weiterleitung übernommen, auch wenn „Passwort speichern“ nicht angehakt ist. Der automatische Hash-Versuch des Dialogs prüft das Ergebnis, statt jede 200-Antwort zu akzeptieren (speicherte sonst `md5("")`).
- **HTTP-Gerät auf der HTTPS-Seite**: Ein per `http://` eingetragener Controller kann von `https://ui.opensprinklershop.de` aus nicht angesprochen werden (Mixed Content). Statt eines Timeouts erscheint eine Erklärung mit Direktlink zur Oberfläche des Geräts sowie den Alternativen SSL und OTC.
- **Service Worker**: Anfragen an fremde Ursprünge (Controller, OTC-Cloud, Wetter) werden nicht mehr vom Service Worker abgefangen. Chromes Local-Network-Access-Prüfung kann für Worker-Anfragen keinen Dialog zeigen und machte daraus ein künstliches 503 („gesperrt … oder Gerät offline“).

### Geändert
- **Geräteseite (`home.js`)**: Beim Aufruf über die Controller-IP werden nur noch jQuery und der Hash-Helfer von der Root geladen; nach der Anmeldung liest die Seite die Firmware-Version und lädt Stile, Module und Markup aus dem passenden versionierten Bundle. Ein 227-Controller bekommt so auch direkt die 227-Oberfläche.
- **Gebündelter Versionskatalog**: `www/versions.json` enthält jetzt auch `2.4.0.228`.
- **iOS-Build**: `buildios.sh` legt `build.json` bei Bedarf selbst an und unterstützt `REVERSED_CLIENT_ID` aus `GoogleService-Info.plist`.
- **CI**: Der unsignierte Android-Prüfbau kommt ohne getracktes `build.json` aus.

## [2.4.229] - 2026-09-14

Release 2.4.229 (Android Build 229 / iOS 2.4.229)

### Hinzugefügt
- **Offizielle „Expanded Sensor“-API**: Die App spricht jetzt die offizielle Sensor-API der OpenSprinkler-Firmware 2.2.1(5) (`/jsn`, `/jsd`, `/jsl`, `/jpa`), die die OpenSprinklerShop-Firmware ab 2.4.0(228) als Fassade über den vorhandenen Sensorspeicher bereitstellt. Die Seiten erscheinen nur, wenn die Firmware die API meldet; die bisherigen Analog-Sensor-Seiten bleiben erhalten.
- **Sensor-Anpassung im Programm-Editor**: Programme können pro Sensor stückweise (Punkttabelle) angepasst werden, inklusive der Run-once-/Anpassungs-Ansicht aus der offiziellen App. Der klassische Anpassungs-Editor kennt den neuen Typ „OpenSprinklerShop-Sensor“ ebenfalls und akzeptiert Punktlisten.
- **Sensor-Logs**: Neue Seite mit Diagrammen (Chart.js, wird erst beim Aufruf geladen; Zoom/Touch-Bedienung).
- **ZigBee-Signal-Badges**: Stationsliste und Dashboard zeigen den ZigBee-Zustand jeder Station (unterwegs, Fehler, bestätigt) als Symbol.
- **Headless-Testszenarien**: Chromium-basierte Prüfungen für Editoren, Menü, Routing, SMT100- und virtuelle Sensoren unter `test/headless/`.

### Geändert
- **Editoren als Vollbildseiten**: Sensor-, Programmanpassungs- und Monitor-Editor sind keine Popups mehr, sondern eigene Seiten mit der globalen Kopfzeile; Schließen führt auf die Ausgangsseite zurück.
- **Statusabfrage stabilisiert**: Die 4-Sekunden-Abfrage überlappt nicht mehr, der manuelle Stationsstart wartet nicht mehr auf die komplette Aktualisierung.
- **Build/CI**: Das Server-Zertifikat für den Android-Trust-Anchor wird über `config.xml` mitgeliefert (GitHub-Build war rot); iOS-, Firebase- und Play-Upload-Workflows überspringen ohne Secrets statt fehlzuschlagen. Signaturschlüssel und `build.json` liegen nicht mehr im Repository.

### Behoben
- **RS485-Editor**: Port und Modbus-ID wurden doppelt angezeigt.
- **Bewässerungsdatenbank**: Der Zonen-Abruf im Integrationsdialog schlug fehl (fehlende `getZones`-Funktion).
- **Unit-Tests**: Fünf seit August fehlschlagende Tests (Setup-Assistent, Hauptmenü, Regenverzögerung, Benachrichtigungsgruppen, entfernte Monitor-Benachrichtigung) an das aktuelle Verhalten angepasst.

## [2.4.227] - 2026-08-22

Release 2.4.227 (Android Build 227 / iOS 2.4.227)

### Hinzugefügt
- **Konfigurierbare OTC- und Cloud-Sync-Server**: Es können nun vordefinierte Server-Presets ausgewählt oder eigene Server konfiguriert werden. Die Weiterleitungslogik und Benutzeroberfläche wurden entsprechend angepasst.
- **Neue Benachrichtigungssymbole**: Hochauflösende Symbole für die Benachrichtigungsleiste hinzugefügt, um auf allen Geräten ein sauberes Erscheinungsbild zu gewährleisten.
- **HTTPS-Deployment**: Die App-Bereitstellung (Deployment) nutzt nun standardmäßig HTTPS-Upload mit einem Fallback auf SSH/rsync.

### Geändert
- **ESP8266 OTA-Updates über lokale Verbindungen**: Firmware-Updates für ESP8266-Controller sind nun über lokale Verbindungen möglich. Dazu wurde die Verfügbarkeitsprüfung angepasst und Fallback-Mechanismen für den Download implementiert.

### Behoben
- **Sprachauswahl**: Ein weiterer Fehler bei der Sprachauswahl wurde behoben.
- **Benutzeroberfläche**: Problem mit der „Zurück“-Taste und der Standortliste korrigiert.
- **SHA-Verifizierung**: Fehler bei der SHA-Prüfsummen-Verifizierung behoben.
- **KI-Chat**: Timeout-Probleme im KI-Assistenten-Chat gelöst.

## [2.4.226] - 2026-08-16

Release 2.4.226 (Android Build 226 / iOS 2.4.226)

### Hinzugefügt

- **Native Speicherung der Sprachauswahl**: In der installierten App wird die gewählte Sprache jetzt zusätzlich nativ im App-Datenverzeichnis abgelegt, sodass sie zuverlässig über App-Neustarts und Aktualisierungen hinweg erhalten bleibt.
- **Normalisierung von Sprachcodes**: Sprachcodes werden nun robust normalisiert (Groß-/Kleinschreibung, Unterstrich/Bindestrich, Regionsvarianten wie `de-DE` → `de`) und fallen bei unbekannten Codes sauber auf Englisch zurück.

### Geändert

- **Kein Online-Firmware-Update für ESP8266 über Fernverbindungen**: Bei ESP8266-Controllern, die über eine Cloud-/Remote-Verbindung (OTC) erreicht werden, wird der Menüeintrag „Online-Update" sowie die Update-Benachrichtigung ausgeblendet, da der geräteseitige Update-Ablauf über Remote-Verbindungen nicht zuverlässig funktioniert.

### Behoben

- **Zuverlässigere Versionsauswahl beim OTA-Update**: Die Auswahl der Firmware-Version beim Online-Update erhielt einen Fallback-Mechanismus und öffnet das Auswahlfenster nicht mehr mehrfach.
- **Schwarzer Bildschirm bei Direktaufruf auf dem Gerät**: Der Aufruf von `#site-control`/`#start` direkt über die Geräte-URL führte zu einer Weiterleitungsschleife (Selbst-Redirect ohne Seitenwechsel) und damit zu einem schwarzen Bildschirm; es wird nun stattdessen die Hauptsteuerungsseite angezeigt.
- **Geschützter GPS-Koordinatenabgleich**: Der Abgleich der Standortkoordinaten wird nur noch durchgeführt, wenn der Standortwert tatsächlich als Zeichenkette vorliegt, was einen möglichen Fehler beim Speichern der Controller-Einstellungen verhindert.
- **Erzwungener Flash-Commit beim Sensor-Import**: Beim Import von Sensoren wird das Schreiben in den Flash-Speicher nun erzwungen, damit importierte Daten zuverlässig persistiert werden.

## [2.4.225] - 2026-08-13

Release 2.4.225 (Android Build 225 / iOS 2.4.225)

### Hinzugefügt

- **Wetterdienst-Fehlerursachen in der Systemdiagnose**: Zusätzlich zum Fehlercode zeigt die Systemdiagnose nun eine konkrete Ursache, warum der Wetterabruf fehlschlägt (z. B. keine Netzwerkverbindung, wenig Speicher, Wetterserver nicht konfiguriert, Zeitüberschreitung, DNS-Lookup fehlgeschlagen, Serverfehler oder veraltete Daten). Die passenden Übersetzungen wurden ergänzt.
- **Automatische Zigbee-Namensauflösung im Geräte-Editor**: Beim Öffnen eines Zigbee-Geräts wird der Anzeigename jetzt automatisch über die Online-Gerätedatenbank aufgelöst; bei einer manuellen Datenbanksuche wird die Geräte-Beschreibung (z. B. „GIEX GX03 2-Zonen-Bewässerungstimer") als Name übernommen.
- **Native HTTP-Anfragen für HTTPS-Geräteverbindungen (Cordova)**: In der installierten App können HTTPS-Verbindungen zum Controller nun über die native HTTP-Schicht laufen, was Verbindungen zu Geräten mit selbstsignierten Zertifikaten zuverlässiger macht.

### Geändert

- **Lokalisierte Formatierung von Durchfluss- und ETo-Werten**: Durchfluss- und Verdunstungswerte (ETo) werden nun konsistent im lokalen Zahlenformat dargestellt.
- **Zigbee-Gateway-Panel aktualisiert Geräte einzeln**: Statt das gesamte Panel neu zu laden, werden einzelne Zigbee-Geräte gezielt aktualisiert; die Namensauflösung wurde optimiert und fest kodierte Namensheuristiken (z. B. die Anzeige des reinen Modells „TS0601" als Name) entfernt.
- **Sauberer Lade-Indikator für ausstehende Zigbee-Namen**: Die Unicode-Sanduhr wurde durch einen CSS-Ladeindikator ersetzt; noch nicht aufgelöste Gerätenamen zeigen jetzt einen Lade-Indikator mit verbesserter Warte-Logik (kein Dauer-Spinner mehr).
- **Optimiertes Service-Worker-Caching**: Verbessertes Cache-Verhalten für zuverlässigere Updates der Web-/PWA-Oberfläche.
- **Robusterer automatischer Update-Algorithmus**: Die OTA-Update-Logik wurde stabilisiert.
- **Datensatzbegrenzung per `max`-Parameter**: Abfragen können nun die maximale Anzahl zurückgegebener Datensätze begrenzen und so das Datenvolumen reduzieren.

### Behoben

- **Korrekte Bit-Zuordnung der Benachrichtigungsereignisse**: Die einzelnen Benachrichtigungs-Ereignisse (Ereignis-Bitmaske) waren gegenüber der Firmware vertauscht, sodass z. B. „Programmende" ein falsches Ereignis auslöste bzw. anzeigte. Die Ereignisse werden nun auf feste Firmware-Bit-Positionen abgebildet.
- **iOS-Build repariert**: Build-Probleme unter iOS behoben (u. a. Google-Maps-Build-Phase).

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
