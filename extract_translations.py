import os
import re
import json
import glob

# Constants
UI_DIR = "/srv/www/htdocs/ui/www"
LOCALE_DIR = os.path.join(UI_DIR, "locale")

# Patterns
# Match OSApp.Language._( "string" ) or OSApp.Language._( 'string' )
# Handles escaped quotes inside the string
JS_TRANSLATE_PATTERNS = [
    re.compile(r'OSApp\.Language\._\(\s*"((?:[^"\\]|\\.)*)"\s*\)'),
    re.compile(r"OSApp\.Language\._\(\s*'((?:[^'\\]|\\.)*)'\s*\)")
]

HTML_TRANSLATE_PATTERNS = [
    re.compile(r'data-translate="([^"]*)"'),
    re.compile(r"data-translate='([^']*)'")
]

def unescape_string(s):
    # Unescape common escaped sequences in JS strings
    s = s.replace(r'\"', '"').replace(r"\'", "'")
    s = s.replace(r'\n', '\n').replace(r'\t', '\t')
    s = s.replace(r'\u2026', '…')
    return s

def extract_keys():
    keys = set()

    # 1. Scan `.js` files
    js_files = glob.glob(os.path.join(UI_DIR, "js/**/*.js"), recursive=True)
    # Also scan root js files
    js_files.extend(glob.glob(os.path.join(UI_DIR, "js/*.js")))

    # Exclude vendor-js
    js_files = [f for f in js_files if "vendor-js" not in f]

    for filepath in js_files:
        if not os.path.isfile(filepath):
            continue
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            for pattern in JS_TRANSLATE_PATTERNS:
                for match in pattern.finditer(content):
                    key = unescape_string(match.group(1))
                    if key:
                        keys.add(key)

    # 2. Scan `index.html` and any other HTML/htm files
    html_files = glob.glob(os.path.join(UI_DIR, "*.html"))
    for filepath in html_files:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            for pattern in HTML_TRANSLATE_PATTERNS:
                for match in pattern.finditer(content):
                    key = unescape_string(match.group(1))
                    if key:
                        keys.add(key)

    return sorted(list(keys))

if __name__ == "__main__":
    extracted = extract_keys()
    print(f"Extracted {len(extracted)} keys from JS/HTML source files.")
    for k in extracted[:10]:
        print(f"  - {repr(k)}")
    if len(extracted) > 10:
        print(f"  ... and {len(extracted)-10} more.")
