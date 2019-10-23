# Python Support

**Python support in MakeCode is experimental**

We currently refer to TypeScript version supported by MakeCode as Static TypeScript (STS)
and, consequently, our Python is called Static Python (SPY).
These names may change in future.

Python support in MakeCode works by converting SPY source code into STS and vice versa.
The translation is mostly 1:1 (that is for every statement of STS you usually get
one statement of SPY and vice versa).
The code generated in both directions is meant to be human readable.
The API surface stays largely the same between STS and SPY, except that camel case
like `onChatCommand` are converted into snake case eg `on_chat_command` where
appropriate (that is excluding class and enum names; enum members are converted
to upper snake case).

This approach has the following advantages:
* the blocks to code and code to blocks is supported for both STS and SPY
  (in case of SPY there is an intermediate conversion to STS)
* the same high-performance runtime is used across STS and SPY
  (it's typically 10-100x faster than embedded interpreters)
* documentation can be converted automatically
* as the SPY->STS converter infers types, the SPY editor supports
  smart autocompletion, contextual doc-comment display, etc.
* features like debugger are easily shared between SPY and STS

The type annotations are technically optional in both STS and SPY -
TypeScript `any` type is supported in the runtime with dynamic member lookup
(though it still uses compact C++-like memory layout for classes).
Some of this have not been fully implemented or exposed to the user yet though.

The disadvantage is some limitations in compatibility with the full Python language.

The main missing feature (from both STS and SPY) is `eval`,
and this one is very unlikely to ever change.

Currently, SPY auto-imports all STS namespaces (that is one can say
`pins.D7.digitalWrite(True)` without saying `import pins` first).
This is mostly due to MakeCode libraries using a large number of namespaces
even in simple programs (as they map directly to block categories).


## Not supported

The following are currently not supported.

*  `-*- coding: encoding -*-` (only UTF8 is supported)
* class private names `__*` are not mangled
* complex and imaginary numbers
* big integers
* Formatted string literals (for now)
