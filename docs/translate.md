# Help translate

PXT supports localized content for both PXT web app and target documentation.
The default language is currently always English.

Our translations are managed via Crowdin, a translation management platform. It is free to join
and you can volunteer to translate parts of the web site.

## Crowdin project

The project below contains the resources from https://www.pxt.io and the menu items of https://pxt.microbit.org.

* [https://crowdin.com/project/kindscript](https://crowdin.com/project/kindscript)

If you want to help translating the editor, please sign in to Crowdin and send us a translator request.

## Live Translations

To test your changes "live", use **beta** build and the ``?livelang=CODE`` query argument where ``CODE`` is your language ISO code. For example, to see the french translations:

* https://pxt.microbit.org/beta?livelang=fr

Note that there may be a delay of up to 5 minutes before your changes in Crowdin make it into the "live" view.

## Translating the editor interface

All the editor interface strings, like the "Download" button are in the ``strings.json`` file.

We also maintain a prioritized list of strings in the file ``live-strings.json``. 
These strings extracted by instrumenting the web site and inspecting which string gets shown to the user. Start localizing this file for best effect!

## Translating the blocks and reference documentation

You will find target specific localization files under folders in crowdin. For example, all blocks, reference translations for the **microbit** are under ``/microbit`` , one for the block definition and one for the descriptions:

* ``core-strings.json``: contains the block definitions
* ``core-jsdoc-strings.json``: contains the descriptions

The block definition should be carefully translated using the [block definition syntax](https://www.pxt.io/defining-blocks). 
Open the developer tools and watch the console, PXT wil validate the localized string and flag potential issues.

### Block localization guidance

* Do not capitalize blocks
* Do not translalte ``%variable`` names
* Do not reorder parameters
* Maintain the same structure of ``|`` and ``%variables%``

## Translating Documentation

Typically, the directory structure would look something like this:

```
mytarget/
    pxtarget.json
    docs/
        about.md
        foobar.md
        reference/
            baz.md
        _locales/
            de/
                _theme.json
                foobar.md
                reference/
                    baz.md
            pt-br/
                _theme.json
                about.md
```

We thus get English pages `/about`, `/foobar` and `/reference/baz`.
Additionally, `/foobar` and `/reference/baz` are also translated
to German, while `/about` has a Brazilian Portuguese translation.

The German content will be returned to user when the requested
language is `de`, `de-DE`, `de-AT` etc. The `pt-br` content
will be returned when language is exactly `pt-BR` (and not say 
`pt-PT`). If you want it returned also for `pt-PT`, then use `pt` folder.

The language matching should generally be case insensitive, but it's best
to use lower case in the data you create to avoid problems.

The `pxtarget.json` file contains a number of strings which
show up on doc pages (mostly menu items and target name). These can
be localized in ``_theme.json`` files. 

Check out `pxt-sample` target for an example!

## Supported languages

Check out https://www.pxt.io/api/i18n/langs for current list of configured
languages. If you need additional languages there, let us know!
