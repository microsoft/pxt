# Control options

Additional options and actions are available to let you add more control and functionality to a tutorial. This is provided by metadata options and other block types

## Metadata options

Tutorial metadata is optionally specified at the top of the document. Metadata is defined as key-value pairs, in the form: ``### @KEY VALUE``.

### Explicit hints

If you want the hints to display by default when each step is encountered, specify **@explicitHints** in the metadata at the top of the tutorial page. The default is ``false`` making hints hidden but available for each step.

```
### @explicitHints true
```

### Preferred editor view

### ~reminder

#### Asset editing support

Support for this option is only available in [Microsoft MakeCode Arcade](https://arcade.makecode.com).

### ~

Typically, when a tutorial starts the default editor view, it's for editing code in the language specified for the tutorial. If your tutorial has steps for creating assets (tilemaps, images, tiles, or animations) when the tutorial begins, you can have the Asset Editor displayed instead of the Blocks or Code editors. You specify this with the **@preferredEditor** option using the ``asset`` setting.

```
### @preferredEditor asset
```

### Unified toolbox

To have all of the available blocks grouped in a permanently visible flyout (instead of the toolbox), use **@unifiedToolbox**. The default setting is ``false``.

```
### @unifiedToolbox true
```

### Flyout blocks (deprecated)

This flag is deprecated. Use `unifiedToolbox` instead.

```
### @flyoutOnly true
```

### Hide iteration

This hides the step controls. Thats includes the previous, next, and exit tutorial buttons, as well as the step counter in the menu bar. The default is ``false``.

```
### @hideIteration true
```

### Diffs

You can highlight the differences in code between the current step hint and the previous step hint. This is done by specifying **@diffs** in the metadata. The default is ``false``.

```
### @diffs true
```

### Hide Toolbox

For text-based tutorials, you can choose to hide the toolbox altogether. This is done by specifying **@hideToolbox** in the metadata. The default is ``false``.

```
### @hideToolbox true
```

### Hide Done

If you do not wish for your tutorial's final step to display a "Done" button, which sends the user back to the main editor, you can hide it by specifying **@hideDone** in the metadata. The default is ``false``.

```
### @hideDone true
```

## Special blocks

### Templates

If you want to provide the tutorial user with some existing code to use as a starting point, you can include a template block. The code in the template will appear on the Workspace at the start of the tutorial.

This template example gives some initial code as a starting point for making a game program.

````
```template
controller.A.onEvent(ControllerButtonEvent.Pressed, function () {

})
scene.setBackgroundColor(9)
let mySprite = sprites.create(img`
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .

    `, SpriteKind.Player)
game.onUpdateInterval(1000, function () {

})
```
````

For a "blank" template that only contains the `on start` block (in targets like Minecraft, which has two default blocks on the workspace) simply make a template block with an empty comment:

````
```template
//
```
````

You can include **1** template in a tutorial. Place the template section either at the beginning of the document or at the end so as to not clutter the sequence of tutorial steps.

If you're writing a Python tutorial, you should use **python-template** in place of **template** to provide the user with starter code.

### Ghost blocks

When a step from a tutorial is loaded, the Toolbox contains the only the blocks from the snippet to allow the user to complete the step as intended. If you want to give the user additional blocks beyond those in the hint snippet, you can include _ghost_ blocks in for the step. These blocks appear in the Toolbox but not in the hint snippet.

In this example, the hint snippet shows a pattern on the LEDs. Using an icon will give the same result so the **showIcon** block is available in the Toolbox as an option if the user wants to use it instead.

````
## Step 3 - Show your name

Place a block in to show a heart on the LEDs when button **A** is pressed.

```blocks
input.onButtonPressed(Button.A, function () {
    basic.showLeds(`
        . # . # .
        # # # # #
        # # # # #
        . # # # .
        . . # . .
        `)
})
```

```ghost
basic.showIcon(IconNames.Heart)
```
````

### Custom code

If you want to load existing code into a tutorial but have it hidden from the user, you can include a `customts` block. The code in the snippet will **not** appear on the Workspace and will **not** show up in the Toolbox.

This can be used to add starter code that the user does not need to see and should not have to modify. It's a good idea to add this code inside a custom namespace, to avoid inadvertent errors in user code.

````
```customts
namespace camera {
    let camera = sprites.create(image.create(16, 16), SpriteKind.Player)
    controller.moveSprite(camera)
    camera.setFlag(SpriteFlag.Invisible, true)
    scene.cameraFollowSprite(camera)
}
```
````

## URL Parameters

### Locked Editor

In some scenarios, you may want to "lock" a student in a tutorial. Locked editor mode disables the Home and Exit Tutorial buttons and hides the Finish button at the end of the tutorial. The user will not be able to access the homescreen or full sandbox mode.

You can enable locked editor mode by launching the tutorial directly using a URL and including the `&lockedEditor=1` parameter:

`https://arcade.makecode.com/?lockedEditor=1#tutorial:/tutorials/chicken-rain`
