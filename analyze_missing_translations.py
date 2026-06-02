import os
import re
import glob
import json

UI_DIR = "/srv/www/htdocs/ui/www"
LOCALE_DIR = os.path.join(UI_DIR, "locale")

# Patterns
JS_TRANSLATE_PATTERNS = [
    re.compile(r'OSApp\.Language\._\(\s*"((?:[^"\\]|\\.)*)"\s*\)'),
    re.compile(r"OSApp\.Language\._\(\s*'((?:[^'\\]|\\.)*)'\s*\)")
]

HTML_TRANSLATE_PATTERNS = [
    re.compile(r'data-translate="([^"]*)"'),
    re.compile(r"data-translate='([^']*)'")
]

def unescape_string(s):
    s = s.replace(r'\"', '"').replace(r"\'", "'")
    s = s.replace(r'\n', '\n').replace(r'\t', '\t')
    s = s.replace(r'\u2026', '…')
    return s

def extract_keys():
    keys = set()
    js_files = glob.glob(os.path.join(UI_DIR, "js/**/*.js"), recursive=True)
    js_files.extend(glob.glob(os.path.join(UI_DIR, "js/*.js")))
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
    extracted_keys = extract_keys()
    print(f"Extracted {len(extracted_keys)} unique keys from codebase.")

    locale_files = glob.glob(os.path.join(LOCALE_DIR, "*.js"))
    for lf in sorted(locale_files):
        lang = os.path.basename(lf).replace(".js", "")
        with open(lf, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except Exception as e:
                print(f"Error parsing {lf}: {e}")
                continue

            messages = data.get("messages", {})
            # A key is missing if it is not in messages, or if its value is empty string ""
            missing = [k for k in extracted_keys if k not in messages or messages[k] == ""]

            print(f"Locale: {lang} | Current messages: {len(messages)} | Missing/Empty: {len(missing)}")
            if missing:
                print(f"  First 5 missing: {missing[:5]}")
