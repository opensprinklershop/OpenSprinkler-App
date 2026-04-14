/* eslint-disable */

/* OpenSprinkler App
 * Copyright (C) 2015 - present, Samer Albahra. All rights reserved.
 *
 * This file is part of the OpenSprinkler project <http://opensprinkler.com>.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

describe("Popup Checks", function () {
	it("Show first-run setup wizard on a clean start", function (done) {
		OSApp.Storage.remove(["sites", "current_site", "cloudToken", "setupWizardSeen"], function () {
			assert.equal(OSApp.Welcome.shouldShowSetupWizard(), true);

			$.mobile.document.one("popupafteropen", "#setupWizard", function () {
				assert.equal($("#setupWizard .setup-wifi").length, 1);
				assert.equal($("#setupWizard .setup-ethernet").length, 1);
				$("#setupWizard .setup-skip").trigger("click");
			});

			$.mobile.document.one("popupafterclose", "#setupWizard", function () {
				OSApp.Storage.get("setupWizardSeen", function (data) {
					assert.equal(data.setupWizardSeen, "true");
					done();
				});
			});

			OSApp.Welcome.showSetupWizard();
		});
	});

	it( "Show main menu popup", function( done ) {
		$.mobile.document.one( "popupafteropen", "#mainMenu", function() {
			done();
		} );
		assert.doesNotThrow( function() {
			OSApp.UIDom.showHomeMenu();
		} );
	} );

	it( "Show change rain delay popup", function( done ) {
		$.mobile.document.one( "popupafteropen", "#durationBox", function() {
			$.mobile.document.one( "popupafterclose", "#durationBox", function() {
				done();
			} );
			$( "#durationBox" ).popup( "close" ).remove();
		} );
		assert.doesNotThrow( function() {
			$( "#mainMenu" ).find( "a[href='#raindelay']" ).trigger( "click" );
		} );
	} );

	it("Show add new site popup", function (done) {
		$.mobile.document.one("popupafteropen", "#addnew", function () {
			assert.equal($("#os_pw").val(), "");
			$.mobile.document.one("popupafterclose", "#addnew", function () {
				done();
			});
			$("#addnew").popup("close").remove();
		});
		assert.doesNotThrow(function () {
			OSApp.Sites.showAddNew();
		});
	});

	it("Show add new site popup with setup defaults", function (done) {
		$.mobile.document.one("popupafteropen", "#addnew", function () {
			assert.equal($("#os_pw").val(), "opendoor");
			assert.equal($("#os_url").attr("placeholder"), "192.168.1.50");
			assert.include($("#addnew-content").text(), "Press B1 on the controller");
			$.mobile.document.one("popupafterclose", "#addnew", function () {
				done();
			});
			$("#addnew").popup("close").remove();
		});
		assert.doesNotThrow(function () {
			OSApp.Sites.showAddNew(false, false, {
				password: "opendoor",
				passwordHelp: "The factory default password is opendoor. Please change it when convenient.",
				helperText: "Press B1 on the controller to display its IP address, then enter that address here.",
				addressPlaceholder: "192.168.1.50"
			});
		});
	});

	it("Show setup assistant entry in site add menu", function () {
		$("#site-control, #addsite").remove();
		OSApp.Sites.displayPage();
		assert.equal($("#site-add-setup").text().trim(), "Setup Assistant");
		$("#addsite").popup("destroy").remove();
		$("#site-control").remove();
	});

	it("Show site select popup", function (done) {
		$.mobile.document.one("popupafteropen", "#site-select", function () {
			$.mobile.document.one("popupafterclose", "#site-select", function () {
				done();
			});
			$("#site-select").popup("close").remove();
		});
		assert.doesNotThrow(function () {
			OSApp.Sites.showSiteSelect();
		});
	});

	it("Show are you sure popup", function (done) {
		$.mobile.document.one("popupafteropen", "#sure", function () {
			$("#sure .sure-do").trigger("click");
		});
		assert.doesNotThrow(function () {
			OSApp.UIDom.areYouSure(null, null, done);
		});
	});

	it("Show IP Address input popup", function (done) {
		$.mobile.document.one("popupafteropen", "#ipInput", function () {
			$.mobile.document.one("popupafterclose", "#ipInput", function () {
				done();
			});
			$("#ipInput").popup("close").remove();
		});
		assert.doesNotThrow(function () {
			OSApp.UIDom.showIPRequest();
		});
	});

	it("Show single duration input popup", function (done) {
		$.mobile.document.one("popupafteropen", "#singleDuration", function () {
			$.mobile.document.one("popupafterclose", "#singleDuration", function () {
				done();
			});
			$("#singleDuration").popup("close").remove();
		});
		assert.doesNotThrow(function () {
			OSApp.UIDom.showSingleDurationInput();
		});
	});

	it("Show language selection popup", function (done) {
		$.mobile.document.one("popupafteropen", "#localization", function () {
			$.mobile.document.one("popupafterclose", "#localization", function () {
				done();
			});
			$("#localization").popup("close").remove();
		});
		assert.doesNotThrow(function () {
			OSApp.Language.languageSelect();
		});
	});
});
