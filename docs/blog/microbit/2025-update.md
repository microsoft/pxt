# MakeCode for the micro:bit – 2025 Update

**Posted on July 18, 2025 by [Jaqster](https://github.com/jaqster)**

It's July and school's out in most of the world, so it's time for our annual [MakeCode for the micro:bit](https://makecode.microbit.org) update! As well as the 142 bugs that we fixed in this release, here's a rundown of the new features:

## Keyboard Accessibility of Blocks

This was the biggest area of work for this year and was a great example of collaboration with our partners at [Google Blockly](https://developers.google.com/blockly) and the [Micro:bit Foundation](https://microbit.org) who did much of the heavy lifting to make this happen. So huge kudos and thank you to them for all the hard work and extensive user testing that went into this feature!!!

Why is keyboard accessibility important? Some computer users may have difficulty using a mouse as an input device – either due to fine motor or mobility challenges, or simply because they prefer using a keyboard. The drag-and-drop block coding interface, while an excellent approach to teaching novice programmers, has thus far been completely dependent on being able to use a mouse to click and drag around blocks on the workspace. No longer! (drum-roll) We are so proud and excited to announce that keyboard accessibility in block-based coding is here!!!

To turn on the keyboard controls, in the MakeCode editor, click on the Settings menu and select **Keyboard Controls** to toggle this feature on.

![Settings Menu](/static/blog/microbit/2025-update/settings-menu.png)

You can also just press the **Tab** key when you open the editor to get the shortcut menu and then select **Enter**.

![Tab Shortcut](/static/blog/microbit/2025-update/tab-shortcut.png)

When you activate keyboard controls, a help pane will appear with information on the keys to press to navigate around the editor.
 
![Side Docs](/static/blog/microbit/2025-update/sidedocs.png)

Pressing the **Escape** key will hide this pane and pressing **Control** and **/** keys simultaneously will show the Keyboard Controls help pane.

Pressing the **Control (Ctrl)** and **B** key on the keyboard simultaneously will show the different areas of the editor you can navigate to by pressing the numbers **1-5**.
 
![Ctrl-B function](/static/blog/microbit/2025-update/ctrl-b.png)

You can navigate around the Toolbox menus and the blocks on the Workspace by using the directional **Arrow** keys. To select or edit a value, press the **Enter** key.  Pressing the **Escape** key will exit you out of the current focus.  

In the Workspace, you can move blocks around by pressing the **M** key – this will put the editor into "Move mode" which is denoted by a circle with arrows inside. In this mode, you can press the **Arrow** keys to move blocks to different valid positions in your code or you can press the **Control** and **Arrow** keys simultaneously for free movement of blocks around the workspace.
 
![Move Mode](/static/blog/microbit/2025-update/move-mode.png)

For videos and a downloadable pdf to help you learn how to use keyboard controls visit [Micro:bit Educational Foundation's MakeCode Accessibility](https://microbit.org/accessibility/microsoft-makecode) support page. 

Fully accessible block coding is a multi-year investment – we started last year with upgrading MakeCode to the latest Blockly library, this year we worked on getting blocks to be keyboard navigable, and next year we hope to add screen reader support.  Stay tuned, there's more to come!

## Themes

We also continue to work on accessibility by adding theming support to MakeCode's visual interface, supporting people with differing visual needs. To select a theme, click on the Settings menu and select 'Theme'. This will give you the option to select from the default Light theme, a Dark theme, and a High Contrast theme.
 
![Theme Settings](/static/blog/microbit/2025-update/theme-settings.png)

![Choose Theme](/static/blog/microbit/2025-update/choose-theme.png)

## Math Constants

And what's a release without some new code blocks?!  This year we are introducing the Math constants block which contains some helpful values like Pi, e, and some square root and logarithmic values.
 
![Math constant block](/static/blog/microbit/2025-update/math-const.png)

## Code Evaluation

Earlier this year we introduced the Beta of our [Code Evaluation](https://makecode.com/blog/tools/code-eval-tool) tool for teachers which helps them understand and evaluate student programs. We are moving this out of Beta and adding an **Evaluate** button on the Shared project page to make it easier to access.  

 
![Share page](/static/blog/microbit/2025-update/share-page.png)

When you click the **Evaluate** button, after logging into MakeCode, the project will load in the Code Evaluation tool where you can evaluate checklists of program criteria and Ask AI questions about the student code.
 
![Eval tool](/static/blog/microbit/2025-update/eval-tool.png)

## Display Shield Extension

We love the micro:bit LED's, but there is only so much information you can convey on a 5 x 5 single-color display. Many micro:bit hardware partners have created accessories to extend the micro:bit to add a full color screen, often called "display shields". To support these accessories, we are launching a new Blocks and Simulator extension.
 
![Display shield](/static/blog/microbit/2025-update/display-shield.png)

![Display shield hardware](/static/blog/microbit/2025-update/display-shield-hw.png)

To learn more about this extension and how to get started, see the [Display Shield extension landing page]( https://makecode.microbit.org/pkg/microbit-apps/display-shield). 

## Error Explainer Experiment

The Error Explainer is an AI-powered feature that helps students understand errors in their programs. If an error occurs in code, the problems pane appears below the editor with the error message and an **Explain with AI** button that users can optionally click for a more comprehensive explanation of the error, as well as indicating where in their code the error occurs. This feature is available for both Blocks and Text editors. We are initially rolling this feature out as an experiment and to select users in different regions.

If you're interested in trying this out, you will have to sign into MakeCode, and then in the Settings menu, open the About dialog box and click on the **Experiments** button. Select the AI Error Explainer option to enable it.

![Error explainer card](/static/blog/microbit/2025-update/error-explainer-card.png)

Now if you have a program with an error, clicking on the **Explain with AI** button will launch callout windows in blocks or additional explanations in text with more information about the error and suggestions on how to fix it.

![Error explainer blocks](/static/blog/microbit/2025-update/error-explainer-blocks.png)

![Error explainer text](/static/blog/microbit/2025-update/error-explainer-text.png)

As this is still an experimental feature, we'd love to hear your thoughts!  Please add your comments to this [GitHub Issue](https://github.com/microsoft/pxt/issues/10694). 

## CreateAI

Together with the Micro:bit Educational Foundation, we launched [CreateAI last November]( https://microbit.org/news/2024-11-20/microbit-CreateAI-launch), and since then it's been gathering momentum!  We've heard from teachers around the world how they're using this new feature to teach the basics of Artificial Intelligence in a fun, physical way!  Some of the stories we've heard include:

* Computer Science and Physical Education teachers collaborating to use CreateAI models for practicing swimming strokes (dryland practice only – micro:bits should not go in water!)
* Dancer/CS teacher using CreateAI to model dance moves for her students
* [BBC Playground Survey]( https://www.bbc.co.uk/teach/microbit/articles/zkskh4j) in the UK to monitor activity levels

Teaching AI can be intimidating, but with the micro:bit and CreateAI, these concepts become simple and tangible for any student to understand – the impact and immediacy of physical computing applied to AI.
 
![BBC Playground Survey](/static/blog/microbit/2025-update/bbc-playground-survey.jpg)
 
![Create AI](/static/blog/microbit/2025-update/create-ai.png)

To get started, go to [CreateAI.microbit.org](https://createai.microbit.org) for videos and starter projects. If you have BirdBrain robots, try out the Magic Wand Lesson for [Finch](https://learn.birdbraintechnologies.com/finch/magicwand) or [Hummingbird](https://learn.birdbraintechnologies.com/hummingbirdbit/magicwand) robots.

Thank you to everyone who has logged bugs, submitted PR's, translated and suggested new features throughout the year. And special thanks to everyone who helped with testing the new Blocks Keyboard Navigation feature!

Any new bugs you find in this release, please log them in [GitHub](https://github.com/Microsoft/pxt-microbit/issues). Other comments, suggestions, and feedback, please participate in the micro:bit community on [Slack](https://tech.microbit.org/get-involved/where-to-find) or the [MakeCode Forum](https://forum.makecode.com). We are specifically interested in hearing your thoughts on keyboard accessibility of blocks, so please participate in the [discussion]( https://forum.makecode.com/t/keyboard-accessibility-for-blocks/37422).

Happy Making and Coding!

<br/>
The MakeCode Team
