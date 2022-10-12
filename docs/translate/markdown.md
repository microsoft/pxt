# Translating markdown

All of the documenation pages for MakeCode are written in markdown. The markdown files for these pages are sent to Crowdin as part of the content available to translate. To have more interactive elements be present in the document pages, MakeCode uses an extended form of markdown to define and represent these elements. This includes code snippets, embedded simulators, clickable link cards, tutorial directives, and more.

These extended markdown elements remain in the documents when they're uploaded to Crowdin. Most of the time these elements need to be with the document but they don't get translated. This can sometimes cause confusion for translators who may not know that a markdown extension should be left alone and not translated like the rest of the core text strings in the document. In this document we point out which of these extended markdown elements you can leave untranslated.

## Information pages

Information pages are for reference, courses and lessons, projects, how to's, tips, FAQs, etc. These pages typcally contain mostly text with occasional images. There are portions of these pages that do not get translated.

### Code blocks

Any sections of code shown are left untranslated. This needs to remain as valid code so it must be left alone.

```
let motions = 0;
input.onButtonPressed(Button.A, () => {
    motions = 0
    basic.showNumber(motions)
})
```

### Code block highlights

Code highlights help to ephasize text that represents a block in the editor Toolbox. They will highlight the text with a color background that matches the block's Toolbox category. In Crowdin, it might look like this:

```
<0>||basic:show number||</0>
```

The `<0>` and `<0/>` are mardown escape codes and you leave them as is, at the same place in the string. The `||` are delimiters for this highlight extension and those are left alone too. The portion of it to the left of the `:`, which is `basic`, is the blocks category and it stays untranslated. The rest of it, `show number` relates to the block text and it does get translated. Typically, this will translate to the same text as the blocks in the `jsdoc` files.

### Avatar sections

Sometimes an avatar section is used in the beginning of a page to cleverly introduce a topic. These enclose some text in a bordered section. The look like this:

```
~ avatar avatar

Let's make a counter for your watch to remember all the motions you make when you walk or move your arm.

~
```

Only translate the text enclosed and leave the leading `~ avatar avatar` and trailing `~` alone.

### Hints

Similar to avatars, hints provide a bordered section to make a message stand out. Hints are formatted similar to avatars.

```
~ hint

Don't forget to download you code when you're finished!

~
```

Along with `hint` there is `reminder`, `alert`, and `tip` which work the same way.

### Buttons

There is a markdown for formatting a link button in a page:

```
~button /writing-docs/tutorials

NEXT: Tutorials

~
```

Here, only the text `NEXT: Tutorials` is translated.

## Tutorials and skillmaps

Tutorials use a lot more extended markdown than regular document pages do. There are several directive strings and attribute strings that get included with the normal text. These are used to control the flow and behavior of the tutorial experience. You will see these in the tutorial files on Crowdin.

Tutorials and skillmaps will also use some of the extended markdown used in the regular document pages.

### The `@` directives

Tutorials use a number of directives to control their behavior. These strings begin with a `@` character and occupy an entire line. Here are some examples:

```
@flyoutOnly true
@hideIteration true
@preferredEditor asset
@explicitHints true
```

When these control directives are present, the entire string is left as is, don't translate it.

### Step headings

Tutorials are written as a series of steps. Usually there is a heading title for each step. These are translated except for the control strings appended to them. Here's a step heading with a control option:

```
Introduction @unplugged
```

The word `Introduction` is translated but the control option of `@unplugged` is left as is. Also, step heading can have a form which hides it from the tutorial window:

```
{Intro @unplugged}
```

This translates in the same way as before, only translate `Introduction`, the `{`, `}`, and `@unplugged` are left alone.

### Tutorial hint

A tutorial hint is a special code snippet for tutorials that offers a quick coding solution the the user. It has a form like:

```
~tutorialhint
    //@highlight
info.startCountdownGame(20, winTypes.Score)
```

When you encounter this, all of it is left untranslated.

### Emojis and icons

Emojis and icons can be present in the markdown as well. Some of them will appear as actual images. Others will have code:

```
:id card:
:tree:
```

Leave the code names untranslated.
