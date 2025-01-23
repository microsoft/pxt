# Display shield extension and simulator for the micro:bit

**Posted on February 3, 2025 by [Thomas Ball](https://github.com/thomasjball)**


## Background

The latest micro:bit has an amazing amount of computational power for such a tiny device; in fact, it’s powerful enough to drive a small color display to create quite rich interactive experiences. If you have ever used [MakeCode Arcade](https://arcade.makecode.com/), you may have already seen this - a variety of [Arcade display shield](/blog/arcade/arcade-on-microbit-xbox) accessories are available for purchase. The micro:bit plugs into the shield, which has a 160x120 color display and extra buttons, including a D-pad, making the combination a fun retro gaming device:

![Arcade shields](/static/blog/microbit/display-shield/display-shields.png)

## Display shield extension

But the display shield is no longer just for arcade games! With the new micro:bit [display shield extension](https://makecode.microbit.org/pkg/microbit-apps/display-shield),
you can use any of the existing Arcade display shields with the beta version of MakeCode for micro:bit (https://makecode.microbit.org/beta).
This gives you access to the best of what were previously two separate systems:
- **all the micro:bit blocks and APIs** you are familiar with from [MakeCode for micro:bit](https://makecode.microbit.org/), and
- **new blocks for drawing** on the shield's display and responding to user input via its **buttons and direction-pad (D-pad)** like you can with [MakeCode Arcade](https://arcade.makecode.com/).
 
We emphasize it is a *display shield* extension because the extension is not limited to writing
games. You can use it to create any kind of program that benefits from a color display and/or buttons,
as discussed further below.

The extension also includes a simulator that lets you see how your code will look on the shield's display while you are developing it, as shown below. The following [MakeCode program](https://makecode.microbit.org/beta/#pub:S82867-73191-89330-76938) plots the values of micro:bit's accelerometer, over time from left to right, on the display shield. The accelerometer has three axes: x, y, and z. The program reads the accelerometer values and transforms their range (-1024 to 1024) to the display's vertical range (120 pixels high).  The code stores the previous accelerometer values and draws lines between the current and previous values. When the plot reaches the right edge of the display, the display scrolls to the left to make room for new data. 
![MakeCode program for plotting accelerometer to shield](/static/blog/microbit/display-shield/plot-accelerometer.png)

## More to come: Micro:bit Apps! 
The example above is just the beginning. With the display shield extension, you can do many things with your micro:bit that previously required connecting your micro:bit to a laptop or desktop computer. For example, graduate student [Kier Palin](https://github.com/kierpalin) at [Lancaster University](https://www.lancaster.ac.uk/) in the UK developed [MicroData](https://github.com/microbit-apps/MicroData),
a *micro:bit app* that lets you collect data from the micro:bit's sensors and display it on the  shield, as shown below on actual hardware:

![MicroData program](/static/blog/microbit/display-shield/microdata.png) 
You can load the MicroData app into the MakeCode editor by importing the URL https://github.com/microbit-apps/MicroData using the **Import** button on (the right side of) https://makecode.microbit.org/beta.

## Your feedback welcome

We are excited to see what you create with the display shield extension for the micro:bit. Please share your projects on the [MakeCode forum](https://forum.makecode.com/). If you find problems or have suggestions for new features, please visit the [display shield issue tracker](https://github.com/microbit-apps/display-shield/issues).

## Thanks

Special thanks to [Eric Anderson](https://github.com/eanders-ms) for his work on the [simulator extension framework](https://github.com/microsoft/pxt-simx-sample) for MakeCode and for building the display shield simulator.