# Control options

Additional options and actions are available to let you add more control and functionality to a tutorial. This is provided by metadata options and other block types

## Metadata options

Tutorial metadata is optionally specified at the top of the document. Metadata is defined as key-value pairs, in the form: ``### @KEY VALUE``.

### Explicit hints

If you want the hints to display by default when each step is encountered, specify **@explicitHints** in the metadata at the top of the tutorial page. The default is ``false`` making hints hidden but available for each step.

```
### @explicitHints true
```

### Flyout blocks

To have all of the available blocks in a permanently visible flyout instead of the toolbox, use **@flyoutOnly**. The default setting is ``false``.

```
### @flyoutOnly true
```

### Hide iteration

This hides the step controls. Thats includes the previous, next, and exit tutorial buttons, as well as the step counter in the menu bar. The default is ``false``.

```
### @hideIteration true
```

### Diffs

You can have differences in code between the current step hint and the previous step hint. This is done by specifying **@diffs** in the metadata. The default is ``false``.

```
### @diffs true
```

## Special blocks

### Templates

If you want to provide the tutorial user with some existing code to use as a starting point, you can include a template block. The code in the template will appear on the Workspace when the at the start of the tutorial.

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

You can include **1** template anywhere in the tutorial.

### Ghost blocks

When a step from a tutorial is loaded, the Toolbox contains the just the blocks from the snippet to allow the user to complete the step as intended. If you want to give the user additional blocks beyond those in the hint snippet, you can include _ghost_ blocks in for the step. These blocks appear in the Toolbox but not in the hint snippet.

In this example, the hint snippet shows a pattern on the LEDs. Using an icon will give the same result so the **showIcon** block is available in the Toolbox if the user wants to us it instead.

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
