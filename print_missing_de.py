import os
import json

with open("/srv/www/htdocs/ui/www/locale/de.js", "r") as f:
    de_data = json.load(f)

# Let's extract all keys
import sys
sys.path.append("/srv/www/htdocs/ui")
from extract_translations import extract_keys

extracted = extract_keys()
missing_de = [k for k in extracted if k not in de_data["messages"] or de_data["messages"][k] == ""]
print(f"Missing in DE ({len(missing_de)}):")
for m in sorted(missing_de):
    print(f"  - {repr(m)}")
