# Code First, Hardware Parts Chosen Automatically
```TODO insert headline picture```
Users use code to express the behavior they want in a system.
MakeCode chooses the appropriate hardware to implement that behavior.
This is backwards from how hardware projects often start: with a bin of parts.

## Example: Play a tune
```TODO insert gif of code first, then hardware appearing```
Behavior: Play a tune on button press.
MakeCode detects the hardware requirements: an audio player, a button input.
MakeCode automatically choses hardware, lays it out, wires it, and provides a simulation.

# Breadboard Simulator
```TODO Insert picture of simulator.```
Notice the button is clickable and audio comes out of the PC.
Most tutorials and kits out there have you wire everything together before you can experience the behavior.
MakeCode requires no knowledge of how breadboards work or how the individual components are wired.
Users can rapidly prototype many different behaviors with their corresponding hardware. A process that would be much more cumbersome if users had to manually assemble the hardware.
Users also don't need to own the parts to see it work.

There's a lot of detail and learning opportunities present in the simulator.
Hovering over the breadboard shows you how it's connected internally.
Hovering over wires shows how the component connects.
Users might notice "hey, the speaker and button don't require a connection to positive voltage, yet the servo, knob, and LEDs do?"
Users can make connections on their own. They experience hardware in a way that is usually only achievable by having the hardware in front of you.

This is useful for more than just beginners.
Debugging behavior is much quicker in a simulator.
The "inner loop" of development is rapidly sped up.

# Lego-like Assembly Instructions
```TODO Insert picture of instructions.```
The assembly instructions are available for every project.
They hand hold users, step by step, part by part, wire by wire.
Inspired by Lego and Ikea instructions.
Great for class room settings.
Teachers can rapidly develop and change their curriculum. 
No need to wait for v2 of some classroom kit, just change the code and print new instructions.

Like in every aspect of MakeCode, there are opportunities to learn here.
A completed project can look like a daunting mess of wires. 
```TODO Insert picture of messy project.```
The assembly instructions let you learn about a project a small bit at a time.

It's also guaranteed to be safe.
Some users might feel intimidated working with batteries.
It's not obvious what the rules are: what is allowed to connect to what? What can be damaged?
The assembly instructions will always take users on a safe route and will include printed warnings 
if there is something tricky or easy to make a mistake on.

# The Future Potential 
```TODO is there a non-committal way to write about this?```
There are so many more possible learning opportunities.
On-hover or other hints can be added to individual components, the breadboard, the logic board, pins, and more.
These learning hints could also be printed in the assembly instructions.

Parts purchasing can be made trivial. Once the user is happy with their project in the simulator, 
they could click a button to generate a shopping cart at Adafruit, Sparkfun, or others.

It's conceivable that MakeCode could automatically generate and order a custom PCB for your project.
Going even further, perhaps the entire project could be shipped to the user fully assembled with the software already loaded onto it.
This would democratize electronics in a whole new way.
