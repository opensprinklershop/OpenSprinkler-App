# Headless UI smoke tests (Chromium + CDP)

Drives the web app in headless Chromium against a real controller and reports
JavaScript exceptions/console errors plus a per-scenario JSON result.

Prerequisites: `/usr/bin/chromium`, `node_modules/ws`, a static server for `www/`
(Apache serves `index.html` as `application/x-php`, so use e.g.
`cd www && python3 -m http.server 8765 --bind 127.0.0.1`), and the MD5 password
hash of the controller in `hash.txt` next to `drive.js` (gitignored — do not commit).

```bash
cd test/headless
echo -n "<md5 of admin password>" > hash.txt
OS_IP=192.168.0.151 node drive.js adjust   # program adjustment editor (piecewise + irrigation DB dialog)
OS_IP=192.168.0.151 node drive.js pages    # #sensors, #sensor-logs, #programs sensor adjustment section
OS_IP=192.168.0.151 node drive.js save     # creates/saves/deletes a piecewise adjustment end-to-end
python3 cleanup.py                         # kills leftover headless browsers / the static server
OS_IP=192.168.0.151 node updater.js        # self-updating snapshot copies (www/js/ui-updater.js), end to end
```

`updater.js` is self-contained (own server on 8790, no static server needed): it emulates the
Android app at `http://localhost`, the app data directory (`/__cdvfile_files__/`) and a signed
update server with a throw-away key, then checks install, routing into the copy, the way back to
the site manager, settings travelling with the copy, refused manipulations (wrong hash, edited
list, foreign key), the watchdog fallback and the `storage-guard.js` backup/restore across an origin
change (with an in-memory file system). It needs the Android platform assets (`platforms/android/.../assets/www`, i.e. one
`./build.sh` run). Chromium fails to start when `TMPDIR` is a very long path.

`drive.js` expects the UI at `http://127.0.0.1:8765/index.html`; the browser profile is
created in `./profile` (delete it to drop the service-worker cache after UI changes).
