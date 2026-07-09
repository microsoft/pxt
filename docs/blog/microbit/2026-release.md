# MakeCode for the micro:bit 2026 – Accessible Blocks are here!

**Posted on July 13, 2026 by [Jaqster](https://github.com/jaqster)**

As part of our annual [MakeCode for the micro:bit](https://makecode.microbit.org) release, we are so excited ship one of the first fully accessible block-based code editors!!! This has been a goal for many years, but as you can imagine, making a primarily visual, mouse-based interface fully accessible is a big challenge. Then three years ago, Google funded a [grant program](https://www.blockly.com/accessibility) for non-profits to work on making block-based coding accessible, and thanks to the incredible partnership with the [Micro:bit Educational Foundation](https://microbit.org) and the [Blockly Team](https://www.blockly.com), we are releasing keyboard controlled and screen reader enabled coding blocks in MakeCode!

https://youtu.be/JVPqJAn7tcM

This was a combined effort of the MakeCode Team with the [Micro:bit Educational Foundation](https://microbit.org) leading the co-creation of the experience together with vision impaired users and working closely with teachers to refine the design and interface. The [Blockly Team](https://www.blockly.com) incorporated these ideas into the latest release of the Blockly library, and Blockly community partners like Code.org, Scratch and MIT App Inventor contributed feedback along the way.

While this is a huge milestone to ensure block-based coding is accessible to vision and motor impaired students, we still have more we want to do. We are inspired by the accessibility research community, including Kirsty McNaught [eye gaze coding](https://kmcnaught.co.uk/2026/03/01/Eye-gaze-coding-with-Blockly.html), Andreas Stefik [Quorum](https://quorumlanguage.com), and the whole [AccessCSforAll](https://accesscomputing.uw.edu/accesscsforall) community.

## Keyboard Controls on by default

We introduced Keyboard Controls last year as a setting that you could turn on to use MakeCode primarily with the keyboard as an input device. We’ve now enabled this capability by default, bringing Keyboard Controls to parity with the mouse - so now anyone who uses MakeCode can switch between using the mouse and the keyboard to select and place blocks on the workspace!

Keyboard shortcuts:

Action | Windows | Mac
-|-|-
Show Help menu | `Ctrl` + `/` | `⌘` + `/`
Open Area menu | `Ctrl` + `B` | `⌘` + `B`

<br/>

The keyboard controls **Help** menu will show a list of the different key strokes for each action.

![Keyboard help table](/static/blog/microbit/2026-release/keyboard-help.png)

And the keyboard controls **Area** menu will allow you to quickly jump to a different part of the user interface.

![CTRL+B jump areas](/static/blog/microbit/2026-release/ctrl-b.png)

## Screen Reader

MakeCode now fully supports all screen readers, including [NVDA](https://www.nvaccess.org/download), [JAWS](https://support.freedomscientific.com/Downloads/JAWS), [Windows Narrator](https://www.microsoft.com/en-us/windows/learning-center/how-to-use-narrator), [Mac Voice Over](https://support.apple.com/guide/voiceover/welcome/mac), and [ChromeVox](https://support.google.com/chromebook/answer/7031755).

<ChromeVox.png>

Simply turn on your screen reader and navigate around the MakeCode user interface to hear descriptions and actions you can take. Optionally, you can turn on the Screen Reader mode from the **Settings** menu which will include hard stops when navigating through code on the workspace (instead of continuing to loop through blocks) and adds an audio cue when changing block container nesting levels.

![Screen reader mode](/static/blog/microbit/2026-release/sc-mode.png)

To learn more about the screen reader support and keyboard controls, see https://makecode.com/accessibility.

For additional accessibility resources like teacher guides, a tactile micro:bit poster, and physical hardware adaptations, see https://microbit.org/accessibility.

## Home Page Updates

You may notice some minor updates we’ve made to the Home Page in this release –

* **Search** – use the Search button to find tutorials, videos and other resources more quickly.

![Search button on homescreen](/static/blog/microbit/2026-release/search-button.png)

![Homescreen search box](/static/blog/microbit/2026-release/search-results.png)

* **Tutorial Sharing** – this was a top request from educators, now there’s an easier way to copy and paste links that go directly to MakeCode tutorials. Click the Share button on the tutorial card and click Copy to get a direct tutorial link.

![Tutorial sharing](/static/blog/microbit/2026-release/tutorial-share.png)

* **My Projects** – if you’re like me and have a lot of different projects saved, you’ll appreciate some of the cleanup we’ve done to include additional project metadata including project icons, tutorial progress, and cloud sync status to the My Projects view.

![My Projects list](/static/blog/microbit/2026-release/my-projects.png)

## New Blocks

And we’ve added a couple of new blocks for folks who have requested them –

![New Math and Pause blocks](/static/blog/microbit/2026-release/new-blocks.png)

* **Math convert block** – allows you to convert values between degrees and radians, and Celsius and Fahrenheit. Learn more at https://makecode.microbit.org/reference/math/convert.
* **Pause until** – stops program execution until a condition is fulfilled. Learn more at https://makecode.microbit.org/blocks/pause-until.

## Extensions

We have a really vibrant ecosystem of micro:bit extensions with over 280 different extensions being used every month in MakeCode.

* **Gallery** – we’ve cleaned up the extension gallery view a bit to help with filtering, and we’ve added indicators on the extensions so you can easily see what extensions have been installed in your project.


<ExtGallery.png>

* Piano Roll – a new extension that’s helpful for advanced music users.  Here is a sample project using the Piano Roll extension: https://makecode.microbit.org/_Ys3W6yU65iAj. Learn more about this extension at https://github.com/microsoft/pxt-piano-roll. 


<PianoRoll.png>


Thank you to everyone who has logged bugs, submitted PR’s, translated and suggested new features throughout the year. And very special thanks to the micro:bit [Youth Ideation Panel](https://microbit.org/news/2026-05-19/cocreating-accessible-coding-experiences-with-young-people) whose feedback and input was invaluable as we were designing the accessible blocks experience. Any new bugs you find in this release, please log them in GitHub: https://github.com/Microsoft/pxt-microbit/issues. Other comments, suggestions, and feedback, please participate in the micro:bit developer community at https://tech.microbit.org/get-involved/where-to-find or the [MakeCode Forum](https://forum.makecode.com).

Happy Making and Coding!

<br/>
The MakeCode Team
