# ARM Thumb / mbit emitter for TypeScript

## Build

```
tsd reinstall
npm install
jake
```

## TODO

[ ] image literals
[x] code in top-level scope
[ ] only compile what's needed
[ ] test.ts file handling
[ ] class methods
[ ] optional arguments
[ ] default arguments
[ ] +=, -= etc
[ ] proper caching for x.f++, x.f += ... etc
[ ] return values in lambdas
[ ] clear variables when they get out of scope to limit memory usage
[x] function f() {...}; control.inBackground(f) in local scope
[x] function f() {...}; control.inBackground(f) in global scope

## Yelm

Yelm is a package manager for mbit. 

### Name

Yelm is a city in Washington state, with a name short enough for a command line tool.

## License

MIT
