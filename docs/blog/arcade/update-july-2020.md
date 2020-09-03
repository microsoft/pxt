# MakeCode Arcade Update

**Posted on July 17th, 2020 by [Jaqster](https://github.com/jaqster)**

Hard to believe it was only January when we released MakeCode Arcade for General Availability. So much has happened since then. We hope everyone is staying safe and healthy.

In the 6 months since our last release, a lot of great fixes and features have piled up, so we’re happy to bring them to you in this latest release!

Huge thanks to everyone who has been filing bugs, submitting PR’s and offering us suggestions along the way! Special shout-out to [Jacob Carpenter](https://github.com/jacobcarpenter) who reported a bunch of issues, and also contributed 4 great PR’s for us –

* Adding copy/paste support for marquee selections in the Sprite Editor ([#7060](https://github.com/microsoft/pxt/pull/7060))
* Adding keyboard shortcuts to the Sprite Editor ([#7293](https://github.com/microsoft/pxt/pull/7293))
* Adding the Fill function for the Wall tool in the TileMap Editor (woo-hoo! [#6889](https://github.com/microsoft/pxt/pull/6889))
* Cleaning up the resizing of the Home Page cards ([#7146](https://github.com/microsoft/pxt/pull/7146))

Thank you Jacob! 😊

We also have a new Arcade device that has been released by [TinkerGen – the GameGo](https://www.tinkergen.com/gamego)! Check it out on our [Hardware](https://arcade.makecode.com/hardware) page.

![GameGo gamepad](/static/blog/arcade/update-july-2020/game-go.png)

Some of the improvements and latest features for MakeCode Arcade include:

## Python language support!

We’ve slowly been rolling this out across all our code editors starting first with Minecraft, then micro:bit, and now Arcade. Try writing some Python Arcade games and let us know what you think!

![Python editor](/static/blog/arcade/update-july-2020/python-editor.png)


## My Project language icons

In support of the 3 language options, we’ve added icons to the recent project cards on the Home Page to denote which language was used to create the program – Blocks, JavaScript, or Python

![Project cards](/static/blog/arcade/update-july-2020/project-cards.png)

## Option to create JavaScript or Python only Projects

We know most people will take advantage of the dual editor view to switch between Blocks and a text language. We’ve heard feedback from some CS teachers though, that they would like the option to keep their students only in JavaScript or Python to code their games.

![Create Python only project cards](/static/blog/arcade/update-july-2020/python-only.png)

## Error Messages

Big thanks to [Hristo](https://github.com/hristoramirez), an intern on our team who helped create an error message window for people using JavaScript or Python.

![Errors in code are listed](/static/blog/arcade/update-july-2020/error-msgs.gif)

## Multi-part Tutorials

We've started exploring the use of branching (“choose-your-own-adventure”) tutorials that are sequenced together. Our first two are Shark Attack and the Wonder Woman Maze game. Try them out and let us know what you think of this new format!

![Cards for multipart tutorials](/static/blog/arcade/update-july-2020/multipart.png)

## Functions with Image parameters and Return values

This has been a request for quite some time, and we’re happy to get these changes into Arcade! You can now pass images into functions as parameters, and you can return values from Functions as well.

![Image parameters in functions](/static/blog/arcade/update-july-2020/functions.png)

## Blocks Improvements 

We’ve made a few improvements for folks writing long block-based games:

### Collapse Blocks

Clean up your Workspace by collapsing big clusters of code. Now, on Function blocks, use the toggle to collapse, and right-click on any event handler block to select Collapse Block.

![Collapsing blocks](/static/blog/arcade/update-july-2020/collapse-blocks.gif)

### Dot-to-Dot Connectors

These are helpful indicators when dropping in embedded blocks.

![Dot connector](/static/blog/arcade/update-july-2020/dot-connector.png)

### Snapshots

Do you have a great code snippet you’d like to reuse across games? Now when you take a Snapshot of your code, not only do you get a nice image of your blocks, but the code is also embedded in the .png file! Drag and drop these files into the editor to insert code snippets.

### Performance

We’ve also made some performance improvements for folks writing very large block-based games.

## Sprite and Tile Map Editor Improvements

We added a few tweaks and features to make working with the Sprite and Tile Map Editors easier.

* Copy/Paste in the sprite editor

![Copy - paste for images](/static/blog/arcade/update-july-2020/copy-paste.gif)

* Ability to use the Fill tool to create Walls in the Tilemap Editor

![Fill tool on walls](/static/blog/arcade/update-july-2020/wall-fill.gif)

* Ability to access the Tilemap Editor in the text coding window

![Tilemap in the monaco editor](/static/blog/arcade/update-july-2020/tilemap-monaco.gif)

* We also made some improvements to the Tilemap and image blocks:

![Sprite hits wall block](/static/blog/arcade/update-july-2020/sprite-hits-wall-location.png)

![Tile at position block](/static/blog/arcade/update-july-2020/tile-at-position.png)

![Image compare](/static/blog/arcade/update-july-2020/image-compare.png)

We hope you enjoy and make use of some of these new fixes and features! If you find any issues, or have suggestions, please log them on [GitHub](https://github.com/microsoft/pxt-arcade/issues). If you have questions, or would like to participate in the MakeCode community, please join the [Forum](https://forum.makecode.com) or follow us on social [@MSMakeCode](https://twitter.com/MSMakeCode).

<br/>
Happy Making and Coding!

The MakeCode Team