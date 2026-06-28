/* global $ */

/* OpenSprinkler App – AI Assistant module
 *
 * Erlaubt die natürlichsprachige Konfiguration des OpenSprinkler über einen
 * Dienst auf opensprinklershop.de (GitHub Models). Die aktuelle Geräte-Config
 * dient als Kontext; vorgeschlagene Änderungen werden als Diff angezeigt und
 * (standardmäßig nach Bestätigung) über OSApp.ImportExport.importConfig()
 * wieder auf das Gerät gespielt.
 *
 * Datenschutz/Sicherheit:
 *  - Geräte-/WLAN-Passwörter werden NICHT an den Dienst gesendet (clientseitig
 *    entfernt; der Dienst entfernt zusätzlich serverseitig alle Secrets).
 *  - Das Gerätepasswort verbleibt lokal und wird nur von der App zum Anwenden
 *    der Änderungen verwendet.
 */

var OSApp = OSApp || {};
OSApp.AIAssistant = OSApp.AIAssistant || {};

// Standard-Service-Endpoint (kann in den Einstellungen überschrieben werden).
OSApp.AIAssistant.DEFAULT_SERVICE = "https://opensprinklershop.de/wp-json/osai/v1";

// Aktuelle App-Sprache (vom Benutzer eingestellt). Wird sowohl an den Dienst
// gesendet (damit die KI in dieser Sprache antwortet) als auch für die
// Dialog-Texte/Spracheingabe genutzt.
OSApp.AIAssistant.currentLang = function() {
	var l = "";
	if ( OSApp.currentSession && OSApp.currentSession.lang ) {
		l = OSApp.currentSession.lang;
	} else if ( OSApp.Storage && OSApp.Storage.getItemSync ) {
		l = OSApp.Storage.getItemSync( "lang" ) || "";
	}
	if ( !l ) {
		l = navigator.language || navigator.userLanguage || "en";
	}
	return String( l );
};

// Eingebaute Übersetzungen für die wenigen Dialog-Texte. Hintergrund: die
// locale/*.js-Dateien werden "immutable" ausgeliefert (kein Cache-Buster im
// Loader), daher erreichen frische Übersetzungen bestehende Clients erst mit
// einem neuen Release. Dieses Modul ist hingegen per ?v= cache-bustbar.
// Vorrang hat trotzdem OSApp.Language._(): existiert dort bereits eine
// Übersetzung, wird sie verwendet (siehe OSApp.AIAssistant.t()).
OSApp.AIAssistant.I18N = {
	de: {
		"AI Assistant": "KI-Assistent",
		"Close": "Schließen",
		"Clear chat": "Chat löschen",
		"Proposed changes": "Vorgeschlagene Änderungen",
		"Send": "Senden",
		"Voice input": "Spracheingabe",
		"Type your message…": "Nachricht eingeben …",
		"Hi! I'm your OpenSprinkler assistant. Tell me what you'd like to change, or ask a question about irrigation.": "Hallo! Ich bin dein OpenSprinkler-Assistent. Sag mir, was du ändern möchtest, oder stelle eine Frage zur Bewässerung.",
		"Done.": "Erledigt.",
		"Applied to device.": "Auf das Gerät übertragen.",
		"Apply to device": "Auf Gerät anwenden",
		"Discard": "Verwerfen",
		"Program": "Programm",
		"Name": "Name",
		"Status": "Status",
		"Type": "Typ",
		"Start": "Start",
		"Duration": "Laufzeit",
		"Days": "Tage",
		"Here are your programs as a table.": "Hier sind Ihre Programme als Tabelle.",
		"Weekly": "Wöchentlich",
		"Interval": "Intervall",
		"Single run": "Einmalig",
		"Monthly": "Monatlich",
		"Every": "Alle",
		"day": "Tag",
		"days": "Tage",
		"The assistant could not process this request.": "Der Assistent konnte diese Anfrage nicht verarbeiten.",
		"This request is outside the allowed topic (OpenSprinkler / irrigation only).": "Diese Anfrage liegt außerhalb des erlaubten Themas (nur OpenSprinkler / Bewässerung).",
		"Could not reach the assistant service.": "Der Assistenten-Dienst ist nicht erreichbar.",
		"Too many requests. Please try again later.": "Zu viele Anfragen. Bitte später erneut versuchen.",
		"The proposed configuration is not API compliant and was not applied.": "Die vorgeschlagene Konfiguration ist nicht API-konform und wurde nicht angewendet.",
		"Could not apply the changes.": "Die Änderungen konnten nicht angewendet werden."
	}
};

// Übersetzt einen englischen Schlüssel: bevorzugt die geladene Sprachdatei
// (OSApp.Language._), dann den eingebauten Fallback, sonst das englische Original.
OSApp.AIAssistant.t = function( en ) {
	var translated = OSApp.Language && OSApp.Language._ ? OSApp.Language._( en ) : en;
	if ( translated && translated !== en ) {
		return translated;
	}
	var lang = OSApp.AIAssistant.currentLang().substr( 0, 2 ).toLowerCase();
	var map = OSApp.AIAssistant.I18N[ lang ];
	if ( map && map[ en ] ) {
		return map[ en ];
	}
	return en;
};

// Schlüssel, die niemals an den Dienst gesendet werden (clientseitige Redaktion).
OSApp.AIAssistant.SECRET_KEY_REGEX = /(^pw$|pass|passwd|password|pwd|psk|secret|token|apikey|api[_-]?key|wtkey|ifkey|^key$|_key$|otctoken)/i;

OSApp.AIAssistant.getServiceUrl = function() {
	var u = localStorage.getItem( "osai_service_url" );
	return ( u && u.length ) ? u : OSApp.AIAssistant.DEFAULT_SERVICE;
};

OSApp.AIAssistant.getAutoApply = function() {
	return localStorage.getItem( "osai_auto_apply" ) === "1";
};

OSApp.AIAssistant.setAutoApply = function( on ) {
	localStorage.setItem( "osai_auto_apply", on ? "1" : "0" );
};

// Rekursive, clientseitige Redaktion von Geheimnissen (Defense in depth).
OSApp.AIAssistant.redact = function( data ) {
	if ( Array.isArray( data ) ) {
		return data.map( function( v ) {
			return ( v && typeof v === "object" ) ? OSApp.AIAssistant.redact( v ) : v;
		} );
	}
	if ( data && typeof data === "object" ) {
		var out = {};
		Object.keys( data ).forEach( function( key ) {
			if ( OSApp.AIAssistant.SECRET_KEY_REGEX.test( key ) ) {
				out[ key ] = ( data[ key ] && typeof data[ key ] === "object" ) ? OSApp.AIAssistant.redact( data[ key ] ) : "***";
			} else {
				out[ key ] = ( data[ key ] && typeof data[ key ] === "object" ) ? OSApp.AIAssistant.redact( data[ key ] ) : data[ key ];
			}
		} );
		return out;
	}
	return data;
};

