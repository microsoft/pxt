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

**Example:** the [blink lesson](https://makecode.microbit.org/lessons/blink/activity)
and it's [markdown](https://github.com/Microsoft/pxt-microbit/blob/master/docs/lessons/blink/activity.md) source.

## Inline button rendering

Use ``` ``|primary button|`` ``` or ``` ``||secondary button||`` ``` to render a button like element.


## Inline code snippets

If an inline code snippet start with `[` and ends with `]`, the doc engine will try to render it as a block. It must contain a valid API call
to the desired block.

To change the inline code snippet color to reflect the namespace color, use this format:

```
``|namespace.block name|``
```

## Code snippets

To avoid changing screenshots, PXT automatically renders code snippets to blocks or javascript. This is done by specifying a language on code blocks.

### dependencies

You need declare the packages required to load your snippet, unless they are part of the default empty template.
Simple provide a list of package name using the ``package`` macro.

    ```package
    microbit-devices
    microbit-bluetooth
    ```

### features

You can specify required "features" for a given documentation page. In the case of a multi-board editor,
MakeCode will match the feature set with existing boards.

    ```config
    feature=pinsled
    feature=pinsd1
    ```

### blocks

The **blocks** language renders a JavaScript snippet into blocks and provide a simulator if needed.

    ```blocks
    basic.showNumber(5)
    ```

**Example:** the [forever](https://makecode.microbit.org/reference/basic/forever) reference doc
and it's [markdown](https://github.com/Microsoft/pxt-microbit/blob/master/docs/reference/basic/forever.md) source.

### project

The **project** language is similar to blocks but renders a published project.

    ```project
    twejlyucio
    ```

### sig

The **sig** displays a signature of the first function call in the snippet.

    ```sig
    basic.showNumber(5)
    ```

**Example:** the [forever](https://makecode.microbit.org/reference/basic/forever) reference doc
and it's [markdown](https://github.com/Microsoft/pxt-microbit/blob/master/docs/reference/basic/forever.md) source.

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

**Example:** the [basic](https://makecode.micorbit.org/reference/basic) reference doc
and it's [markdown](https://github.com/Microsoft/pxt-microbit/blob/master/docs/reference/basic.md) source.

### namespaces

The **namespaces** language display a code card for the first symbol of each namespace.

    ```namespaces
    basic.showNumber(0);
    input.onButtonPressed(() => {});
    ```

**Example:** the [reference](https://makecode.microbit.org/reference) namespaces doc
and it's [markdown](https://github.com/Microsoft/pxt-microbit/blob/master/docs/reference.md) source.

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

### spy

If your editor support Static Python, you can specify a TypeScript snippet to be rendered as Static Python
using the ``spy`` macro.

    ```spy
    let x = 0;
    ```


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
    // You can include illegal TS in here, e.g. to showcase concepts/psuedocode 
    for (initialization; check; update) {
        ...
    }
    ```

### invalid

You can use `typescript-invalid` to showcase typescript that is **incorrect**:

    ```typescript-invalid
    // You can include illegal TS in here, e.g. to document syntax errors
    callFunction(;
    ```

### valid

You can use `typescript-valid` to showcase typescript that is **correct**:

    ```typescript-valid
    // You can include any TS in here, e.g. to showcase correct syntax
    callFunction();
    ```
