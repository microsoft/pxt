![meowbit and video games](/static/blog/arcade/tilecode/meowbit.GIF)

## TileCode: Design, Code, and Play Games on MakeCode Arcade Devices

**Posted on August 10, 2020 by Thomas Ball and Stefania Druga**

[TileCode](https://microsoft.github.io/tilecode) is a novel game creation app that allows you to design, code, and play video games directly on low-cost [MakeCode Arcade gaming handhelds](https://arcade.makecode.com/hardware) as well as in the web browser.

### From Board Games to Retro Video Games

We draw inspiration from board games with pieces that can move from one square of the board to a nearby square. Board games like checkers (also known as draughts) have been played for thousands of years of human history.  These games are affordable, and their rules are generally simple to understand, but the game play can be very involving and rewarding. Over time, new games have been created by modifying the game rules of existing board games.

![board games](/static/blog/arcade/tilecode/boardGames.GIF)

In contrast, video games have been with us for just over half a century, yet constitute a multi-billion-dollar industry with billions of users.  Gaming devices are devices of consumption, while game production requires the use of separate computers, contributing to a digital divide.

![TileCode screens](/static/blog/arcade/tilecode/handhels.GIF)

### TileCode Vision

TileCode aims to enable children to be creators of video games and not just consumers. TileCode leverages the concepts of board games (squares, pieces that move, and rules about legal moves) to introduce computational concepts through the medium of video games. 

Users start with a *low floor* as they are able to simply play a game and change one rule or elements of the game world. Once familiar with the application, players are provided with *wide walls* for creating different types of games. Ultimately, TileCode presents opportunities for *high ceiling* learning activities allowing users to implement more challenging games.

TileCode enables the process of game creation to take place on gaming handhelds themselves, rather than tablets/laptops/desktops, using just the **four-way direction pad** and the **A and B buttons** common to most handhelds,
as shown above. With TileCode, we’ve already created a variety of retro video games, including Snake, Bejeweled, Pac-Man, Boulder Dash, and Sokoban.

### TileCode: Design and Coding

As shown on the TileCode home screen (below-left), there are eight game slots available to program (on device, game assets are stored in non-volatile flash; in the browser, game assets are stored in browser local storage). For each game, TileCode allows users to select and edit game characters (sprites) and game background (tiles) and to create a game level by editing the game map:

![TileCode screens](/static/blog/arcade/tilecode/tileCodeScreens.GIF)

Each sprite is centered on a tile and each tile displays a background image. A sprite can move in one of four directions (left, right, up, down) to an nearby tile.

A TileCode program is a set of rules, each of which is associated with a sprite. A rule takes the form of a ``When-Do'' pair, as shown below on the left in the rule editor screen. The **When** section visually describes a pattern/predicate over the 3x3 local neighborhood around the central sprite (the player sprite, in this case) to be matched against the tile map.  The **Do** section contains commands that are sent to the identified sprite when the pattern matches.

![When-Do Rule](/static/blog/arcade/tilecode/editPlayMap.GIF)

You can read the above rule as:
- **when** the user presses the right-dpad button
- **and** there is a player sprite on the tile map
- **and** there is grass on the tile to the right of the player
- **do** send the player sprite a move-right command

TileCode encourages the user to explore the relationship between the data on the map and how the rules fire based on the patterns present in this map. From the TileCode rule editor (shown above), the user can play the game, return to the rule editor to change the rule and see its effect on game play. She can also visit the tile map (the initial program input) editor and make changes that would enable or disable the firing of a rule. (Many beginner game creation environments use block-based programming that emphasizes the **structured control-flow** constructs of modern programming languages. In contrast, TileCode uses **cellular automata** as its basic programming model, in which parallel pattern matching (against the tile map) is the main focus, extended to work with movable sprites, as well as fixed tiles.)

### Opportunities for Creativity and Personal Expression

> "What an individual can learn, and how he learns it, depends on what models he has available.” - Seymour Papert, "Gears of my childhood".

TileCode presents a unique opportunity for youth to develop their own pixel art for tile backgrounds and sprites. It also engages users in new ways of thinking about game world design and the ways of creating different maps for different logic and levels of games. We draw inspiration from teachers who have students use basic classroom materials to express and refine their game designs before they get in front of a computer:

![Children drawing a game timeline](/static/blog/arcade/tilecode/tilecode_kids_gamedesign.jpg) 

Photo source: https://globalnews.ca/news/2901130/vancouver-video-game-creators-teaching-kids-to-be-critical-thinkers/

We are currently running a series of co-design workshops with families in order to better understand how children and parents make sense of video game mechanics and what are the most intuitive strategies for them to go about creating their own video games or to modify existing games. 

These workshops will inform our future design of TileCode and its new features which build directly on childrens intuitive models of video game mechanics. In future version of the TileCode app, we also aim to provide users to share their art, games and tile worlds they create and encourage further opportunites for collaborative learning and play.

## Powerful Computational Ideas on Low-powered Gaming Handhelds

TileCode demonstrates that battery-powered gaming handhelds need not confine their users in a "cage of consumption".  Motivated by the rich and long history of board games and their evolution by players themselves, TileCode points the way to a future of video game devices that invites players to become producers on the very same devices they use to play. We encourage you to explore [TileCode](https://microsoft.github.io/tilecode) today!