// Tiefes, positions-bewusstes Merge: Objekte rekursiv, Arrays index-weise
// (vorhandene, nicht erwähnte Elemente bleiben erhalten), Skalare überschreiben.
OSApp.AIAssistant.deepMerge = function( base, patch ) {
	if ( Array.isArray( base ) && Array.isArray( patch ) ) {
		var arr = base.slice();
		for ( var i = 0; i < patch.length; i++ ) {
			arr[ i ] = ( typeof patch[ i ] === "object" && patch[ i ] !== null && typeof arr[ i ] === "object" && arr[ i ] !== null ) ?
				OSApp.AIAssistant.deepMerge( arr[ i ], patch[ i ] ) : patch[ i ];
		}
		return arr;
	}
	if ( base && typeof base === "object" && patch && typeof patch === "object" && !Array.isArray( patch ) ) {
		var out = $.extend( true, {}, base );
		Object.keys( patch ).forEach( function( k ) {
			out[ k ] = ( typeof out[ k ] === "object" && out[ k ] !== null ) ?
				OSApp.AIAssistant.deepMerge( out[ k ], patch[ k ] ) : patch[ k ];
		} );
		return out;
	}
	return patch;
};

OSApp.AIAssistant.displayPage = function() {

	var lastChanges = null;

	var page = $(`
		<div data-role="page" id="ai-assistant">
			<div class="ui-content" role="main">
				<div class="osai-intro" style="margin-bottom:12px">
					<p>${OSApp.Language._( "Describe in your own words what you want to change on your OpenSprinkler. The assistant only handles irrigation and OpenSprinkler settings." )}</p>
					<p class="smaller" style="color:#888">${OSApp.Language._( "Your device and Wi-Fi passwords are never sent. Usage is logged anonymously." )}</p>
				</div>
				<div class="ui-field-contain">
					<textarea id="osai-input" rows="3" placeholder="${OSApp.Language._( "e.g. Increase the run time of the lawn zone to 15 minutes" )}"></textarea>
				</div>
				<a href="#" id="osai-send" class="ui-btn ui-btn-b ui-corner-all ui-icon-forward ui-btn-icon-right">${OSApp.Language._( "Ask the assistant" )}</a>

				<div id="osai-status" class="hidden" style="margin-top:12px"></div>

				<div id="osai-result" class="hidden" style="margin-top:12px">
					<div id="osai-summary" style="font-weight:600"></div>
					<div id="osai-explanation" class="smaller" style="color:#666;margin:6px 0"></div>
					<h3>${OSApp.Language._( "Proposed changes" )}</h3>
					<pre id="osai-diff" style="background:#f6f6f6;border:1px solid #ddd;border-radius:6px;padding:10px;overflow:auto;max-height:240px;font-size:12px"></pre>
					<div id="osai-apply-row" class="hidden">
						<div class="ui-grid-a">
							<div class="ui-block-a"><a href="#" id="osai-apply" class="ui-btn ui-btn-b ui-corner-all ui-icon-check ui-btn-icon-left">${OSApp.Language._( "Apply to device" )}</a></div>
							<div class="ui-block-b"><a href="#" id="osai-discard" class="ui-btn ui-corner-all ui-icon-delete ui-btn-icon-left">${OSApp.Language._( "Discard" )}</a></div>
						</div>
					</div>
				</div>

				<div data-role="collapsible" data-collapsed="true" style="margin-top:18px">
					<h3>${OSApp.Language._( "Settings" )}</h3>
					<label>${OSApp.Language._( "Auto-apply changes without confirmation" )}
						<select id="osai-autoapply" data-role="flipswitch">
							<option value="0">${OSApp.Language._( "Off" )}</option>
							<option value="1">${OSApp.Language._( "On" )}</option>
						</select>
					</label>
					<label for="osai-service">${OSApp.Language._( "Service URL" )}</label>
					<input type="url" id="osai-service" value="${OSApp.AIAssistant.getServiceUrl()}">
				</div>
			</div>
		</div>
	`);

	function setStatus( html, isError ) {
		var s = page.find( "#osai-status" );
		s.removeClass( "hidden" ).html( html ).css( "color", isError ? "#b00" : "#444" );
	}

	function showResult( res ) {
		page.find( "#osai-result" ).removeClass( "hidden" );
		page.find( "#osai-summary" ).text( res.summary || "" );
		page.find( "#osai-explanation" ).text( res.explanation || "" );
		page.find( "#osai-diff" ).text( JSON.stringify( res.changes, null, 2 ) );
		lastChanges = res.changes;

		var hasChanges = res.changes && typeof res.changes === "object" && Object.keys( res.changes ).length > 0;
		page.find( "#osai-apply-row" ).toggleClass( "hidden", !hasChanges );

		if ( hasChanges && OSApp.AIAssistant.getAutoApply() ) {
			OSApp.AIAssistant.applyChanges( lastChanges );
		}
	}

	function send() {
		var message = $.trim( page.find( "#osai-input" ).val() );
		if ( !message ) {
			return;
		}
		page.find( "#osai-result" ).addClass( "hidden" );
		setStatus( OSApp.Language._( "Thinking…" ), false );

		// Kontext: vollständige Controller-Config, clientseitig von Secrets befreit.
		var safeConfig = OSApp.AIAssistant.redact( $.extend( true, {}, OSApp.currentSession.controller ) );

		var fw = "";
		if ( OSApp.Firmware && OSApp.Firmware.getOSVersion ) {
			fw = String( OSApp.Firmware.getOSVersion() ) +
				String( OSApp.Firmware.getOSMinorVersion ? ( OSApp.Firmware.getOSMinorVersion() || "" ) : "" );
		}
		var locale = OSApp.AIAssistant.currentLang().substr( 0, 2 );

		$.ajax( {
			url: OSApp.AIAssistant.getServiceUrl().replace( /\/+$/, "" ) + "/assist",
			method: "POST",
			contentType: "application/json",
			dataType: "json",
			timeout: 35000,
			data: JSON.stringify( {
				message: message,
				firmware: fw,
				locale: locale,
				config: safeConfig
			} )
		} ).done( function( res ) {
			if ( !res || !res.ok ) {
				setStatus( OSApp.Language._( "The assistant could not process this request." ) + ( res && res.message ? " (" + res.message + ")" : "" ), true );
				return;
			}
			if ( res.refused ) {
				setStatus( "⚠️ " + ( res.reason || OSApp.Language._( "This request is outside the allowed topic (OpenSprinkler / irrigation only)." ) ), true );
				return;
			}
			page.find( "#osai-status" ).addClass( "hidden" );
			showResult( res );
		} ).fail( function( xhr ) {
			var msg = OSApp.Language._( "Could not reach the assistant service." );
			if ( xhr && xhr.responseJSON && xhr.responseJSON.message ) {
				msg = xhr.responseJSON.message;
			} else if ( xhr && xhr.status === 429 ) {
				msg = OSApp.Language._( "Too many requests. Please try again later." );
			}
			setStatus( msg, true );
		} );
	}

	function begin() {
		page.find( "#osai-autoapply" ).val( OSApp.AIAssistant.getAutoApply() ? "1" : "0" );

		page.on( "click", "#osai-send", function( e ) { e.preventDefault(); send(); } );
		page.on( "click", "#osai-apply", function( e ) {
			e.preventDefault();
			if ( lastChanges ) { OSApp.AIAssistant.applyChanges( lastChanges ); }
		} );
		page.on( "click", "#osai-discard", function( e ) {
			e.preventDefault();
			lastChanges = null;
			page.find( "#osai-result" ).addClass( "hidden" );
			page.find( "#osai-input" ).val( "" );
		} );
		page.on( "change", "#osai-autoapply", function() {
			OSApp.AIAssistant.setAutoApply( $( this ).val() === "1" );
		} );
		page.on( "change", "#osai-service", function() {
			var v = $.trim( $( this ).val() );
			if ( v ) { localStorage.setItem( "osai_service_url", v ); }
		} );

		page.one( "pagehide", function() {
			page.detach();
		} );

		OSApp.UIDom.changeHeader( {
			title: OSApp.Language._( "AI Assistant" ),
			leftBtn: {
				icon: "carat-l",
				text: OSApp.Language._( "Back" ),
				class: "ui-toolbar-back-btn",
				on: OSApp.UIDom.goBack
			}
		} );

		$( "#ai-assistant" ).remove();
		$.mobile.pageContainer.append( page );
	}

	return begin();
};

