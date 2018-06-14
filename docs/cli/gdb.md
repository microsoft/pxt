# pxt-gdb Manual Page

### @description Attempt to start OpenOCD and GDB

```
pxt gdb [ARGUMENTS ...]
```
## Options

* ``[ARGUMENTS ...]`` All additional arguments are passed to GDB.

## Installation #installation

Make sure that OpenOCD and GDB are available and in your path.

## Description #description

Connect GDB to the code running on the device.

In order to use this command, open a command prompt in the folder of your package.
Then run

   pxt gdb

# GDB debugging 

You can run GDB on PXT target boards that support OpenOCD. This can be either with an on-board
interface chip (Arduino Zero or the micro:bit), or with an external programmer like the IBDAP.

Currently, you will only be able to debug the C++ code, and not TypeScript code.

## Connecting IBDAP #ibdap

IBDAP is a cheap programmer that happens to work.

If your board has a Cortex Debug connector (a 0.05in pitch, 10 pin connector, about 10mm long),
you can connect directly. If there is no direction indicator, try both ways.
These include Metro and MKR1000.

If your board has no connector (Adafruit Feather, Adafruit Circuit Playground Express), you will need to solder two cables to ``SWDIO`` and
``SWDCLK`` small pin-pads on the board. Best solder cables that have female socket on the other side,
which can be connected to the 20-pin connector.

Also, solder (or attach using crocs) similar cables to ``GND`` and ``3.3V``. These two are not strictly
necessary, if you connect USB to both programmer and the board - they will share ground through
the computer and the board will take power from the computer.

Connect the small `TGT_DBG` Cortex Debug controller on the IBDAP to the 10-to-20-pin converter (included with IBDAP).
Then connect pins you soldered to ``VCC`` (1), ``SWDIO`` (7), ``SWDCLK`` (9), and ``GND`` (eg to 20).

For reference, the 20 pin connector:

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

You can also find pin outs in the [IBDAP user manual](https://cdn-shop.adafruit.com/product-files/2764/2764+user+manual.pdf).

After you connect everything, make sure to reset IBDAP (using `RESET` button), especially if you're
seeing a `CRP DISABLD` drive. Reset should make it go away. You may need to reset every time you
connect IBDAP.

## Running GDB #runninggdb

Now, go to directory where you want to debug. It can be a library with a test TypeScript file.
Run `pxt` to build the native image. Make sure it uses local build (``yotta`` or ``CODAL``). It should start running on the board.

Run `pxt gdb` or `pxt gdb -tui`. You should see the target in halted state. You can set breakpoints
with `b` command and re-start the program using `r`. You can also look at the stack with `bt`.

Unfortunately, restarting only works if the target is not locked up handling a hard fault.
If you find that to be the case, you can add a delay at the start of your program.

## See Also

[pxt](/cli) tool, [pxt build](/cli/build)
