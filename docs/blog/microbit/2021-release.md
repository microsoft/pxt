# MakeCode for the micro:bit - 2021 Release is here!

**Posted on July 12, 2021 by [Jaqster](https://github.com/jaqster)**

Phew! We made it through a crazy remote/hybrid school year! Now, with **summer weather** + the **2021 updates** to **MakeCode for the micro:bit**, things are starting to look up!

Here’s a run-down of the new features in the 2021 release:

## One-click Download

What is the one part of programming the micro:bit experience that is the biggest pain? If you said dragging-and-dropping program files, you’re not alone! To help relieve the pain, we’ve invested even more effort in making WebUSB easier to use. This new web technology allows you to 'pair' USB devices to your web browser, so when you click the Download button, it really does download directly to the micro:bit! To take advantage of this capability, you will need the latest firmware on your micro:bit device and you’ll need to be using either Edge or Chrome as the browser ([Learn more](https://makecode.microbit.org/device/usb/webusb/troubleshoot)).

![WebUSB](/static/blog/microbit/2021-release/webusb.gif)

## Accessibility

We are continuing to focus on making sure every student has a great experience with MakeCode. For low-vision students, we’ve made some improvements to the color contrasts – most notably in the tutorial interface. And for students with literacy challenges, we’ve added support for [Immersive Reader](https://education.microsoft.com/en-us/resource/9b010288) in tutorials. Watch this video to see how it works:

https://youtu.be/ZYJhQ0HNvq4

## Updated banner

One of the first things you might notice is the new banner carousel on the home page! There are so many great lessons and resources for the micro:bit, this is a nice way to feature different ones. We also cleaned up the top navigation bar a bit.

**New carousel:**

![Homepage Carousel](/static/blog/microbit/2021-release/carousel.gif)

**Navigation bar:**

![Navigation bar](/static/blog/microbit/2021-release/navbar.png)

## Data logging extension

The new version of the micro:bit it is able to collect and store its own data! There is a new extension for MakeCode too that allows you to collect data from the micro:bit sensors and record the data on the board. This is helpful if you are running an experiment over a longer period of time or when the micro:bit is disconnected from a computer that does the data recording. It’s still in Beta, so we'd love to get your feedback.  Here’s a short video demonstration:

https://youtu.be/fWfwb8ZSsjc

## Functions with array parameters

Every year we add more functionality to our **Functions**. This year, we did a small update as a result of your feedback to support array types as parameters.

The Function Editor now lets you select an array parameter:

![Edit function](/static/blog/microbit/2021-release/edit-function.png)

The example function here is using the array parameter:

![Function sample](/static/blog/microbit/2021-release/function-sample.png)

## New micro:bit tutorials

You may notice a few new tutorials available now for the new micro:bit. These tutorials make use of the new micro:bit features like the microphone and the speaker.

![New v2 tutorials](/static/blog/microbit/2021-release/v2tutorials.png)

## Updates to Loops

When you open up the **Loops Toolbox** drawer, you may see a couple of changes.

### While loop

We’ve found that "While True" loops can get students into a lot of trouble, often becoming infinite loops in their programs! So, we changed the default value to be "false" as a safer way for them to start using this block and to have the appropriate conditions set for exiting the loop.

![New while loop block](/static/blog/microbit/2021-release/while.png)

### Every time interval block

This new block is useful for looping on a given time interval (in milliseconds). It's like the Forever loop but the code inside doesn't run again until an interval of time set for the loop expires first.

![New every loop block](/static/blog/microbit/2021-release/every.png)

## Text coding not available in Windows app

Now that one-click downloads are supported with the web version of MakeCode, this release starts the journey to deprecate the Windows 10 app. You can no longer use the text editor in the app, and update support for the app will stop after the 2022 release next June.

![No text editing message](/static/blog/microbit/2021-release/no-text-editing.png)

If you do need an app with full capabilities but for offline use, we recommend using the [Offline App](https://makecode.microbit.org/offline).

[![MakeCode App logo](/static/blog/microbit/2021-release/app-logo.png)](https://makecode.microbit.org/offline)

Thank you to everyone who has logged bugs, helped with translations, and suggested new features throughout the year! Any new bugs you find in this release, please log them in [GitHub](https://github.com/Microsoft/pxt-microbit/issues).

Any other comments, suggestions, and feedback, please participate in the micro:bit community on [Slack](https://tech.microbit.org/community/). And, please let us know what you think of this year’s updates on Twitter [@MSMakeCode](https://twitter.com/MSMakeCode).

<br/>
Happy Making and Coding!

The MakeCode Team
