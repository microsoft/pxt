# Project Ozette: Programming Webs of Microcontrollers

As you know, the MakeCode team is primarily a bunch of web-heads who fell in love with
microcontrollers. Since early 2016, we've been focused on bringing 
the web tech we love to the world of microcontrollers. This started
by writing a compiler (in TypeScript) from a large subset of TypeScript to ARM machine code, 
as well as incorporating the Blockly and Monaco editors as MakeCode's primary
ways to program microcontrollers from the web browser.

To date, MakeCode has been used primarily to program single devices, 
such as the [micro:bit](https://makecode.microbit.org), 
[Adafruit Circuit Playground Express](https://makecode.adafruit.com), 
and [Arduino-style boards](https://maker.makecode.com).

Over the last year, the Microsoft Research (MSR) subteam of MakeCode, 
along with our superstar interns James Devine and Teddy Seyed, 
has been designing new technologies to make it easier
to program a network (web) of microcontroller-based devices.
This work is done as part of MSR's 
[Project Ozette](https://research.microsoft.com/projects/ozette).

There are three new technologies we are designing and developing as part of Ozette:
- [JACDAC](https://jacdac.org), a bus-based plug-and-play protocol for microcontrollers; the control layer 
of JACDAC is written in TypeScript and can run in the browser and the microcontroller;
- *physical transports for JACDAC*, including JACDAC over stereo audio cables and an JACDAC over WebUSB;
- *JACDAC-enabled boards* with stereo audio jacks for plug-and-play networking.

Our first demonstration of these technologies working together is taking place
on May 3, 2019 at the [Brooklyn Fashion Academy](https://www.bklynlibrary.org/bklyn-fashion-academy)
for their fashion show [On the Runway: Homage to Future Fashion](https://www.eventbrite.com/e/bklyn-fashion-academy-presents-on-the-runway-homage-to-future-fashion-show-tickets-59616896743).
We are providing wearable technology for the fashion designers to incorporate into their
creations.

