## Which hardware?
This document currently describes HW debugging on these platforms:
- CircuitPlayground Express (CPX)

# Hardware Debugging MakeCode and CODAL on CircuitPlayground Express

## About
If you ever see a panic on a CPX device (flashing light plus red and blue light pattern), here are some steps for doing hardware debugging.

**NOTE:** Currently these docs are written assuming you're running MacOS. They should work with minor modifications on Linux or WSL.

## Prerequisites
0. Ensure you've reviewed the [pxt README](https://github.com/microsoft/pxt/blob/master/README.md) and [pxt-adafruit README](https://github.com/microsoft/pxt-adafruit/blob/master/README.md) and that you can run pxt-adafruit on localhost with a local pxt-core and pxt-common-packages.
1. Ensure you have pxt, pxt-common-packages, and pxt-adafruit cloned and sym-linked together (e.g. adafruit points to local pxt/ and common-packages)
2. Install these things (or equivalent on non-mac):
    ```
    brew install openocd
    brew tap ArmMbed/homebrew-formulae
    brew install arm-none-eabi-gcc
    brew install cmake
    ```
3. Ensure "openocd" is found at /usr/local/bin/ or /usr/bin/
4. Run `openocd --version` and ensure you have at least `Open On-Chip Debugger 0.10.0`

## Building a project with local pxt and codal .cpp
### First time debugging project setup
1. Build and run pxt-adafruit on localhost and save a project in the web editor (e.g. name it "CPXDebugging")
2. In a bash shell, navigate to `.../pxt-adafruit/projects/CPXDebugging/`
3. Set these environment variables (or put them in your .bashrc):
    ```
    export PXT_FORCE_LOCAL=1
    export PXT_NODOCKER=1 
    export PXT_RUNTIME_DEV=1
    export PXT_ASMDEBUG=1
    ```
    Run `pxt help` for explanations.
4. Open the "main.ts" file in your project and add this to the top:
    ```
    namespace userconfig {
        export const SWD_ENABLED = 1;
    }
    ```
    This is only needed for CPX and tells it to stop using one of the debugging pins for the amplifier.
5. In pxt.json, change the dependency to:
    ```
    "circuit-playground": "file:../../libs/circuit-playground/"
    ```
    This tells the project to use the local circuit-playground package.
6. Delete your hexcache:
    ```
    $ cd ~/mc/pxt-adafruit/built
    $ rm -rf hexcache/
    ```
    This ensure we're building fresh bits.

### Building & Deploying
1. Ensure CPX is connected to computer by regular micro-usb cable (in addition to whatever debugger connection you may have)
2. Reset the CPX into flashing mode
3. From within `.../pxt-adafruit/projects/CPXDebugging` run `pxt`.
    This should build and deploy to the attached CPX. This builds all our .cpp libs and codal locally and creates a checkout of CODAL to `built/codal/`

## Debugging
### Connect the debugger HW
1. Connect the Particle Debugger to the SWD pins on the CircuitPlayground. Probably by:
    - soldering 3 jumpers to the CPX using this diagram:
        https://learn.adafruit.com/assets/47156
        Solder to: SWCCLK (45), SWDIO (46)
        Separately, solder to any GND pad; optionally, also solder to a 3V pad.
    - connecting those to a SWD breakout board like this:
        https://www.adafruit.com/product/2743
        - Alternatively, connect jumper cables directly to particle debugger. Pins are labelled at the bottom.
    - and then running a SWD cable to your Particle Debugger
        https://www.adafruit.com/product/4001
2. Connect the Particle Debugger to you computers USB. Ensure you see a "DAPLINK" in the USB devices.

### Start debugging
1. With the debugger connected and the debug project described above flashed on the device, run `pxt gdb` within `.../pxt-adafruit/projects/CPXDebugging`
2. You might need to hit enter once. 
3. If you encounter errors, review your project setup from above then reachout to the MakeCode team (forum.makecode.com).
4. Ensure you see a `(gdb) ` prompt without errors.
5. Ensure you see source mappings when you run `(gdb) l`

### Handy GDB commands
- Run `(gdb) log` to see the DMSG log buffer (a circular buffer of about ~2kb)
- Run `(gdb) bt` to see a backtrace from the current position
- Run `(gdb) l` to see lines of code around your current program position
- Run `(gdb) up` to move up the stack frame
- Run `(gdb) f 5` to move to the `#5` stack frame as shown by `bt`
- Run `(gdb) boot` to reboot the CPX into bootloader mode (for flashing a new program)
- Run `(gdb) q` to quit

### Handy ~/.gdbinit
This .gdbinit file tweaks a few GDB settings to make it easier to work with MakeCode hardware.
```
set print elements 10000
set history save on
set history filename ~/.gdb_history
define hook-quit
    set confirm off
end
# useful for black magic probe
set mem inaccessible-by-default off
```

### Debugging tips
- If you're stopped at a panic, look for "target_panic" in the `bt` and ignore stackframes above that.

### printf debugging loop
1. Add `DMESG("...")` print statements in your .cpp (either in codal or pxt-common-packages) and re-build and deploy (`pxt` cmd inside your project)
2. Connect GDB: `pxt gdb`
3. See the logs: `(gdb) log`

## Changing .cpp
### Codal
0. Ensure you have a debugging project setup as detailed above
1. Open codal repos in VS Code like:
    ```
    $ cd ~/mc/pxt-adafruit/projects/CPXDebugging/built/codal/libraries
    $ code *
    ```
2. Notice there should be three repos open (codal-circuit-playground, codal-core, codal-samd), some have submodules
3. Changes made to these .cpp files should automatically be rebuilt when you run `pxt` in the project dir

### pxt-common-packages
0. Ensure you have a debugging project like described above and pxt-common-packages cloned and sym-linked inside pxt-adafruit. E.g. your node_modules/ should look like:
    ```
    ~/mc/pxt-adafruit $ ls -la node_modules/ | grep pxt
    lrwxr-xr-x    1 darzu  staff     35 Aug 19 15:08 pxt-common-packages -> /Users/darzu/mc/pxt-common-packages
    lrwxr-xr-x    1 darzu  staff     19 Aug 19 14:23 pxt-core -> /Users/darzu/mc/pxt
    ```
1. Changes made to these .cpp files should automatically be rebuilt when you run `pxt` in the project dir

## Related docs
- This out of date doc on GDB with CPX: https://github.com/microsoft/pxt-adafruit/blob/master/docs/gdb.md
    - It says that you can have common GND through the USB, but this doesn't always work.