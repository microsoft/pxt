# The DOM-free simulator core

The simulator is two TypeScript projects in one `pxsim` namespace.

- `pxtsimcore/` is the runtime, board state, sound and host layers. It compiles without the `dom`
  lib, so a core file that uses `document` or `window` fails to build.
- `pxtsim/` is the embed, SVG views, Web Audio and iframes. It compiles against `pxtsimcore.d.ts`.

Core also contains the DOM-free core of the simulator driver. Consumers still load one
`built/pxtsim.js`: core first, then the DOM code.

## Layout

A file belongs to the project whose directory contains it.

```
pxtsimcore/runtime.ts                      the VM, Runtime and the board base classes
pxtsimcore/host.ts, virtualhost.ts         the host layer and its virtual implementation
pxtsimcore/sound/audiohost.ts              the audio host layer
pxtsimcore/simcoordinator.ts, simframe.ts  the DOM-free core of the simulator driver
pxtsim/embed.ts                            receives editor messages and starts each run
pxtsim/domhost.ts, sound/audiohostdom.ts   install the browser hosts
pxtsim/simdriver.ts                        SimulatorDriver, which the editor uses to run simulators
pxtsim/simframedom.ts                      DomSimFrameHost, which creates and manages the iframes
pxtsim/visuals/                            BoardHost, the breadboard, generic parts and wiring
```

The gulp `pxtsim` task compiles core to `built/pxtsimcore.js`, compiles the DOM project against it,
and concatenates the two into `built/pxtsim.js` and `built/pxtsim.d.ts`. It also copies
`globals.d.ts` to `built/pxtsimcore-globals.d.ts`; a target's DOM-free code compiles against
`pxtsimcore.d.ts` and that file. All of these ship in pxt-core.

## The boundary

Core sees its own declarations, `pxtsimcore/globals.d.ts` and the `localtypings/` files it
references, and nothing from `pxtsim/`. `globals.d.ts` declares by hand what browsers, workers and
Node all have. A global that only some hosts have is typed as possibly undefined, so core checks
before calling it:

```ts
requestFrame: fn => typeof requestAnimationFrame !== "undefined"
    ? requestAnimationFrame(fn) : setTimeout(fn, FRAME_MS),
```

Time, timers and random numbers come from `pxsim.host`, and sound goes through `pxsim.audiohost`.
The one exception is the serial timestamp, which stays on `Date.now()` because the serial view
shows wall-clock time.

Each project compiles to one script, so a file used by another at load time must come first. A
reference pins the order. `libgeneric.ts` needs `RefObject` from `langsupport.ts` for its
`RefCollection` class, so it starts with:

```ts
/// <reference path="./langsupport.ts" />
```

## Host layers

`pxsim.host` is what differs between a browser and Node: `Environment` (messaging the editor),
`Clock`, `Timers` and `RandomSource`. Each has a default that works without a browser.

```ts
const t = host.clock().now();                  // instead of Date.now()
const id = host.timers().setTimeout(fn, 20);   // instead of setTimeout(fn, 20)
host.setClock({ now: () => fakeNow });         // replace one member; the rest keep their defaults
```

The browser installs its environment in `pxtsim/domhost.ts`:

```ts
setEnvironment({
    postToParent: data => window.parent.postMessage(data, "*"),
    locationHref: () => window.location.href,
    ...
});
```

`pxsim.audiohost` does the same for sound. Core plays through `audiohost.audio()`, and
`pxtsim/sound/audiohostdom.ts` registers the Web Audio implementation with `setAudioHost`. Without
it, core uses a silent host that plays nothing but takes the same time, so the metronome still
ticks.

## The virtual host

`createVirtualHost()` in `virtualhost.ts` returns a host whose clock advances only when the caller
advances it. Timers wait on a queue in virtual time and random numbers come from a seed, so runs
with the same seed are deterministic.

```ts
const vh = pxsim.host.createVirtualHost({ seed: 1 });
vh.use();                           // install it as the current host
await vh.advance(1000);             // fire everything due in the next second; no real time passes
await vh.runUntil(() => finished);  // fire queued callbacks one at a time until finished is true
vh.stop();
```

