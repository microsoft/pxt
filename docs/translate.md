# Help translate

Microsoft MakeCode supports localized content for both MakeCode web app and target documentation.
The default language is currently always English.

Our translations are managed by Crowdin, a translation management platform. It is free to join
and you can volunteer to translate parts of the web site.

### ~ hint

#### Check the FAQ first

Just need a quick answer to a translation question? You can check the [FAQ](#faq) first.

### ~

## Crowdin project

The Crowdin translation project below contains both the resources and menu items from @homeurl@.

* [https://crowdin.com/project/kindscript](https://crowdin.com/project/kindscript)

If you want to help with translating the editor, please sign in to Crowdin (or join first if you don't already have an account) and send us a translator request.

### ~ hint

#### Sign up to translate

For a quick explaination of how to sign up and join a MakeCode translation team, watch this
short video:

https://youtu.be/4PqWq50e8C4

### ~

## Translations in context

MakeCode has the capability for [in context translations](https://support.crowdin.com/in-context-localization/). This allows you to perform translations to text content right at the place where you see it in the editor (or in a documentation page).

https://youtu.be/OugXfqhWUQo

### ~ hint

#### In context suppport

In context translation is still being rolled out into the editors. It might not be available for your MakeCode editor yet.

### Currently supported editors

* `/beta` version of [MakeCode Arcade](https://arcade.makecode.com/beta)
* `/beta` version of [Adafruit Circuit Playground Express](https://makecode.adafruit.com/beta)
* `/beta` version of [LEGO - EV3](https://makecode.mindstorms.com/beta)
* The [Maker Editor](https://maker.makecode.com)

### ~

### Editor translation

To enter translation mode in the editor, go the gearwheel menu, click **Languages** and then click the **Translate the editor** button at the bottom.

![Button in language dialog](/static/blog/translations-in-context/translatebutton.png)

Each portion of text that is available for translation will have a colored border and an icon to edit the translation. The colored borders mean:

* Red border: the text has no translation
* Blue border: the text has a translation but it isn't validated/approved
* Green border: the text has a valdated/approved translation

For user interface elements, simply click on the icon to translate them.

![An example of incontext translations](/static/blog/translations-in-context/home.png)

For blocks, go to the context menu
and click **Translate this block**.

![Blocks context menu with translate option](/static/blog/translations-in-context/contextmenu.png)

You will be prompted with a dialog that contains the block translatable string.

![Translation dialog](/static/blog/translations-in-context/block.png)

## Translation roles

Crowdin is a crowd-sourced translation platform with two main actors: **translators** and **proofreaders**. 
**Translators** add new translations or vote for existing translations. Once a translation is available, a **proofreader** needs
to **validate** it in order to appear on the MakeCode web sites.

### Translator

As a translator you select text from a strings file or markdown page. In this case, the tutorial file ``dice.md`` is selected.

![File list](/static/translation/translate-file.jpg)

A particular string is then selected to translate.

![String selections list](/static/translation/string-select.jpg)

Over in the translation editor you type in your suggested translation and press **SAVE**.

![Translation editor example](/static/translation/translate-editor.jpg)

Once your translation is saved, it moves down into the suggested translations list. There could be other translation suggestions listed there too. You can review those to help form your new translation or possibly someone else has come up with a better one. If some part of a string your working on was already translated, Crowdin may offer a suggestion using some of the previous translated text.

![Translation suggestions list](/static/translation/translate-suggestions.jpg)

### Proofreader

Proofreaders review new translations and approve or disapprove suggestions. A suggestion is approved by pressing the **Approve** button (a checkmark) next to it.

![Translation suggestions list](/static/translation/translate-approve.jpg)

## Crowdin deep dive

Interested in how localization works in MakeCode? Watch this video for an overview of the process.

https://youtu.be/XpdUzpBVKFU

### Languages

On the Crowdin [home page](https://crowdin.com/project/kindscript) are the all of the languages enabled for the MakeCode project. You go here first to choose the language or languages you wish to participate in for translation.

![Enabled languages](/static/translation/languages.jpg)

When you select a language, you see a folder view of the translation files for both the common parts of MakeCode and for each target editor. Each language has an identical folder view and the same number of files having the same names.

![Folder view within a language](/static/translation/folder-view.jpg)

The source language for all of the files is English and that's the language the files are in when uploaded to Crowdin. During the translation process, Crowdin keeps a database of all the current and suggested translations for each part of a translation file.

### Target folders

Under each language there are top-level folders for all of the editors (including the MakeCode core) supported by the MakeCode team. Some of these are featured on the [MakeCode](https://www.microsoft.com/en-us/makecode) home page. If you are interested in helping translate a particular target, you can focus your efforts in the files under its top-level folder. If you wish to help generally and want to work in more than one target, be aware that not all targets are presently active. To make your help count the most, you probably want to work with an active target. These are active and inactive targets:

#### Active targets

- [x] [adafruit](https://crowdin.com/project/kindscript/en#/adafruit)
- [x] [arcade](https://crowdin.com/project/kindscript/en#/arcade)
- [x] [brainpad](https://crowdin.com/project/kindscript/en#/brainpad)
- [x] [core](https://crowdin.com/project/kindscript/en#/core)
- [x] [chibitronics](https://crowdin.com/project/kindscript/en#/chibitronics)
- [x] [ev3](https://crowdin.com/project/kindscript/en#/ev3)
- [x] [grovezero](https://crowdin.com/project/kindscript/en#/grovezero)
- [x] [maker](https://crowdin.com/project/kindscript/en#/maker)
- [x] [microbit](https://crowdin.com/project/kindscript/en#/microbit)
- [x] [minecraft](https://crowdin.com/project/kindscript/en#/minecraft)
- [x] [stm32iotnode](https://crowdin.com/project/kindscript/en#/stm32iotnode)

#### Inactive targets

- [ ] [v0](https://crowdin.com/project/kindscript/en#/v0)
- [ ] [calliope](https://crowdin.com/project/kindscript/en#/calliope)
- [ ] [calliopemini](https://crowdin.com/project/kindscript/en#/calliopemini)

### File types

#### Strings files

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

#### Documentation pages

All of the documentation pages are translated. These pages are written in [markdown](https://daringfireball.net/projects/markdown/) and are copied up to Crowdin verbatim, no processing or text extraction. So, in the file folder tree you will see files with names that end with ``.md`` meaning that they are markdown files. The markdown pages support documentation for how-to pages, maker projects, lessons, coding courses, and code block reference...just to name a few.

In MakeCode, there are a few extensions to "standard" markdown to provide addtional style information for page rendering on the document server. These are for adding hint boxes, inserting code blocs directly into pages, highlighting block names, embedding simulation blocks, macros, and other features. These are described in the [writing docs](/writing-docs) section.

You can freely translate the content in these files as appropriate for the language context. However, be aware of any MakeCode style and block extensions to the common markdown and avoid incorrecly translating those.

In this example, a reference page for the **show animation** block is translated. Notice that the code blocks, code parameter names, and hint style specifiers are left untranslated. Only the descriptive content for the page is translated.

![Translation example for reference page](/static/translation/md-page.jpg)

### What parts of MakeCode are translated?

#### MakeCode.com website

Not only are the strings and documentation for the various editors translated, the text for the MakeCode.com project website is translated too. Such as the pages for:

* [About](/about)
* [Documents](/docs)
* [Labs](/labs)
* [Blog](/blog)

...and even the [page](#) you're reading now. These are in the markdown files found in the `core` folder under `docs`.

Strings found in the rendering code of the MakeCode.com website are placed in  ``webstrings.json``.

#### Common strings and pages

There are strings that are shared by, and therefore common to, every MakeCode target. There's a top level ``strings.json`` that is used by the webapp that the target editor runs under. These are strings for the base interface elements of the editor. Examples are strings for download actions, editor view buttons, dialog text, and common menu items.

![UI elements](/static/translationui.png)

A set of base documents that each target editor "inherits" is in the ``core`` folder under ``common-docs``. These mostly document fundamental coding and programming topics that are general for any editor.

#### Target editor strings and pages

Strings for each target are under the target name folder, ``microbit`` for example. Strings which are used for customization of the target editor are in a file called ``target-strings.json``. The other strings files are primarily for the text in the blocks used by the that target. The files are named by the block category followed by ``-strings.json`` and ``-jsdoc-strings.json``. So, text in blocks for the ``radio`` category are found in:

* ``radio-strings.json``
* ``radio-jsdoc-strings.json``

The first file, ``radio-strings.json``, contains strings for the text of the ``radio`` blocks. The second file, ``radio-jsdoc-strings.json``, has the strings for descriptions of the coding language elements that make up the ``radio`` blocks. Here's an example of some categories and blocks in [MakeCode for Minecraft](https://minecraft.makecode.com/about).

![Target and block text](/static/translationblocks.png)

There's also a ``docs`` folder under each target folder for the all documentation pages specific to that target.

### Translation file summary

The following table provides a quick guide to which parts of MakeCode the translation files and folders relate. The links here are to the [English](https://crowdin.com/project/kindscript/en#) source files just to show you the location of the files in the folder structure. Of course, you will translate in your selected language instead.

| File / Folder | Description |
| - | - |
| [strings.json](https://crowdin.com/project/kindscript/32/en-en) | MakeCode editor webapp UI elements |
| [webstrings.json](https://crowdin.com/translate/kindscript/588/en-en) | Localized strings for parts of the [MakeCode.com](https://makecode.com/docs) website |
| [core/docs](https://crowdin.com/project/kindscript/en#/core/docs) | Documentation about developing new MakeCode targets, creating extensions, authoring documents, and the MakeCode blog |
| [core/common-docs](https://crowdin.com/project/kindscript/en#/core/common-docs) | Documentation shared by all MakeCode targets. Describes use of the editor, coding concepts, and reference for the base blocks |

## MakeCode extensions

[Extensions](/extensions) provide additional code blocks for features and functions in a target editor that aren't there by default. A user adds an extension to the editor in an extensions dialog selected from the **Settings** menu. Extensions are created by anyone, not just the MakeCode team. Extensions can have their own documentation and have localization files you can edit. Translations for extensions are not part of the MakeCode Crowdin project. An extension is hosted in a GitHub repository and you will need to have a GitHub account to help with localizing an extension's strings or documents. Extension localization is described [here](/extensions/localization).

## Tips and guidance

### Publishing new translations

Once a translation is approved by a proofreader it is published to the "live" website for MakeCode.com or the target editor. There's a scheduled process which checks for new translations in Crowdin and brings them down to the website serving a MakeCode editor. There is a period of delay from when a new translation is approved and when it will appear on the site. This is generally between 10 - 30 minutes.

### Live Translations

To test your changes "live", use **beta** build and the ``?liveforcelang=CODE`` hash argument where ``CODE`` is your language ISO code. For example, to see the french translations:

* https://makecode.microbit.org/beta?liveforcelang=fr

Note that there may be a delay of up to 24 hours before your changes in Crowdin make it into the "live" view.
Also, the language will only be available in the editor's language selection if the target has enabled that locale - which is why you need to use the hash mentioned above.

### Tutorials

Tutorials are markdown pages that follow a very specific format. This is so that the tutorial engine can read the individual sections and build a proper list of steps for them. Be aware that there are some macros that are unique to tutorials and you should not translate them. Some of these are:

* ``@fullscreen``
* ``@unplugged``

### Block localization guidance

* Do not capitalize words in blocks
* Do not translate any ``%variable`` or ``$variable`` names
* Do not reorder parameters
* Maintain the same order and spacing of all ``|`` and ``%variable`` names in the block text
> Note: If the order of the ``%variable`` names reads poorly in the translated language, it's possible change the order if there are no ``|`` symbols and you use ``$`` instead of ``%`` as a prefix for the variable.

## FAQ

Here are answers to some common questions about localization and translation in Crowdin.

### Do I translate those names with special characters in the block strings?

No, leave the words connected to `$`, `%`, `=`, etc. untranslated. These are parameter names and need to remain as they are. Also, the `|` is a separator character and is NOT translated. In this example, two untranslated strings in Crowdin appear like this:

```
serial|redirect to|TX %tx|RX %rx|at baud rate %rate
serial set rx buffer size to $size
serial|write buffer %buffer=serial_readbuffer
```

Here, you can translate `serial`, `redirect to`, `set`, `buffer`, `write`, `size`, and `to`.

The words `%tx`, `%rx`, `%rate` `$size`, and `%buffer=serialbuffer` stay the same and are NOT translated.

### What about the text inside the '{ }'

The text inside `{ }` such as `{0:s}` and `{id:name}` is left alone and NOT translated.
