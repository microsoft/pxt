![checkers and video games](/static/blog/arcade/tilecode/meowbit.GIF)

# TileCode

## Design, Code, and Play Games on MakeCode Arcade Devices

**Posted on August 10, 2020 by Thomas Ball and Stefania Druga**

[TileCode](https://microsoft.github.io/tilecode) is a novel game creation app that allows you to design, code, and play video games directly on low-cost [MakeCode Arcade gaming handhelds](https://arcade.makecode.com/hardware) as well as in the web browser using the MakeCode Arcade game simulator.

### From Board Games to Retro Video Games

We draw inspiration from board games with pieces that can move from one square of the board to a nearby square. Board games like checkers (also known as draughts) have been played for thousands of years of human history.  Board games are affordable, and their rules are generally simple to understand, but the game play can be very involving and rewarding. Over time, new games have been created by modifying the game rules of existing board games. 

![board games](/static/blog/arcade/tilecode/boardGames.GIF)

In contrast, video games have been with us for just over half a century, yet constitute a multi-billion-dollar industry with billions of users.  Gaming devices are devices of consumption, while game production requires the use of separate computers, contributing to a digital divide. 

![TileCode screens](/static/blog/arcade/tilecode/handhels.GIF)

### TileCode Vision

With TileCode, we enable the process of game creation to take place on gaming handhelds themselves, rather than tablets/laptops/desktops, using just the **four-way direction pad** and the **A and B buttons** common to most handhelds,
as shown above. With TileCode, we’ve already created a variety of retro video games in TileCode, including Snake, Bejeweled, Pac-Man, Boulder Dash, and Sokoban.

We seek to reduce the gap between game mechanics and game programming so more people can participate in game creation. In particular, we seek to engage children in game programming and exploration of computing concepts through a game ontology that allows a range of games to be designed and coded via a simple and intuitive user interface and programming model.  

### TileCode: Design and Coding

As shown below, TileCode has eight game slots. For each game, TileCode allows users to select and edit sprites and tile backgrounds and to create a game level by editing a tile map:

![TileCode screens](/static/blog/arcade/tilecode/tileCodeScreens.GIF)

Each sprite is centered on a tile and each tile displays a background image. A sprite can move in one of four directions (left, right, up, down) to an adjacent tile. 

A TileCode program is a set of rules, each of which is associated with a sprite. A rule takes the form of a ``When-Do'' pair, as shown below.
The When section visually describes a pattern/predicate over the 3x3 local neighborhood around the central sprite (the player sprite, in this case) to be matched against the tile map:

![When-Do Rule](/static/blog/arcade/tilecode/helloMotionGrass.PNG)

You can read the above rule as: 
-	**when** the user presses the right-dpad button
-	**and** there is a player sprite on the tile map
-	**and** there is grass on the tile to the right of the player
-	**do** send the player sprite a move-right command

Today, many beginner game creation environments use block-based programming that emphasizes the **structured control-flow** constructs of modern programming languages. In contrast, TileCode uses **cellular automata** as its basic programming model, in which parallel pattern matching (against the tile map) is the main focus, extended to work with movable sprites, as well as fixed tiles. TileCode encourages the user to explore the relationship between the data on the tile map and how the rules fire based on the patterns present in the tile map. 

## Opportunities for Creativity and Personal Expression 

## Learn More About TileCode

Visit the [TileCode Home Page](https://microsoft.github.io/tilecode) to learn more about TileCode, how to install the TileCode UF2 file on a MakeCode Arcade Device, and use the MakeCode Arcade simulator in the web browser.