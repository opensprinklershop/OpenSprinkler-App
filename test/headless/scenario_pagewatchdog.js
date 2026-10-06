const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = {};
const state = function(tag) {
	var p = document.getElementById("programs");
	return { tag: tag, cls: p ? p.className : null, active: $(".ui-page-active").attr("id") || null,
		apId: $.mobile.activePage && $.mobile.activePage.length ? $.mobile.activePage.attr("id") : null,
		visible: p ? p.offsetHeight > 0 : null, hash: location.hash };
};
const go = async (h, o, ms) => { OSApp.UIDom.changePage(h, o); await sleep(ms || 3500); };
await go("#sprinklers", {}, 3000);

// throw from a handler the page module cannot guard (document level, inside the transition)
const boom = function(e) { if (e.target.id === "programs") { throw new Error("boom-doc"); } };
$(document).on("pagebeforeshow", boom);

OSApp.UIDom.changePage("#programs");
await sleep(1500); out.t1500 = state("1.5s: wedged");
await sleep(2500); out.t4000 = state("4.0s: after watchdog retry");
await sleep(3500); out.t7500 = state("7.5s: after forced show");
$(document).off("pagebeforeshow", boom);

await go("#sprinklers", {}, 3500);
out.navAfter1 = state("nav to sprinklers");
await go("#programs", {}, 5000);
out.navAfter2 = state("nav back to programs");
out.visibleText = $(".ui-page-active").text().replace(/\s+/g, " ").slice(0, 60);
return JSON.stringify(out, null, 1);
