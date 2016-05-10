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

## Code snippets

To avoid screenshot hell, PXT automatically renders code snippets to blocks or javascript. This is done by specifying a language on code blocks.

### blocks

The **blocks** language renders a JavaScript snippet into blocks and provide a simulator if needed.

    ```blocks
    basic.showNumber(5)
    ```
See [forever docs](https://codemicrobit.com/reference/basic/show-string) 
and the [markdown source](https://github.com/Microsoft/pxt-microbit/blob/master/docs/reference/basic/forever.md).

### sig

The **sig** displays a signature of the first function call in the snippet.

    ```sig
    basic.showNumber(5)
    ```

See [forever docs](https://codemicrobit.com/reference/basic/show-string) 
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

### shuffle

The **shuffle** macro shuffles the blocks from a program which makes for a great student activity.

    ```shuffle
    basic.showNumber(5)
    ```

See [basic namespace docs](https://codemicrobit.com/reference/basic) 
and the [markdown source](https://github.com/Microsoft/pxt-microbit/blob/master/docs/reference/basic).
