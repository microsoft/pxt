# Snippets

MakeCode has its own markdown extensions providing a variety of options for rendering code in text and in
block format. These generally work across tutorials and document pages, but not always!

## Text Formatting

Extending formatting options allow styling for buttons and block names.

| **Snippet**            | **Tutorial** | **Docs Page** | **Sim (Docs)** |
|--------------------|:--------:|:---------:|:----------------:|
| inline button      |     ✔️    |     ✔️     |                  |
| namespace coloring |     ✔️    |     ✔️     |                  |
| highlight          |     ✔️    |     ✔️     |                  ||

### Inline button rendering

Use inline buttons to render a ``|button like element|`` in line with text. These aren't
linked to any action, they simply display like buttons. These may be formatted as primary
or ``||secondary buttons||``.

```
``|primary button|``

``||secondary button||``
```

### Namespace coloring

Buttons can be colored using a namespace identifier along with the button text. The color associated with code namespace
(toolbox category color) is applied to the text background in the button. This is
often used in tutorials as a shorthand for blocks, eg ``||loops:repeat 4 times||``. Use
the namespace name separated with a ``:``.

```
``||loops:repeat 4 times||``
```

### highlight

Although used in snippets, the renderer will higlight the next line of code or block following a comment containing
**@highlight**. Use `// @highlight` in blocks and TypeScript, and `# @highlight`
in Python.

````
```blocks
console.log(":)")
// @highlight
console.log(":(")
```
````

## Language Snippets

To avoid using screenshots for code (which often needed updating) PXT automatically renders code snippets to blocks,
javascript, or python. This is done by specifying a pseudo-language on a code section.

| **Snippet**            | **Tutorial** | **Docs Page** | **Sim (Docs)** |
|--------------------|:--------:|:---------:|:----------------:|
| blocks             |     ✔️    |     ✔️     |         ✔️        |
| block              |     ✔️    |     ✔️     |                  |
| typescript         |     ✔️    |     ✔️     |         ✔️        |
| typescript-invalid |          |     ✔️     |                  |
| typescript-valid   |          |     ✔️     |                  |
| spy                |     ✔️    |     ✔️     |         ✔️        |
| python             |     ✔️    |     ✔️     |         ✔️        |
| ghost              |     ✔️    |           |                  |
| template           |     ✔️    |           |                  |
| customts           |     ✔️    |           |                  ||

### blocks

The **blocks** snippet renders a JavaScript snippet into blocks, wrapping floating
blocks into an ``||loops:on start||`` block. In **docs** it also provides a simulator
and options to view the snippet in JavaScript or Python.

```blocks
let count = 0
for (let i = 0; i < 4; i++) {
    count += 1
}
```

    ```blocks
    let count = 0
    for (let i = 0; i < 4; i++) {
        count += 1
    }
    ```

### block

The **block** snippet renders a JavaScript snippet into blocks without any simulator
and does not wrap floating blocks in the "on start".

    ```block
    basic.showNumber(5)
    ```

### typescript

If you need a rendering of JavaScript or TypeScript code use ``typescript``. In **docs**
it also provides a simulator.

    ```typescript
    let x = 0
    ```

### typescript-invalid (docs only)

This will showcase an **incorrect** code snippet, rendering it on a red background:

    ```typescript-invalid
    // You can include illegal TS in here, e.g. to document syntax errors
    callFunction(;
    ```

### typescript-valid (docs only)

This will showcase a **correct** code snippet, rendering it on a green background:

    ```typescript-valid
    // You can include any TS in here, e.g. to showcase correct syntax
    callFunction()
    ```

### spy

If your editor supports [Static Python](/js/python), you can specify a TypeScript
snippet to be rendered as Static Python using the ``spy`` macro. In **docs** it
also provides a simulator and options to view the code in TypeScript.

    ```spy
    let x = 0
    ```

See [Multi-language Tutorials](/writing-docs/tutorials/multi-lang) for more
information on using ``spy`` to author Python and TypeScript tutorials.

### python

Snippets can also be specified directly in Static Python, and will be rendered
with syntax highlighting and in **docs**, a simulator.

    ```python
    x = 0
    for i in range(4):
        x += i
    ```

### ghost (tutorial only)

The **ghost** snippet causes addtional blocks to appear in the Toolbox during
a tutorial step. This is used to provide additional block choices other than
those matching the code snippet in a **blocks** section. The **ghost** blocks
don't render but serve to identify other blocks to add to the Toolbox choices.

    ```ghost
    let x = 0
    ```