// Wendet die KI-Änderungen an: Merge in eine Kopie der aktuellen Config, dann
// über die vorhandene Import-Logik auf das Gerät spielen (nutzt Gerätepasswort).
OSApp.AIAssistant.applyChanges = function( changes ) {
	if ( !changes || typeof changes !== "object" || !Object.keys( changes ).length ) {
		return;
	}

	// Defense in depth: clientseitige Validierung gegen die OpenAPI-Struktur,
	// bevor irgendetwas auf das Gerät gespielt wird (Server validiert ebenfalls).
	var check = OSApp.AIAssistant.validateChanges( changes );
	if ( !check.valid ) {
		if ( OSApp.UIDom && OSApp.UIDom.errorMessage ) {
			OSApp.UIDom.errorMessage(
				OSApp.AIAssistant.t( "The proposed configuration is not API compliant and was not applied." ) +
				( check.errors.length ? " (" + check.errors.slice( 0, 3 ).join( "; " ) + ")" : "" )
			);
		}
		return;
	}

	try {
		var merged = OSApp.AIAssistant.deepMerge( $.extend( true, {}, OSApp.currentSession.controller ), changes );
		OSApp.ImportExport.importConfig( merged );
	} catch ( e ) {
		if ( OSApp.UIDom && OSApp.UIDom.errorMessage ) {
			OSApp.UIDom.errorMessage( OSApp.AIAssistant.t( "Could not apply the changes." ) + ( e && e.message ? " (" + e.message + ")" : "" ) );
		}
	}
};

// Erlaubte OpenSprinkler-Optionsschlüssel (aus der OpenAPI-Definition, components/schemas/Options).
OSApp.AIAssistant.OPTION_KEYS = [
	"tz", "ntp", "dhcp", "ip1", "ip2", "ip3", "ip4", "gw1", "gw2", "gw3", "gw4", "hp0", "hp1", "ar", "ext", "seq", "sdt", "mas", "mton", "mtof", "urs", "rso", "wl", "den", "ipas", "devid", "con", "lit", "dim", "bst", "uwt", "ntp1", "ntp2", "ntp3", "ntp4", "lg", "mas2", "mton2", "mtof2", "fpr0", "fpr1", "re", "dns1", "dns2", "dns3", "dns4", "sar", "ife", "sn1t", "sn1o", "sn2t", "sn2o", "sn1on", "sn1of", "sn2on", "sn2of", "subn1", "subn2", "subn3", "subn4", "fwire", "laton", "latof", "ife2", "imin", "imax", "tpdv", "tmpCo", "comb", "belha", "belw1", "belw2", "ife3", "ife4", "rken", "ginv", "fpd0", "fpd1", "wims"
];

// Leichtgewichtige strukturelle Prüfung (entspricht ConfigChangeSet im OpenAPI-Schema).
OSApp.AIAssistant.validateChanges = function( changes ) {
	var errors = [];
	function isInt( v ) { return typeof v === "number" && isFinite( v ) && Math.floor( v ) === v; }
	function isPlainObj( v ) { return v && typeof v === "object" && !Array.isArray( v ); }

	if ( !isPlainObj( changes ) ) {
		return { valid: false, errors: [ "changes must be an object" ] };
	}

	var allowedTop = [ "options", "programs", "stations", "settings" ];
	Object.keys( changes ).forEach( function( k ) {
		if ( allowedTop.indexOf( k ) === -1 ) {
			errors.push( "unknown top-level key '" + k + "'" );
		}
	} );

	if ( changes.options !== undefined ) {
		if ( !isPlainObj( changes.options ) ) {
			errors.push( "options must be an object" );
		} else {
			Object.keys( changes.options ).forEach( function( key ) {
				if ( OSApp.AIAssistant.OPTION_KEYS.indexOf( key ) === -1 ) {
					errors.push( "unknown option '" + key + "'" );
				} else if ( !isInt( changes.options[ key ] ) ) {
					errors.push( "option '" + key + "' must be an integer" );
				}
			} );
		}
	}

	if ( changes.programs !== undefined ) {
		if ( !isPlainObj( changes.programs ) ) {
			errors.push( "programs must be an object" );
		} else if ( changes.programs.pd !== undefined ) {
			if ( !Array.isArray( changes.programs.pd ) ) {
				errors.push( "programs.pd must be an array" );
			} else {
				changes.programs.pd.forEach( function( p, i ) {
					if ( !Array.isArray( p ) || p.length < 6 ) {
						errors.push( "programs.pd[" + i + "] must be an array of [flag,days0,days1,[starts],[durs],name]" );
						return;
					}
					if ( !isInt( p[ 0 ] ) || !isInt( p[ 1 ] ) || !isInt( p[ 2 ] ) ) {
						errors.push( "programs.pd[" + i + "] flag/days must be integers" );
					}
					if ( !Array.isArray( p[ 3 ] ) || !Array.isArray( p[ 4 ] ) ) {
						errors.push( "programs.pd[" + i + "] start times and durations must be arrays" );
					}
					if ( typeof p[ 5 ] !== "string" ) {
						errors.push( "programs.pd[" + i + "] name must be a string" );
					}
				} );
			}
		}
	}

	if ( changes.stations !== undefined ) {
		if ( !isPlainObj( changes.stations ) ) {
			errors.push( "stations must be an object" );
		} else {
			if ( changes.stations.snames !== undefined && !Array.isArray( changes.stations.snames ) ) {
				errors.push( "stations.snames must be an array" );
			}
		}
	}

	if ( changes.settings !== undefined && !isPlainObj( changes.settings ) ) {
		errors.push( "settings must be an object" );
	}

	return { valid: errors.length === 0, errors: errors };
};

/* ──────────────────────────────────────────────────────────────────────────
 * Aktivierung (komplett abschaltbar, in den App-Einstellungen reaktivierbar)
 * ────────────────────────────────────────────────────────────────────────── */
OSApp.AIAssistant.ENABLED_KEY = "osai_enabled";

