/*global google */

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

// Create the script tag, set the appropriate attributes
var script = document.createElement( "script" );
script.src = "https://maps.googleapis.com/maps/api/js?key=GOOGLEMAPSAPIKEY&libraries=places,marker&callback=initMap&loading=async";
script.async = true;

// Attach your callback function to the `window` object
window.initMap = function() {
    var markers = { pws: [], origin: [] },
        stations = [],
        priorIdle, map, infoWindow, droppedPin, start, current;

    // Handle select button for weather station selection
    document.addEventListener( "click", function( e ) {
        if ( e.target.tagName !== "BUTTON" ) {
            return;
        }
        var classes = e.target.className.split( " " );
        if ( classes.indexOf( "submitPWS" ) > -1 ) {
            window.top.postMessage( { WS: e.target.dataset.loc, station: e.target.dataset.id }, "*" );
        } else if ( classes.indexOf( "submit" ) > -1 ) {
            window.top.postMessage( { WS: e.target.dataset.loc }, "*" );
        }
    }, false );

    // Load the map using the controller's current location
    function initialize() {
        if ( typeof start === "object" ) {
            var myOptions = {
                zoom: 14,
                maxZoom: 17,
                center: start,
                streetViewControl: false,
                mapTypeControl: false,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                mapId: "DEMO_MAP_ID",
                zoomControl: true,
                zoomControlOptions: {
                    position: google.maps.ControlPosition.LEFT_BOTTOM
                },
                styles: [
                    { featureType: "poi", elementType: "labels", stylers: [ { visibility: "off" } ] },
                    { featureType: "transit", elementType: "labels", stylers: [ { visibility: "off" } ] }
                ]
            };

            map = new google.maps.Map( document.getElementById( "map_canvas" ), myOptions );
            infoWindow = new google.maps.InfoWindow();

            // Setup Autocomplete for auto completion
            var controlBox = document.getElementById( "customControls" ),
                searchField = document.getElementById( "pac-input" ),
                autocomplete = new google.maps.places.Autocomplete( searchField );

            controlBox.style.display = "block";

            map.controls[ google.maps.ControlPosition.TOP_LEFT ].push( controlBox );

            // Bias the Autocomplete results towards current map's viewport.
            autocomplete.bindTo( "bounds", map );

            autocomplete.addListener( "place_changed", function() {
                var place = autocomplete.getPlace();
                if ( !place.geometry || !place.geometry.location ) {
                    return;
                }

                if ( droppedPin ) {
                    droppedPin.setMap( null );
                    droppedPin = null;
                }
                droppedPin = plotMarker( "origin", { message: "Selected Location" }, place.geometry.location.lat(), place.geometry.location.lng() );
                map.setCenter( droppedPin.position );
            } );

            var jumpToCurrent = document.getElementById( "jumpCurrent" );

            // Bind the current location button
            jumpToCurrent.addEventListener( "click", function() {
                window.top.postMessage( { getLocation: true }, "*" );
            } );

            // If a start location is specified, display and center it now
            if ( start.lat() !== 0 && start.lng() !== 0 ) {
                droppedPin = plotMarker( "origin", { message: "Selected Location" }, start.lat(), start.lng() );
            }

            // Once the UI/tiles are loaded, let the parent script know
            google.maps.event.addListenerOnce( map, "tilesloaded", function() {
                window.top.postMessage( { loaded: true }, "*" );

                // Fix autocomplete field for iOS (blur event never fires and therefore redirection does not occur)
                if ( /iP(ad|hone|od)/.test( navigator.userAgent ) ) {
                    var predictionContainer = document.querySelectorAll( ".pac-container" )[ 0 ];

                    predictionContainer.addEventListener( "mousedown", function() {
                        window.top.postMessage( { dismissKeyboard: true }, "*" );
                    } );

                }
            } );

            // When the map is clicked, close any open info windows
            google.maps.event.addListener( map, "click", function() {
                infoWindow.close();
            } );

            // Handle dropping of a new pin / location
            google.maps.event.addListener( map, "click", function( event ) {
                if ( droppedPin ) {
                    droppedPin.setMap( null );
                    droppedPin = null;
                }
                droppedPin = plotMarker( "origin", { message: "Selected Location" }, event.latLng.lat(), event.latLng.lng() );
            } );

            // When the map center changes, update the weather stations shown
            map.addListener( "idle", function() {
                if ( getDistance( map.getCenter(), priorIdle ) < 15000 || map.getZoom() < 9 ) {
                    return;
                }

                priorIdle = map.getCenter();
                removeAllMarkers();
                window.top.postMessage( {
                    location: [ map.getCenter().lat(), map.getCenter().lng() ]
                }, "*" );
            } );

            // If any stations are saved already, draw them on the map
            if ( stations.length > 0 ) {
                plotAllMarkers( stations );
            }
        } else {
            setTimeout( initialize, 1 );
        }
    }

    // Handle communication from parent window
    window.onmessage = function( e ) {
        var data = e.data;

        // Handle start point data
        if ( data.type === "startLocation" ) {
            start = new google.maps.LatLng( data.payload.start.lat, data.payload.start.lon );
            priorIdle = start;
            initialize();

            // Handle stations data
        } else if ( data.type === "pwsData" ) {
            stations = JSON.parse( decodeURIComponent( data.payload ) );
            removeAllMarkers();
            plotAllMarkers( stations );
        } else if ( data.type === "currentLocation" ) {
            if ( current ) {
                current.setMap( null );
            }
            current = new google.maps.LatLng( data.payload.lat, data.payload.lon );
            showCurrentLocation();
        }
    };

    // Plot all stations on the map
    function plotAllMarkers( markers ) {
        for ( var i = 0; i < markers.length; i++ ) {
            plotMarker( "pws", markers[ i ], markers[ i ].lat, markers[ i ].lon );
        }
    }

    // Plot an individual station on the map
    function plotMarker( type, data, lat, lon ) {
        // Create custom pin element for AdvancedMarkerElement
        var pinElement = new google.maps.marker.PinElement( {
            background: type === "origin" ? "#EA4335" : "#4285F4",
            borderColor: "#FFFFFF",
            glyphColor: "#FFFFFF"
        } );

        var marker = new google.maps.marker.AdvancedMarkerElement( {
            position: { lat: lat, lng: lon },
            map: map,
            content: pinElement.element,
            title: data.message || ""
        } );

        marker.addListener( "click", function() {
            infoWindow.close();
            var html = createInfoWindow( type, data, lat + "," + lon );
            infoWindow = new google.maps.InfoWindow( {
                content: html
            } );
            infoWindow.open( map, marker );
        } );

        markers[ type ].push( marker );

        if ( data.message === "Selected Location" ) {
            marker.addListener( "click", function() {
                infoWindow.close();
                var html = createInfoWindow( type, data, lat + "," + lon );
                infoWindow = new google.maps.InfoWindow( {
                    content: html
                } );
                infoWindow.open( map, marker );
            } );
            // Trigger click event
            var clickEvent = new Event( "click" );
            marker.content.dispatchEvent( clickEvent );
        }

        return marker;
    }

    // Removes markers of specified type
    function removeAllMarkers() {
        for ( var i = 0; i < markers.pws.length; i++ ) {
            markers.pws[ i ].setMap( null );
        }
        markers.pws = [];
    }

    // Create text for popup info window
    function createInfoWindow( type, data, latLon ) {
        return "<div style='min-height:40px;text-align:center'>" + data.message + "<br><br><button class='submit" + ( type === "pws" ? "PWS' data-id='" + data.id : "" ) + "' data-loc='" + latLon + "'>Submit</button></div>";
    }

    function showCurrentLocation() {

        // The app uses -999, -999 when geolocation is not possible which is resolved to -90, 81
        if ( current.lat() !== -90 && current.lng() !== 81 ) {
            current = plotMarker( "origin", { message: "Current Location" }, current.lat(), current.lng() );

            map.setCenter( { lat: current.position.lat, lng: current.position.lng } );
            infoWindow.close();
            var clickEvent = new Event( "click" );
            current.content.dispatchEvent( clickEvent );
        }
    }

    function rad( x ) {
        return x * Math.PI / 180;
    }

    function getDistance( p1, p2 ) {
        var R = 6378137,
            dLat = rad( p2.lat() - p1.lat() ),
            dLong = rad( p2.lng() - p1.lng() ),
            a = Math.sin( dLat / 2 ) * Math.sin( dLat / 2 ) +
                Math.cos( rad( p1.lat() ) ) * Math.cos( rad( p2.lat() ) ) *
                Math.sin( dLong / 2 ) * Math.sin( dLong / 2 ),
            c = 2 * Math.atan2( Math.sqrt( a ), Math.sqrt( 1 - a ) );

        return R * c;
    }
};

// Append the 'script' element to 'head'
document.head.appendChild( script );
