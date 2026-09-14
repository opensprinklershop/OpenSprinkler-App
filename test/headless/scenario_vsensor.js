
const sleep = ms => new Promise(r => setTimeout(r, ms));
OSApp.UIDom.changePage("#analogsensorconfig"); await sleep(6000);
$(".edit-sensor").first().trigger("click"); await sleep(3500);
const c = $(".analog-editor-container").first(); const cs = c.length ? getComputedStyle(c[0]) : null;
const btns = $("#sensorEditor .ui-btn:visible").map(function(){ return { t: $(this).text().trim().slice(0,22), h: this.offsetHeight, ws: getComputedStyle(this).whiteSpace }; }).get();
return JSON.stringify({ page: $(".ui-page-active").attr("id"), border: cs && cs.borderTopWidth + " " + cs.borderTopColor, radius: cs && cs.borderRadius,
  toolbarRight: $("#header .analog-editor-save, .ui-header .analog-editor-save").text().trim(), inlineSubmitVisible: $("#sensorEditor .submit:visible").length, buttons: btns.slice(0,14) });
