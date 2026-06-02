from deep_translator import GoogleTranslator
langs = GoogleTranslator().get_supported_languages(as_dict=True)
print(langs)
