# On-device Software Debugger

PXT supports debugging the generated TypeScript code. This is done via
a USB HID interface implemented in software and doesn't require an interface 
(debugging) chip. The USB HID interface uses 
[HF2 protocol](https://github.com/microsoft/uf2/blob/master/hf2.md).
Messages from the host (computer connected to the device being debugged)
are handled in the USB interrupt of the device.

Debugging needs to be enabled during compilation. The switch will cause breakpoint
code to be inserted before every statement. It's possible to enable debug for all
TypeScript code, or only user code (i.e, excluding everything under `pxt_modules/**`).

## Debugger features (TODO)

* [x] inspecting globals (including `uint16` and friends)
* [x] inspecting tagged values, doubles, strings, buffers
* [x] `debugger` statement support
* [x] step-into support
* [x] step-over support
* [x] continue support
* [x] inspecting locals in current function, and up the call stack

* [ ] stack-walking with first-class functions
* [ ] inspecting contents of records
* [ ] inspecting contents of arrays
* [ ] inspecting contents of maps
* [ ] inspecting contents of reference-locals (captured ones)
* [ ] inspecting active threads
* [ ] user-defined breakpoints (other than `debugger` statement)
* [ ] handling of non-intentional faults (right now we get infinite loop; not sure how useful this is without GDB)

## Debugger implementation

The debug mode is controlled by the first global variable. In C++ code it's
referred to as `globals[0]`, while in assembly it's `[r6, #0]` (`r6` holds `globals`
while TypeScript code is executing).

The C++ side of the code sits in `hf2.cpp` file in `core` library (in `pxt-common-packages`).
Current link: https://github.com/microsoft/pxt-common-packages/blob/dbg/libs/core/hf2.cpp#L182

There are currently 4 possible values of `globals[0]`
* a valid heap address, somewhere in the middle - normal execution
* `0` - debugger connected, no single stepping mode
* `1` - debugger connected, step-into mode
* `3` - debugger connected, step-over mode (replaced with `0` on first hit)

The host will start by resetting the device into debug mode with a specific HF2
message. This causes `globals[0]` to be set to `1`.
After that, the device will send a message to the host saying it's halted.
Then the host will eventually set `globals[0]` to `0`, `1` or `3` and
resume execution via another HF2 message.

TS `debugger` statement is translated into a word fetch from `globals[0] - 4`.
In any mode other than the normal execution, it will cause a fault - either alignment fault
or accessing memory at `0xfffffffc`.

```
    ldr r0, [r6, #0]
    subs r0, r0, #4
    ldr r0, [r0, #0]
```

Additionally, in front of all other statements, provided debugging is enabled,
we try to load memory location pointed to by `globals[0]`. If `globals[0]`
is `1` or `3` (but not `0` or valid heap address), this will cause alignment fault.

```
    ldr r0, [r6, #0]
    ldr r0, [r0, #0]
```

All hard faults are caught by a single handler. It then looks at
the instruction causing fault and if it is `ldr r0, [r0, #0]`,
it will return to a function which pauses all other user
fibers and executes `fiber_sleep()` in a loop.
It also sends a HF2 message to the host stating that the device
if halted. At some point, a HF2 message from the host clears
a flag causing the loop to stop and the device to resume execution after the 
`ldr r0, [r0, #0]` instruction (after unpausing all other user fibers).

This is enough to support step-into and continue modes of operation.
To support step-over, a instructions sequence similar to the one above 
is used at the entry of every procedure, before even the `push {lr}`:

```
    ldr r0, [r6, #0]
    ldr r0, [r0, #4]
```

If the fault handler detects the fault instruction to be `ldr r0, [r0, #4]`
and `globals[0]` is `3` it sets `globals[0]` to `0` and modifies the
contents of `lr` register by setting its highest bit. In all cases, when it's done,
it just resumes execution after the `ldr r0, [r0, #4]` instruction
(without entering the pause loop).

Thus, in step-over mode, entry to any user procedure will set `globals[0]` to
`0` preventing further instruction breakpoints from firing. When this particular
function tries to return, we get another fault, where the `pc` is set to
an address with highest bit set. This is detected, the `globals[0]` is set 
back to `3`, the `pc` is corrected and execution continues.



