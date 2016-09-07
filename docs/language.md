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
microcontroller), even though for most targets it's the only environment.

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
does not utilize TypeScript JavaScript emitter.
On the plus side, this allows for [handling of async calls](/async), even if the browser
doesn't support `yield` statement, as well as cross-browser and remote
debugging. On the other hand, the generated code is not really human readable.
See also [issue #51](https://github.com/Microsoft/pxt/issues/51).

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
* object literals `{ foo: 1, bar: "two" }`

## Unsupported language features

We generally stay away from the more dynamic parts of JavaScript. 

Things you may miss and we may implement:

* exceptions (`throw`, `try ... catch`, `try ... finally`)
* classes implementing interfaces
* using generic functions as values
* nested generic functions
* class inheritance for generic classes and methods
* initializers for class fields
* `public`/`private` annotations on constructor arguments (syntactic sugar to make them into fields)

For JS-only targets we may implement the following:

* regular expressions

Things that we are not very likely to implement due to the scope of the project
or other constraints (note that if you don't know what a given feature is, you're
unlikely to miss it):

* file-based modules (`import * from ...`, `module.exports` etc); we do support namespaces
* spread operator
* `yield` expression and ``function*``
* `await` expression and `async function`
* `typeof` expression
* tagged templates ``tag `text ${expression} more text` ``; regular templates are supported
* binding with arrays or objects: `let [a, b] = ...; let { x, y } = ...`
* `with` statement
* `eval`
* `delete` statement
* `for ... in` statements (`for ... of` is supported)
* JSX (HTML as part of JavaScript)
* prototype-based inheritance; `this` pointer outside classes
* `arguments` keyword; `.apply` method

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
