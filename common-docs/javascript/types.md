# Types

For programs to be useful, we need to be able to work with some of the simplest units of data:
numbers, strings, structures, boolean values, and the like.

## Type Inference

In TypeScript, there are several places where type inference is used to provide type information when there is
no explicit type annotation. For example, in this code

```typescript
let x = 3;
let y = x + 3
```

The type of the `x` variable is inferred to be `number`. Similarly, the type of `y` variable also is inferred to be `number`.
This kind of inference takes place when initializing variables and members,
setting parameter default values, and determining function return types.

All the examples below give an example type annotation, but will work just the same without the annotation.

## Boolean

The most basic datatype is the simple `true` or `false` value, which is called a `boolean` value.

```typescript
let isDone: boolean = false;
```

## Number

Both whole numbers and numbers with a fractional part are supported. Sometimes numbers are called _numeric literals_.

### Integers: whole numbers

Integer values can be specified using decimal, hexadecimal, binary, and octal notation. When the number isn't expressed in its decimal form, special characters are used for notation to tell which form it is:

* Decimal: no notation is used
* Hexadecimal: prefix the value with `0x`
* Binary: prefix the value with `0b`
* Octal: prefix the value with `0o`

```typescript
let decimal: number = 42;
let hexadecimal: number = 0xf00d;
let binary: number = 0b1010;
let octal: number = 0o744;
```

### Floating point: numbers with a fractional part

Numbers can have their fractional part too. The decimal point is between the digits of the number.
But, _floating point_ numbers have the decimal point at any spot between digits, like: 3.14159 or 651.75.

```typescript
let num = 0
num = 6.7
num = 10.083
```

## String #string

As in other languages, we use the type `string` to refer to textual data.
Use double quotes (`"`) or single quotes (`'`) to surround string data.

```typescript
let myColor: string = "blue";
myColor = 'red';
```

You can also use *template strings*, which can span multiple lines and have embedded expressions.
These strings are surrounded by the backtick/backquote (`` ` ``) character, and embedded expressions use the form `${ expr }`.

```typescript
let fullName: string = `Bob Bobbington`;
let age: number = 37;
let sentence: string = `Hello, my name is ${ fullName }.

I'll be ${ age + 1 } years old next month.`
```

This is equivalent to declaring `sentence` like so:

```typescript
let fullName: string = `Bob Bobbington`;
let age: number = 37;
let sentence: string = "Hello, my name is " + fullName + ".\n\n" +
    "I'll be " + (age + 1) + " years old next month."
```

## Array #array

Arrays allow you to work with an expandable sequence of values, addressed by an integer-valued index.
Array types can be written in one of two ways.
In the first, you use the type of the elements followed by `[]` to denote an array of that element type:

```typescript
let list: number[] = [1, 2, 3];
```

The second way uses a generic array type, `Array<elemType>`:

```typescript
let list: Array<number> = [1, 2, 3];
```

### ~hint
For the @boardname@, all elements of an array must have the same type.
### ~

## Enum

A helpful addition to the standard set of datatypes from JavaScript is the `enum`.
As in languages like C#, an enum is a way of giving more friendly names to sets of numeric values.

```typescript
enum Color {Red, Green, Blue}
let c: Color = Color.Green;
```

By default, enums begin numbering their members starting at `0`.
You can change this by manually setting the value of one of its members.
For example, we can start the previous example at `1` instead of `0`:

```typescript
enum Color {Red = 1, Green, Blue}
let c: Color = Color.Green;
```

Or, even manually set all the values in the enum:

```typescript
enum Color {Red = 1, Green = 2, Blue = 4}
let c: Color = Color.Green;
```

## Any

The TypeScript type `any` is not supported in the @boardname@.

## Void

`void` is the absence of any type at all.
You may commonly see this as the return type of functions that do not return a value:

```typescript
function warnUser(): void {
    //...
}
warnUser();
```

Declaring variables of type `void` is not useful.

## Null and undefined

A variable isn't always set to a value. If you want a variable to exist but not have it set to  a value of a type, it can be set to nothing, or `null`. This is often useful to indicate that a variable isn't meaningful for evaluation at the moment.

```typescript-ignore
if (encoder.active) {
    position = encoder.readPosition();
} else {
    position = null;
}
```
In a similar way, `undefined` indicates that a variable has no value:

```typescript-ignore
let message: string = undefined;
let received = false;

while (!received) {
    message = ports.readString();
    if (message != undefined)
        received = true;
    } else {
        pause(1000);
    }
}
```
