# Tutorials

Step by step tutorials, like the "Getting Started" tutorial, are authored in markdown and automatically converted by the editor. This page describes the format for these tutorials.

## How tutorials work

Tutorials help introduce block usage and for a target. Tutorials are selected from the  **Projects** dialog, under **Tutorials**. When a tutorial is chosen from here, it is run as a user interaction inside the editor. The tutorial progresses through a sequence of steps authored in a markdown document.

Each step of the tutorial has a short description, or explanation, of the activity for the step and
possibly a block example. If the step includes a block example, the editor will restrict the selection of blocks from the toolbox to only those used in the example. The other blocks are still
shown but their selection is disabled during the step. This helps focus the interaction to just the
blocks being described and ensures that the step is completed correctly.

## Tutorial documents

Tutorials are created as documents in the target's document tree, under _/docs/tutorials_. A tutorial with the title '**Light blaster**' would have a path like this: _/docs/tutorials/light-blaster.md_.

When a tutorial is chosen in the editor, the tutorial runner converts the content of the tutorial markdown into user interactions. If selected from the help menu, a tutorial is viewed the same as any other help document.

### ~ hint

**A real example**

Learning by examples? See the source of an actual tutorial: [**getting-started.md**](https://github.com/Microsoft/pxt-microbit/blob/master/docs/tutorials/getting-started.md)

### ~

### The 'Getting Started' tutorial

The 'Getting Started' tutorial is special tutorial that is linked to a **Getting Started** button shown in the **BLOCKS** view of the editor. This tutorial is written to give a simple, first time introduction to using blocks in the editor.

If the editor has the **Getting Started** button (enabled in [pxtarget.json](/targets/pxtarget) with
```"sideDoc": "tutorials/getting-started"```), the tutorial linked to it is retrieved from _/docs/tutorials/getting-started.md_.

### Adding tutorials

You can create other tutorials besides 'Getting Started'. The other tutorial choices show up in the tutorials dialog using an entry in _/docs/tutorials.md_. The entry has these settings:

* **name**: tutorial name
* **imageUrl**: an optional icon image
* **url**: tutorial document path
* **cardType**: set to "tutorial"
* **description**: description of what the tutorial does

Here's an example entry in _tutorials.md_:

````
# Tutorials

## Fun stuff

```codecard
[{
    "name": "Light Blaster",
    "imageUrl":"/static/tutorials/light-blast.png",
    "url": "/tutorials/light-blaster",
    "cardType": "tutorial",
    "description": "Flash all the lights on the pixel strip!"
},{
    // another tutorial...
}]
```
````

The tutorial document tree has this layout:

```
/docs/tutorials.md
/docs/tutorials/getting-started.md
/docs/tutorials/light-blaster.md
...
```

## Format

The tutorial markdown has a format that the guides the tutorial runner in making a sequence of interactions: 

### Title

The title is on the first line and uses a _level 1_ heading, like:

```text
# Light blaster
```

### Steps

A tutorial follows a sequence of simple steps. The runner builds an interaction from each _step_ section. A step begins with a _level 3_ heading (``###``) and can have any text. It's common, though, to use the _Step 1, Step 2,...Step n_ sequence for each heading. Something like:

```text
### Step 1

Instructions for step 1 here...

### Step 2

Instructions for step 2 here...

### Step 3

Instructions for step 3 here...
```

The text in the heading is shown only when the turtorial is viewed as a help page. It's ok to have additional text in the heading. The word 'Step' can even be left out since the tutorial runner will build the list of steps only from the content under the heading tag, ``###``. These are valid headings:

```text
### Step 3: Make a new variable
```

>--or--

```text
### Flash all the LEDs on and off twice
```

The editor automatically parses the markdown and populates the user interface from each step section.

In each step, just the first paragraph is displayed to the user in the tutorial caption. The complete text, block examples, etc. are displayed in the ``hint`` dialog when the user clicks the caption or hint button. If you include code snippets, images or videos, they are shown in the hint view also.

### ~ hint

**Simple, short descriptions**

During an interaction, the first paragraph of the step description is shown in the caption. If the paragraph length goes beyond the display length of caption, a scroll bar appears in order to view the rest of the paragraph. It's best to keep the paragraph short enough to so all of it appears in the caption without requiring the user to scroll to see it all. If your instructions need more text, you can just create an additional step to split up the activity.

### ~

## Example

The following sample shows a simple 2 step tutorial.

````
# Getting started

### Step 1

Welcome! Place the ``||basic:show string||`` block in the ``||basic:on start||`` slot to scroll your name.

```blocks
basic.showString("Micro!")
```

### Step 2

Click ``|Download|`` to transfer your code in your @boardname@!

````

## Translations

Tutorials are translated via [Crowdin](/translate) like any other documentation page.