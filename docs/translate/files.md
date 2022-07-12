# Localization files

## Strings files

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

## Content pages

All of the documentation pages are translated. These pages are written in [markdown](https://daringfireball.net/projects/markdown/) and are copied up to Crowdin verbatim, no processing or text extraction. So, in the file folder tree you will see files with names that end with ``.md`` meaning that they are markdown files. The markdown pages support documentation for how-to pages, maker projects, lessons, coding courses, and code block reference...just to name a few.

In MakeCode, there are a few extensions to "standard" markdown to provide addtional style information for page rendering on the document server. These are for adding hint boxes, inserting code blocs directly into pages, highlighting block names, embedding simulation blocks, macros, and other features. These are described in the [writing docs](/writing-docs) section.

You can freely translate the content in these files as appropriate for the language context. However, be aware of any MakeCode style and block extensions to the common markdown and avoid incorrecly translating those.

In this example, a reference page for the **show animation** block is translated. Notice that the code blocks, code parameter names, and hint style specifiers are left untranslated. Only the descriptive content for the page is translated.

![Translation example for reference page](/static/translation/md-page.jpg)

## Common localization files

The following table provides a quick guide to the parts of MakeCode that are common to all target editors. The links here are to the [English](https://crowdin.com/project/makecode/en#) source files just to show you the location of the files in the folder structure. Of course, you will translate in your selected language instead.

| File / Folder | Description |
| - | - |
| [strings.json](https://crowdin.com/project/makecode/32/en-en) | MakeCode editor webapp UI elements |
| [webstrings.json](https://crowdin.com/translate/makecode/588/en-en) | Localized strings for parts of the [MakeCode.com](https://makecode.com/docs) website |
| [core/docs](https://crowdin.com/project/makecode/en#/core/docs) | Documentation about developing new MakeCode targets, creating extensions, authoring documents, and the MakeCode blog |
| [core/common-docs](https://crowdin.com/project/makecode/en#/core/common-docs) | Documentation shared by all MakeCode targets. Describes use of the editor, coding concepts, and reference for the base blocks |
