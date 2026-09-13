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
OSApp.Supported = OSApp.Supported || {};

/* Compatibility methods, verify that necessary data is
 * sent from the controller to the UI without explicitly
 * checking for OS version. */

OSApp.Supported.master = function( masid ) {
	switch ( masid ) {
		case OSApp.Constants.options.MASTER_STATION_1:
			return OSApp.currentSession.controller.options.mas ? true : false;
		case OSApp.Constants.options.MASTER_STATION_2:
			return OSApp.currentSession.controller.options.mas2 ? true : false;
		default:
			return false;
	}
};

OSApp.Supported.ignoreRain = function() {
	return ( typeof OSApp.currentSession.controller.stations.ignore_rain === "object" ) ? true : false;
};

OSApp.Supported.ignoreSensor = function( sensorID ) {
	switch ( sensorID ) {
		case OSApp.Constants.options.IGNORE_SENSOR_1:
			return ( typeof OSApp.currentSession.controller.stations.ignore_sn1 === "object" ) ? true : false;
		case OSApp.Constants.options.IGNORE_SENSOR_2:
			return ( typeof OSApp.currentSession.controller.stations.ignore_sn2 === "object" ) ? true : false;
		default:
			return false;
	}
};

OSApp.Supported.actRelay = function() {
	return ( typeof OSApp.currentSession.controller.stations.act_relay === "object" ) ? true : false;
};

OSApp.Supported.disabled = function() {
	return ( typeof OSApp.currentSession.controller.stations.stn_dis === "object" ) ? true : false;
};

OSApp.Supported.sequential = function() {
	return false;
};

OSApp.Supported.special = function() {
	return ( typeof OSApp.currentSession.controller.stations.stn_spe === "object" ) ? true : false;
};

OSApp.Supported.pausing = function() {
	return OSApp.currentSession.controller.settings.pq !== undefined;
};

OSApp.Supported.groups = function() {
	return OSApp.Stations.getNumberProgramStatusOptions() >= 4;
};

OSApp.Supported.dateRange = function() {
	return true;
};

OSApp.Supported.changePause = function() {
	return true;
};

/* Upstream "Expanded Sensor" API (official firmware 2.2.1(5): /jsn, /jsd, /jsl,
 * /csn, /dsn, /dsl, /jpa). The OpenSprinklerShop firmware implements this API
 * as a facade over its own sensor system, so the official sensor pages are
 * available on every controller that answers /jsn. The legacy analog pages
 * (analog.js) stay available for the OpenSprinklerShop-specific sensor types. */
OSApp.Supported.officialSensorAPIAllowed = function( controller ) {
	controller = controller || OSApp.currentSession.controller;
	if ( !controller || !controller.options ) {
		return false;
	}
	if ( OSApp.Analog.checkAnalogSensorAvail( controller ) ) {
		// OpenSprinklerShop firmware: the compatibility API exists from 2.4.0(229).
		// Older firmware simply has no "sensors" in /ja (and answers 404 on /jsn),
		// which keeps the sensor pages hidden via OSApp.Supported.sensors().
		return true;
	}
	return OSApp.Firmware.checkOSVersion( 2215 );
};

OSApp.Supported.legacySensorEndpoints = function( controller ) {
	return OSApp.Supported.officialSensorAPIAllowed( controller );
};

OSApp.Supported.sensors = function() {
	return OSApp.Supported.officialSensorAPIAllowed() && Array.isArray( OSApp.currentSession.controller?.sensors?.sn );
};

OSApp.Supported.verifyWeatherAPIKey = function() {
	return typeof OSApp.currentSession.controller.options.uwt !== "undefined" &&
			typeof OSApp.currentSession.controller.settings.wto === "object";
};

OSApp.Supported.singleRunAndMonthly = function() {
	return true;
};

OSApp.Supported.repeatedRunonce = function() {
	return true;
};

/* Flow Alert supported */
OSApp.Supported.fas = function() {
	return OSApp.currentSession.controller.stations.stn_fas != undefined;
};

OSApp.Supported.restrictions = function() {
	const wto = typeof OSApp.currentSession.controller?.settings?.wto !== "undefined";
	return wto;
};
