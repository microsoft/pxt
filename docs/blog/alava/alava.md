![Picture of fashion beads connected together](/static/blog/alava/networked.jpg)

# Project Alava: Programming Webs of Microcontrollers

Posted on April 26th, 2019 by [Tom Ball](https://www.microsoft.com/en-us/research/people/tball/)

As you know, the MakeCode team is primarily a bunch of web-heads who fell in love with
microcontrollers. Since early 2016, we've been bringing web technology to the world of microcontrollers. This started with the [BBC micro:bit](https://microbit.org) and a browser-based 
compiler from a [large subset](/language) of [TypeScript](http://www.typescriptlang.org/) 
to ARM machine code (the compiler is written in TypeScript too), 
as well as incorporating the [Blockly](https://developers.google.com/blockly/) and [Monaco](https://microsoft.github.io/monaco-editor/index.html) 
editors as MakeCode's primary ways to program microcontrollers from the web browser.
To date, MakeCode has been used primarily to program single devices, 
such as the [micro:bit](https://makecode.microbit.org), 
[Adafruit Circuit Playground Express](https://makecode.adafruit.com), 
and [Arduino-style boards](https://maker.makecode.com).

Over the last year, the [Microsoft Research](https://research.microsoft.com) (MSR) subteam of MakeCode, 
along with our superstar interns James Devine and Teddy Seyed, 
has been working hard to make it **much easier to program, configure and debug a network/web of microcontroller-based devices** than is possible today.
This work is part of MSR's 
[Project Alava](https://www.microsoft.com/en-us/research/project/alava/),
which introduces three related technologies:
- [JACDAC](https://jacdac.org), a bus-based plug-and-play protocol for microcontrollers (written in TypeScript, so it works in browsers and on microcontrollers); 
- **physical transports for JACDAC**, including JACDAC over stereo audio cables and JACDAC over WebUSB;
- **JACDAC-enabled boards** with stereo audio jacks for plug-and-play networking.

The [open source](https://github.com/jacdac) 
JACDAC technologies will enable end-users to create and program their 
own microcontroller-based systems with minimal fuss and friction.
Our first demonstration of the JACDAC technologies working together is taking place
on May 3, 2019 at the [Brooklyn Fashion Academy](https://www.bklynlibrary.org/bklyn-fashion-academy)
for their fashion show [On the Runway: Homage to Future Fashion](https://www.eventbrite.com/e/bklyn-fashion-academy-presents-on-the-runway-homage-to-future-fashion-show-tickets-59616896743).
We are providing wearable technology (fashion beads) for the  designers to incorporate into their creations:

![JACDAC fashion beads](/static/blog/alava/beads.jpg)

We'll be posting more soon on the technology behind Project Alava, but offer the following taste for now.

### Counting Down to the Show

- [BKLYN or Bust (T minus 3 days)](/blog/alava/bdale-tminus3)
- [BKLYN or Bust (T minus 2 days)](/blog/alava/bdale-tminus2)
- [BKLYN or Bust (T minus 1 day)](/blog/alava/bdale-tminus1)

### Debugging with JACDAC over WebUSB

It's easy to layer the JACDAC control protocol on top of different physical transport protocols. 
We have done this for WebUSB to enable a simple web-based [JACDAC debugger](https://jacdac.org/debug)

### JACDAC: the control layer

JACDAC's [control layer](https://jacdac.org/#control-layer) is defined by Control Packets sent over the JACDAC bus.  We have implemented this protocol in TypeScript (see [jacdac-ts](https://github.com/jacdac/jacdac-ts)), so it can run in the browser and on microcontrollers (implementations in other languages are forthcoming).

JACDAC abstracts devices by a set of interfaces rather than hardware registers so that service code can be shared across different implementations. It uses dynamic addressing so that multiples of the same device can be connected simultaneously and it offers various communication abstractions to cater for an ever-diverse set of use scenarios for devices. 
The control layer takes care of
device address allocation/collisions, packet routing, and advertisement of services (which expose APIs for programmers to access, actuate and network with other devices on the bus).

### JACDAC: the physical layer

JACDAC's [physical layer](https://jacdac.org/#physical-layer-specifications) uses the built-in UART module common to most microcontrollers as its communication mechanism, but instead of separate wires for transmission and reception, JACDAC uses just one wire for both.
This allows JACDAC to work over stereo audio cables, which also
can provide power and ground (in addition to data).
Stereo audio cables, Y- and multi- splitters are plentiful, 
making it easy to create arbitrary single-bus networks. We've
used these as the basis for our first wearable prototypes,
the fashion beads shown above.

### JACDAC in MakeCode

Currently, we are experimenting with JACDAC in [MakeCode Maker](https://maker.makecode.com)
with the set of beads shown above. We have implemented a number of [JACDAC drivers](https://github.com/Microsoft/pxt-common-packages/tree/master/libs/jacdac-drivers) in TypeScript, in addition to
the control layer protocol.

