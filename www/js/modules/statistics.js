/* global $, ApexCharts */

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

var OSApp = OSApp || {};
OSApp.Statistics = OSApp.Statistics || {};

// --- State ---
OSApp.Statistics._charts = [];
OSApp.Statistics._refreshTimer = null;
OSApp.Statistics._range = 7; // default: 7 days

// --- Theme helper ---
OSApp.Statistics.getTheme = function() {
	var root = document.documentElement;
	var isDark = root.classList.contains( "theme-dark" );
	var isColorful = root.classList.contains( "theme-colorful" );
	var css = getComputedStyle( root );
	var textColor = isDark ? "#e6e6e6" : ( isColorful ? css.getPropertyValue( "--theme-colorful-text" ).trim() || "#333" : "#333" );
	var bgColor = isDark ? "#000000" : ( isColorful ? "#fff" : "#fff" );
	var gridColor = isDark ? "#2b3340" : ( isColorful ? "#e0d8f0" : "#e0e0e0" );
	var cardBg = isDark ? "#1b212b" : ( isColorful ? "#f8f6ff" : "#f9f9f9" );
	return {
		isDark: isDark,
		isColorful: isColorful,
		text: textColor,
		bg: bgColor,
		grid: gridColor,
		cardBg: cardBg,
		palette: isDark
			? [ "#3a8dde", "#18c36e", "#ff9f43", "#ff6b6b", "#a78bfa", "#38bdf8", "#fbbf24", "#f472b6" ]
			: [ "#008FFB", "#00E396", "#FEB019", "#FF4560", "#775DD0", "#00D9E9", "#FF66C3", "#546E7A" ],
		mode: isDark ? "dark" : "light"
	};
};

// --- Base chart options ---
OSApp.Statistics.baseChartOpts = function( theme ) {
	return {
		chart: {
			background: "transparent",
			foreColor: theme.text,
			fontFamily: "Lato, sans-serif",
			toolbar: { show: false },
			zoom: { enabled: false },
			animations: { speed: 400 }
		},
		theme: { mode: theme.mode },
		grid: {
			borderColor: theme.grid,
			strokeDashArray: 3
		},
		tooltip: {
			theme: theme.mode
		},
		colors: theme.palette
	};
};

// --- Helpers ---
OSApp.Statistics.dayKey = function( epochSec ) {
	return Math.floor( epochSec / 86400 );
};

OSApp.Statistics.dayToDate = function( dayKey ) {
	return new Date( dayKey * 86400 * 1000 );
};

OSApp.Statistics.formatDuration = function( seconds ) {
	return OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( seconds ) );
};

OSApp.Statistics.destroyCharts = function() {
	for ( var i = 0; i < OSApp.Statistics._charts.length; i++ ) {
		//eslint-disable-next-line no-unused-vars
		try { OSApp.Statistics._charts[ i ].destroy(); } catch ( e ) { /* ignore */ }
	}
	OSApp.Statistics._charts = [];
};

// --- Data Loading ---
OSApp.Statistics.loadData = function( range ) {
	var now = OSApp.currentSession.controller.settings.devt;
	var end = now;
	var start = now - ( range * 86400 );
	var startParam = Math.floor( start );
	var endParam = Math.floor( end ) + 86340;
	var parms = "start=" + startParam + "&end=" + endParam;

	var logDefer = OSApp.Firmware.sendToOS( "/jl?pw=&" + parms, "json" );
	var wlDefer = OSApp.Firmware.checkOSVersion( 211 )
		? OSApp.Firmware.sendToOS( "/jl?pw=&type=wl&" + parms, "json" )
		: $.Deferred().resolve( [] );
	var flDefer = OSApp.Firmware.checkOSVersion( 216 )
		? OSApp.Firmware.sendToOS( "/jl?pw=&type=fl&" + parms )
		: $.Deferred().resolve( [] );

	return $.when( logDefer, wlDefer, flDefer );
};

