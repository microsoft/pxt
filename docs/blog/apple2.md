# The micro:bit and the Apple ][

**Posted on April 1st, 2017**

The Microsoft MakeCode team has been working hard to bring a better programming experience
for the micro:bit to everyone via the [Microsoft MakeCode web app](/blog/makecode-overview),
which is available via any modern web browser.

However, we realized that there are many of you still work with computers
without web browsers, so we've gone the extra mile to bring the programming
experience for the micro:bit to Apple ][ computers.  

As you know, the Apple
][ already comes with a great beginners programming language built in: BASIC,
so there's no need to port Blockly or JavaScript to the Apple ][ (thank
goodness).  Here's a picture of a simple micro:bit program to display 
a smiley face, written in BASIC:


We felt it was important to keep key parts of the 
Microsoft MakeCode experience intact. As you know, Microsoft MakeCode 
supports device simulation as well as compilation. As the following
picture shows, we've rewritten the micro:bit simulator for the Apple ][,
using its low resolution graphics mode to mimic the retro feel of 
the micro:bit, and keep  memory pressure on the Apple ][ low (high
resolution graphics on the Apple ][ consumes quite a bit of its 48k of
RAM).

In addition to simulate the micro:bit on the Apple ][, we needed to
get an executable binary for the micro:bit. Undaunted by complexity,
Michal Moskal, created a BASIC to ARM machine language compiler and
linker last night, directly in 6502 assembler.  In addition, he
reversed engineered and hack Woz's eprom to flash the microbit
via its interface slots. 