// Sicheres Linkify für Bot-Nachrichten: HTML escapen, dann Markdown-Links
// [Text](url) und nackte http(s)-URLs in anklickbare Links umwandeln.
OSApp.AIAssistant.escapeHtml = function( s ) {
	return String( s == null ? "" : s ).replace( /[&<>"']/g, function( c ) {
		return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ c ];
	} );
};

OSApp.AIAssistant.linkify = function( text ) {
	var esc = OSApp.AIAssistant.escapeHtml( text );
	// Markdown-Links [Label](https://…)
	esc = esc.replace( /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function( m, label, url ) {
		return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + "</a>";
	} );
	// Nackte URLs (die nicht bereits Teil eines Links sind)
	esc = esc.replace( /(^|[\s(])(https?:\/\/[^\s<)]+)/g, function( m, pre, url ) {
		return pre + '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + "</a>";
	} );
	return esc;
};

OSApp.AIAssistant.isEnabled = function() {
	// Standard: aktiv. Nur explizit "0" deaktiviert den Assistenten.
	return localStorage.getItem( OSApp.AIAssistant.ENABLED_KEY ) !== "0";
};

OSApp.AIAssistant.setEnabled = function( on ) {
	localStorage.setItem( OSApp.AIAssistant.ENABLED_KEY, on ? "1" : "0" );
	OSApp.AIAssistant.applyFabVisibility();
	if ( !on ) {
		OSApp.AIAssistant.closeDialog();
	}
};

// Zeigt/versteckt den schwebenden Button je nach Aktivierung und aktueller Seite.
OSApp.AIAssistant.applyFabVisibility = function() {
	var fab = $( "#ai-fab" );
	if ( !fab.length ) {
		return;
	}
	var page = ( $.mobile && $.mobile.activePage ) ? $.mobile.activePage.attr( "id" ) : "";
	var hiddenPage = ( !page || page === "start" || page === "loadingPage" );
	// Klassenbasiert (statt .show()/.hide()), damit jQuery/JQM das display:flex nicht überschreibt.
	fab.toggleClass( "ai-visible", OSApp.AIAssistant.isEnabled() && !hiddenPage );
};

// Einmalige Initialisierung des FAB (Klick öffnet den Chat-Dialog).
OSApp.AIAssistant.initFab = function() {
	var fab = $( "#ai-fab" );
	if ( !fab.length || fab.data( "osaiBound" ) ) {
		return;
	}
	fab.data( "osaiBound", true );
	fab.attr( "aria-label", OSApp.Language._( "AI Assistant" ) );
	fab.on( "click", function( e ) {
		e.preventDefault();
		OSApp.AIAssistant.openDialog();
	} );
	OSApp.AIAssistant.applyFabVisibility();
};

/* ──────────────────────────────────────────────────────────────────────────
 * Geteilte Anfrage-Logik (auch vom Vollseiten-Modus nutzbar)
 * ────────────────────────────────────────────────────────────────────────── */

// Kompakte, read-only Liste der Analog-/virtuellen Sensoren als Kontext für den
// Assistenten (Name, Typ, Einheit, aktueller Wert), damit er Sensoren auflisten
// und Fragen dazu beantworten kann.
OSApp.AIAssistant.collectSensors = function() {
	var out = [];
	try {
		var arr = ( OSApp.Analog && Array.isArray( OSApp.Analog.analogSensors ) ) ? OSApp.Analog.analogSensors : [];
		for ( var i = 0; i < arr.length; i++ ) {
			var s = arr[ i ] || {};
			out.push( {
				nr: s.nr,
				name: s.name,
				type: s.type,
				unit: s.unit,
				group: s.group,
				enable: s.enable,
				value: ( typeof s.data !== "undefined" ) ? s.data : s.value,
				data_ok: s.data_ok
			} );
		}
	} catch ( err ) {
		void err;
		return [];
	}
	return out;
};

OSApp.AIAssistant.isSensorListingRequest = function( message ) {
	var msg = String( message || "" ).toLowerCase();
	return /\b(sensor(en)?|sensors)\b/u.test( msg ) &&
		/\b(list|liste|show|zeige|anzeigen|auflisten|my|meine|alle)\b/u.test( msg );
};

OSApp.AIAssistant.formatSensorListing = function() {
	var sensors = OSApp.AIAssistant.collectSensors();
	var lines = [];
	for ( var i = 0; i < sensors.length; i++ ) {
		var s = sensors[ i ] || {};
		var parts = [];
		var nr = ( s.nr !== undefined && s.nr !== null && s.nr !== "" ) ? String( s.nr ) : "?";
		var name = String( s.name || "" ).trim();
		var value = s.value;
		if ( Array.isArray( value ) || ( value && typeof value === "object" ) ) {
			try {
				value = JSON.stringify( value );
			} catch ( e ) {
				value = "";
			}
		}
		value = String( value == null ? "" : value ).trim();
		var unit = String( s.unit || "" ).trim();
		if ( s.type ) { parts.push( s.type ); }
		if ( s.group ) { parts.push( s.group ); }
		if ( s.enable !== undefined ) { parts.push( Number( s.enable ) ? "on" : "off" ); }
		if ( s.data_ok !== undefined ) { parts.push( Number( s.data_ok ) ? "ok" : "not-ok" ); }
		var line = "#" + nr;
		if ( name ) {
			line += " " + name;
		}
		if ( value ) {
			line += ": " + value + ( unit ? " " + unit : "" );
		}
		if ( parts.length ) {
			line += " (" + parts.join( ", " ) + ")";
		}
		lines.push( line );
	}
	if ( !lines.length ) {
		return {
			summary: OSApp.AIAssistant.t( "No sensors found." ),
			explanation: OSApp.AIAssistant.t( "I could not find any sensors in the current context. Please open the sensor view first so the device can load the data." )
		};
	}
	return {
		summary: OSApp.AIAssistant.t( "Here are your sensors." ),
		explanation: lines.join( "\n" )
	};
};

OSApp.AIAssistant.isProgramListingRequest = function( message ) {
	var msg = String( message || "" ).toLowerCase();
	return /\b(programm(e|s)?|schedule(s)?|tim(e|er))\b/u.test( msg ) &&
		/\b(list|liste|show|zeige|anzeigen|auflisten|my|meine|alle|table|tabelle)\b/u.test( msg );
};

OSApp.AIAssistant.escapeHtml = function( s ) {
	return String( s == null ? "" : s ).replace( /[&<>"']/g, function( c ) {
		return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ c ];
	} );
};

