// Headless end-to-end test for the self-updating UI snapshot copies (www/js/ui-updater.js).
//
// Emulates the Android app at http://localhost:<port>: root bundle from ../../www, the
// versioned snapshots from the Android platform assets, the app data directory as
// /__cdvfile_files__/ (PUT/DELETE backed by a temp dir) and the update server as
// /__remote__/ (a modified copy of one snapshot, signed with a throw-away key).
// ui-updater.js is served with that test key and remote base patched in.
//
// Usage: OS_IP=192.168.0.151 node updater.js [version]      (needs hash.txt, see README.md)
const { spawn, execFileSync } = require("child_process");
const fs = require("fs"), http = require("http"), path = require("path"), os = require("os"), crypto = require("crypto");
const WebSocket = require("/srv/www/htdocs/ui/node_modules/ws");

const REPO = path.resolve(__dirname, "../..");
const WWW = path.join(REPO, "www");
const ASSETS = process.env.ASSETS || path.join(REPO, "platforms/android/app/src/main/assets/www");
const VERSION = process.argv[2] || "2.4.0.228";
const IP = process.env.OS_IP || "192.168.0.151";
const HASH = fs.readFileSync((process.env.CDP_WORKDIR || __dirname) + "/hash.txt", "utf8").trim();
const HP = 8790, CP = 9390;

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "osui-updater-"));
const DATA = path.join(TMP, "data"), REMOTE = path.join(TMP, "remote"), KEY = path.join(TMP, "test-key.pem");
fs.mkdirSync(DATA); fs.mkdirSync(REMOTE);

// --- fake update server content: the bundled snapshot plus a "hotfix" -------------------
fs.cpSync(path.join(ASSETS, VERSION), path.join(REMOTE, VERSION), { recursive: true });
fs.appendFileSync(path.join(REMOTE, VERSION, "js/modules/ui-dom.js"), "\nwindow.__UI_HOTFIX_MARKER = 1;\n");
fs.writeFileSync(path.join(REMOTE, VERSION, "js/hotfix-extra.js"), "window.__UI_HOTFIX_EXTRA = 1;\n");
fs.writeFileSync(path.join(REMOTE, "versions.json"), fs.readFileSync(path.join(ASSETS, "versions.json")));
const GEN = path.join(REPO, "scripts/gen-ui-filelist.js");
const TEST_JWK = execFileSync("node", [GEN, "--genkey", KEY]).toString().trim();
const sign = () => execFileSync("node", [GEN, REMOTE, VERSION], { env: Object.assign({}, process.env, { UI_UPDATE_KEY: KEY }) }).toString().trim();
console.log("signed:", sign());

const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".sig": "text/plain" };
const safeJoin = (root, rel) => { const f = path.normalize(path.join(root, rel)); return f.startsWith(root) ? f : null; };

const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const send = (f) => fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end("not found"); return; } res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(d); });

  if (p.startsWith("/__cdvfile_files__/")) {
    const f = safeJoin(DATA, p.slice("/__cdvfile_files__/".length));
    if (!f) { res.writeHead(400); res.end(); return; }
    if (req.method === "PUT") { const chunks = []; req.on("data", c => chunks.push(c)); req.on("end", () => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.concat(chunks)); res.writeHead(204); res.end(); }); return; }
    if (req.method === "DELETE") { fs.rmSync(f, { recursive: true, force: true }); res.writeHead(204); res.end(); return; }
    if (req.headers["x-list"]) { let names = []; try { names = fs.readdirSync(f).filter(n => fs.statSync(path.join(f, n)).isDirectory()); } catch (e) {} res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(names)); return; }
    send(f); return;
  }
  if (p.startsWith("/__remote__/")) { const f = safeJoin(REMOTE, p.slice("/__remote__/".length)); if (!f) { res.writeHead(400); res.end(); return; } send(f); return; }
  // No native side here: the real cordova bridge would block in prompt().
  if (/\/cordova(_plugins)?\.js$/.test(p)) { res.writeHead(404); res.end(); return; }
  // Also inside the bundled snapshots: build.sh injects the updater there, and the
  // real one would talk to the production server with the production key.
  if (/(^|\/)js\/ui-updater\.js$/.test(p)) {
    let code = fs.readFileSync(path.join(WWW, "js/ui-updater.js"), "utf8");
    code = code.replace(/\/\*UI_UPDATE_PUBLIC_KEY\*\/.*?\/\*END\*\//, TEST_JWK).replace("https://ui.opensprinklershop.de/", "http://localhost:" + HP + "/__remote__/");
    res.writeHead(200, { "Content-Type": "application/javascript", "Cache-Control": "no-store" }); res.end(code); return;
  }
  const rel = p === "/" ? "index.html" : p.slice(1);
  const first = path.join(WWW, rel);
  send(fs.existsSync(first) && fs.statSync(first).isFile() ? first : path.join(ASSETS, rel));
});

