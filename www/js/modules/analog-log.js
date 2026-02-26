/* global OSApp, $ */

/**
 * Analog Sensor Log Viewer Module (DataTables-based)
 *
 * Columns: Timestamp, Nr, Name, Type, Value, Unit
 * Always loads ALL data. Filter bar: date range, value range, unit.
 * Download buttons: CSV, JSON. Default sort: Timestamp descending.
 */

OSApp.AnalogLog = OSApp.AnalogLog || {};

(function () {
"use strict";

var _allRows        = [];    // All parsed rows
var _dtInstance     = null;  // DataTables API instance
var _currentFilter  = null;  // null = all sensors, number = specific nr

// -------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------

/**
 * Open the sensor log viewer.
 * @param {number|null} sensorNumber  - pre-select a sensor (null = all)
 */
OSApp.AnalogLog.show = function (sensorNumber) {
_currentFilter  = (sensorNumber != null) ? parseInt(sensorNumber, 10) : null;
_allRows        = [];

_destroyTable();
$("#sensorlog_page").remove();
$("body").append(_buildPageHtml());

// Let jQM enhance widgets before we touch selectmenu
$("#sensorlog_page").trigger("create");

_populateCombo();
_attachEvents();
_initTable();
_fetchData();

$.mobile.changePage("#sensorlog_page");
};

// -------------------------------------------------------------------------
// Page HTML
// -------------------------------------------------------------------------

function _buildPageHtml() {
var s = [
// Page scoped styles
"<style>",
"#sensorlog_page .sld-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;}",
"#sensorlog_page .sld-label{font-weight:600;white-space:nowrap;font-size:0.9em;}",
"#sensorlog_page details.sld-filter{border:1px solid rgba(0,0,0,.15);border-radius:6px;padding:8px 10px;margin-bottom:10px;background:rgba(0,0,0,.02);}",
"#sensorlog_page details.sld-filter summary{font-weight:600;cursor:pointer;font-size:0.92em;user-select:none;list-style:none;padding-left:2px;}",
"#sensorlog_page details.sld-filter summary::-webkit-details-marker{display:none;}",
"#sensorlog_page details.sld-filter summary::before{content:'\u25B6';display:inline-block;margin-right:6px;font-size:0.8em;transition:transform .2s;}",
"#sensorlog_page details.sld-filter[open] summary::before{transform:rotate(90deg);}",
"#sensorlog_page .sld-filter-grid{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;align-items:flex-end;}",
"#sensorlog_page .sld-field{display:flex;flex-direction:column;gap:2px;}",
"#sensorlog_page .sld-field label{font-size:0.78em;color:#888;white-space:nowrap;}",
"#sensorlog_page .sld-field input,.sld-field select{font-size:0.85em;border:1px solid #ccc;border-radius:4px;padding:3px 6px;height:30px;}",
"#sensorlog_page .sld-dl-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}",
// DataTable overrides
"#sld_table.dataTable thead th{background:#1565c0;color:#fff;padding:7px 10px;font-size:0.82em;letter-spacing:.04em;border:none;}",
"#sld_table.dataTable thead th.sorting::after,#sld_table.dataTable thead th.sorting_asc::after,#sld_table.dataTable thead th.sorting_desc::after{opacity:.8;}",
"#sld_table.dataTable tbody tr{border-bottom:1px solid rgba(0,0,0,.06);}",
"#sld_table.dataTable tbody tr:nth-child(odd){background:#f8f9fa;}",
"#sld_table.dataTable tbody tr:nth-child(even){background:#fff;}",
"#sld_table.dataTable tbody tr:hover{background:#e3f2fd !important;}",
"#sld_table.dataTable tbody td{padding:5px 10px;font-size:0.83em;vertical-align:middle;}",
"#sld_table.dataTable tbody td:nth-child(1){color:#666;font-size:0.78em;}",
"#sld_table.dataTable tbody td:nth-child(2){color:#999;text-align:center;}",
"#sld_table.dataTable tbody td:nth-child(4){text-align:right;font-weight:600;font-size:0.9em;color:#1565c0;}",
"#sld_table.dataTable tbody td:nth-child(5){color:#888;font-size:0.8em;}",
"#sld_count{margin-top:6px;font-size:0.8em;color:#888;}",
"#sld_count .sld-count-pill{display:inline-block;background:#1565c0;color:#fff;border-radius:10px;padding:1px 8px;font-weight:600;margin-left:4px;}",
"</style>"
].join("");

return s +
"<div data-role='page' id='sensorlog_page'>" +

"<div data-theme='b' data-role='header' data-position='fixed' data-tap-toggle='false'>" +
"<a href='#' data-rel='back' class='ui-btn-left' data-icon='carat-l'>" + OSApp.Language._("Back") + "</a>" +
"<h3>" + OSApp.Language._("View Sensor Data") + "</h3>" +
"</div>" +

"<div class='ui-content' role='main' style='padding:8px;'>" +

// Sensor selector
"<div class='sld-toolbar' style='margin-bottom:10px;'>" +
"<span class='sld-label'>" + OSApp.Language._("Sensor") + ":</span>" +
"<select id='sld_sensor_sel' data-mini='true' data-native-menu='true' style='flex:1;min-width:180px;max-width:360px;'>" +
"<option value=''>" + OSApp.Language._("All sensors") + "</option>" +
"</select>" +
"</div>" +

// Filter panel
"<details class='sld-filter' id='sld_filter_panel'>" +
"<summary>" + OSApp.Language._("Filter") + "</summary>" +
"<div class='sld-filter-grid'>" +

"<div class='sld-field'><label>" + OSApp.Language._("From") + "</label>" +
"<input id='sld_f_from' type='date'></div>" +

"<div class='sld-field'><label>" + OSApp.Language._("To") + "</label>" +
"<input id='sld_f_to' type='date'></div>" +

"<div class='sld-field'><label>" + OSApp.Language._("Min Value") + "</label>" +
"<input id='sld_f_vmin' type='number' step='any' placeholder='\u2013' style='width:80px;'></div>" +

"<div class='sld-field'><label>" + OSApp.Language._("Max Value") + "</label>" +
"<input id='sld_f_vmax' type='number' step='any' placeholder='\u2013' style='width:80px;'></div>" +

"<div class='sld-field'><label>" + OSApp.Language._("Unit") + "</label>" +
"<select id='sld_f_unit' data-mini='true' data-native-menu='true'>" +
"<option value=''>" + OSApp.Language._("All units") + "</option>" +
"</select></div>" +

"<div class='sld-field' style='justify-content:flex-end;flex-direction:row;gap:4px;align-items:flex-end;'>" +
"<button id='sld_f_apply' class='ui-btn ui-btn-b ui-btn-inline ui-mini ui-corner-all' style='margin:0;height:30px;line-height:30px;padding:0 12px;'>" +
OSApp.Language._("Apply") + "</button>" +
"<button id='sld_f_reset' class='ui-btn ui-btn-inline ui-mini ui-corner-all' style='margin:0;height:30px;line-height:30px;padding:0 12px;'>" +
OSApp.Language._("Reset") + "</button>" +
"</div>" +
"</div>" +  // filter-grid
"</details>" +

// Download row
"<div class='sld-dl-row'>" +
"<button id='sld_dl_csv' class='ui-btn ui-btn-inline ui-mini ui-corner-all' disabled>&#8659; " +
OSApp.Language._("Download CSV") + "</button>" +
"<button id='sld_dl_json' class='ui-btn ui-btn-inline ui-mini ui-corner-all' disabled>&#8659; " +
OSApp.Language._("Download JSON") + "</button>" +
"</div>" +

// Table
"<table id='sld_table' style='width:100%;'>" +
"<thead><tr>" +
"<th>" + OSApp.Language._("Timestamp") + "</th>" +
"<th>" + OSApp.Language._("Nr")         + "</th>" +
"<th>" + OSApp.Language._("Name")       + "</th>" +
"<th>" + OSApp.Language._("Value")      + "</th>" +
"<th>" + OSApp.Language._("Unit")       + "</th>" +
"</tr></thead>" +
"<tbody></tbody>" +
"</table>" +

"<div id='sld_count'></div>" +

"</div>" +   // ui-content
"</div>";    // page
}

// -------------------------------------------------------------------------
// Sensor combobox
// -------------------------------------------------------------------------

function _populateCombo() {
var sel     = $("#sld_sensor_sel");
var sensors = _getSensors();

for (var i = 0; i < sensors.length; i++) {
var s = sensors[i];
if (s && s.nr !== undefined) {
var label = s.nr + " \u2013 " + (s.name || ("Sensor " + s.nr));
sel.append("<option value='" + s.nr + "'>" + label + "</option>");
}
}

if (_currentFilter !== null) {
sel.val(_currentFilter);
}

try { sel.selectmenu("refresh", true); } catch { /* not yet enhanced - ok */ }
}

// -------------------------------------------------------------------------
// DataTables
// -------------------------------------------------------------------------

function _initTable() {
_dtInstance = $("#sld_table").DataTable({
paging:      false,
scrollX:     true,
info:        false,
searching:   false,
ordering:    true,
deferRender: true,
data:        [],
order:       [[0, "desc"]],
columns: [
{ title: OSApp.Language._("Timestamp"), type: "string" },
{ title: OSApp.Language._("Nr"),        type: "num",    className: "dt-center" },
{ title: OSApp.Language._("Name"),      type: "string" },
{ title: OSApp.Language._("Value"),     type: "num",    className: "dt-right"  },
{ title: OSApp.Language._("Unit"),      type: "string" }
],
language: {
emptyTable: OSApp.Language._("Loading...")
}
});
}

function _destroyTable() {
if (_dtInstance) {
try { _dtInstance.destroy(); } catch { /* ignore */ }
_dtInstance = null;
}
}

// -------------------------------------------------------------------------
// Events
// -------------------------------------------------------------------------

function _attachEvents() {
var page = $("#sensorlog_page");

page.find("#sld_sensor_sel").on("change", function () {
var v = $(this).val();
_currentFilter  = (v === "" || v === null) ? null : parseInt(v, 10);
_allRows        = [];
if (_dtInstance) { _dtInstance.clear().draw(); }
_updateCount();
_fetchData();
});

page.find("#sld_f_apply").on("click", function () { _applyFilter(); });

page.find("#sld_f_reset").on("click", function () {
page.find("#sld_f_from").val("");
page.find("#sld_f_to").val("");
page.find("#sld_f_vmin").val("");
page.find("#sld_f_vmax").val("");
page.find("#sld_f_unit").val("");
try { page.find("#sld_f_unit").selectmenu("refresh", true); } catch { /* ok */ }
_renderTable(_allRows);
_updateCount();
});

page.find("#sld_dl_csv").on("click", function () { _downloadCsv(); });
page.find("#sld_dl_json").on("click", function () { _downloadJson(); });

page.one("pagehide", function () {
_destroyTable();
page.detach();
});
}

// -------------------------------------------------------------------------
// Data loading  (/so?pw=&csv=2  -> "nr;timestamp;value" lines)
// -------------------------------------------------------------------------

function _fetchData() {
$.mobile.loading("show");

var url = "/so?pw=&csv=2";
if (_currentFilter !== null) {
url += "&nr=" + _currentFilter;
}

OSApp.Firmware.sendToOS(url, "text", 120000).then(
function (csv) {
$.mobile.loading("hide");
_parseCsv(csv);
if (_dtInstance) { _dtInstance.settings()[0].oLanguage.sEmptyTable = OSApp.Language._("No data available"); }
_renderTable(_allRows);
_updateCount();
_updateDownloadButtons();
_populateUnitFilter();
},
function () {
$.mobile.loading("hide");
if (_dtInstance) { _dtInstance.settings()[0].oLanguage.sEmptyTable = OSApp.Language._("No data available"); }
OSApp.Errors.showError(OSApp.Language._("Failed to load sensor log data"));
}
);
}

function _parseCsv(csv) {
_allRows  = [];
var sensors = _getSensors();
var lines   = csv.split(/[\r\n]+/);

for (var i = 0; i < lines.length; i++) {
var parts = lines[i].split(";");
if (parts.length < 3) { continue; }

var nr = parseInt(parts[0], 10);
if (isNaN(nr)) { continue; }         // skip header / empty lines

var ts  = parseInt(parts[1], 10);
if (isNaN(ts)) { continue; }

var val = parseFloat(parts[2]);

if (_currentFilter !== null && nr !== _currentFilter) { continue; }

var d = new Date(ts * 1000);
var timeStr =
_pad(d.getUTCDate())      + "." +
_pad(d.getUTCMonth() + 1) + "." +
d.getUTCFullYear()        + " " +
_pad(d.getUTCHours())     + ":" +
_pad(d.getUTCMinutes())   + ":" +
_pad(d.getUTCSeconds());

_allRows.push({
ts:      ts,
timeStr: timeStr,
nr:      nr,
name:    _sensorName(nr, sensors),
type:    _sensorTypeName(nr, sensors),
valStr:  isNaN(val) ? "-" : val.toFixed(2),
val:     isNaN(val) ? null : val,
unit:    _sensorUnit(nr, sensors)
});
}

// Sort newest first
_allRows.sort(function (a, b) { return b.ts - a.ts; });
}

// -------------------------------------------------------------------------
// Render, filter, download
// -------------------------------------------------------------------------

function _renderTable(rows) {
if (!_dtInstance) { return; }
var arrays = [];
for (var i = 0; i < rows.length; i++) {
var r = rows[i];
arrays.push([r.timeStr, r.nr, r.name, r.valStr, r.unit]);
}
_dtInstance.clear().rows.add(arrays).draw();
}

function _updateCount() {
var shown = _dtInstance ? _dtInstance.rows().count() : 0;
var total = _allRows.length;
var shownPill = "<span class='sld-count-pill'>" + shown + "</span>";
var txt = OSApp.Language._("Rows") + ": " + shownPill;
if (shown < total) {
txt += " / " + total + " " + OSApp.Language._("total");
}
$("#sld_count").html(txt);
}

function _updateDownloadButtons() {
var has = _allRows.length > 0;
$("#sld_dl_csv").prop("disabled",  !has);
$("#sld_dl_json").prop("disabled", !has);
}

function _populateUnitFilter() {
var sel   = $("#sld_f_unit");
var seen  = {};
var units = [];
for (var i = 0; i < _allRows.length; i++) {
var u = _allRows[i].unit;
if (u && !seen[u]) { seen[u] = true; units.push(u); }
}
units.sort();
sel.find("option:not(:first)").remove();
for (var j = 0; j < units.length; j++) {
sel.append("<option value='" + units[j] + "'>" + units[j] + "</option>");
}
try { sel.selectmenu("refresh", true); } catch { /* ok */ }
}

function _applyFilter() {
var page    = $("#sensorlog_page");
var fromStr = page.find("#sld_f_from").val();
var toStr   = page.find("#sld_f_to").val();
var vminStr = page.find("#sld_f_vmin").val();
var vmaxStr = page.find("#sld_f_vmax").val();
var unitStr = page.find("#sld_f_unit").val();
var fromTs = fromStr ? (new Date(fromStr + "T00:00:00Z").getTime() / 1000) : null;
var toTs   = toStr   ? (new Date(toStr   + "T23:59:59Z").getTime() / 1000) : null;
var vmin   = (vminStr !== "") ? parseFloat(vminStr) : null;
var vmax   = (vmaxStr !== "") ? parseFloat(vmaxStr) : null;
var filtered = [];
for (var i = 0; i < _allRows.length; i++) {
var r = _allRows[i];
if (fromTs !== null && r.ts < fromTs) { continue; }
if (toTs   !== null && r.ts > toTs)   { continue; }
if (vmin   !== null && (r.val === null || r.val < vmin)) { continue; }
if (vmax   !== null && (r.val === null || r.val > vmax)) { continue; }
if (unitStr && r.unit !== unitStr) { continue; }
filtered.push(r);
}
_renderTable(filtered);
_updateCount();
}

function _triggerDownload(filename, content, mime) {
var blob = new Blob([content], { type: mime });
var url  = URL.createObjectURL(blob);
var a    = document.createElement("a");
a.href     = url;
a.download = filename;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
}

function _downloadCsv() {
var headers = [
OSApp.Language._("Timestamp"),
OSApp.Language._("Nr"),
OSApp.Language._("Name"),
OSApp.Language._("Type"),
OSApp.Language._("Value"),
OSApp.Language._("Unit")
];
var lines = [headers.join(";")];
if (_dtInstance) {
_dtInstance.rows().every(function () {
var r = this.data();
lines.push(r.map(function (v) {
var s = String(v == null ? "" : v);
if (s.indexOf(";") !== -1 || s.indexOf('"') !== -1 || s.indexOf("\n") !== -1) {
s = '"' + s.replace(/"/g, '""') + '"';
}
return s;
}).join(";"));
});
}
_triggerDownload("sensor_log.csv", lines.join("\r\n"), "text/csv;charset=utf-8;");
}

function _downloadJson() {
var keys    = ["timestamp", "nr", "name", "type", "value", "unit"];
var objects = [];
if (_dtInstance) {
_dtInstance.rows().every(function () {
var r   = this.data();
var obj = {};
for (var j = 0; j < keys.length; j++) { obj[keys[j]] = r[j]; }
objects.push(obj);
});
}
_triggerDownload("sensor_log.json", JSON.stringify(objects, null, 2), "application/json");
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function _getSensors() {
return (OSApp.Analog && OSApp.Analog.analogSensors) ? OSApp.Analog.analogSensors : [];
}

function _pad(n) {
return n < 10 ? "0" + n : String(n);
}

function _sensorName(nr, sensors) {
for (var i = 0; i < sensors.length; i++) {
if (sensors[i] && sensors[i].nr === nr) {
return sensors[i].name || ("Sensor " + nr);
}
}
return "#" + nr;
}

function _sensorUnit(nr, sensors) {
for (var i = 0; i < sensors.length; i++) {
if (sensors[i] && sensors[i].nr === nr) {
if (typeof OSApp.Analog.getUnit === "function") {
return OSApp.Analog.getUnit(sensors[i]);
}
return sensors[i].unit || "";
}
}
return "";
}

function _sensorTypeName(nr, sensors) {
var sensorObj = null;
for (var i = 0; i < sensors.length; i++) {
if (sensors[i] && sensors[i].nr === nr) { sensorObj = sensors[i]; break; }
}
if (!sensorObj) { return ""; }
var types = OSApp.Analog && OSApp.Analog.cachedSensorTypes;
if (types) {
for (var j = 0; j < types.length; j++) {
if (types[j].type === sensorObj.type) { return OSApp.Language._(types[j].name); }
}
}
return (sensorObj.type !== undefined) ? String(sensorObj.type) : "";
}

})();
