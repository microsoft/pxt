# Writing Docs

PXT allows to bundle documentation as [markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet) pages
with some additional macros to help with widget formatting.

## File structure

PXT assumes that the documentation is located under the ``/docs`` folder. The web site routing follows the file structure:

```
/about -> /docs/about.md
/reference/math -> /docs/reference/math.md
```

Static assets such as picture can be placed under the ``/docs/static`` folder.

## Macros

The following macros are custom extensions to markdown.

### avatar

    ```
    ### ~avatar [class]

    [content]

    ### ~
    ```
    
See [blink lesson](https://m.pxt.io/lessons/blink/activity) 
and the [markdown source](https://github.com/Microsoft/pxt-microbit/blob/master/docs/lessons/blink/activity.md).
    

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
See [forever docs](https://m.pxt.io/reference/basic/show-string) 
and the [markdown source](https://github.com/Microsoft/pxt-microbit/blob/master/docs/reference/basic/forever.md).

### sig

The **sig** displays a signature of the first function call in the snippet.

    ```sig
    basic.showNumber(5)
    ```

See [forever docs](https://m.pxt.io/reference/basic/show-string) 
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
    ````
    
### namespaces

The **namespaces** language display a code card for the first symbol of each namespace.    

    ```namespaces
    basic.showNumber(0);
    input.onButtonPressed(() => {});
    ````
See [basic namespace docs](https://m.pxt.io/reference) 
and the [markdown source](https://github.com/Microsoft/pxt-microbit/blob/master/docs/reference.md).

### block

The **block** language renders a JavaScript snippet into blocks without any simulator.

    ```block
    basic.showNumber(5)
    ```

### javascript

If you need a rendering of typescript, javascript code, do not specify the language

    ```
    let x = 0;
    ```

### shuffle

The **shuffle** macro shuffles the blocks from a program which makes for a great student activity.

    ```shuffle
    basic.showNumber(5)
    ```

See [basic namespace docs](https://m.pxt.io/reference/basic) 
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
  
