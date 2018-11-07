![Picture of the devices doing IR](/static/images/irdevs.jpg)

# Timing Adventures in Infrared

**Posted on June 20, 2017 by [mmoskal](https://github.com/mmoskal)**

The recently released [Circuit Playground Express](https://www.adafruit.com/product/3333)
(I'll call it CPX here) has an
infrared (IR) emitter and receiver. Such setups are typically used in remotes
for various electronic equipment (TVs, DVRs, etc.), and indeed it can
be used for communication with such equipment.

At the MakeCode team we thought it would be fun for users to be able to program
one CPX talking to another. We already had a similar capability using radio
in micro:bit and it was a hit in classrooms.

## The 38kHz

Historically, IR have been also used to for bi-directional communication phones
and PDAs (remember those?) to computers using IrDA protocol.  Modern computers
and smartphones usually don't have IrDA anymore, and anyway
the setup on the CPX is much more like a typical TV remote than IrDA.
In particular, while the emitter is just a simple diode, that you can blink at
will, the receiver is connected to demodulator that expects IR pulses at 38kHz
(i.e., 38,000 pulses per second).  When the demodulator sees some IR light
source blinking at 38kHz, it sets its output pin low. When the demodulator sees
no such pulses, it sets the output pin high. The software on CPX has no access
to the receiving diode itself, so it can only rely on the demodulator detecting
a diode blinking at 38kHz. The reason for using demodulator is that there are
many natural IR light sources (including the sun), that could otherwise confuse
the receiver.

The particular 38kHz frequency is common in various consumer electronics remote
controls.  These use various protocols. Typically, a command send from a remote
starts with a bunch of pulses (often 15 or more), followed by shorter bursts of
pulses (marks) with spaces (gaps) between them.  Often, the pulses are the same
length, and the data is encoded in length of gaps, either 1 or 2 bites per gap
(i.e., either 2 or 4 possible lengths of gaps).  Manchester encoding (pulse-gap
for 0, gap-pulse for 1) is also sometimes used.

You can find more information about consumer IR online, for example
at [SB Projects site](http://www.sbprojects.com/knowledge/ir/index.php).

There are at least three ways to use IR on CPX in educational scenario:
* use CPX to control a TV (or other consumer electronics)
* use a TV remote to control CPX
* have one CPX talk to another over IR

I would argue that the last one is most useful, as it doesn't require additional
equipment. Using a remote for controlling CPX might be useful for example
for remote-controlled robot, but having students control the classroom TV
sounds like a recipe for chaos.

We focus on CPX-to-CPX communication first.

## What came before

Of course, one should always start such an endeavor with some background
research. Part of it is the various remote control protocols.  These seem less
than ideal for our needs because of low throughput and small message size (8-24
bits per message; for comparison on micro:bit we usually used 128 bits per radio
message).
These are adequate for remote control, but not for general
purpose data exchange.
In fact this is expected: as usual with various maker
activities we're stretching the limits of what the hardware was designed to do!

There is a number of Arduino libraries that implement various remote control
protocols. The protocols are of limited usability here due to the message size
and throughput. More importantly, as is typical of Arduino programs, these
libraries tend to "take over" the device, which is to say that while you're
sending an IR message, the CPU cannot be doing anything else.  While there are
other functions that block the CPX's CPU (for example updating the neopixels),
sending a short 32 bit message over a quite dense protocol in the order of 20ms
(compared with 0.3ms for updating the 10 neopixels).  Similarly, receiving a
message in these libraries requires a very high-frequency interrupt (50us). It
seemed that with modern chips like the ATSAMD21, we should be able to be more
friendly towards other software that runs on the board.

## Hey! Let's make a new protocol!

My initial idea was to stick to what worked for others, and design something
similar to the remote protocols encoding every two bits in length of a gap.  The
advantage of such protocols is that they are self-clocking - there is no need
for precise synchronization of timers between transmitter and receiver, as the
maximal length of mark or gap is quite limited.  It's also relatively easy to
decode the message on the fly.

As it turned out later, the clock synchronization isn't really a problem - in a
typical message the two sides had the clocks synchronized down a microsecond or
two. On the other hand, the gap based protocol was prone to random marks
appearing sometimes out of nowhere (or maybe just the neighbour watching
football). The main problem is that is if you think there is a mark in the
middle of a gap instead of getting two (possibly wrong) bits out of it, you get
four (as there are two gaps), and the entire message is desynchronized. Such
desynchronized messages are much harder to correct (using Hamming codes,
described slightly later), than ones that just have a few bits flipped.

For these reasons I went for a code with constant bit length.  Experimentally,
I chose 250us (0.25ms), or around 10 pulses at 38kHz.  Shorter bit lengths
lead to higher packet loss at larger distances, while longer don't seem to
improve it.

Encoding message for transmission is performed in three steps:
* first, a 16 bit checksum is computed and added at the end of message
  (the checksum is [CRC16-CCIT](https://en.wikipedia.org/wiki/Cyclic_redundancy_check) with polynomial value `0x1021`)
* second, every two bytes are encoded as 35 bits (see below), and message
  is framed with `11111111111111111111111110011` at the beginning
  and with `111111111111111` at the end
* finally, every 1 in the message is transmitted as mark of 250us, and every
  0 as gap of 250us

The initial string of ones results in 6.25ms long mark (followed by a short gap, mark,
and the message). A long mark like that is always interpreted as the beginning of
a message. The final mark is used to detect the end of the message.

While the message is being received, we store the exact lengths of gaps and
marks and only decode them once the final mark has been detected. Next, we
shift the recorded times, so that median start time of a mark is as close to a
multiple of 250us as possible.  This lets us avoid problems with outsize
influence of the beginning of the first mark to the decoding of the message.

Next, we decode the message into bits (by looking at value at 125us, 375us, etc).
Afterwards, we may shift the message by one bit in either
direction if we detect that error rate of stop bits (see below) would be lower that
way, again limiting influence of errors right at the beginning of message.

Finally, we decode the 35 bit chunks, and check the CRC16. If everything works
out, we raise an event, that the user code can subscribe to and process the
message.

If any of these steps fail (for example due to too long gap or mark, wrong
message length, failed CRC etc.), we raise a different event, and pass
the exact timing of gaps and marks in the sequence to user code.
This way, it can try to decide if it looks like a command from a TV remote
and act accordingly. (this is not implemented yet)

## Hamming-35

As mentioned above, every 16 bits of message is encoded in 35 bits.

The process uses [Hamming(7,4)](https://en.wikipedia.org/wiki/Hamming%287,4%29) encoding, which
encoded 4 bits of data (also called half-byte or nibble) into 7 bits, such
that you can flip any single bit of the resulting 7, and still recover the 4
bits you had as an input. The encoding is quite simple - every one of the 16
possible nibbles has a 7 bit encoding value assigned.  The encoding values are so chosen
such that if you take any 7 bit value, it either is an actual encoding value, or there is
only one possible single-bit-flip that will turn it into an encoding value
(this is because any two encoding values are at least 3-bit-flips away from each
other).

To use the Hamming encoding we first split the 16 bits into 4 nibbles, then we
encode every nibble into 7 bits. Then we interleave the 7 bit values with each
other, so that bits from one are spaced with bits from others.  We do that
since we expect transmission errors to be likely to flip a few consecutive
bits. The errors can be also random, in which case this mixing up of bits doesn't matter.
We mix the bits by taking
the first bit of all four encoded nibbles, and then adding a stop bit, which is
`1` if previous four bits were `0000` and is `0` otherwise. The stop bit is
meant to prevent too long marks or too long gaps in the message which might be misunderstood by
the decoding process.  It's also possible to cheaply check for the number of
invalid stop bits as a function of message starting at different offsets.

For example, let's say we want to encode two bytes `0x40` and `0x2E`,
we get following nibbles and their encodings (the nibbles from bytes
also happen to be mixed, but for no real reason):

```
0x4  0101010
0x2  1001100
0x0  0000000
0xE  0001111
STOP 0010000
```

The actual encoding takes the first column of encoded nibbles `0100`, adds stop bit of `0`,
takes the second column `1000` and stop `0`, third `0000` and stop `1`,
`1101`, `0`, `0101`, `0`, `1001`, `0`, `0001`, `0`.

## Congestion

In a classroom setting we can expect a number of CPXes trying to run a transmission
at the same time. The limited range (around 3m for reliable transmission)
and directionality will certainly help, but we can still expect some
CPXes to talk over each other.

There are two measures to limit IR spectrum congestion:
* we enforce at least 200ms between (starts of) transmissions from a single CPX;
  this is implemented by conditional delay before sending, not an obligatory
  one after, so the user can implement their own delay or processing without overhead
* if demodulator currently sees a mark, or the last mark ended less than 10ms
  ago (i.e., someone is transmitting), we delay the transmission about 5ms and check for this condition again

The conditions are only checked before starting to send.
One reason for that is a CPX hears (sees?) itself!
This is because even though transmitter and receiver are pointing outside
they are also quite close to each other.
It will normally correctly decode the packet it is sending itself - in fact I had
to add code to explicitly prevent that, since this isn't really expected by the user.

The congestion control counter-measures are still to be tested in a classroom.

## The alphabet soup (or The Implementation)

### PWM and TCC

Microcontrollers often have [PWM (pulse-width modulation)](https://en.wikipedia.org/wiki/Pulse-width_modulation)
modules, which can generate a square wave -
i.e., setting a pin to high, waiting a little bit, setting it to low,
and again waiting a (different) little bit, and then repeating.
You can set the frequency, i.e., the sum of the two little bits,
and also duty cycle, which is the ratio between the first and second little
bit.

To generate pulses at 38kHz we set wave length to 26.32us and duty cycle to 33%.
To transmit say `10011` we will want to generate 250us of pulses (mark), followed
by 500us gap and 500us mark. Thus, after the first ten pulses we need to
turn off the PWM, and then after another 500us we need to turn it on again.
One way to do it is to set the duty cycle to 0%. Another is to shut down the
counter (Timer Counter for Control Applications, in short TCC) controlling
the PWM.

MakeCode runtime sits on top of [Codal](https://github.com/lancaster-university/codal)
(to be open-sourced soon; it's a new generation of [micro:bit DAL](https://github.com/lancaster-university/microbit-dal)),
which then sits on top of [ARM mbed](https://www.mbed.com/en/).
When setting the duty cycle mbed goes through several layers of indirection
and performs 64 bit floating point computation simulated in software.
While floating point operations are not usually a problem in
regular code, here they are. The reason is that pulses occur around every ~1300
cycles (48MHz / 38kHz). Thus, a delay of 1000 cycles (typical for software
floating point) is quite significant. Thus, I ended up disabling or enabling
the TCC every 250us by going down straight to hardware (see `setTCC0` in
[infrared/samd21.cpp](https://github.com/Microsoft/pxt-common-packages/tree/master/libs/infrared/samd21.cpp#L80)).

### DMESG, EIC and IRQs

One super-useful tool when debugging this stuff was a simple circular character buffer in Codal.
I've copied it there from my [USB bootloader](https://makecode.com/blog/one-chip-to-flash-them-all),
while implementing USB/HID, and again it's particularly
useful in situations where timing is critical. The idea comes from various Unix kernels, which
have a `printk()` function to write there, and a user-space `dmesg` command to display
the contents of the buffer.
Typically, embedded developers use serial console or gdb connected via over CMSIS-DAP.
Both of these, however, are quite slow, so injecting any logging code
will likely affect your timings.

In any event, I was trying to understand typical profile of errors in messages. First, I logged
the lengths of marks and gaps, in CSV format, in a such a way that they could be plotted
in Excel. For example, if I had lengths of mark 257, gap 274, mark 445, gap 555, I would log:

```
0,0
257,0
258,1
531,1
532,0
976,0
977,1
1531,1
```

When plotted (I set marks to appear every 250us) it looks like this:

![Mark-gap plot](/static/images/irwave.png)

What is not quite obvious from the numbers, but quite clear in the picture,
is that the beginnings and ends of marks align quite well with the 250us tick marks
(but this sometimes requires shifting the entire message, as explained before).
This observation was one reason I went from gap-length protocol to one with constant bit
length expecting exact clock.

Now, this format was too low level to track the nature of errors.
For that I took advantage of the multi-layer nature of the protocol -
I was going to look for errors at the bit layer. Note that I would be
looking at the 35 bit segments, before the Hamming correction
kicks in.

I set one CPX to transmit messages, where the first byte is random,
and each next byte is computed by multiplying the previous one by 13.
This gives random-looking bit patterns, but usually, on the receiving
side, I can compute what exact bits were sent (provided that after Hamming
correction we get the first 8 bits right).
So we compute the expected, error-less message and XOR it with
the actual message and log the result. I used `#` for `1` (i.e., an error)
and `.` for `0` (bit OK). I got something like this:

```
........#.#......................................................................##..............................................##...............
..................................................................................................................................................
.#....#.#.#.##..##....##..##....##.###..#..###.##.###...#.#..##..##.###..########.##..##.##.######....######..#..#.#.##.###.#.#.#####...#.#.....##
....................#..........................................................................................#............................#.....
....#...............................................................................................#.......................#.....................
......................................................................................##..............................................##..........
................#.......................#.......................................................................#.................................
...........................................................................................................................##.#.#.................
...
```

Now, clearly the third line looks like one when I got something completely wrong (maybe an error in first byte), but
otherwise it looked pretty random. Then I run the lines through `sort` command, and I got something like this:

```
..#...............................................................................................#...............................................
....#.......................................................................#.......................#...................####......................
....#...............................................................................................#.......................#.....................
......#.......................#.......................#.......................#...................................................................
........#.#......................................................................##..............................................##...............
..........#.......................#.......................#.......................#.......................#.......................................
..........#.......................................................................##..............................................................
...........#........................................................................#.......................#.....................................
..............#..............................................##...................................................................................
................#.......................#.......................................................................#.................................
....................#..........................................................................................#............................#.....
.....................#.......................#.......................................................................#............................
.........................#......................#........................#..............................................#.......................#.
.................................#.....................###........................................................................................
...................................#...............................................#...............................................#..............
...
```

Human beings are quite good at spotting non-existing patterns in random noise.
The evolutionary explanation for this fact has to do with spotting a
non-existing tiger in random movements of leaves a 100 times, versus the single
instance of not spotting an existing tiger.  Thus what looked like parallel
lines here needed some validation.  This came by measuring the distance between
the marks forming the lines - it was almost always exactly 24 characters.  As
you will note, `24*250us = 6000us`, and 6000us also happens to be the period of
scheduler tick in Codal.  A few 24s could be a coincidence, but that many must
have been enemy action (and not some random noise from neighbour remote)!  This
could be a problem on either the sending or receiving side, but unfortunately I
didn't have an oscilloscope to measure it.  Instead, I changed the scheduler
tick to 10000us on the receiving CPX and, lo and behold, the lines started
appearing every 40 characters.

I proceeded to investigate the exact source of the mark/gap lengths. These are generated by so called
External Interrupt Controller (EIC), which can be configured to trigger an interrupt (IRQ)
when a given pin goes from 0 to 1 or vice versa. Interrupts are events at the level of hardware
which execute user-supplied interrupt handling functions - in this case the handler generates
a Codal event, which I then handle and record pulse length.

As it seemed, the EIC interrupt was blocked by the scheduler interrupt (TC4, more about it below).
After some tens of pages of data-sheets and manuals, it transpired that all interrupts
start at priority 0, and if an interrupt handler is already running, only an interrupt
with lower priority can, well, interrupt, it. Thus, I tried changing the priority of scheduler
interrupt to 1. As a side note, Cortex M0+ supports only 2 bits of priority, which are highest two bits of a byte,
since other cores might support more bits; thus priority 1 in `NVIC_SetPriority()` is really 128 in hardware,
glad you're asking.
Anyway, lowering the priority of scheduler interrupt did the trick:
the cyclic 6000us errors were gone. In fact most errors were gone.

However, after some seconds or even minutes of correct execution, the device would always lock up...

### TC3, TC4, IBDAP, and gdb

I took my trusty IBDAP debugger and connected `gdb` to the CPX.  Usually when the device locks up
you find yourself in an infinite loop in `HardFault_Handler()` or in Codal `panic()` function.
However, to my surprise Codal was happily running the idle task, just some `fiber_sleep()`
call somewhere seemed to be stuck.

After investigating Codal's scheduler queues it seemed that the sleep queue had some tasks
that should have been waken up by the scheduler tick (i.e., their `fiber_sleep()` should have
already finished). A breakpoint on `scheduler_tick()` didn't hit, so clearly
the `6000us` periodic callback wasn't triggering.

With a few `DMESG()` here and there I could check that Codal indeed sets a timeout,
but mbed never triggers it. (The usefulness of logging here stems from the fact that
the timeout triggers thousands if not millions of times before it doesn't - the log
reveal the last execution path).
Now, adding `DMESG()` in mbed in some places seemed to "fix" or rather mask the problem.
In that case even `DMESG()` was enough to mess up with the timing. I changed `DMESG()` to updates
of a single integer which I could later examine in `gdb`.

The mbed timer is implemented using Timer Counter (TC) module, number #4 (TC4). It is similar to the TCC
module, but instead of producing waves, it can count ticks of a configured clock, and also
has two compare values. The TC module can trigger interrupt when the clock overflows,
and when it reaches one of the compare values. The virtual timers in mbed keeps a list of events that need to happen
in future, and sets the compare value to the time of the first event in that list.
When the interrupt triggers, it processes all events that are past their time
in the queue, and then sets a new timer to the value stored in the new head.

Following through my single integer logging, I found out that the TC
interrupt seemed to be triggered for no reason. That is, the flags
that indicate the reason the interrupt was triggered (compare value 0, 1,
or overflow) were all zero. I've been around long enough to be very highly suspicious
of the idea that this is surely a bug in the CPU (the interrupt triggers
without the flag sets). Widely used compilers have bugs. Hardware has bugs
(probably less than compilers). Both are so very much less likely than bugs in software though...

After some more playing with my logging integer it seemed as if the interrupt handler
was called recursively. This is impossible in hardware, and accordingly turned out to be false.
However, it was certainly the case that during the interrupt handler execution we would
set another interrupt to be executed in future (the new head of the event queue).
It also seemed as if the event queue handling was executing long enough for this
interrupt to trigger again, while the handler was executing. As it happens,
this has well defined behavior in ARM architecture - the interrupt becomes active
and pending, and will become active again after the current handler finishes.
However, the reason for interrupt flags are also set when the interrupt is
set to pending, and the code was clearing the reason-for-interrupt flag **after** executing the event queue
handling. Thus on next interrupt activation, the flag was cleared.

Now, for this to actually happen you have to have two events in the queue
which are quite close, so the interrupt is set very shortly in future.
As it stands, Codal was scheduling two periodic events at `6000us` --
scheduler tick we already talked about, and also a tick event components
can subscribe to. Of course these are scheduled right after another during startup meaning
they are quite close and every 6ms we had a possibility for a race.

In any event, after [fixing mbed](https://github.com/lancaster-university/mbed-classic/pull/6) it seems to be no longer an issue.

What this debugging exercise additionally thought me is that my 250us event was often not triggered
by the TC4 timer, but recursively by the event queue handlers, which were not quite keeping
up with it. This is because these virtual handlers have quite a bit of overhead and
250us is quite a short time. Also, due to architectural constraints, I had to enable
the 250us event when I wanted to send something over IR and there was no way to
disable it again, which couldn't be good for power consumption.

Thus, I configured the TC3 to trigger an interrupt every 250us. Then the overhead would be only
the interrupt handling (which is around 30 cycles), not an entire queue and setting new interrupts and
counters. This seems to work quite well. It's also easy to only enable it when needed (transmitting).

Also, interestingly, [Atmel documentation](http://ww1.microchip.com/downloads/en/DeviceDoc/40001882A.pdf)
says that TC3 works as subordinate to TC4, when TC4 is set in 32 bit
mode (as it is by mbed). It also talks about TC5 paired with TC6 and TC7 not paired at all. However,
the ATSAMD21G18 in CPX doesn't have TC6 and TC7, and it seems that the TC5 is the subordinate to TC4.
Thus I used TC3 for my interrupt.


## Lessons learned

* DMESG is your friend
* visualization (be it Excel or sorted dots and hashes) is your friend
* abstractions are sometimes too slow, especially when you need to run some code for every bit of data; but profile first!

Happy IRing!
