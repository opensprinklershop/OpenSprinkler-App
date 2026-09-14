// Minimal CDP driver: load the UI, connect to the bench device, run a scenario, report console errors.
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const WebSocket = require("/srv/www/htdocs/ui/node_modules/ws");
const S = process.env.CDP_WORKDIR || __dirname;
const HASH = fs.readFileSync(S + "/hash.txt", "utf8").trim();
const IP = process.env.OS_IP || "192.168.0.151";
const scenario = process.argv[2] || "adjust";
const chrome = spawn("/usr/bin/chromium", ["--headless=new", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=9333",
  "--user-data-dir=" + S + "/profile", "--window-size=1200,900", "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJSON(url) { return new Promise((res, rej) => http.get(url, r => { let d = ""; r.on("data", c => d += c); r.on("end", () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on("error", rej)); }
(async () => {
  let targets; for (let i = 0; i < 40; i++) { try { targets = await getJSON("http://127.0.0.1:9333/json"); break; } catch (e) { await sleep(250); } }
  const page = targets.find(t => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.on("open", r));
  let id = 0; const pending = {}; const errors = [];
  ws.on("message", m => { const msg = JSON.parse(m); if (msg.id && pending[msg.id]) { pending[msg.id](msg); delete pending[msg.id]; }
    if (msg.method === "Runtime.exceptionThrown") errors.push("EXC: " + JSON.stringify(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text).slice(0, 400));
    if (msg.method === "Runtime.consoleAPICalled" && (msg.params.type === "error" || msg.params.type === "warning")) errors.push("CONSOLE." + msg.params.type + ": " + msg.params.args.map(a => a.value || a.description).join(" ").slice(0, 300)); });
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr, awaitPromise = false) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise, returnByValue: true }); return r.result?.exceptionDetails ? ("EVAL-EXC: " + JSON.stringify(r.result.exceptionDetails.exception?.description).slice(0, 400)) : r.result?.result?.value; };
  await send("Runtime.enable"); await send("Page.enable");
  const nav1 = await send("Page.navigate", { url: "http://127.0.0.1:8765/index.html" }); console.log("nav1:", JSON.stringify(nav1).slice(0,300)); await sleep(2500);
  console.log("after nav1:", await ev(`location.href`));
  await ev(`localStorage.setItem("sites", JSON.stringify({"Bench":{"os_ip":"${IP}","os_pw":"${HASH}"}})); localStorage.setItem("current_site","Bench"); localStorage.removeItem("show_sites"); "ok"`);
  await send("Page.navigate", { url: "http://127.0.0.1:8765/index.html" });
  await sleep(4000);
  console.log("connect click:", await ev(`(function(){ var b=$(".connectnow").first(); if(b.length){ b.trigger("click"); return "clicked"; } return "no button, page=" + $(".ui-page-active").attr("id"); })()`));
  for (let i = 0; i < 60; i++) { await sleep(1000); const ok = await ev(`!!(window.OSApp && OSApp.currentSession && OSApp.currentSession.controller && OSApp.currentSession.controller.programs && OSApp.Analog && OSApp.Analog.analogSensors && OSApp.Analog.analogSensors.length)`); if (ok === true) break; }
  console.log("diag:", await ev(`JSON.stringify({href:location.href, scripts:document.scripts.length, osapp:typeof OSApp, body:document.body.innerText.slice(0,200), srcs:[...document.scripts].slice(0,8).map(s=>s.src.replace(location.origin,''))})`));
  console.log("connected:", await ev(`JSON.stringify({fwv:OSApp.currentSession.controller.options.fwv, sensors:(OSApp.currentSession.controller.sensors||{}).count, analog:OSApp.Analog.analogSensors.length, supported:OSApp.Supported.sensors(), page:$(".ui-page-active").attr("id")})`));
  const scen = fs.readFileSync(S + "/scenario_" + scenario + ".js", "utf8");
  console.log("scenario result:", await ev(`(async()=>{ ${scen} })()`, true));
  try { const shot = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(S + "/shot_" + scenario + ".png", Buffer.from(shot.result.data, "base64")); console.log("screenshot:", S + "/shot_" + scenario + ".png"); } catch (e) { console.log("screenshot failed", e); }
  console.log("errors:\n" + (errors.length ? errors.join("\n") : "(none)"));
  ws.close(); chrome.kill(); process.exit(0);
})().catch(e => { console.error("driver failed", e); chrome.kill(); process.exit(1); });
