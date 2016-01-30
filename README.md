# ARM Thumb / mbit emitter for TypeScript

## Build

```
tsd reinstall
npm install
jake
```

## TODO

* [ ] image literals
* [x] code in top-level scope
* [x] only compile what's needed
* [x] don't emit unused global vars
* [ ] testFiles: [ ... ] in yelm.json
* [ ] class methods
* [x] optional arguments
* [x] default arguments
* [ ] +=, -= etc
* [ ] proper caching for x.f++, x.f += ... etc
* [ ] lambdas returning values (maybe just works?)
* [ ] clear variables when they get out of scope to limit memory usage
* [x] function f() {...}; control.inBackground(f) in local scope
* [x] function f() {...}; control.inBackground(f) in global scope
* [ ] @mbit shim=... weight=... help=... etc insteaf of {shim:...}

## Yelm

Yelm is a package manager for mbit. 

### Name

Yelm is a city in Washington state, with a name short enough for a command line tool.

## License

MIT
