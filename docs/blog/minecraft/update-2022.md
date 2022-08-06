# MakeCode Minecraft 2022 Update

**Posted on August 9th, 2022 by [Jaqster](https://github.com/jaqster)**

Well, just in time for back-to-school, we have some nice MakeCode updates to share with everyone that will make your coding experience in **Minecraft: Education Edition** even better!

Here’s a run-down of the new features and improvements:

## New mobs, items and blocks

Always the number one request we get from students: _"More mobs! More mobs!"_ So in this update we’ve added:

* **7** new mobs including Axolotls, Goats and Piglins
* **52** new blocks including Copper, Chain and Blackstone
* **31** new items including Shield, Dyes and Netherite tools/armor

![New mobs to use](/static/blog/minecraft/update-2022/new-mobs.png)

Here’s a sample program you can use to spawn some of the new animals: https://makecode.com/_cusi42faHfUA.

Keep in mind that axolotls are very aggressive and will kill off your glow squid pretty quickly, and the goat will jump over the fence!

## Immersive Reader

Continuing to focus on accessibility for all students in MakeCode and Minecraft, we’ve added support for [Immersive Reader](https://azure.microsoft.com/en-us/services/immersive-reader) in tutorials. Immersive Reader is a Microsoft Azure AI service that helps students read and comprehend text by reading aloud, isolating content, highlighting parts of speech, and providing translation services.

![Immersive Reader example](/static/blog/minecraft/update-2022/immersive-reader.png)

## New Position Blocks

The 3-dimensional coordinate system in Minecraft is one of the more challenging aspects of coding in the game. We’ve provided two new position blocks that will hopefully make it easier to code exactly what you want, **where** you want it.

### Player direction

This new block allows you to specify coordinates to the right/left, above/below, and in front/behind the player.

![Player location block](/static/blog/minecraft/update-2022/player-direction.png)

![Player direction example](/static/blog/minecraft/update-2022/player-direction-example.png)

### Local coordinates

This block specifies the direction the player is looking (or the camera) and is helpful for placing things dynamically wherever the player is looking. For instance, this "Magic Chicken Wand" program will magically spawn chickens in the direction the player waves the sword: https://makecode.com/_WCz3igJVXPFR

![Camera location block](/static/blog/minecraft/update-2022/camera-direction.png)

To learn more about the different Position API’s in MakeCode for Minecraft, see https://minecraft.makecode.com/reference/positions.

## Block detection

For those of you who love the mining in Minecraft, you’ll appreciate these new block detection blocks which allow you to detect different types of blocks. For example, this is a program that acts as a "Diamond Detector" showing you the location of all the diamonds in the ground below you: https://makecode.com/_Vo1a96AWpKRe.

![Diamond Detector example](/static/blog/minecraft/update-2022/diamond-detector.png)

Use This program to list out all the different blocks 10 blocks below you: https://makecode.com/_Eoad0vckwcRi.

## Full Screen Tutorial Layout

We’ve optimized our tutorial layout for people who expand the Code Builder window to full screen. For folks using the half-screen view of Code Builder, there won’t be any changes - the tutorials will still appear at the top of the screen. But for people who expand to a full-screen view, you will see the tutorial pane now on the left side of the screen. This optimized view allows for more vertical space working with code.

### Tutorials in half-screen view

![Half size tutorial](/static/blog/minecraft/update-2022/tutorial-half.png)

### Tutorials in full-screen view

![Full size tutorial](/static/blog/minecraft/update-2022/tutorial-full.png)

## Arrays as parameters in Functions

And lastly we’ve added [Arrays](https://minecraft.makecode.com/types/array) as a parameter data type for **Functions**, so now you can create your own random spawn block or do bubble sorts on mobs!

![Functions with array parameters](/static/blog/minecraft/update-2022/functions-arrays.png)

See this program at: https://makecode.com/_05F2zv5TWDX7

We hope these updates are helpful, and we can’t wait to see what you all create and code next in Minecraft!

To read about all the other Minecraft: Education Edition updates, take a look at this blog post: https://aka.ms/mobileblog.

Happy Making and Coding!

<br/>
The MakeCode Team