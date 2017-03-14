# Static TypeScript

### ~ hint

This is a draft reflecting the design of STS - not exactly what is implemented, but quite close.
Comments welcome. 

### ~ 

[TypeScript](http://typescriptlang.org) is a typed superset of JavaScript designed to enable JavaScript developers 
to take advantage of code intellisense,
static checking and refactoring made possible by types.  TypeScript is gradually typed, meaning that types are optional. 
Type inference helps to assign types to untyped code. Inside of TypeScript lies a simple statically typed language that 
we believe has great potential for both introductory CS education, programming and physical computing. 

In this document, we define a subset of TypeScript called Static TypeScript (STS, for short), 
its properties and how it can help transform teaching of CS education. 
The best way to think of STS is as C#/Java/C++ subset of TypeScript where all types are known at compile time,
which permits efficient linking to a C++ runtime. STS maintains a JavaScript semantics as much as possible. 

# Goodbye: Any, Union, Intersection Types and JavaScript, the bad parts 

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
including the var statement and for-in loop (for-of is supported). Excluded program elements are:
If you think one of the above program elements should be introduced in an introductory programming
language course, speak now or forever hold your peace.

# Hello, Static TypeScript!

STS contains a lot of the good parts of TypeScript, including
* top-level code in a file; The “hello world” program really is just one line - console.log("Hello world")
* lexically-scoped variable declarations via let and const
* classes with static and instance fields, methods and constructors; method-like properties (get/set accessors); new keyword;
* nested function definitions (with lexical scoping and recursion) and arrow functions
* generic classes, methods, and functions for code reuse (see below for limitations)
* namespaces (a form of modules) 
* standard control-flow statements
  * if ... else if ... else statements
* loops: while, do ... while, for(;;) and for ... of statements
* break/continue statements; also with labeled loops
* switch statement
* standard Boolean/arithmetic expressions
  * conditional operator ? and lazy boolean operators
  * all arithmetic operators (including bitwise operators);
* literals
  * Primitive literals
  * array literals [1, 2, 3]
  * object literals { foo: 1, bar: "two" }
* string templates (`x is ${x}` )
TypeScript elements not mentioned as included in STS in the previous sections are excluded from STS 
for now (see later section for a list of these elements). 
If we’ve left something out that obviously should be in STS, please let us know!

# Type checking in STS

Typescript's type system is very rich with a complex notion of type compatability and substitutability.
STS keeps many of its features (structural subtyping, for example), but dispenses with features that
lead to run-time errors. Our goal is catch as many errors at compile-time as possible, while retaining
an expressive language with arrays, functions, classes, and generics. This means we disallow explicit or
implicit downcasts, for example, as well as the use of bivariance in function subtyping. 

## Primitive types

STS separates the primitive (unboxed) types of *number*, *enum*, and *boolean* from reference (boxed) types 
such as strings and objects. This means that code such as:
```typescript
let a: Object = 3
```
is illegal in STS, as primitive types are not objects (though the primitive types do support basic methods,
such as toString). There are no implicit conversions between primitive types, or between primitive and object types.

## Object types

In TypeScript, class and interface type references, array types, tuple types, and function types are all 
classified as object types. In STS, classes, records (described by interfaces), arrays, tuples, and functions
are *separate types*, with the following type relationships:
* classes and records are related by structural subtyping, as in TypeScript, with the 
  restriction that classes can be treated as records (via a cast to an interface), but not vice versa;
* functions are related by classical function subtyping (no bivariance, as in TypeScript); 
* function/method overloading is not permitted.
STS supports anonymous record types (it doesn't currently)

## Generics

