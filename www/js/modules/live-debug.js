/* global $ */

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

// Configure module
var OSApp = OSApp || {};
OSApp.LiveDebug = OSApp.LiveDebug || {};

OSApp.LiveDebug.displayPage = function() {
	var refreshTimer = null;
	var isPolling = true;

	var page = $(`
		<div data-role="page" id="liveDebug">
			<style>
				#debugConsole {
					background-color: #1a1a1a;
					color: #33ff33;
					font-family: Consolas, Monaco, "Lucida Console", "Liberation Mono", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace;
					font-size: 13px;
					line-height: 1.42;
					padding: 12px;
					border: 1px solid #444;
					border-radius: 6px;
					overflow-y: scroll;
					height: calc(100vh - 180px);
					min-height: 300px;
					box-sizing: border-box;
					white-space: pre-wrap;
					word-wrap: break-word;
					box-shadow: inset 0 0 10px #000;
				}
				.debug-controls {
					margin-top: 12px;
					display: flex;
					flex-flow: row wrap;
					gap: 10px;
					align-items: center;
				}
				.debug-controls button {
					flex: 1 1 auto;
					margin: 0 !important;
				}
			</style>
			<div class="ui-content" role="main">
				<div id="debugConsole">Loading logs...</div>
				<div class="debug-controls">
					<button id="togglePollingBtn" class="ui-btn ui-btn-inline ui-mini ui-corner-all ui-btn-b">Pause Auto-Refresh</button>
					<button id="clearLogsBtn" class="ui-btn ui-btn-inline ui-mini ui-corner-all">Clear Screen</button>
					<button id="refreshLogsBtn" class="ui-btn ui-btn-inline ui-mini ui-corner-all">Refresh Now</button>
				</div>
			</div>
		</div>
	`);

	function fetchLogs() {
		OSApp.Firmware.sendToOS("/dg?pw=", "text")
			.done(function(data) {
				var consoleEl = page.find("#debugConsole");
				if (consoleEl.length) {
					consoleEl.text(data);
					// Scroll to bottom
					consoleEl.scrollTop(consoleEl[0].scrollHeight);
				}
			})
			.fail(function() {
				var consoleEl = page.find("#debugConsole");
				if (consoleEl.length) {
					consoleEl.text("Failed to fetch debug logs from controller.");
				}
			});
	}

	function startPolling() {
		if (refreshTimer) {
			clearInterval(refreshTimer);
		}
		if (isPolling) {
			refreshTimer = setInterval(fetchLogs, 2000);
		}
	}

	function stopPolling() {
		if (refreshTimer) {
			clearInterval(refreshTimer);
			refreshTimer = null;
		}
	}

	function begin() {
		page.one("pagebeforeshow", function() {
			fetchLogs();
			startPolling();
		});

		page.one("pagehide", function() {
			stopPolling();
			page.detach();
		});

		OSApp.UIDom.changeHeader({
			title: OSApp.Language._("Live Developer Log"),
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._("Back"),
				class: "ui-toolbar-back-btn",
				on: OSApp.UIDom.goBack
			}
		});

		page.find("#togglePollingBtn").on("click", function() {
			isPolling = !isPolling;
			if (isPolling) {
				$(this).text("Pause Auto-Refresh");
				fetchLogs();
				startPolling();
			} else {
				$(this).text("Resume Auto-Refresh");
				stopPolling();
			}
		});

		page.find("#clearLogsBtn").on("click", function() {
			page.find("#debugConsole").empty();
		});

		page.find("#refreshLogsBtn").on("click", function() {
			fetchLogs();
		});

		$("#liveDebug").remove();
		$.mobile.pageContainer.append(page);
	}

	return begin();
};
