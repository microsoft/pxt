# Static TypeScript

### ~ hint

This is a draft reflecting the design of Static TypeScript (STS) - not exactly what is implemented, but quite close.
Comments welcome. 

### ~ 

[TypeScript](http://typescriptlang.org) is a typed superset of JavaScript designed to enable JavaScript developers 
to take advantage of code intellisense,
static checking and refactoring made possible by types. TypeScript is gradually typed, meaning that types are optional. 
Type inference helps to assign types to untyped code.

In this document, we define a subset of TypeScript called Static TypeScript (STS, for short), 
which was created to make it possible to use a scripting language to program physical computers
based on microcontrollers with small amounts of memory. The first use of Static TypeScript is for
the [micro:bit](http://microbit.org), which has 16Kb of RAM.

The best way to think of STS is as C#/Java/C++ subset of TypeScript where all types 
are known at compile time, which permits efficient linking to a C++ runtime (in the
case of the micro:bit, the [Lancaster University micro:bit DAL](https://github.com/lancaster-university/microbit-dal)).
STS tries to maintain as much of JavaScript semantics as much as possible, given the
constraints imposed by a static typing discipline.

# Goodbye to Any, Union, Intersection Types and the Bad Parts 

In TypeScript, the *Any* type is “the one type that can represent any JavaScript value with no constraints”. 
In TypeScript, every program expression, value, and function must have some type, even if not explicitly 
provided by the programmer. Per the TypeScript Language Reference:

  “in places where a type is not explicitly provided and TypeScript cannot infer one, the Any type is assumed.”

STS does not permit use of the Any, Union and Intersection types.  The result of this is that
STS disallows programs where a program element can denote many kinds of runtime values 
(for example, a variable that is a string at one point in execution and a number at another point, 
as specified by the union type *string | number*).

As a result of this choice, many dynamic features of JavaScript (and thus TypeScript) are out of STS: 
* the *eval* function;
* the *with* statement;
* access to the prototype property (goodbye to prototype-based inheritance);
* computed properties;
* access to the “this” pointer outside of a class;
* the typeof expression;
* type assertions

STS also excludes features that we consider historical, 
including the var statement and for-in loop (for-of is supported).
If you think one of the above program elements should be introduced in an introductory programming
language course, speak now or forever hold your peace.

# Hello, Static TypeScript!

STS contains a lot of the good parts of TypeScript, including
* top-level code in a file; The “hello world” program really is just one line - `console.log("Hello world")`
* lexically-scoped variable declarations via `let` and `const`
* classes with static and instance fields, methods and constructors; method-like properties (get/set accessors); `new` keyword;
* interfaces for describing the shape of (record-based) data
* nested function definitions (with lexical scoping and recursion) and arrow functions
* generic classes, methods, and functions for code reuse (see below for limitations)
* namespaces (a form of modules) 
* standard control-flow statements
  * `if ... else if ... else` statements
  * loops: `while`, `do ... while`, `for(;;)` and `for ... of` statements
  * `break`/`continue` statements; also with labeled loops
  * `switch` statement
* standard Boolean/arithmetic expressions
  * conditional operator `?` and lazy boolean operators
  * all arithmetic operators (including bitwise operators);
* literals
  * Primitive literals
  * array literals `[1, 2, 3]`
  * object literals `{ foo: 1, bar: "two" }`
* string templates (`` `x is ${x}` ``)

TypeScript elements not mentioned as included in STS in the previous sections are excluded from STS 
for now (see later section for a list of these elements). 
If we’ve left something out that obviously should be in STS, please let us know!

# Type checking in STS

Typescript's type system is very rich with a complex notion of type compatibility and substitutability.
STS keeps many of TypeScript's type checking rules (structural subtyping, for example), but modifies 
the notion of type compatibility/substitutability to reduce 
run-time errors. Our goal is catch as many errors at compile-time as possible, while retaining
an expressive language with arrays, functions, classes, and generics. This means we disallow explicit or
implicit downcasts, for example, as well as the use of bivariance in function subtyping. 

## Primitive types

STS separates the primitive (unboxed) types of *number*, *enum*, and *boolean* from reference (boxed) types 
such as strings and objects. This means that code such as:
```typescript
let a: Object = 3
```
is illegal in STS, as primitive types are not objects (though the primitive types do support basic methods,
such as `toString`). 

In a major deviation from JavaScript, STS treats *numbers* as 32-bit integers rather than doubles (as in JavaScript).
STS does not yet support floating point.

### ~ hint
TODO 
- do not allow implicit conversions between primitive types, or between primitive and object types.
- currently, we do allow
```typeScript
let x : number = null
basic.showNumber(x)
let y : number = undefined
basic.showNumber(y)
let s: string = null
basic.showString(s)
```
where null and undefined is coerced to the number 0. This is OK for number, but rather strange for strings. 
### ~

## Undefined, null, and default values

Static TypeScript provides default values for XYZ.  Undefined/null are treated the same. 

## Object types

In TypeScript, class and interface type references, array types, tuple types, and function types are all 
classified as *object types*, which are related by structural subtyping. 

In STS, classes, records (described by interfaces), arrays, tuples, and functions
are *separate types*, with the following type relationships, which are a strict 
subset of the type relationships in TypeScript.

### Classes

In STS, classes and records are related by structural subtyping, as in TypeScript, with the 
following additional restrictions:
* classes can be treated as records (via a cast from class to interface);
* records cannot be treated as classes (casts from interfaces to classes are not permitted);
* class-to-class casts can only be from subclass to superclass, as defined by the 
   (transitive closure of) the *extends* clause - nominal typing for classes;
* interfaces cannot extend classes
* an interface cannot have the same name as a class

STS' treatment of classes follows a nominal typing discipline, where one expects
an object of class type to have the implementation associated with that class.
In a pure structural subtyping discipline, one can define an object and then cast it to a
class type, but that object's implementation can be completely unrelated to the implementation
associated with the class.

### Functions

In STS, functions and methods are related by classical function subtyping (no parameter 
bivariance, as in TypeScript). Furthermore:
* function/method overloading is not permitted;
* a function can only be cast to an interface J which has a single call signature 
  matching the function's type; the interface J can have no other properties

### Arrays

As with functions, arrays can only be cast to an interface J with has a single index
signature matching the array's type; the interface J can have no other properties.

## Optional properties

Interfaces support optional properties. The following is legal TypeScript
```
interface Foo {
   a: number;
   b?: string;
}

let f: Foo = { a:42 }
```
In TypeScript/JavaScript, there is no property named `b` in the object referenced by f.

## Generics

With the exclusion of the Any type, it's very important to support generics so that code can be reused
across many types. STS supports generic functions and classes with the following restrictions:
* generic functions cannot be used as values;
* nested functions cannot be generic;

### ~ hint
TODO
* type checking of generics should follow Java (which uses type erasure).
### ~

## Void and Never

TODO (not much)

# Compilation of STS

# TODO

[Need to address exceptions, regex, debugging, async!!!.]
