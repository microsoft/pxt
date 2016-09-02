# Auto-generation of library files

The APIs visible to PXT user (as TypeScript functions/classes or blocks)
expose behaviors defined in the C++ library files (in case of hardware targets)
and also the JavaScript simulator (runtime environment).
These are defined in TypeScript files (usually ``.d.ts``) under `/libs` folder
in the target definition. Let's call these **shim files**.

The definitions in shim files include JSDoc comments and
annotations starting with `//%`. In particular, `//% shim=foo::bar` means
that the current function should be mapped to the C++ function `foo::bar`
and also to the simulator function `pxsim.foo.bar`.

PXT can generate shim files from either C++
in case of hardware targets, or from the simulator sources.
In both cases, PXT will copy over all JSDoc style comments and `//%` annotions,
add `shim=...` annotation, and also map the type appropriately (for example, C++ `int` type
is mapped to `number`, and TypeScript `RefAction` to `()=>void`).
We refer to the information copied as API meta-data.

## Auto-generation from C++

In case of hardware targets, the API meta-data should be defined in C++, and not the simulator.
This is mostly because debugging mismatches on the C++ side is much harder than on the JS
side.

The shims are generated per-package under `/libs` when building the target.
The shims files are called `shims.d.ts` and `enums.d.ts`. Enums are generated
separately, so that they can be `<referenced ...>` from simulator sources.

Both files should be listed in `"files"` section of `pxt.json`, and we also recommend
they are checked into git.

Checkout the [microbit target](https://github.com/Microsoft/pxt-microbit) for an example.

## Auto-generation from the simulator

This should be used in case of software-only targets.

The shim file is called `sims.d.ts` and is generated from `/sim/*.ts` while building
the target. The file will be generated in the `"corepkg"` of the target. In future, we may
allow splitting between packages. Similarly, to the C++ generation, `sims.d.ts` should
be included in `pxt.json` and checked in.

Checkout the [sample target](https://github.com/Microsoft/pxt-sample) for an example.

### functionAsync handling

A function (or method) named `fooAsync` will be exposed as `foo`. It is expected
to return a promise. This will generate `//% promise` annotation, which will let
the compiler know about this calling convention.

### Legacy async handling

The simulator function can also get hold of a callback function using `getResume()`
and then call the resulting function when the function is supposed to resume.
You need to include the ``//% async`` annotation in that case.

## Simulator implementations

If you're adding your own C++ or assembly functions [in packages](/packages)
and you either cannot or don't want to add a corresponding function to the simulator,
you can provide a simulator-only implementation. For example:

```js
/**
 *  Writes to the Bluetooth UART service buffer.
 */
//% blockId=bluetooth_uart_write block="bluetooth uart write %data" blockGap=8
//% shim=bluetooth::uartWrite
export function uartWrite(data: string): void {
    // dummy implementation for simulator
    console.log("UART Write: " + data)
}
```

Notice the `shim=` annotation. In C++ you would have just this:

```cpp
namespace bluetooth {
  //%
  void uartWrite(StringData *data) {
    // ...
  }
}   
```

When PXT sees a call to function annotated with `shim=`, it will always use the
shim in the native compilation. In simulator compilation it will use the shim only
if the function has no body or empty body. If you don't want your simulator implementation
to do anything, you can for example put a single `return` statement as the body.
