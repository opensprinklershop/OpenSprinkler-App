
const sleep = ms => new Promise(r => setTimeout(r, ms));
OSApp.UIDom.changePage("#analogsensorconfig"); await sleep(6000);
$(".add-progadjust").first().trigger("click"); await sleep(3000);
const ed = $("#progAdjustEditor"); ed.find("#type").val("5").change(); await sleep(1500);
ed.find(".adj-name").val("cdp toolbar save");
const nr = parseInt(ed.find(".nr").val(), 10);
$("#header .analog-editor-save, .ui-header .analog-editor-save").first().trigger("click"); await sleep(4000);
const se = await OSApp.Firmware.sendToOS("/se?pw=&nr=" + nr, "json");
const saved = se.count === 1 && se.progAdjust[0].type === 5;
await OSApp.Firmware.sendToOS("/sb?pw=&nr=" + nr + "&type=0", "json");
$(".add-progadjust").first().trigger("click"); await sleep(3000);
$("#progAdjustEditor #type").val("5").change(); await sleep(1500);
return JSON.stringify({ savedViaToolbar: saved, pageAfterSave: $(".ui-page-active").attr("id"), nowPage: $(".ui-page-active").attr("id") });
