## Simulator

### Enums

Enums (and interfaces) can be shared between simulator and the target libraries
if you put them in the library, in `.d.ts` file, and then reference these
files from the simulator.

## Compilation to ARM native code

If your target platform is ARM Mbed compatible, PXT will be able to compile programs to ARM machine code in browser.
We recommend to contact the team to help you get started on this topic.

## Async functions

PXT support cooperative multithreading and implicit async functions.
[See more](/async).
