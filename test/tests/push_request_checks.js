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

describe("Push Request Handling", function () {
	it("uses the native HTTP plugin for iOS push subscription requests", function (done) {
		var originalDevice = OSApp.currentDevice;
		var originalCordova = window.cordova;
		var originalAjax = $.ajax;
		var nativeCalls = 0;

		OSApp.currentDevice = { isiOS: true };
		window.cordova = {
			plugin: {
				http: {
					setServerTrustMode: function (mode, success) {
						assert.equal(mode, "nocheck");
						success();
					},
					setRequestTimeout: function () {},
					sendRequest: function (url, options, success) {
						nativeCalls++;
						assert.equal(url, OSApp.Push.getBaseUrl() + "/subscribe");
						assert.equal(options.method, "post");
						assert.deepEqual(options.data, { device_key: "ABC123" });
						assert.equal(options.serializer, "json");
						success({ data: JSON.stringify({ ok: true }) });
					}
				}
			}
		};
		$.ajax = function () {
			throw new Error("AJAX should not be used for this iOS native request path");
		};

		OSApp.Push._request("POST", "/subscribe", { device_key: "ABC123" }).then(function (result) {
			assert.equal(nativeCalls, 1);
			assert.deepEqual(result, { ok: true });
			done();
		}, function (err) {
			done(err || new Error("Expected native HTTP path to resolve"));
		});

		OSApp.currentDevice = originalDevice;
		window.cordova = originalCordova;
		$.ajax = originalAjax;
	});
});
