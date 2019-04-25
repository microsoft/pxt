# Project Ozette: Programming Webs of Microcontrollers

As you know, the MakeCode team is primarily a bunch of web-heads who fell in love with
microcontrollers. Since early 2016, we've been bringing web technology to the world of microcontrollers. This started
by writing a compiler from a [large subset](/language) of [TypeScript](http://www.typescriptlang.org/) 
to ARM machine code (the compiler is written in TypeScript as well so it runs in the browser), 
as well as incorporating the [Blockly](https://developers.google.com/blockly/) and [Monaco](https://microsoft.github.io/monaco-editor/index.html) 
editors as MakeCode's primary ways to program microcontrollers from the web browser.

To date, MakeCode has been used primarily to program single devices, 
such as the [micro:bit](https://makecode.microbit.org), 
[Adafruit Circuit Playground Express](https://makecode.adafruit.com), 
and [Arduino-style boards](https://maker.makecode.com).
Over the last year, the [Microsoft Research](https://research.microsoft.com) (MSR) subteam of MakeCode, 
along with our superstar interns James Devine and Teddy Seyed, 
has been designing new technologies to make it easier
to program, configure and debug a network (or web) of microcontroller-based devices.
This work is part of MSR's 
[Project Ozette](https://www.microsoft.com/en-us/research/project/ozette/).
There are three new technologies we are designing and developing as part of Ozette:
- [JACDAC](https://jacdac.org), a bus-based plug-and-play protocol for microcontrollers; 
- *physical transports for JACDAC*, including JACDAC over stereo audio cables and JACDAC over WebUSB;
- *JACDAC-enabled boards* with stereo audio jacks for plug-and-play networking.

Our first demonstration of these technologies working together is taking place
on May 3, 2019 at the [Brooklyn Fashion Academy](https://www.bklynlibrary.org/bklyn-fashion-academy)
for their fashion show [On the Runway: Homage to Future Fashion](https://www.eventbrite.com/e/bklyn-fashion-academy-presents-on-the-runway-homage-to-future-fashion-show-tickets-59616896743).
We are providing wearable technology for the fashion designers to incorporate into their creations.

We'll be posting more soon on the technology behind Project Ozette, but offer the following taste for now.

### JACDAC: the physical layer

JACDAC's [physical layer](https://jacdac.org/#physical-layer-specifications) uses the built-in UART module common to most microcontrollers as its communication mechanism, but instead of separate wires for transmission and reception, JACDAC uses just one wire for both.
This allows JACDAC to work over stereo audio cables, which also
can provide power and ground (in addition to data).
Stereo audio cables, Y- and multi- splitters are plentiful, 
making it easy to create arbitrary single-bus networks. We've
used these as the basis for our first wearable prototypes,
the fashion beads shown below

![JACDAC fashion beads](/static/blog/ozette/beads.jpg)

### JACDAC: the control layer

JACDAC abstracts devices by a set of interfaces rather than hardware registers so that service code can be shared across different implementations. It uses dynamic addressing so that multiples of the same device can be connected simultaneously and it offers various communication abstractions to cater for an ever-diverse set of use scenarios for devices. 
JACDAC's [control layer](https://jacdac.org/#control-layer) is written in (MakeCode's subset of) TypeScript and can run in the browser and on microcontrollers. This layer takes care of
device address allocation/collisions, packet routing, and advertisement of services (which expose APIs for programmers
to access, actuate and network with other devices on the bus).

### Debugging JACDAC-based microcontrollers over WebUSB

It's easy to layer the JACDAC control plane on other physical transports. We have done this for WebUSB
to enable a simple web-based [JACDAC debugger](https://jacdac.org/debug).
