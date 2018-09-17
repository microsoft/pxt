# MakeCode for the micro:bit update coming soon!

**Posted on July 23, 2018 by [Jaqster](https://github.com/jaqster)**

The MakeCode team has been working to provide a summer update to its micro:bit editor You can preview the update at https://makecode.microbit.org/beta.

This update is in Beta now and only includes incremental changes and improvements that are designed to not to be disruptive or break any of your existing programs. So, when we release this new version, we will continue to support the previous version for those of you who aren’t ready to move over just yet 😊.

We hope you try out the Beta and let us know what you think! If you find any bugs, please log them in GitHub: https://github.com/Microsoft/pxt-microbit/issues

Also, for comments, suggestions, and feedback, please participate in the micro:bit community on Slack: https://tech.microbit.org/get-involved/where-to-find/

## New features

Some of the new features included in this update are:

* **Home Page** – we’ve wanted to make the _getting-started_ experience more intuitive by creating a set of step-by-step tutorials and have more discoverable example projects. We moved all the content previously in the [Projects](https://makecode.microbit.org/projects) menu into this new home page experience as a gallery view.

![View of MakeCode Beta home page](/static/blog/microbit/v1-beta/homepage.jpg)

If you want to bypass the home page, you can get to the editor directly at https://makecode.microbit.org/beta#editor (notice the ``#editor`` at the end of the URL).

* **Block UI update** – you might notice that our blocks now look slightly different. To align with our other editors, we’ve upgraded from [Blockly](https://developers.google.com/blockly/) to the new [Scratch Blocks UI](https://scratch.mit.edu/developers) (which is actually a combination of Blockly and Scratch). There are some nice improvements with this new rendering, in particular:

>* Bigger blocks which make it easier for users of touchscreen devices to drag and drop with their finger. They use the block space more efficiently too.

>| | | |
|-|-|-|
| ![New blocks](/static/blog/microbit/v1-beta/new-blocks.png) | | ![Old blocks](/static/blog/microbit/v1-beta/old-blocks.png) |
| **New Blocks** | | **Old Blocks** |

>* Different shapes for different data types – specifically the boolean values `true` and `false` have a hexagon shape while the shapes for numbers and text are round.

>![Type shapes](/static/blog/microbit/v1-beta/type-shapes.png)

>* A better indication of where blocks fit together and a distinct "snap into place" action.

>![Blocks connecting](/static/blog/microbit/v1-beta/block-connection.png)

* **Cogwheel RIP** – we got out the shovels, said a few words, and then had a little party when the cogwheel died. You likely you used the cogwheel with your **If Then Else** blocks to add additional clauses. It was an awkward interface that most people didn’t know how to use. We’ve replaced this functionality with the more intuitive plus **(+)** or minus **(-)** icons on the blocks for adding or removing clauses.

![Cogwheel menu expansion](/static/blog/microbit/v1-beta/cogwheel.png)

![If then else - block](/static/blog/microbit/v1-beta/if-then-else-block.png)

* **Make a Variable** – based on feedback, we tried to make the process of creating variables much clearer. Now, you will explicitly click on the ``Make a Variable...`` button in the Toolbox to create a new variable with the name you want. The variable is then associated wtih the other blocks in the Variables drawer of the Toolbox.

![Make a variable](/static/blog/microbit/v1-beta/make-variable.gif)


* **Radio blocks** – we made slight changes to some of the **Radio** API’s to make them simpler. Most people won’t notice the changes, but if you are an advanced Radio user, you may see that we’ve rearranged the way radio packets are received – all the same functionality is there, but it's made more explicit through single-use blocks.
* **Floating point** – this is probably the biggest change we’ve made for this update. All you Math Teachers out there, prepare to rejoice... we now support floating-point arithmetic! This was a big request – as many of you know, we only had support for integers before. But now `3 / 2` really equals `1.5` (instead of just the simple integer of 1)!

![Floating point value on tnhe screen](/static/blog/microbit/v1-beta/floating-point.gif)

## Moving programs around

As a heads-up for everyone, the programs that you create in the new beta editor will NOT work in the current editor. However, the first time you visit the new editor, your existing projects from the previous editor are automatically copied to the new editor so you can continue working on them. If you go back to the previous editor after this migration, you will still find your old projects there, but if you modify them in the old editor, they're NOT automatically copied again to the new editor. In other words, the automatic migration is a one-time process that happens the first time you visit the new editor, after which your old projects and new projects are independent from one another.

![Code projects in "My Stuff"](/static/blog/microbit/v1-beta/my-stuff.png)

Happy Making and Coding!

-- The MakeCode Team
