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

See [forever docs](https://pxt.microbit.org/reference/basic/show-string) 
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

See [basic namespace docs](https://pxt.microbit.org/reference) 
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
  
### ignore

Append `-ignore` to any of the above to ignore a snippet in automated testing:

    ```typescript-ignore
    // You can include illegal TS in here, e.g. to document syntax errors
    callFunction(;
    ```

## Anchors

Sections of document can be named by adding ``#some-name`` after a section header.
These will be used as the `id` attribute of the corresponding `<hX>` tag, so they
can be used in links.
For example:

```markdown
## Examples #ex
### Example 1
...
### Example 2 #ex2
...
### Example 3
...
## See also #also
...
```

This will result in:

```html
<h2 id='ex'>Examples</h2>
<h3>Example 1</h3>
...
<h3 id='ex2'>Example 2</h3>
...
<h3>Example 3</h3>
...
<h2 id='also'>See also</h2>
...
```

Sections stretch until a header with the same or smaller number
of `#` in front is found. This isn't relevant for plain HTML, but
matters when overriding sections (see below).

Thus, the section named `ex` contains Examples 1, 2, and 3.
Section `ex2` contains only Example 2,
and section `also` contains the See also paragraph.


## Inheriting docs

Targets inherit main PXT docs for common language features, but can override
parts of each document. 

By default, all upstream PXT docs are visible in the target. They consist mostly of the language
reference. If a target defines a document with a name matching an upstream document, the target's
version will be used. If the target's version includes macro ```# @extends```, then the upstream
version will be used as base and sections in it overridden.

Sections are overridden based on matching their ids. For example, a target's version of
the document above can look as follows:

```markdown
# @​extends
### #ex2
My example
## See Also These! #also
My links
```

Effectively, the resulting markdown will be:

```markdown
## Examples #ex
### Example 1
...
### Example 2 #ex2
My example
### Example 3
...
## See Also These! #also
My links
```

If the title of section is omitted, the title from the upstream version is taken.

Only named sections of the upstream document can be overridden. This is because
of possible mixups related to localization.

Do not introduce new section ids in the target's document - they will appear as errors at the end.
Also, if you were to override a section with nested subsections, like the `ex` section above,
it is not necessary to specify nested subsections again (i.e., `#ex2` can be skipped).

The sections in the upstream document are treated as a tree, following the nesting level
of headers. In the target document, sections stretch from the beginning of a section with
id, until the next section with id starts, that is the tree structure is not required.

## Docs file lookup

The lookup of path `https://some.domain.com/v2/foo/bar` proceeds as follows:
* take the main repo of the target corresponding to `some.domain.com` at branch `v2`
* check if any of `docs/foo/bar-ref.json` or `docs/foo/bar.html` exists; if so use it and stop
* check for `docs/foo/bar.md`
* if it exists and doesn't contain `# @extends` use it and stop
* for every bundled package `P` from `pxtarget.json`, that is not in
  `pxt-common-packages`, look for `P/docs/foo/bar.md`; if found use it and stop (no expansion here)
* get `package.json` and `pxtarget.json` from the main target repo
* check for base file `common-docs/foo/bar.md` in checkout of `pxt-core` branch from `package.json`;
  eg `"dependencies": { "pxt-core": "3.2.1" }` will result in looking into `pxt-core` repo at `v3` branch
* if it fails, for every bundled package `P` from `pxtarget.json` look for base file in the checkout of
  `pxt-common-packages` (version from `package.json`) for `P/docs/foo/bar.md`
* if no base file is found, 404
* otherwise, either server the base file as is, or patch it up using the instructions 
  in Inheriting docs above

If there is say no `v7` branch of a repo, but `package.json` at `master` has `"version": "7.3.1"`,
then `master` is used instead of `v7`.

The lookup of path `https://some.domain.com/foo/bar` where `foo` doesn't look like
`v0`, `v1` etc. proceeds like above but with `master` instead of `v2`.

If the page is requested in non-English language, the `.md` files are first fetched
from crowdin on the same branch as they would have been fetched from the repo (either `master` 
or `vN`).

To see how this resolution applies in a particular target,
you can try to load an non-existing URL - the error page will show you the list of locations
tried. You may need to click a little 'More info' button to see it.

## Automated testing

Run `pxt snippets` in the project's root directory. This will automatically check that all code
snippets in your documentation can be compiled, and it will check that no typescript features 
that cannot be represented as blocks are used in block snippets.

If you use an additional dependencies, make sure you reference them (see [above](#dependencies)). 

To ensure that a snippet isn't checked, add `-ignore` after the snippet type.