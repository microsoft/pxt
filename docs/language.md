# PXT Language Subset

PXT programs are written in a subset of [TypeScript](https://www.typescriptlang.org). 
TypeScript itself is a superset of JavaScript, and many PXT programs,
especially at the beginner's level, are also just plain JavaScript.

PXT is meant for teaching programming first, and JavaScript second. For this
reason, we have stayed away from concepts that are specific to JavaScript (for
example, prototype inheritance), and instead focused on ones common to most
modern programming languages (for example, loops, lexically scoped variables,
functions, lambdas, classes).

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
which is then deployed to the microcontroller.

For browsers and node.js, PXT programs are compiled to 
[continuation-passing style](https://en.wikipedia.org/wiki/Continuation-passing_style)
JavaScript. This utilizes the TypeScript abstract syntax tree as input, but
does not use TypeScript JavaScript emitter.
On the plus side, this allows for [handling of async calls](/async), even if the browser
doesn't support `yield` statement, as well as cross-browser and remote
debugging. On the other hand, the generated code is not really human readable.

## Supported language features

* variables with `let`, `const`, and `var`
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
* all arithmetic operators (including bitwise operators); note that in microcontroller targets
  all arithmetic is performed on integers, also when simulating in the browser
* strings (with a few common methods)
* [string templates](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) (`` `x is ${x}` ``)
* arrow functions `() => ...`
* passing functions (with up to 3 arguments) as values
* classes with static and instance fields, methods and constructors; `new` keyword
* array literals `[1, 2, 3]`
* enums
* asynchronous functions that look [synchronous to the user](/async)
* method-like properties (get/set accessors)
* basic generic classes, methods, and functions
* class inheritance
* classes implementing interfaces (explicitly and implicitly)
* object literals `{ foo: 1, bar: "two" }`

## Unsupported language features

We generally stay away from the more dynamic parts of JavaScript. 

Things you may miss and we may implement:

* exceptions (`throw`, `try ... catch`, `try ... finally`)
* using generic functions as values
* nested generic functions
* class inheritance for generic classes and methods
* initializers for class fields
* `public`/`private` annotations on constructor arguments (syntactic sugar to make them into fields)
* binding with arrays or objects: `let [a, b] = ...; let { x, y } = ...`
* `delete` statement (on object literals)
* spread and reset operators (statically typed)

For JS-only targets we may implement the following:

* regular expressions

Things that we are not very likely to implement due to the scope of the project
or other constraints (note that if you don't know what a given feature is, you're
unlikely to miss it):

* file-based modules (`import * from ...`, `module.exports` etc); we do support namespaces
* `yield` expression and ``function*``
* `await` expression and `async function`
* `typeof` expression
* tagged templates ``tag `text ${expression} more text` ``; regular templates are supported
* `with` statement
* `eval`
* `for ... in` statements (`for ... of` is supported)
* prototype-based inheritance; `this` pointer outside classes
* `arguments` keyword; `.apply` method
* JSX (HTML fragments as part of JavaScript)

Note, that you can use all of these while implementing your runtime environment
(simulator), they just cannot be used in user's programs.

## Semantic differences against JavaScript

As such, it isn't really feasible to run a full JavaScript virtual machine
in 3k of RAM, and thus PXT programs are statically compiled to native code to run efficiently.
This causes some semantic differences:

* numbers are 32 bit signed integers with wrap-around semantics; 
  in JavaScript they are 64 bit floating points
* JavaScript doesn't have types, and therefore every value can be `undefined` or `null` 
  (which are two different values, distinct from `0` or `false`); 
  in PXT `0`, `false`, `null`, and `undefined` all have the same underlying
  representation (32 zero bits) and thus will test as equal

## Static compilation vs a dynamic VM

PXT programs are compiled to native code. The native targets include ARM Thumb,
and an unfinished AVR port.

The execution strategy is more similar to C# or Java, rather than typical JavaScript engines,
i.e., much closer to the metal.
* integers, (upcoming) single precision floating point numbers, and booleans are all passed 
  around unboxed
* objects use reference counting
* classes are laid out using static type information (like in C), so there is little memory overhead

PXT also supports dynamic objects (also reference counted), which are essentially string-to-value
mappings - these have much higher memory overhead, and would be typically the only thing available
in a dynamic language.

All of this lends itself to significant performance improvements over typical dynamic VM implementations:
* user programs are compiled directly to machine code, and are
  never in any byte-code form that needs to be interpreted; this results in execution
  10-20x faster than a typical JS interpreter
* there is no RAM overhead for user-code - all code sits in flash; in a dynamic VM
  there are usually some data-structures representing code
* due to lack of boxing and static class layout the memory consumption for objects
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
in the language, as explained above.

While it is possible to run a dynamic VM even on an nRF51-class device
(256KB of flash, 16KB of RAM), it leaves little space for innovative features
on the software side, or more complex user programs and user-space (not C++) drivers.

## Smaller int types

As noted above, when performing computations numbers are treated as signed 32 bit
integers. However, when you store numbers in global variables or (soon) record fields you
can choose to use a smaller int type to save memory. Microcontrollers typically have very 
little memory left, so these few bytes saved here and there (especially in commonly 
used packages) do add up.

The supported types are:
* `uint8` with range `0` to `255`
* `uint16` with range `0` to `65536`
* `int8` with range `-128` to `127`
* `int16` with range `-32768` to `32767`

There is also `int32` type, but it's the same as `number`.

If you attempt to store a number exceeding the range of the small int type, only
the lowest 8 or 16 bits will be stored. There is no clamping nor overflow exceptions.

### Limitations

* arrays of int types are currently not supported; you can use a `Buffer` instead
* locals and parameters of int types are not supported
* there is no `uint32` type - all numbers are treated as signed
