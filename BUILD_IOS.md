# OpenSprinkler iOS Build Script

Das neue `buildios.sh` Script automatisiert den gesamten Prozess zum Bauen und Hochladen der iOS-App zu App Store Connect.

## Funktionen

✅ **Versionsverwaltung** - Fragt ab, ob die Versionsnummer erhöht werden soll
✅ **Pre-Build Checks** - Prüft alle essentiellen Dateien und Konfigurationen
✅ **Entitlements Validation** - Überprüft, dass Entitlements korrekt konfiguriert sind
✅ **Automatischer Build** - Erstellt die Release-IPA
✅ **Signatur-Verifizierung** - Überprüft die Code Signing
✅ **App Store Connect Upload** - Uploaded automatisch zu App Store Connect (optional)

## Verwendung

```bash
cd /Users/stefan/Documents/OpenSprinkler-App
./buildios.sh
```

## Schritte die ausgeführt werden

1. **Xcode Version Check** - Stellt sicher, dass Xcode 26+ installiert ist
2. **Versionsverwaltung** - Fragt, ob Version erhöht werden soll
3. **Pre-Build Checks** - Prüft modules.json, iOS Platform, package.json
4. **Entitlements Check** - Validiert Debug und Release Entitlements
5. **Prepare & Clean** - Führt appGMK.sh, grunt makeFW, cordova prepare aus
6. **Build** - Erstellt iOS Release Build
7. **Signatur-Verifizierung** - Überprüft das Provisioning Profile
8. **App Store Connect Upload** - Uploaded die IPA automatisch

## Umgebungsvariablen

Für automatischen Upload zu App Store Connect benötigst du:

```bash
export APPSTORE_USERNAME="your-apple-id@example.com"
export APPSTORE_PASSWORD="your-app-specific-password"
```

Oder füge diese zu `~/.bash_profile` hinzu.

## App Store Connect Spezial-Passwort

1. Gehe zu [appleid.apple.com](https://appleid.apple.com)
2. Melde dich mit deiner Apple ID an
3. Gehe zu "App-spezifische Passwörter"
4. Generiere ein neues Passwort für "Transporter" oder "xcrun"
5. Verwende dieses in der APPSTORE_PASSWORD Variable

## Fallback: Manueller Upload

Falls der automatische Upload nicht funktioniert, kannst du die IPA manuell hochladen:

### Option 1: Xcode Organizer (einfach)
```
1. Öffne Xcode → Window → Organizer
2. Wähle "Apps" Tab
3. Wähle "OpenSprinklerASB"
4. Klick "Distribute App"
5. Wähle die IPA aus: platforms/ios/build/Release-iphoneos/OpenSprinklerASB.ipa
```

### Option 2: Apple Transporter (schnell)
```
1. Installiere Apple Transporter aus dem App Store
2. Öffne Transporter
3. Drag & Drop die IPA-Datei
4. Melde dich an und upload
```

### Option 3: Command Line (altool)
```bash
xcrun altool --upload-app \
  --file platforms/ios/build/Release-iphoneos/OpenSprinklerASB.ipa \
  --type ios \
  --username "your-apple-id@example.com" \
  --password "your-app-specific-password"
```

## Troubleshooting

### "xcrun not found"
- Stelle sicher, dass Xcode installiert ist
- Führe aus: `xcode-select --install`

### "Entitlements-Release.plist fehlt"
- Führe aus: `cordova prepare ios`
- Das Hook-Script sollte die Dateien automatisch erstellen

### "IPA-Signatur ungültig"
- Überprüfe die Provisioning Profiles in Xcode
- Gehe zu Xcode → Preferences → Accounts
- Klick auf dein Team und dann "Manage Certificates"

### Upload schlägt fehl
- Überprüfe dein App-spezifisches Passwort
- Stelle sicher, dass die Apple ID korrekt ist
- Versuche Manueller Upload via Transporter

## Version Geschichte

- **19952** - Entitlements Fixes, modules.json Integration
- **19951** - iOS Startup Fix mit modules.json
- **19950+** - Frühere Versionen
