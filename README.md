# yelm - Experimental Programming Environment for micro:bit

[![Build Status](https://travis-ci.org/Microsoft/yelm.svg?branch=master)](https://travis-ci.org/Microsoft/yelm)

Yelm is a platform for creating special-purpose programming experiences for
beginners, especially focused on computer science education. Yelm underlaying
programming language is a subset of TypeScript (leaving out JavaScript dynamic
features).

The main features of Yelm are:
* a Blockly-based code editor along with converter to the text format
* an ACE-based text editor with enhanced, robust auto-completion and auto-correction
* a TypeScript library defining APIs available on microbit devices
* an ARM Thumb machine code emitter
* a command-line package manager

## Name

Yelm is a city near Mt Rainier in Washington State with a name short enough for
command line tool. It also stands for Your Experimental programming Language
environment for microbit-compatible devices.


## Build

Building yelm command line tools:

```
tsd reinstall
npm install
jake
```

Building webapp:
```
cd webapp
tsd reinstall
npm install
jake
node server.js &
open http://localhost:3232
```

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
* [ ] bit operators (&, |, etc)
* [ ] inline assembly
* [ ] use "(x + y) | 0" etc instead of "x + y" in simulator
* [x] do not generate empty action bodies for shim
* [x] check on compiler performance (1000ms on lang-test0)
* [x] forever() seems to have issues
* [x] skip unreferenced globals when initilized with literal
* [ ] do not DECR no-closure functions
* [ ] after uninstall pouch db throws 404 after reload
* [ ] `ptr-<username>-*` as the main way publishing packages

### web app

* [x] make blocks output file read only
* [x] do not type-check while auto-completing
* [x] scroll completion window with keyboard
* [x] indent when entering first character on a line
* [ ] save source in hex
* [ ] Save json
* [ ] Drag and drop load
* [ ] Link up simulator
* [ ] Flag to hide from TS auto completion (eg: set sprite property with enum)
* [ ] add markdown processor for docs


### converter from TD to TS (different repo)

* [x] multi-line strings into backtick literals
* [ ] use bit operators for bits.XYZ
* [x] fish out {shim:...} and friends
* [x] {hints:...} -> @param x Blah, eg: 100, 200 (?)
* [ ] async is flipped
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
