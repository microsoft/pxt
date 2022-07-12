# What parts of MakeCode are translated?

## MakeCode.com website 

Not only are the strings and documentation for the various editors translated, the text for the MakeCode.com project website is translated too. Such as the pages for:

* [About](/about)
* [Documents](/docs)
* [Labs](/labs)
* [Blog](/blog)

...and even the [page](#) you're reading now. These are in the markdown files found in the `core` folder under `docs`.

Strings found in the rendering code of the MakeCode.com website are placed in  ``webstrings.json``.

## Common strings and pages

There are strings that are shared by, and therefore common to, every MakeCode target. There's a top level ``strings.json`` that is used by the webapp that the target editor runs under. These are strings for the base interface elements of the editor. Examples are strings for download actions, editor view buttons, dialog text, and common menu items.

![UI elements](/static/translationui.png)

A set of base documents that each target editor "inherits" is in the ``core`` folder under ``common-docs``. These mostly document fundamental coding and programming topics that are general for any editor.

## Target editor strings and pages

Strings for each target are under the target name folder, ``microbit`` for example. Strings which are used for customization of the target editor are in a file called ``target-strings.json``. The other strings files are primarily for the text in the blocks used by the that target. The files are named by the block category followed by ``-strings.json`` and ``-jsdoc-strings.json``. So, text in blocks for the ``radio`` category are found in:

* ``radio-strings.json``
* ``radio-jsdoc-strings.json``

The first file, ``radio-strings.json``, contains strings for the text of the ``radio`` blocks. The second file, ``radio-jsdoc-strings.json``, has the strings for descriptions of the coding language elements that make up the ``radio`` blocks. Here's an example of some categories and blocks in [MakeCode for Minecraft](https://minecraft.makecode.com/about).

![Target and block text](/static/translationblocks.png)

There's also a ``docs`` folder under each target folder for the all documentation pages specific to that target.

## MakeCode extensions

[Extensions](/extensions) provide additional code blocks for features and functions in a target editor that aren't there by default. A user adds an extension to the editor in an extensions dialog selected from the **Settings** menu. Extensions are created by anyone, not just the MakeCode team. Extensions can have their own documentation and have localization files you can edit. Translations for extensions are not part of the MakeCode Crowdin project. An extension is hosted in a GitHub repository and you will need to have a GitHub account to help with localizing an extension's strings or documents. Extension localization is described [here](/extensions/localization).