// --- Parse log data ---
OSApp.Statistics.parseData = function( logData, wlData, flData, range ) {
	var stations = OSApp.currentSession.controller.stations ? OSApp.currentSession.controller.stations.snames : [];
	var nStations = stations.length;
	var now = OSApp.currentSession.controller.settings.devt;

	var result = {
		dailyRuntime: {},
		dailyEvents: {},
		stationRuntime: {},
		stationEvents: {},
		programRuntime: {},
		programEvents: {},
		dailyWaterLevel: {},
		dailyVolume: {},
		totalRuntime: 0,
		totalEvents: 0,
		totalVolume: 0,
		avgWaterLevel: 0,
		stationNames: stations,
		range: range,
		now: now
	};

	if ( !logData || !logData.length ) {
		return result;
	}

	$.each( logData, function() {
		var pid = this[ 0 ],
			station = this[ 1 ],
			duration = parseInt( this[ 2 ] ),
			endtime = parseInt( this[ 3 ] );

		if ( duration < 0 ) { duration += 65536; }

		// Skip special records and master stations
		if ( typeof station === "string" ) { return; }
		if ( typeof station !== "number" ) { return; }
		if ( station >= nStations || OSApp.Stations.isMaster( station ) ) { return; }

		var day = OSApp.Statistics.dayKey( endtime );

		// Daily runtime
		result.dailyRuntime[ day ] = ( result.dailyRuntime[ day ] || 0 ) + duration;
		result.dailyEvents[ day ] = ( result.dailyEvents[ day ] || 0 ) + 1;

		// Station totals
		var sname = stations[ station ] || ( "S" + ( station + 1 ) );
		result.stationRuntime[ sname ] = ( result.stationRuntime[ sname ] || 0 ) + duration;
		result.stationEvents[ sname ] = ( result.stationEvents[ sname ] || 0 ) + 1;

		// Program totals
		if ( pid > 0 ) {
			var pname = OSApp.Programs.pidToName( pid );
			result.programRuntime[ pname ] = ( result.programRuntime[ pname ] || 0 ) + duration;
			result.programEvents[ pname ] = ( result.programEvents[ pname ] || 0 ) + 1;
		}

		result.totalRuntime += duration;
		result.totalEvents++;
	} );

	// Water level data
	if ( wlData && wlData.length ) {
		var wlSum = 0;
		$.each( wlData, function() {
			var day = OSApp.Statistics.dayKey( this[ 3 ] );
			result.dailyWaterLevel[ day ] = this[ 2 ];
			wlSum += this[ 2 ];
		} );
		result.avgWaterLevel = parseFloat( ( wlSum / wlData.length ).toFixed( 1 ) );
	}

	// Flow data
	var flowlog = flData;
	if ( typeof flData === "string" ) {
		//eslint-disable-next-line no-unused-vars
		try { flowlog = JSON.parse( flData.replace( /,\s*inf/g, "" ) ); } catch ( e ) { flowlog = []; }
	}
	if ( flowlog && flowlog.length ) {
		$.each( flowlog, function() {
			var volume = OSApp.Utils.flowCountToVolume( this[ 0 ] );
			var day = OSApp.Statistics.dayKey( this[ 3 ] );
			result.dailyVolume[ day ] = ( result.dailyVolume[ day ] || 0 ) + volume;
			result.totalVolume += volume;
		} );
	}

	return result;
};

// --- Build KPI Cards ---
OSApp.Statistics.buildKPICards = function( data ) {
	var wlValue = "--";
	var wlClass = "";
	if ( data.avgWaterLevel > 0 ) {
		wlClass = data.avgWaterLevel < 100 ? "green-text" : ( data.avgWaterLevel > 100 ? "red-text" : "" );
		wlValue = "<span class='" + wlClass + "'>" + data.avgWaterLevel + "%</span>";
	}

	return "<table class='stats-kpi-table'>" +
		"<tbody>" +
		"<tr><th>" + OSApp.Language._( "Total Runtime" ) + "</th><td>" +
		OSApp.Statistics.formatDuration( data.totalRuntime ) + "</td></tr>" +
		"<tr><th>" + OSApp.Language._( "Total Station Events" ) + "</th><td>" +
		data.totalEvents + "</td></tr>" +
		"<tr><th>" + OSApp.Language._( "Water Level" ) + "</th><td>" +
		wlValue + "</td></tr>" +
		"</tbody></table>";
};

