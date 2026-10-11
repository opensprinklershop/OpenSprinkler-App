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

## URL scheme and the self-updating UI copies

iOS ran under `ionic://localhost` from 2021 until the cordova-ios 8.1.1 update of 2026-08-07, which
switched `config.xml` to `<preference name="scheme" value="file" />` unintentionally. Under `file://`
the self-updating UI copies (`www/js/ui-updater.js`) stay idle: a page outside the app bundle cannot be
loaded and WebCrypto is unavailable. Going back to a custom scheme changes the WebView origin, and
`localStorage` (stored sites, passwords, settings) belongs to the origin. Therefore two releases:

1. **Release A (2.4.234, 2026-09-21) — `scheme=file`.** Shipped `www/js/storage-guard.js`, which mirrors
   `localStorage` into `ls-backup.json` in the app data directory on every start, every minute and on
   pause. It stayed in the store so users opened the app at least once with it.
2. **Release B (since 2026-10-11, the build after 2.4.234) — `scheme=ionic`, `hostname=localhost`.**
   On the first start the guard sees a backup written under `file://`, restores it once and reloads.
   From then on the updater is active on iOS as well: copies are served as
   `ionic://localhost/_app_file_<dataDirectory>/ui/<id>/<version>/index.html` (cordova-ios maps
   `/_app_file_<absolute path>` to that file; the updater refreshes the base on every start because the
   container path changes with app updates and restores).

Users who skipped release A get whatever `ionic://` still holds from before August (or an empty site
list). Do not switch back to `file` without the same two-step procedure.

To verify on a device after release B (Safari Web Inspector): `window.location.origin` is
`ionic://localhost`, `window.isSecureContext` / `crypto.subtle` present, LAN controller requests, Gardena
OAuth redirect, Firebase push, Google Maps, the `[storage-guard] restored …` line on the first start and
`[ui-updater] installed …` about 20 s after a controller has been opened (`localStorage.ui_overlay_v1`
then names the copy; the next start of that controller runs from `/_app_file_…`). The path handling
itself is covered by `test/headless/updater.js` (section 7), which needs no device.
