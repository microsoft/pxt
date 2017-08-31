# Types

A *type* refers to a class of data and the operations permitted on that class of data. 
The following built-in types are supported for the @boardname@:

## Basic (primitive) types #primitives

* **[Number](/types/number)**: an integer number (32-bit signed)
* **[String](/types/string)**: a sequence of characters
* **[Boolean](/types/boolean)**: true or false

## Complex types #complex

* **[Array](/types/array)**: a list of items of a primitive type

## Functions

* **[Function](types/function)**: code you can reuse anywhere in a program 

## #custom

## User data

TypeScript allows you to create user-defined classes of data. 

```typescript
class Foo {
    public bar: number;
    baz() {

    }
}
```