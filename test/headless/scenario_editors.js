const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = {}; const hdr = () => $("#header h1, .ui-header h1, #header .ui-title").first().text().trim();
OSApp.UIDom.changePage("#analogsensorconfig"); await sleep(6000);
out.configHeader = hdr();
// 1) sensor editor
$(".edit-sensor").first().trigger("click"); await sleep(3000);
out.sensorPage = $(".ui-page-active").attr("id"); out.sensorHeader = hdr();
out.sensorEditorVisible = $("#sensorEditor:visible").length; out.sensorInputs = $("#sensorEditor input:visible").length;
$(".ui-toolbar-back-btn:visible").first().trigger("click"); await sleep(2500);
out.afterSensorBack = $(".ui-page-active").attr("id"); out.afterSensorBackHeader = hdr();
// 2) adjustment editor (new) with piecewise + chart + irrigation dialog + submit
$(".add-progadjust").first().trigger("click"); await sleep(2500);
out.adjPage = $(".ui-page-active").attr("id"); out.adjHeader = hdr();
const ed = $("#progAdjustEditor");
ed.find("#type").val("5").change(); await sleep(1500);
out.adjRows = ed.find(".adj-points-table tbody tr:visible").length; out.adjChart = ed.find("#adjchart svg").length;
ed.find(".link-irrigationdb-adjustment").trigger("click"); await sleep(2500);
out.irrigDialog = $("#irrigationDBDialog:visible").length; $("#irrigationDBDialogOverlay").remove();
ed.find(".adj-name").val("cdp page test");
const nr = parseInt(ed.find(".nr").val(), 10);
ed.find(".submit").trigger("click"); await sleep(4000);
out.afterSubmitPage = $(".ui-page-active").attr("id"); out.afterSubmitHeader = hdr();
const se = await OSApp.Firmware.sendToOS("/se?pw=&nr=" + nr, "json"); out.saved = se.count === 1 && se.progAdjust[0].type === 5;
await OSApp.Firmware.sendToOS("/sb?pw=&nr=" + nr + "&type=0", "json");
// 3) monitor editor
$(".add-monitor, .add-monitors").first().trigger("click"); await sleep(2500);
out.monPage = $(".ui-page-active").attr("id"); out.monHeader = hdr(); out.monVisible = $("#monitorEditor:visible").length;
$("#monitorEditor").popup("close"); await sleep(2500);
out.afterMonClose = $(".ui-page-active").attr("id"); out.afterMonHeader = hdr();
out.leftoverPages = $("[id$='-page']").length;
return JSON.stringify(out);
