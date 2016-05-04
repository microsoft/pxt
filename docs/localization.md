# Localization

PXT supports localized content for both PXT web app and target documentation.
The default language is currently always English.

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

## Contributing translations

The website "furniture" (strings like "Privacy and Cookies", "Contact us", "Page not found", etc)
are translated in Crowdin - you can contribute translation there.

Similarly, strings in the web app ("New project", "Compile", etc) are also pulled
from Crowdin.

Target documentation translations come from target repositories - you'll
need to do a pull request for particular targets.
