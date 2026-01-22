# Naming Conventions

Naming conventions provide a consistant and expected style of usage across all namespaces used by MakeCode. This allows the coding user to make general assumptions about name forms used for functions, methods, properties, and enumerations. While writing code, a user can assume a certain order of name case and style for the names exposed by your extension. This eases the composition of code and saves the user from errors when they try to use a name as they might expect to.

Although not enforced, these naming conventions help keep the blocks and functions in the MakeCode editor consistent. 
As much as possible, please try to follow these conventions and consider exceptions only when absolutely necessary. Thank you for creating MakeCode extensions!

## Extension name

Your extension name (defined in [pxt.json](./pxt-json.md)) must adhere to the following rules. Failure to do so may result in issues while loading your extension.

* Start with a letter (lower-case).
* Contain only the following allowed characters:
  * Lower-case letters
  * Numbers
  * Dash (-)
  * Underscore (_)

In other words, it should match the following regex: `^[a-z][a-z0-9\-_]+`.

### ~ reminder

#### Headings in the Extensions Gallery info pages

To display the information page for an extension (when you click `Learn more` on an extension card in the Extensions Gallery) the Editor will inject portions of the `README.md` file from the extension's repository. A new top-level heading (`h1`), in addition to the one from the `README.md`, is generated for this page. The new heading might contain something like `theowner/pxt-laser-ray 1.2.3`, depending on the repository, owner, and version.

The rendering process for the extension's information page will attempt to remove the original `h1` element that came from `README.md` in order to avoid name duplication in the page headings. This is done by looking for the heading from the `README.md` that contains the `name` entry from the `pxt.json` in the repository. If found, that heading is removed. However, if the heading from the `README.md` doesn't match the `name` from `pxt.json`, then that `h1` heading isn't removed and it will also display in the extension information page.

If `pxt.json` file contains:

```
"name": "pxt-laser-ray",
"version": "1.2.3",
"description": "Generate light effects to simulate laser rays."
```

...but the `README.md` contains:

```
# Cool Laser Ray

This extenstion contains blocks to create laser ray effects.

...
```

...the information page will contain both:

`<h1>theowner/pxt-laser-ray 1.2.3</h1>`

and

`<h1>Cool Laser Ray</h1>`

### ~

## TypeScript conventions

MakeCode follows the usual TypeScript naming conventions.

* API and function names are typically all in English. Only the display text for blocks is translated.
* Names are "contracted" meaning the individual words in a name are adjacent rather than being separated by a `_` or other non-alphanumeric character.
> Form names as ``myName`` and not like ``my_Name``.
* **Namespaces**, **function**, **function parameters**, **methods**, **fields** are camel cased. Single word names are all lowercase.
> Style: ``aaaBbbCcc``<br/>
Examples: ``myFunction()``, ``myMethod()``, ``myField``
* **Class**, **enums** and **enum members** are capitalized.
> Style: ``Name``, ``TheName``<br/>
Examples: ``MyClass``, ``MyEnum``, ``MyEnumMember``

```typescript
namespace myNamespace {
    export function myFunction(myParameter: number) {

    }

    export class MyClass {
        myField: number;

        myMethod() {

        }
    }

    export enum MyEnum {
        MyEnumMember
    }
}
```

* Don't use **"get"** for property accessors (a property that returns some data item or a value for state). Simply use a name for the value accessed like ``temperature``. Don't add ``get`` to the names such as in ``getTemperature`` or ``get_Temperature``.

```typescript
// not "get temperature"!
export function temperature() {
    ....
}
```

* Place all your code under a namespace to avoid name collisions. Name collisions are avoided this way if a similar API name is in a different namespace. So, ``myNamespace.myFunction()`` and ``otherNampespace.myFunction()`` are both unique. Enums can be left in the global namespace with a proper prefix in the name to keep them unique.

```typescript
export enum UniquePrefixMyEnum {

}
namespace myNamespace {
    export function myFunction(myParameter: number) {

    }
    ...
}
namespace otherNamespace {
    export function myFunction(myParameter: number) {

    }
    ...
}
```

* Spell out words entirely instead of using acronyms. Although the names are longer, this helps convey the meaning of your API. Exceptions might be single letter identifiers, like the coordinate names `x`, `y`, `z`.

```typescript
// long but self-explanatory
export function doSomethingAwesome() {

}
// not clear
export function dSA() {

}
```

## Blocks naming guidelines

For more information about syntax and block name formats, try the [MakeCode playground](https://makecode.com/playground).

* Always use lower case for block text syntax unless acronyms are used. Don't capitalize.

```typescript
//% block="foo"
export function foo() {

}
```

* Use English as the base language for blocks and add [localization](/extensions/localization) strings for other locales.