// --- Build Charts ---
OSApp.Statistics.buildDailyRuntimeChart = function( container, data, theme ) {
	var days = Object.keys( data.dailyRuntime ).sort();
	var categories = [], values = [];
	for ( var i = 0; i < days.length; i++ ) {
		var d = OSApp.Statistics.dayToDate( days[ i ] );
		categories.push( d.getTime() );
		values.push( Math.round( data.dailyRuntime[ days[ i ] ] / 60 ) ); // minutes
	}

	var opts = $.extend( true, {}, OSApp.Statistics.baseChartOpts( theme ), {
		chart: {
			type: "bar",
			height: 260
		},
		series: [ { name: OSApp.Language._( "Runtime" ) + " (min)", data: values } ],
		xaxis: {
			type: "datetime",
			categories: categories,
			labels: {
				datetimeUTC: false,
				format: "dd.MM."
			}
		},
		yaxis: {
			title: { text: OSApp.Language._( "Runtime" ) + " (min)" },
			min: 0
		},
		plotOptions: { bar: { borderRadius: 3, columnWidth: "30%" } },
		dataLabels: { enabled: false },
		title: {
			text: OSApp.Language._( "Daily Runtime" ),
			align: "left"
		}
	} );

	var chart = new ApexCharts( container, opts );
	chart.render();
	OSApp.Statistics._charts.push( chart );
};

OSApp.Statistics.buildDailyVolumeChart = function( container, data, theme ) {
	var days = Object.keys( data.dailyVolume ).sort();
	if ( days.length === 0 ) { return; }

	var categories = [], values = [];
	for ( var i = 0; i < days.length; i++ ) {
		var d = OSApp.Statistics.dayToDate( days[ i ] );
		categories.push( d.getTime() );
		values.push( parseFloat( data.dailyVolume[ days[ i ] ].toFixed( 1 ) ) );
	}

	var opts = $.extend( true, {}, OSApp.Statistics.baseChartOpts( theme ), {
		chart: {
			type: "bar",
			height: 260
		},
		colors: [ "#00E396" ],
		series: [ { name: OSApp.Language._( "Volume" ) + " (L)", data: values } ],
		xaxis: {
			type: "datetime",
			categories: categories,
			labels: {
				datetimeUTC: false,
				format: "dd.MM."
			}
		},
		yaxis: {
			title: { text: OSApp.Language._( "Volume" ) + " (L)" },
			min: 0
		},
		plotOptions: { bar: { borderRadius: 3, columnWidth: "30%" } },
		dataLabels: { enabled: false },
		title: {
			text: OSApp.Language._( "Daily Water Usage" ),
			align: "left"
		}
	} );

	var chart = new ApexCharts( container, opts );
	chart.render();
	OSApp.Statistics._charts.push( chart );
};

OSApp.Statistics.buildStationRuntimeChart = function( container, data, theme ) {
	var names = Object.keys( data.stationRuntime );
	if ( names.length === 0 ) { return; }

	// Sort by runtime descending
	names.sort( function( a, b ) { return data.stationRuntime[ b ] - data.stationRuntime[ a ]; } );
	var topNames = names.slice( 0, 15 );
	var values = [];
	for ( var i = 0; i < topNames.length; i++ ) {
		values.push( Math.round( data.stationRuntime[ topNames[ i ] ] / 60 ) );
	}

	var opts = $.extend( true, {}, OSApp.Statistics.baseChartOpts( theme ), {
		chart: {
			type: "bar",
			height: Math.max( 200, topNames.length * 32 )
		},
		series: [ { name: OSApp.Language._( "Runtime" ) + " (min)", data: values } ],
		plotOptions: {
			bar: {
				horizontal: true,
				borderRadius: 3,
				barHeight: "65%"
			}
		},
		xaxis: {
			title: { text: OSApp.Language._( "Runtime" ) + " (min)" }
		},
		yaxis: {
			labels: {
				maxWidth: 160,
				style: { fontSize: "11px" }
			}
		},
		labels: topNames,
		dataLabels: { enabled: false },
		title: {
			text: OSApp.Language._( "Runtime per Station" ),
			align: "left"
		}
	} );

	var chart = new ApexCharts( container, opts );
	chart.render();
	OSApp.Statistics._charts.push( chart );
};

