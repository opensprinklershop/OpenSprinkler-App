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

// Lazy on-demand loader for the heavy charting vendor libraries.
//
// ApexCharts (~800 KB) and vis-timeline (~300 KB) together dominate the
// initial parse cost of the app, yet they are only needed on the statistics,
// analog-sensor-chart, program-preview and logs pages. Keeping them out of the
// eager <script> list in index.html removes ~1.1 MB from the critical render
// path. This module loads them on demand (and caches the load promise) the
// first time a page that needs them is opened.

var OSApp = OSApp || {};

OSApp.Lazy = OSApp.Lazy || {};

// Cache of in-flight / resolved load promises keyed by script URL so a library
// is never requested more than once.
OSApp.Lazy._scriptPromises = {};

// Resolve the base URL the app was loaded from (e.g. "/2.4.0.216/"). Mirrors
// OSApp.UIDom.getAppURLPath() but is dependency-free so it can run before that
// module has initialised.
OSApp.Lazy.getBasePath = function() {
	if ( OSApp.UIDom && typeof OSApp.UIDom.getAppURLPath === "function" ) {
		var p = OSApp.UIDom.getAppURLPath();
		if ( p ) {
			return p;
		}
	}

	var scripts = document.getElementsByTagName( "script" );
	for ( var i = 0; i < scripts.length; i++ ) {
		var src = scripts[ i ].src || "";
		var qIdx = src.indexOf( "?" );
		if ( qIdx !== -1 ) {
			src = src.substring( 0, qIdx );
		}
		if ( src.indexOf( "js/modules/lazy.js" ) !== -1 ) {
			return src.slice( 0, -( "js/modules/lazy.js".length ) );
		}
		if ( src.indexOf( "js/main.js" ) !== -1 ) {
			return src.slice( 0, -( "js/main.js".length ) );
		}
	}
	return "";
};

// Inject a script once and return a promise that resolves when it has loaded.
OSApp.Lazy.loadScript = function( relativeSrc ) {
	if ( OSApp.Lazy._scriptPromises[ relativeSrc ] ) {
		return OSApp.Lazy._scriptPromises[ relativeSrc ];
	}

	var promise = new Promise( function( resolve, reject ) {
		var el = document.createElement( "script" );
		el.src = OSApp.Lazy.getBasePath() + relativeSrc;
		el.async = true;
		el.addEventListener( "load", function() {
			resolve();
		} );
		el.addEventListener( "error", function() {
			// Allow a later attempt to retry the download.
			delete OSApp.Lazy._scriptPromises[ relativeSrc ];
			reject( new Error( "Failed to load " + relativeSrc ) );
		} );
		( document.head || document.getElementsByTagName( "head" )[ 0 ] ).appendChild( el );
	} );

	OSApp.Lazy._scriptPromises[ relativeSrc ] = promise;
	return promise;
};

// True once the ApexCharts global is available.
OSApp.Lazy.hasApexCharts = function() {
	return typeof window.ApexCharts !== "undefined";
};

// True once the vis-timeline global is available.
OSApp.Lazy.hasTimeline = function() {
	return typeof window.vis !== "undefined" && !!window.vis.Timeline;
};

// Ensure ApexCharts is loaded, then run the optional callback. Returns a promise.
OSApp.Lazy.ensureApexCharts = function( callback ) {
	callback = callback || function() {};
	var promise = OSApp.Lazy.hasApexCharts() ?
		Promise.resolve() :
		OSApp.Lazy.loadScript( "vendor-js/apexcharts.min.js" );
	return promise.then( function() {
		callback();
	} );
};

// Ensure vis-timeline is loaded, then run the optional callback. Returns a promise.
OSApp.Lazy.ensureTimeline = function( callback ) {
	callback = callback || function() {};
	var promise = OSApp.Lazy.hasTimeline() ?
		Promise.resolve() :
		OSApp.Lazy.loadScript( "vendor-js/vis-timeline-graph2d.min.js" );
	return promise.then( function() {
		callback();
	} );
};

// Warm both libraries in the background shortly after boot so they are ready by
// the time the user navigates to a page that needs them, without blocking the
// initial render. Failures are ignored here; the per-page guards re-attempt the
// load on demand.
OSApp.Lazy.prefetchCharts = function() {
	if ( OSApp.Lazy._prefetched ) {
		return;
	}
	OSApp.Lazy._prefetched = true;

	var start = function() {
		OSApp.Lazy.ensureApexCharts().catch( function() {} );
		OSApp.Lazy.ensureTimeline().catch( function() {} );
	};

	if ( typeof window.requestIdleCallback === "function" ) {
		window.requestIdleCallback( start, { timeout: 4000 } );
	} else {
		window.setTimeout( start, 1200 );
	}
};
