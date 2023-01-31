# MakeCode Arcade 2023 Update

January 30, 2023

Welcome to 2023 – year of the rabbit!

To start off the year right, we’ve got some great updates to MakeCode Arcade that will make playing games even more fun with multiplayer and Kiosk mode!
And we also have lots of other goodies packed into this release, as well as addressing reported bug fixes.
Let’s hop into the updates!

## Multiplayer!!!

Yup.  Multiplayer is here.  Gaming is way more fun when you can play together, so we’ve been working over the past several months to enable people to play the MakeCode Arcade games they create together with their friends!  Some of you may have noticed that we enabled this as a beta experience in our two [Hour of Code Skillmaps](https://arcade.makecode.com/hour-of-code-2022) – Whack-the-Mole and Burstin’ Balloons last December.
We’ve gotten some great feedback since then, and have made some additional improvements – take a look:
https://youtu.be/PEBciUQDzEI (embed video)
You’ll find a collection of some fun multiplayer games you can try on the Home Page.

<MultiplayerHome.png>

We take student data privacy very seriously – users’ personal information (name, profile picture, email) are not shared with the host or other guests when playing a multiplayer game, and players may only communicate via emoji reactions.  More information on the multiplayer feature is documented [here](https://arcade.makecode.com/multiplayer).

## Kiosk

We’ve seen some of the amazing Arcade machines that people have been making – either on their own or as a collaboration with the woodworking class at their school.  To make the game play experience even better on an Arcade machine, we’ve released what we’re calling MakeCode Arcade Kiosk mode, which provides a nice interface for game play using a joystick and buttons.  Read more about how to use this feature [here](http://arcade.makecode.com/hardware/kiosk). 

<ArcadeMachines.png>

Play Song
More cowbell!!  We’ve gotten a lot of feedback that audio tracks and music in general is a super important part of any game (after all, what would Minecraft be without the soothing background music?)  And we’ve been itching to add a more detailed music editor that goes a little farther than our current 8-note Play Melody block.  So, here it is – our v1 music editor, the Play Song block.
 
<PlaySongBlock.png>

<MusicEditor.png>

Watch this short demonstration video for an overview:  
https://youtu.be/7d0noM0BM7E (embed video)
This feature is very new, so over the next several months, we hope to work with all of you to refine the interface.  We also need a gallery of songs, so if you’ve made any and are willing to share, please do!
Head over to the [Forum](https://forum.makecode.com/c/share-your-arcade-projects-here/show-tell/13) and share your songs with us!

## Color Palette

When we were working on the Wakanda Forever tutorial, we realized the need for more custom palette colors for our games – especially to represent the diversity of skin tones for human characters in games.  And we also wanted to just better help people express their creativity in general.  So, in the Asset Editor we’ve added the ability to select from a variety of different color palettes, or you can make your own!  Keep in mind that the color palette you use will apply to all art assets in your game, you are still limited to 15 colors, and the custom color palette you choose will only apply to that game/project.
 
<ColorPalette.gif>

## Code Validation

Being able to automatically validate the correctness of code in tutorials has been one of the top requested features from educators.  In this release, we’ve added some basic code validation capabilities that will check for certain blocks on the workspace.

<CodeValidation.gif>

For tutorial authors who would like to add code validation in their tutorials, please see the documentation on how to do this here <insert link to code validation documentation> 
To see code validation in action, check out these tutorials <link to tutorials>

## Game Over

With more multiplayer games on the horizon, we realized that it was high time to add a bit more control over how you can end a game.  The Game Over block has always been quite simple – you can either win or lose, and each case has pre-defined behavior – Win with “You Win!” message and power-up sound, or Lose with “Game Over!” message and wa-wa-wa sound.  The only thing you could configure was the effect:
 
<OldGameOver.png>

No longer!  With the new Game Over blocks, you can set not only custom effects, but also sounds, messages, and win/lose criteria (high/low score or none).

<GameOverBlocks.png>

## Game Jam

Not a new feature, but just a reminder that we run Game Jams every once in a while that are a ton of fun!  Game Jams are non-competitive, stress-free game creation challenges usually around a theme.  The last Game Jam we ran was a “Puzzle Game” theme and we had some amazing entries!  Check out the games [here](https://forum.makecode.com/t/announcement-makecode-arcade-mini-game-jam-7-puzzle-jam/17195/), and join the [Forum](https://forum.makecode.com) to be alerted for new Game Jams to participate in.  
 
<PuzzleGame.png>

## MakeCode Help Desk

So many times I run into a question or a blocker when I’m coding.  Luckily I have a room full of talented engineers around me, so I can just shout my question over my shoulder.  Now you can too!  We are starting a weekly Help Desk or office hours time on the MakeCode Forum.  Come by and ask the MakeCode engineers your burning questions!  And don’t be shy, there are no dumb questions when you’re learning!
https://forum.makecode.com/t/announcement-makecode-help-desk/17507 

As always, if you find any bugs, or have suggestions, please log them on GitHub (https://github.com/microsoft/pxt-arcade/issues).  
If you have questions, or would like to participate in the MakeCode community, please join the Forum (https://forum.makecode.com) or follow us on social @MSMakeCode (https://twitter.com/MSMakeCode).

Happy Making and Coding!

<br/>
The MakeCode Team
