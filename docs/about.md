# About

**Microsoft MakeCode** is a framework for creating domain-specific 
programming experiences for beginners.

Microsoft MakeCode is based on the open source project [Microsoft Programming Experience Toolkit (PXT)](https://github.com/Microsoft/pxt):
- ``Microsoft MakeCode`` is the name in the user-facing editors
- ``PXT`` is used in all the GitHub sources.

MakeCode's underlying programming language 
is a subset of [TypeScript](http://typescriptlang.org)
called [Static TypeScript](/language), which omitts JavaScript dynamic features.

The main features of [MakeCode](/docs) are:

* a [Google Blockly](https://developers.google.com/blockly/)-based code editor along with converter to [Static TypeScript](/language)
* a [Monaco](https://github.com/Microsoft/monaco-editor)-based text editor with enhanced, robust auto-completion and auto-correction
* support to [define blocks](/defining-blocks) via annotated TypeScript or C++; try the [MakeCode Playground](/playground) to experiment with this feature
* markdown-based [documentation](/writing-docs) system with built-in macros to render block snippets
* a [command line interface](/cli)

MakeCode is a joint effort between Microsoft Research and Visual Studio.

## MakeCode for micro:bit

The BBC micro:bit is a small wearable and programmable mbed-based device that visibly features a 5x5 LED display, accelerometer, 
compass, buttons, I/O pins, Micro USB plug, Bluetooth Low Energy antenna, ARM Cortex-M0 processor, and battery plug.

* [Try the micro:bit editor](https://makecode.microbit.org) for the micro:bit!
* [Fork the repo](https://github.com/microsoft/pxt-microbit)

## MakeCode for Adafruit Circuit Playground Express

The Circuit Playground Express is board 
produced by Adafruit Industries.

* [Try the Adafruit editor](https://makecode.adafruit.com) for Adafruit Circuit Playground Express!
* This editor is based on 
[Common Packages](https://github.com/microsoft/pxt-common-packages), which
defines how most sensors and outputs are realized across most MakeCode Devices
* [Fork the repo](https://github.com/microsoft/pxt-adafruit)

## Open Source

The MakeCode (PXT) framework is [open source](http://www.github.com/microsoft/pxt).
