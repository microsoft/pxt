![Picture of the Apple II](/static/blog/appleII/banner.jpg)

# Programming the micro:bit on the Apple II

**Posted on April 1st, 2017 by [tballmsft](https://github.com/tballmsft)**

The Microsoft MakeCode team has worked hard to bring a beginning programming experience
for the micro:bit to everyone via the [Microsoft MakeCode web app](/blog/makecode-overview),
which is available via any modern web browser. We've also created [UF2](/blog/one-chip-to-flash-them-all), 
a new file format for flashing devices robustly across many different operating systems.

To reach even more users, we've gone the extra mile to bring the 
micro:bit programming experience to older computers. In particular,
we felt it was important to make the micro:bit work with Apple computers
from the time of the [BBC Micro](https://en.wikipedia.org/wiki/BBC_Micro), 
the early 1980's intellectual forebear of the micro:bit. 
The [Apple II](https://en.wikipedia.org/wiki/Apple_II) series was the 
natural choice, being from the same era as the BBC Micro. (Also, 
one of our team members  has one, which he brought into the 
office this past week.)

The Apple II already comes with a great beginning programming 
language built in: BASIC! As a result, we didn't need to port the 
Microsoft MakeCode Blocks or JavaScript experience to the Apple II (thank
goodness). Here's a picture of a simple BASIC program to display 
a smiley face on the micro:bit:

![BASIC program](/static/blog/appleII/program.jpg)

We felt it was important to keep key parts of the 
Microsoft MakeCode experience intact. As you know, Microsoft MakeCode 
supports device simulation in the browser, as well as compilation. As 
the banner picture shows, we've rewritten the micro:bit simulator 
for the Apple II, using its low resolution graphics mode to mimic the 
retro feel of the micro:bit and keep memory pressure on the Apple II low (high
resolution graphics on the Apple II consumes quite a bit of its 48k of
RAM).

In addition to simulating the micro:bit on the Apple II, we needed to
generate an executable binary for the micro:bit from the BASIC program. 
So, we created  a BASIC to ARM machine language compiler and
linker last night, coding in 6502 assembler until the wee hours of 
the morning.  In addition, we modified the Apple II's eprom to 
flash the ARM binary onto the microbit using the Apple II's interface
slots:

![flashing the micro:bit](/static/blog/appleII/flash.jpg)

Unfortunately, flashing multiple micro:bits in this way caused
a massive electrical surge, completely destroying our team member's 
Apple II and all the code we created over the past week, so we 
won't be able to make it available. What fools!