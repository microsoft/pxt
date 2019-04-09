# MakeCode Languages: Blocks, Static TypeScript and Static Python

MakeCode programs can be authored in **Blocks**, **Static TypeScript** or **Static Phyton**.

Both Blocks and Static Python are converted to Static TypeScript before being compiled to lower-level languages.
Blocks is implemented using Google Blockly.

Static TypeScript is a subset of [TypeScript](https://www.typescriptlang.org). 
Currently, we are using TypeScript version 2.6.1. TypeScript itself is a superset of JavaScript, 
and many MakeCode programs, especially at the beginner's level, are also just plain JavaScript.

MakeCode is meant for teaching programming first, and JavaScript second. For this
reason, we have stayed away from concepts that are specific to JavaScript (for
example, prototype inheritance), and instead focused on ones common to most
modern programming languages (for example, loops, lexically scoped variables,
functions, lambdas, classes).

## ~ hint

Static Python is not still in an Experimental phase 
and might not be available in your editor.

## ~

## Supported language features

* variable declarations with `let`, `const`
* functions with lexical scoping and recursion
* top-level code in the file; hello world really is `console.log("Hello world")`
* `if ... else if ... else` statements
* `while` and `do ... while` loops
* `for(;;)` loops
* `for ... of` statements (see below about `for ... in`)
* `break/continue`; also with labeled loops
* `switch` statement (on numbers, strings, and arbitrary types - the last one isn't very useful)
* `debugger` statement for breakpoints
* conditional operator `? :`; lazy boolean operators
* namespaces (a form of modules) 
* all arithmetic operators (including bitwise operators)
* strings (with a few common methods)
* [string templates](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) (`` `x is ${x}` ``)
* arrow functions `() => ...`
* passing functions (with up to 3 arguments) as values
* classes with static and instance fields, methods and constructors; `new` keyword
* array literals `[1, 2, 3]`
* enumerations (`enum`)
* asynchronous functions that look [synchronous to the user](/async)
* method-like properties (get/set accessors)
* basic generic classes, methods, and functions
* class inheritance
* classes implementing interfaces (explicitly and implicitly)
* object literals `{ foo: 1, bar: "two" }`
* `typeof` expression
* `public`/`private` annotations on constructor arguments (syntactic sugar to make them into fields)
* initializers for class fields
* lambda functions with more than three arguments
* using generic functions as values and nested generic functions

The following used to be disallowed, but should be supported now,
though they require testing:

* downcasts of a superclass to a subclass
* function parameter bi-variance
* explicit or implicit use of the `any` type
* `union` or `intersection` types
* using a generic function as a value
* class inheritance for generic classes and methods

## Unsupported language features

Static TypeScript has *nominal typing* for classes, rather than the *structural typing* of TypeScript. In particular, it does not support:
* `interface` with same name as a `class`
* casts of a non-`class` type to a `class`
* `interface` that extends a a `class`
* inheriting from a built-in type
* `this` used outside of a method
* function overloading

We generally stay away from the more dynamic parts of JavaScript.  Things you may miss and we may implement:

* object destructuring with initializers
* shorthand properties (`{a, b: 1}` parsed as `{a: a, b: 1}`)
* exceptions (`throw`, `try ... catch`, `try ... finally`);
  currently all exceptions just stop the program
* binding with arrays or objects: `let [a, b] = ...; let { x, y } = ...`
* `delete` statement (on object literals)
* spread and reset operators (statically typed)
* support of `enums` as run-time arrays
* `new` on non-class types
* using a built-in function as a value

Things that we are not very likely to implement due to the scope of the project
or other constraints (note that if you don't know what a given feature is, you're
unlikely to miss it):

* file-based modules (`import * from ...`, `module.exports` etc); we do support namespaces
* `yield` expression and ``function*``
* `await` expression and `async function`
* tagged templates ``tag `text ${expression} more text` ``; regular templates are supported
* `with` statement
* `eval`
* `for ... in` statements (`for ... of` is supported)
* prototype-based inheritance; `this` pointer outside classes
* `arguments` keyword; `.apply` method
* JSX (HTML fragments as part of JavaScript)

For JS-only targets we may implement the following:

* regular expressions

Note, that you can use all of these while implementing your runtime environment
(simulator), they just cannot be used in user's programs.

## Semantic differences against JavaScript

As such, it isn't really feasible to run a full JavaScript virtual machine
in 3k of RAM, and thus PXT programs are statically compiled to native code to run efficiently.

PXT used to support a *legacy compilation strategy*, where numbers were represented
as 32 bit signed integers, and all types were static.
This is used by the `v0` branch of micro:bit (but not the current `v1`) 
and the Chibitronics editors, but is no longer included in the main PXT code base.

PXT follows nominal typing for classes.
This means that if you declare `x` to be of class type `C`, and at runtime
it happens to be not of this type, then when you try to access fields
or methods of `x` you will get an exception, just as if `x` was `null`.

It is also impossible to 
[monkey-patch](https://en.wikipedia.org/wiki/Monkey_patch)
classes by overriding methods on class instance.
As prototype chains are not accessible or even used, it's also not possible to
monkey-patch these.

Finally, classes are currently not extensible with arbitrary fields.
We might lift this in future.

## Execution environments

PXT programs are executed in at least three different environments:
* microcontrollers, with native code compilation (ARM)
* browsers
* server-side JavaScript engines (node.js, etc)

We refer to the browser execution environment as the "simulator" (of the
microcontroller), even though for some targets it's the only environment.

The node.js execution is currently only used for automated testing, but one
can easily imagine a programming experience for scripts running on headless
devices, either locally or in the cloud.

In case of microcontrollers, PXT programs are 
[compiled in the browser](https://www.touchdevelop.com/docs/touch-develop-in-208-bits)
to ARM Thumb assembly, and then to machine code, resulting in a file
which is then deployed to the microcontroller,
usually [via USB mass-storage interface](https://makecode.com/blog/one-chip-to-flash-them-all).

For browsers and node.js, PXT programs are compiled to 
[continuation-passing style](https://en.wikipedia.org/wiki/Continuation-passing_style)
JavaScript. This utilizes the TypeScript abstract syntax tree as input, but
does not use TypeScript JavaScript emitter.
On the plus side, this allows for [handling of async calls](/async), even if the browser
doesn't support `yield` statement, as well as cross-browser and remote
debugging. On the other hand, the generated code is not really human readable.

Numbers are either [tagged 31-bit signed integers](/js/values), 
or if they do not fit boxed doubles. Special constants like `false`, `null` and
`undefined` are given special values and can be distinguished.
We're aiming at full JavaScript compatibility here.

## Static compilation vs a dynamic VM

PXT programs are compiled to native code. The only currently supported
native target is ARM Thumb.
PXT used to support two different AVR ports, but these have been
removed together with the legacy compilation strategy.

Compared to a typical dynamic JavaScript engine, PXT compiles code statically,
giving rise to significant time and space performance improvements:
* user programs are compiled directly to machine code, and are
  never in any byte-code form that needs to be interpreted; this results in
  much faster execution than a typical JS interpreter
* there is no RAM overhead for user-code - all code sits in flash; in a dynamic VM
  there are usually some data-structures representing code
* due to lack of boxing for small integers and static class layout the memory consumption for objects
  is around half the one you get in a dynamic VM (not counting
  the user-code structures mentioned above)
* while there is some runtime support code in PXT, it's typically around 100KB smaller than
  a dynamic VM, bringing down flash consumption and leaving more space for user code

The execution time, RAM and flash consumption of PXT code is as a rule of thumb 2x of
compiled C code, making it competitive to write drivers and other user-space libraries.

Interfacing C++ from PXT is easier than interfacing typical dynamic VMs,
in particular for simple functions with numbers on input and output - there is
no need for unboxing, checking types, or memory management.

The main disadvantage of using static compilation is lack of dynamic features
in the language (think `eval`), as explained above.

While it is possible to run a dynamic VM even on an nRF51-class device
(256KB of flash, 16KB of RAM), it leaves little space for innovative features
on the software side, or more complex user programs and user-space (not C++) drivers.

## Smaller int types

As noted above, when performing computations numbers are treated as doubles. 
However, when you store numbers in global variables or (soon) record fields you
can choose to use a smaller int type to save memory. Microcontrollers typically have very 
little memory left, so these few bytes saved here and there (especially in commonly 
used packages) do add up.

The supported types are:
* `uint8` with range `0` to `255`
* `uint16` with range `0` to `65536`
* `int8` with range `-128` to `127`
* `int16` with range `-32768` to `32767`
* `int32` with range `-2147483648` to `2147483647`
* `uint32` with range `0` to `4294967295`

If you attempt to store a number exceeding the range of the small int type, only
the lowest 8 or 16 bits will be stored. There is no clamping nor overflow exceptions.

If you just use `number` type (or specify no type at all) in tagged strategy,
then if the number fits in signed 31 bits, 4 bytes of memory will be used.
Otherwise, the 4 bytes will point to a heap-allocated double (all together,
with memory allocator overhead, around 20 bytes).

In legacy strategy, `number` is equivalent to `int32`, and there is no `uint32`.

### Limitations

* arrays of int types are currently not supported; you can use a `Buffer` instead
* locals and parameters of int types are not supported

## Near future work

There are following differences currently, which should be fixed soon.
They are mostly missing bridges between static, nominally typed classes,
and dynamic maps.

* default parameters are resolved at call site; they should be resolved in the
  called method so eg. virtual methods can have different defaults
* `x.foo`, where `x` is class and `foo` is method cannot be currently used as a value;
  we could make it equivalent to JavaScript's `x.foo.bind(x)`
* `Object.keys()` is currently not implemented for classes; when it will be
  the order of fields will be static declaration order
* the `delete` statement is currently disallowed; it can be implemented
  rather easily, though on classes it will just assign `undefined`
* how to validate types of C++ classes (Pin mostly)?
