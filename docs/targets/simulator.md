## Simulator

### Enums

Enums (and interfaces) can be shared between simulator and the target libraries
if you put them in the library, in `.d.ts` file, and then reference these
files from the simulator.

## Compilation to ARM native code

If your target platform is ARM Mbed compatible, PXT will be able to compile programs to ARM machine code in browser.
We recommend to contact the team to help you get started on this topic.

## Async functions

PXT support cooperative multithreading and implicit async functions.
[See more](/async).


## Offline Support

If your simulator references images or external resources then it might not work
when offline. You can fix this by configuring the service worker for the simulator
that PXT creates. Inside of your target's `sim/public` folder, add a file named
`workerConfig.js` with the following contents:

```javascript
self.setSimulatorWorkerOptions({
    urls: []
})
```

Any URLs that are placed in the urls array will be cached along with the other simulator
files. If the URLs are located in the `sim/public` folder of your target, you can reference
them like so: `/sim/myFile.png`. The `/sim/` path component will be automatically patched
by PXT into the full URL for the resource.

**Warning**: Make sure that all URLs added to this array exist. If any of these URLs fail to resolve,
the service worker will not install and the simulator will not be cached offline.
