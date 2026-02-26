# Copilot Instructions for OpenSprinkler UI

## Build, test, and lint commands

- Install deps: `npm install`
- Local web dev server (serves `www/`): `npm start` (open `http://localhost:8080`)
- Lint JS: `npm run lint` (runs `eslint ./www/js/**`)
- Full browser test suite (Karma + Mocha + Chai): `npm test`
  - Requires a Chrome binary (`ChromeHeadless`); set `CHROME_BIN` if needed.
- Run a single test/suite by name (Mocha grep through Karma):
  - `npx karma start --browsers ChromeHeadless test/karma.conf.js -- --grep="Initial Definition Check"`
- Legacy Grunt checks used in CI: `npx grunt` (default task runs `jshint` + `jscs`)
- Firmware/web asset package: `npx grunt makeFW`
- Cordova browser package flow: `./buildweb.sh`
- Full Cordova build flow (browser + Android release artifacts): `./build.sh`

## High-level architecture

- This repo is a Cordova-hosted, jQuery Mobile web app; the runtime UI is in `www/`, while `config.xml` + `platforms/` drive native packaging.
- `www/index.html` is the boot page and manually loads vendor files, then `www/js/modules/*.js`, then `www/js/main.js` last.
- The app is organized around a shared global namespace (`OSApp`) rather than imports/exports:
  - `www/js/main.js` defines core constants/session/UI state and starts the app via `OSApp.UIDom.launchApp()`.
  - `www/js/modules/ui-dom.js` is the main event/router layer (`deviceready`, `mobileinit`, page transitions, app resume).
  - Feature modules under `www/js/modules/` attach to `OSApp.*` (programs, sites, weather, logs, options, etc.).
- Tests are browser integration-style tests:
  - `test/karma.conf.js` loads CSS/vendor/app modules in a strict order.
  - `test/prepare_tests.js` injects `www/index.html` body and mocks controller endpoints with `sinon.fakeServer`.
- Build scripts (`buildweb.sh`, `build.sh`) run `scripts/appGMK.sh` / `appGMK2.sh` around packaging to swap `GOOGLEMAPSAPIKEY` placeholders and stamp `www/sw.js` cache version.

## Key conventions in this codebase

- Keep script/module load order stable; both `www/index.html` and `test/karma.conf.js` depend on explicit ordering to avoid undefined globals.
- Follow the module pattern used across files:
  - `var OSApp = OSApp || {};`
  - `OSApp.<Module> = OSApp.<Module> || {};`
- Localization conventions:
  - Static HTML text uses `data-translate="..."`.
  - Runtime JS strings use `OSApp.Language._("...")`.
  - Locale payloads are JSON-like files under `www/locale/` and are loaded by `OSApp.Language.updateLang`.
- This is a legacy global-JS codebase (not ES modules/TypeScript); preserve existing style patterns (`var`, jQuery objects, global declarations like `/* global $ */`) unless a task explicitly modernizes code.
- Service worker cache versioning uses `OpenSprinkler-v__BUILD_TIMESTAMP__` in `www/sw.js`; build scripts replace and then restore this placeholder.

## Debug / Test Environment 🔧

### Device Connection
- **Device IP**: `192.168.0.86`
- **Admin Password**: Required for API access (MD5 hash needed)

### Computing the Admin Password Hash

The REST API requires the MD5 hash of the admin password. Calculate it locally:

```bash
# Linux/Mac
echo -n "your_admin_password" | md5sum | awk '{print $1}'

# Windows PowerShell
$Text = "your_admin_password"
$Bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
$Hash = [System.Security.Cryptography.MD5]::Create().ComputeHash($Bytes)
([System.BitConverter]::ToString($Hash) -replace "-","").ToLower()
```

⚠️ **Security Note**: This hash is only computed and stored locally. Do NOT share it or commit it to public repositories.

### Testing via MCP Server
The firmware repo includes an MCP server at `tools/mcp-server/` (in the OpenSprinkler-Firmware workspace) that exposes the OpenSprinkler REST API as MCP tools for AI assistants. See `tools/mcp-server/README.md` for setup and available tools.

### Testing via direct REST API
All OpenSprinkler endpoints accept `?pw=<md5hash>` (use the admin password hash computed above):
```bash
# Example (replace HASH with your computed MD5):
ADMIN_HASH="<YOUR_ADMIN_PASSWORD_HASH>"

# Get all data (stations, programs, options, status)
curl "http://192.168.0.86/ja?pw=${ADMIN_HASH}"

# Get options (firmware version, network settings)
curl "http://192.168.0.86/jo?pw=${ADMIN_HASH}"

# Get station status
curl "http://192.168.0.86/js?pw=${ADMIN_HASH}"

# Get sensors
curl "http://192.168.0.86/sl?pw=${ADMIN_HASH}"
```

### UI Development with Device
- When running `npm start`, the local dev server serves at `http://localhost:8080`
- Point the UI to the device by entering `http://192.168.0.86` as the site IP in the app
- The UI communicates with the controller via AJAX calls to the REST API endpoints above
