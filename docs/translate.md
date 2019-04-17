# Help translate

Microsoft MakeCode supports localized content for both MakeCode web app and target documentation.
The default language is currently always English.

Our translations are managed by Crowdin, a translation management platform. It is free to join
and you can volunteer to translate parts of the web site.

## Crowdin project

The project below contains the resources from https://makecode.com and the menu items of @homeurl@.

* [https://crowdin.com/project/kindscript](https://crowdin.com/project/kindscript)

If you want to help with translating the editor, please sign in to Crowdin (or join first if you don't already have an account) and send us a translator request.

## Languages

On the Crowdin [home page](https://crowdin.com/project/kindscript) are the all of the languages enabled for the MakeCode project. You go here first to choose the language or languages you wish to participate in for translation.

![Enabled languages](/static/translation/languages.jpg)

When you select a language, you see a folder view of the translation files for both the common parts of MakeCode and for each target editor.

![Folder view within a language](/static/translation/folder-view.jpg)

## File types

### Strings files

The folder tree contains both **strings** files and **markdown** files for complete document pages. If you haven't heard of the term _strings_ before, strings are text elements which are either individual words or sentences. If you select the top level ``strings.json`` file, a portion of it might contain:

![Strings file example](/static/translation/strings-file.jpg)

There are several forms of strings in the file. You will find whole sentences, partial sentences, and single words.

* ``Angle``
* ``Automatically created from MakeCode.``

Also, some strings have replacement tokens (something like `{0}`, `{1}`, or `%1` and so on). The tokens themselves aren't translated but are used by the website code to insert words into strings dynamically. In these strings, only the real words are translated.

* ``A {0} named '{1}' already exists.``
* ``%1 set value at %2 to %3``

The content in the strings files comes from a process of text extraction from the website code, code for the editor webapp, and all of the code to make the actual blocks used in the editor. Periodally, all of the new and changed strings from text found in the code are collected, placed in strings files, and uploaded to Crowdin. For example, some code to create a text element in HTML for ``Add a parameter`` looks like this:

```
<span className="ui text mobile only paramlabel">{lf("Add a parameter")}</span>
```

The MakeCode build process extracts the ``Add a parameter`` in adds it into a strings file which eventually is uploaded to Crowdin as ``strings.json``.

Similarly for the code that makes blocks, strings for those are extracted and placed in their own strings files. For example, the block string for **pick random** is extracted from the this code:

```
//% blockId="device_random" block="pick random %min|to %limit"
function randomRange(min: number, max: number): number;
```

The text for the **pick random** block will look like this in a ``core-strings.json`` file on Crowdin:

``pick random %min|to %limit``

Also, for the array **insert at** block, it's block text is:

``%list| insert at %index| value %value``

The block strings can include syntax characters and tokens as well as the text to translate. You only translate the **real words** and not the syntax elements or tokens, such as `%index`, `%value`, or `|`. The following translation example shows how only the words are translated:

![Words only translation example](/static/translation/xlate-words-only.jpg)

### Documentation pages

All of the documentation pages are translated. These pages are written in [markdown](https://daringfireball.net/projects/markdown/) and are copied up to Crowdin verbatim, no processing or text extraction. So, in the file folder tree you will see files with names that end with ``.md`` meaning that they are markdown files. The markdown pages support documentation for how-to pages, maker projects, lessons, coding courses, and code block reference...just to name a few.

In MakeCode, there are a few extensions to "standard" markdown to provide addtional style information for page rendering on the document server. These are for adding hint boxes, inserting code blocs directly into pages, highlighting block names, embedding simulation blocks, macros, and other features. These are described in the [writing docs](/writing-docs) section.

You can freely translate the content in these files as appropriate for the language context. However, be aware of any MakeCode style and block extensions to the common markdown and avoid incorrecly translating those.

In this example, a reference page for the **show animation** block is translated. Notice that the code blocks, code parameter names, and hint style specifiers are left untranslated. Only the descriptive content for the page is translated.

![Translation example for reference page](/static/translation/md-page.jpg)

## What parts of MakeCode are translated?

### MakeCode.com website

Not only are the strings and documentation for the various editors translated, the text for the MakeCode.com project website is translated too. Such as the pages for:

* [About](/about)
* [Documents](/docs)
* [Labs](/labs)
* [Blog](/blog)

...and even the [page](#) you're reading now. These are in the markdown files found in the `core` folder under `docs`.

Strings found in the rendering code of the MakeCode.com website are placed in  ``webstrings.json``.

### Common strings and pages

There are strings that are shared by, and therefore common to, every MakeCode target. There's a top level ``strings.json`` that is used by the webapp that the target editor runs under. These are strings for the base interface elements of the editor. Examples are strings for download actions, editor view buttons, dialog text, and common menu items.

![UI elements](/static/translationui.png)

A set of base documents that each target editor "inherits" is in the ``core`` folder under ``common-docs``. These mostly document fundamental coding and programming topics that are general for any editor.

### Target editor strings and pages

Strings for each target are under the target name folder, ``microbit`` for example. Strings which are used for customization of the target editor are in a file called ``target-strings.json``. The other strings files are primarily for the text in the blocks used by the that target. The files are named by the block category followed by ``-strings.json`` and ``-jsdoc-strings.json``. So, text in blocks for the ``radio`` category are found in:

* ``radio-strings.json``
* ``radio-jsdoc-strings.json``

The first file, ``radio-strings.json``, contains strings for the text of the ``radio`` blocks. The second file, ``radio-jsdoc-strings.json``, has the strings for descriptions of the coding language elements that make up the ``radio`` blocks. Here's an example of some categories and blocks in [MakeCode for Minecraft](https://minecraft.makecode.com/about).

![Target and block text](/static/translationblocks.png)

There's also a ``docs`` folder under each target folder for the all documentation pages specific to that target.


## Translation roles

### Translator

As a translator you select text from a strings file or markdown page. In this case, the tutorial file ``dice.md`` is selected.

![File list](/static/translation/translate-file.jpg)

A particular string is then selected to translate.

![String selections list](/static/translation/string-select.jpg)

Over in the translation editor you type in your suggested translation and press **SAVE**.

![Translation editor example](/static/translation/translate-editor.jpg)

Once your translation is saved, it moves down into the suggested translations list. There could be other translation suggestions listed there too.

![Translation suggestions list](/static/translation/translate-suggestions.jpg)

## Proofreader

Proofreaders review new translations and approve or disapprove suggestions. A suggestion is approved by  pressing the **Approve** button (a checkmark) next to it.

![Translation suggestions list](/static/translation/translate-approve.jpg)

## Tips and guidance

### Live Translations

To test your changes "live", use **beta** build and the ``?liveforcelang=CODE`` hash argument where ``CODE`` is your language ISO code. For example, to see the french translations:

* https://pxt.microbit.org/beta?liveforcelang=fr

Note that there may be a delay of up to 24 hours before your changes in Crowdin make it into the "live" view.
Also, the language will only be available in the editor's language selection if the target has enabled that locale - which is why you need to use the hash mentioned above.

### Block localization guidance

* Do not capitalize blocks
* Do not translate ``%variable`` names
* Do not reorder parameters
* Maintain the same structure of ``|`` and ``%variables%``