OSApp.AIAssistant.formatProgramListingHtml = function() {
	var pd = ( OSApp.currentSession && OSApp.currentSession.controller && OSApp.currentSession.controller.programs &&
		Array.isArray( OSApp.currentSession.controller.programs.pd ) ) ? OSApp.currentSession.controller.programs.pd : [];
	if ( !pd.length || !OSApp.Programs || typeof OSApp.Programs.readProgram !== "function" ) {
		return {
			summary: OSApp.AIAssistant.t( "No programs found." ),
			html: ""
		};
	}
	function programTypeLabel( type ) {
		switch ( Number( type ) ) {
			case 1: return OSApp.AIAssistant.t( "Interval" );
			case 2: return OSApp.AIAssistant.t( "Single run" );
			case 3: return OSApp.AIAssistant.t( "Monthly" );
			default: return OSApp.AIAssistant.t( "Weekly" );
		}
	}
	function dayNamesFromBits( bits ) {
		var week = [ OSApp.AIAssistant.t( "Monday" ), OSApp.AIAssistant.t( "Tuesday" ), OSApp.AIAssistant.t( "Wednesday" ), OSApp.AIAssistant.t( "Thursday" ), OSApp.AIAssistant.t( "Friday" ), OSApp.AIAssistant.t( "Saturday" ), OSApp.AIAssistant.t( "Sunday" ) ];
		var out = [];
		bits = String( bits || "" );
		for ( var i = 0; i < 7; i++ ) {
			if ( bits.charAt( i ) === "1" ) {
				out.push( week[ i ] );
			}
		}
		return out.join( ", " );
	}
	function formatStart( raw, prog ) {
		if ( Array.isArray( raw ) ) {
			var start = raw[ 0 ];
			var repeat = raw[ 1 ];
			var interval = raw[ 2 ];
			var txt = OSApp.Programs.readStartTime ? OSApp.Programs.readStartTime( start ) : String( start );
			if ( Number( repeat ) > 0 ) {
				txt += " · " + OSApp.AIAssistant.t( "Every" ) + " " + repeat + "× ";
				if ( OSApp.Dates && OSApp.Dates.dhms2str && OSApp.Dates.sec2dhms ) {
					txt += OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( Number( interval ) * 60 ) );
				} else {
					txt += String( interval );
				}
			}
			return txt;
		}
		if ( raw !== undefined && raw !== null ) {
			return OSApp.Programs.readStartTime ? OSApp.Programs.readStartTime( raw ) : String( raw );
		}
		return "";
	}
	function formatDuration( raw, prog ) {
		var sec = 0;
		if ( Array.isArray( prog.stations ) ) {
			for ( var i = 0; i < prog.stations.length; i++ ) {
				sec += Number( prog.stations[ i ] ) || 0;
			}
		} else if ( typeof prog.duration === "number" ) {
			sec = Number( prog.duration ) || 0;
		} else if ( typeof raw === "number" ) {
			sec = Number( raw ) || 0;
		}
		if ( !sec ) {
			return "";
		}
		if ( OSApp.Dates && OSApp.Dates.dhms2str && OSApp.Dates.sec2dhms ) {
			return OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( sec ) );
		}
		return String( sec );
	}
	function formatDays( raw, prog ) {
		if ( typeof prog.days === "string" ) {
			return dayNamesFromBits( prog.days ) || prog.days;
		}
		if ( Array.isArray( prog.days ) ) {
			if ( prog.type === 1 ) {
				return OSApp.AIAssistant.t( "Every" ) + " " + prog.days[ 0 ] + " " + OSApp.AIAssistant.t( "days" ) + ( prog.days[ 1 ] ? " · " + prog.days[ 1 ] : "" );
			}
			if ( prog.type === 2 ) {
				return OSApp.AIAssistant.t( "Single run" );
			}
			if ( prog.type === 3 ) {
				return OSApp.AIAssistant.t( "Day" ) + " " + prog.days[ 0 ];
			}
			return prog.days.join( ", " );
		}
		return "";
	}
	var rows = [];
	for ( var i = 0; i < pd.length; i++ ) {
		var raw = pd[ i ];
		var p = OSApp.Programs.readProgram( raw ) || {};
		var name = String( p.name || "" ).trim() || ( OSApp.AIAssistant.t( "Program" ) + " " + ( i + 1 ) );
		var start = formatStart( p.start, p );
		var duration = formatDuration( raw[ 6 ], p );
		var days = formatDays( raw, p );
		rows.push(
			"<tr>" +
				"<td>" + ( i + 1 ) + "</td>" +
				"<td>" + OSApp.AIAssistant.escapeHtml( name ) + "</td>" +
				"<td>" + OSApp.AIAssistant.escapeHtml( p.en ? OSApp.AIAssistant.t( "On" ) : OSApp.AIAssistant.t( "Off" ) ) + "</td>" +
				"<td>" + OSApp.AIAssistant.escapeHtml( programTypeLabel( p.type ) ) + "</td>" +
				"<td>" + OSApp.AIAssistant.escapeHtml( start ) + "</td>" +
				"<td>" + OSApp.AIAssistant.escapeHtml( duration ) + "</td>" +
				"<td>" + OSApp.AIAssistant.escapeHtml( days ) + "</td>" +
			"</tr>"
		);
	}
	return {
		summary: OSApp.AIAssistant.t( "Here are your programs as a table." ),
		html:
			"<table class='ai-table' style='width:100%;border-collapse:collapse;font-size:13px'>" +
				"<thead><tr>" +
					"<th style='text-align:left;border-bottom:1px solid #ddd;padding:6px'>#</th>" +
					"<th style='text-align:left;border-bottom:1px solid #ddd;padding:6px'>" + OSApp.AIAssistant.escapeHtml( OSApp.AIAssistant.t( "Name" ) ) + "</th>" +
					"<th style='text-align:left;border-bottom:1px solid #ddd;padding:6px'>" + OSApp.AIAssistant.escapeHtml( OSApp.AIAssistant.t( "Status" ) ) + "</th>" +
					"<th style='text-align:left;border-bottom:1px solid #ddd;padding:6px'>" + OSApp.AIAssistant.escapeHtml( OSApp.AIAssistant.t( "Type" ) ) + "</th>" +
					"<th style='text-align:left;border-bottom:1px solid #ddd;padding:6px'>" + OSApp.AIAssistant.escapeHtml( OSApp.AIAssistant.t( "Start" ) ) + "</th>" +
					"<th style='text-align:left;border-bottom:1px solid #ddd;padding:6px'>" + OSApp.AIAssistant.escapeHtml( OSApp.AIAssistant.t( "Duration" ) ) + "</th>" +
					"<th style='text-align:left;border-bottom:1px solid #ddd;padding:6px'>" + OSApp.AIAssistant.escapeHtml( OSApp.AIAssistant.t( "Days" ) ) + "</th>" +
				"</tr></thead>" +
				"<tbody>" + rows.join( "" ) + "</tbody>" +
			"</table>"
	};
};

OSApp.AIAssistant.isProgramRuntimeChangeRequest = function( message ) {
	var msg = String( message || "" ).toLowerCase();
	return /\b(programm?|program)\s*\d+\b/u.test( msg ) &&
		/\b(laufzeit|run\s*time|runtime|duration|dauer)\b/u.test( msg ) &&
		/\b(verdoppel\w*|halbier\w*|verdreifach\w*|double|halve|triple)\b/u.test( msg );
};

