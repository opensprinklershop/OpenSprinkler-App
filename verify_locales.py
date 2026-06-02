import glob
import json
import os

locale_files = glob.glob("/srv/www/htdocs/ui/www/locale/*.js")
for f in locale_files:
    try:
        with open(f, 'r', encoding='utf-8') as fh:
            data = json.load(fh)
            print(f"{os.path.basename(f)} parsed successfully. Keys: {len(data.get('messages', {}))}")
    except Exception as e:
        print(f"FAILED TO PARSE {os.path.basename(f)}: {e}")
