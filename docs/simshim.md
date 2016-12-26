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
In both cases, PXT will copy over all JSDoc style comments and `//%` annotations,
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

PXT implements a simple parser for a fragment of C++. This parser will not handle
everything you throw at it. In particular, it is line based and doesn't take
multi-line comments (other than doc comments) very well. To comment out a piece of C++
code use `#if 0 .... #endif`.

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

## Indexed Instances

A typical pattern to expose pins on a device is something like follows:

```cpp
class DeviceIO {
  public:
    DevicePin pins[0];
    //% indexedInstanceNS=pins indexedInstanceShim=pins::getPin
    //%
    DevicePin A0;
    //%
    DevicePin A1;
    ...
};

namespace pins {
  DeviceIO io;
  //%
  DevicePin *getPin(int id) {
    // ... add range checking ...
    return &io.pins[id];
  }
}

namespace DevicePinMethods {
  //% blockId=device_get_digital_pin block="digital read|pin %name" blockGap=8
  //% blockNamespace=pins
  int digitalRead(DevicePin *name) {
    return name->getDigitalValue()
  }
  ...
}
```

This will result in the following declarations being generated:

```typescript
declare namespace pins {
    //% fixedInstance shim=pins::getPin(0)
    const A0: DevicePin;
    //% fixedInstance shim=pins::getPin(1)
    const A1: DevicePin;
    ...
}

declare interface DevicePin {
    //% blockId=device_get_digital_pin block="digital read|pin %name" blockGap=8
    //% blockNamespace=pins shim=DevicePinMethods::digitalRead
    digitalRead(): number;
    ...
}
```

The `indexedInstanceShim` generates the `shim=...(no)` annotations.
They instruct the access to the variable (which is read-only) to be
compiled as call the the specified function with the specific literal
argument. The `fixedInstance` annotation is automatically generated  
[for blocks](/defining-blocks#Fixed-Instance-Set).

The namespace `FooMethods` is turned into an `interface Foo`. These
are usually used to wrap native C++ classes that require no reference
counting. Thus, you also need to manually add the following TypeScript:

```typescript
//% noRefCounting
interface DevicePin {
    // no methods needed, they come from C++
}
```

If you don't, the runtime will call method that do not exists and
chaos will prevail (even though you might not see it at the beginning).

You can also specify inheritance in such a declaration:

```typescript
//% noRefCounting
interface AnalogPin extends DigitalPin {}
```
