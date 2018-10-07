# Simple extension tutorial

As a variation of pxt-banana extension example from [getting started](/extensions/getting-started), this tutorial project guides you through building a very simple, yet complete, extension.

In order to build and test the extension, you'll need a running target to add the extension to. You can add this example to a target you're already working with or you can use the [pxt-sample](https://github.com/Microsoft/pxt-sample) target.  

## Step 1: Define a namespace and functions

Our extension has just one block category called `tropic`. The functions we want to expose for this category are contained inside a namespace with that same name. The block category will appear in the Toolbox with this name.

```typescript
namespace tropic {
}
```

Let's expand the `tropic` namespace and add some functions. If you're running a target and have the editor open, copy the this code into a new project in the editor. Verify that it has no errors and that you can convert it to blocks.

```typescript
/**
 * Types of tropical fruit
 */
enum TropicalFruit {
    Banana = 0,
    Pinapple = 1,
    Coconut = 2
}

/**
 * Pick some fruit and peel it.
 */
namespace tropic {
    /**
     * Pick a fruit
     */
    export function pick(fruit: TropicalFruit): boolean {
        return true;
    }
    /**
     * Peel the fruit if possible
     */
    export function peel(fruit: TropicalFruit): boolean {
        return (fruit == TropicalFruit.Banana);
    }
}
```

We'll quickly use the functions from `tropic` with a little bit of test code to simulate how they will work if they were added from an extension. You can add this bit of code at the bottom of project in the editor to test:

```typescript-ignore
let peeled = false;
if (tropic.pick(TropicalFruit.Banana)) {
    peeled = tropic.peel(TropicalFruit.Banana);
}
```

## Step  2: Create the extension directory and files

Go to the `/libs` directory in the target's file layout. Make a new directory there called `tropic`. All of our new extension files will be in there. Open [VSCode](https://code.visualstudio.com) or a similar code editor and copy the code for our example `tropic` namespace as a new TypeScript file (don't include our few lines of test code though). Save the file as `/libs/tropic/tropic.ts`.

### Create the extension description

We need to make an extension description file next. This is called `pxt.json`. The file defines all the components of the extension. Our `pxt.json` contains a minimum of what's needed to define our extension. Copy the JSON here and save it as `pxt.json` in the `/tropic` directory.

```typescript-ignore
{
    "name": "tropic",
    "description": "A tropical fruit paradise.",
    "icon": "./static/libs/tropic.png",
    "files": [
        "tropic.ts"
    ],
    "dependencies": {
        "core": "file:../core"
    }
}
```

This is what the basic entries in the `pxt.json` do:

* **name**: The extension name. This is used to search and select the extension when you go to add an extension in the editor.
* **description**: The description of the extension shown in the extension gallery.
* **icon**: An icon shown along with the description in the extension gallery.
* **files**: The list of sources for the code and blocks of the extension.
* **dependencies**: The other extensions that the code in this extension will rely on. Often there is a _core_ extension that has basic utility functions, helpers, and or data types that other extensions will need.

### Icon file

Make or copy a small picture and save it as an icon file in the `/docs/static/libs` folder of your target.

## Step 3: Include the block descriptions

The namespace shows up as a toolbox category in the MakeCode editor. MakeCode uses metadata from the JsDoc in the namespace as attributes to determine the order in the toolbox where the category is placed, the catergory icon, and the category color. The metadata is added using `//%` with the `weight`, `icon`, and `color` attributes. Let's add these for `tropic`:

```typescript-ignore
/**
 * Pick some fruit and peel it.
 */
//% weight=70 icon="\uf1db" color=#EC7505
namespace tropic {
    ...
}
```
The attributes we've defined for our namespace mean:

* **weight**: the relative order in which the category is placed in the Toolbox list (higher numbers movve the category up).
* **icon**: a Unicode identifier for an icon from the [Font Awesome](http://fontawesome.io/icons) icon set.
* **color**: the RGB color for the catergory item and blocks rendered from the namespace.

For the functions, we add the `blockId` and `block` attributes. This will make the block compiler create actual blocks for the functions. The functions will now show up as blocks under the `tropic` category in the toolbox too.

The text set for `block` is displayed in the blocks shown in the Toolbox and in the blocks editor view.

```typescript-ignore
/**
 * Pick some fruit and peel it.
 */
//% weight=70 icon="\uf185" color=#EC7505
namespace tropic {
    /**
     * Pick a fruit
     */
    //% blockId=tropic_pick block="pick a %fruit"
    export function pick(fruit: TropicalFruit): boolean {
        return true;
    }
    /**
     * Peel the fruit if possible
     */
    //% blockId=tropic_peel block="peel a %fruit"
    export function peel(fruit: TropicalFruit): boolean {
        return (fruit == TropicalFruit.Banana);
    }
}
```
You'll notice that the `block` attribute includes a parameter tag called ``%fruit``. This matches to the example functions which have one parameter called `fruit`. This will cause the block in the editor to have a parameter placeholder when compiled.

Let's also add some block descriptions for the `TropicalFruit` enum so that the values will appear in a list as the parameter for **pick** and **peel**.

```typescript-ignore
enum TropicalFruit {
    //% block=banana
    Banana = 0,
    //% block=pineapple
    Pinapple = 1,
    //% block=coconut
    Coconut = 2
}
```

## Step 4: Add the extension to the target

The target's description file, `pxtarget.json` is in the target's root directory. The extensions included with a target are listed in the `bundleddirs` entry. Add the `tropic` extension to `bundleddirs`:

```typescript-ignore
"bundleddirs": [
    "libs/core",
    "libs/tropic"
],
```

## Step 5: Rebuild the target

Stop and restart your target again. The output from ```pxt serve``` as it builds your target will now include the new `tropic` extension. The output will display something like:

```console
...
building docs in libs/core
Package built; written to binary.hex; size: 0
generated _locales\core-strings.json; size=49849
generated _locales\core-jsdoc-strings.json; size=33389
building docs in libs/tropic
Package built; written to binary.hex; size: 0
generated _locales\tropic-strings.json; size=65
generated _locales\tropic-jsdoc-strings.json; size=172
building libs/core
  skip native build of non-project
building libs/tropic
  skip native build of non-project
building libs\blocksprj
target.json built.
building cmds...
[run] cd cmds; node ../node_modules/typescript/bin/tsc
```

## Step 6: Add the extension and try it out!

After the target editor launches from the local server, go to the bottom of the Toolbox in the editor and click on **ADD PACKAGE** (it could be called **EXTENSIONS** or something similar depending on the target). You should see the **tropic** extension card with its icon as a gallery selection. Click on it and it will install your extension.

The **tropic** category appears in the toolbox list with the color and icon we set as attributes for the namespace. If you click on the category, you will see the **pick** and **peel** functions with a selectable parameter for the ``TropicalFruit`` type.

Switch to JavaScript and paste in again the small section of test code:

```typescript-ignore
let peeled = false
if (tropic.pick(TropicalFruit.Banana)) {
    peeled = tropic.peel(TropicalFruit.Banana)
}
```

Now, switch back to blocks to see **pick** and **peel** appear as blocks. Having added block attributes to the enum values for ``TropicalFruit``, you can go to the parameters for each block and select a different type of fruit.

**NEXT:** add some reference [documentation](./ref-docs) for the extension functions.

## See also

[Sources](./sources) for the extension tutorial