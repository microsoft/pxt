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

The [type mapping](/cpp2ts) from C++ to TypeScript is quite limited.
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

If you're adding your own C++ or assembly functions in packages
and you either cannot or don't want to add a corresponding function to the simulator,
you can provide a simulator-only implementation. For example:

```typescript-ignore
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

```typescript-ignore
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
compiled as a call to the specified function with the specific literal
argument. The `fixedInstance` annotation is automatically generated 
for [blocks](/defining-blocks#Fixed-Instance-Set).

The namespace `FooMethods` is turned into an `interface Foo`. These
are usually used to wrap native C++ classes that require no reference
counting. Thus, you also need to manually add the following TypeScript:

```typescript-ignore
interface DevicePin {
    // no methods needed, they come from C++
}
```

If you don't, the runtime will call methods that don't exist and
chaos will prevail (even though you might not see it at the beginning).

You can also specify inheritance in such a declaration:

```typescript-ignore
interface AnalogPin extends DigitalPin {}
```

## Configuring instances from TypeScript

The method above with `indexedInstanceShim` works well when the set of instances
(eg. pins) is defined in C++. However, sometimes you will want to define these on the
TypeScript side, potentially limiting code size, and allowing the definitions to be
changed without altering the C++ code (and thus avoiding cloud recompilation).

This comes in handy especially when there are multiple boards defined in one target.
The [core board package](/targets/board) includes at least two configuration files. Here,
we use `device.d.ts` and `config.ts`, but you can call them something else.

You would then use something like this:

```typescript-ignore
// In device.d.ts
declare namespace pins {
    //% fixedInstance shim=pxt::getPinById(PIN_A0)
    const A0: PwmPin;
    //% fixedInstance shim=pxt::getPinById(PIN_A1)
    const A1: PwmPin;
    // ...
}
```

The C++ function `pxt::getPinById(int pinId)` would lookup a pin object given its hardware
name, allocating the object first if it hasn't been allocated yet.

The definition of `PIN_A0` etc. comes in `config` namespace:

```typescript-ignore
// In config.ts
namespace config {
    export const PIN_A0 = DAL.PA02;
    export const PIN_A1 = DAL.PB08;
    // ...
    export const NUM_NEOPIXELS = 1;
    // ...
}
```

You can configure pin names and other hardware characteristics too, like the number of
on-board neopixels, etc.

The user can override the constants using the `userconfig` namespace. For example:

```typescript-ignore
// In main.ts or other user file
namespace userconfig {
    // My board has PIN_D2 and PIN_D4 swapped!
    export const PIN_D2 = DAL.PA08;
    export const PIN_D4 = DAL.PA14;
}
```

Both of these refer to constants from the `DAL` namespace. There is typically one
`dal.d.ts` file per target which defines the `DAL` namespace, and it is generated 
automatically from the C++ sources. Once all the C++ files are in place, and you
want to force re-generation of `dal.d.ts`, use the `pxt builddaldts` command.

For every constant `FOO` in `config` (or `userconfig`), there has to be a corresponding
`DAL.CFG_FOO` that defines an index under which the configuration setting is stored.
The indexes for settings can be any 32 bit number, but they should be unique within a target.
These are typically defined in a C++ header file:

```cpp
#define CFG_PIN_A0 100
#define CFG_PIN_A1 101
#define CFG_PIN_A2 102
// ...
#define CFG_NUM_NEOPIXELS 200
// ...
```

On the C++ side, the setting `PIN_A0` is accessed with `pxt::getConfig(CFG_PIN_A0)`.

The arguments in annotations like `shim=pxt::getButtonByPin(PIN_A5,BUTTON_ACTIVE_LOW_PULL_UP)`
are resolved in the `DAL` namespace, then in `userconfig` and in `config`.
They must resolve to an integer constant.
