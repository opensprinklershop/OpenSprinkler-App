from deep_translator import GoogleTranslator
translator = GoogleTranslator(source='en', target='de')
test_strings = ["-- Select or Enter Custom --", "Active Channel", "Discovered Valves & Sensors"]
res = translator.translate_batch(test_strings)
print(res)
