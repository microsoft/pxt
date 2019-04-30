# Naming Conventions

Naming conventions provide a consistant and expected style of usage across all namespaces used by MakeCode. This allows the coding user to make general assumptions about name forms used for functions, methods, properties, and enumerations. While writing code, a user can assume a certain order of name case and style for the names exposed by your extension. This eases the composition of code and saves the user from errors when they try to use a name as they might expect to.

Although not enforced, these naming conventions help keep the blocks and functions in the MakeCode editor consistent. 
As much as possible, please try to follow these conventions and consider exceptions only when absolutely necessary. Thank you for creating MakeCode extensions!

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