### template (tutorial only)

The **template** "language" is used to specify the initial code that appears
in the workspace at the start of a tutorial. If there is no **template** block
present in the tutorial, the default "new project" code will be used.

    ```template
    let x = 0
    ```

### customts (tutorial only)

If you want to load existing code into a tutorial but have it hidden from
the user, you can include a `customts` block. The code in the snippet will
**not** appear on the Workspace and will **not** show up in the Toolbox.

    ```customts
    namespace camera {
        let camera = sprites.create(image.create(16, 16), SpriteKind.Player)
        controller.moveSprite(camera)
        camera.setFlag(SpriteFlag.Invisible, true)
        scene.cameraFollowSprite(camera)
    }
    ```

### ignore #ignore

Append `-ignore` to any of the above to ignore a snippet in automated testing:

    ```typescript-ignore
    // You can include illegal TS in here, e.g. to showcase concepts/psuedocode
    for (initialization; check; update) {
        ...
    }
    ```

## Diffs

You can use diffs to highlight important changes in large chunks of code.

| **Snippet**            | **Tutorial** | **Docs Page** | **Sim (Docs)** |
|--------------------|:--------:|:---------:|:----------------:|
| diff               |     ✔️    |     ✔️     |                  |
| diffblocks         |     ✔️    |     ✔️     |                  |
| diffspy            |     ✔️    |           |                  ||

### ~ hint

#### Diffs in tutorials

In tutorials MakeCode can render a diff between each typescript or spy snippet.
To reset the diff on a step, use the ``@resetDiff`` metadata.

Use ``### @diffs true/false`` to enable/disable diffs for the entire tutorial.

### ~

### diff

Render a diff between two JavaScript snippets. The snippet consists of two text
section separated by a line of ``-`` (at least 10).

    ```diff
    let x = 1
    ----------
    let x = 1
    let y = 1
    ```

### ~ hint

#### Trailing semicolons

Avoid using trailing ``;`` in your JavaScript snippets.

### ~

### diffblocks

Render a diff of blocks between two JavaScript snippets. The snippet consists
of two text section separated by a line of ``-`` (at least 10).

    ```diffblocks
    let x = 1
    ----------
    let x = 1
    let y = 1
    ```

### diffspy (tutorial only)

Render a diff of blocks between two JavaScript snippets. The snippet consists
of two text section separated by a line of ``-`` (at least 10), and will render
in blocks, JavaScript, or Python, depending on the tutorial's preferred
editor language.


    ```diffspy
    let x = 1
    ----------
    let x = 1
    let y = 1
    ```

## Resources

For certain targets, a tutorial or docs page may require more complex resources
(images, tilemaps) to be included in the markdown. The preferred way to do this
is using the `assetjson` snippet, though older files with `jres` snippets will
also render. See the [Adding Resources](/writing-docs/tutorials/resources)
page for more.

| **Snippet**            | **Tutorial** | **Docs Page** | **Sim (Docs)** |
|--------------------|:--------:|:---------:|:----------------:|
| assetjson          |     ✔️    |     ✔️     |                  |
| jres               |     ✔️    |     ✔️     |                  ||

## Configuration

Additional configuration for a tutorial or documentation page can come in the
form of extensions or required features.

| **Snippet**            | **Tutorial** | **Docs Page** | **Sim (Docs)** |
|--------------------|:--------:|:---------:|:----------------:|
| package            |     ✔️    |     ✔️     |                  |
| config             |          |     ✔️     |                  ||

### package

If any snippet on a page uses blocks that are not included in the default
toolbox (that is, extension blocks) you will need declare the required
packages. Simply provide a list of name using the ``package`` macro.

The package listed last in the example below is hosted in a separate GitHub
repository. You can find this in the ``Project Settings`` / ``pxt.json`` file,
listed under ``dependencies``. Notice that it lists the exact version to use;
this isn't required (that is, you can leave off the `#v0.6.12`), but it is
highly recommended so that future changes to the extension don't break your
tutorial.

    ```package
    devices
    bluetooth
    neopixel=github:microsoft/pxt-neopixel#v0.6.12
    ```

### config

You can specify required "features" for a given documentation page. In the
case of a multi-board editor, MakeCode will match the feature set with existing boards.

    ```config
    feature=pinsled
    feature=pinsd1
    ```

## Code Cards (docs only)

On docs pages, there are a number of different ways to render code cards.

