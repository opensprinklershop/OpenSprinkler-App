---
name: app-release
description: Release the OpenSprinkler mobile/web app (Android/iOS/Web UI/PWA) and publish its changelog to opensprinklershop.de/app. Use when asked to "release the app", "cut a UI/app release", write/update the UI CHANGELOG for a release, publish the app changelog/version-history page, upload the changelog to opensprinklershop.de/app, bump the app version badges, or refresh the multilingual user manual + screenshots on opensprinklershop.github.io when the app UI changed. Covers writing a thorough UI CHANGELOG entry from git history, updating + deploying the `/data/app` version catalog to IONOS, and regenerating per-language screenshots via ScreenShotMachine + publishing the manual via mkdocs gh-deploy. DO NOT USE FOR firmware releases (use firmware-release).
---

# App Release

Release workflow for the OpenSprinkler App / UI repo (`/srv/www/htdocs/ui`) and the public
changelog page at **https://opensprinklershop.de/app**.

Two separate things — do both:
1. **UI repo CHANGELOG.md** — the developer-facing changelog in the ui repo.
2. **App changelog page** — a JSON-catalog-driven landing page deployed from `/data/app`
   (NOT the ui repo CHANGELOG.md).

## Version scheme
- `config.xml` `version="2.4.NNN"` is the app version (e.g. `2.4.225`); `NNN` matches the firmware
  `OS_FW_MINOR`. Android build number == `NNN`; iOS version == `2.4.NNN`.
- UI CHANGELOG header: `## [2.4.NNN] - YYYY-MM-DD`.

## Step 1 — Write the UI CHANGELOG (be thorough)
1. Read the top of `/srv/www/htdocs/ui/CHANGELOG.md` to find the last released version (e.g. `2.4.224`).
2. Find the commit that added that entry: `git log --oneline -S "## [2.4.224]" -- CHANGELOG.md`.
3. List new commits: `git log --no-merges --format="%h %s" <that-commit>..HEAD` and
   `git diff --stat <that-commit>..HEAD` to see touched modules.
   Cross-reference `/memories/repo/ui-*.md` for root-cause-accurate wording (most UI fixes have a note).
4. Insert a new `## [2.4.NNN] - <date>` section at the top (after the `# Changelog` header), with a
   one-line `Release 2.4.NNN (Android Build NNN / iOS 2.4.NNN)` and grouped
   `### Hinzugefügt` / `### Geändert` / `### Behoben` (German prose). Keep older sections below.

## Step 2 — Update + deploy the app changelog page (opensprinklershop.de/app)
The page is driven by a JSON catalog, rendered client-side via marked.js. Source lives in `/data/app`:
`index.html`, `versions.json`, `manifest.json`, `deploy.sh`. Web root = `/home/www/public` on IONOS,
so the page is `/home/www/public/app`.

1. Prepend a new entry to `/data/app/versions.json` (array, newest first). Use a python merge so JSON
   stays valid (drop any existing same-version entry, insert at index 0, `ensure_ascii=False, indent=2`):
   ```python
   import json
   d = json.load(open("versions.json", encoding="utf-8"))
   entry = {
     "version": "2.4.NNN", "android_build": NNN, "ios_version": "2.4.NNN",
     "date": "YYYY-MM-DD", "title": "<short summary>",
     "platforms": ["Android","iOS","Web UI","PWA"],
     "changelog": "Release 2.4.NNN (Android Build NNN / iOS v2.4.NNN)\n\n### Hinzugefügt\n- ...\n\n### Geändert\n- ...\n\n### Behoben\n- ...",
   }
   d = [e for e in d if e.get("version") != "2.4.NNN"]; d.insert(0, entry)
   json.dump(d, open("versions.json","w",encoding="utf-8"), ensure_ascii=False, indent=2)
   ```
   `changelog` is a markdown string (with `\n`). `loadVersions()` in index.html renders it.
