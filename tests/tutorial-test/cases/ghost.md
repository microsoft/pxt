```ghost
basic.forever(() => {
    basic.showIcon(IconNames.Yes);
});
```

# Ghost blocks

### @diffs false
## Step 1 @fullscreen

Ghost blocks do not show up in the tutorial, but display in the workspace.

## Step 2

Multiple ghost sections can be included in one tutorial

```blocks
basic.showString("Hello")
```


```ghost
basic.forever(function() {
    basic.showLeds(`
        . # . # .
        # # # # #
        # # # # #
        . # # # .
        . . # . .`);
})

```

```ghost
input.onButtonPressed(Button.A, () => {
    radio.sendNumber(0)
})

```