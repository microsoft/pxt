# Defining blocks

This section describes how to annotate your PXT APIs to expose them in the Block Editor.

All the `//%` annotations are found in TypeScript library files.
They can optionally be [auto-generated](/simshim) from C++ library files or from TypeScript
simulator files.

## Category

Each top-level javascript namespace is used to populate a category in the Block Editor toolbox. The name will automatically be capitalized in the toolbox.

````
namespace basic {
    ...
}
````

You can also provide a JsDoc comment, color and weight for the namespace. We strongly recommend carefully picking colors as it dramatically impacts
that appearance and readability of your blocks. All blocks within the same namespace have the same color so that users can find the category easily from
samples.

````
/**
 * Provides access to basic micro:bit functionality.
 */
//% color=190 weight=100
namespace basic {
````

Special attribute annotation like `color` should be included in a comment line starting with `\\%`. The color takes a **hue** value or a HTML color.
To have a category appear under the "Advanced" section of the Block Editor toolbox, add the annotation `advanced=true`.

## Blocks

All **exported** functions with a `blockId` and `block` attribute
will be available in the Block Editor.

```
//% blockId=device_show_number
//% block="show|number %v"
//% icon="\uf1ec"
export function showNumber(v: number, interval: number = 150): void
{ }
```

* `blockId` is a constant, unique id for the block. This id is serialized in block code so changing it will break your users.
* `block` contains the syntax to build the block structure (more below).

Other optional attributes can also be used:
* `blockExternalInputs=` forces `External Inputs` rendering
* `icon` icon character from the icon font to display
* `advanced=true` causes this block to be placed under the parent category's "More..." subcategory. Useful for hiding advanced or rarely-used blocks by default

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

## Supported types

The following types are supported in function signatures that are meant to be exported:

* ``number`` (TypeScript) or ``int`` (C++)
* ``string`` (TypeScript) or ``StringData*`` (C++)
* enums (see below)
* custom classes that are also exported
* arrays of the above

## Enums

Enum are supported and will automatically be represented by a dropdown in blocks.

```
enum Button {
    A = 1,
    B = 2,
    //% blockId="ApB" block="A+B"
    AB = 3,
}
```

* the initializer can be used to map the value
* the `blockId` attribute can be used to override the block id
* the `block` attribute can be used to override the rendered string

### Tip: dropdown for non-enum parameters

It's possible to provide a drop-down for a parameter that is not an enum. It involves the following step:
* create an enum with desired drop down entry
```
enum Delimiters {
    //% block="new line"
    NewLine = 1,
    //% block=","
    Comma = 2
}
```
* a function that takes the enum as parameter and returns the according value
```
//% blockId="delimiter_conv" block="%del"
export function delimiters(del : Delimiters) : string {
    switch(del) {
        case Delimiters.NewLine: return "\n";
        case Delimiters.Comma:  return ",";
        ...
    }
}
```
* use the enum conversion function block id (``delimiter_conv``) as the value in the ``block`` parameter of your function
```
//% blockId="read_until" block="read until %del=delimiter_conv"
export function readUntil(del: string) : string {
    ...
}
```

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
* If the parameter has a default value (``interval`` in this case), it is **not** exposed in blocks.

## Objects and Instance methods

Blocks work best with "flat" C-style APIs. However, it is possible to expose instance methods in blocks as well.

```
//%
class Message {
    ...
    //% blockId="message_get_text" block="%this|text"
    public getText() { ... }
}
```

* when annotating an instance method, you need to specify the ``%this`` parameter in the block syntax definition.


You will need to expose a factory method to create your objects as needed. For the example above, we add a function that creates the message:
```
//% blockId="create_message" block="create message|with %text"
export function createMessage(text: string) : Message {
    return new Message(text);
}
```

## Ordering

All blocks have a default **weight** of 50 that is used to sort them in the UI with the highest weight showing up first. To tweak the ordering,
simply annotate the function with the ``weight`` macro:

```
//% weight=10
...
```

If given API is only for Blocks usage, and doesn't make much sense in TypeScript
(for example, because there are alternative TypeScript APIs), you can use ``//% hidden``
flag to disable showing it in auto-completion.

## Grouping

Use the **blockGap** macro to specify the distance to the next block in the toolbox. Combined with the weight parameter,
this macro allows to definte groups of blocks. The default ``blockGap`` value is ``8``.

```
//% blockGap=14
...
```

## Testing your Blocks

We recommend to build your block APIs iteratively and try it out in the editor to get the "feel of it".
To do so, the ideal setup is:
- run your target locally using ``pxt serve``
- keep a code editor with the TypeScript opened where you can edit the APIs
- refresh the browser and try out the changes on a dummy program.

Interrestingly, you can design your entire API without implementing it!

## API design Tips and Tricks

A few tips gathered while designing various APIs for the Block Editor.

* **Design for beginners**: the block interface is for beginners. You'll want to create a specific layer of C-like function for that purpose.
* **Anything that snaps together will be tried by the user**: your runtime should deal with invalid input with graceful degradation rather than abrupt crashes.
Some users will try to snap anything together - get ready for it.
* **OO is cumbersome** in blocks: we recommend using a C-like APIs -- just function -- rather than OO classes. It maps better to blocks.
* **Keep the number of blocks small**: there's only so much space in the toolbox. Be specific about each API you want to see in Blocks.
