# Display shield extension/simulator for the micro:bit

**Posted on January 16, 2025 by [Thomas Ball](https://github.com/thomasjball)**


## Background

The latest micro:bit has an amazing amount of computational power for a tiny device. In fact, it’s powerful enough to drive a small color display. If you have ever used [MakeCode Arcade](https://arcade.makecode.com/), you may have noticed there are a variety of [Arcade shields](/blog/arcade/arcade-on-microbit-xbox) (also called expansion boards) now commercially available. The micro:bit plugs into the shield, which has a 160x120 color display and extra inputs, making the combination a retro gaming device:

![Arcade shields](/static/blog/microbit/display-shield/display-shields.png)

## Display shield extension

With the [Display shield MakeCode extension for the micro:bit](https://makecode.microbit.org/pkg/microbit-apps/display-shield), 
you can use any Arcade shield with the beta version of the MakeCode for micro:bit editor (https://makecode.microbit.org/beta). 
This gives you access to the best of both worlds:
-	**All the micro:bit blocks and APIs** you are used to working with
-	**New blocks for drawing** to the shield's display and responding to user input via its buttons and direction-pad (D-pad)
We emphasize the name ``Display shield extension`` because the extension is not limited to writing
games. You can use it to create any kind of program that benefits from a color display and buttons,
as discussed further below.

The extension also includes a simulator that lets you see how your code will look on the shield's display while you are developing it, as shown below. The following [MakeCode program](https://makecode.microbit.org/beta/#pub:S82867-73191-89330-76938) plots the values of micro:bit's accelerometer, over time from left to right, on the shield's display. The accelerometer has three axes: x, y, and z. The program reads the accelerometer values and transforms their range (-1024 to 1024) to the display's vertical range (120 pixels high).  The code stores the previous accelerometer values and draws lines between the current and previous values. When the plot reaches the right edge of the display, the display scrolls to the left to make room for new data.

![MakeCode program for plotting accelerometer to shield](/static/blog/microbit/display-shield/plot-accelerometer.png)

## More to come: Micro:bit Apps!

The above example is just the beginning. With the display shield extension, you can do many things with your micro:bit that previously required connecting your micro:bit to a laptop or desktop computer. For example, graduate student [Kier Palin](https://github.com/kierpalin) at [Lancaster University](https://www.lancaster.ac.uk/) in the UK developed [MicroData](https://github.com/microbit-apps/MicroData), 
a *micro:bit app* that lets you collect data from the micro:bit's sensors and display it on the  shield, as shown below on actual hardware:

![MicroData program](/static/blog/microbit/display-shield/microdata.png)

You can load the MicroData app into the MakeCode editor by importing the URL https://github.com/microbit-app/MicroData using the **Import** button on (the right side of) https://makecode.microbit.org/beta.

## Your feedback welcome

We are excited to see what you create with the display shield extension for the micro:bit. Please share your projects on the [MakeCode forum](https://forum.makecode.com/). If you find problems or have suggestions for new features, please visit the [Display shield issue tracker](https://github.com/microbit-apps/display-shield/issues).

## Thanks

Thanks to the MakeCode team for their support in developing the display shield extension for the micro:bit. Special thanks to [Eric Anderson](https://github.com/eanders-ms) for his work on the [simulator extension framework](https://github.com/microsoft/pxt-simx-sample) for MakeCode and for building the display shield simulator.





