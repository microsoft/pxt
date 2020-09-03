![Picture of the UF2 devices](/static/images/uf2-devices.jpg)

# One chip to flash them all

**Posted on March 28, 2017 by [mmoskal](https://github.com/mmoskal)**

**This post is about UF2 file format. For technical spec see [this repo](https://github.com/microsoft/uf2).**

In the maker's world we often use devices of similar power to the ones used in
personal computers 30 years ago.
Many things have improved since the 1980s though.
We used to program using line editors - you typed a line number
and the contents of the line of code, possibly overriding what was there before.
Now we create programs on powerful laptops in user-friendly editors.
We used to program in BASIC; now, C and C++ rule the maker's world. 
With the recent shift from 8-bit AVR to 32-bit ARM Cortex chips,
we get a sizable bump in performance and 
with a few wires and a $20 board we can use source-level step-by-step debugging.
And this is all before we even get into haircuts or quality of coffee!

The [PXT](https://github.com/microsoft/pxt) (Microsoft Programming Experience Toolkit) framework, 
on which [Microsoft MakeCode](https://makecode.com)
is based, is pushing some of these changes further - with a user-friendly
approach, where people can start learning by building code with visual blocks, and then
transition to a modern, powerful programming language, while being supported
by syntax-checking and syntax-completion as well as various hints from the editor.
All in a web-browser.

However, the way the code gets from the laptop to the board is deeply rooted
in 1980's technologies - serial wires, obscure protocols, and text-based
file formats with limited line length. Depending on exact circumstances, you
have to install serial USB drivers, select the right port and parameters,
and finally use a native application to access the board, as the browser
is not allowed to. As the advance of maker's content in educational curricula
continues, this complicated flashing process presents one of the major obstacles to adoption
in schools, where installing any software is usually domain of IT administrators.

One solution would be to rely on emerging standards, like [WebUSB](https://wicg.github.io/webusb/)
and [WebBluetooth](https://webbluetoothcg.github.io/web-bluetooth/)
to send the program from the browser to the board.
These standards are however still in their infancy, and it may take even longer before being
deployed in schools.

## Driver-less flashing with ARM mbed

Another solution was pioneered by [ARM mbed](https://www.mbed.com/en/). 
It involves two chips on the board - the target (main)
chip, and the interface chip talking via USB to the computer and via debug wires to the target.
The interface chip implements a virtual file system (more on that below) that exposes
itself to the computer as a USB pen drive. The user compiles the program in their browser
and obtains a file in [Intel HEX](https://en.wikipedia.org/wiki/Intel_HEX) format. 
The user then drags that file to the pen drive.
The interface chip detects the HEX format, and (with some buffering) flashes it via
the debug wires to the target chip. More precisely, the interface chip writes
the data to be flashed and a short flashing program into the RAM of the target, and then
executes it. No special drivers need to be installed, since operating systems support
pen drives out of the box.

The original ARM mbed solution involved sending the C++ program to the cloud
for compilation. In Touch Develop, the forefather of PXT, we improved on
this by implementing an [in-browser compiler into ARM machine code](https://www.touchdevelop.com/docs/touch-develop-in-208-bits). 
This avoids problems with school's flaky internet connections, greatly
improves responsiveness (program are ready almost instantly),
and significantly cuts the marginal costs of hosting an in-browser programming environment.

In PXT we have implemented a very similar solution, but instead of compiling from Touch Develop,
we compile from a static subset of TypeScript (a variant of JavaScript with added static types).
The [subset we support](https://makecode.com/language) is actually quite extensive, including higher-order functions, classes,
modules, meta-data annotations for blocks, and easy extensibility via C++ code.
As in Touch Develop, if the user programs using blocks, these are first compiled
into TypeScript. However, this time the user can also go back and forth between blocks and TypeScript.

The [micro:bit](https://tech.microbit.org/hardware/) architecture follows the mbed model with the interface
and target chips. However, it is difficult to convince other hardware manufacturers to double
the number of chips on their boards! We were thus looking for a driver-less flashing solution
for a new crop of boards based on a single Atmel SAMD21 chip. 

## SAMBA!

Unlike the Nordic nRF51 on the micro:bit,
the SAMD21 has a built-in USB interface. The USB support is utilized by Atmel's SAM-BA bootloader, which
implements a half-text half-binary protocol over the USB Communication Device Class (CDC) also
known as USB serial port. Arduino uses a forked version
with some protocol extensions. Typically, 8KB is reserved for the bootloader in the flash space of the SAMD21
chips, around 5KB of which is used.

The challenge then is to implement something similar to the 
[DAPLink software](https://github.com/mbedmicro/DAPLink) that runs
on ARM mbed's interface chip, but in the few kilobytes of the free bootloader space of the SAMD21. 

## Virtual File System

USB pen drives talk to the operating system on the computer using the 
[USB Mass Storage Class](https://en.wikipedia.org/wiki/USB_mass_storage_device_class) protocol.
They are often technically called MSC devices, or MSD (Mass Storage Device).
The MSC protocol essentially routes an older [SCSI protocol](https://en.wikipedia.org/wiki/SCSI) 
(used in server and work-station grade
hard drives at the turn of the century) over the USB bulk transport.
Complications are many, but the central parts are commands that the operating system sends
to read or write a block. In principle, a block can have different size, but pretty much all
USB pen drives in existence use 512 bytes. Some operating systems do not even support other sizes.

Note that this is a block-level protocol, which does not know anything about files. 
Instead, the operating system implements a file system to represent user's data.
While there are a great variety of file systems, most pen drives
are formatted using [FAT file system](https://en.wikipedia.org/wiki/File_Allocation_Table). 
Designed by Microsoft (before I was born), it is remarkably
simple and supported by most operating systems. 

FAT reserves the first few blocks of the drive for various meta-data:
* header (with lots of space for x86 bootloader code - we seem to be running in circles here)
* File Allocation Table (FAT - hence the name of the file system), 
  which for every block on the drive says if it's free or a part of a file, and in that case,
  it also specifies the index of the next block in that file
  (which doesn't have to be the next block on the drive, in case the drive is fragmented)
* a copy of the FAT (back from the days where hard drives broke more often, making certain blocks unreadable)
* root directory table, which lists files in root directory of the drive: their name, size, attributes,
  and the index of the first block in the file (subsequent block indices are read from the FAT)

To the operating system (OS), DAPLink pretends to be a pen drive of around 8MB. However, it doesn't really
have that much space to work with - for example, on the micro:bit
the target chip has 256KB of flash, and the interface chip has 64KB. 
Therefore, it exposes a virtual FAT file system. The content of this file system is small and never
changes due to OS writes - it has an informational text file and an HTML file with a redirect to the online
editing environment. Otherwise, the FAT and the root directory table are empty.
When the OS tries to read a block, the DAPLink computes what should be there dynamically,
based on compiled-in contents of the info and HTML files.

## FAT write complications

Presenting a read-only file system to the OS isn't very complicated.
The tricky bit starts when we want to interpret write operations.

When the OS tries to write a file, it will do the following:
* update the root directory table with a new entry
* update the FAT (both copies)
* write the blocks of the file itself, in accordance with the newly created FAT entries

The OS can do these steps in any order. It can also write the blocks of the file in any order.
This is because it assumes that it is talking to a simple storage device, which just writes blocks,
not something like DAPLink that tries to interpret the writes. Moreover, some OSes will write
meta-data files, right after the drive is inserted, even if the user never asked for that.
There are also different copy strategies, often involving a file rename.

When the OS writes a HEX file, DAPLink needs to discard writes to the FAT or directory table,
as well as writes of the meta-data files. It may need to deal with out-of-order writes.
All these details mean that DAPLink is quite complex and also sometimes needs to be updated
when a new OS release changes the way in which it handles FAT.
This also is the reason that some MSC bootloaders for various chips only
support given operating systems under some specific conditions.

You may ask why is it even safe to ignore the special file writes - won't the OS get confused
if it cannot find what it wrote? Here, we rely on the fact that the amounts of data written
are minuscule by modern standards, and the OS will generally cache this data. If it needs
to read the data back, it will use the cache and not the drive. Of course, if the user writes
a random file, nothing is really written to the device. If the user unplugs the device
and plugs it back in (which clears the cache) the file would have "disappeared".

## External flash to the rescue?

Some of the SAMD21 boards come with a 2MB SPI flash part. One way around the virtual FS complication
would be to have a real block-based file system on the external flash. In that case, we would only need
to implement regular block writes, and then something that interprets the existing FAT file system
to find the HEX file and write it to the internal SAMD21 flash.

This has the advantage of relative simplicity, but limits reach to boards with the flash part,
and also may eat precious flash space. Luckily, there is a better solution!

## Too many flashing formats! Let's fix it.

Let's consider the problem DAPLink has to solve. It sees 512 byte block of data to be written
at a particular block index on the device. It needs to decide if it's part of the file being
flashed and if so, extract the data and write it to the target chip.

Note that that if the block is part of the file content, it will come from an offset in the
file divisible by 512 (due to FAT file system design).
The task would be simplified then, if every 512 block of the file being
flashed was easy to distinguish from meta-data or other random files, and easy
to act on, independent of other blocks.

The HEX file format doesn't give us these properties - the 512 byte boundary can be in the middle
of the line, and even if we have an entire line, every line only contains the last 16 bit
of the address where to flash, with the upper 16 supplied only when they change.
Interestingly, you can also get upper 4 bits every now and then, but it's really another 16 bit with
12 bits of overlap in the wonderful segment-addressing mode of early x86 chips.

At this point it was clear (at least to me) that the world needed another file format.
And thus [USB Flashing Format (UF2)](https://github.com/microsoft/uf2) was born. 
It consists of 512 byte blocks, where each block contains:
* magic numbers at the beginning and end (to heuristically distinguish it from any other data 
  the OS writes)
* the address in the target chip flash where the payload should be written
* the payload data (up to 476 bytes)

## Overheads

Target chips usually can only write their flash in larger chunks. In case of SAMD21
pages are 64 bytes, but need to be erased 4 pages at once, so the effective page size is 256 bytes.
Therefore, the UF2 for SAMD21 will use only 256 out of every 512 bytes for data,
so every block can written to flash straight away.
This is still more efficient than HEX (which stores every byte as two ASCII characters and adds 20-30% overhead).
It also doesn't matter - the file is transferred at USB full speed (around 1MB per second),
and so the limiting factor is writing to flash and the entire process takes around a second.

The payload size of 256 makes it easy to convert between offsets in UF2 file and on the flash.
However, in case a board supports smaller page size than 256 bytes, one could use more data of 
every block:
for example, is the page size is 128 bytes, then three pages could be stored in each UF2 block.

Each block also can contain an optional total number of blocks in the file and the current block number.
This lets the bootloader detect the end of the transfer (by keeping bitmap of all written blocks,
as we assume some blocks can be written more than once).

In future we might add a checksum, however USB transport has its own checksums
so it doesn't seem necessary yet.

## Implementation

With the basic idea worked out (isn't it a _beautiful hack_?),
it was time to dig into the relevant specs. I wonder if anyone ever read the entire 1000-page brick that is
the USB spec. I mostly limited myself to 
[USB in a nutshell](http://www.beyondlogic.org/usbnutshell/usb1.shtml) 
and Atmel's source code.

As said before, Atmel ships a bootloader called 
[SAM-BA](http://www.atmel.com/Images/Atmel-42366-SAM-BA-Bootloader-for-SAM-D21_ApplicationNote_AT07175.pdf), 
which implements USB CDC (serial),
as well as real RS232 serial over one of the pins (I'm not sure if anyone is using that).
They also ship
an SDK called [Atmel Software Framework (ASF)](http://www.atmel.com/tools/avrsoftwareframework.aspx). 
It contains an implementation of USB MSC (mass storage), 
as well as composite descriptors needed to include MSC and CDC in one device.
The problem was that compiling just the ASF version of MSC and CDC together resulted in ~20KB binary,
way over the 8KB limit.
Thus, I needed to simplify and cut down the code to size, reimplementing a few things on the way.

The result is the [UF2-SAMD21 bootloader](https://github.com/microsoft/uf2-samd21), 
supporting a number of SAMD21 boards including
Arduino Zero and MKR1000, as well as [Adafruit Feather M0 Express](https://www.adafruit.com/products/3403) and upcoming Metro M0 Express and Circuit Playground Express.
The boards are supported with essentially the same code base, except that for some of the boards
we have additional signaling using built-in color LEDs.

### Partial flashing

During development, often only a very small part of the user program changes.
There are several levels on which UF2 and the bootloader support partial flashing (incremental update).

The simplest part is that before writing a page, the bootloader will check
if the desired contents is already present. Given that reading a page of flash
is maybe 1000x faster than writing it, it's a no-brainer.
This is already good enough for flashing over MSC, since it's dominated
by the flash write time.

Second, a UF2 file can be stripped to contain only the part of flash that needs
updating. This is easy, since every UF2 block contains the target address
and addresses do not have to be consecutive. This capability isn't used
anywhere yet though.

Third, [PXT includes checksums](https://makecode.com/partial-flashing)
for certain regions of flash in its UF2 files.
Typically, the template compiled from C++ is in different region than
the user code, so if only user code changes, there is less to flash.
When flashing over a slower but bi-directional link, such as serial or HID,
the flashing program can check if regions need updating,
and if not do not send them to the device.
This optimization is independent of the UF2 file format.


### Logging

You can use an external debugger (I used IBDAP), or a board with an
integrated debugger (Arduino Zero). They are supported by [OpenOCD](http://openocd.org/), 
which then supports [GDB](https://www.gnu.org/software/gdb/).
If you didn't know, GDB has a [somewhat more user-friendly interface](https://sourceware.org/gdb/onlinedocs/gdb/TUI.html) 
than the default one,
run `layout src` in GDB to enable it. It's also sometimes useful to switch
GDB to assembly view with `layout asm`.

This is great. However, if you put your breakpoints in USB handling routines, the
responses will not reach the OS fast enough, and it will disable the device,
thinking it locked up.
A nice logging infrastructure is therefore critical. I used a 4KB in-memory buffer,
and then an [OpenOCD script](https://github.com/microsoft/uf2-samd21/blob/master/scripts/dbgtool.js) 
to dump it. You can also just print the buffer from GDB.
You could use a serial line connected to your debugger, but it's unclear it will
be fast enough for USB responses.

### Random thoughts

A couple of thoughts, hopefully useful for people doing this sort of thing in future, maybe
for different chips:

* some tutorials will tell you that for WebUSB to work you have to declare USB version `0x0210`;
  this may be true, but newer Windows laptops will have issues, especially with SAMD21;
  just stick to `0x0200`
* on Linux and macOS `dmesg` is your friend; it gives particularly useful messages on Linux;
  on macOS it will mostly tell you that the device was blocked, and you have to unplug it,
  possibly change the USB ID, and try again
* once you get the basic USB enumeration working, you can use virtual machines for debugging
* [Wireshark](https://www.wireshark.org/) on Windows and Linux (but not macOS) can capture USB traffic;
  it sometimes helps
* state that you use power in descriptor (`0x80` - bus powered, ``250*2mA``); some USB hubs need that
* after the entire file is written, wait a bit before resetting - otherwise OSes get confused
* there is no `0` terminator at the end of a USB config descriptor
* if doing HID, make sure you return 8 bytes of zeros for ``GET_REPORT`` and other control 
  requests you ignore; 64 bytes of zeros will break Linux

And some SAMD21-specific:

* SAMD21 has ``AUTO_ZLP`` mode, where it sends a zero length packet if you ask it to transfer 
  something that is multiple of USB packet size;
  this needs to be disabled for HID and MSC bulk transfers
* do not use `at91samd bootloader` command of OpenOCD for setting fuses - 
  it is buggy and will almost brick your board;
  you can use [this script](https://github.com/microsoft/uf2-samd21/blob/master/scripts/fuses.tcl)
  instead
* do not write any additional memory locations between starting a flash write and executing a flash write 
  command
* make sure you're running at 48MHz (default is 1MHz and SAM-BA runs at 8MHz)

### Reset

The original SAM-BA bootloader requires a pin to be shorted for it to stay in the bootloader.
The Arduino fork makes it more user friendly - if the user clicks the reset button twice in quick
succession, the board stays in bootloader. 

Because the reset button is actually connected to the 
hardware reset pin of the CPU, this needs to be implemented by checking a known memory
location for a particular value. If the value is there we stay in the bootloader,
and otherwise we put this value there and wait for 500ms or so. If the wait loop finishes
without reset, the value is removed and the application is started. If the reset happens
again within 500ms, the code will then find the special value and stay in the bootloader.
Note that reset does not erase memory.

As clever as the reset trick is, in classrooms the boards are flashed quite often
and younger kids can have trouble with double-click. Because of this, the UF2 bootloader implements
the double-reset and single-reset mode - the application specifies the desired mode with a specific
bit set in the flash.

In single-reset mode, when the board is first connected to a computer (as
opposed to a battery) it stays in bootloader mode, until flashed, or until reset
is hit again. If reset is hit in application mode, the board immediately enters
the bootloader mode. This is a much more user-friendly solution, at least until
hand-over (see below) is implemented.

### MSC Handover

It is possible for the application running on the board to also support MSC, for example
exposing the external flash. In such case, if the application MSC code detects a UF2 block
being written (which is quite easy), the application can pass over control
back to the bootloader and the bootloader can finish flashing (it will never return to the application).

This will let us flash devices without hitting reset at all, giving experience similar to the micro:bit.

## Updating the updater

The bootloader should never write over its own code. It could have all sorts of unpredictable
effects. The bootloader sits in the first 8KB of flash, and it can flash the remaining 248KB. 
In fact, there are special SAMD21 flash settings (called "fuses", but they are software-only creations) 
that block writes to the bootloader section.

During development, we use a hardware debugger and OpenOCD to flash the bootloader itself (including
the fuses).
However, we also need a way to update the bootloader on user boards, without a hardware debugger.

The solution is to have a user-space application, which has a binary of a bootloader embedded in itself.
When it is run, it just reprograms the fuses, and then re-flashes the bootloader code.
It is safe as none of the bootloader code is running at that time.

The bootloader updater is then just a user-space UF2 file.

## Finishing

It turns out that 8KB is actually a lot of space! 

There was in fact space for:
* the Arduino-compatible CDC code, so [BOSSA](https://github.com/shumatech/BOSSA) flash updating 
  program can be supported
* support for writing UF2 files over the MSC interface
* support for reading contents of device flash as UF2 file (they are as easy to generate as to interpret!)
* a custom flashing protocol over HID, for which we have handover similar to the MSC handover 
  described above, but already implemented
* signalling with regular LEDs, NeoPixels, and APA pixels

There is also optional support for WebUSB, however it conflicts with newer Windows laptops.

Reading `CURRENT.UF2` file from the device is particularly interesting in case of PXT.
PXT embeds the source
code of the project in the UF2 file and (provided it's small enough) actually flashes it on the device.
UF2 files can be dragged into PXT to load the project, and now files
can be dragged directly from the device to see what code is running there and possibly modify it.

The board can be also detected based on either the special ``INFO_UF2.TXT`` file, or by parsing
the content of the `CURRENT.UF2`. This should allow some intelligence in the development 
environments in future.

Happy flashing!

