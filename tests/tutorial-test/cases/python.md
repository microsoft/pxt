# Native python

### @diffs false
## Step 1 @fullscreen

Tutorials can be written with code in Python.
```python
basic.show_string("Hello")
```

## Step 2

Show some LEDs

```python
basic.forever(function() {
    basic.show_leds(`
        . # . # .
        # # # # #
        # # # # #
        . # # # .
        . . # . .`);
})

```