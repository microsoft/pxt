![tilecode banner](/static/blog/arcade/tilecode/banner.JPG)

## Microsoft TileCode: Design, Code, and Play Games on MakeCode Arcade Devices

**Posted on August 20, 2020, by [Thomas Ball](https://www.microsoft.com/en-us/research/people/tball) and [Stefania Druga](http://cognimates.me/team/)**

[Microsoft TileCode](https://microsoft.github.io/tilecode) is a game creation app that allows you to design, code, and play video games directly on low-cost [Microsoft MakeCode Arcade gaming handhelds](https://arcade.makecode.com/hardware), as well as in the web browser.

### From Board Games to Retro Video Games

We draw inspiration from board games with pieces that can move from one square of the board to a nearby square. Board games like checkers, also known as draughts, have been played for thousands of years.  These games are affordable, and their rules are generally simple to understand, but the game play can be very engaging and rewarding. Over time, new games have been created by modifying the rules of existing board games.

![board games](/static/blog/arcade/tilecode/boardGames.JPG)

In contrast, video games have been with us for just over a half-century, yet they constitute a multi-billion dollar industry with billions of users. Handheld gaming devices, such as those shown below, as well as game consoles are primarily consumer devices. Creating games for these devices generally requires the use of a different computer, which contributes to a digital divide that needlessly separates producers and consumers.

![TileCode screens](/static/blog/arcade/tilecode/handhelds.JPG)

### TileCode Vision

TileCode enables the process of game creation to take place on gaming handhelds themselves, instead of tablets/laptops/desktops, using just the **four-way direction pad** and the **A and B buttons** common to most handhelds, as shown above. With TileCode, we’ve already created a variety of retro video games (see examples in the banner).

TileCode aims to enable everyone to become creators of video games. TileCode leverages the concepts of board games (a board is a grid of squares, board pieces move from square to square, and game rules define the permitted moves) to introduce computational concepts through the medium of video games. Users start with a *low floor* as they are able to simply play a game and change one rule or elements of the game world. Once familiar with the application, players are provided with *wide walls* for creating different types of games. Ultimately, TileCode presents opportunities for *high ceiling* learning activities that challenge users to implement more complex games.

### TileCode: Design and Coding

As shown on the TileCode home screen (below-left), there are eight game slots available to program. 
On an Arcade device, game assets are stored in the device's persistent flash memory; in the browser, game assets are stored in browser-local storage. For each game, TileCode allows users to select game characters (sprites) and game background (tiles) from a gallery, modify the sprites and tile  backgrounds, and create a game level by editing the game map, as shown in the three other screens:

![TileCode screens](/static/blog/arcade/tilecode/screens.JPG)

A TileCode program is a set of rules, each of which is associated with a sprite. A rule takes the form of a **When-Do** pair, as shown below on the left (screen labeled "code"). The **When** section visually describes a pattern/predicate over the 3x3 local neighborhood around the central sprite (the player sprite, in this case) to be matched against the tile map.  The **Do** section contains commands that are sent to the identified sprite when the pattern matches.

![When-Do Rule](/static/blog/arcade/tilecode/editPlayMap.JPG)

The above rule fires when the user presses the right-dpad button, a player sprite is on the tile map, and there is grass on the tile to the right of the player. When these conditions hold, the rule sends the player sprite a move-right command. From this example we see how TileCode encourages the user to explore the relationships between the tile map and how the rules fire based on the patterns present on the map. In the rule coding screen (shown above), the user can play the game, return to the coding screen to change the rule, and see its effect on game play. She can also visit the tile map editor and make changes to the map to enable/disable the firing of a rule. 

### Opportunities for Creativity and Personal Expression

> "What an individual can learn, and how he learns it, depends on what models he has available.” - Seymour Papert, *Gears of my childhood*.

TileCode presents a unique opportunity for youth to develop their own pixel art for tiles and sprites. It also engages users in new ways of thinking about game world design and the ways of creating different maps for different games. We draw inspiration from teachers who have students use basic classroom materials to express and refine their game designs before they get in front of a computer:

![Students drawing a game timeline](/static/blog/arcade/tilecode/tilecode_kids_gamedesign.jpg)

*Photo source (left): https://globalnews.ca/news/2901130/vancouver-video-game-creators-teaching-kids-to-be-critical-thinkers/
Photo source (right): https://paper-station.com/2018/07/09/faber-castell-creations/*

We are currently running a series of co-design workshops with families in order to better understand how students and parents make sense of video game mechanics and what are the most intuitive strategies for them to go about creating their own video games or to modify existing games. These workshops will inform our future design of TileCode and its new features which build directly on students' intuitive models of video game mechanics.

## Powerful Computational Ideas on Low-powered Gaming Handhelds

Microsoft TileCode demonstrates that battery-powered gaming handhelds need not confine their users in a "cage of consumption".  Motivated by the rich and long history of board games and their evolution by players themselves, TileCode points the way to a future of video game devices that invites players to become creators on the very same devices they use to play. We believe children can be introduced to powerful computing ideas via affordable gaming handhelds and this type of access can help address the digital divide. This new form factor for a coding/gaming device provides youth with a personal experience where they can modify and create games anytime/anywhere.

 We encourage you to explore [Microsoft TileCode](https://microsoft.github.io/tilecode) today and welcome any feedback to [tilecode@microsoft.com](mailto:tilecode@microsoft.com)!

## Read More About It!

You can read more about TileCode in an upcoming UIST 2020 paper [TileCode: Creation of Video Games on Gaming Handhelds](https://www.microsoft.com/en-us/research/publication/tilecode-creation-of-video-games-on-gaming-handhelds/).
