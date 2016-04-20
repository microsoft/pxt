# Defining blocks

This section describes how to annotate your PXT APIs to expose them in the Block Editor.

## Category

The namespace JSDoc and properties are used to populate a category in the Block Editor toolbox. You have to provide a `description`, 
`color` and `weight` at least once per namespace.

````
/**
 * Provides access to basic micro:bit functionality.
 */
//% color=190 weight=100
namespace basic {
````

Special attribute annotation like `color` should be included in a comment line starting with `\\%`. The color takes a **hue** value.

## Blocks

All **exported** functions with a `blockId` and `block` attribute
will be available in the Block Editor.

```
//% blockId=device_show_number 
//% block="show|number %v" 
//% blockGap=8 
//% icon="\uf1ec"
export function showNumber(v: number, interval: number = 150): void
{ }
```

* `blockId` is a constant, unique id for the block. This id is serialized in block code so changing it will break your users.
* `block` contains the syntax to build the block structure (more below).

Other optional attributes can also be used:
* `blockGap` the distance from this block to the next block (to create groups)
* `blockExternalInputs=` forces `External Inputs` rendering
* `icon` icon characte from the icon font to display

## Block syntax

The `block` attribute specifies how the parameters of the function
will be organized to create the block.

```
block = field, { '|' field } 
field := string 
    | string `%` parameter [ `=` type ]
parameter = string
type = string
```

* each `field` is mapped to a field in the bock editor
* the function parameter are mapped **in order** to `%parameter` argument. The loader automatically builds
a mapping between the block field names and the function names.
* the block will automatically switch to external inputs when enough parameters are detected
* A block type `=type` can be specified optionaly for each parameter. It will be used to populate the shadow type.

## Enums

Enum are supported and will automatically be represented by a dropdown in blocks.

```
enum Button {
    A = 1,
    B = 2,
    //% blockId="A+B"
    AB = 3,
}
```

* the initializer can be used to map the value
* the `blockId` attribute can be used to override the block id

## Docs and default values

The JSDoc comment is automatically used as the help for the block.

````
/**
 * Scroll a number on the screen. If the number fits on the screen (i.e. is a single digit), do not scroll.
 * @param interval speed of scroll; eg: 150, 100, 200, -100
*/
//% help=functions/show-number
export function showNumber(value: number, interval: number = 150): void 
{ }
````

* If `@param` annotation is available with an `eg:` section, the first
value is used as the shadow value.
* An optional `help` attribute can be used to point to an specific documentation path.

## API design Tips and Tricks

A few tips gathered while designing various APIs for the Block Editor.

* **Design for beginners**: the block interface is for beginners. You'll want to create a specific layer of C-like function for that purpose.
* **Anything that snaps together will be tried**: your runtime should deal with invalid input with graceful degradation rather than abrupt crashes.
Some users will try to snap anything together - get ready for it.
* **OO is cumbersome** in blocks: we recommend using a C-like APIs -- just function -- rather than OO classes. It maps better to blocks.
* **Keep the number of blocks small**: there's only so much space in the toolbox. Be specific about each API you want to see in Blocks.
