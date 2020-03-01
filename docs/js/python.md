# Python in MakeCode

Our Python support in MakeCode is called Static Python (SPY). As with TypeScript,
the Python implementation is a subset of the full Python languange.

### ~ hint

#### MakeCode Languages

See the [MakeCode Languages](/language) page for general description of coding
language support in MakeCode.

### ~

## Code translation

Python support in MakeCode works by converting SPY source code into Static Typscript (STS) and vice versa.
The translation is mostly 1:1 (that is for every statement of STS you usually get
one statement of SPY and vice versa).
The code generated in both directions is meant to be human readable.
The API surface stays largely the same between STS and SPY, except that camel case
like `onChat` are converted into snake case (e.g., `on_chat`) where
appropriate (that is excluding class and enum names; enum members are converted
to upper snake case).

### Python

```python
def on_chat():
    for i in range(100):
        mobs.spawn(CHICKEN, pos(0, 10, 0))
player.on_chat("chicken", on_chat)
```

### TypeScript

```typescript
player.onChat("chicken", function () {
    for (let i = 0; i < 100; i++) {
        mobs.spawn(CHICKEN, pos(0, 10, 0))
    }
})
```

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

## Language support

The disadvantage with this technique is that it imposes some limits in compatibility with the full Python language.

The main missing feature (from both STS and SPY) is `eval`,
and this one is very unlikely to ever change.

Currently, SPY auto-imports all STS namespaces (that is, one can say
`pins.D7.digitalWrite(True)` without saying `import pins` first).
This is mostly due to MakeCode libraries using a large number of namespaces
even in simple programs (as they map directly to block categories).

## Not supported

The following Python language features are currently not supported.

*  `-*- coding: encoding -*-` (only UTF8 is supported)
* class private names `__*` are not mangled
* complex and imaginary numbers
* big integers
* Formatted string literals (for now)
