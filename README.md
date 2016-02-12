# ARM Thumb / mbit emitter for TypeScript

## Build

```
tsd reinstall
npm install
jake
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

* [ ] multi-line strings into backtick literals
* [ ] use bit operators for bits.XYZ
* [ ] fish out {shim:...} and friends
* [ ] {hints:...} -> @param x Blah, eg: 100, 200 (?)

## Yelm

Yelm is a package manager for mbit. 

### Name

Yelm is a city in Washington state, with a name short enough for a command line tool.

## Docs

We use mkdocs to generate the docs under the ``/docs`` folder. To setup mkdocs, 
````
pip install mkdocs
mkdocs serve
````

## License

MIT
