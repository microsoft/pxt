![Resetting UNO](/static/blog/fork.jpg)

# Bootloader with a fork

**Posted on October 17, 2017 by [mmoskal](https://github.com/mmoskal)**

After building the [UF2 bootloader for SAMD21](https://makecode.com/blog/one-chip-to-flash-them-all), 
I had the pleasure of scaling
it up to a particular Linux embedded board
and now I was able to scale it down to the AVR level, namely the world-famous
Arduino UNO. 

The UNO has two AVR chips -- the main one is ATmega328p (the big thing)
and ATmega16u2 dedicated to handling USB (it was a smaller ATmega8u2 in
previous iterations of UNO, but is the version with 16k of flash in the most recent
and common R3).

The main chip sports a 512 byte bootloader (called [optiboot](https://github.com/Optiboot/optiboot))
which speaks STK500 protocol over a serial wire.
The USB chip has two firmwares: one for updating it's own firmware over
standard USB DFU protocol (this is the first time I see this protocol
actually used for something!), and the 
[main one](https://github.com/arduino/Arduino/tree/master/hardware/arduino/avr/firmwares/atmegaxxu2/arduino-usbserial) 
which forwards USB serial to the serial wire of the main chip.

Tools like `avrdude` talk the STK500 protocol, and the firmware on 16u2
just forwards it.
Thus, the task was to replace this firmware with something
exposing a virtual FAT file system and talking STK500 to the optiboot
to do the actual flashing when an UF2 file is written.

This was refreshingly easy thanks to the [LUFA library](http://www.fourwalledcubicle.com/LUFA.php) and of course
the benefit of experience.

My first task was to flash something to the 16u2. This requires rebooting it
in DFU mode. To do that, locate the six pin header next to the USB plug
and short for half second or so the two pins closest to the plug. I have typically
used a fork to short them, which worked really well. Do not use plastic fork though,
even a compostable one.

I initially used the LUFA CDC Serial + Mass Storage example wanting to maintain
compatibility with `avrdude` etc. After some debugging -- there are two bits available for
logging: the RX and TX LEDs -- I figured that USB endpoint configuration was failing.
A quick look in the datasheet revealed that 16u2 has only 5 USB endpoints,
but I was trying to use six:
one is for USB control, three for CDC (in, out, and one interrupt control endpoint,
who knows why), and two (in/out) for MSD.
Thus CDC went out the window and I based myself on the simple mass storage example.

At that state the device was enumerating correctly at the most basic level,
and I was able to connect it to a Linux virtual machine for debugging.
The reason for that is that Linux generally gives best diagnostics when something
doesn't work, and is most forgiving when things don't work exactly as they should.

Next, there was a little API misunderstanding. USB is a packet-based protocol.
There is a fixed size assigned to an endpoint, and you have to send data in such
increments. This is what I thought the LUFA's `Endpoint_Write_8()` function
was doing. It turns out it just fills the USB endpoint buffer, and you have to
send the packet separately every time the buffer is full. The function that 
does it automatically is `Endpoint_Write_Stream_LE()` (there's also `_BE` variant
which writes backwards). Same applies to reading. Luckily, this wasn't so difficult
to figure out, since LUFA is quite simple and you can just peak and see what
the function does.

Anyway, an hour or so later I had a virtual mass storage device claiming to be all zeros.
Trying to expose the FAT structures led me to a crash with the reality of AVR's `PROGMEM`.
AVR chips have two (or maybe more) kinds of memory -- the data memory (RAM) 
and program memory (flash). I think there's also something for EEPROM.
Anyway, flash cannot be just read using regular memory fetch instructions,
so if you want to place your read only data in flash and not in RAM
(because you know, you have 512 bytes of RAM), then you have to do
special sing and dance around this read only data. 

Normally, you place `PROGMEM` annotation after variable definition.  Then, the
Arduino docs claim, you can often use the variable as usual. However,
this only works as long as the compiler is able to figure out this is a PROGMEM
variable. For reasons unknown, it can figure out that `foo[i]` is PROGMEM when `i` is
known to be a constant, but not when it's a variable. Of course there is
no error message, and there is no distinction between PROGMEM pointers and data
pointers in the type system (why would you...). At runtime you will just see
random values.

So in the end, you pretty much have to say something like `pgm_read_byte(&foo[i])`
instead of simple `foo[i]`. Not a big deal, but good to know.

At this point I had a virtual USB drive presenting a nice `INFO_UF2.TXT` file.
Writing didn't work though, and I decided that the two bit of LED logging
wasn't quite enough, and so I started implementing stream forwarding ("serial")
over HID using the HF2 protocol. This led into another barrier of the total
endpoint size - there's 176 bytes of endpoint buffers. The control pipe
uses 8 (or maybe 8 each way), MSD 64 each way, and then I added HID with 64
each way. 

Half hour later, I reduced the HID endpoints to 16 bytes each way,
and some things started to appear on the screen when using `uf2tool serial`
(which I had to modify for the 16 and not 64 byte packets).
However, it seemed to be losing packets and weird things were happening.
It turns out that you had better make sure to align your declared HID report
size with the endpoint size -- otherwise the OS will combine multiple USB
packets into one HID packet.

With advanced logging (one character messages!) I was able to debug communication
over the STK500. After adding some delays, I was able to flash a few pages.
Then I actually modified the code to wait for replies (namely, for a flag set in
serial interrupt saying that the `0x10` character arrived) and things started to work well.

After some more thought, I decided to swap endpoint sizes - 16 bytes for MSD
and 64 bytes for HID. There are two reasons: the MSD endpoints are bulk, which
means one packet can follow another as fast as possible, while the HID endpoints
are interrupt, so they can trigger at most 1000 times per second. Therefore, 16 byte packets
limit the HID transfer to around 16k/s, which might be a bit low for some applications.
On the other hand, the 16 byte MSD endpoints just add some small overhead, but
we're nowhere close to maxing out the 12Mbit/s throughput of full speed USB,
while flashing over 115200 baud line.

Additionally, PXT already assumes the 64 byte HID line, so it was easier to just play along with that,
while the operating systems don't seem to care about MSD endpoint sizes.

As a side note, 64 bytes is maximum endpoint size for HID in full speed USB.
In high speed USB one can go up to 1024 bytes.

One thing that could be added is flashing over HID, and also reading memory over HID,
as is already done for SAMD21.  It wouldn't be too difficult I think.

You can find the bootloader, including a binary release for you to try, 
[on github](https://github.com/mmoskal/uf2-uno).