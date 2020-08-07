![checkers and video games](/static/blog/arcade/tilecode/meowbit.GIF)

# TileCode: Design, Code and Play Games on MakeCode Arcade Devices

**Posted on August 10, 2020 by Thomas Ball and Stefania Druga**

[TileCode](https://microsoft.github.io/tilecode) is a game creation app that allows you to design, code, and play video games directly on low-cost [MakeCode Arcade gaming handhelds](https://arcade.makecode.com/hardware). TileCode video games draw inspiration from board games with pieces that can move from one square of the board to a nearby square.

### From Board Games to Video Games

Board games like checkers (also known as draughts) have been played for thousands of years of human history.  Board games are affordable, and their rules are generally simple to understand, but the game play can be very involving and rewarding. Finally, variants of existing games are created by modifying game rules. 

![checkers and video games](/static/blog/arcade/tilecode/checkersVideoGames.GIF)

In contrast, video games have been with us for just over half a century, yet constitute a multi-billion-dollar industry with billions of users.  Gaming devices are devices of consumption, while game production requires the use of separate computers, contributing to a digital divide. 

With TileCode, we enable the process of game creation to take place on low-cost gaming handhelds themselves, rather than tablets/laptops/desktops, using just the four-way direction pad and the A and B buttons common to most handhelds.   As shown in the banner picture, we’ve already created a variety of retro video games in TileCode.

We seek to reduce the gap between game mechanics and game programming so more people can participate in game creation. In particular, we seek to engage children in game programming and exploration of computing concepts through a game ontology that allows a range of games to be created via a simple and intuitive user interface and programming model.  

TileCode allows users to select and edit sprites and tile backgrounds and to create a game level by editing a tile map. Each sprite is centered on a tile and each tile displays a background image. A sprite can move in one of four directions (left, right, up, down) to an adjacent tile. 

![TileCode screens](/static/blog/arcade/tilecode/tileCodeScreens.GIF)

### TileCode Programming

A TileCode program is a set of rules, each of which is associated with a sprite. A rule takes the form of a ``When-Do'' pair, as shown below.
The When section visually describes a pattern/predicate over the 3x3 local neighborhood around the central sprite (the player sprite, in this case) to be matched against the tile map. 

![When-Do Rule](/static/blog/arcade/tilecode/helloMotionGrass.PNG)

You can read the above rule as: 
-	**when** the user presses the right-dpad button
-	**and** there is a player sprite on the tile map
-	**and** there is grass on the tile to the right of the player
-	**do** send the player sprite a move-right command

Concepts: Data is as important as Code; Cellular automata; From simple rules, complex behavior; Pattern matching (input sensitivity); Parallelism (reality, new reality)

## Opportunities for Creativity and Personal Expression 

## Learn More About TileCode

Click on the two images below to watch a 30 second video (left) and a 5 minute video (right) about TileCode:
  
[![short video](/static/blog/arcade/tilecode/youtube1.PNG)](https://www.youtube.com/watch?v=3FNAsZw13Ro){:target="_blank"} [![long video](/static/blog/arcade/tilecode/youtube2.PNG)](https://www.youtube.com/watch?v=ZUZNi3dbtLI){:target="_blank"} 
