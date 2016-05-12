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
* `for(;;)` loops (see below about `for ... in/of`)
* `break/continue`; also with labeled loops
* `switch` statement (on numbers only)
* `debugger` statement for breakpoints
* conditional operator `? :`; lazy boolean operators
* namespaces (a form of modules) 
* all arithmetic operators (including bitwise operators); note that in microcontroller targets
  all arithmetic is performed on integers, also when simulating in the browser
* strings (with a few common methods)
* [string templates](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) (`` `x is ${x}` ``)
* arrow functions `() => ...`
* classes with fields, methods and constructors; `new` keyword
* array literals `[1, 2, 3]`
* enums
* asynchronous functions that look [synchronous to the user](/async)

## Unsupported language features

We generally stay away from the more dynamic parts of JavaScript. 

Things you may miss and we may implement:

* exceptions (`throw`, `try ... catch`, `try ... finally`)
* `for ... of` statements
* object literals `{ foo: 1, bar: "two" }`
* method-like properties (get/set accessors)
* class inheritance

For JS-only targets we may implement the following:

* regular expressions
* classes implementing interfaces

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
* `for ... in` statements
* JSX (HTML as part of JavaScript)

Note, that you can use all of these while implementing your runtime environment
(simulator), they just cannot be used in user's programs.
