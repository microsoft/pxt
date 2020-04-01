# MakeCode Arcade Released for General Availability!

**Posted on January 6th, 2020 by [Jaqster](https://github.com/jaqster)**

Ringing in the New Year with a New Release! The MakeCode team is very happy and proud to announce that [MakeCode Arcade](https://arcade.makecode.com) has been officially released for general availability today!

For those of you who have been following our progress, you’ll know that we’ve been working on MakeCode Arcade for about 2 years now... and we’ve had it in Beta for the past year while we’ve continued to get feedback, fix bugs, make improvements and just generally polish up the experience.

Huge thanks to everyone who has been using the Beta version, filing bugs and offering us suggestions (shout-outs to Kevin J Walters and [Alex Kulcsar](https://twitter.com/AlexKulcsar) for helping us find a lot of great bugs!). Also big thanks to our *amazing* hardware partners who have worked with us to make super fun Arcade-compatible game devices that really bring the Arcade games to life!  Check them out here – https://arcade.makecode.com/hardware.  
 
![Several boards that run Arcade](/static/blog/arcade/general-release/arcade-boards.jpg)

For those who may be new to MakeCode Arcade, here’s a little overview video:

https://youtu.be/UCq1VUIqpHI

## New Features and Improvements

Lots of new features and improvements are in this new release since the last stable Beta. These are some biggest improvements and more important features:

### Theming

The first thing you may notice is a slightly different color theme, a retro orange and blue color that is more accessible for low-vision users.

### Simulator

The simulator has also had a new coat of paint with bigger buttons and better button placement for game play using a touch screen on tablets or phones. Most importantly though, it now supports multi-touch and is generally more touch-friendly. Thanks to some great user suggestions, we’ve also added a keyboard shortcut menu to the simulator toolbar to help remind people what controls map to which keys.
 
![Simulator theme](/static/blog/arcade/general-release/theme-simulator.png)

### Sprite Editor

We know people spend a lot of time designing their sprites, so we made this a bigger window with some improved design tools (marquee, pan, etc.).   
 
![Sprite Editor](/static/blog/arcade/general-release/sprite-editor.png)

#### Drawing Tools

Three new sprite drawing tools are added. They are the **Circle**, **Line**, and **Canvas Pan** tools.

![New sprite editor](/static/blog/arcade/general-release/drawing-tools.png)

#### Undo and Zoom

Along with the **Undo / Redo** controls, we've now added the canvas **Zoom** control so that you can zoom in to draw those fine details in your images.

![Undo and Zoom controls](/static/blog/arcade/general-release/undo-zoom.png)

#### Image Sizer

The **Image Size** control lets you change you sprite's image to the exact width and height that you want.

![Image size control sprite editor](/static/blog/arcade/general-release/image-sizer.png)

#### Gallery

As for sprites, we also added some new ones in the Gallery – check them out (my favorite is the monkey). 
 
![Image gallery in the Sprite Editor](/static/blog/arcade/general-release/gallery.png)

### Tilemap

Those of you who have been using the Beta, probably the biggest change you'll notice is the way we now do Tilemaps. A 'Tile' in a game is a square image that you can use to lay out the background Map of your game (think of them like tiles in real life used to cover an area). The way we did Tilemaps before, we used colors to denote different tile images. We got a lot of feedback that this was super confusing for people and it limited the types of tiles you could have in your game (Arcade only has 16 colors so you could only have 16 kinds of tiles). So, now we have a new and improved Tilemap Editor that lets you draw the tiles on your game canvas, and you can draw walls on your tile map too. 
 
![New tilemap editor](/static/blog/arcade/general-release/tile-map-editor.png)

If you do want to still use the old Tilemap blocks, you can add them as an extension called "Color-coded Tilemap".
 
![Extension for old style tilemaps](/static/blog/arcade/general-release/old-tile-map.png)

### Animation

To make animations for your sprites, you can use the Animation extension. This is a collection of blocks that allow you to create different image frames of sprite motion – for example, you can create a Jumping or Walking sprite animation. 
 
![Animation extension](/static/blog/arcade/general-release/animation-extension.png)

![Animation editor](/static/blog/arcade/general-release/animation-editor.png)

### Download to Hardware

For those people who are lucky enough to have several different Arcade boards, we’ve made it easier to select and switch devices when downloading your game. 
 
![Download to hardware](/static/blog/arcade/general-release/download-hardware.png)

### Performance Improvements

We spent a lot of time working on making Arcade run faster, especially on Chromebooks and other lower-powered computers, so you should see snappier page loads and simulator runs now too!

### GitHub Authoring

For games that are big/complex, or they have multiple people working on them, and for anyone writing Arcade extensions, we have a cool new integration with GitHub that allows you to store and work on your projects in a GitHub repo.   

To bring in the full power of GitHub integration to the editor, a **GitHub** button is now present right next to the project **Save** button. Now you can have your project's changes synced to/from GitHub with just a button click.

![GitHub button](/static/blog/arcade/general-release/github-integrate.png)

Read more about this feature here – https://makecode.com/blog/makecode-with-github.

## Future Releases and Updates

Now that MakeCode Arcade has been released, we will be following the same annual update path we use for our other editors. This means we will only do one major update in the summer, so teachers can expect to have a stable version to work with during the school year.

## Coding Curriculum

The MakeCode Arcade curriculum is freely available at https://arcade.makecode.com/courses/csintro. This curriculum covers Computer Science and game development concepts through a series of activities and lessons. Also, there are plenty of game tutorials, lessons, and samples available: https://arcade.makecode.com/docs. 
 
![Lesson to choose from](/static/blog/arcade/general-release/lessons.png)

## Connecting With Us

If you find any issues, or have suggestions, please log them as a [GitHub issue](https://github.com/microsoft/pxt-arcade/issues). If you have questions, or would like to participate in the MakeCode community, please join the [MakeCode Forum](https://forum.makecode.com) or follow us on social media at [@MSMakeCode](https://twitter.com/MSMakeCode).

<br/>
Happy Making and Coding!

The MakeCode Team
