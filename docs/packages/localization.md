# Package localization files

Packages can contain localized strings in JSON resource files.

## Translation resources

When building the package, the [pxt cli](/cli) generates various ``.json`` files with string resources under the ``_locales`` folder. These are the original string resource files.

## Adding a translation

Here are the steps for adding string translations to a package:

1. Translate the strings in these files and place them into target language files with the same name.
2. Place the translated files under ``_locales/LANGISO/...`` where ``LANGISO`` is the language ISO code, like ``es`` for example. The language code is all lower case.
3. Add the file reference to the ``files`` section in ``pxt.json``. Such as:

>```json
"files": [
    "README.md",
    "neopixel.ts",
    "_locales/ja/neopixel-strings.json",
    "_locales/zh/neopixel-strings.json"
],
```

See [pxt-neopixel](https://github.com/microsoft/pxt-neopixel) for an example of a localized package.