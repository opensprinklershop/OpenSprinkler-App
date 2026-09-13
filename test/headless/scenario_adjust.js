const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = {};
// 1) open adjustments editor with piecewise type
OSApp.Analog.showAdjustmentsEditor({nr:0, type:5, sensor:OSApp.Analog.analogSensors[0].nr, prog:1, factor1:1, factor2:0.5, min:0, max:100, name:"cdp"}, -1, function(){}, function(){});
await sleep(1500);
const ed = $("#progAdjustEditor");
out.editorOpen = ed.length && ed.is(":visible");
out.typeOptions = ed.find("#type option").map(function(){ return this.value + ":" + $(this).text(); }).get();
out.typeSelected = ed.find("#type").val();
out.hasFactorInputs = ed.find(".factor1").length + ed.find(".min").length;
out.hasPointsTable = ed.find(".adj-points-table").length;
out.pointRows = ed.find(".adj-points-table tbody tr").length;
// 2) click irrigation db button
ed.find(".link-irrigationdb-adjustment").trigger("click");
await sleep(3000);
out.irrigDialog = $("#irrigationDBDialog").length;
out.irrigZones = $("#irrigdb-zone option").length;
out.irrigVisible = $("#irrigationDBDialogOverlay").is(":visible");
$("#irrigationDBDialogOverlay").remove();
return JSON.stringify(out);
