const sleep = ms => new Promise(r => setTimeout(r, ms));
OSApp.UIDom.changePage("#analogsensorconfig"); await sleep(6000);
$(".edit-sensor").first().trigger("click"); await sleep(3500);
window.scrollTo(0, 260); await sleep(500);
return JSON.stringify({ page: $(".ui-page-active").attr("id"), cbPad: getComputedStyle($("#sensorEditor .ui-checkbox .ui-btn")[0]).paddingLeft });