OSApp.Statistics.buildWaterLevelChart = function( container, data, theme ) {
	var days = Object.keys( data.dailyWaterLevel ).sort();
	if ( days.length === 0 ) { return; }

	var categories = [], values = [];
	for ( var i = 0; i < days.length; i++ ) {
		var d = OSApp.Statistics.dayToDate( days[ i ] );
		categories.push( d.getTime() );
		values.push( data.dailyWaterLevel[ days[ i ] ] );
	}

	var opts = $.extend( true, {}, OSApp.Statistics.baseChartOpts( theme ), {
		chart: {
			type: "area",
			height: 220
		},
		colors: [ "#775DD0" ],
		series: [ { name: OSApp.Language._( "Water Level" ) + " (%)", data: values } ],
		xaxis: {
			type: "datetime",
			categories: categories,
			labels: {
				datetimeUTC: false,
				format: "dd.MM."
			}
		},
		yaxis: {
			title: { text: "%" },
			min: 0
		},
		fill: {
			type: "gradient",
			gradient: { opacityFrom: 0.5, opacityTo: 0.1 }
		},
		stroke: { curve: "smooth", width: 2 },
		dataLabels: { enabled: false },
		annotations: {
			yaxis: [ {
				y: 100,
				borderColor: theme.isDark ? "#555" : "#999",
				strokeDashArray: 4,
				label: {
					text: "100%",
					position: "left",
					style: {
						color: theme.text,
						background: "transparent"
					}
				}
			} ]
		},
		title: {
			text: OSApp.Language._( "Water Level" ),
			align: "left"
		}
	} );

	var chart = new ApexCharts( container, opts );
	chart.render();
	OSApp.Statistics._charts.push( chart );
};

OSApp.Statistics.buildProgramChart = function( container, data, theme ) {
	var names = Object.keys( data.programRuntime );
	if ( names.length === 0 ) { return; }

	names.sort( function( a, b ) { return data.programRuntime[ b ] - data.programRuntime[ a ]; } );
	var values = [], labels = [];
	for ( var i = 0; i < names.length; i++ ) {
		values.push( Math.round( data.programRuntime[ names[ i ] ] / 60 ) );
		labels.push( names[ i ] );
	}

	var opts = $.extend( true, {}, OSApp.Statistics.baseChartOpts( theme ), {
		chart: {
			type: "donut",
			height: 280
		},
		series: values,
		labels: labels,
		legend: {
			position: "bottom",
			fontSize: "11px"
		},
		plotOptions: {
			pie: {
				donut: {
					labels: {
						show: true,
						total: {
							show: true,
							label: OSApp.Language._( "Total" ),
							color: theme.text,
							formatter: function( w ) {
								var total = w.globals.seriesTotals.reduce( function( a, b ) { return a + b; }, 0 );
								return total + " min";
							}
						}
					}
				}
			}
		},
		dataLabels: {
			enabled: true,
			formatter: function( val ) { return val.toFixed( 0 ) + "%"; }
		},
		title: {
			text: OSApp.Language._( "Runtime per Program" ),
			align: "left"
		}
	} );

	var chart = new ApexCharts( container, opts );
	chart.render();
	OSApp.Statistics._charts.push( chart );
};

// --- Main Page ---
OSApp.Statistics.displayPage = function() {
	OSApp.Statistics.destroyCharts();
	if ( OSApp.Statistics._refreshTimer ) {
		clearInterval( OSApp.Statistics._refreshTimer );
		OSApp.Statistics._refreshTimer = null;
	}

	var range = OSApp.Statistics._range;

	var page = $( "<div data-role='page' id='statistics'>" +
		"<div class='ui-content' role='main'>" +
			"<div class='stats-range-bar'>" +
				"<fieldset data-role='controlgroup' data-type='horizontal' data-mini='true'>" +
					"<input type='radio' name='stats-range' id='stats-r7' value='7'" + ( range === 7 ? " checked='checked'" : "" ) + ">" +
					"<label for='stats-r7'>7 " + OSApp.Language._( "Days" ) + "</label>" +
					"<input type='radio' name='stats-range' id='stats-r14' value='14'" + ( range === 14 ? " checked='checked'" : "" ) + ">" +
					"<label for='stats-r14'>14 " + OSApp.Language._( "Days" ) + "</label>" +
					"<input type='radio' name='stats-range' id='stats-r30' value='30'" + ( range === 30 ? " checked='checked'" : "" ) + ">" +
					"<label for='stats-r30'>30 " + OSApp.Language._( "Days" ) + "</label>" +
				"</fieldset>" +
			"</div>" +
			"<div id='stats-kpi'></div>" +
			"<div id='stats-daily-runtime'></div>" +
			"<div id='stats-daily-volume'></div>" +
			"<div id='stats-station-runtime'></div>" +
			"<div id='stats-water-level'></div>" +
			"<div id='stats-program'></div>" +
		"</div>" +
	"</div>" );

	OSApp.UIDom.changeHeader( {
		title: OSApp.Language._( "Statistics" ),
		leftBtn: {
			icon: "carat-l",
			text: OSApp.Language._( "Back" ),
			class: "ui-toolbar-back-btn",
			on: function() {
				OSApp.UIDom.goBack();
			}
		},
		rightBtn: {
			icon: "refresh",
			text: screen.width >= 500 ? OSApp.Language._( "Refresh" ) : "",
			class: "refresh-stats",
			on: function() {
				OSApp.Statistics.refresh( page );
			}
		}
	} );

	page.find( "input[name='stats-range']" ).on( "change", function() {
		OSApp.Statistics._range = parseInt( $( this ).val() );
		OSApp.Statistics.refresh( page );
	} );

	page.one( "pagehide", function() {
		OSApp.Statistics.destroyCharts();
		if ( OSApp.Statistics._refreshTimer ) {
			clearInterval( OSApp.Statistics._refreshTimer );
			OSApp.Statistics._refreshTimer = null;
		}
		page.detach();
	} );

	$( "#statistics" ).remove();
	$.mobile.pageContainer.append( page );
	$.mobile.pageContainer.pagecontainer( "change", page );

	OSApp.Statistics.refresh( page );

	// Auto-refresh every 5 minutes
	OSApp.Statistics._refreshTimer = setInterval( function() {
		if ( page.hasClass( "ui-page-active" ) ) {
			OSApp.Statistics.refresh( page );
		}
	}, 300000 );
};

