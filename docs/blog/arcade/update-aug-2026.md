# MakeCode Arcade August 2026 Update

**Posted on August 31st, 2026 by [Jaqster](https://github.com/jaqster)**

Two updates in one year?!  Well, what was supposed to be a simple default theme change turned into a "might as well cherry-pick this, and this..." and here we are at a full version update!

We’ve got some nice things on the menu for this late summer release –

## Default Theme change

Goodbye Orange! The new default theme meets all web accessibility color contrast guidelines and matches the Game window a bit more.  However, if you really want to keep the Orange theme, you can always select it from the Settings menu and if you are signed it, we will preserve that as your default theme.

![Settings menu](/static/blog/arcade/update-aug-2026/settings.png)

![Theme picker](/static/blog/arcade/update-feb-2026/theme.png)

## Song Gallery

We’ve been wanting to populate our Song editor with a gallery of pre-existing songs that people could use to edit and include in their games.  But we’ve never had the time or talent to do it ourselves.  Finally, thanks to the musical genius of [Ricardo Pujol](https://www.ricardopujol.pro) we now have some super cool retro game music that you can sample in your projects!

![Song gallery](/static/blog/arcade/update-aug-2026/play-song-gallery.png)

## Accessible Blocks

We just couldn’t wait until next year to get this in! Following the [MakeCode for micro:bit release](https://makecode.com/blog/microbit/2026-release), we’ve also updated MakeCode Arcade with the latest Blockly library supporting both keyboard controls and screen readers.

Keyboard controls are now on by default, so now you can switch seamlessly between the mouse and the keyboard to select, move and place blocks on the workspace.  The keyboard shortcut menu can be accessed using Ctrl + / on Windows or ⌘ + / on Mac.

![Keyboard controls window](/static/blog/arcade/update-aug-2026/keyboard-controls.png)

All the most common screen readers, including NVDA, JAWS, Windows Narrator, Mac Voice Over, and ChromeVox are also supported for block-based programming.  Simply turn on your preferred screen reader and navigate around the MakeCode user interface to hear descriptions and actions you can take. 

Please note that this is still a work-in-progress, and not all MakeCode Arcade field editors are fully supported yet.  We’re getting there...!

## Home Page

We’ve added a Search option to the Arcade Home Page which will hopefully make finding relevant content much quicker and easier.

![Homepage search](/static/blog/arcade/update-aug-2026/search.png)

We’ve also cleaned up the My Projects view to include additional project metadata including project icons, tutorial progress, and cloud sync status.

![MyProjects view](/static/blog/arcade/update-aug-2026/my-projects.png)

## Extensions Gallery

For those of you using extensions in your projects, we’ve made the Extension Gallery a bit easier to use by adding a label for currently installed extensions (we just removed them before) and allowing you to manage installed extensions (update, delete).

![Extensions gallery](/static/blog/arcade/update-aug-2026/extensions-gallery.png)

## Piano Roll (Beta)

We have a new music editor that is currently in beta. It’s brand-new, and we’d love your help to test it out and give us feedback. Install the Piano Roll extension in a project by typing in "microsoft/arcade-piano-roll" in the Extensions gallery search bar, create a song with it and let us know what you think!

![Piano roll](/static/blog/arcade/update-aug-2026/piano-roll.png)

## 3-in-a-row Skillmap

We’ve got a fun new Skillmap available that uses the [Tile Scanner](https://arcade.makecode.com/pkg/riknoll/arcade-tile-scanner) extension. This extension makes it much easier to create jackpot or puzzle type games. The 3-in-a-row Skillmap consists of 3 tutorials that build on each other to help you create a basic Bejeweled style game. Try it out [here](https://arcade.makecode.com/--skillmap#3-in-a-row)!

![3-in-a-row skillmap roll](/static/blog/arcade/update-aug-2026/3-in-a-row.png)

## Tomato Cube hardware

We have a new hardware partner! [Tomato Cube](https://tomatocube.com) has released two new MakeCode Arcade compatible devices.

Their [MakeCode Arcade Console](https://tomatocube.com/product/makecode-arcade-console-v2) uses a Raspberry Pi RP2040 processor – the first of its kind!  This means that it should be able to handle your most resource intensive games. It also has a nice joystick. The only thing to note with the RP2040 is that the download process is a bit different – you have to press down on the joystick to put the device in bootloader mode first before downloading your games.

![Tomato Cube Arcade Console](/static/blog/arcade/update-aug-2026/tomato-cube-arcade-console.png)

The Tomato Cube [micro:bit Display Shield](https://tomatocube.com/product/makecode-arcade-display-shield-for-microbit) has an innovative design with a built-in micro-USB connector for the micro:bit. This makes it nice to have just 1 cable for downloading and charging the device, and good if you don’t plan on swapping out micro:bits all the time.

![Tomato Cube Display Shield Console](/static/blog/arcade/update-aug-2026/tomato-cube-display-shield.png)

## Bug Fixes 

As with any release, we’ve also fixed a ton of bugs!  Thanks to everyone who took the time to file an issue in GitHub.  And special thanks to folks who have submitted PR’s to fix bugs!  Like [@KohanMathers](https://github.com/KohanMathers) 🏆 who fixed the duplicate asset [issue](https://github.com/microsoft/pxt-arcade/issues/7589).

Any new bugs you find in this release, please log them in GitHub: https://github.com/Microsoft/pxt-arcade/issues

Any other questions, comments, suggestions, and feedback – please join the discussion at the [MakeCode Forum](https://forum.makecode.com).


Happy Making and Coding!

<br/>
The MakeCode Team
