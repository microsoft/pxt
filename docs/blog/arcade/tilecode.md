![checkers and video games](/static/blog/arcade/tilecode/meowbit.GIF)

# TileCode

## Design, Code, and Play Games on MakeCode Arcade Devices

**Posted on August 10, 2020 by Thomas Ball and Stefania Druga**
> "What an individual can learn, and how he learns it, depends on what models he has available.” - Seymour Papert, "Gears of my childhood".


[TileCode](https://microsoft.github.io/tilecode) is a novel game creation app that allows you to design, code, and play video games directly on low-cost [MakeCode Arcade gaming handhelds](https://arcade.makecode.com/hardware) as well as in the web browser using the MakeCode Arcade game simulator.

### From Board Games to Retro Video Games

We draw inspiration from board games with pieces that can move from one square of the board to a nearby square. Board games like checkers (also known as draughts) have been played for thousands of years of human history.  Board games are affordable, and their rules are generally simple to understand, but the game play can be very involving and rewarding. Over time, new games have been created by modifying the game rules of existing board games.

![board games](/static/blog/arcade/tilecode/boardGames.GIF)

In contrast, video games have been with us for just over half a century, yet constitute a multi-billion-dollar industry with billions of users.  Gaming devices are devices of consumption, while game production requires the use of separate computers, contributing to a digital divide. 

![TileCode screens](/static/blog/arcade/tilecode/handhels.GIF)

TileCode is aiming to bring back powerful computation ideas from old board games through the medium of video-games which is highly attractive for youth. It allows players to start with simple rules and make their own games and game worlds which can quickly evolve into more complex emergent combinations of logic. Users start with a low floor as they are able to simply play a game and change one rule or elements of the game world. Once familiar with the platform players are provided with wide walls for creating many different types of games or interactive stories. Ultimately the platform presents opportunities for high ceiling learning activities allowing users to implement more challenging games such as snake where the state of both sprites and tiles has to be accounted for.

![Design principles](/static/blog/arcade/tilecode/design_principles.png)


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
TileCode presents a unique opportunity for youth to develop their own pixel art for the tiles and sprites. It also engages users in new ways of thinking about game world design and the ways of creating different maps for different logic and levels of games or interactive stories. In future iterations of the platform we aim to provide users to share their art, games and tile worlds they create and encourage further opportunites for collaborative learning and play.
![Children creating pixel art](/static/blog/arcade/tilecode/tilecode_bloxels.jpg)



## Design with and for children
We are currently running a series of co-design workshops with families in order to better understand how children and parents make sense of video-games mechanics and what are the most intuitive strategies for them to go about creating their own video-games or to modify existing games. These workshops inform our future design of TileCode and its new features which build directly on childrens intuitive models of video-games logic.

![Children drawing a game timeline](/static/blog/arcade/tilecode/tilecode_kids_gamedesign.jpg)


## Learn More About TileCode

Visit the [TileCode Home Page](https://microsoft.github.io/tilecode) to learn more about TileCode, how to install the TileCode UF2 file on a MakeCode Arcade Device, and use the MakeCode Arcade simulator in the web browser.
