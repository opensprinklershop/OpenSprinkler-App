# Irrigation Database Integration - Installation & Usage

## ✅ Installation abgeschlossen

### Geänderte/Erstellte Dateien

1. **API-Erweiterung:**
   - `/srv/www/htdocs/irrigationdb/api.php` - 2 neue Endpoints hinzugefügt
     - `?endpoint=search_plants&q=<query>` - Pflanzensuche mit Autocomplete
     - `?endpoint=get_settings&plant=<name>&zone=<code>` - Optimierte Min/Max Abfrage

2. **JavaScript-Modul:**
   - `/srv/www/htdocs/ui/www/js/modules/irrigation-db-integration.js` (NEU)
     - Vollständiges Integration-Modul für UI
     - Autocomplete-Suche
     - Zone-Auswahl mit localStorage
     - Ergebnistabelle mit Auswahl

3. **UI-Integration:**
   - `/srv/www/htdocs/ui/www/js/modules/analog.js` (MODIFIZIERT)
     - Backup: `/srv/www/htdocs/ui/www/js/modules/analog.js.backup`
     - Neuer Button "Load from Irrigation Database"
     - Event-Handler für Integration

## 🚀 Verwendung

### 1. JavaScript einbinden

Fügen Sie in Ihrer HTML-Datei (z.B. `index.html`) **vor** `analog.js` ein:

```html
<!-- Irrigation Database Integration -->
<script src="js/modules/irrigation-db-integration.js"></script>

<!-- Existing analog.js -->
<script src="js/modules/analog.js"></script>
```

### 2. Workflow im UI

1. **Program Adjustments öffnen**
   - Gehen Sie zu Analog Sensors → Program Adjustments
   - Klicken Sie "Add program adjustment" oder editieren Sie einen bestehenden

2. **Button "Load from Irrigation Database" klicken**
   - Der Button erscheint zwischen "Max sensor value" und dem Chart

3. **Dialog öffnet sich mit:**
   - **Climate Zone Dropdown** (A-F)
     - Zone wird in localStorage gespeichert
     - Beim nächsten Öffnen wird die letzte Zone vorausgewählt
   
   - **Plant Search Eingabefeld**
     - Autocomplete-Suche (ab 2 Zeichen)
     - Zeigt passende Pflanzen mit Kategorie
     - Klick auf Vorschlag übernimmt den Namen
   
   - **Search Button**
     - Sucht Empfehlungen für gewählte Zone + Pflanze

4. **Ergebnistabelle**
   - Zeigt alle passenden Einträge
   - Spalten: Plant | Min % | Max % | Action
   - Notizen werden angezeigt falls vorhanden

5. **Select Button klicken**
   - Übernimmt Min/Max Werte in die Felder
   - Dialog schließt automatisch
   - Bestätigungsmeldung zeigt die Werte

## 📋 Beispiele

### Beispiel 1: Rasen in Deutschland

1. Zone: **A** (Humid Temperate)
2. Plant: **Kentucky Bluegrass**
3. Ergebnis:
   - Min: **20.00%**
   - Max: **30.00%**

### Beispiel 2: Rasen in Australien

1. Zone: **D** (Semi-Arid)
2. Plant: **Buffalo Grass**
3. Ergebnis:
   - Min: **12.00%**
   - Max: **20.00%**

### Beispiel 3: Gemüse

1. Zone: **A** (Deutschland)
2. Plant: **Tomato**
3. Ergebnis:
   - Min: **18.00%**
   - Max: **28.00%**

### Beispiel 4: Kräuter (Mediterran)

1. Zone: **C** (Mediterranean)
2. Plant: **Rosemary**
3. Ergebnis:
   - Min: **8.00%**
   - Max: **16.00%**

## 🌍 Verfügbare Klimazonen

| Code | Name | Regionen | Beispiel-Rasen |
|------|------|----------|----------------|
| A | Humid Temperate | Deutschland, UK, Netherlands | 20-30% |
| B | Moderate Temperate | Central Europe, Austria | 18-28% |
| C | Mediterranean | South Europe, California | 15-25% |
| D | Semi-Arid | Central Australia, Middle East | 12-20% |
| E | Subtropical Humid | East Australia, SE USA | 20-28% |
| F | Tropical | SE Asia, North Australia | 25-35% |

## 🌿 Verfügbare Pflanzenkategorien

- **Lawn Grass - Cool Season:** Perennial Ryegrass, Tall Fescue, Kentucky Bluegrass
- **Lawn Grass - Warm Season:** Buffalo Grass, Kikuyu, Couch Grass, Bermuda, Zoysia
- **Vegetables - Leafy:** Lettuce, Spinach, Kale
- **Vegetables - Fruit:** Tomato, Cucumber, Pepper, Zucchini
- **Vegetables - Root:** Carrot, Potato, Beetroot
- **Herbs:** Basil, Rosemary, Thyme, Mint, Oregano, Sage
- **Flowers:** Lavender, Rose, Petunia, Marigold
- **Succulents:** Aloe Vera, Sedum (sehr niedrige Werte!)

## 🔧 Technische Details

### API Endpoints

