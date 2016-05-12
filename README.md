# Programming Experience Toolkit - pxt.io
## A kinder JavaScript experience

* [Try it live!](https://pxt.io)

[![Build Status](https://travis-ci.org/Microsoft/pxt.svg?branch=master)](https://travis-ci.org/Microsoft/pxt)

Programming Experience Toolkit (PXT) is a framework for creating special-purpose programming experiences for
beginners, especially focused on computer science education. PXT's underlying
programming language is a subset of TypeScript (leaving out JavaScript dynamic
features).

The main features of PXT are:
* a Blockly-based code editor along with converter to the text format
* an ACE-based text editor with enhanced, robust auto-completion and auto-correction
* extensibility support to define new blocks in TypeScript
* an ARM Thumb machine code emitter
* a command-line package manager

## Running a target from localhost

Install the `pxt` command line tool (only need to do it once):

```
npm install -g pxt
```

Now, let's say you want to install `microbit` target:
```
mkdir mymicrobit
cd mymicrobit
pxt target microbit
pxt serve
```

The last command will open default browser and point it to http://localhost:3232/

The `pxt target microbit` is essentially the same as ``mkdir node_modules; npm install pxt-microbit``
plus setting up `pxtcli.json` file to point to the target.

In future, you just need to run `pxt serve`. You can also run `npm update` to upgrade 
the target and PXT.

## Build

First, install Node (http://nodejs.org/). Then install the following:
```
npm install -g jake
npm install -g tsd
```

To build the PXT command line tools:

```
tsd reinstall
npm install
jake
```

Then install the `pxt` command line tool (only need to do it once):

```
npm install -g pxt
```

After this you can run `pxt` from anywhere within the build tree.

To start the local web app server do `pxt serve` within the root directory
of build tree (where this file sits) and then browse to http://localhost:3232 

### Icons

There is a number of custom icons (to use in addition
to http://semantic-ui.com/elements/icon.html) in the `svgicons/` directory.
These need to be `1000x1000px`. Best start with an existing one. To see available icons go to
http://localhost:3232/icons.html (this file, along with `icons.css` containing
the generated WOFF icon font, is created during build).

If you're having trouble with display of the icon you created, try:
```
npm install -g svgo
svgo svgicons/myicon.svg
```

## TODOs

### package mgr + compiler
* [x] image literals
* [x] code in top-level scope
* [x] only compile what's needed
* [x] don't emit unused global vars
* [x] testFiles: [ ... ] in yelm.json
* [x] class methods
* [x] constructors
* [x] disallow direct references to class members (cannot copy JS semantics)
* [x] optional arguments
* [x] default arguments
* [x] +=, -= etc
* [x] += on strings
* [x] proper caching for x.f++, x.f += ... etc
* [x] function f() {...}; control.inBackground(f) in local scope
* [x] function f() {...}; control.inBackground(f) in global scope
* [x] //% shim=... weight=... help=... etc insteaf of {shim:...}
* [x] bit operators (&, |, etc)
* [x] use "(x + y) | 0" etc instead of "x + y" in simulator
* [x] do not generate empty action bodies for shim
* [x] check on compiler performance (1000ms on lang-test0)
* [x] forever() seems to have issues
* [x] skip unreferenced globals when initilized with literal
* [x] `foo${bar}baz`
* [x] x ? a : b
* [x] x as T support
* [x] check on ("foo" + true)
* [x] simulator at sim-microbit.kindscript.net
* [ ] ``ptr-<username>-*`` as the main way publishing packages
* [ ] lambdas returning values (maybe just works?)
* [ ] clear variables when they get out of scope to limit memory usage
* [x] allow use of floating point for non-native targets
* [ ] do not DECR no-closure functions
* [ ] after uninstall pouch db throws 404 after reload
* [ ] in simulator currResume start loop() in nextTick
* [x] in JS emitter - limit stack height
* [x] in JS emitter - generate pause every 1000 loop iterations or so
* [x] `>=` in formatter becomes `> =`
* [ ] expose simulator errors in web app
* [x] implement .hex file cache in browser
* [x] implement .hex file cache in CLI
* [x] deal with C++ enums
* [ ] deal with C++ classes

* [x] enum support without enumval= (esp for non-hex targets)
* [x] switch() statement support
* [x] % operator
* [x] error for 'shim:foo' (ie. shim=true)
* [x] lib compile mode - no reachability, test shims
* [x] inline assembly

* [x] move target definition from pxt.json to pxtarget.json

#### Bigger items
* [x] generate .d.ts from .cpp
* [x] generate .d.ts from simulator code
* [ ] debugger hooks
* [ ] auto-fix of parenthesis
* [x] integrate TD converter
* [ ] think about package versioning (semver?)

#### Maybe
* [ ] virtual methods
* [ ] 3-way merge upon sync
* [ ] class field initializers (?)
* [x] support Enum.X + 0 etc ?

### web app

* [x] make blocks output file read only
* [x] do not type-check while auto-completing
* [x] scroll completion window with keyboard
* [x] indent when entering first character on a line
* [x] save source in hex
* [ ] Save json
* [x] Drag and drop load
* [x] Link up simulator
* [ ] Flag to hide from TS auto completion (eg: set sprite property with enum)
* [x] add markdown processor for docs
* [ ] help for specific arguments
* [x] stepping debugger
* [ ] attaching runtime warning to specific lines of code or block


### converter from TD to TS (different repo)

* [x] multi-line strings into backtick literals
* [x] use bit operators for bits.XYZ
* [x] fish out {shim:...} and friends
* [x] {hints:...} -> @param x Blah, eg: 100, 200 (?)
* [x] async is flipped
* [x] use `expr as Type` not `<Type> expr`

## License

MIT
