# Error codes

When a program crashes you can often see an error code.
It's a 3-digit number, usually shown with a frowny face.
You can trigger your own error code by calling `control.panic(code)`.

## Invalid cast codes

When static type of `x` is a class `C`, the dynamic type
of `x` isn't `C`, and you try to access a field on `x` or call a method
on `x`, you will get one of the following codes, depending on dynamic
type of `x`.

* **980** - when `x` is `undefined`
* **981** - when `x` is `true` or `false`
* **982** - when `x` is a number
* **983** - when `x` is a string
* **984** - when `x` is object of some type
* **985** - when `x` is a function
* **989** - when `x` is `null`

## Other codes

* **907** - a required configuration setting (in `config` namespace) is missing
* **908** - a required pin was not defined (also in `config` namespace)
* **910** - memory limit exceeded (only on Linux targets)
* **914** - TypeScript code was called from interrupt service routine
* **915** - heap dumped - the code is waiting for debugger to load the heap

## Codal codes

* **020** - out of memory in Codal heap - too many events or fibers
* **021** - out of memory in GC heap - too many objects
* **030** - heap error (memory corruption)
* **040** - null dereference
* **050** - USB error
* **090** - hardware configuration error - likely using wrong pin for SPI/I2C/PWM/etc

## Internal error codes

You should not see these.

```
    PANIC_INVALID_BINARY_HEADER = 901,
    PANIC_OUT_OF_BOUNDS = 902,
    PANIC_REF_DELETED = 903,
    PANIC_SIZE = 904,
    PANIC_INVALID_VTABLE = 905,
    PANIC_INTERNAL_ERROR = 906,
    PANIC_INVALID_ARGUMENT = 909,
    PANIC_SCREEN_ERROR = 911,
```

The error codes in the `800-899` are even more internal:

* **84X** - garbage collector errors
