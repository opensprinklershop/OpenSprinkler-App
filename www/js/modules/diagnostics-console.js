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
OSApp.ErrorConsole = OSApp.ErrorConsole || {};

// Return the captured JavaScript error log (provided by boot-diagnostics.js)
OSApp.ErrorConsole.getLog = function() {
	if ( window.OSBoot && typeof window.OSBoot.formatErrors === "function" ) {
		return window.OSBoot.formatErrors();
	}
	return OSApp.Language._( "Error capture is not available." );
};

// Developer mode: the JavaScript Console and the boot diagnostics surfaces are
// only available when the hidden developer mode is active (toggled by tapping
// the screen six times quickly, handled in boot-diagnostics.js).
OSApp.ErrorConsole.isDevMode = function() {
	if ( window.OSBoot && typeof window.OSBoot.isDevMode === "function" ) {
		return window.OSBoot.isDevMode();
	}
	try {
		return localStorage.getItem( "os_dev_mode" ) === "1";
	} catch ( e ) {
		void e;
		return false;
	}
};

// In-app viewer page for JavaScript / web console errors
OSApp.ErrorConsole.displayPage = function() {
	var page = $(`
		<div data-role="page" id="jsConsole">
			<style>
				#jsConsoleOutput {
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
				.jsconsole-controls {
					margin-top: 12px;
					display: flex;
					flex-flow: row wrap;
					gap: 10px;
					align-items: center;
				}
				.jsconsole-controls button {
					flex: 1 1 auto;
					margin: 0 !important;
				}
			</style>
			<div class="ui-content" role="main">
				<div id="jsConsoleOutput"></div>
				<div class="jsconsole-controls">
					<button id="jsConsoleRefresh" class="ui-btn ui-btn-inline ui-mini ui-corner-all ui-btn-b">${ OSApp.Language._( "Refresh Now" ) }</button>
					<button id="jsConsoleCopy" class="ui-btn ui-btn-inline ui-mini ui-corner-all">${ OSApp.Language._( "Copy" ) }</button>
					<button id="jsConsoleClear" class="ui-btn ui-btn-inline ui-mini ui-corner-all">${ OSApp.Language._( "Clear Screen" ) }</button>
				</div>
			</div>
		</div>
	`);

	function refresh() {
		var output = page.find( "#jsConsoleOutput" );
		if ( output.length ) {
			output.text( OSApp.ErrorConsole.getLog() );
			output.scrollTop( output[ 0 ].scrollHeight );
		}
	}

	function begin() {
		page.one( "pagebeforeshow", refresh );

		page.one( "pagehide", function() {
			page.detach();
		} );

		OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "JavaScript Console" ),
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._( "Back" ),
				class: "ui-toolbar-back-btn",
				on: OSApp.UIDom.goBack
			}
		} );

		page.find( "#jsConsoleRefresh" ).on( "click", refresh );

		page.find( "#jsConsoleClear" ).on( "click", function() {
			if ( window.OSBoot && typeof window.OSBoot.clearErrors === "function" ) {
				window.OSBoot.clearErrors();
			}
			refresh();
		} );

		page.find( "#jsConsoleCopy" ).on( "click", function() {
			var text = OSApp.ErrorConsole.getLog();
			try {
				if ( navigator.clipboard && navigator.clipboard.writeText ) {
					navigator.clipboard.writeText( text );
				} else {
					var temp = $( "<textarea>" ).val( text ).appendTo( "body" ).select();
					document.execCommand( "copy" );
					temp.remove();
				}
				OSApp.Errors.showError( OSApp.Language._( "Copied" ) );
			} catch ( e ) {
				void e;
				OSApp.Errors.showError( OSApp.Language._( "Copy failed" ) );
			}
		} );

		$( "#jsConsole" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin();
};

// Show a one-time notice once the menu is back after the watchdog recovered the app
OSApp.ErrorConsole.checkWatchdogNotice = function() {
	try {
		if ( sessionStorage.getItem( "osWatchdogNotice" ) === "1" ) {
			sessionStorage.removeItem( "osWatchdogNotice" );

			// The notice points the user at the JavaScript Console, which only
			// exists in developer mode. Stay silent for regular users.
			if ( !OSApp.ErrorConsole.isDevMode() ) {
				return;
			}

			setTimeout( function() {
				OSApp.Errors.showError(
					OSApp.Language._( "The app stopped responding and was returned to the main menu. Open the JavaScript Console from the menu to view the error log." ),
					5000
				);
			}, 1500 );
		}
	} catch ( e ) {
		void e;
	}
};
