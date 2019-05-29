![Brooklyn Public Library](/static/blog/alava/bklyn_pub_lib_night.jpg)

# Project Alava: BKLYN or Bust (T minus 2 days)

Posted on May 1st, 2019 by [Tom Ball](https://www.microsoft.com/en-us/research/people/tball/)

Back in 2013, I was one of 50 choristers in the Seattle Opera's product of Wagner's Ring Cycle. We prepared for well over 3 months for around 20 minutes of stage time in a 5 hour opera (Gotterdammerung), memorizing music, staging, and entrances/exits. And this was just a tiny part of what it took to pull off the final performance: sets and props, music, orchestra, costumes, lighting, direction, ...

When you go to a concert, movie, or musical, you are treated to a performance that is the
product of many person-years of effort. In this blog, I want to tell you about
the technology that is going into the fashion show [On the Runway: Homage to Future Fashion](https://bfahomagetofuturefashion.eventbrite.com/) and the people behind it. For more context, see
[Project Alava](/blog/alava/alava). Let's get into the tech going bottom-up, starting
with the hardware, which is in the Pelican case that Teddy Seyed, James Devine and Peli de Halleux 
(left to right) are standing with in front of the [Brooklyn Public Library](https://www.bklynlibrary.org/locations/central).

![Teddy Seyed, James Devine and Peli de Halleux standing in front of the Brooklyn Public Library](/static/blog/alava/trio.jpg)

### Hardware: Fashion Brain and Beads

Teddy Seyed created the hardware designs for the fashion "brain" and six fashion "beads" shown in the box below.  These all use the [SAMD21 microcontroller](https://www.microchip.com/wwwproducts/en/ATSAMD21G18) and can be networked together using stereo audio cables and the JACDAC physical/logical protocol (described below). Each bead has a different set of sensing and actuation capabilities. These beads are prototypes that include USB-C ports for ease of flashing code (future versions will not include the USB port and be much smaller). 

![Fashion brain and beads](/static/blog/alava/boxBrainBeads.jpg)

### Flashing Code with UF2

To load programs on the SAMD21, we use the open source [UF2 File Format](https://makecode.com/blog/one-chip-to-flash-them-all) and its associated firmware, created by Michal Moskal. UF2
was designed particularly for flashing microcontrollers over MSC (Mass Storage Class; 
aka removable flash drive). This
format has been quite popular with our colleagues at [Adafruit](https://www.adafruit.com),
who have adopted it for their SAMD-based boards. 

### Running Code with CODAL

At the lowest level of programming, our colleagues at [Lancaster University](https://www.lancaster.ac.uk/),
Joe Finney and James Devine, created 
an efficient component-oriented open-source C++ runtime for microcontrollers
named [CODAL](https://github.com/lancaster-university/codal).
You can read more about CODAL (and MakeCode, discussed below) in the paper
[MakeCode and CODAL: intuitive and efficient embedded systems programming for education](https://www.microsoft.com/en-us/research/publication/makecode-and-codal-intuitive-and-efficient-embedded-systems-programming-for-education/).

### Physical Networking with JACDAC

JACDAC's [physical layer](https://jacdac.org/#physical-layer-specifications) uses the built-in UART module common to most microcontrollers as its communication mechanism, but instead of separate wires for transmission and reception, JACDAC uses just one wire for both.
This allows JACDAC to work over stereo audio cables, which also
can provide power and ground (in addition to data). JACDAC is [open source](https://github.com/jacdac).
Stereo audio cables, Y- and multi- splitters are plentiful, 
making it easy to create arbitrary single-bus networks, as shown in this picture.

![Fashion brain and bead, connected via stereo audio cable](/static/blog/alava/jacdac.jpg)

### Logical Networking with JACDAC

JACDAC's [control layer](https://jacdac.org/#control-layer) is defined by Control Packets sent over the JACDAC bus.  We have implemented this protocol in [TypeScript](https://www.typescriptlang.org) (see [jacdac-ts](https://github.com/jacdac/jacdac-ts)), so it can run in the browser and on microcontrollers (implementations in other languages are forthcoming). JACDAC abstracts devices by a set of interfaces rather than hardware registers so that service code can be shared across different implementations. It uses dynamic addressing so that multiples of the same device can be connected simultaneously and it offers various communication abstractions to cater for an ever-diverse set of use scenarios for devices. 

### JACDAC: Device Drivers

On top of the control layer, Peli de Halleux and James Devine have written a set of [JACDAC device drivers](https://github.com/Microsoft/pxt-common-packages/tree/master/libs/jacdac-drivers) in TypeScript that expose the features of each fashion bead over the JACDAC bus. This includes drivers for light sensors, accelerometers, servosm and touch, among others.  These drivers are part of the MakeCode repository - their APIs have been [annotated](https://makecode.com/defining-blocks) to expose them via MakeCode editors.

### MakeCode: the Programming Platform

[Microsoft MakeCode](https://www.makecode.com) is web-based experience for programming microcontroller-based devices using 
both block and text editors for learners at different levels, starting with middle school. 
MakeCode's open source [platform](https://github.com/microsoft/pxt) provides
 a browser-based compiler from a [large subset](/language) of TypeScript to ARM machine code (the compiler is written in TypeScript too), as well as incorporating the [Blockly](https://developers.google.com/blockly/) and [Monaco](https://microsoft.github.io/monaco-editor/index.html) editors.
To date, MakeCode has been used primarily to program single devices, 
such as the [micro:bit](https://makecode.microbit.org) and
[Adafruit Circuit Playground Express](https://makecode.adafruit.com).

### MakeCode Maker: the Editor

We leverage the [MakeCode Maker editor](https://maker.makecode.com) to program the fashion brain and beads.
Microsoft Research started this editor as a way to experiment with Arduino-style boards that require wiring
to external sensors and actuators. With the JACDAC device drivers in place, one can now program against
a set of networked fashion brain and beads.

![Smart Tattoos](/static/blog/alava/maker_beads.jpg)

### Smart Tattoos

We've also worked with [Asta Roseway]() to incorporate [Smart Tattoos](https://www.microsoft.com/en-us/research/project/smart-tattoos/)
into the mix - these interactive tattoos are capacitive and can send signals to any device via touch - the fashion designers
really love this technology!

![Smart Tattoos](/static/blog/alava/smart_tattoo.jpg)

[Tomorrow](/blog/alava/bdale-tminus1) is the last day before the fashion show... off to the races!



