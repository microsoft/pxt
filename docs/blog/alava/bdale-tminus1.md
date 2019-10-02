![Working in the basement of the Holiday Inn](/static/blog/alava/thebasement.jpg)

# Project Alava: BKLYN or Bust (T minus 1 day)

Posted on May 2nd, 2019 by [Tom Ball](https://www.microsoft.com/en-us/research/people/tball/)

### More from 5/1/2019

Catching up on more news from yesterday first: the amazing Microsoft Research Outreach team showed up at
the Brooklyn Public Library to start interviewing us and the designers, take photos and
videos of the work in progress, and scope out the building for good locations to film
Friday's show from.  Thanks to [Tara Grumm](https://www.linkedin.com/in/taragrumm/) for organizing everything!

Peli, James and Tom left Teddy in the lurch in the late afternoon and went into the 
Soho district of lower Manhattan to visit Limor Fried (aka Lady Ada) and Phillip Torrone 
of [Adafruit Industries](https://www.adafruit.com).  They invited us to appear on
their weekly live stream [Ask An Engineer](https://www.youtube.com/watch?v=dyFhE568-9Q),
where we talked about [Microsoft MakeCode](https://www.makecode.com) and [MakeCode Arcade](https://arcade.makecode.com).

### Unracing to the Finish Line in the Basement of the Holiday Inn

Well, so far I've been showing you glamourous photos from the library where we work with the designers.  The reality is that we spend a lot of our time in a rented room in the basement of the Holiday Inn (Downtown Brooklyn), squashing bugs, writing device drivers, and fabricating (soldering) the required 
tech for each of the 20 designers.  It's nice and quiet down here - we are close to the pool and the exercise room (both unused by us) and everyone once in a while we hear the rumble of a subway going by. 

The most exciting part of my time down here is the terror of watching James Devine find another race in the [JACDAC physical layer protocol](https://jacdac.org/#physical-layer-specifications) [C++ implementation](https://github.com/lancaster-university/codal-core/tree/jacdac-v0/source/JACDAC) - he eventually squashes the race and sets up more stress testing, which reveals... another race! Here are the commits of the fixes James has made in the last few days:

- [force default sercom priority to 1](https://github.com/lancaster-university/codal-samd/commit/99e2686377da59bec6bc486c62d7096909dd967f): Sercom interrupt would interrupt DMAComplete at a bad time;
- [a race on TX operation](https://github.com/lancaster-university/codal-core/pull/83/commits/02824b9ff7b62295d3fd68782189c12cc169173e)
- [another race on TX operation](https://github.com/lancaster-university/codal-core/pull/83/commits/a99655e9944e0a0221cdceb276b6dfbb4311a0ea)
- [Race 4](https://github.com/lancaster-university/codal-core/pull/83/commits/3dda49eda64797b37a511b03d577b091922de9c5)
- [Race 5](https://github.com/lancaster-university/codal-core/pull/83/commits/c95dd23c2ac07ce1ab347803003fce1bc65f4317)

Now, you might be wondering: "Tom, why didn't YOU model check James' code ages ago using all the great technology from the [Research in Software Engineering](https://research.microsoft.com/rise) group?" Indeed, that's a very good question! The physical layer is written in C++ and heavily tied to interrupts and the properties of various on-chip hardware (DMA, GPIO, etc.); although I'm aware of research on model checking of interrupt-driven software, there was not a handy tool to apply directly to the code. Another approach we are considering is to model the JACDAC protocol using Ken McMillan's [IVy technology](http://microsoft.github.io/ivy/), which has the ability to do model-based testing.

In the meantime, James has done the following:

- [HACK: reset on error condition](https://github.com/lancaster-university/codal-core/commit/e16a98d9f74d588874aedbcd25d83ef0fe203b6a)

So it goes...

### From the Holiday Inn to the Library

![Montage: from Holiday Inn to Library](/static/blog/alava/montage.jpg)

Despite the race conditions, a gaggle of teenagers from a local school coming for the 
afternoon to learn about fashion, party and eat pizza, we managed to make a lot of 
progress at the library (though James and Tom had to find a quieter place to work
when the teenagers first arrived - not that hard in a library). 

### And back to the Holiday Inn

We are in for a long night
back here in the basement (dare I say "all nighter") and will be back at the library
at 7am with the hardware and software ready for incorporation into the garments (most
of which were still being worked on late today). No pain, no gain! 

![Still working in the basement of the Holiday Inn](/static/blog/alava/backInTheDungeon.jpg)
