/* global $ */

var OSApp = OSApp || {};
OSApp.Analog = OSApp.Analog || {};

/**
 * Irrigation Database Integration for OpenSprinkler Analog.js
 * 
 * This module integrates the Irrigation Database API into the Program Adjustments editor
 * allowing users to automatically set min/max sensor values based on plant type and climate zone.
 */

OSApp.Analog.IrrigationDB = {
    apiUrl: '/irrigationdb/api.php',
    selectedZone: null,
    
    /**
     * Initialize - load saved zone from localStorage
     */
    init: function() {
        this.selectedZone = localStorage.getItem('irrigationdb_zone') || 'D';
    },
    
    /**
     * Save selected zone to localStorage
     */
    saveZone: function(zone) {
        this.selectedZone = zone;
        localStorage.setItem('irrigationdb_zone', zone);
    },
    
    /**
     * Search for plants (autocomplete)
     */
    searchPlants: function(query, callback) {
        if (!query || query.length < 2) {
            callback([]);
            return;
        }
        
        $.ajax({
            url: this.apiUrl,
            data: {
                endpoint: 'search_plants',
                q: query
            },
            dataType: 'json',
            success: function(data) {
                callback(data);
            },
            error: function() {
                callback([]);
            }
        });
    },
    
    /**
     * Get irrigation recommendations for zone and plant
     */
    getRecommendations: function(zone, plant, callback) {
        $.ajax({
            url: this.apiUrl,
            data: {
                endpoint: 'recommendations',
                zone: zone,
                plant: plant
            },
            dataType: 'json',
            success: function(data) {
                callback(data);
            },
            error: function(xhr) {
                alert('Error loading recommendations: ' + (xhr.responseJSON ? xhr.responseJSON.error : 'Unknown error'));
                callback(null);
            }
        });
    },
    
    /**
     * Get settings for UI (optimized endpoint)
     */
    getSettings: function(zone, plant, callback) {
        $.ajax({
            url: this.apiUrl,
            data: {
                endpoint: 'get_settings',
                zone: zone,
                plant: plant
            },
            dataType: 'json',
            success: function(data) {
                callback(data);
            },
            error: function(xhr) {
                alert('Error loading settings: ' + (xhr.responseJSON ? xhr.responseJSON.error : 'Unknown error'));
                callback(null);
            }
        });
    },
    
    /**
     * Get all climate zones
     */
    getZones: function(callback) {
        $.ajax({
            url: this.apiUrl,
            data: {
                endpoint: 'zones'
            },
            dataType: 'json',
            success: function(data) {
                callback(data);
            },
            error: function() {
                callback([]);
            }
        });
    },
    
    /**
     * Show the Irrigation Database dialog
     * This integrates into the Program Adjustments editor
     */
    showDialog: function(onSelect) {
        var self = this;
        
        // Get zones first
        this.getZones(function(zones) {
            var html = 
                "<div data-role='popup' data-theme='a' id='irrigationDBDialog' class='ui-content' style='max-width:600px; width:95%;'>" +
                "<div data-role='header' data-theme='b'>" +
                "<a href='#' data-rel='back' data-role='button' data-theme='a' data-icon='delete' data-iconpos='notext' class='ui-btn-right'>Close</a>" +
                "<h1>Irrigation Database</h1>" +
                "</div>" +
                "<div class='ui-content'>" +
                
                // Climate Zone Selector
                "<label for='irrigdb-zone' class='select'>Climate Zone:</label>" +
                "<select data-mini='true' id='irrigdb-zone'>";
            
            zones.forEach(function(zone) {
                html += "<option value='" + zone.zone_code + "' " + 
                    (zone.zone_code === self.selectedZone ? "selected" : "") + ">" +
                    zone.zone_code + " - " + zone.zone_name + "</option>";
            });
            
            html += "</select>" +
                
                // Plant Search Input
                "<label for='irrigdb-plant'>Plant Name:</label>" +
                "<input type='text' id='irrigdb-plant' placeholder='e.g. Buffalo Grass, Tomato, Rosemary' data-mini='true'>" +
                "<div id='irrigdb-suggestions' style='display:none; background:#fff; border:1px solid #ccc; max-height:150px; overflow-y:auto;'></div>" +
                
                // Search Button
                "<button id='irrigdb-search' data-theme='b' data-mini='true' style='margin-top:10px;'>Search</button>" +
                
                // Results Container
                "<div id='irrigdb-results' style='margin-top:20px; display:none;'></div>" +
                
                "</div>" +
                "</div>";
            
            var popup = $(html);
            
            // Zone change handler
            popup.find("#irrigdb-zone").on("change", function() {
                self.saveZone($(this).val());
            });
            
            // Plant input autocomplete
            var suggestionsTimer = null;
            popup.find("#irrigdb-plant").on("input", function() {
                var query = $(this).val();
                clearTimeout(suggestionsTimer);
                
                if (query.length < 2) {
                    popup.find("#irrigdb-suggestions").hide().empty();
                    return;
                }
                
                suggestionsTimer = setTimeout(function() {
                    self.searchPlants(query, function(plants) {
                        var suggestions = popup.find("#irrigdb-suggestions");
                        suggestions.empty();
                        
                        if (plants.length === 0) {
                            suggestions.hide();
                            return;
                        }
                        
                        plants.forEach(function(plant) {
                            var item = $("<div style='padding:8px; cursor:pointer; border-bottom:1px solid #eee;'>" +
                                "<strong>" + plant.common_name + "</strong><br>" +
                                "<small>" + plant.category_name + 
                                (plant.scientific_name ? " - <em>" + plant.scientific_name + "</em>" : "") + 
                                "</small></div>");
                            
                            item.on("click", function() {
                                popup.find("#irrigdb-plant").val(plant.common_name);
                                suggestions.hide();
                            });
                            
                            suggestions.append(item);
                        });
                        
                        suggestions.show();
                    });
                }, 300);
            });
            
            // Search button handler
            popup.find("#irrigdb-search").on("click", function() {
                var zone = popup.find("#irrigdb-zone").val();
                var plant = popup.find("#irrigdb-plant").val().trim();
                
                if (!plant) {
                    alert("Please enter a plant name");
                    return;
                }
                
                popup.find("#irrigdb-suggestions").hide();
                
                self.getRecommendations(zone, plant, function(data) {
                    var resultsDiv = popup.find("#irrigdb-results");
                    resultsDiv.empty();
                    
                    if (!data || data.length === 0) {
                        resultsDiv.html("<p style='color:#999;'>No results found for this plant and zone combination.</p>").show();
                        return;
                    }
                    
                    var html = "<h3>Results (" + data.length + ")</h3>" +
                        "<table style='width:100%; border-collapse:collapse;'>" +
                        "<thead><tr style='background:#667eea; color:white;'>" +
                        "<th style='padding:8px; text-align:left;'>Plant</th>" +
                        "<th style='padding:8px; text-align:center;'>Min %</th>" +
                        "<th style='padding:8px; text-align:center;'>Max %</th>" +
                        "<th style='padding:8px; text-align:center;'>Action</th>" +
                        "</tr></thead><tbody>";
                    
                    data.forEach(function(item) {
                        html += "<tr style='border-bottom:1px solid #eee;'>" +
                            "<td style='padding:8px;'><strong>" + item.plant_name + "</strong><br>" +
                            "<small>" + item.plant_category + "</small></td>" +
                            "<td style='padding:8px; text-align:center;'><strong>" + item.start_irrigation + "</strong></td>" +
                            "<td style='padding:8px; text-align:center;'><strong>" + item.stop_irrigation + "</strong></td>" +
                            "<td style='padding:8px; text-align:center;'>" +
                            "<button class='irrigdb-select' data-min='" + item.start_irrigation + "' " +
                            "data-max='" + item.stop_irrigation + "' data-plant='" + item.plant_name + "' " +
                            "data-theme='b' data-mini='true'>Select</button>" +
                            "</td></tr>";
                        
                        if (item.notes) {
                            html += "<tr style='background:#f9f9f9;'><td colspan='4' style='padding:4px 8px;'>" +
                                "<small><strong>Note:</strong> " + item.notes + "</small></td></tr>";
                        }
                    });
                    
                    html += "</tbody></table>";
                    
                    resultsDiv.html(html).show();
                    
                    // Select button handlers
                    resultsDiv.find(".irrigdb-select").on("click", function() {
                        var btn = $(this);
                        var minValue = parseFloat(btn.data("min"));
                        var maxValue = parseFloat(btn.data("max"));
                        var plantName = btn.data("plant");
                        
                        popup.popup("close");
                        
                        if (onSelect) {
                            onSelect({
                                min: minValue,
                                max: maxValue,
                                plant: plantName,
                                zone: zone
                            });
                        }
                    });
                    
                    resultsDiv.enhanceWithin();
                });
            });
            
            // Allow search on Enter key
            popup.find("#irrigdb-plant").on("keypress", function(e) {
                if (e.which === 13) {
                    e.preventDefault();
                    popup.find("#irrigdb-search").click();
                }
            });
            
            // Close suggestions when clicking outside
            $(document).on("click", function(e) {
                if (!$(e.target).closest("#irrigdb-plant, #irrigdb-suggestions").length) {
                    popup.find("#irrigdb-suggestions").hide();
                }
            });
            
            OSApp.UIDom.openPopup(popup);
        });
    }
};

// Initialize on load
$(document).ready(function() {
    if (typeof OSApp.Analog !== 'undefined') {
        OSApp.Analog.IrrigationDB.init();
    }
});
