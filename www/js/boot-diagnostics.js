/* OpenSprinkler App — Boot Diagnostics & Watchdog
 *
 * Copyright (C) 2015 - present, Samer Albahra. All rights reserved.
 *
 * This file is part of the OpenSprinkler project <https://opensprinkler.com>.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * ---------------------------------------------------------------------------
 * This script is loaded very early (before the vendor and module scripts) so
 * that it keeps working even when the rest of the app fails to initialise.
 * It provides two things:
 *
 *   1. A global JavaScript error recorder (window/promise/console errors) so
 *      startup failures that cause a black screen can be inspected later.
 *   2. A startup watchdog that returns the user to the main menu when the UI
 *      appears frozen (blank/black screen with nothing selectable).
 *
 * It intentionally avoids any dependency on jQuery / OSApp.
 */
(function () {
	"use strict";

	if (window.OSBoot) {
		return;
	}

	var MAX_ERRORS = 200;
	var errors = [];
	var seriousCount = 0;

	function isSerious(kind) {
		return kind === "error" || kind === "promise" || kind === "watchdog";
	}

	function pushError(kind, message, detail) {
		try {
			errors.push({
				time: new Date(),
				kind: kind,
				message: (message === undefined || message === null) ? "(no message)" : String(message),
				detail: detail ? String(detail) : ""
			});
			if (errors.length > MAX_ERRORS) {
				errors.shift();
			}
			if (isSerious(kind)) {
				seriousCount++;
			}
		} catch (e) {
			void e;
			// Never throw from the error handler itself
		}
	}

	// ---- Global error capture ----------------------------------------------

	window.addEventListener("error", function (event) {
		// Resource load failures (script/css/img) surface as error events on the element
		if (event && event.target && event.target !== window && (event.target.src || event.target.href)) {
			pushError("resource", "Failed to load " + (event.target.src || event.target.href), event.target.tagName);
			return;
		}

		var message = event && event.message ? event.message : "Unknown error";

		// Known-benign Cordova plugin probing noise: keep it in the log but do
		// not treat it as a serious error (the host page suppresses it on purpose).
		var kind = (message.indexOf("does not exist") !== -1) ? "warn" : "error";

		var detail = "";
		if (event) {
			if (event.filename) {
				detail += event.filename + ":" + event.lineno + ":" + event.colno;
			}
			if (event.error && event.error.stack) {
				detail += (detail ? "\n" : "") + event.error.stack;
			}
		}
		pushError(kind, message, detail);
	}, true);

	window.addEventListener("unhandledrejection", function (event) {
		var reason = event ? event.reason : null;
		var message = (reason && reason.message) ? reason.message : reason;
		pushError("promise", message, (reason && reason.stack) ? reason.stack : "");
	});

	// Mirror console.error into the buffer (console.warn is intentionally left
	// alone to avoid recording routine plugin/availability warnings).
	var originalConsoleError = console.error;
	console.error = function () {
		try {
			var parts = Array.prototype.map.call(arguments, function (a) {
				if (a && a.stack) {
					return a.stack;
				}
				if (typeof a === "object") {
					try {
						return JSON.stringify(a);
					} catch (e) {
						void e;
						return String(a);
					}
				}
				return String(a);
			});
			pushError("console", parts.join(" "), "");
		} catch (e) {
			void e;
			// ignore
		}
		if (typeof originalConsoleError === "function") {
			return originalConsoleError.apply(console, arguments);
		}
	};

	// ---- Watchdog ----------------------------------------------------------

	var lastInteractiveTime = Date.now();
	var recovered = false;
	var timer = null;

	var CHECK_INTERVAL = 2500;
	var FROZEN_THRESHOLD = 20000;   // in-app blank screen (e.g. stuck #loadingPage)
	var FASTPATH_THRESHOLD = 9000;  // root fast-path blank screen (body hidden)

	function markActivity() {
		lastInteractiveTime = Date.now();
	}

	["pointerdown", "touchstart", "keydown", "mousedown"].forEach(function (ev) {
		window.addEventListener(ev, markActivity, true);
	});

	function isFastPathHidden() {
		if (document.getElementById("fast-path-hide")) {
			return true;
		}
		if (document.body) {
			var cs = window.getComputedStyle(document.body);
			if (cs && cs.display === "none") {
				return true;
			}
		}
		return false;
	}

	function isOwnElement(el) {
		if (!el) {
			return false;
		}
		if (el.id === "osBugButton") {
			return true;
		}
		if (el.closest && el.closest("#osWatchdogOverlay")) {
			return true;
		}
		return false;
	}

	function hasSelectableUI() {
		if (isFastPathHidden()) {
			return false;
		}
		if (!document.body) {
			return false;
		}

		var nodes = document.querySelectorAll(
			"a[href], button, input:not([type=hidden]), select, textarea, [role=\"button\"], [data-role=\"button\"], .ui-btn"
		);

		for (var i = 0; i < nodes.length; i++) {
			var el = nodes[i];

			if (isOwnElement(el)) {
				continue;
			}
			if (el.disabled) {
				continue;
			}
			if (typeof el.className === "string" &&
				(el.className.indexOf("ui-disabled") !== -1 || el.className.indexOf("ui-screen-hidden") !== -1)) {
				continue;
			}

			var rect = el.getBoundingClientRect();
			if (rect.width <= 1 || rect.height <= 1) {
				continue;
			}

			var style = window.getComputedStyle(el);
			if (!style || style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) {
				continue;
			}

			return true;
		}

		return false;
	}

	function rootIndexUrl() {
		var origin = window.location.origin;
		var path = window.location.pathname;

		if (path.indexOf("/index.html") === path.length - 11) {
			path = path.substring(0, path.length - 11);
		}
		if (path.length > 1 && path.charAt(path.length - 1) === "/") {
			path = path.slice(0, -1);
		}
		path = path.replace(/\/([0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?|dev)$/, "");

		var baseHref = origin + (path.charAt(path.length - 1) === "/" ? path : path + "/");
		return baseHref + "index.html";
	}

	function revealUI() {
		var hide = document.getElementById("fast-path-hide");
		if (hide && hide.parentNode) {
			hide.parentNode.removeChild(hide);
		}
		var loader = document.getElementById("fast-path-loader");
		if (loader && loader.parentNode) {
			loader.parentNode.removeChild(loader);
		}
		if (document.body) {
			document.body.style.display = "";
		}
	}

	function recover(reason) {
		if (recovered) {
			return;
		}
		recovered = true;
		pushError("watchdog", "UI appeared frozen — recovery triggered", reason || "");

		// Always reveal the UI first so the user never stares at a black screen.
		revealUI();

		// Abort any in-flight requests / loaders
		try {
			if (window.jQuery && window.jQuery.ajaxq) {
				window.jQuery.ajaxq.abort("default");
			}
		} catch (e) { void e; /* ignore */ }
		try {
			if (window.jQuery && window.jQuery.mobile) {
				window.jQuery.mobile.loading("hide");
			}
		} catch (e) { void e; /* ignore */ }

		// If the app is alive AND we are on the root (site-management) page, we
		// can switch to the site list with a plain jQuery Mobile page transition
		// (no full reload). We deliberately avoid window.location changes here:
		// in the Cordova file:// environment a reload can navigate to an invalid
		// URL and hard-freeze the app, which is exactly what we must not do.
		var canSafeNavigate = window.OSApp && window.OSApp.UIDom &&
			typeof window.OSApp.UIDom.changePage === "function" &&
			window.jQuery && window.jQuery.mobile &&
			document.querySelectorAll(".ui-page").length > 0 &&
			window.OSApp.Sites && typeof window.OSApp.Sites.isRootPath === "function" &&
			window.OSApp.Sites.isRootPath();

		if (canSafeNavigate) {
			try {
				sessionStorage.setItem("osWatchdogNotice", "1");
			} catch (e) { void e; /* ignore */ }
			try {
				window.OSApp.UIDom.changePage("#site-control");
				return;
			} catch (e) { void e; /* fall through to overlay */ }
		}

		// Otherwise show a non-destructive recovery overlay: it reveals the
		// screen, displays the captured error log and offers manual actions.
		showOverlay();
	}

	function tick() {
		if (seriousCount > 0) {
			ensureBugButton();
		}

		if (recovered) {
			return;
		}

		if (hasSelectableUI()) {
			lastInteractiveTime = Date.now();
			return;
		}

		var threshold = isFastPathHidden() ? FASTPATH_THRESHOLD : FROZEN_THRESHOLD;
		if (Date.now() - lastInteractiveTime > threshold) {
			recover(isFastPathHidden() ? "fast-path blank screen" : "no selectable UI");
		}
	}

	timer = window.setInterval(tick, CHECK_INTERVAL);

	// ---- Inline log viewer -------------------------------------------------

	function formatErrors() {
		if (!errors.length) {
			return "No JavaScript errors recorded.";
		}
		return errors.map(function (e) {
			var t = (e.time && e.time.toISOString) ? e.time.toISOString() : String(e.time);
			return "[" + t + "] (" + e.kind + ") " + e.message +
				(e.detail ? "\n    " + e.detail.replace(/\n/g, "\n    ") : "");
		}).join("\n\n");
	}

	function openConsole() {
		if (window.OSApp && window.OSApp.ErrorConsole && typeof window.OSApp.ErrorConsole.displayPage === "function" &&
			window.jQuery && window.jQuery.mobile && document.querySelectorAll(".ui-page-active").length > 0) {
			try {
				window.OSApp.UIDom.changePage("#jsConsole");
				return;
			} catch (e) { void e; /* fall through to overlay */ }
		}
		showOverlay();
	}

	function showOverlay() {
		if (document.getElementById("osWatchdogOverlay") || !document.body) {
			var existing = document.getElementById("osWatchdogOverlay");
			if (existing) {
				existing.querySelector("#osWdLog").textContent = formatErrors();
			}
			return;
		}

		var box = document.createElement("div");
		box.id = "osWatchdogOverlay";
		box.setAttribute("style", "position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483000;" +
			"background:#1a1a1a;color:#eee;font-family:sans-serif;padding:16px;box-sizing:border-box;overflow:auto;");
		box.innerHTML =
			"<h2 style='margin-top:0'>OpenSprinkler</h2>" +
			"<p>The app did not respond. Return to the main menu or review the error log below.</p>" +
			"<p>" +
			"<button id='osWdHome' type='button' style='padding:10px 16px;margin:0 8px 8px 0'>Main Menu</button>" +
			"<button id='osWdReload' type='button' style='padding:10px 16px;margin:0 8px 8px 0'>Reload</button>" +
			"<button id='osWdClose' type='button' style='padding:10px 16px;margin:0 0 8px 0'>Close</button>" +
			"</p>" +
			"<pre id='osWdLog' style='white-space:pre-wrap;font-size:12px;color:#33ff33;background:#000;" +
			"padding:10px;border-radius:6px;margin:0'></pre>";
		document.documentElement.appendChild(box);

		box.querySelector("#osWdLog").textContent = formatErrors();
		box.querySelector("#osWdReload").onclick = function () {
			window.location.reload();
		};
		box.querySelector("#osWdClose").onclick = function () {
			if (box.parentNode) {
				box.parentNode.removeChild(box);
			}
		};
		box.querySelector("#osWdHome").onclick = function () {
			try {
				localStorage.setItem("show_sites", "1");
			} catch (e) { void e; /* ignore */ }
			window.location.href = rootIndexUrl();
		};
	}

	// ---- Floating "show errors" button -------------------------------------

	var bugButton = null;
	function ensureBugButton() {
		if (bugButton || !document.body) {
			return;
		}
		bugButton = document.createElement("button");
		bugButton.id = "osBugButton";
		bugButton.type = "button";
		bugButton.title = "Show JavaScript error log";
		bugButton.textContent = "\u26A0";
		bugButton.setAttribute("style", "position:fixed;right:10px;bottom:10px;z-index:2147482000;" +
			"width:42px;height:42px;border-radius:50%;border:none;background:rgba(200,60,60,0.85);" +
			"color:#fff;font-size:20px;line-height:42px;padding:0;text-align:center;" +
			"box-shadow:0 2px 6px rgba(0,0,0,0.4);opacity:0.85;cursor:pointer;");
		bugButton.onclick = function (e) {
			e.preventDefault();
			e.stopPropagation();
			openConsole();
		};
		document.documentElement.appendChild(bugButton);
	}

	// ---- Public API --------------------------------------------------------

	window.OSBoot = {
		getErrors: function () {
			return errors.slice();
		},
		clearErrors: function () {
			errors.length = 0;
			seriousCount = 0;
			if (bugButton && bugButton.parentNode) {
				bugButton.parentNode.removeChild(bugButton);
				bugButton = null;
			}
		},
		recordError: pushError,
		formatErrors: formatErrors,
		openConsole: openConsole,
		showOverlay: showOverlay,
		recover: recover,
		stopWatchdog: function () {
			if (timer) {
				window.clearInterval(timer);
				timer = null;
			}
		}
	};
})();
