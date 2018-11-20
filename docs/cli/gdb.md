# pxt-gdb Manual Page

### @description Attempt to start OpenOCD and GDB

```
pxt gdb [ARGUMENTS ...]
```
## Options

* ``[ARGUMENTS ...]`` All additional arguments are passed to GDB.

## Installation #installation

* Installing support for ``NRF52 boards`` in Arduino **desktop** IDE. The `pxt gdb` command will look for OpenOCD and GDB in Arduino IDE packages directory.
* On Windows, use [zadig](https://zadig.akeo.ie/) to install USB drivers.

If you don't have Arduino IDE take a look at the last section of this document.

## Description #description

Connect GDB to the code running on the device.

In order to use this command, open a command prompt in the folder of your package.
Then run:

```
pxt gdb
```

### ~ hint

Note that you need to build locally for that to work. Use `--local` to build or deploy.

### ~

# GDB debugging 

You can run GDB on PXT target boards that support OpenOCD. This can be either with an on-board
interface chip (Arduino Zero or the micro:bit) or with an external programmer like the IBDAP.

Currently, you will only be able to debug the C++ code, and not TypeScript code.

### ~ hint

Use ``pxt dmesg`` to read the DMESG buffer without going into gdb.

### ~

## Connecting IBDAP #ibdap

IBDAP is a cheap programmer that happens to work. Another one that we found to work,
especially with STM chips, is STLink V2.

If your board has a Cortex Debug connector (a 0.05in pitch, 10 pin connector, about 10mm long),
you can connect to it directly. If there is no direction indicator, try both ways.
These include the Metro and MKR1000 boards.

If your board has no connector (Adafruit Feather, Adafruit Circuit Playground Express), you will need to solder two cables to the ``SWDIO`` and ``SWDCLK`` small pin-pads on the board. It's best to solder cables that have female socket on the other side,
which can be connected to the 20-pin connector.

Also, solder (or attach using crocs) similar cables to ``GND`` and ``3.3V``. These two are not strictly
necessary, if you connect USB to both programmer and the board - they will share ground through
the computer and the board will take power from the computer.

Connect the small `TGT_DBG` Cortex Debug controller on the IBDAP to the 10-to-20-pin converter (included with IBDAP).
Then connect pins you soldered to ``VCC`` (1), ``SWDIO`` (7), ``SWDCLK`` (9), and ``GND`` (eg to 20).

For reference, the 20 pin connector pinout:

```
+---------------+
| 1 VCC  2      |
| 3      4  GND |
| 5      6  GND |
| 7 SIO  8  GND |
  9 SCL  10 GND |
  11     12 GND |
| 13     14 GND |
| 15     16 GND |
| 17     18 GND |
| 19     20 GND |
+---------------+
```

You can also find pinouts in the [IBDAP user manual](https://cdn-shop.adafruit.com/product-files/2764/2764+user+manual.pdf).

After you connect everything, make sure to reset IBDAP (using `RESET` button), especially if you're
seeing a `CRP DISABLD` drive. A reset should make it go away. You may need to reset every time you
connect IBDAP.

## Running GDB #runninggdb

Now, go to the directory where you want to debug. It can be a library with a test TypeScript file.
Run `pxt deploy --local` to build the native image. Make sure it uses a local build (``yotta`` or ``CODAL``). It should start running on the board.

Run `pxt gdb` or `pxt gdb -tui`. You should see the target in halted state. 

* use `b` to set breakpoints command 
* re-start the program using `rst`
* look at the stack with `bt`.
* `boot` to restart in bootloader mode. 
* `log` to see ``DMESG``

Unfortunately, restarting only works if the target is not locked up handling a hard fault.
If you find that to be the case, you can add a delay at the start of your program.

## Running ``gdb`` manually

If you don't have Arduino or just want to run everything manually instead of using
`pxt gdb`, then you need to have `openocd` and `gdb` in your path, and then run
something like the following:

```
arm-none-eabi-gdb --eval "target remote | openocd -f interface/stlink-v2.cfg -f target/stm32f4x.cfg -f debug.cfg" built/codal/build/STM32
```

The `stlink-v2` and `stm32f4x` parts will depend on the board you're using.
`STM32` depends on your, target - just see what's inside `built/codal/build`.

The `debug.cfg` (in package folder) should contain the following:

```
gdb_port pipe
gdb_memory_map disable

$_TARGETNAME configure -event gdb-attach {
    echo "Halting target"
    halt
}

$_TARGETNAME configure -event gdb-detach {
    echo "Resetting target"
    reset
}
```

## See Also

[pxt](/cli) tool
, [pxt hidserial](/cli/hidserial)
, [pxt hiddmesg](/cli/hiddmesg)
, [pxt serial](/cli/serial)
