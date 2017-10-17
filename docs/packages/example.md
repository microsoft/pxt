# Package example project

Using the pxt-banana idea from getting started, this example project guides you through building a complete package.

## ``|Step 1|`` Define a namespace and methods

Our package has just one block category called `tropic`. The methods we want to expose for this category are contained inside a namespace with that same name. We want our block category to appear in the toolbox with this name.

```typescript
namespace tropic {
}
```

Let's expand the `tropic` namespace and add some methods. If you're running a target and have an editor open, copy the this code into a new project in the editor. Verify that it has no errors and you can convert it to blocks.

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
    export function pick(type: TropicalFruit): boolean {
        switch (type) {
            case TropicalFruit.Banana:
                return true;
                break;
            default:
                return false;
        }
    }
    /**
     * Peel the fruit if possible
     */
    export function peel(fruit: boolean): boolean {
        return fruit;
    }
}
```

We'll quickly use the methods from `tropic` with a little bit of test code to see how it might work as if it was added from a package. You can add this to the project in the editor to test:

```typescript-ignore
let myFruit = false;
myFruit = tropic.pick(TropicalFruit.Banana)
tropic.peel(myFruit)
```
## ``|Step  2|`` Create the package directory and files

Go to the `/libs` directory in the target's file layout. Make a new directory there called `tropic`. All of our new package files will be in there. Open [VSCode](https://code.visualstudio.com) or a similar code editor and copy the code for our example `tropic` namespace as a new TypeScript file (don't include our few lines of test code though). Save the file as `/libs/tropic/tropic.ts`.

### Create the package description

We need to make a package description file next. This is called `pxt.json`. The file defines all the components of the package. Our `pxt.json` contains a minimum of what's needed to define a package. Copy the JSON here and save it as `pxt.json` in the `/tropic` directory.

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

* **name**: The package name. This is used to search and select the package when you go to add a package in the editor.
* **description**: The description of the package shown in the package gallery.
* **icon**: An icon shown along with the description in the package gallery.
* **files**: The list of sources for the code and blocks of the package.
* **dependencies**: The other packages that the code in this package will rely on. Often there is a _core_ package that has basic utility methods, helpers, and or data types that other packages will need.

### Icon file

Make or copy a small picture file and save in the `/docs/static/libs` folder of your target.

## ``|Step 3|`` Include the block descriptions

The namespace shows up as a toolbox category in the MakeCode editor. The namespace uses metadata to tell MakeCode what order in the toolbox the category is placed. Also, the catergory icon and color are defined. The metadata is added using `//%` with the `weight`, `icon`, and `color` attributes. Let's add these for `tropic`:

```typescript-ignore
/**
 * Pick some fruit and peel it.
 */
//% weight=70 icon="\uf1db" color=#EC7505
namespace tropic {
    ...
}
```
For the methods, we add the `block` attribute. This will make the block compiler create the actual blocks for the method. The method will also now show up under the `tropic` category in the toolbox too.

```typescript
/**
 * Pick a fruit
 */
//% block="pick a %type fruit"
export function pick(type: TropicalFruit): boolean {
    switch (type) {
        case TropicalFruit.Banana:
            return true;
            break;
        default:
            return false;
    }
}
/**
 * Peel the fruit if possible
 */
//% block="peel fruit"
export function peel(fruit: boolean): boolean {
    return fruit;
}
```

Let's also add some block descriptions for the `TropicalFruit` enum so that the values will appear in a list as the parameter for **pick()**

```typescript
enum TropicalFruit {
    //% block=banana
    Banana = 0,
    //% block=pineapple
    Pinapple = 1,
    //% block=coconut
    Coconut = 2
}
```

## ``|Step 4|`` Add the package to the target

The target's description file, `pxtarget.json` is in the target's root directory. The packages included with a target are listed in the `bundleddirs` entry. Add the `tropic` package to `bundleddirs`:

```typescript-ignore
"bundleddirs": [
    "libs/core",
    "libs/tropic"
],
```
