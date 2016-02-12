# Yelm - Experimental Programming Environment for micro:bit

Yelm combines the following:

* a TypeScript library defining APIs available on the micro:bit
* an ARM Thumb machine code emitter for TypeScript
* a Blockly-based editor along with converter to TypeScript
* a webapp hosting the Blockly-based editor and ACE-based editor for TypeScript
* a command-line package manager

Yelm is an experimental platform for research on new ways of programming, especially
focused on computer science education.

## Name

Yelm is a city near Mt Rainier in Washington State with a name short enough for
command line tool. It also stands for Your Experimental programming Language
environment for Micro:bit-compatible devices.


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

## TODO

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
* [ ] have buffered output mode in simulator
* [ ] have output-independent simulator for running tests
* [ ] do not generate empty action bodies for shim
* [ ] check on compiler performance (1000ms on lang-test0)
* [ ] forever() seems to have issues
* [ ] make blocks output file read only

## TODO for converter from TD

* [x] multi-line strings into backtick literals
* [ ] use bit operators for bits.XYZ
* [x] fish out {shim:...} and friends
* [x] {hints:...} -> @param x Blah, eg: 100, 200 (?)

## Docs

We use mkdocs to generate the docs under the ``/docs`` folder. To setup mkdocs, 
````
pip install mkdocs
mkdocs serve
````

## License

MIT
