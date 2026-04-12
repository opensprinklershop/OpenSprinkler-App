/* eslint-disable */

describe("OTC Options Checks", function() {
	before(function(done) {
		OSApp.currentSession.ip = "demo.opensprinkler.com";
		OSApp.currentSession.pass = "opendoor";
		OSApp.currentSession.prefix = "https://";
		OSApp.currentSession.currentSite = "Test";

		OSApp.Sites.updateSiteList([ "Test" ], "Test");
		OSApp.currentSession.controller = {};

		OSApp.Sites.updateController(done);
	});

	afterEach(function() {
		$("#otcSettings").popup("destroy").remove();
		$("#os-options").remove();
	});

	it("marks the options page dirty when OTC connection settings change with an existing long token", function(done) {
		OSApp.currentSession.controller.settings.otc = {
			en: 1,
			token: "123456789012345678901234567890123456",
			server: "ws.cloud.openthings.io",
			port: 80
		};
		OSApp.currentSession.controller.settings.mqtt = {
			en: 1,
			host: "broker.example.com",
			port: 1883,
			user: "",
			pass: "",
			pubt: "opensprinkler",
			subt: ""
		};

		OSApp.Options.showOptions("integrations");

		var page = $("#os-options");

		$.mobile.document.one("popupafteropen", "#otcSettings", function() {
			var popup = $("#otcSettings");

			popup.find("#server").val("cloud.example.test");
			popup.find(".submit").trigger("click");

			setTimeout(function() {
				assert.isTrue(page.find(".submit").hasClass("hasChanges"));
				done();
			}, 0);
		});

		page.find("#otc").trigger("click");
	});
});
