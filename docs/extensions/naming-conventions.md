# Naming Conventions

Although not enforced, these naming conventions help keep the blocks and functions in the MakeCode editor consistent. 
As much as possible, please try to follow these conventions and consider exceptions only when absolutely necessary. Thank you for creating MakeCode extensions!

## TypeScript conventions

MakeCode follows the usual TypeScript naming conventions.

* API and functions are typically in English. Only blocks are translated.
* **namespaces**, **function**, **function parameters**, **methods**, **fields** are camel cased. **Class**, **enums** and **enum members** are capitalized.

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

* do not use **"get "** for property accessors (a property that returns some data item or a value for state)

```typescript
// not "get temperature"!
export function temperature() {
    ....
}
```

* place all your code under a namespace to avoid name collisions. Enums can be left in the global namespace with a proper prefix in the name.

```typescript
export enum UniquePrefixMyEnum {

}
namespace myNamespace {
    ...
}
```

* spell out words entirely instead of using acronyms. Although the names are longer, this helps convey the meaning of your API.

```typescript
// long but self-explanatory
export function doSomethingAwesome() {

}
// not clear
export function dSA() {

}
```

## Blocks naming guidelines

For more information about syntax, try the [MakeCode playground](https://makecode.com/playground).

* use lower case for syntax unless acronyms are used. Do not capitalize.

```typescript
//% block="foo"
export function foo() {

}
```

* use English and provide [localization](/extensions/localization) for other locales
