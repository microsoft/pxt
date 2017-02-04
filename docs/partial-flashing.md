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
| 4      | 4    | Position of end marker                            |
| 8      | 4    | End marker value and page size                    |
| 12     | 8    | Region 0                                          |
| ...    | ...  | Region ...                                        |
| ...    | 4    | `0x00000000` - regions terminator                 |

The magic number of `0x87eeb07c` indicates that the bootloader
should optimize for frequent re-flashing (for example, by starting after a
single (and not double) click on the reset button).  The other number
indicates no such preference.

The end marker is used to mitigate partial flashing. It should be
either random, or derived from checksum of the entire program.
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

## Typical usage

For example, on micro:bit one would have the following regions:
* bootloader + softdevice
* DAL + compiled C++ code
* user code

On SAMD21 one wouldn't have the bootloader and softdevice regions, as bootloader is normally
not included in .UF2 files.

## Position of the checksum block

* SAMD21 - `0x20B0`
* nRF51 - in UICR (TBD)
