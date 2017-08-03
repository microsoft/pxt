# Macros

The following macros are custom extensions to markdown.

## Checkboxes in bullet points

Use ``* [ ]`` to create a bullet point with a square and ``* [x]`` for a checked bullet point

* [ ] unchecked bullet point
* [x] checked bullet point
* a regular bullet point

## avatar

```
### ~avatar [class]

[content]

### ~
```
    
See [blink lesson](https://makecode.com/lessons/blink/activity) 
and the [markdown source](https://github.com/Microsoft/pxt-microbit/blob/master/docs/lessons/blink/activity.md).

## Inline button rendering

Use ``` ``|primary button|`` ``` or ``` ``||secondary button||`` ``` to render a button like element.


## Inline code snippets

If an inline code snippet start with `[` and ends with `]`, the doc engine will try to render it as a block. It must contains a value API call 
to the desired block.

## Code snippets

To avoid screenshot hell, PXT automatically renders code snippets to blocks or javascript. This is done by specifying a language on code blocks.

### dependencies

You need declare the packages required to load your snippet, unless they are part of the default empty template. 
Simple provide a list of package name using the ``package`` macro.

    ```package
    microbit-devices
    microbit-bluetooth
    ```

### blocks

The **blocks** language renders a JavaScript snippet into blocks and provide a simulator if needed.

    ```blocks
    basic.showNumber(5)
    ```

See [forever docs](https://makecode.microbit.org/reference/basic/show-string) 
and the [markdown source](https://github.com/Microsoft/pxt-microbit/blob/master/docs/reference/basic/forever.md).

### project

The **project** language is similar to blocks but render a published project.

    ```project
    twejlyucio
    ```

### sig

The **sig** displays a signature of the first function call in the snippet.

    ```sig
    basic.showNumber(5)
    ```

See [forever docs](https://makecode.com/reference/basic/show-string) 
and the [markdown source](https://github.com/Microsoft/pxt-microbit/blob/master/docs/reference/basic/forever.md).

### cards

The **cards** language displays a code card for each function call.

    ```cards
    basic.showNumber(0);
    basic.showLeds(`
    . . . . .
    . . . . .
    . . # . .
    . . . . .
    . . . . .
    `);
    basic.showString("Hello!");
    basic.clearScreen();
    ```
    
### namespaces

The **namespaces** language display a code card for the first symbol of each namespace.    

    ```namespaces
    basic.showNumber(0);
    input.onButtonPressed(() => {});
    ```

See [basic namespace docs](https://makecode.microbit.org/reference) 
and the [markdown source](https://github.com/Microsoft/pxt-microbit/blob/master/docs/reference.md).

### block

The **block** language renders a JavaScript snippet into blocks without any simulator.

    ```block
    basic.showNumber(5)
    ```

### javascript

If you need a rendering of typescript, javascript code, specify the language as typescript

    ```typescript
    let x = 0;
    ```

### shuffle

The **shuffle** macro shuffles the blocks from a program which makes for a great student activity.

    ```shuffle
    basic.showNumber(5)
    ```

See [basic namespace docs](https://makecode.com/reference/basic) 
and the [markdown source](https://github.com/Microsoft/pxt-microbit/blob/master/docs/reference/basic.md).

### codecard

Renders one or more codecards as JSON into cards

    ```codecard
    [{ 
        "title": "A card", 
        "url": "...." 
    }, {
        "title": "Another card", 
        "url": "...." 
    }]
    ```
  
### ignore #ignore

Append `-ignore` to any of the above to ignore a snippet in automated testing:

    ```typescript-ignore
    // You can include illegal TS in here, e.g. to document syntax errors
    callFunction(;
    ```
