# Maker: A MakeCode editor for breadboarding

Many devices supported by MakeCode, 
such as the [micro:bit](https://makecode.microbit.org/) and 
the [Adafruit Circuit Playground Express](https://makecode.adafruit.com/),
have a set of built-in sensors and outputs. But
Arduino-style boards require wiring of sensors and actuators
to the board's header pins. The user selects a set
of parts, wires them up to the board and then codes the system they have made. 

## ~ hint

**Beta zone** The maker is still in beta and evolving, join the fun!

## ~

## Code first

In [MakeCode for makers](https://maker.makecode.com/), we turn this paradigm on its head: MakeCode's simulator
selects basic parts and generates wiring for them from the user's program.
That is, the user expresses the behavior that they want
with code, and MakeCode uses that code to configure the simulator, as well as to
generate the make instructions that can be printed out. 
This experience is great for beginners to the Arduino style of making. 

Most tutorials and kits out there have you wire everything together 
before you can experience the behavior. MakeCode requires no knowledge of how 
breadboards work or how the individual components are wired.
Users can rapidly prototype many different behaviors and the hardware follows along. 
A process that would be much more cumbersome 
if users had to manually assemble the hardware.
Users also don't need to own the parts to see it work.

## Example: Play a tune

![button-and-speaker](/static/blog/maker/maker-2.gif)

Above is a simple example: the user creates a two-block program to play a tune when a button is pressed. 
MakeCode detects the hardware requirements from the two blocks: an audio player and a button are needed. 
MakeCode then automatically chooses hardware, lays it out, wires it, and provides a simulation.
The button can be clicked with a mouse to play the tune in the browser.

# Breadboard Simulator

![buttons-and-servo](/static/blog/maker/maker-servo.gif)

The simulator provides an interactive experience:
the buttons are clickable, servos are animated, and audio comes out of the web app.
There's a lot of detail and learning opportunities available in the simulator.

![hovering-over-breadboard](/static/blog/maker/breadboard-hover.gif)

Hovering over the breadboard shows you how it's connected internally, while
hovering over wires shows how the component connects.

![hovering-over-wires](/static/blog/maker/maker-wire-hover.gif)

Users might notice that the speaker and button don't require a connection to positive voltage, while the servo, knob, and LEDs do. 
MakeCode isn't explicitly teaching this (today), but users can make connections on their own.
They experience hardware in a way that is usually only achievable by having the 
hardware in front of you.

The breadboard simulator is useful to more people than just beginners:
debugging program behavior is much quicker in a simulator, so
the "inner loop" of development is rapidly sped up.

# Assembly Instructions
![assembly-instructions](/static/blog/maker/maker-instructions.gif)

For every project, MakeCode can generate a PDF file with step-by-step instructions that 
correspond to the parts and wiring shown in the breadboard
simulator. 
This tailored file lists the set of parts required, guides
the user step-by-step and part-by-part to build the final system. 

This on-demand instruction generation is great for use in the education
and can support teachers in rapidly developing and modifying projects
for the classroom. There's no need to wait for the next version of a kit -
you can just change the code and print new instructions.

As in every aspect of MakeCode, there are opportunities to learn here.
A completed project can look like a daunting mess of wires.
The assembly instructions let you learn about a project one step at a time.
Some users might feel intimidated working with batteries.
It's not obvious what the rules are: what is allowed to connect to what? What can be damaged?
The assembly instructions take users on a safe route and include printed warnings 
if there is something tricky or easy to make a mistake on.

# Help needed!

We welcome pull requests! Go to https://github.com/Microsoft/pxt-maker to add your board or learn more about the project.
