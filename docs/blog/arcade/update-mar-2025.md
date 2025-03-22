# MakeCode Arcade 2025 Update

**Posted on March 24th, 2025 by [Jaqster](https://github.com/jaqster)**

Wow, I can't believe it's been 2 years since we shipped an update to MakeCode Arcade! We had over 800 open issues and many pending features pushing at the Beta gate to get out. This release felt so good to ship! We hope you enjoy some of these new goodies!

Note – we know it's the middle of the school year for many, so if you would like to continue using the existing version, you can bookmark https://arcade.makecode.com/v1.12. 

## Blockly update

In line with our other editors, Arcade got upgraded to the latest version of the Blockly library. The MakeCode blocks visual programming interface is built on [Google 
Blockly](https://developers.google.com/blockly). You shouldn't notice any big visual differences in the MakeCode blocks, but by upgrading we are now able to access all the latest Blockly plugins and features, including support for future work around accessible blocks. If you're interested in learning more about our work on the "Great Blockly Upgrade", watch this talk from the [Blockly Summit](https://youtu.be/SoXN61lSL9U).

## Version history

Version history comes to Arcade finally!

>_"Noooo!!! I just made a change that deleted all my code!!! Please help me!"_

These posts on our forum always made us very sad 😞. So, we decided to do something about it. The Version History feature (affectionately called the ‘MakeCode Time Machine') supports 5-minute snapshots of code so users can restore and save copies of previous versions of their projects. Open the Settings menu and select Version History to see this view.

<VersionHistory.gif>

## Themes and Accessibility improvements

Orange isn't for everyone. And although I love the original Arcade orange color scheme, it isn't the most accessible in terms of color contrast for visually impaired users. So, we've added support for themes – now users can select from among 4 different color themes including a high contrast theme to help improve accessibility and add a touch of personalization! To set your theme, click on the Settings menu and select Theme.

<Themes.png>

As part of our theming overhaul, some of you may have noticed that we also updated the Arcade font family to a more accessible/readable font.

<Fonts.png>

And we've improved the color contrast for nested blocks of the same color with a lighter border to make them more readable.

<OldNested.png>

### Old nested block borders

<NewNested.png>

### New nested block borders

And we've improved the accessibility of our tutorials for color blind and vision impaired users by changing the block name color highlighting to include the icon and improve color contrast readability.

<TutorialUpdates.png>

## Editor Tour

There is a lot going on in the Arcade code editor, and it can be overwhelming for newbies. We released an interface tour that automatically starts for new users when they create their first project, or it can be started from the Help menu. This feature is helpful to set context and orient people before they start coding.

<Tour.gif>

## Support for more languages

We are so happy to see MakeCode Arcade going global! We have support for 5 new languages in this release – Arabic, Dutch, Irish, Italian and Korean! Big, big THANK YOU to all the volunteers who have helped localize MakeCode and bring coding to students around the world. If you would like to help translate or proofread translations, learn how to get involved at https://makecode.com/translate. 

<EditorLanguages.png>

## Blocks Copy/Paste

This feature is a real delighter for me. Now, you can copy chunks of code across projects! Simply right-click on a block in one project and select Copy (or Ctrl-C on keyboard), open another project, right-click on the Workspace and select Paste (or Ctrl-V).

<CopyPaste.gif>

## Animations go mainstream

With the popularity of the animation blocks, we've decided to pull them out of the Advanced section of the Toolbox and make them more discoverable for users.

<Toolbox.png>

## Keyboard input

This was a request of many of the AP CS Principles teachers who are using Arcade to teach user input and output. Now, for users on a computer, the Ask for String and Ask for Number blocks will use the system keyboard input by default, instead of the game controller input making it much easier to enter long responses. If you download your game onto a handheld Arcade device, or click on the on-screen game controls, then the input will revert to using the game controller buttons.

<Keyboard input.gif>

## Open in Visual Studio Code Online

We shipped the [MakeCode Arcade extension for VS Code]( https://makecode.com/blog/arcade/vscode-extension) a couple years ago, and have seen positive feedback from folks using it. Now, we're excited to release support for MakeCode Arcade in Visual Studio Code for the web. This makes it even easier to move projects from MakeCode to VS Code because everything's in the browser.

<VSCodeWeb.gif>

Thank you to everyone who has logged bugs, submitted PR's, translated and suggested new features! Any new bugs you find in this release, please log them in [GitHub](https://github.com/Microsoft/pxt-arcade/issues)

Any other questions, comments, suggestions, and feedback - please join the discussion at the
[MakeCode Forum](https://forum.makecode.com).

Happy Making and Coding!

<br/>
The MakeCode Team