OSApp.Statistics.refresh = function( page ) {
	var range = OSApp.Statistics._range;

	OSApp.UIDom.showLoading( "#stats-kpi" );

	OSApp.Statistics.loadData( range ).then( function( logData, wlData, flData ) {
		// Handle jQuery.when wrapping: each arg is [data, status, jqXHR]
		var logs = Array.isArray( logData ) ? logData : ( logData && logData[ 0 ] ? logData : [] );
		var wl = Array.isArray( wlData ) ? wlData : ( wlData && wlData[ 0 ] ? wlData : [] );
		var fl = flData || [];
		// If jQuery.when returns array-wrapped results
		if ( logs && logs.length === 3 && typeof logs[ 1 ] === "string" ) { logs = logs[ 0 ]; }
		if ( wl && wl.length === 3 && typeof wl[ 1 ] === "string" ) { wl = wl[ 0 ]; }
		if ( fl && fl.length === 3 && typeof fl[ 1 ] === "string" ) { fl = fl[ 0 ]; }

		var data = OSApp.Statistics.parseData( logs, wl, fl, range );
		var theme = OSApp.Statistics.getTheme();

		OSApp.Statistics.destroyCharts();

		page.find( "#stats-kpi" ).html( OSApp.Statistics.buildKPICards( data, theme ) );

		var runtimeEl = page.find( "#stats-daily-runtime" ).empty().get( 0 );
		if ( runtimeEl && data.totalRuntime > 0 ) {
			OSApp.Statistics.buildDailyRuntimeChart( runtimeEl, data, theme );
		}

		var volumeEl = page.find( "#stats-daily-volume" ).empty().get( 0 );
		if ( volumeEl && data.totalVolume > 0 ) {
			OSApp.Statistics.buildDailyVolumeChart( volumeEl, data, theme );
		}

		var stationEl = page.find( "#stats-station-runtime" ).empty().get( 0 );
		if ( stationEl && Object.keys( data.stationRuntime ).length > 0 ) {
			OSApp.Statistics.buildStationRuntimeChart( stationEl, data, theme );
		}

		var wlEl = page.find( "#stats-water-level" ).empty().get( 0 );
		if ( wlEl && Object.keys( data.dailyWaterLevel ).length > 0 ) {
			OSApp.Statistics.buildWaterLevelChart( wlEl, data, theme );
		}

		var progEl = page.find( "#stats-program" ).empty().get( 0 );
		if ( progEl && Object.keys( data.programRuntime ).length > 0 ) {
			OSApp.Statistics.buildProgramChart( progEl, data, theme );
		}
	}, function() {
		page.find( "#stats-kpi" ).html(
			"<p class='center'>" + OSApp.Language._( "Error retrieving log data. Please refresh to try again." ) + "</p>"
		);
	} );
};