// Same contract as the cordova-plugin-file adapter in ui-updater.js.
const TEST_ADAPTER = `({
  write: function(p, buf) { return fetch("/__cdvfile_files__/" + p, { method: "PUT", body: buf }).then(function(r) { if (!r.ok) { throw new Error("write " + p); } }); },
  removeDir: function(p) { return fetch("/__cdvfile_files__/" + p, { method: "DELETE" }).then(function() {}); },
  list: function(p) { return fetch("/__cdvfile_files__/" + p, { headers: { "x-list": "1" } }).then(function(r) { return r.json(); }); }
})`;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = u => new Promise((res, rej) => http.get(u, r => { let d = ""; r.on("data", c => d += c); r.on("end", () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on("error", rej));
const results = []; const expect = (name, ok, detail) => { results.push(ok); console.log((ok ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? "  -> " + detail : "")); };

srv.listen(HP, async () => {
  const chrome = spawn("/usr/bin/chromium", ["--headless=new", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=" + CP, "--user-data-dir=" + path.join(TMP, "profile"), "--disable-features=LocalNetworkAccessChecks", "--window-size=420,900", "about:blank"], { stdio: "ignore" });
  // Chromium keeps writing its profile while it shuts down; remove the temp dir afterwards.
  const finish = (code) => { try { chrome.kill(); } catch (e) {} srv.close(); setTimeout(() => { fs.rmSync(TMP, { recursive: true, force: true }); process.exit(code); }, 1500); };
  try {
    let t; for (let i = 0; i < 40; i++) { try { t = await getJSON("http://127.0.0.1:" + CP + "/json"); break; } catch (e) { await sleep(250); } }
    const ws = new WebSocket(t.find(x => x.type === "page").webSocketDebuggerUrl); await new Promise(r => ws.on("open", r));
    let id = 0; const pending = {}; const errs = [];
    ws.on("message", raw => { const m = JSON.parse(raw); if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
      if (m.method === "Runtime.exceptionThrown") errs.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 200));
      if (m.method === "Page.javascriptDialogOpening") ws.send(JSON.stringify({ id: ++id, method: "Page.handleJavaScriptDialog", params: { accept: false } })); });
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (pending[i]) { delete pending[i]; r({ timeout: true }); } }, 90000); });
    const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }); return r.result?.exceptionDetails ? "EXC:" + String(r.result.exceptionDetails.exception?.description).slice(0, 200) : r.result?.result?.value; };
    const origin = "http://localhost:" + HP;
    const boot = async (secs) => { await send("Page.navigate", { url: origin + "/index.html" }); let st = {}; for (let i = 0; i < (secs || 60) * 2; i++) { await sleep(500); const s = await ev(`JSON.stringify({path:location.pathname,page:(document.querySelector('.ui-page-active')||{}).id||null})`); try { st = JSON.parse(s); } catch (e) { continue; } if (st.page === "sprinklers") { await sleep(1500); break; } } return st; };
    const withUpdater = (body) => ev(`(async function(){ if(!window.OSUIUpdater){ await new Promise(function(ok,no){var s=document.createElement('script');s.src='/js/ui-updater.js';s.onload=ok;s.onerror=no;document.head.appendChild(s);}); } OSUIUpdater._setAdapter(${TEST_ADAPTER}); ${body} })()`);

    await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable"); await send("Network.setBypassServiceWorker", { bypass: true });
    await send("Page.navigate", { url: origin + "/versions.json" }); await sleep(800);
    await ev(`(function(){ localStorage.clear(); localStorage.setItem('sites', JSON.stringify({ Bench: { os_ip: "${IP}", os_pw: "${HASH}" } })); localStorage.setItem('current_site','Bench'); return 1; })()`);

    console.log("1) first boot uses the bundled snapshot");
    let st = await boot();
    expect("routed to bundled /" + VERSION + "/", st.path === "/" + VERSION + "/index.html" && st.page === "sprinklers", JSON.stringify(st));
    expect("firmware remembered for the updater", /"fwm":/.test(await ev(`localStorage.getItem("ui_last_fw")||""`)));

    await ev(`localStorage.setItem("/${VERSION}:uiTheme", "test-theme")`);
    console.log("2) updater installs the signed copy");
    const r1 = JSON.parse(await withUpdater(`return JSON.stringify(await OSUIUpdater.check(true));`));
    expect("check() installed a copy", r1.status === "installed" && r1.version === VERSION, JSON.stringify(r1));
    expect("only the changed files were downloaded", r1.downloaded === 2, "downloaded=" + r1.downloaded);
    const copyDir = path.join(DATA, "ui", String(r1.id), VERSION);
    expect("copy has no native bridge of its own", !fs.existsSync(path.join(copyDir, "cordova.js")) && !fs.existsSync(path.join(copyDir, "plugins")));
    const idx = fs.existsSync(path.join(copyDir, "index.html")) ? fs.readFileSync(path.join(copyDir, "index.html"), "utf8") : "";
    expect("index.html points at the app root for bridge, watchdog and updater", /src="\/cordova\.js"/.test(idx) && /src="\/js\/boot-diagnostics\.js"/.test(idx) && /src="\/js\/ui-updater\.js"/.test(idx) && !/src="js\/boot-diagnostics\.js"/.test(idx));
    const r2 = JSON.parse(await withUpdater(`return JSON.stringify(await OSUIUpdater.check(true));`));
    expect("second check finds it current", r2.status === "current", JSON.stringify(r2));

    console.log("3) next boot runs from the copy");
    st = await boot();
    expect("routed to the copy", st.path === "/__cdvfile_files__/ui/" + r1.id + "/" + VERSION + "/index.html" && st.page === "sprinklers", JSON.stringify(st));
    expect("hotfix code is active", (await ev(`window.__UI_HOTFIX_MARKER`)) === 1);
    expect("per-version settings travelled into the copy", (await ev(`OSApp.Storage.getItemSync("uiTheme")`)) === "test-theme", await ev(`OSApp.Storage.prefix`));
    expect("updater and new watchdog loaded from the app root", (await ev(`!!(window.OSUIUpdater && window.OSUIUpdater.currentCopyId() === "${r1.id}" && window.OSBoot)`)) === true);
    await ev(`OSApp.UIDom.changePage('#programs')`); await sleep(6000);
    expect("program editor opens inside the copy", (await ev(`(document.querySelector('.ui-page-active')||{}).id`)) === "programs");
    await ev(`OSApp.UIDom.changePage('#site-control')`); let back = {}; for (let i = 0; i < 30; i++) { await sleep(500); try { back = JSON.parse(await ev(`JSON.stringify({path:location.pathname,page:(document.querySelector('.ui-page-active')||{}).id||null})`)); } catch (e) {} if (back.path === "/index.html" && back.page === "site-control") break; }
    expect("leaving for the site manager lands in the app root", back.path === "/index.html" && back.page === "site-control", JSON.stringify(back));

    console.log("4) manipulated downloads are refused");
    fs.appendFileSync(path.join(REMOTE, VERSION, "js/hotfix-extra.js"), "// tampered after signing\n");
    fs.appendFileSync(path.join(REMOTE, VERSION, "css/main.css"), "\n/* new content, list re-signed below */\n");
    const before = await ev(`localStorage.getItem("ui_overlay_v1")`);
    // re-sign everything, then tamper with one file again -> list valid, file hash wrong
    sign(); fs.appendFileSync(path.join(REMOTE, VERSION, "js/hotfix-extra.js"), "// tampered again\n");
    const r3 = JSON.parse(await withUpdater(`return JSON.stringify(await OSUIUpdater.check(true));`));
    expect("file with a wrong hash aborts the install", r3.status === "error" && /hash mismatch/.test(r3.message), JSON.stringify(r3));
    expect("pointer untouched after the failed install", (await ev(`localStorage.getItem("ui_overlay_v1")`)) === before);
    sign(); const listFile = path.join(REMOTE, VERSION, "filelist.json");
    fs.writeFileSync(listFile, fs.readFileSync(listFile, "utf8").replace('"files":{', '"files":{"js/evil.js":{"sha256":"' + "0".repeat(64) + '","size":1},'));
    const r4 = JSON.parse(await withUpdater(`return JSON.stringify(await OSUIUpdater.check(true));`));
    expect("edited file list fails the signature check", r4.status === "error" && /signature/.test(r4.message), JSON.stringify(r4));
    const otherKey = path.join(TMP, "other.pem"); execFileSync("node", [GEN, "--genkey", otherKey]);
    fs.rmSync(path.join(REMOTE, VERSION, "filelist.sig")); execFileSync("node", [GEN, REMOTE, VERSION], { env: Object.assign({}, process.env, { UI_UPDATE_KEY: otherKey }) });
    const r5 = JSON.parse(await withUpdater(`return JSON.stringify(await OSUIUpdater.check(true));`));
    expect("list signed with a foreign key is refused", r5.status === "error" && /signature/.test(r5.message), JSON.stringify(r5));

    console.log("5) a copy that does not boot is blocked and the bundled snapshot returns");
    st = await boot();
    expect("still on the copy before the watchdog fires", /^\/__cdvfile_files__\//.test(st.path || ""), JSON.stringify(st));
    await ev(`OSApp.Storage.setItemSync("uiTheme", "changed-in-copy")`);
    await ev(`window.OSBoot.recover("test: simulated freeze")`);
    let after = {}; for (let i = 0; i < 120; i++) { await sleep(500); try { after = JSON.parse(await ev(`JSON.stringify({path:location.pathname,page:(document.querySelector('.ui-page-active')||{}).id||null})`)); } catch (e) {} if (after.path === "/" + VERSION + "/index.html" && after.page === "sprinklers") break; }
    expect("watchdog sent the app back to the bundled snapshot", after.path === "/" + VERSION + "/index.html" && after.page === "sprinklers", JSON.stringify(after));
    expect("settings changed inside the copy came back", (await ev(`localStorage.getItem("/${VERSION}:uiTheme")`)) === "changed-in-copy");
    expect("copy id is blocked", (await ev(`!!JSON.parse(localStorage.getItem("ui_overlay_bad")||"{}")["${r1.id}"]`)) === true);

    console.log("6) localStorage mirror survives a change of the WebView origin (js/storage-guard.js)");
    const guard = (body) => ev(`(async function(){
      if (!window.__fs) { window.__fs = {};
        window.cordova = window.cordova || {}; window.cordova.file = { dataDirectory: "file:///data/" };
        window.resolveLocalFileSystemURL = function(u, ok) { ok({ getFile: function(name, opts, ok2, fail) {
          if (!opts.create && !(name in window.__fs)) { fail({ code: 1 }); return; }
          if (!(name in window.__fs)) { window.__fs[name] = ""; }
          ok2({ file: function(cb) { cb(new Blob([window.__fs[name]])); },
                createWriter: function(cb) { var w = { write: function(b) { b.text().then(function(x) { window.__fs[name] = x; w.onwriteend(); }); }, truncate: function() { setTimeout(function() { w.onwriteend(); }, 0); } }; cb(w); } }); } }); }; }
      if (!window.OSStorageGuard) { await new Promise(function(ok, no) { var s = document.createElement('script'); s.src = '/js/storage-guard.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
      ${body} })()`);
    const saved = JSON.parse(await guard(`await OSStorageGuard.save(); return window.__fs["ls-backup.json"] || "{}";`));
    expect("backup holds the sites and names its origin", saved.origin === origin && !!(saved.items && saved.items.sites) && saved.items.current_site === "Bench", saved.origin);
    expect("copy bookkeeping and copy-path settings stay out of the backup", !Object.keys(saved.items || {}).some(k => /^ui_(overlay|update)_|^\/__cdvfile_files__\//.test(k)));
    expect("iOS bundle paths are stored in portable form", (await guard(`return OSStorageGuard._portableKey("/private/var/containers/Bundle/Application/ABC/OpenSprinkler.app/www/2.4.0.228:uiTheme") + "|" + OSStorageGuard._portableKey("/private/var/x/OpenSprinkler.app/www:isMetric") + "|" + OSStorageGuard._portableKey("sites")`)) === "/2.4.0.228:uiTheme|isMetric|sites");
    const r6 = await guard(`
      window.__fs["ls-backup.json"] = JSON.stringify({ origin: "file://", ts: 123, items: { sites: JSON.stringify({ Garten: { os_ip: "10.0.0.9", os_pw: "x" } }), current_site: "Garten", "/2.4.0.228:uiTheme": "from-file-origin" } });
      var first = await OSStorageGuard._restoreIfOriginChanged(), second = await OSStorageGuard._restoreIfOriginChanged();
      return JSON.stringify({ first: first, second: second, site: localStorage.getItem("current_site"), theme: localStorage.getItem("/2.4.0.228:uiTheme"), hasGarten: /Garten/.test(localStorage.getItem("sites")) });`);
    const g = JSON.parse(r6);
    expect("backup from another origin is restored exactly once", g.first === true && g.second === false && g.site === "Garten" && g.hasGarten && g.theme === "from-file-origin", r6);
    const r7 = JSON.parse(await guard(`localStorage.removeItem("sites"); var wrote = await OSStorageGuard.save(); return JSON.stringify({ wrote: wrote, stillThere: /Garten/.test(window.__fs["ls-backup.json"]) });`));
    expect("an empty store never overwrites the backup", r7.wrote === false && r7.stillThere === true, JSON.stringify(r7));

    const relevant = errs.filter(e => !/cordova|firebase/i.test(e));
    expect("no uncaught exceptions", relevant.length === 0, relevant.slice(0, 3).join(" | "));
    console.log(results.every(Boolean) ? "\nALL " + results.length + " CHECKS PASSED" : "\n" + results.filter(x => !x).length + " of " + results.length + " CHECKS FAILED");
    ws.close(); finish(results.every(Boolean) ? 0 : 1);
  } catch (e) { console.error("driver failed:", e); finish(2); }
});