```javascript
// Pflanzen suchen (Autocomplete)
GET /irrigationdb/api.php?endpoint=search_plants&q=grass

// Empfehlungen abfragen
GET /irrigationdb/api.php?endpoint=recommendations&zone=D&plant=Buffalo%20Grass

// Optimiert für UI (nur min/max)
GET /irrigationdb/api.php?endpoint=get_settings&zone=D&plant=Buffalo%20Grass
```

### JavaScript API

```javascript
// Manueller Aufruf (falls gewünscht)
OSApp.Analog.IrrigationDB.showDialog(function(data) {
    console.log("Selected:", data);
    // data = { min: 12.0, max: 20.0, plant: "Buffalo Grass", zone: "D" }
});

// Zone wechseln
OSApp.Analog.IrrigationDB.saveZone('C');

// Pflanzen suchen
OSApp.Analog.IrrigationDB.searchPlants('grass', function(results) {
    console.log(results);
});
```

### localStorage

Die gewählte Zone wird gespeichert:
```javascript
localStorage.getItem('irrigationdb_zone')  // lesen
localStorage.setItem('irrigationdb_zone', 'D')  // setzen
```

## 🧪 Testing

### Test 1: API funktioniert?
```bash
curl "http://localhost/irrigationdb/api.php?endpoint=search_plants&q=grass"
```

Erwartete Antwort:
```json
[
  {
    "plant_id": 5,
    "common_name": "Buffalo Grass",
    "scientific_name": "Stenotaphrum secundatum",
    "category_name": "Lawn Grass - Warm Season",
    "available_zones": 3
  },
  ...
]
```

### Test 2: Settings abrufen
```bash
curl "http://localhost/irrigationdb/api.php?endpoint=get_settings&zone=D&plant=Buffalo%20Grass"
```

Erwartete Antwort:
```json
{
  "plant_name": "Buffalo Grass",
  "zone_code": "D",
  "zone_name": "Semi-Arid",
  "min_value": "12.00",
  "max_value": "20.00",
  "water_need_level": "very_low",
  "notes": "Very drought tolerant for semi-arid"
}
```

### Test 3: UI-Integration
1. Browser-Konsole öffnen (F12)
2. Testen ob Modul geladen ist:
```javascript
console.log(OSApp.Analog.IrrigationDB);
// Should show object with methods
```

3. Dialog manuell öffnen:
```javascript
OSApp.Analog.IrrigationDB.showDialog(function(data) {
    alert(JSON.stringify(data));
});
```

## 🐛 Troubleshooting

### Problem: Button erscheint nicht

**Lösung:**
1. Prüfen ob `irrigation-db-integration.js` eingebunden ist
2. Browser-Cache leeren (Ctrl+F5)
3. Konsole auf Fehler prüfen

### Problem: "Irrigation Database module not loaded"

**Lösung:**
```html
<!-- In HTML einfügen VOR analog.js: -->
<script src="js/modules/irrigation-db-integration.js"></script>
```

### Problem: API gibt 500 Error

**Lösung:**
1. Prüfen ob Datenbank läuft: `mysql -u irrigation_readonly -p irrigation_control`
2. PHP Error Log prüfen: `tail -f /var/log/apache2/error.log`
3. API-URL prüfen in `irrigation-db-integration.js` Zeile 9

### Problem: Keine Suchergebnisse

**Lösung:**
1. Pflanzennamen exakt wie in Datenbank: "Buffalo Grass" (nicht "buffalo grass")
2. Prüfen ob Empfehlungen für diese Zone/Pflanze existieren
3. Datenbank-Inhalt prüfen:
```sql
SELECT * FROM v_irrigation_recommendations WHERE zone_code='D' AND plant_name LIKE '%Buffalo%';
```

### Problem: Zone wird nicht gespeichert

**Lösung:**
1. LocalStorage im Browser aktiviert?
2. Private/Incognito Mode deaktivieren
3. Browser-Daten nicht automatisch löschen

## 📁 Dateistruktur

```
/srv/www/htdocs/
├── irrigationdb/
│   ├── api.php                          (erweitert)
│   ├── config.php
│   └── index.html
└── ui/www/js/modules/
    ├── analog.js                        (modifiziert)
    ├── analog.js.backup                 (Original-Backup)
    └── irrigation-db-integration.js     (NEU)
```

## 🔄 Rückgängig machen

Falls Probleme auftreten:

```bash
cd /srv/www/htdocs/ui/www/js/modules
cp analog.js.backup analog.js
```

## 📖 Weiterführende Informationen

- API-Dokumentation: `/srv/www/htdocs/irrigationdb/README_API.md`
- Datenbank-Schema: `/data/Workspace/irrigation_database_schema.sql`
- Beispiel-Abfragen: `/data/Workspace/irrigation_queries.sql`

## ✅ Checkliste für Deployment

- [ ] `irrigation-db-integration.js` in HTML eingebunden
- [ ] API erreichbar unter `/irrigationdb/api.php`
- [ ] Datenbank User `irrigation_readonly` funktioniert
- [ ] Browser-Cache geleert
- [ ] Test: Program Adjustment öffnen → Button sichtbar?
- [ ] Test: Button klicken → Dialog öffnet sich?
- [ ] Test: Pflanze suchen → Autocomplete funktioniert?
- [ ] Test: Select klicken → Werte werden übernommen?

## 🎉 Fertig!

Die Integration ist vollständig einsatzbereit!
