# Tutorial basics

Tutorials are simply markdown documents with a series of steps to complete a coding activity. The document uses a simple two-level structure where each _level 2_ heading (``##``) is a new step.

When a tutorial is chosen in the editor, the tutorial runner converts the content of the tutorial markdown into user interactions. If selected from the external documentation navigation, the tutorial is viewed the same as any other help document which allows it to be printed.

### ~ hint

#### A real example

See the micro:bit tutorials [**flashing-heart.md**](https://github.com/Microsoft/pxt-microbit/blob/master/docs/projects/flashing-heart.md) and
[**rock-paper-scissors.md**](https://github.com/Microsoft/pxt-microbit/blob/master/docs/projects/rock-paper-scissors.md).

### ~

## Tutorial format

The tutorial markdown has a format that the guides the tutorial runner in making a sequence of interactions. A tutorial has a flow model that is either a simple set of steps or groups of steps placed into activity sections. The tutorial author chooses which type of flow to use by setting a metadata option.

### Title

The title is on the first line and uses a _level 1_ heading.

```markdown
# Light blaster
```

### Steps

A step is where the user views and interacts with the instructions and hints for a tutorial action. The runner builds interactions from each _step_ section.

The step can have any name, but it's common to use the _Step 1, Step 2,...Step n_ sequence for each heading.

```markdown
## Step 1

Instructions for step 1 here...

## Step 2

Instructions for step 2 here...
```

#### Step syntax

The text in the heading is shown only when the tutorial is viewed as a help page. It's ok to have additional text in the heading. The word 'Step' can even be left out since the tutorial runner will build the list of steps only from the content under the heading tag, ``##``. These are valid headings:

```markdown
## Step 3: Make a new variable
```

>--or--

```markdown
## Flash all the LEDs on and off twice
```

The editor automatically parses the markdown and populates the user interface from each step section.

### ~ hint

#### Simple, short descriptions

During an interaction, the step description (all text before the first code block or image) is shown in the caption. If the paragraph length goes beyond the display length of caption, a "More" button appears in order to view the rest of the paragraph. It's best to keep the paragraph short enough to so all of it appears in the caption without requiring the user to click to see it all. If your instructions need more text, you can just create an additional step to split up the activity.

### ~

### Hints

Hints provide additional information and code suggestions to help the user complete the step.
In each step, any text before the first code snippet or image is automatically displayed to the user in the tutorial caption. The remaining text, block examples, etc. are displayed in the ``hint`` dialog when the user clicks the caption or hint button.

### Images

Using images in steps is a simple and powerful way to reinforce concepts and convey ideas. Images can be included as part of step descriptions. You specify an image using the standard markdown format.

```markdown
![Agent building a tower](/static/tutorials/agent-tower.png)
```

A step with and image might have text like this:

```markdown
## Introduction @unplugged

Have the agent build a tower! Make a command to tell it how many levels to build.

![Agent building a tower](/static/tutorials/agent-tower.png)
```

Images appear in steps that have either the [fullscreen](#fullscreen) or [unplugged](#unplugged) modifiers present, or when a step hint is viewed.

Images should be hosted under the ``./docs/static/`` folder path of the editor project's repository files. The relative URL in markdown begins with just ``/static/`` though.

Image formats typically used are PNG, JPEG, and GIF.

### ~ alert

#### Image size considerations

It's important to consider that image size can affect the load time and therefore
impact the experience of the user during a tutorial. Also, images that are too large can consume the viewing area where the tutorial is displayed. Try to economize tutorial images both in file size and dimensionally.
Recommendations for images are:

* **File size**: 1 MB or less
* **Dimensions**: 800 pixels wide or less

### ~

## Step modifiers

To add a special behavior to a step, use a step modifier:

### fullscreen

The ``@fullscreen`` modifier is deprecated, use ``@showhint`` instead.

### showhint

If you want to include a dramatic introduction or make certain that a special message is seen, you can use the ``@showhint`` tag. The section is displayed in an overlay window on top of the tutorial screen and isn't shown in the caption as part of the tutorial flow. You include it in your tutorial like this:

```markdown
# Flash-a-rama

## It's time to code! @showhint

Let's get real bright. We're going to make all the lights flash on your board!

![Flash lights](/static/tutorials/lights-flashing.gif)

## Step 1: Make a new variable

...
```

### unplugged

The ``@unplugged`` modifier is deprecated, use ``@showdialog`` instead.

### showdialog

If you want to display your tutorial step in a dialog and then have it skip to the next step automatically, use ``@showdialog``. This feature is typically used for introductory steps.

```markdown
# Flash-a-rama

## It's time to code! @showdialog

```

## Using blocks

### Hint blocks

If you include blocks in a step, they are shown when the user displays the hint for the step.
The blocks are specified the same as in any other markdown document. During the step interaction, only the blocks inside the ```` ```blocks```` section are available in the categories (drawers) of the Toolbox.

````
## Step 3 - Show the temperature

Get a ``||input:temperature||`` block and place it in the value slot of ``||basic:show number||``.

```blocks
forever(function() {
    basic.showNumber(input.temperature())
    basic.pause(1000)
})
```
````

## Reconfiguring blocks in the toolbox (`blockconfig.local` and `blockconfig.global` sections)

If you want to change the default parameters on an existing block as it appears in the toolbox, use a blockconfig section. A blockconfig contains a JavaScript snippet that defines one or more functions or operations along with their default arguments.

There are two kinds of blockconfig sections: `blockconfig.local` and `blockconfig.global`. The global blockconfig can appear anywhere in the tutorial markdown, and the customizations it contains are applied globally, i.e. to all tutorial steps. Local blockconfigs must appear within a tutorial step, and apply to that step only. Local blockconfigs take precedence over global ones.

### Limitations

* Declaring custom assets is not supported yet. This means you will not be able to set a custom image on sprite creation, for example. We are thinking through how to support this, and it may come in the future!
* `blockconfig.local` sections have a performance impact on the toolbox. They aren't able to take advantage of previously cached toolbox contents and must regenerate it each time.

### Examples

**Set the default background color to green. Apply globally**

````
```blockconfig.global
scene.setBackgroundColor(7)
```
````

**When Player sprite overlaps with Food. Apply to the current tutorial step only**
````
### {Step 3}

```blockconfig.local
sprites.onOverlap(SpriteKind.Player, SpriteKind.Food, function (sprite, otherSprite) {
})
```
````

**When Player sprite overlaps with Food, with embedded code snippet**
````
```blockconfig.global
sprites.onOverlap(SpriteKind.Player, SpriteKind.Food, function (sprite, otherSprite) {
    info.changeScoreBy(1)
})
```
````

**Creating an Enemy sprite**
````
```blockconfig.global
let myEnemy = sprites.create(img``, SpriteKind.Enemy)
```
````

> **Note the empty image.** blockconfigs don't yet work with custom assets (images, tilemaps, etc)!

**Change default sprite position to the center of the screen**
````
```blockconfig.global
let mySprite: Sprite = null
mySprite.setPosition(80, 60)
```
````

> Note here the declaration of `mySprite`. Variables used in the snippet must be declared so the decompiler can resolve the datatypes.

**Place sprite in random location**
````
```blockconfig.global
let mySprite: Sprite = null
mySprite.setPosition(randint(0, scene.screenWidth()), randint(0, scene.screenHeight()))
```
````

**Change random number range**
````
```blockconfig.global
randint(-10, 10)
```
````

**Multiple reconfigured blocks in a single blockconfig**
````
```blockconfig.global
randint(-10, 10)
let mySprite: Sprite = null
mySprite = sprites.create(img``, SpriteKind.Enemy)
mySprite.setPosition(randint(0, scene.screenWidth()), randint(0, scene.screenHeight()))
```
````

### Troubleshooting blockconfigs

If your reconfigured block isn't showing up in the toolbox, look for errors like this one in the debug console:

`Failed to resolve block config for tutorial`

Followed by a more detailed error message. The most common error you're likely to see is:

`Block config decompiled to gray block`

Gray blocks will be generated when not all datatypes are known (e.g. `mySprite` used, but not declared), or when a function name is misspelled.

If you don't see an error message, try adding the `dbg=1` URL parameter and reload. This will output some information about each blockconfig to the console, and should provide a clue about what is failing.


## Code Validation (`validation.local` and `validation.global` sections)

If you want to enable code validation in your tutorial, you can do so by adding a validation section. As with [`blockconfig` above](#reconfiguring-blocks-in-the-toolbox-blockconfiglocal-and-blockconfigglobal-sections), there are two types of sections: `validation.global` and `validation.local`. Global can be anywhere in the markdown and applies to all steps in the tutorial. Local must appear within a specific step, and applies only to that step. Local takes precedence over global.

Within a validation section, you may specify which validators you want to enable and properties for those validators using the same syntax we use for writing Skillmaps (see [skillmap structure](..\skillmaps.md#skillmap-structure)).

### Validators

Currently, only one validator exists for [highlight](/writing-docs/snippets.md#highlight) and [validate-exists](/writing-docs/snippets#validate-exists) blocks, the `BlocksExistValidator`. This validator looks at blocks tagged with `//@validate-exists` or `//@highlight` comments in the answer key and confirms that, for each tagged block, the user's code contains at least one block of the same type. It does *not* validate the parameters passed into the block.

You can specify whether the `BlocksExistValidator` checks for `//@validate-exists` or `//@highlight` using the `markers` property on the validator. If you specify only `validate-exists`, then highlighted blocks will not be validated. Similarly, if you specify only `highlight`, then blocks marked with `validate-exists` will not be checked. By default, both checks are enabled.

The `BlocksExistValidator` also has an `Enabled` property that determines whether or not the validator runs at all. This is `true` by default whenever you specify the validator but can be set to `false` if you wish to disable it on a single step.

### Examples
**Enable the `BlocksExistValidator` globally**
````
```validation.global
# BlocksExistValidator
```
````

**Enable the `BlocksExistValidator` globally and ignore highlighted blocks**  
_Note: highlight is not specified in the markers property._
````
```validation.global
# BlocksExistValidator
* markers: validate-exists
```
````

**Disable the `BlocksExistValidator` on a single step, if it has been enabled globally**
````
```validation.local
# BlocksExistValidator
* Enabled: false
```
````
## Accordion/hidden hints
If you want to provide extra information without having to divert the coder's attention, you can include content in an "accordion" style hint control. 

### ~ hint
If you want your hint to display by default when a step is encountered see [Explicit Hints](/writing-docs/tutorials/control-options#explicit-hints).
### ~

### ~ hint
Nested accordion hints are not currently supported.
### ~

```
~hint This content is hidden until the user clicks here.
  - :blank: Bullet 1
  - :mouse pointer: Bullet 2
hint~
```

## Testing

If you are writing a third-party tutorial, please see the [User Tutorials](/writing-docs/user-tutorials) documentation for information on how to preview and share your tutorials.

When developing your new tutorials, it is easiest to first render and view them as a markdown documentation page until all steps look OK to you. Going through all the steps several times using the tutorial runner might become quite tedious while developing the tutorial.

If you are running the local server, go to ``http://localhost:3232/tutorials`` to render the ``/docs/tutorials.md`` gallery page.

The [pxt checkdocs](/cli/checkdocs) command will compile all the tutorial snippets automatically.

```
pxt checkdocs
```

## Examples

Here are some examples of the tutorial format.

### GitHub Sample

```
https://github.com/microsoft/pxt-tutorial-sample
```

The [pxt-tutorial-sample](https://github.com/microsoft/pxt-tutorial-sample) repository contains a fully-functional tutorial for MakeCode Arcade, with multiple files, localization, and custom blocks in the tutorial repository.

### Markdown Sample

The following sample shows a simple 2 step tutorial.

````markdown
# Getting started

## Introduction @unplugged

Let's get started!

## Step 1 @fullscreen

Welcome! Place the ``||basic:show string||`` block in the ``||basic:on start||`` slot to scroll your name.

```blocks
basic.showString("Micro!")
```

## Step 2

Click ``|Download|`` to transfer your code in your @boardname@!

````

## Dependencies

If your tutorial requires the use of an extension, you can add it using the [package macro](https://makecode.com/writing-docs/macros#dependencies).