| **Snippet**            | **Tutorial** | **Docs Page** | **Sim (Docs)** |
|--------------------|:--------:|:---------:|:----------------:|
| cards              |          |     ✔️     |                  |
| namespaces         |          |     ✔️     |                  |
| apis               |          |     ✔️     |                  |
| codecard           |          |     ✔️     |                  ||


### cards

The **cards** "language" displays a code card for each function call.

    ```cards
    basic.showNumber(0)
    basic.showLeds(`
    . . . . .
    . . . . .
    . . # . .
    . . . . .
    . . . . .
    `)
    basic.showString("Hello!")
    basic.clearScreen()
    ```

**Example:** the [basic](https://makecode.micorbit.org/reference/basic) reference doc
and it's [markdown](https://github.com/Microsoft/pxt-microbit/blob/master/docs/reference/basic.md) source.

### namespaces

The **namespaces** "language" displays a code card for the first symbol of each namespace.

    ```namespaces
    basic.showNumber(0)
    input.onButtonPressed(() => {})
    ```

**Example:** the [reference](https://makecode.microbit.org/reference) namespaces doc
and it's [markdown](https://github.com/Microsoft/pxt-microbit/blob/master/docs/reference.md) source.

### apis

Render all blocks from a given set of namespaces as code cards.

    ```apis
    basic
    ```

### codecard

To render one or more code cards as JSON into cards, use **codecard**.

    ```codecard
    [{
        "name": "A card",
        "url": "...."
    }, {
        "name": "Another card",
        "url": "...."
    }]
    ```

Code cards also support a text based format:

    ### ~ codecard
    * name: A card
    * url: ...
    ---
    * name: Another card
    * url: ...
    ---
    * name: Yet another card
    * url: ...
    ### ~

where each card is a sequence of ``KEY: VALUE`` pairs bullet points separated by a ``---`` line.

If you need to specify ``otherActions``, add multiple line of ``otherAction`` (singular)
with a ``URL, EDITOR, CARD_TYPE`` format.

    ### ~ codecard
    ...
    ---
    * name: Yet another card
    * url: ...
    * otherAction: URL, js, example
    * otherAction: URL, py, example
    ### ~

## Special (docs only)

Some additional snippets for documentation pages provide the ability to render
a simulator, the code of a project, or a block in-line with some text.

| **Snippet**            | **Tutorial** | **Docs Page** | **Sim (Docs)** |
|--------------------|:--------:|:---------:|:----------------:|
| inline block       |          |     ✔️     |                  |
| project            |          |     ✔️     |                  |
| sig                |          |     ✔️     |                  |
| sim                |          |     ✔️     |                ||

## Inline code snippets

If an inline code snippet start with `[` and ends with `]`, the doc engine will
try to render it as a block. If the renderer finds a documentation page matching
this API call, it will also make the block a hyperlink.

Generally these snippets can only be one line of code, but a variable block can
be included like: ``[let myNum: number = null; pause(myNum)]``

```
``[let myNum: number = null; pause(myNum)]``

``[let txt = "text"]``
```

### project

The **project** snippet takes the URL of a shared project and renders the code, in
blocks, of that entire project.

    ```project
    https://makecode.com/_h5A28L06PWxd
    ```

### sig

The **sig** snippet displays a signature of the first function call in the snippet,
rendering it in blocks, JavaScript, and Python.

    ```sig
    basic.showNumber(5)
    ```

**Example:** the [forever](https://makecode.microbit.org/reference/basic/forever) reference doc
and it's [markdown](https://github.com/Microsoft/pxt-microbit/blob/master/docs/reference/basic/forever.md) source.

### sim

The **sim** snippet takes a chunk of JavaScript code and renders a simulator
running this code.

**Example:** the [Lemonade City](https://arcade.makecode.com/courses/csintro4/data/lemonade) game in the
CS Intro curriculum, and its [markdown](https://github.com/microsoft/pxt-arcade/blob/master/docs/courses/csintro4/data/lemonade.md) source.

## Testing MakeCode Markdown

To test a documentation page locally you must have a development environment
set up and be able to run `pxt serve`. Once you have that, simply load the
relative path to your page **after** the `/docs/` folder:

    http://localhost:3232/tutorials/chase-the-pizza.md

To test a tutorial locally, we highly recommend you use the
[**Tutorial Tool**](https://makecode.com/tutorial-tool).

## Reference

* [Macros](/writing-docs/macros)
* [Writing Tutorials](/writing-docs/tutorials)
* [User Tutorials](/writing-docs/user-tutorials)
* [Skillmaps](/writing-docs/skillmaps)
