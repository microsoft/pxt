# Naming Conventions

Although not enforced, these naming conventions help keeping the blocks and functions in MakeCode editor consistent. 
Please try to follow as much as possible, and consider exceptions where it makes sense. Thank you for creating MakeCode packages!

## TypeScript conventions

MakeCode follows the usual TypeScript naming conventions.

* API and functions are typically in English. Only blocks are translated.
* **namespaces**, **function**, **function parmeters**, **methods**, **fields** are camel cased. **Class**, **enums** and **enum members** are capitalized.

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

* do not use **"get "** for property accessors (property that return a piece of state)

```typescript
// not "get temperature"!
export function temperature() {
    ....
}
```

* place all your code under a namespace to avoid clashes. Enums can be left in the global namespace with a proper prefix in the name.

```typescript
export enum UniquePrefixMyEnum {

}
namespace myNamespace {
    ...
}
```

* spell out words entirely instead of acronyms. Although longer,
it makes the meaning of your API more discoverable.

```typescript
// long but self-explanatory
export function doSomethingAwesome() {

}
// not clear
export function dSA() {

}
```

## Blocks naming guidelines

For more information about the syntax, try the [MakeCode playground](https://makecode.com/playground).

* use lower case for syntax unless acronyms are used. Do not capitalized.

```typescript
//% block="foo"
export function foo() {

}
```

* use English and provide [localization](/packages/localization) for other locales
