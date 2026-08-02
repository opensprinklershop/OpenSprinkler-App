# Irrigation Database Integration in OpenSprinkler

## Übersicht

Die Irrigation Database wurde in das OpenSprinkler Analog Sensor Modul integriert. Benutzer können jetzt direkt aus dem "Program Adjustments Editor" heraus Bewässerungswerte basierend auf Pflanzentyp und Bodenart laden.

## Integration Details

### Datei: `/ui/www/js/modules/analog.js`

**Geänderte Funktion:** `OSApp.Analog.showAdjustmentsEditor()`

**Button:** "Load from Irrigation Database" (Zeile ~909)

### Funktionsweise

1. **Button klicken**: Benutzer klickt auf "Load from Irrigation Database"
2. **Modal öffnet sich**: iframe mit Irrigation Database (Embed-Mode)
3. **Benutzer wählt**:
   - Klimazone (z.B. A - Deutschland)
   - Pflanze (z.B. Kartoffel)
   - Bodenart (z.B. Lehmboden)
4. **Empfehlungen anzeigen**: Vol% Start/Stop werden berechnet
5. **"Übernehmen" klicken**: Werte werden via postMessage übertragen
6. **Auto-Fill**: Min/Max Felder werden automatisch ausgefüllt

### Datenformat (postMessage)

```javascript
{
  type: "irrigation_values",
  plant: "Kartoffel",
  zone: "A",
  soil_name_de: "Lehmboden",
  vol_start: 15.0,      // → wird in "Min sensor value" eingetragen
  vol_stop: 24.0,       // → wird in "Max sensor value" eingetragen
  frequency_days: 2,
  water_need_level: "medium"
}
```

### Code-Änderungen

**Vorher (Zeile 960-974):**
```javascript
popup.find(".load-from-irrigdb").on("click", function(e) {
    e.preventDefault();
    if (typeof OSApp.Analog.IrrigationDB !== 'undefined') {
        // Externes Modul erforderlich
    } else {
        alert("Module not loaded");
    }
});
```

**Nachher (Zeile 960-1020):**
```javascript
popup.find(".load-from-irrigdb").on("click", function(e) {
    e.preventDefault();
    
    // iframe Modal mit Irrigation Database
    var irrigDBUrl = "/irrigationdb/?mode=embed&callback=postMessage";
    
    // Modal erstellen
    var modalHtml = ... iframe ...
    
    // postMessage Listener
    window.addEventListener('message', function(event) {
        if (event.data.type === 'irrigation_values') {
            // Min/Max setzen
            popup.find(".min").val(data.vol_start);
            popup.find(".max").val(data.vol_stop);
        }
    });
    
    // Modal öffnen
    OSApp.UIDom.openPopup(irrigDBPopup);
});
```

## Benutzer-Workflow

```
┌─────────────────────────────────────────┐
│ OpenSprinkler - Program Adjustments     │
│                                         │
│ Adjustment-Nr: 1                        │
│ Type: Soil Moisture                     │
│ Sensor: 1 - Garten Sensor               │
│ Program: Gemüsegarten                   │
│                                         │
│ Factor 1: 0%                            │
│ Factor 2: 100%                          │
│                                         │
│ Min sensor value: [____]  ← Auto-Fill   │
│ Max sensor value: [____]  ← Auto-Fill   │
│                                         │
│ ┌─────────────────────────────────┐    │
│ │ [Load from Irrigation Database] │    │
│ └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
                    │
                    │ Click
                    ▼
┌─────────────────────────────────────────┐
│ Irrigation Database (Modal)             │
│                                         │
│ Klimazone: [A - Deutschland     ▼]     │
│ Pflanze:   [Kartoffel          ___]    │
│ Bodenart:  [Lehmboden           ▼]     │
│                                         │
│ [🔍 Empfehlungen suchen]               │
│                                         │
│ ┌───────────────────────────────┐      │
│ │ 🌱 Bewässerungsempfehlungen   │      │
│ │                               │      │
│ │ Start: 15.0 Vol%             │      │
│ │ Stop:  24.0 Vol%             │      │
│ │ Intervall: 2 Tage            │      │
│ └───────────────────────────────┘      │
│                                         │
│ [📤 Werte für OpenSprinkler übernehmen]│
└─────────────────────────────────────────┘
                    │
                    │ Click "Übernehmen"
                    ▼
          postMessage Event
                    │
                    ▼
┌─────────────────────────────────────────┐
│ OpenSprinkler - Program Adjustments     │
│                                         │
│ Min sensor value: [15.0]  ✅            │
│ Max sensor value: [24.0]  ✅            │
│                                         │
│ ✓ Values loaded from Irrigation Database│
│   Plant: Kartoffel                      │
│   Zone: A                               │
│   Soil: Lehmboden                       │
│   Min: 15.0 Vol%                        │
│   Max: 24.0 Vol%                        │
└─────────────────────────────────────────┘
```

## URL-Parameter

Die Irrigation Database wird im Embed-Mode geöffnet:

```
/irrigationdb/?mode=embed&callback=postMessage
```

- `mode=embed`: Versteckt Header, kompakte Darstellung
- `callback=postMessage`: Aktiviert postMessage-Übertragung

## Sicherheit

### Origin-Prüfung (Optional)

```javascript
window.addEventListener('message', function(event) {
    // Nur von eigener Domain akzeptieren
    if (event.origin !== window.location.origin) return;
    
    // Daten verarbeiten...
});
```

### Event-Listener Cleanup

```javascript
// Listener wird nach Empfang entfernt
window.removeEventListener('message', messageHandler);

// Listener wird beim Schließen des Modals entfernt
irrigDBPopup.on("popupafterclose", function() {
    window.removeEventListener('message', messageHandler);
});
```

## Test

1. OpenSprinkler öffnen
2. Analog Sensors → Program Adjustments
3. "New Program Adjustment" oder bestehende Adjustment bearbeiten
4. Auf "Load from Irrigation Database" klicken
5. Pflanze, Zone und Bodenart wählen
6. "Empfehlungen suchen" klicken
7. "Übernehmen" klicken
8. Min/Max Werte sollten automatisch ausgefüllt sein

## Fehlerbehebung

### Problem: Modal öffnet sich nicht
- **Lösung**: Prüfen Sie, ob `/irrigationdb/` erreichbar ist
- **URL testen**: `http://localhost/irrigationdb/?mode=embed&callback=postMessage`

### Problem: Werte werden nicht übertragen
- **Lösung**: Browser-Konsole öffnen und auf postMessage events prüfen
- **Debug**: `console.log(event.data)` im message handler

### Problem: Irrigation Database lädt nicht
- **Lösung**: 
  - Apache/Webserver läuft?
  - Pfad korrekt? `/irrigationdb/`
  - Browser-Konsole auf Fehler prüfen

## Vorteile

✅ **Keine externe API**: Alles lokal, keine Internet-Verbindung nötig  
✅ **Automatische Berechnung**: Vol% basierend auf Bodenart  
✅ **Benutzerfreundlich**: Visuelle Auswahl statt manuelle Eingabe  
✅ **Genau**: Datenbank mit wissenschaftlichen Werten  
✅ **LocalStorage**: Letzte Einstellungen werden gespeichert  
✅ **Keine Abhängigkeiten**: Direktintegration ohne extra Module  

## Version

- **OpenSprinkler analog.js**: Geändert am 15. Februar 2026
- **Irrigation Database**: Version 1.6.1
- **Integration**: Version 1.0

## Autor

OpenSprinkler Irrigation Database Integration  
February 2026
