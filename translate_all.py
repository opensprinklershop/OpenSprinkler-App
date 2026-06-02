import os
import re
import glob
import json
import time
import random
import socket
from deep_translator import GoogleTranslator

# Set default socket timeout of 15 seconds to prevent hanging on network problems
socket.setdefaulttimeout(15)

# Constants
UI_DIR = "/srv/www/htdocs/ui/www"
LOCALE_DIR = os.path.join(UI_DIR, "locale")

# Patterns to extract keys from JS and HTML source files
JS_TRANSLATE_PATTERNS = [
    re.compile(r'OSApp\.Language\._\(\s*"((?:[^"\\]|\\.)*)"\s*\)'),
    re.compile(r"OSApp\.Language\._\(\s*'((?:[^'\\]|\\.)*)'\s*\)")
]

HTML_TRANSLATE_PATTERNS = [
    re.compile(r'data-translate="([^"]*)"'),
    re.compile(r"data-translate='([^']*)'")
]

# Language mappings for Google Translator
MAP_OVER_GOOGLE = {
    'he': 'iw',
    'pes': 'fa',
    'zh': 'zh-CN',
}

def unescape_string(s):
    s = s.replace(r'\"', '"').replace(r"\'", "'")
    s = s.replace(r'\n', '\n').replace(r'\t', '\t')
    s = s.replace(r'\u2026', '…')
    return s

def extract_keys():
    """Extracts all unique translatable keys from JS/HTML codebase files."""
    keys = set()

    # 1. Scan JS files
    js_files = glob.glob(os.path.join(UI_DIR, "js/**/*.js"), recursive=True)
    js_files.extend(glob.glob(os.path.join(UI_DIR, "js/*.js")))
    # Exclude vendor files
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

    # 2. Scan HTML files
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

def translate_batch_with_retry(translator, batch, max_retries=5):
    """Translates a batch of strings with retry logic and exponential backoff."""
    for attempt in range(max_retries):
        try:
            results = translator.translate_batch(batch)
            return results
        except Exception as e:
            wait_time = (2 ** attempt) + random.uniform(1.0, 3.0)
            print(f"    Translation error on attempt {attempt+1}/{max_retries}: {e}. Retrying in {wait_time:.2f}s...")
            time.sleep(wait_time)
    raise RuntimeError(f"Failed to translate batch after {max_retries} attempts.")

def translate_locale_file(lf, extracted_keys):
    """Loads a locale file, translates missing keys, and saves it back."""
    lang = os.path.basename(lf).replace(".js", "")
    google_lang = MAP_OVER_GOOGLE.get(lang, lang)

    print(f"\nProcessing locale: {lang} (Google Code: {google_lang})")

    with open(lf, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except Exception as e:
            print(f"  Error: Failed to parse {lf} as JSON: {e}")
            return False

    messages = data.get("messages", {})

    # Identify which keys are missing or have an empty translation
    missing_keys = [k for k in extracted_keys if k not in messages or messages[k] == ""]

    if not missing_keys:
        print(f"  Locale {lang} is 100% complete! No missing strings.")
        return True

    print(f"  Found {len(missing_keys)} missing/empty translations out of {len(extracted_keys)} total.")

    try:
        translator = GoogleTranslator(source='en', target=google_lang)
    except Exception as e:
        print(f"  Error establishing translator for {google_lang}: {e}")
        return False

    # Translate in batches of 50
    batch_size = 50
    translated_count = 0

    for i in range(0, len(missing_keys), batch_size):
        batch = missing_keys[i:i+batch_size]
        print(f"  Translating batch {i//batch_size + 1}/{(len(missing_keys)-1)//batch_size + 1} ({len(batch)} items)...")

        try:
            translations = translate_batch_with_retry(translator, batch)
        except Exception as e:
            print(f"  Fatal error translating batch for {lang}: {e}. Skipping rest of this language...")
            break

        # Merge translations back into messages
        for key, trans in zip(batch, translations):
            if trans:
                messages[key] = trans
                translated_count += 1
            else:
                # Fallback to key if translation is falsy (e.g. empty)
                messages[key] = key

        # Sleep a bit to avoid hitting rate limits
        sleep_dur = random.uniform(1.0, 2.5)
        time.sleep(sleep_dur)

    # Save the updated messages backend, preserving format
    data["messages"] = messages

    # Sort keys for clean organization in the file
    sorted_messages = {}
    for k in sorted(messages.keys()):
        sorted_messages[k] = messages[k]
    data["messages"] = sorted_messages

    # Write back to file with 3-space indentation
    with open(lf, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=3, ensure_ascii=False)

    print(f"  Locale {lang} updated! Successfully translated {translated_count}/{len(missing_keys)} keys.")
    return True

def main():
    print("Starting comprehensive translation extract and sync workflow...")
    extracted_keys = extract_keys()
    print(f"Extracted {len(extracted_keys)} total unique translatable keys from codebase.")

    locale_files = sorted(glob.glob(os.path.join(LOCALE_DIR, "*.js")))
    print(f"Found {len(locale_files)} locale files to update.")

    success_count = 0
    for lf in locale_files:
        if translate_locale_file(lf, extracted_keys):
            success_count += 1

    print(f"\nCompleted translation sync! Processed {success_count}/{len(locale_files)} file(s) successfully.")

if __name__ == "__main__":
    main()