OSApp.AIAssistant.buildProgramRuntimeChangeResponse = function( message ) {
	var msg = String( message || "" ).toLowerCase();
	var match = msg.match( /\b(programm?|program)\s*(\d+)\b/u );
	if ( !match ) {
		return null;
	}
	var factor = 0;
	if ( /\b(verdoppel\w*|double)\b/u.test( msg ) ) {
		factor = 2;
	} else if ( /\b(halbier\w*|halve)\b/u.test( msg ) ) {
		factor = 0.5;
	} else if ( /\b(verdreifach\w*|triple)\b/u.test( msg ) ) {
		factor = 3;
	}
	if ( !factor ) {
		return null;
	}

	var pd = ( OSApp.currentSession && OSApp.currentSession.controller && OSApp.currentSession.controller.programs &&
		Array.isArray( OSApp.currentSession.controller.programs.pd ) ) ? OSApp.currentSession.controller.programs.pd : [];
	var idx = parseInt( match[ 2 ], 10 ) - 1;
	if ( idx < 0 || idx >= pd.length ) {
		return null;
	}

	var raw = $.extend( true, [], pd[ idx ] );
	if ( !Array.isArray( raw ) ) {
		return null;
	}

	var before = 0;
	var after = 0;
	var changed = false;

	if ( Array.isArray( raw[ 4 ] ) ) {
		var durs = [];
		for ( var i = 0; i < raw[ 4 ].length; i++ ) {
			var cur = Number( raw[ 4 ][ i ] ) || 0;
			before += cur;
			var next = Math.max( 0, Math.round( cur * factor ) );
			after += next;
			durs.push( next );
		}
		raw[ 4 ] = durs;
		changed = true;
	} else if ( typeof raw[ 6 ] === "number" ) {
		before = Number( raw[ 6 ] ) || 0;
		after = Math.max( 0, Math.round( before * factor ) );
		raw[ 6 ] = after;
		changed = true;
	}

	if ( !changed ) {
		return null;
	}

	var updatedPd = pd.slice();
	updatedPd[ idx ] = raw;

	var isDe = OSApp.AIAssistant.currentLang().substr( 0, 2 ).toLowerCase() === "de";
	var fmt = function( sec ) {
		if ( OSApp.Dates && OSApp.Dates.dhms2str && OSApp.Dates.sec2dhms ) {
			return OSApp.Dates.dhms2str( OSApp.Dates.sec2dhms( sec ) );
		}
		return String( sec ) + "s";
	};

	return {
		ok: true,
		refused: false,
		reason: "",
		summary: isDe ? ( "Programm " + ( idx + 1 ) + " Laufzeit angepasst." ) : ( "Program " + ( idx + 1 ) + " runtime adjusted." ),
		explanation: isDe ?
			( "Die Laufzeit von Programm " + ( idx + 1 ) + " wurde von " + fmt( before ) + " auf " + fmt( after ) + " angepasst." ) :
			( "Program " + ( idx + 1 ) + " runtime was adjusted from " + fmt( before ) + " to " + fmt( after ) + "." ),
		changes: {
			programs: {
				pd: updatedPd
			}
		},
		usage: {
			prompt_tokens: 0,
			completion_tokens: 0
		},
		model: "deterministic",
		error_code: ""
	};
};

OSApp.AIAssistant.ask = function( message, callbacks ) {
	callbacks = callbacks || {};
	var safeConfig = {};
	try {
		if ( OSApp.currentSession && OSApp.currentSession.controller ) {
			safeConfig = OSApp.AIAssistant.redact( $.extend( true, {}, OSApp.currentSession.controller ) );
		}
		// Analog-/virtuelle Sensoren und Monitore als (read-only) Kontext mitgeben,
		// damit der Assistent Sensoren auflisten und Fragen dazu beantworten kann.
		var sensors = OSApp.AIAssistant.collectSensors();
		if ( sensors && sensors.length ) {
			safeConfig.sensors = OSApp.AIAssistant.redact( sensors );
		}
		var monitors = ( OSApp.Analog && Array.isArray( OSApp.Analog.monitors ) ) ? OSApp.Analog.monitors : null;
		if ( monitors && monitors.length ) {
			safeConfig.monitors = OSApp.AIAssistant.redact( $.extend( true, [], monitors ) );
		}
		//eslint-disable-next-line
	} catch ( e ) {}

	var fw = "";
	if ( OSApp.Firmware && OSApp.Firmware.getOSVersion ) {
		fw = String( OSApp.Firmware.getOSVersion() ) +
			String( OSApp.Firmware.getOSMinorVersion ? ( OSApp.Firmware.getOSMinorVersion() || "" ) : "" );
	}
	var locale = OSApp.AIAssistant.currentLang().substr( 0, 2 );

	var serviceUrl = OSApp.AIAssistant.getServiceUrl().replace( /\/+$/, "" );
	var defaultUrl = OSApp.AIAssistant.DEFAULT_SERVICE.replace( /\/+$/, "" );
	var triedFallback = false;

	function doRequest( url ) {
		$.ajax( {
			url: url + "/assist",
			method: "POST",
			contentType: "application/json",
			dataType: "json",
			timeout: 35000,
			data: JSON.stringify( {
				message: message,
				firmware: fw,
				locale: locale,
				config: safeConfig
			} )
		} ).done( function( res ) {
			if ( callbacks.done ) {
				callbacks.done( res );
			}
		} ).fail( function( xhr ) {
			if ( !triedFallback && url !== defaultUrl ) {
				triedFallback = true;
				doRequest( defaultUrl );
				return;
			}
			if ( xhr && ( !xhr.status || xhr.status === 0 ) && !xhr.responseJSON ) {
				xhr.responseJSON = {
					message: "Plugin service unreachable; request was forwarded, but no response arrived."
				};
			}
			if ( callbacks.fail ) {
				callbacks.fail( xhr );
			}
		} );
	}

	doRequest( serviceUrl );
};

OSApp.AIAssistant.ensureAnalogContext = function() {
	var tasks = [];
	try {
		if ( OSApp.Analog && typeof OSApp.Analog.updateAnalogSensor === "function" &&
			( !Array.isArray( OSApp.Analog.analogSensors ) || !OSApp.Analog.analogSensors.length ) ) {
			tasks.push( OSApp.Analog.updateAnalogSensor() );
		}
		if ( OSApp.Analog && typeof OSApp.Analog.updateMonitors === "function" &&
			( !Array.isArray( OSApp.Analog.monitors ) || !OSApp.Analog.monitors.length ) ) {
			tasks.push( OSApp.Analog.updateMonitors() );
		}
	} catch ( e ) {
		void e;
	}
	if ( !tasks.length ) {
		return Promise.resolve();
	}
	return Promise.all( tasks.map( function( p ) {
		return Promise.resolve( p );
	} ) );
};

/* ──────────────────────────────────────────────────────────────────────────
 * Spracheingabe (nur wenn verfügbar – Feature-Detection)
 * ────────────────────────────────────────────────────────────────────────── */
