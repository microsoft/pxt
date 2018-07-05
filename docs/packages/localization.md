# Package localization files

Packages can contain localized strings in JSON resource files.

## Translation resources

When building the package, the [pxt cli](/cli) generates various ``.json`` files with string resources under the ``_locales`` folder. These are the original string resource files.

Alternatively, you can run `pxt gendocs --locs` in the package root folder to create these `.json` string files.

## Adding a translation

Here are the steps for adding string translations to a package:

1. Under the `_locales` folder of the package, create a folder with the name of the ISO code for the desired language, for example `_locales/es`. The folder name must be all lower case.
2. Copy the `.json` files that were generated in the `_locales/` folder over to the folder you just created. For example, copy `_locales/neopixel-strings.json` to `_locales/es/neopixel-strings.json`.
3. In the copied `.json` files, replace the English values with your translations. Be careful with the special characters that are parsed by our engine.
4. Add references to the translations files in the ``files`` section of the ``pxt.json`` manifest. For example:

```
"files": [
    "README.md",
    "neopixel.ts",
    "_locales/es/neopixel-strings.json" // Add an entry like this for each localization file
],
```

See [pxt-neopixel](https://github.com/microsoft/pxt-neopixel) for an example of a localized package (notice the `_locales/` folder).
