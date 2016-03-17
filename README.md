# KindScript - A kinder JavaScript experience

[![Build Status](https://travis-ci.org/Microsoft/yelm.svg?branch=master)](https://travis-ci.org/Microsoft/yelm)

KindScript is a platform for creating special-purpose programming experiences for
beginners, especially focused on computer science education. KindScript's underlying
programming language is a subset of TypeScript (leaving out JavaScript dynamic
features).

The main features of KindScript are:
* a Blockly-based code editor along with converter to the text format
* an ACE-based text editor with enhanced, robust auto-completion and auto-correction
* extensibility support to define new blocks in TypeScript
* an ARM Thumb machine code emitter
* a command-line package manager

## Build

First, install Node (http://nodejs.org/). Then install the following:
```
npm install -g jake
npm install -g tsd
```

To build the KindScript command line tools:

```
tsd reinstall
npm install
jake
```

Then install the `kind` command line tool (only need to do it once):

```
npm install -g kindscript-cli
```

After this you can run `kind` from anywhere within the build tree.

To start the local web app server do `kind serve` within the root directory
of build tree (where this file sits) and then browse to http://localhost:3232 

## TODOs

### package mgr + compiler

* [x] image literals
* [x] code in top-level scope
* [x] only compile what's needed
* [x] don't emit unused global vars
* [x] testFiles: [ ... ] in yelm.json
* [x] class methods
* [ ] class field initializers (?)
* [x] constructors
* [ ] disallow direct references to class members (cannot copy JS semantics)
* [x] optional arguments
* [x] default arguments
* [ ] +=, -= etc
* [ ] proper caching for x.f++, x.f += ... etc
* [ ] lambdas returning values (maybe just works?)
* [ ] clear variables when they get out of scope to limit memory usage
* [x] function f() {...}; control.inBackground(f) in local scope
* [x] function f() {...}; control.inBackground(f) in global scope
* [x] //% shim=... weight=... help=... etc insteaf of {shim:...}
* [x] bit operators (&, |, etc)
* [ ] inline assembly
* [x] use "(x + y) | 0" etc instead of "x + y" in simulator
* [ ] allow use of floating point for non-native targets
* [x] do not generate empty action bodies for shim
* [x] check on compiler performance (1000ms on lang-test0)
* [x] forever() seems to have issues
* [x] skip unreferenced globals when initilized with literal
* [ ] do not DECR no-closure functions
* [ ] after uninstall pouch db throws 404 after reload
* [ ] in simulator currResume start loop() in nextTick
* [ ] `foo${bar}baz`
* [x] x ? a : b
* [ ] error for 'shim:foo' (ie. shim=true)
* [x] x as T support
* [ ] simulator at sim-microbit.kindscript.net
* [ ] `ptr-<username>-*` as the main way publishing packages
* [ ] lib compile mode - no reachability, test shims

#### Bigger items
* [ ] generate .d.ts from .cpp
* [ ] generate .d.ts from simulator code
* [ ] debugger hooks
* [ ] auto-fix of parenthesis
* [ ] integrate TD converter
* [ ] think about package versioning (semver?)


#### Maybe
* [ ] virtual methods
* [ ] 3-way merge upon sync

### web app

* [x] make blocks output file read only
* [x] do not type-check while auto-completing
* [x] scroll completion window with keyboard
* [x] indent when entering first character on a line
* [ ] save source in hex
* [ ] Save json
* [ ] Drag and drop load
* [x] Link up simulator
* [ ] Flag to hide from TS auto completion (eg: set sprite property with enum)
* [ ] add markdown processor for docs
* [ ] help for specific arguments
* [ ] stepping debugger
* [ ] attaching runtime warning to specific lines of code or block


### converter from TD to TS (different repo)

* [x] multi-line strings into backtick literals
* [ ] use bit operators for bits.XYZ
* [x] fish out {shim:...} and friends
* [x] {hints:...} -> @param x Blah, eg: 100, 200 (?)
* [x] async is flipped
* [ ] use `expr as Type` not `<Type> expr`

## Docs

We use mkdocs to generate the docs under the ``/docs`` folder. To setup mkdocs, 
````
pip install mkdocs
mkdocs serve
open http://127.0.0.1:8000
````

## License

MIT
