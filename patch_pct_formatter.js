const fs = require('fs');
let content = fs.readFileSync('/srv/www/htdocs/ui/www/js/modules/analog.js', 'utf8');
content = content.replace(/var pctFormatter = function\(val\) \{ return OSApp\.Analog\.formatValUnit\(val, "%"\); \};\n/g, '');
content = content.replace(/var orderedProgAdjusts = /, 'var pctFormatter = function(val) { return OSApp.Analog.formatValUnit(val, "%"); };\n\t\tvar orderedProgAdjusts = ');
fs.writeFileSync('/srv/www/htdocs/ui/www/js/modules/analog.js', content, 'utf8');
