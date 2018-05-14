# Package localization files

Packages can also package localized strings as JSON resource files.

When building the package, the [pxt cli](/cli) generates various ``.json`` under ``_locales``. These contains the original string resource files.

* translate the values in those files
* place the translate files under ``_locales/LANGISO/...`` where ``LANGISO`` is the language iso code (all lower cased).
* add the files reference in ``files`` section in ``pxt.json``.

See [pxt-neopixel](https://github.com/microsoft/pxt-neopixel) for an example of localized package.