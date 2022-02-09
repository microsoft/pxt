# MakeCode Arcade Valentine’s Update

**Posted on February 9th, 2022 by [Jaqster](https://github.com/jaqster)**

Love is in the air! But instead of a box of chocolates, we’ve got something better for you... updates for MakeCode Arcade and a Valentine’s Day tutorial! 💖

Here’s a run-down of the updates:

## Workspace Search

If you have a large program, it can be time consuming scrolling around, looking for that function or variable on your workspace. We’ve added the ability to search for blocks on your workspace by pressing **Ctrl + f** or right-clicking to open the context menu and selecting **Find**.

![Workspace search](/static/blog/arcade/valentine-update-2022/workspace-search.gif)

While we’re talking about navigating the workspace, just a reminder of a cool feature we shipped a while ago that allows you to navigate to your function definitions. This is useful in large programs with lots of function calls – simply right-click on your function call and select "Go To Definition" to navigate to the associated function definition.

![Go To Definition](/static/blog/arcade/valentine-update-2022/go-to-definition.gif)

## Skillmap Accessibility Improvements

We’re continually working to make MakeCode more accessible to anyone who wants to learn to code. We’ve added keyboard navigation and high contrast modes to the Skillmap for low or vision-impaired users.

![Skillmap Accessibility](/static/blog/arcade/valentine-update-2022/skillmap-accessibility.gif)

## Image Editor Scaling

A much requested feature! Now it’s possible to scale the size of your image. Simply use the **Marquee** tool to select your image and drag the corners to resize.

![Image scaling](/static/blog/arcade/valentine-update-2022/image-scale.gif)

## Programmatic Scaling

Resizing is a theme with this release! We’ve also added some new blocks in the **Sprite** category that will let you programmatically resize or scale your sprites.

![Scale blocks in Toolbox](/static/blog/arcade/valentine-update-2022/scale-blocks.png)

For more information on how to use these blocks, see the reference documentation:

https://arcade.makecode.com/reference/sprites/sprite/change-scale and<br/>
https://arcade.makecode.com/reference/sprites/sprite/set-scale

There’s also an extension available for more advanced scaling operations.

![Sprite scaling extension](/static/blog/arcade/valentine-update-2022/scaling-extension.png)

## Valentine’s Day Tutorial

If you would like to practice using these new scaling blocks, try this fun [Valentine’s Day Tutorial](https://aka.ms/valentine) where your grey heart tries to capture red hearts to grow its size, and avoid the arrows which will shrink it down.

**[aka.ms/valentine](https://aka.ms/valentine)**

![Valentine tutorial](/static/blog/arcade/valentine-update-2022/valentine-tutorial.gif)

## New Destroy Sprite block

Also something that many folks have been asking for – this block allows you to destroy all sprites of a certain kind in your game. Before, you had to use a loop with the array of sprites of kind block – this makes it much easier!

![Destroy all sprites of kind block](/static/blog/arcade/valentine-update-2022/destroy-all-sprites-kind.png)

## New Tilemap blocks

We’ve made some changes to the organization and the order of blocks in the **Scene** category that will hopefully make it easier to find things. And we’ve also made some small changes to the Tilemap API and added some useful new blocks

We created a separate tilemap block to make it easier to use multiple different tilemaps in a game.

![Old tilemap blocks to new](/static/blog/arcade/valentine-update-2022/old-new-tilemap.png)

We also added a few new tilemap blocks under the **Locations** sub-category:

**Tilemap Location of Sprite** – returns the location on a tilemap where a specified sprite is.

![Tilemap location of sprite block](/static/blog/arcade/valentine-update-2022/tilemap-location-sprite.png)

**Location property** – returns different properties of a tilemap location. For example, this can be helpful for translating tilemap columns/rows to screen coordinates (x/y).

![Tilemap location, column property block](/static/blog/arcade/valentine-update-2022/tilemap-location-column.png)

![Tilemap location example](/static/blog/arcade/valentine-update-2022/tilemap-location-example.png)

**Tile at Location is wall** – this returns a Boolean (true/false) value if the tile at the specified location is a wall.

![Tile at location is wall block](/static/blog/arcade/valentine-update-2022/tile-at-location-is-wall.png)

**Tilemap Location left/right/top/bottom of Location** – this returns the tilemap location that is adjacent to another location.

![Tilemap location on the left block](/static/blog/arcade/valentine-update-2022/tilemap-location-left.png)

**Tile Image at Location** – this returns the image of a tile at a specified location.

![Tilemap image at location block](/static/blog/arcade/valentine-update-2022/tile-image-at-location.png)

## Image Editor improvements

We’ve also made a few minor improvements to the image editors for improved usability.

* In the Tilemap Editor, clicking on the **Wall** tool button will allow you to select and deselect.

>![Tilemap editor wall tool](/static/blog/arcade/valentine-update-2022/wall-tool.gif)

* For advanced users, there are some handy keyboard shortcuts you can use to do some cool things like:
>* Replace color/tile: **shift + r**
>* Outline image (image editor only): **shift + 1-9** or **shift + a-f** (e.g., **shift + 3** outlines with color number **3** in the palette)

>More documentation on keyboard shortcuts is posted here https://makecode.com/asset-editor-shortcuts

## Skillmap Reset Code

Based on user feedback, we changed the way you can reset code between Skillmap tutorials. For any tutorials that build upon previous ones, we’ve added a "Replace my code" option in the first step that will allow students to reset the code in the workspace. Note that this will delete any existing code, so use sparingly – only when students want a fresh start with template code.

![Skillmap replace my code option](/static/blog/arcade/valentine-update-2022/replace-my-code.png)

As always, if you find any issues, or have suggestions for improvements, please log them on [GitHub](https://github.com/microsoft/pxt-arcade/issues).

If you have questions, feedback, or would like to participate in the MakeCode community, please join the [Forum](https://forum.makecode.com) or follow us on social [@MSMakeCode](https://twitter.com/MSMakeCode).

## Made with ❤️ in Microsoft MakeCode Arcade.

<br/>
-- The MakeCode Team
