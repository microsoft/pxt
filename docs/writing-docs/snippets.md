# Snippets

MakeCode has its own markdown "code syntax" extensions providing a variety of options for rendering code in text and in
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

If the user clicks on the resulting button, it will toggle the toolbox for the given namespace.

If you have a need for a button to appear one color but open a different category,
you can add the namespace it should open in parentheses after the normal one

```
``||variables(sprites):set mySprite to||``
```

This will appear in tutorials as the `variables` category, but clicking it will toggle the `sprites` category.

### validate-exists

The ``@validate-exists`` tag marks the code block following it as subject to validation. This means that, when [code validation](/writing-docs/tutorials/basics.md#code-validation-validationlocal-and-validationglobal-sections) is enabled in a tutorial, the user is warned that their code isn't matching a block that the tutorial intended.

 Use `// @validate-exists` in blocks and TypeScript, and `# @validate-exists`
in Python.

````
```blocks
// @validate-exists
basic.showString("HELLO!")
```
````

### highlight

When used in snippets, the renderer will higlight the next line of code or block following a comment containing
**@highlight**. Use `// @highlight` in blocks and TypeScript, and `# @highlight`
in Python.

Another feature of **@highlight**, like with **@validate-exists**, is that the highlighted block is also validated when [code validation](/writing-docs/tutorials/basics.md#code-validation-validationlocal-and-validationglobal-sections) is enabled.

````
```blocks
console.log(":)")
// @highlight
console.log(":(")
```
````

### hide

When used in snippets that produce an image of blocks, the renderer will remove the code or block following the a
comment containing **@hide**. Use `// @hide` in blocks and TypeScript, and `# @hide` in Python.

This will most often be useful when hiding set up code - e.g. a variable or function declaration.

````
```blocks
// @hide
function myCoolFunction() {

}

// @hide
let mySprite = sprites.create(img`1`);

mySprite.x += 50;
myCoolFunction();
```
````

### collapsed

When used in snippets, the following function or event will show up collapsed in the hint. This
can also be used in template code in order to have code start off collapsed in the user's workspace,
in case there is code that should exist but not be focused on immediately, or that you will call out in subsequent steps.

````
```blocks
// @collapsed
function myCoolFunction() {
    console.log("this");
    console.log("is");
    console.log("a");
    console.log("really");
    console.log("long");
    console.log("function");
}

// @collapsed
game.onUpdate(() => {
    console.log("this");
    console.log("is");
    console.log("a");
    console.log("really");
    console.log("long");
    console.log("event");
})

myCoolFunction();
```
````

## Language Snippets

To avoid using screenshots for code (which often needed updating), PXT automatically renders code snippets to blocks,
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

The **blocks** snippet renders a JavaScript snippet into blocks. Blocks not contained in loop or function
(floating blocks) are wrapped into an ``||loops:on start||`` block. When viewed in **docs**, a simulator to
run the snippet in the current page is provided and there are tabbed options to view the snippet in JavaScript or Python.

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

The **block** snippet renders a JavaScript snippet into blocks in a standalone view without any simulator
and floating blocks are not contained in the "on start" block.

    ```block
    basic.showNumber(5)
    ```

### typescript

If you want a text rendering of JavaScript or TypeScript code use ``typescript``. In the **docs**
view it also includes an embedded simulator to run the snippets in the current page.

    ```typescript
    let x = 0
    ```

### typescript-invalid (docs only)

This option will let you "showcase" an **incorrect** code snippet, rendering the invalid code on a red background:

    ```typescript-invalid
    // You can include illegal TS in here, e.g. to document syntax errors
    callFunction(;
    ```

### typescript-valid (docs only)

This lets you make special a note of a **correct** code snippet, rendering it on a green background:

    ```typescript-valid
    // You can include any TS in here, e.g. to showcase correct syntax
    callFunction()
    ```

### spy

If your editor supports [Static Python](/js/python), you can specify a TypeScript
snippet in the ``spy`` macro and it will be rendered as Static Python instead. In the **docs** view
it also includes an embedded simulator and options to view the code in TypeScript.

    ```spy
    let x = 0
    ```

See [Multi-language Tutorials](/writing-docs/tutorials/multi-lang) for more
information on using ``spy`` to author Python and TypeScript tutorials.

### python

You can specify a Static Python directly too, and will be rendered
with syntax highlighting. In the **docs** view, an embedded simulator is included to
run the snippet in the same page.

    ```python
    x = 0
    for i in range(4):
        x += i
    ```

### ghost (tutorials only)

The **ghost** snippet will have addtional blocks to appear in the Toolbox during
a tutorial step. This is used to provide additional block choices other than
those exactly matching the code snippet in a **blocks** section. The **ghost** blocks
don't render any code but serve to identify other blocks to add into the Toolbox choices.

    ```ghost
    let x = 0
    ```

### template (tutorials only)

A **template** is used to specify some initial code that appears
in the workspace at the start of a tutorial. This provides starting code for a
user when needed to reduce the length or complexity of the tutorial. If there
is no **template** block present in the tutorial, the default "new project" code will be used.

    ```template
    let x = 0
    ```

### customts (tutorials only)

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

Append `-ignore` to any of the above snippet types to bypass automated testing for
the code in the snippet. This let's you use a snippet for descriptive purposes but
have it excluded from any validation checks.

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

In tutorials MakeCode can render a diff between each typescript or spy snippet between
the current and previous step.
To reset the diff on a step, use the ``@resetDiff`` metadata.

Use ``### @diffs true`` or ``### @diffs false`` at the beginning of the tutorial to
enable/disable diffs for the entire tutorial.

### ~

### diff

Render a diff between two JavaScript snippets. To show diff snippet, include both the previous
and current code sections separated by a line of ``-`` characters (use at least 10).

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

Render a diff of two JavaScript snippets as blocks. To show a diff of blocks, include both the previous
and current code sections separated by a line of ``-`` characters (use at least 10).

    ```diffblocks
    let x = 1
    ----------
    let x = 1
    let y = 1
    ```

### diffspy (tutorial only)

Render a diff of blocks between two JavaScript snippets. The snippet consists
of two code sections separated by a line of ``-`` characters (at least 10), and will render
in blocks, JavaScript, or Python, depending on the tutorial's preferred editor language.

    ```diffspy
    let x = 1
    ----------
    let x = 1
    let y = 1
    ```

## Resources

For certain MakeCode targets (such as MakeCode Arcade), a tutorial or docs page may require more
complex resources (images, tilemaps) to be included in the markdown. The preferred way to do this
is using the `assetjson` snippet. See the [Adding Resources](/writing-docs/tutorials/resources)
page for more.

### ~ hint

#### jres resoures

The older `jres` format was previously used to include tile resources. Although older files with `jres` snippets will
still render, the `assetjson` is the preferred resource format.

### ~

| **Section**            | **Tutorial** | **Docs Page** | **Sim (Docs)** |
|--------------------|:--------:|:---------:|:----------------:|
| assetjson          |     ✔️    |     ✔️     |                  |
| jres               |     ✔️    |     ✔️     |                  ||

## Configuration

Additional configuration information can be specified for extensions or other required features.

| **Section**            | **Tutorial** | **Docs Page** | **Sim (Docs)** |
|--------------------|:--------:|:---------:|:----------------:|
| package            |     ✔️    |     ✔️     |                  |
| config             |          |     ✔️     |                  ||

### package

If any snippet on a page uses blocks that are not included in the default
toolbox (that is, extension blocks) you will need declare the required
extensions (formerly known as _packages_). Provide a list of required extension
names using the ``package`` macro. Note, the name **package** is still used even
though these are now called **extensions**.

The package setting listed last in the example below uses a special format to reference
its location in a separate GitHub repository. You can find this _package specification_
in the ``Project Settings`` / ``pxt.json`` file, listed under ``dependencies``. Notice
that it lists the exact version to use; this isn't required (that is, you can leave off
the `#v0.6.12`), but it is highly recommended you include this so that future changes to
the extension won't break your tutorial.

    ```package
    devices
    bluetooth
    neopixel=github:microsoft/pxt-neopixel#v0.6.12
    ```

### config

You can specify the "features" required for a particular documentation page. In the
case of a multi-board editor, MakeCode will match the feature set with existing boards.

    ```config
    feature=pinsled
    feature=pinsd1
    ```

## Code Cards (docs only)

In the **docs** pages, there are a number of different ways to render code cards.

| **Snippet**            | **Tutorial** | **Docs Page** | **Sim (Docs)** |
|--------------------|:--------:|:---------:|:----------------:|
| cards              |          |     ✔️     |                  |
| namespaces         |          |     ✔️     |                  |
| apis               |          |     ✔️     |                  |
| codecard           |          |     ✔️     |                  ||


### cards

The **cards** "language" displays a code card for a valid namespace member. The card
will show a block (when defined) the namespace member along with its jsDoc description.
The card also serves as a clickable link to a reference doc page, if available, for the function.

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

The **namespaces** "language" displays a code card for the first symbol of each namespace. The cards rendered
show the namespace description and are clickable links to any code card pages defined for the namespace.

    ```namespaces
    basic.showNumber(0)
    input.onButtonPressed(() => {})
    ```

**Example:** the [reference](https://makecode.microbit.org/reference) namespaces doc
and it's [markdown](https://github.com/Microsoft/pxt-microbit/blob/master/docs/reference.md) source.

### apis

Render all blocks as code card for each namespaces listed in the section.

    ```apis
    basic
    ```

### codecard

To render one or more code cards as JSON into cards, use **codecard**. These look similar
to cards rendered for namespace members using ```` ```card ```` but instead they are general
purpose card links for documents, tutorials, videos, and external resources.

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

## Special snippet types (docs only)

Some additional snippets for use in documentation pages provide the ability to render
a simulator, the code of a project, or an inline block with some text.

| **Snippet**            | **Tutorial** | **Docs Page** | **Sim (Docs)** |
|--------------------|:--------:|:---------:|:----------------:|
| inline block       |          |     ✔️     |                  |
| project            |          |     ✔️     |                  |
| sig                |          |     ✔️     |                  |
| sim                |          |     ✔️     |                ||

### Inline code snippets

If an inline code snippet starts with `[` and ends with `]`, the doc engine will
try to render it as a block. If the renderer finds a documentation page matching
this API call, it will also make the block a hyperlink to that page.

Generally these snippets can only be one line of code, but a variable block can
be included like: ``[let myNum: number = null; pause(myNum)]``

```
``[let myNum: number = null; pause(myNum)]``

``[let txt = "text"]``
```

### project

The **project** snippet take the code from a shared project and render it blocks, for the entire project.
The project is specified by its share URL.

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

The **sim** snippet takes a chunk of JavaScript code and renders a simulator that runs the code

````
```sim
basic.showString("It's my birthday! Press A to see my age.)
input.onButtonPressed(Button.A, function () {
    basic.showNumber(14)
})
```
````

**Example:** the [Lemonade City](https://arcade.makecode.com/courses/csintro4/data/lemonade) game in the
CS Intro curriculum, and its [markdown](https://github.com/microsoft/pxt-arcade/blob/master/docs/courses/csintro4/data/lemonade.md) source.

## Testing MakeCode Markdown

To test a documentation pages locally you must have a MakeCode development environment
set up and be able to run the [pxt command line](https://makecode.com/cli) (in particular, `pxt serve`). Once you
have that running, simply load the relative path to your page **after** the `/docs/` folder:

    http://localhost:3232/tutorials/chase-the-pizza.md

To test a tutorial locally, it's recommended that you use the
[**Tutorial Tool**](https://makecode.com/tutorial-tool).

## Reference

* [Macros](/writing-docs/macros)
* [Writing Tutorials](/writing-docs/tutorials)
* [User Tutorials](/writing-docs/user-tutorials)
* [Skillmaps](/writing-docs/skillmaps)