`advance` and `runUntil` yield to the event loop around each callback, so promises settle as they
would in a browser. The runtime yields about every 20 ms of host time. Virtual time does not advance
inside a busy loop, so the runtime also yields after a fixed number of checks on an unchanged clock,
and a stuck program yields to the caller instead of hanging Node.

## Board state and view

A board is a state, `runtime.board`, and an optional view, `runtime.boardView`. The state is
everything a program can read or change. The view draws it and turns user input into state changes.
With no view, the runtime skips every view call, so screenshots and recordings are no-ops.

State code never calls the view. It requests a redraw, and the runtime calls the view's `updateView`
between steps:

```ts
runtime.queueDisplayUpdate();
```

A target sets both entry points. In pxt-microbit the view bundle sets one and the core bundle the
other:

```ts
// sim/visuals/dalboardview.ts: state and view
if (!pxsim.initCurrentRuntime) pxsim.initCurrentRuntime = initRuntimeWithDalBoard;
// sim/core/headless.ts: state only
if (!pxsim.initHeadlessRuntime) pxsim.initHeadlessRuntime = initHeadlessDalBoard;
```

Shims and state code access the board through the target's `board()` accessor, and only view code
uses `boardView()`. Most states extend `CoreBoard`, which keeps part states in `builtinParts` and
stops sound on `kill`. A view implements `RuntimeBoardView`. The embed calls its `initAsync` after
the board's, and the program starts when both resolve. A view with breadboard parts passes its
`builtinVisuals` and the board state to `visuals.BoardHost`, which pairs each part view with its
state by simulation behavior.

## Simulator frames

`SimulatorDriver` runs in the editor page and runs each simulator in an iframe. Everything it does
without the DOM is `SimulatorCoordinator` in core: starting and stopping runs, opening a second
board or a simulator extension frame, routing messages between frames, the debugger protocol and
origin checks. The coordinator accesses frames and the page only through two interfaces:

```ts
// simframe.ts: whatever holds the frames
interface SimFrameHost {
    frames(skipLoaned?: boolean): SimFrame[];
    createFrame(spec: SimFrameSpec, position: SimFramePosition): SimFrame;
    removeFrame(frame: SimFrame, onComplete?: () => void): void;
    post(frame: SimFrame, msg: SimulatorMessage): void;
    ...
}
// simcoordinator.ts: the page or process around the coordinator
interface SimEnvironment {
    readonly origin: string;
    parentTarget(): SimMessageTarget | undefined;
    addMessageListener(listener: (origin: string, data: any, source: unknown) => void): () => void;
    ...
}
```

In the browser, `pxtsim/simframedom.ts` implements `SimFrameHost` with iframes, and
`SimulatorDriver` in `pxtsim/simdriver.ts` is the coordinator wired to it, plus `loanSimulator`,
which hands an iframe to another part of the page:

```ts
export class SimulatorDriver extends SimulatorCoordinator {
    constructor(public container: HTMLElement, public options: SimulatorDriverOptions = {}) {
        super(new DomSimFrameHost(container, options), new DomSimEnvironment(), options);
    }
}
```

## Target core bundles

A target ships a DOM-free bundle by adding `sim/tsconfig.core.json`, which compiles `sim/core/` to
`built/simcore.js` without the `dom` lib. `sim/tsconfig.json` then compiles only the view files and
prepends the core bundle. pxt-microbit's pair, trimmed:

```jsonc
// sim/tsconfig.core.json -> built/simcore.js
{
    "compilerOptions": { "outFile": "../built/simcore.js", "declaration": true,
                         "lib": ["es2017"], "types": [] },
    "files": [
        "../node_modules/pxt-core/built/pxtsimcore.d.ts",
        "../node_modules/pxt-core/built/pxtsimcore-globals.d.ts"
    ],
    "include": ["core/**/*.ts", "../node_modules/pxt-common-packages/libs/radio/sim/core/*.ts"]
}
// sim/tsconfig.json -> built/sim.js, which is simcore.js followed by the view code
{
    "compilerOptions": { "outFile": "../built/sim.js", "declaration": true,
                         "lib": ["dom", "es2017"] },
    "files": ["../node_modules/pxt-core/built/pxtsim.d.ts", "../built/simcore.d.ts"],
    "include": ["visuals/**/*.ts", "../node_modules/pxt-common-packages/libs/core/sim/neopixel.ts"],
    "prepend": ["../built/simcore.js"]
}
```

