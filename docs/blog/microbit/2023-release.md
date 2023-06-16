# Tour around MakeCode micro:bit 2023 Release!

**Posted on June 19, 2023 by [Jaqster](https://github.com/jaqster)**

School’s out for many in the Northern Hemisphere, which means that it’s time for our annual release! Here’s the list of new or updated features in this release:

## Getting Started Tour

This feature is near and dear to my heart – I had filed an issue for this way back in 2017, so I’m dancing in my seat to see it come to life! There’s a reason why many products have a getting started tour for new users – they are helpful to set context and orient people within the user interface. However, we know that many students will immediately dismiss tours, so we tried to make this a short and playful experience. The tour will automatically start for users when they create their very first project, or you can access the tour from the Help menu in the editor.

<Tour.gif>

## Sign in

One of the great things about MakeCode is that it’s super accessible and a one-click-to-code experience (okay, two clicks). We wanted to keep it open and accessible, but we’ve gotten feedback from many educators that keeping track of student projects, especially on shared computers can be a pain. So, we’ve added an option to sign in with a Microsoft or Google account. This will save your projects to the cloud – allowing you to access them from any computer, and keeping them separate from the local browser-cached projects. Signing in isn’t required, but if you do, you’ll have the additional peace of mind knowing your projects are safe and sound in the cloud. Please note that Microsoft takes student data privacy very seriously – if you have any questions about this, please consult [Microsoft’s Privacy policies](https://privacy.microsoft.com), or the [MakeCode Privacy FAQ]( https://makecode.com/privacy-faq).

<SignIn.gif>

## Persistent Share Links

An additional benefit of signing in is the ability to create a persistent share link for your projects. This means that you can create one link to a project, publish it to your students or include it in curriculum, and for any subsequent changes you make to the project, you can keep the same link.

![New share project dialog](/static/blog/microbit/2023-release/share.png)

You’ll notice that these links look a little different from the normal share links - they all start with an 'S'.

![New share link dialog](/static/blog/microbit/2023-release/share-link.png)

In general, you may notice these Share windows look slightly different – we’ve added a couple new features here as well. There’s more places to share to – including Microsoft Teams, Google Classroom, WhatsApp and more. You can also create a screenshot or gif animation of your project to share by selecting "Update project thumbnail"

![New share thumbnail dialog](/static/blog/microbit/2023-release/share-thumbnail.png)

## Download Flow

We are excited about a new browser technology that allows you to pair a USB device to your browser window – it’s called "WebUSB" and is supported by Chrome and Edge browsers. Gone are the days of file drag-and-drop! If you are using Chrome or Edge, you’ll notice a slightly different flow when you click the Download button the first time. And once you pair your micro:bit, clicking Download will automatically download your project directly to the micro:bit!

<DownloadFlow.gif>

## Tutorial Improvements

We changed the tutorial layout slightly to make navigating through the tutorial steps easier. You can also resize the tutorial instruction window to better fit your screen size. We had also received feedback that sometimes it was hard to know what block to use in the instructions. So now you can click on the colored block names in the instructions to open the location of the block in the Toolbox. And we now support images, icons and videos embedded in tutorial instructions.

<Tutorial.gif>

## Code Validation

We are cautiously starting to add more validation rules and auto-assessment capabilities into MakeCode. One of the first things we are adding is simple block detection rules as a validation check between tutorial steps. This helps give students immediate feedback if something is missing in their code.

<CodeValidation.gif>

## Audio Recording & Playback Extension

There is a new extension available in the extension gallery called "audio-recording" which will allow you to record short audio clips and play them back. This extension will only work on the micro:bit v2.

![Audio extenstion card](/static/blog/microbit/2023-release/audio-ext.png)

![New audio blocks](/static/blog/microbit/2023-release/audio-blocks.png)

## Music Category Clean-up

You may notice some slight changes to the Music category blocks. We’ve done some work to clean-up and standardize these API’s to all use the "Play" terminology with a play mode property (until done, in background or looping).

<MusicBlocks.gif>

We also added a "Sound is Playing" block to help distinguish between sounds coming from the micro:bit and the environment.

!['Sound is playing' block share thumbnail dialog](/static/blog/microbit/2023-release/sound-is-playing.png)

Thank you to everyone who has logged bugs, translated and suggested new features throughout the year! Any new bugs you find in this release, please log them in [GitHub](https://github.com/Microsoft/pxt-microbit/issues).

Any other comments, suggestions, and feedback, please participate in the micro:bit community on [Slack](https://tech.microbit.org/get-involved/where-to-find) or the [MakeCode Forum](https://forum.makecode.com). And please let us know what you think of this year’s updates on Twitter [@MSMakeCode](https://twitter.com/MSMakeCode).

Happy Making and Coding!

<br/>
The MakeCode Team