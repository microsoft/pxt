# MakeCode Arcade 1st Birthday Update!

**Posted on January 22nd, 2021 by [Jaqster](https://github.com/jaqster)**

New Year, New Release! At this time last year we released the first official version of MakeCode Arcade, so we thought we’d celebrate our first birthday by doing another release update!

Most of the work in this release went into fixing bugs that had accumulated. By the way, THANK YOU if you’ve filed a bug in GitHub - this is super helpful for us!

We’ve also added a few new features as well, here’s a rundown:

## Flip and Rotate

We all spend a great deal of time in the Image Editor creating the perfect picture for our Sprites and Tiles. There are many times that we all wished we could flip or rotate our images.  Now you can!  We’ve added 4 new buttons to the Image Editor:

* Flip vertical
* Flip horizontal
* Rotate clockwise
* Rotate counter-clockwise

![Sprite editor flip tool](/static/blog/arcade/update-jan-2021/flip.gif)

## Animations are now mainstream!

We’ve finally moved the animations blocks into the built-in editor under the Advanced tab in the Toolbox.  Animations have become so popular that it just made sense to pull them out of an extension and always show these blocks in an Animation Toolbox category. We still have an animation extension available for the older, state-based animation blocks too.

![The Animation blocks category](/static/blog/arcade/update-jan-2021/animation-category.png)

https://youtu.be/TRjGj80g3Y0

## Sound Effect Enhancements

Sound effects and music are some of the most memorable features of many retro videogames, and our support has been improved thanks to contributions from [Klaus W](https://github.com/klausw) over 4 fantastic PRs:

* Adding new noise waveforms [#1177](https://github.com/microsoft/pxt-common-packages/pull/1177)
* Saving space and improving sine approximation [#1178](https://github.com/microsoft/pxt-common-packages/pull/1178)
* Make melodies stop correctly when `stop all sounds` is called [#1196](https://github.com/microsoft/pxt-common-packages/pull/1196)
* Update sound documentation with description of new waveforms [#3002](https://github.com/microsoft/pxt-arcade/pull/3002)
* New default melodies for the `play sound` block [#1226](https://github.com/microsoft/pxt-common-packages/pull/1226)

![The new sounds in the play sound blocks](/static/blog/arcade/update-jan-2021/new-sounds.png)

Klaus made a [post on the forum](https://forum.makecode.com/t/sound-effect-demo-no-extensions/5833) with details on how to use this, including a sample game with a ton of custom noises - including drums+bass, modems, crashes, and zaps! You can test some of these out at [https://arcade.makecode.com/91960-59425-02296-62940](https://arcade.makecode.com/91960-59425-02296-62940), and even copy some into your new game! For more detailed information on creating sound in MakeCode Arcade, you can also check out the [developer documentation](https://arcade.makecode.com/developer/sound).

Thanks you Klaus!

## New Array Block

This has been one of the most requested blocks. In general, randomization is an important aspect of game development, and often times when writing an Arcade game, people want to select a random value from an array. You can of course do this with the "Pick Random" number block for the array indices, but this block makes it so much easier!

![Get random from list block](/static/blog/arcade/update-jan-2021/get-random-list.png)

## New Sprite Flags

Another request from folks has been to provide more granularity in how Sprites interact with their environment.  Currently, we have a sprite property called "**Ghost**" which causes the sprite not to overlap with other sprites or collide with obstacles/walls - basically treat it as a ghost sprite that can’t interact with other sprites, tiles or walls. But sometimes, you want a sprite to be able to pass through walls and also overlap with other sprites. So, we’ve broken down the ghost property down into 3 more granular properties:

* Ghost through Sprites - Sprite doesn’t interact with other sprites (will not trigger Sprite Overlap events)
* Ghost through Tiles - Sprite doesn’t interact with tiles in a Tile Map (will not trigger Tile Overlap events)
* Ghost through Walls - Sprite can pass through walls in a Tile Map

![New sprite flags](/static/blog/arcade/update-jan-2021/sprite-flags.png)

The number of different flags you can set on a Sprite are also getting pretty long!  So we decided to pull out the 2 most common properties - "**Stay in Screen**" and "**Bounce on Wall**" as separate blocks to ensure that people can find them.

![Separate sprite flag blocks](/static/blog/arcade/update-jan-2021/sprite-flags2.png)

## Asset Editor

The next time you open up a game, you may notice a new button on the top of the Arcade editor screen called "Assets":

![Assets view tab](/static/blog/arcade/update-jan-2021/assets-menu.png)

This is a view that will allow you to see all the assets in your game.

![Asset selection view](/static/blog/arcade/update-jan-2021/assets-view.png)

An "Asset" can be:

* An image – for a Sprite, Projectile, Background, Dialog Frame

![Image asset](/static/blog/arcade/update-jan-2021/image.png)

* A tile – denoted by the stacked boxes icon

![Tile asset](/static/blog/arcade/update-jan-2021/tile.png)

* An animation – denoted by the film icon (animates when you hover your mouse over it)

![Annimation asset](/static/blog/arcade/update-jan-2021/animation.gif)

* A tile map – denoted by the map icon

![Tilemap asset](/static/blog/arcade/update-jan-2021/tilemap.png)

Why did we create this view? For a couple reasons:

* Easier Asset Management - as people were creating bigger and bigger games with a lot of different assets, it was getting difficult for them to navigate through the code to find specific assets to edit or copy.
* No-code Modding - for our very newbie students who are just getting into coding and game development, we wanted to provide an option for them to take an existing game and mod it, without having to parse through lots of code blocks which can be overwhelming.

In the Asset Editor view, you can:

* Create a new asset by clicking on the green plus (+) icon and selecting the type of asset you want to create.

![Create new asset buttons](/static/blog/arcade/update-jan-2021/create-new-asset.png)

* Edit an existing asset by clicking on the asset and selecting the Edit button.

![Edit the asset button](/static/blog/arcade/update-jan-2021/edit-asset.png)

* Duplicate an existing asset which will make a copy of the asset and put in your Assets view.

![Duplicate the asset button](/static/blog/arcade/update-jan-2021/duplicate-asset.png)

* Copy an existing asset to your clipboard which will actually copy the image, hold it in your computer’s memory, and then allow you to paste it into a blank image editor canvas.

![Copy the asset button](/static/blog/arcade/update-jan-2021/copy-asset.png)

* Delete an existing asset - note that this button is disabled if the asset is being used in your program.

![Delete the asset button](/static/blog/arcade/update-jan-2021/delete-asset.png)

As well as the "Assets" button at the top of the screen, you can also get into the Asset Editor view from any of the image editors. You’ll notice that there’s a new "My Assets" tab at the top of the image editor which allows you to select assets from your asset library.  And there’s also a field for you to name your assets.

![Image editor](/static/blog/arcade/update-jan-2021/image-editor.png)

There's one thing to note about the new Asset Editor feature for those who program in JavaScript and Python. Named assets are treated differently in code. The ascii representation is no longer embedded in the code, but rather part of the assets namespace and stored in a separate project file.

![Sprite data in JavaScript](/static/blog/arcade/update-jan-2021/javascript.png)

## Gallery in Tile Editor

Another frequently requested feature was to bring the Gallery view into the Tile Editor so when you are creating your own custom tiles, you can start with one of the existing tiles and just tweak it, rather than having to create your own tiles from scratch.

![Tile gallery](/static/blog/arcade/update-jan-2021/tile-gallery.gif)

## Support for GitHub Extensions in subfolders

For all of you extension authors out there, we’ve hopefully made your lives a bit easier!  Before, you could only author 1 extension or set of tutorials from an individual repo.  Now you can publish multiple extensions and tutorials all from one GitHub repo. This is handy if you want to publish a set of custom blocks and a set of related tutorials that go with it. You can see our documentation about writing [custom extensions](https://makecode.com/extensions/getting-started) and [tutorials](https://makecode.com/writing-docs/user-tutorials).

## New Tutorial Format

For those of you paying close attention, you may have noticed a new "Game Maker Guide" card appear on the Arcade Home page in December.

![Game maker guide](/static/blog/arcade/update-jan-2021/game-maker-guide.png)

We are experimenting with a new format for tutorials where there are a series of tutorial activities which build upon each other through progressive levels of difficulty. This helps provide a bit more guidance to students on a recommended progression path It also helps keep individual tutorials shorter.

![Skillmap](/static/blog/arcade/update-jan-2021/skills-map.png)

Right now we have 2 learning paths available in the Game Maker Guide – Design a Space Explorer game, and Learn to Make a Platformer. Students must complete a sequence of tutorials in order – once they complete a tutorial, the next tutorial in the series unlocks.

![Tutorial sequence](/static/blog/arcade/update-jan-2021/tutorial-sequence.png)

In addition to a progression path, we’re also experimenting with gamification elements. When a student completes a learning path, they receive confetti and a certificate.

![Confetti celebration](/static/blog/arcade/update-jan-2021/confetti.gif)

![Completion certificate](/static/blog/arcade/update-jan-2021/certificate.png)

This new tutorial format is still a work in progress and we’d love your feedback.

If you find any issues, or have suggestions, please log them on [GitHub](https://github.com/microsoft/pxt-arcade/issues).

If you have questions, or would like to participate in the MakeCode community, please join the [Forum](https://forum.makecode.com) or follow us on social [@MSMakeCode](https://twitter.com/MSMakeCode).

Happy Making and Coding!

<br/>
The MakeCode Team
