![Working in the basement of the Holiday Inn](/static/blog/ozette/thebasement.jpg)

# Project Ozette: BKLYN or Bust (T minus 1 day)

Posted on May 2nd, 2019 by [Tom Ball](https://www.microsoft.com/en-us/research/people/tball/)

### More from 5/1/2019

Catching up on more news from yesterday first: the amazing Microsoft Research Outreach team showed up at
the Brooklyn Public Library to start interviewing us and the designers, take photos and
videos of the work in progress, and scope out the building for good locations to live stream
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

Now, you might be wondering: "Tom, why didn't YOU model check James' code ages ago using all the great technology from the [Research in Software Engineering](https://research.microsoft.com/rise) group?"