2. Bump the two hardcoded fallback badges in `/data/app/index.html` (`#latest-ios-badge`,
   `#latest-web-badge`) from the old `2.4.x` to the new version. JS overwrites them from
   versions.json at runtime, but keep the literals current.
3. Deploy:
   ```bash
   cd /data/app && ./deploy.sh
   ```
   `deploy.sh` rsyncs `/data/app/` → IONOS `/home/www/public/app` using IONOS_SSH_* creds from
   `/srv/www/htdocs/ui/.env` (never print the password).
4. Verify live:
   ```bash
   curl -s "https://opensprinklershop.de/app/versions.json?t=$(date +%s)" \
     | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['version'],'-',d[0]['title'])"
   ```

## Step 3 — Manual & screenshots on github.io (when the app UI changed visibly)
The user manual at **https://opensprinklershop.github.io** shows screenshots of THIS app's UI and
describes its features in multiple languages. When an app release changes the UI appearance or adds/
changes a documented feature, refresh the docs too. (The docs live in the firmware repo under
`/data/Workspace/OpenSprinkler-Firmware/docs` and publish via `mkdocs gh-deploy`. The `docs`
directory is gitignored for NEW files, but a subset — `index*.md`, some `opensprinklerpro_*.md` — is
already TRACKED, so version/content edits there must be committed with `git add -u docs/docs`; see
firmware-release Step 3e.)

### 3a. Regenerate screenshots (ScreenShotMachine)
Playwright automation captures mobile-size UI screenshots per language into the manual.
```bash
cd /data/Workspace/ScreenShotMachine
npm install    # first run only
LANGUAGES=de,en,fr,it,hu,pl,pt OS_BASE_URL=http://192.168.0.151 \
  OS_PASSWORD='<admin-pw>' npm run capture
```
- Output: `docs/docs/assets/screenshots/pro/<lang>/<name>.png`; docs embed them per language, e.g.
  `![...](assets/screenshots/pro/de/online-update.png){ .mobile-screenshot }`.
- **Credentials are secret**: pass `OS_PASSWORD` (or `OS_PASSWORD_HASH`) at runtime; the user types it
  in the terminal — never hardcode, print, or commit it. Do NOT request it via a prompt tool.
- Subsets: `SHOTS=analog-sensor-editor,monitors` and/or `LANGUAGES=de,en`.
- Read-only automation (no saves/reboots/mode changes/updates). Logic-monitor shots
  (`monitor-and/or/xor/not/set-sensor12`) need a **test** controller pre-seeded via
  `bash create_monitors.sh` (never against production). New screenshot ⇒ add a shot in `capture.js`.

### 3b. Multilingual manual content
Doc pages are per-language files (English = no suffix). Mind the mixed suffix convention: most pages
use a hyphen (`index-de.md`, `zigbee-fr.md`), but `opensprinklerpro` uses an underscore
(`opensprinklerpro_de.md`). Languages: `de, en, fr, it, hu, pl, pt` (coverage varies per page —
`ls <base>*.md`). Edit the English page first, then mirror into every existing language variant.

### 3c. Publish
```bash
cd /data/Workspace/OpenSprinkler-Firmware/docs && ./.venv/bin/mkdocs gh-deploy \
  --remote-name pages_origin --remote-branch main --force --ignore-version
```
See the **firmware-release** skill (Step 3) for full detail; that skill owns the github.io docs flow.

## Notes
- The store binaries (APK/AAB/iOS) are built separately via `build.sh` / `buildios.sh`; this skill
  covers the **changelog/version publishing**, not store submission.
- The UI dev build is frozen into a versioned `ui-live/www/<ver>` folder by the FIRMWARE release
  (`fw.sh release` calls `promote_ui_release`), not here. See firmware-release for that.
- Commit messages: English. Changelog prose: German.
- See `/memories/repo/app-changelog-deploy-opensprinklershop-app.md` and
  `/memories/repo/ui-versionsjson-root-owned-blocks-app-bundle.md` for deeper detail.
