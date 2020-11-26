# MakeCode for the micro:bit V2 Release

**Posted on November 23rd, 2020 by [Jaqster](https://github.com/jaqster)**

"Aw3s0m3!!!"

"Brilliant !"

"Pleeeeease, Santa?!!"

"I. Want. These."

"This is awesome! Our 6/yo daughter loves playing with the first micro:bit. She’s really excited about getting one with a mic and speaker."

This was some of the feedback we heard from the announcement of the new micro:bit last month. And as you can see, everyone’s super excited about micro:bit V2, including us! To learn more about the new micro:bit, visit https://microbit.org/new-microbit.

We’ve been working closely with the Micro:bit Educational Foundation on supporting this new hardware with MakeCode. Here’s a rundown of the new micro:bit features in MakeCode:

## Compatibility

We spent a lot of time making sure that whether students were using a V1 or V2 version of the micro:bit, they would have a seamless experience in MakeCode. All the MakeCode blocks will work with the new micro:bit. Some blocks (listed below), will only work with the new micro:bit, but these blocks have been clearly marked as V2 in the MakeCode Toolbox.

![micro:bit V2 Toolbox](/static/blog/microbit/microbit-V2/v2-toolbox.png)

And when you use any of the V2 blocks in your program, you’ll see the micro:bit Simulator change to represent the new micro:bit with the "V2" indicator.

![micro:bit V2 Simulator](/static/blog/microbit/microbit-V2/simulator.png)

## WebUSB reliability improvements

WebUSB (https://makecode.microbit.org/device/usb/webusb) isn’t a new feature, but we took this opportunity to improve the reliability of this technology. Most teachers and students have told us that the download process of copying program files over to the micro:bit is one of the most painful parts of programming with the micro:bit. WebUSB is a new technology (only available in Chrome and Edge browsers) which allows you to pair your micro:bit with MakeCode allowing you to do a one-click download!

You can take a look at the [MakeCode for micro:bit - WebUSB](https://www.youtube.com/watch?v=_-xtP2FH9B8&list=PLMMBk9hE-SepwjCAK7cY-jvq6KeQKda8x) video for an in-depth demonstration on using WebUSB with the new micro:bit V2.

![micro:bit V2 WebUSB](/static/blog/microbit/microbit-V2/webusb.gif)

## New Music blocks

With the amazing new speaker on the micro:bit, we’ve supported a couple fun new Music blocks.

* **Set Built-in Speaker On/Off** - this will allow you to turn on and off the speaker programmatically.

![micro:bit V2 speaker on/off](/static/blog/microbit/microbit-V2/speaker-on-off.png)

* **Play Sound** - this is a fun block that contains some pre-built sounds, including "giggle", "twinkle", and "yawn".

![play sound block](/static/blog/microbit/microbit-V2/play-sound.png)

## New Input blocks

The following blocks support the microphone and the capacitive touch sensor on the new micro:bit.

* **On Loud/Quiet Sound** - this event handler block will fire when the new micro:bit senses changes in the sound level. On Loud Sound will trigger when the micro:bit senses a loud sound around it, and On Quiet Sound will trigger when it’s loud and then goes quiet.

![on loud sound block](/static/blog/microbit/microbit-V2/on-loud-sound.png)

* **Loud Sound Threshold** - this block allows you to set a specific sound level threshold for the On Loud Sound block.

![micro:bit V2 Simulator](/static/blog/microbit/microbit-V2/loud-sound-threshold.png)

* **On Logo Pressed** - this block detects when the capacitive touch sensor (the gold logo) is pressed.

![on logo presed block](/static/blog/microbit/microbit-V2/on-logo-pressed.png)

* **Sound Level** - this block returns the current sound level that goes from 0 = silent, to 255 = very loud!

![sound level block](/static/blog/microbit/microbit-V2/sound-level.png)

## New Pins block

And finally, in the Advanced - Pins Toolbox drawer, under the More subcategory, there is a new Set Pin Touch Mode block which allows you to change the current touch mode of the Pins and Logo. You can set the touch modes to capacitive or resistive.

* **Set Pin To Touch Mode** - by default, the logo is set to capacitive touch and the edge connector pins (P0, P1, P2) are set to resistive touch. The Set Touch Mode block enables you to change the current touch mode of the Pins and the Logo to either capacitive or resistive.

![set touch mode block](/static/blog/microbit/microbit-V2/SetPinTouchMode.png)

We can’t wait for you all to get your hands on the new micro:bit and try out some of these new code blocks and capabilities. Please share your projects and let us know what you think!

<br/>
Happy Making and Coding!

The MakeCode Team