OSApp.AIAssistant.getSpeechRecognition = function() {
	return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

OSApp.AIAssistant.voiceSupported = function() {
	return !!OSApp.AIAssistant.getSpeechRecognition();
};

/* ──────────────────────────────────────────────────────────────────────────
 * Chat-Verlauf (dauerhaft, letzte 48 Stunden)
 * ────────────────────────────────────────────────────────────────────────── */
OSApp.AIAssistant.HISTORY_KEY = "osai_chat_history";
OSApp.AIAssistant.HISTORY_TTL_MS = 48 * 60 * 60 * 1000;

OSApp.AIAssistant.loadHistory = function() {
	try {
		var raw = localStorage.getItem( OSApp.AIAssistant.HISTORY_KEY );
		if ( !raw ) {
			return [];
		}
		var arr = JSON.parse( raw );
		if ( !Array.isArray( arr ) ) {
			return [];
		}
		var cutoff = Date.now() - OSApp.AIAssistant.HISTORY_TTL_MS;
		var pruned = arr.filter( function( m ) {
			return m && typeof m.ts === "number" && m.ts >= cutoff && typeof m.text === "string";
		} );
		if ( pruned.length !== arr.length ) {
			OSApp.AIAssistant.saveHistory( pruned );
		}
		return pruned;
	} catch ( err ) {
		void err;
		return [];
	}
};

OSApp.AIAssistant.saveHistory = function( arr ) {
	try {
		localStorage.setItem( OSApp.AIAssistant.HISTORY_KEY, JSON.stringify( arr.slice( -120 ) ) );
		//eslint-disable-next-line
	} catch ( e ) {}
};

OSApp.AIAssistant.pushHistory = function( role, text, cls ) {
	if ( !text ) {
		return;
	}
	var arr = OSApp.AIAssistant.loadHistory();
	arr.push( { role: role, text: String( text ), cls: cls || "", ts: Date.now() } );
	OSApp.AIAssistant.saveHistory( arr );
};

OSApp.AIAssistant.clearHistory = function() {
	try {
		localStorage.removeItem( OSApp.AIAssistant.HISTORY_KEY );
		//eslint-disable-next-line
	} catch ( e ) {}
};

/* ──────────────────────────────────────────────────────────────────────────
 * Minimalistischer, mobil-optimierter Chat-Dialog
 * ────────────────────────────────────────────────────────────────────────── */
OSApp.AIAssistant.closeDialog = function() {
	var overlay = $( "#ai-chat-overlay" );
	if ( !overlay.length ) {
		return;
	}
	overlay.removeClass( "ai-open" );
	setTimeout( function() {
		overlay.remove();
	}, 220 );
};

OSApp.AIAssistant.openDialog = function() {
	if ( !OSApp.AIAssistant.isEnabled() ) {
		return;
	}
	// Bereits offen? Dann nichts tun.
	if ( $( "#ai-chat-overlay" ).length ) {
		return;
	}

	var L = OSApp.AIAssistant.t;
	var recognition = null;

	var overlay = $(
		'<div id="ai-chat-overlay">' +
			'<div class="ai-chat-box" role="dialog" aria-modal="true">' +
				'<div class="ai-chat-header">' +
					'<svg class="ai-chat-avatar" width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
						'<path d="M12 3.2l1.7 4.1 4.1 1.7-4.1 1.7L12 14.8l-1.7-4.1L6.2 9l4.1-1.7L12 3.2z" fill="#ffffff"/>' +
						'<circle cx="18.5" cy="5.5" r="1.3" fill="#fff"/>' +
						'<circle cx="5.5" cy="16.5" r="1.5" fill="#fff"/>' +
					'</svg>' +
					'<span class="ai-chat-title">' + L( "AI Assistant" ) + '</span>' +
					'<button type="button" class="ai-chat-clear" aria-label="' + L( "Clear chat" ) + '" title="' + L( "Clear chat" ) + '">' +
						'<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 7h12l-1 13H7L6 7zm9-3l1 2h4v2H4V6h4l1-2h6z"/></svg>' +
					'</button>' +
					'<button type="button" class="ai-chat-close" aria-label="' + L( "Close" ) + '">&times;</button>' +
				'</div>' +
				'<div class="ai-chat-log" id="ai-chat-log"></div>' +
				'<div class="ai-chat-input">' +
					'<textarea id="ai-chat-text" rows="1" placeholder="' + L( "Type your message…" ) + '"></textarea>' +
					'<button type="button" class="ai-icon-btn ai-mic-btn" id="ai-chat-mic" aria-label="' + L( "Voice input" ) + '">' +
						'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>' +
					'</button>' +
					'<button type="button" class="ai-icon-btn ai-send-btn" id="ai-chat-send" aria-label="' + L( "Send" ) + '">' +
						'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 20.5l18-8.5L3 3.5V10l13 2-13 2z"/></svg>' +
					'</button>' +
				'</div>' +
			'</div>' +
		'</div>'
	);

	var log = overlay.find( "#ai-chat-log" );
	var textarea = overlay.find( "#ai-chat-text" );
	var micBtn = overlay.find( "#ai-chat-mic" );
	var sendBtn = overlay.find( "#ai-chat-send" );

	function scrollDown() {
		if ( !log.length ) {
			return;
		}
		var el = log[ 0 ];
		var doScroll = function() {
			el.scrollTop = el.scrollHeight;
		};
		if ( window.requestAnimationFrame ) {
			window.requestAnimationFrame( function() {
				doScroll();
				window.requestAnimationFrame( doScroll );
			} );
		} else {
			doScroll();
			setTimeout( doScroll, 0 );
		}
	}

	function addMessage( who, text, cssExtra ) {
		var msg = $( '<div class="ai-msg"></div>' )
			.addClass( who === "user" ? "ai-user" : "ai-bot" )
			.addClass( cssExtra || "" );
		if ( who === "user" ) {
			msg.text( text || "" );
		} else {
			// Bot-Nachrichten: Links anklickbar machen (sicher: erst escapen).
			msg.html( OSApp.AIAssistant.linkify( text || "" ) );
		}
		log.append( msg );
		scrollDown();
		return msg;
	}

	function addHtmlMessage( title, html, cssExtra ) {
		var bot = addMessage( "bot", title || "", cssExtra );
		if ( html ) {
			$( html ).appendTo( bot );
			scrollDown();
		}
		return bot;
	}

	function addTyping() {
		var t = $( '<div class="ai-msg ai-bot"><span class="ai-typing"><span></span><span></span><span></span></span></div>' );
		log.append( t );
		scrollDown();
		return t;
	}

	function addResult( res ) {
		var bot = addMessage( "bot", res.summary || L( "Done." ) );
		if ( res.explanation ) {
			$( '<div class="smaller" style="color:#666;margin-top:4px"></div>' ).text( res.explanation ).appendTo( bot );
		}
		var hasChanges = res.changes && typeof res.changes === "object" && Object.keys( res.changes ).length > 0;

		// Persistenter Verlauf (Zusammenfassung + Erklärung; Diff/Buttons sind sitzungsbezogen).
		var histText = ( res.summary || L( "Done." ) ) + ( res.explanation ? "\n" + res.explanation : "" );
		if ( hasChanges ) {
			histText += "\n\n[" + L( "Proposed changes" ) + "]\n" + JSON.stringify( res.changes, null, 2 );
		}
		OSApp.AIAssistant.pushHistory( "bot", histText );

		if ( hasChanges ) {
			$( '<div class="ai-diff"></div>' ).text( JSON.stringify( res.changes, null, 2 ) ).appendTo( bot );

			if ( OSApp.AIAssistant.getAutoApply() ) {
				OSApp.AIAssistant.applyChanges( res.changes );
				$( '<div class="smaller" style="color:#2e7d32;margin-top:6px"></div>' ).text( L( "Applied to device." ) ).appendTo( bot );
			} else {
				var actions = $( '<div class="ai-actions"></div>' );
				var applyBtn = $( '<button type="button" class="ai-btn-apply"></button>' ).text( L( "Apply to device" ) );
				var discardBtn = $( '<button type="button" class="ai-btn-discard"></button>' ).text( L( "Discard" ) );
				applyBtn.on( "click", function() {
					OSApp.AIAssistant.applyChanges( res.changes );
					actions.remove();
					$( '<div class="smaller" style="color:#2e7d32;margin-top:6px"></div>' ).text( L( "Applied to device." ) ).appendTo( bot );
					scrollDown();
				} );
				discardBtn.on( "click", function() {
					actions.remove();
				} );
				actions.append( applyBtn ).append( discardBtn ).appendTo( bot );
			}
			scrollDown();
		}
	}

	function send() {
		var message = $.trim( textarea.val() );
		if ( !message ) {
			return;
		}
		addMessage( "user", message );
		OSApp.AIAssistant.pushHistory( "user", message );
		textarea.val( "" ).css( "height", "auto" );
		sendBtn.prop( "disabled", true );
		if ( OSApp.AIAssistant.isSensorListingRequest( message ) ) {
			var local = OSApp.AIAssistant.formatSensorListing();
			var localText = local.summary + ( local.explanation ? "\n" + local.explanation : "" );
			addMessage( "bot", localText );
			OSApp.AIAssistant.pushHistory( "bot", localText );
			sendBtn.prop( "disabled", false );
			return;
		}
		if ( OSApp.AIAssistant.isProgramListingRequest( message ) ) {
			var programView = OSApp.AIAssistant.formatProgramListingHtml();
			var programText = programView.summary;
			addHtmlMessage( programText, programView.html );
			OSApp.AIAssistant.pushHistory( "bot", programText );
			sendBtn.prop( "disabled", false );
			return;
		}
		var typing = addTyping();
		function sendRequest() {
			OSApp.AIAssistant.ask( message, {
				done: function( res ) {
					typing.remove();
					sendBtn.prop( "disabled", false );
					if ( !res || !res.ok ) {
						var em = L( "The assistant could not process this request." ) + ( res && res.message ? " (" + res.message + ")" : "" );
						addMessage( "bot", em, "ai-error" );
						OSApp.AIAssistant.pushHistory( "bot", em, "ai-error" );
						return;
					}
					if ( res.refused ) {
						var rm = "⚠️ " + ( res.reason || L( "This request is outside the allowed topic (OpenSprinkler / irrigation only)." ) );
						addMessage( "bot", rm, "ai-error" );
						OSApp.AIAssistant.pushHistory( "bot", rm, "ai-error" );
						return;
					}
					addResult( res );
				},
				fail: function( xhr ) {
					typing.remove();
					sendBtn.prop( "disabled", false );
					var msg = L( "Could not reach the assistant service." );
					if ( xhr && xhr.responseJSON && xhr.responseJSON.message ) {
						msg = xhr.responseJSON.message;
					} else if ( xhr && xhr.status === 429 ) {
						msg = L( "Too many requests. Please try again later." );
					}
					addMessage( "bot", msg, "ai-error" );
					OSApp.AIAssistant.pushHistory( "bot", msg, "ai-error" );
				}
			} );
		}

		OSApp.AIAssistant.ensureAnalogContext().then( sendRequest ).catch( sendRequest );
	}

	// Auto-grow des Textfeldes
	textarea.on( "input", function() {
		this.style.height = "auto";
		this.style.height = Math.min( this.scrollHeight, 96 ) + "px";
	} );
	// Enter sendet (Shift+Enter = neue Zeile)
	textarea.on( "keydown", function( e ) {
		if ( e.which === 13 && !e.shiftKey ) {
			e.preventDefault();
			send();
		}
	} );

	sendBtn.on( "click", send );

	// Spracheingabe nur anbieten, wenn vom Gerät unterstützt.
	if ( OSApp.AIAssistant.voiceSupported() ) {
		var SR = OSApp.AIAssistant.getSpeechRecognition();
		var listening = false;
		micBtn.on( "click", function() {
			if ( listening && recognition ) {
				recognition.stop();
				return;
			}
			try {
				recognition = new SR();
				//eslint-disable-next-line
			} catch ( err ) {
				micBtn.hide();
				return;
			}
			var lang = OSApp.AIAssistant.currentLang();
			recognition.lang = lang;
			recognition.interimResults = false;
			recognition.maxAlternatives = 1;
			recognition.onstart = function() {
				listening = true;
				micBtn.addClass( "ai-listening" );
			};
			recognition.onerror = recognition.onend = function() {
				listening = false;
				micBtn.removeClass( "ai-listening" );
			};
			recognition.onresult = function( ev ) {
				var transcript = "";
				for ( var i = 0; i < ev.results.length; i++ ) {
					transcript += ev.results[ i ][ 0 ].transcript;
				}
				transcript = $.trim( transcript );
				if ( transcript ) {
					textarea.val( ( $.trim( textarea.val() ) + " " + transcript ).trim() ).trigger( "input" ).focus();
				}
			};
			try {
				recognition.start();
				//eslint-disable-next-line
			} catch ( err2 ) {
				listening = false;
				micBtn.removeClass( "ai-listening" );
			}
		} );
	} else {
		micBtn.hide();
	}

	// Schließen-Logik
	overlay.find( ".ai-chat-close" ).on( "click", OSApp.AIAssistant.closeDialog );
	overlay.find( ".ai-chat-clear" ).on( "click", function() {
		OSApp.AIAssistant.clearHistory();
		log.empty();
		addMessage( "bot", L( "Hi! I'm your OpenSprinkler assistant. Tell me what you'd like to change, or ask a question about irrigation." ) );
	} );
	overlay.on( "click", function( e ) {
		if ( e.target === overlay[ 0 ] ) {
			OSApp.AIAssistant.closeDialog();
		}
	} );

	$( "body" ).append( overlay );
	// Reflow erzwingen für die Einblend-Animation.
	void overlay[ 0 ].offsetHeight;
	overlay.addClass( "ai-open" );

	// Persistenten Verlauf (letzte 48 h) wiederherstellen, sonst Begrüßung zeigen.
	var history = OSApp.AIAssistant.loadHistory();
	if ( history.length ) {
		history.forEach( function( m ) {
			addMessage( m.role === "user" ? "user" : "bot", m.text, m.cls );
		} );
	} else {
		addMessage( "bot", L( "Hi! I'm your OpenSprinkler assistant. Tell me what you'd like to change, or ask a question about irrigation." ) );
	}
	scrollDown();

	setTimeout( function() {
		textarea.focus();
	}, 250 );
};
