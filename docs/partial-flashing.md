# Partial flashing

**This is draft spec**

When working interactively and re-flashing the device frequently, it is often
the case that only small part of the program changes (for example, the runtime
stays the same). For best (fastest) user experience, it is thus desirable to
only flash the parts that changed.

If there is a fast link between the computer, the MCU doing the flashing,
and MCU being flashed (the last two can be the same), then it's possible
to just read every page to see if it needs re-flashing. This is a very robust,
simple and effective solution, and works great for example in
case of a MSD bootloader and no separate interface chip.

OTOH, if some of the links are slower, it's desirable to include some meta-data
to aid with partial flashing. This is especially true over various radio connections.

This document defines a format for specifying checksums for regions of flash.

## Checksum block

| Offset | Size | Value                                             |
|--------|------|---------------------------------------------------|
| 0      | 4    | Magic number: `0x07eeb07c` or `0x87eeb07c`        |
| 4      | 4    | Position of end marker (32-bit aligned)           |
| 8      | 4    | End marker value and page size                    |
| 12     | 8    | Region 0                                          |
| ...    | ...  | Region ...                                        |
| ...    | 4    | `0x00000000` - regions terminator                 |

All numbers are little endian.

The magic number of `0x87eeb07c` indicates that the bootloader
should optimize for frequent re-flashing (for example, by starting after a
single (and not double) click on the reset button).  The magic number `0x07eeb07c`
indicates no such preference.

The end marker is used to mitigate partial flashing. It should be
either random, or derived from checksum of the entire program.
It should be placed so it is written at the end of the flashing
process (typically at the end of the program).
The flashing process should check if flash contains the end marker
at indicated position. If it doesn't, the entire checksum block
should be treated as invalid.

The low-order byte of the end marker value should contain page size,
in powers of two. If end marker is `X`, then page size is `1 << (X & 0xff)`.

### Region descriptor

| Offset | Size | Value                                             |
|--------|------|---------------------------------------------------|
| 0      | 2    | First page                                        |
| 2      | 2    | Number of pages                                   |
| 4      | 4    | Application-specific checksum                     |

The checksum can be computed in any way by the application.
For example, one can take first 4 bytes of a SHA256 of the contents of
the region.

There is no need for region descriptors to cover the entire flash, or even the 
entire contents of the flashed file. If there is no region descriptor
for a given location in the flashed file, the location should always be flashed.

## Typical usage

For example, on micro:bit one would have the following regions:
* bootloader + softdevice
* DAL + compiled C++ code
* user code

On SAMD21 one wouldn't have the bootloader and softdevice regions, as bootloader is normally
not included in .UF2 files and there is no softdevice.

The checksum for user code may or may not be included. It can prevent re-flashing of 
the exact same user code, but this isn't a very common usage scenario.

## Position of the checksum block

The position of the checksum block is MCU-specific.

* SAMD21 - `0x20B4` (after application vectors, plus one word reserved by Arduino)
* nRF51 - `0x100010C0` (`CUSTOMER[16]` and onwards in UICR)
