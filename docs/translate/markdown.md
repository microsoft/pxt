# Translating markdown

All of the documentation pages for MakeCode are written in markdown. The markdown files for these pages are sent to Crowdin as part of the content available to translate. To have more interactive elements be present in the document pages, MakeCode uses an extended form of markdown to define and represent these elements. This includes code snippets, embedded simulators, clickable link cards, tutorial directives, and more.

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

### Extension references

An extension is extra code that is imported into a project when it's loaded into the MakeCode editor. Since code can run from a inside a markdown page, the use of additional code from an extension needs a reference in that same page. Usually these references are specified at the bottom of the page. In Crowdin, they will appear with the same font as the code snippets. You leave these extension references untranslated. They might look like this:

```
microturtle=github:Microsoft/pxt-microturtle#v0.0.9
```

Occasionally, an extension will reside with the editor itself and doesn't need a URL style reference. It might just appear at the bottom of the page as:

```
microturtle
```

In this case you might think that this is something to translate. You'll have to note that this has the same font in as a code snippet and should be left untranslated.

## Tutorials

Tutorial documents use a lot more extended markdown than regular document pages do. There are several directive strings and attribute strings that get included with the normal text. These are used to control the flow and behavior of the tutorial experience. You will see these in the tutorial files on Crowdin.

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

The word `Introduction` is translated but the control option of `@unplugged` is left as is. Also, a step heading can have a form which hides it from the tutorial window:

```
{Intro @unplugged}
```

This translates in the same way as before, only translate `Introduction`, the `{`, `}`, and `@unplugged` are left alone.

### Tutorial hint

A tutorial hint is a special code snippet for tutorials that offers a quick coding solution to the user. It has a form like:

```
~tutorialhint
    //@highlight
info.startCountdownGame(20, winTypes.Score)
```

When you encounter this, all of it is left untranslated.

### Emojis and icons

Emojis and icons can be present in the markdown as well. Some of them will appear as actual images. Others will have a code:

```
:id card:
:tree:
```

Leave the code names untranslated.


## Skillmaps

Skillmap documents use almost the same extended markdown as tutorials. One big difference is the skillmap specification page. It is found in the root skillmap folder and has all of the skillmap paths and settings. As an example, here's the first part of the `balloon.md` skillmap.

```
Burstin' Balloons

* name: Burstin' Balloons
* description: Create a simple carnival game where you click quickly to try to burst a balloon before time runs out.
* infoUrl: skillmap/educator-info/balloon-map-info
* bannerUrl: /static/skillmap/balloon/balloon3.gif
* backgroundurl: /static/skillmap/backgrounds/mouse-comp.gif
* primarycolor: #ffffff
* secondarycolor: #fff53d
* tertiarycolor: #96ecfd
* completednodecolor: #4a8397
* highlightcolor: #ff0000
* allowcodecarryover: true
* tags: easy, beginner, carnival

burstin-balloons

* layout: manual

balloon1

* allowcodecarryover: false
* name: Create a Clicker
* type: tutorial
* description: Learn to use MakeCode Arcade and create a simple clicker game.
* tags: easy, intro, points, clicker
* next: balloon2
* url: /skillmap/balloon/balloon1
* imageUrl: /static/skillmap/balloon/balloon1.gif
* position: -1 2
```

It can be hard to know what to translate and what to leave alone with this file. Basically, everything to the left of `:` remains untranslated. Then, settings that have descriptions, have a name, or are tags can get translated.

In the first block of settings, the main map settings, there's the title `Burstin' Ballons`. This will be translated. The description, `Create a simple carnival game where...`, is also translated along with the tags settings, `easy, beginner, carnival`. All of these settings relate to the language locale. The remaining settings aren't locale related so they remain untranslated.

The section headings of `burstin-balloons` and `balloon1` are skillmap paths and do not get translated.

Essentially, you will translate the main skillmap title and the setting values for:

* name
* description
* tags

## Cards and card pages

Card pages are markdown documents with a some data sections inside them which have "card" entries. The sections are a list of cards which represent graphic buttons that link to other documents, videos, or projects. They are used to create the link galleries on the editor's home screen. Sometimes card links are embedded in regular documents like make projects and course materials too.

Here's an example card page for a set of lessons:

```
Lessons

Getting started

[
{
  "name": "Cherry Pickr",
  "description": "Learn the basics of creating a game",
  "url": "/lessons/cherry-pickr",
  "imageUrl": "/static/lessons/cherry-pickr.png"
},
{
  "name": "Dance Party",
  "description": "Create a basic dance collision game using sprite overlap events and controller buttons!",
  "url": "/lessons/dance-party",
  "imageUrl": "/static/lessons/dance-party.png"
},
{
  "name": "BlockOut",
  "description": "Create a projectile collision game",
  "url": "/lessons/block-out",
  "imageUrl": "/static/lessons/block-out.png"
}
]

See Also

Block Out, Cherry Pickr, Dance Party
```

The items that get translated are the titles, subtitles, the `See Also` title, and the 'See Also' link names. Also, within each card entry, the string value after `"name":` and `"description":` are translated. Everything else is left as is. Remember, don't translate any value names before the `:`.
