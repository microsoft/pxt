# MakeCode for micro:bit 2024 Update

**Posted on September 4, 2024 by [Jaqster](https://github.com/jaqster)**

Today we are releasing our annual update for [MakeCode for the micro:bit](https://makecode.microbit.org). This year we have been focusing on some core foundational and infrastructure-level work to ensure that MakeCode is set up for future success and is more reliable and secure than ever before.

## Security & Privacy comes first

In alignment with [Microsoft’s Secure Future Initiative](https://blogs.microsoft.com/blog/2024/05/03/prioritizing-security-above-all-else), we have worked to ensure that MakeCode adheres to strict product security policies and follows all the best practices of [Microsoft’s Security Development Lifecycle](https://www.microsoft.com/en-us/securityengineering/sdl) approach to building software. As an educational product, we know that security and privacy are paramount to any digital learning experience used in schools. And we are committed to ensuring that MakeCode remains a safe, secure environment for learning. For more information about Microsoft MakeCode’s privacy policies, please visit [makecode.com/privacy-faq](https://makecode.com/privacy-faq).

![Microsoft logo](/static/blog/microbit/2024-update/msft-logo.png)

## Blockly Update

Another big foundational area of work for us this past year has been to upgrade the MakeCode visual programming interface to use the latest Blockly library. MakeCode has a long-standing partnership with the [Google Blockly Team](https://developers.google.com/blockly) who build the underlying library that almost all visual programming languages use. You shouldn't notice any big visual differences in the MakeCode blocks, but by upgrading we are now able to access all the latest Blockly plugins and features, including support for future work around [accessible blocks](https://developers.google.com/blockly/accessibility). If you’re interested in learning more about our work on the "Great Blockly Upgrade", watch this talk from the [Blockly Summit](https://rsvp.withgoogle.com/events/blockly-summit-2024/sessions/the-great-blockly-upgrade).

![Blockly logo](/static/blog/microbit/2024-update/blockly-logo.png)

## Version History

Have you ever been working on a project when all of a sudden, your evil twin takes over and completely destroys your work and introduces a ton of bugs? Well, never fear, Version History is here! You can access previous versions of your code through the Project Settings menu in the upper right corner.

![Project settings menu](/static/blog/microbit/2024-update/project-settings-menu.jpg)

In the **Version History** pane, you can see the timestamps of when your code was automatically saved. You can click on the different times to see the version of your code at that time, and you can see when you shared your project. Using the buttons at the top, you can save a copy of any version of your program, or you can restore an older version of your code (before your evil twin took over).

&lt;**VersionHistory.gif - will be updated**&gt;

Tutorial accessibility improvements We released [Immersive Reader](https://youtu.be/ZYJhQ0HNvq4) support for tutorial instructions back in 2021 in order to support students with literacy challenges. We’re continuing to improve the accessibility of our tutorials for color blind and vision impaired users by changing the block name color highlighting to include the icon and improve color contrast readability.

![Tutorial instructions](/static/blog/microbit/2024-update/tutorial-instructions.jpg)

## Audio recording improvements in simulator

Last year we released the [audio recording and playback extension](https://makecode.com/blog/microbit/2023-release) allowing students record short audio clips and play them back on the micro:bit. This year we made some improvements to better support this extension in the micro:bit on-screen simulator as well – specifically to support the sample rate to better mimic the sounds on hardware. Now students can experiment with recording audio with their computer where they will hear:

* Worse audio quality at lower sample rates (and better at higher)
* Longer recording times at lower sample rates (and shorter at higher)
* The ability to change playback speed by changing the output sample rate

![Audio sampling](/static/blog/microbit/2024-update/audio-sampling.jpg)

## New blocks

And finally, we do have a few new blocks in this release –

### Char code from string

This is a helpful Text block that will return the ASCII code of a character in a string at a specified index position.

![CharCode block](/static/blog/microbit/2024-update/char-code-block.jpg)

### Pins Update

Big thanks to GitHub contributor [Sae](https://github.com/sae220) who helped us make this subtle change to allow for more flexibility in programming the micro:bit pins. MakeCode allows you to read from and write to pins **P0-P16** on the micro:bit, and these pins can be used for both analog and/or digital signals. To learn more about the micro:bit pins, see https://makecode.microbit.org/device/pins. In this release, we updated the pins blocks to allow for dragging and dropping different pin values and even variables.

![Old pin identifiers](/static/blog/microbit/2024-update/old-pin-identifiers.png)
_Old Pins_
<br/><br/>

![New pin identifiers](/static/blog/microbit/2024-update/new-pin-identifiers.png)
_New Pins_
<br/><br/>

![New pins blocks animation](/static/blog/microbit/2024-update/new-pins.gif)

### Nested Blocks

It's not new, but we’ve improved the color contrast for nested blocks of the same color with a lighter border to make them more readable.

![Old nested blocks](/static/blog/microbit/2024-update/old-nested-blocks.png)
_Old nested blocks_
<br/><br/>

![New nested blocks](/static/blog/microbit/2024-update/new-nested-blocks.png)
_New nested blocks_
<br/><br/>

Thank you to everyone who has logged bugs, submitted PR’s, translated and suggested new features throughout the year! Any new bugs you find in this release, please log them as a [GitHub issue](https://github.com/Microsoft/pxt-microbit/issues).

As for any other comments, suggestions, and feedback, please participate in the micro:bit community on [Slack](https://tech.microbit.org/get-involved/where-to-find) or the [MakeCode Forum](https://forum.makecode.com).

Happy Making and Coding!

<br/>
The MakeCode Team