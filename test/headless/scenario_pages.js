
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = {};
const go = async (hash, waitMs) => { OSApp.UIDom.changePage(hash); await sleep(waitMs || 4000); return $(".ui-page-active").attr("id"); };
out.sensorsPage = await go("#sensors", 5000);
out.sensorsCount = $("#sensors_list fieldset, #sensors_list .ui-collapsible").length;
out.sensorsText = $(".ui-page-active").text().replace(/\s+/g," ").slice(0,160);
// expand first sensor editor
$("#sensors_list .ui-collapsible").first().collapsible("expand"); await sleep(2500);
out.firstEditorInputs = $("#sensors_list .ui-collapsible").first().find("input,select").length;
out.logsPage = await go("#sensor-logs", 9000);
out.logsCanvas = $("#sensor-logs canvas").length;
out.logsText = $(".ui-page-active").text().replace(/\s+/g," ").slice(0,160);
out.programsPage = await go("#programs", 4000);
$("#programs .ui-collapsible").first().collapsible("expand"); await sleep(3500);
out.programSnadj = $("#programs [id^='sensor-options-']").length;
out.programSnadjCanvas = $("#programs canvas[id^='sensor-chart-']").length;
out.programUseSensorCheckbox = $("#programs input[id^='sen-adj-en-'], #programs input[data-sensor-adjustment-flag]").length;
out.addProgramPage = await go("#addprogram", 4000);
out.addProgramSnadj = $("#addprogram [id^='sensor-options-']").length;
out.homePage = await go("#sprinklers", 3000);
return JSON.stringify(out);
