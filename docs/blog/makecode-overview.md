![Picture of guitar project](/static/blog/makecode-overview/guitar.jpg)

# Introducing Microsoft MakeCode

**Posted on March 30, 2017 by [tballmsft](https://github.com/tballmsft)**

[Microsoft MakeCode](http://www.makecode.com) is a web-based environment for learning to code with physical computing devices such as the [micro:bit](http://www.microbit.org). It has a handful of novel features all packed into a single web application (web app). No software installation is required: Microsoft MakeCode runs in any modern web browser on most any operating system. Once the web app has been loaded from the Internet, all its features will continue to work, even if you disconnect from the Internet. If you later return to the web app when your computer is offline, it still works!

So, what about those five features? Microsoft MakeCode provides:
1.	A Block editor and a JavaScript editor to create programs, with the ability to convert back and forth between visual and text-based program representations;
2.	A web-based simulation of the physical device (micro:bit, for example), so students can edit and test their programs even if they don’t have a device (or left it at home);
3.	A self-guided “Getting Started” experience to introduce the basic features of the programming environment, and a set of projects for making and coding;
4.	A compiler that instantaneously creates an executable file to download/copy to the physical device;
5.	A sharing feature so students can share their programs with students, teachers and parents.

Microsoft MakeCode also adapts to the screen size of your computer – it works well on desktops, laptops, tablets, and even smartphones.

Below is an annotated screen snapshot of Microsoft MakeCode for the micro:bit, which you can find at http://www.makecode.com.  The menu bar (A) at the top of screen has several features, the most prominent being the central button that allows you to switch between Blocks and JavaScript editors.  

![MakeCode screen snapshot](/static/blog/makecode-overview/annotatedMakeCode.jpg)

Under the menu bar are three main sections. On the left side is the micro:bit simulator (B). The simulator runs automatically after you have made a change to your program. Buttons under the simulator allow you to stop/start program execution and control other aspects of the simulator. To the right of simulator is the toolbox (C) where you can find different categories of programming blocks.  The Basic, Input, Music, Led, and Radio categories provide access to the specific features of the micro:bit. The Loops, Logic, Variables, and Math categories provide access to general programming constructs.   Under the Advanced category are more features of the micro:bit, including Pins and Serial.

To the right of the toolbox is the programming canvas/editor (D) where you construct/edit your program.  The orange “Getting Started” tab on the upper right of the programming canvas will introduce you to the basics of creating a small script using the Blocks editor. At the bottom of the screen (E) is a toolbar which most prominently features a Download button, which you use to compile a program to a file for copying to the micro:bit. Other features of the toolbar include undo/redo and zoom-in/zoom-out buttons for the editor.

The Block editor provides the ability to construct a program by dragging and arranging colorful blocks on the programming canvas, a paradigm well-known by teachers and students from their experience with Scratch, which pioneered the concept. The Block editor makes it easy to get started and experiment with coding through direct manipulation of the blocks, free of the typos and syntax errors that can occur in text-based editors.   Below is a program in the Block editor that shows a smiley face when button A is pressed and shows a sad face when button B is pressed. 

![MakeCode Block editor](/static/blog/makecode-overview/blockEditor.jpg)

The JavaScript editor helps the student transition from visual blocks to text and to learn features of modern programming languages.  The toolbox categories remain the same, with additional functions and features available. Here is the JavaScript version of the program:

![MakeCode JavaScript editor](/static/blog/makecode-overview/javascriptEditor.jpg)

The color coding of the keywords in the JavaScript editor matches the colors of the block categories. 

In addition, the JavaScript editor provides code discovery facilities for the various programming categories, as found in modern programming environments, as shown below.  Here, the user has typed “basic.” – the editor responds with a list of all functions available in the basic namespace. 

![Intellisense feature](/static/blog/makecode-overview/intellisenseEditor.jpg)

Some of the projects you can create with Microsoft MakeCode include a milk carton robot (https://makecode.microbit.org/projects/milk-carton-robot) whose jaws move in response to light stimulus (see below), or an electric guitar (https://makecode.microbit.org/projects/guitar) that makes sounds in response to motion (see banner image of this blog entry).

![Milk carton robot](/static/blog/makecode-overview/milkcartonRobot.jpg)

We hope you find Microsoft MakeCode an exciting and engaging way to get started making and coding with physical computing devices. 