`prepend` is a pxt key, allowed only in `tsconfig.json`. pxt concatenates the listed files ahead of
the output, and their `.d.ts` files ahead of the declarations, so the browser loads `sim.js` as
before. `pxt buildtarget` and `pxt rebundle` build the core config first. A sim installed from npm
at `node_modules/pxt-<target>-sim` writes to its own `built/`, and pxt copies the outputs into the
target's `built/`. pxt-common-packages keeps each library's DOM-free files in `libs/<lib>/sim/core/`
and builds `common-simcore.js` and `common-sim.js`, which `pxt buildtarget` copies the same way.

To run in a browser, load `pxtsim.js` and `sim.js`. To run without a DOM, load `pxtsimcore.js` and
`simcore.js`. Never load both pairs: `pxtsim.js` already contains core.

## Porting a target

pxt-microbit was the first target to ship a DOM-free bundle, and its `sim/core/` is the example.
These are the steps it took, in order.

1. Partition the code. State, shims and runtime calls go to `sim/core/`. Anything that uses
   `document`, `window`, a canvas, an SVG or an audio context goes to `sim/visuals/`. When one
   member does both, keep the state and the decision in core and move the drawing to the view.
2. Split the board. A state class extends `CoreBoard`, a view class implements `RuntimeBoardView`,
   and a small `boardaccess.ts` in core declares the board class the shims name:
   ```ts
   export class DalBoard extends DalBoardState { }
   export function board(): DalBoard { return runtime.board as DalBoard; }
   export function boardView(): RuntimeBoardView | undefined { return runtime.boardView; }
   ```
3. Set the entry points as under "Board state and view", each only if it is still unset.
4. Where the old board redrew after a state change, call `runtime.queueDisplayUpdate()` and redraw
   in the view's `updateView`.
5. Replace every direct use of the clock and timers left in core with `host.clock()` and
   `host.timers()`. Headless runs install a virtual host that replaces both; a global call left in
   core bypasses it and breaks determinism.
6. A shim that needs the DOM, such as audio recording, calls an interface in core whose default
   reports the feature as unsupported. The view bundle installs the DOM version when it loads.
7. Write the two configs as under "Target core bundles". Both include files from
   pxt-common-packages: the core config the state files from `libs/<lib>/sim/core/`, and the view
   config the matching view files from `libs/<lib>/sim/`.
8. Add a `/// <reference path>` wherever a file extends or calls another file as the bundle loads.
   `headless.ts` references `boardaccess.ts` for this reason.
9. Every shim the simulator defines must be in `simcore.js`, or a headless run fails at that call.
   List them before the split and check each against the core bundle's `.d.ts` after.
10. Build with `pxt buildtarget`, exercise every input of the browser simulator by hand, and add
    `pxt simtest` programs under `tests/sim/` to the target's CI.

## Running programs headless

`pxt simtest` runs test programs in Node with no browser, through `runHeadlessAsync` in
`cli/simtest.ts`. A test is an ordinary program with its expected serial output in comments:

```ts
// tests/sim/audio-pin.ts in pxt-microbit
// @serial: tone played
pins.setAudioPinEnabled(false)
music.playTone(262, 100)
console.log("tone played")
```

It passes when it compiles, runs without an error, finishes before the timeout and, if it has
`// @serial:` lines, writes exactly those lines in order.

```sh
pxt simtest --base libs/blocksprj tests/sim        # pxt-microbit's CI step, in the target directory
pxt simtest --core tests/sim                       # require the DOM-free pair; fail without one
pxt simtest --timeout 10000 --settle 0 tests/sim/buttons.ts
```

Each test replaces the one `.ts` file in the `--base` project, which defaults to the current
directory. The run loads `pxtsimcore.js` and `simcore.js` when the target has built `simcore.js`,
and `pxtsim.js` and `sim.js` otherwise. Every run installs a virtual host and the silent audio host,
so `pause(1000)` takes no real time. The program runs until its top-level code finishes, then for
`--settle` more virtual milliseconds (default 300), and never waits for it to go idle, so a
`forever` loop still passes. `--timeout` is real time and defaults to 5 seconds.
