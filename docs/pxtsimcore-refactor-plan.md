# Plan: split `pxtsimcore` (DOM-free) from `pxtsim` (DOM)

## Key constraint

`pxtsim` is built as a single `outFile` (`built/pxtsim.js`) in the `pxsim` namespace. It is consumed by the webapp, the simulator frame, and the target repos (`pxt-common-packages/sim`, `pxt-microbit/sim`) through globals and `built/pxtsim.d.ts`. To avoid breaking consumers, keep the **`pxsim` namespace and the existing `pxtsim.js` bundle** and make it a superset of the core.

## Target layout

- **`pxtsimcore/`** builds `built/pxtsimcore.js` and `.d.ts`.
  - Its tsconfig has `lib: ["es2017", "ES2018.Promise"]` with **no `dom`**, so the compiler enforces DOM-freedom.
- **`pxtsim/`** builds `built/pxtsim.js`.
  - It references `pxtsimcore.d.ts` via a project reference or `/// <reference>`.
  - It keeps the DOM `lib`.
  - The gulp bundle concatenates core and DOM code, so downstream behavior is unchanged.

## Proposed file split

| Core (no DOM) | Stays in pxtsim (DOM) |
|---|---|
| `allocator`, `debugProtocol`, `langsupport`, `libgeneric`, `localization`, `logger`, `utils` | `svg.ts`, `visuals/*` (boardhost, breadboard, genericboard, genericpart, wiring) |
| most of `runtime.ts` (the VM and the message types) | `instructions.ts`, `accessibility.ts` |
| `debugger.ts`, `state/*` (verify each one) | `simdriver.ts` |
| `sound/` synthesis and sequencing: `soundSynthesizer*`, `soundexpression`, `soundEmojiSynthesizer`, `song`, `musicalProgressions`, `sequencer` | `embed.ts` |
| | `sound/` Web Audio pieces: `audioContextManager`, `audioElementSource`, `audioWorkletSource`, `metronome`, `spatialAudioPlayer`, and so on |

## Steps

1. **Add a DOM-free type-check first (low risk).** ✅ Done.
   - Added [pxtsimcore/tsconfig.json](../pxtsimcore/tsconfig.json) (no `dom` lib, `noEmit`, `types: []`) over the candidate core files, plus [pxtsimcore/globals.d.ts](../pxtsimcore/globals.d.ts), which declares only host-agnostic globals (timers, `console`, `performance`, `TextEncoder`/`TextDecoder`).
   - Run it with `node_modules/.bin/tsc -p pxtsimcore/tsconfig.json`. It is not wired into the gulp build yet, and it is expected to fail until the later steps land.
   - The errors are the work list; see the baseline below.

### Progress: group B declaration moves (done) — 137 → 59 errors

Pure moves inside `pxtsim/`, same `pxsim` namespaces, so the public `.d.ts` is unchanged except for one deliberate change (below). Verified by building `pxtsim` before and after and diffing `built/pxtsim.d.ts`.

| New file | Contents (moved from) |
|---|---|
| `pxtsim/messages.ts` | all `Simulator*Message` interfaces, tutorial/render messages and the `multiplayer` types (from `embed.ts`; history follows this file via `git mv`) |
| `pxtsim/embed.ts` | now only the DOM code: `print`, `Embed`, `tickEvent`, `reportError`, service worker, `reload`, load listener |
| `pxtsim/eventbus.ts` | `BoardPin`, `BBLoc`, `BoardLoc`, `Loc`, `mkRange`, `EventBus` (from `simlib.ts`) |
| `pxtsim/simtypes.ts` | `SimulatorState`, `SimulatorDebuggerCommand`, `SimulatorRunOptions`, `HwDebugger` (from `simdriver.ts`; `SimulatorDriverOptions` stays there because it has `HTMLElement` callbacks) |
| `pxtsim/visuals/boardgeometry.ts` | `Coord`, `findDistSqrd`, `findClosestCoordIdx`, wire colors, `BREADBOARD_MID_ROWS/COLS`, `getRowName`, `getColumnName` (from `simlib.ts` and `breadboard.ts`) |

Notes:
- **One API change:** `AllocatorResult` is now `AllocatorResult<TPart = any, TWire = any>`, because it referenced the SVG types `IBoardPart` and `Wire`. `BoardHost.addAll` uses `AllocatorResult<IBoardPart<any>, Wire>`. Consumers that used `AllocatorResult` unparameterized now see `any[]` for `parts`/`wires`.
- **Load order:** `breadboard.ts` evaluates constants from `boardgeometry.ts` at load time, so it has a `/// <reference path="./boardgeometry.ts" />` to keep bundle order correct.
- `pxtsim/tsconfig.json` is unchanged; the new files are picked up automatically.

### Remaining baseline (59 errors)

| File | Errors | What is left |
|---|---|---|
| `runtime.ts` | 38 | `U` class/element helpers (`SVGElement`, `HTMLElement`, `Element`), `window` in `isElectron`/`isIpc`/`isLocalHost`/`postMessage`, `ImageData` screenshots, `Embed.frameid`, `visuals.IBoardPart`/`SVGElAndSize` on `CoreBoard`, `AudioContextManager` |
| `sound/sequencer.ts` | 8 | `AudioContextManager`, `Metronome` |
| `debugger.ts` | 7 | uses `SimulatorDriver`/`SimulatorDriverOptions` and `HTMLElement` directly. Probably belongs in the DOM bundle, not core |
| `sound/soundexpression.ts` | 3 | `AudioContextManager` |
| `messages.ts` | 3 | `ImageData` (2) and `pxsim.instructions` namespace reference (1) in message types. Loosen the types or declare minimal interfaces |

### Original baseline (137 errors across 7 files)

| File | Errors |
|---|---|
| `runtime.ts` | 57 |
| `allocator.ts` | 53 |
| `debugger.ts` | 16 |
| `sound/sequencer.ts` | 8 |
| `sound/soundexpression.ts` | 3 |

All other files in the set (`debugProtocol.ts`, `langsupport.ts`, `libgeneric.ts`, `localization.ts`, `logger.ts`, `utils.ts`, `state/*`, and the pure sound files) report no errors once `globals.d.ts` is included.

The errors fall into three groups.

**A. Real DOM usage (needs host abstractions, step 2/3/5)**
- `runtime.ts` 16–47: `HTMLElement | SVGElement` in the `U` class helpers; 63–71: `Element` in `remove`, `removeChildren`, `clear`.
- `runtime.ts` 277–294, 1069–1070: `window` (`isElectron`, `isIpc`, `isLocalHost`, `Runtime.postMessage` to `window.parent`).
- `runtime.ts` 470, 819, 849, 1910: `ImageData` in `screenshotAsync` and the screenshot flow.
- `debugger.ts` 272: `HTMLElement` (driver options).
- `runtime.ts` 519–520: `visuals.*` types on `CoreBoard` (`builtinVisuals`, `builtinPartVisuals`).

**B. Leaks from files not in the core set (move or split the symbol, step 3/5)**
These are not DOM calls, but the symbol lives in a file that mixes DOM and core:
- `simlib.ts`: `BBLoc`, `Loc`, `BoardLoc` and `mkRange` (needed by `allocator.ts`, 25+ uses), and `EventBus` (needed by `runtime.ts`). Split `simlib.ts` into a DOM-free part (types, `EventBus`, `mkRange`) and the SVG composition part.
- `embed.ts`: message interfaces (`SimulatorRunMessage`, `SimulatorStateMessage`, `SimulatorCommandMessage`, `SimulatorCustomMessage`, `SimulatorScreenshotMessage`, `SimulatorRecorderMessage`, `SimulatorAutomaticThumbnailMessage`, `SetMuteButtonStateMessage`) and the `Embed` namespace (`Embed.frameid`). Move the message types to a core file and leave the `window` listeners in `embed.ts`. `Embed.frameid` becomes injected host state.
- `simdriver.ts`: `SimulatorState`, `SimulatorDebuggerCommand`, `SimulatorDriverOptions`, `SimulatorDriver` (referenced from `debugger.ts`). Move the enums and shared option types to core, and have `debugger.ts` stop referencing the driver class directly.
- `allocator.ts`: `visuals.*` types (`PartVisualDefinition`-style types in `visuals/`). Move the pure data types to core.

**C. Audio coupling inside otherwise-core files (step 4)**
- `runtime.ts` 539–541 and `sound/soundexpression.ts` 304/321 use `AudioContextManager`.
- `sound/sequencer.ts` uses `Metronome` and `AudioContextManager` types.
- Introduce an audio-output interface in core, implemented by the Web Audio code in pxtsim.

**Not DOM, shimmed in `globals.d.ts`:** `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`, `console`, `performance`, `TextEncoder`, `TextDecoder`. These exist in browsers, workers and Node, so core can use them.


2. **Introduce host abstractions in core.** Each one replaces a direct DOM or window call with an interface that pxtsim implements.
   - `Runtime.postMessage` currently calls `window.parent.postMessage` directly. Add a `pxsim.host.postMessage` hook, with the DOM implementation installed by `embed.ts`.
   - `isLocalHost`, `isElectron`, and `isIpc` currently read `window`. Replace them with injected environment info (`host.location`, `host.flags`).
   - Replace `U.addClass`, `removeClass`, `containsClass`, `remove`, `removeChildren`, and `clear`, which take `SVGElement` or `Element`. Move them to a DOM-side `pxsim.dom` or `svg` helper.
     - About 55 call sites use these, mostly in visuals, so that is a mechanical rename.
   - Keep deprecated aliases in `pxsim.U` that are installed by the DOM bundle. This avoids breaking `pxt-common-packages` and `pxt-microbit`.
   - Replace `requestAnimationFrame` in `playInstructions` with an injectable scheduler, defaulting to `setTimeout` in core.

3. **Split `runtime.ts`.**
   - Keep the VM, the message interfaces, and the `Runtime` class in core.
   - Move the DOM helpers in the `U` namespace (class handling, element removal) to pxtsim.

4. **Split the audio layer.** This is the largest piece of work.
   - Move the synthesizer logic to core. It should depend only on `AudioContext`-like interfaces that you declare yourself, not on the DOM lib types.
   - Keep `AudioContext`, `Audio`, `AudioWorklet`, `Worker`, and `HTMLAudioElement` usage in pxtsim.
   - `worklet.ts` and `metronome.ts` run in worker scopes, so check whether they should be a third target.

5. **Fix the type leaks.** Core signatures must not mention DOM types.
   - `IBoardPart` and `BoardView` use `SVGSVGElement`, so they stay in pxtsim.
   - Check whether `CoreBoard` or `EventBus` reference `SVGElement` anywhere. If so, introduce opaque or generic types.
   - `SimulatorRunOptions` and `SimulatorDriverOptions` mention `HTMLElement`. The driver is DOM-side, so these can stay in pxtsim.

6. **Update the build.**
   - Add a `pxtsimcore` task in `gulpfile.js` that runs before `pxtsim`.
   - Wire it into the existing lists that mention `built/pxtsim.js` (around lines 117, 142, 153, 474, and 804).
   - Concatenate `pxtsimcore.js` before `pxtsim.js`, or have `pxtsim` emit both.
   - Add the package to the watch task and the lint task.
   - Update the `.d.ts` copy and publish steps for the new `pxtsimcore.d.ts`.

7. **Verify.**
   - Run `gulp` for the full build.
   - Run the existing tests and smoke-test the simulator in the browser.
   - Build `pxt-common-packages` and `pxt-microbit` against the new output to confirm the `pxsim` API is unchanged.
   - Optionally add a Node test that loads `pxtsimcore.js` with no `window` defined, to guard against regressions.

## Suggested ordering

Do steps 1–2 first, since they surface the full list of violations without moving files. Then split `runtime.ts` and the small utilities. Do the audio split last because it is the riskiest.

## Board state vs. board view (`DalBoard` split)

### Why
`BaseBoard` and `CoreBoard` in `pxtsim/runtime.ts` and `DalBoard` in `pxt-microbit/sim/dalboard.ts` mix **simulation state** with **view/DOM**. Today `board()` returns the whole thing, so every state file (`state/*.ts`) transitively depends on the DOM. The state side of the split is what has to move to `pxtsimcore`.

### What is mixed in today

| Concern | Members |
|---|---|
| **State (DOM-free)** | `bus`, `id`, `runOptions`, `storedState`, `setStoredState`, `writeSerial`, `receiveMessage`, `addMessageListener`, and the component states: `ledMatrixState`, `edgeConnectorState`, `serialState`, `accelerometerState`, `compassState`, `thermometerState`, `lightSensorState`, `buttonPairState`, `radioState`, `microphoneState`, `recordingState`, `lightState`, `fileSystem`, `logoTouch`, `speakerEnabled`, `controlMessageState`, `samplesState`, `neopixelState()`, `tryGetNeopixelState()`, `hardwareVersion` (the value) |
| **View (DOM)** | `viewHost` (`visuals.BoardHost`), `view` (`SVGElement`), `builtinVisuals`, `builtinPartVisuals`, `updateSubscribers` and `updateView`, `screenshotAsync` (canvas), `initAsync` (touches `document.body`, builds the mute button), `kill()` (`viewHost.removeEventListeners`, `AudioContextManager`), `ensureHardwareVersion` (calls `updateView`) |

Component states are constructed with `builtinParts[...]` entries, but `builtinParts` itself is just a map of state objects. It is DOM-free and belongs with the state.

### Proposed split

1. **`pxtsimcore`: `BaseBoardState` and `CoreBoardState`.**
   - Hold `id`, `bus`, `runOptions`, `storedState`, serial buffering, message listeners, `builtinParts`, and a `onViewInvalidated` event (replacing `updateSubscribers`).
   - `updateView()` becomes `invalidateView()`, which just raises that event and has no DOM knowledge.
2. **`pxtsim`: `BaseBoard` and `CoreBoard` (view side).**
   - `CoreBoard` owns, or is constructed with, a `CoreBoardState` and holds `builtinVisuals`, `builtinPartVisuals`, `viewHost`, and `view`.
   - It subscribes to `onViewInvalidated` and drives `updateSubscribers`.
   - It keeps `screenshotAsync`, DOM `initAsync`, and the audio and DOM parts of `kill()`.
3. **`pxt-microbit`:**
   - `DalBoardState` (new, core): all of the component states, `hardwareVersion`, `neopixelState()`, and so on.
   - `DalBoard` (view): owns a `DalBoardState` plus `viewHost`, `view`, and the visual registrations. Optionally it exposes the state as `board.state`.
4. **Runtime wiring.**
   - Add `runtime.boardState: BaseBoardState` alongside `runtime.board`. `runtime.board` stays as the view-side accessor, typed `BaseBoard`, for compatibility.
   - `BareBoard` and `initBareRuntime` only need a state object.
   - Constructors that currently take `runtime` or `this` (for example `RadioState(runtime, this, ...)`, `SerialState(runtime, this)`, `ControlMessageState(this)`) should take the state object, not the view-capable board.
5. **`ensureHardwareVersion`** is the one state operation that also pokes the view.
   - Make it a state method that sets `hardwareVersion` and calls `invalidateView()`.
   - The DOM `MicroBitBoardSvg` already reads `hardwareVersion` and re-renders on `updateState`, so no view-side change is needed beyond the event plumbing.

### Accessors in `pxt-microbit/sim/dalboard.ts`

```ts
export function boardState(): DalBoardState {   // new, DOM-free (core)
    return runtime.boardState as DalBoardState;
}
export function board(): DalBoard {              // existing, DOM side
    return runtime.board as DalBoard;
}
```

Rule: **everything under `state/` uses `boardState()`. Only code that needs `viewHost`, `view`, or visuals uses `board()`.** Moving `boardState()` to core and leaving `board()` in the DOM bundle lets the compiler enforce this.

### Which `board()` calls can become `boardState()`

There are roughly 84 `board()` call sites in `pxt-microbit/sim`. Based on the members each one touches:

**Replace with `boardState()` (essentially all of them):**
- `state/accelerometer.ts`, `compass.ts`, `buttonpair.ts`, `lightsensor.ts`, `thermometer.ts`, `ledmatrix.ts`, `serial.ts`, `flashlog.ts`, `misc.ts`, `audio-samples.ts`, `record-audio.ts`, `filesystem.ts`, `midi.ts`.
  - These only touch component states, `bus`, `writeSerial`, `runOptions`, `speakerEnabled`, and so on.
- `edgeconnector.ts`, except the headphone lookup (see below).
- `music.ts`, `logotouch.ts`, `flashlog.ts`. These call `ensureHardwareVersion(2)`, which works as a state method per step 5.
- `dalboard.ts`: `parsePinString`, and `postError` (which uses `ledMatrixState`).

**Must stay on `board()` (or be refactored):**
- `state/edgeconnector.ts` line ~202: `board().viewHost.getView().querySelector("g.sim-headphone-cmp")` is direct DOM access.
  - Refactor to a state flag (for example `headphoneConnected`, set by the view) or an `isHeadphoneConnected()` callback registered by the view. Then the call site uses `boardState()`.
- `visuals/microbit.ts` (2 `board()` calls and `this.board.updateSubscribers`/`hardwareVersion`): it is view code, so it stays in pxtsim.
- `DalBoard.initAsync`, `screenshotAsync`, `kill`: view-side by definition.

### Same pattern in `pxt-common-packages`
The common-packages sim has its own `board()` helper and its own `CoreBoard` subclasses (for example `EventBusBoard`, `CommonBoard`). Audit it with the same rule: introduce `boardState()` returning the state, and keep `board()` for the view. Note that those packages implement interfaces such as `EventBusBoard`, `LightBoard`, and `CommonBoard`, which will need to be redeclared against the state type.

### Migration steps
1. In pxt, add `BaseBoardState` and `CoreBoardState` plus `runtime.boardState`, with `BaseBoard`/`CoreBoard` delegating to them. This is non-breaking.
2. Introduce `DalBoardState` and `boardState()` in pxt-microbit, with `DalBoard` delegating (or exposing getters) during the transition. This is non-breaking.
3. Mechanically replace `board()` with `boardState()` in `state/*.ts` (a one-pass codemod; it is only 20 files). Review the two exceptions above.
4. Move the state files into the core compile (`pxtsimcore` equivalent for the target) and confirm there are no DOM references with the DOM-free tsconfig.
5. Remove the delegating getters once nothing uses them, and run the microbit and common-packages simulator tests.

### Risks
- **Constructor cycles:** `new BusEvent(runtime, this)` and the `RadioState(runtime, this, ...)` family assume the board has everything. Convert them to depend on the narrower state interface.
- **External targets:** other targets subclass `CoreBoard` and call `board()`. Keep the old names working through the migration, with deprecation comments.
- **`hardwareVersion` timing:** `initAsync` sets it from `msg.builtinParts` before the view is built, so the state must be initialised before the view is created.

## Splitting `simdriver.ts` (frame orchestration vs. DOM)

### Context
`SimulatorDriver` (about 1,140 lines) runs in the **editor**, not in the simulator frame. It can't move to `pxtsimcore` as-is, but a large part of it is policy that does not need the DOM. Separating that policy from the iframe handling makes it testable without a browser and lets other hosts (headless, Node tests, non-iframe embedding) reuse it.

### What's mixed in today

| Concern | Where in `simdriver.ts` | DOM-free? |
|---|---|---|
| Lifecycle state machine (`Unloaded`, `Stopped`, `Pending`, `Starting`, `Running`, `Paused`, `Suspended`) and transitions in `setState`, `stop`, `suspend`, `unload`, `run`, `restart` | `setState`, `stop`, `suspend`, `run`, `start` | Yes, except the `setFrameState` and `freeze` side effects |
| **When to spin up a simulator**: secondary board for broadcast messages, extension or legacy message-simulator frames, restart if `runid` is stale, "don't start extra frames in multi-editor mode", single-simulator mode, jacdac dropping | `postMessage` (~150 lines), `startFrame`, `start` | Mostly yes, since the decisions depend on message type, channel, frame count, and run id |
| Message routing: who receives a message, who is skipped (source frame, jacdac to non-main frames), recorder "start only one", deferred messages until a frame finishes loading | `postMessage`, `postDeferrableMessage`, `handleDeferredMessages` | Yes |
| Run message construction and per-frame theme and id assignment | `run`, `startFrame` | Yes |
| Origin allow-listing and sim/extension URL computation | constructor, `getSimUrl`, `createFrame`, `setRunOptionQueryParams` | Mostly (needs a base origin passed in, not `window.location`) |
| Debugger protocol (breakpoints, resume, variables, trace interval) | `resume`, `setBreakpoints`, `handleDebuggerMessage`, `postDebuggerMessageAsync` | Yes |
| Frame cleanup timer, aspect ratio, loaned simulator, hide/unhide | `scheduleFrameCleanup`, `applyAspectRatio*`, `loanSimulator`, `hide`, `unhide` | No (layout and DOM) |
| iframe/DOM: `createFrame`, `simFrames`, `mainFrame`, `freeze`, `setFrameState`, `document.getElementById`, `window.addEventListener('message')`, `contentWindow.postMessage` | scattered | No |

### Proposed design
Introduce a **frame abstraction** so the policy code manipulates handles, not `HTMLIFrameElement`:

```ts
interface SimFrame {                // opaque handle, DOM implementation wraps an iframe
    id: string;
    messageChannel?: string;        // set for extension / message simulators
    runId?: string;                 // last run started in this frame
    runtimeId?: string;
    permanent?: boolean;
    loading: boolean;
    origin: string;
    isLoaned?: boolean;
}

interface SimFrameHost {            // implemented by the DOM layer
    frames(skipLoaned?: boolean): SimFrame[];
    createFrame(url: string, opts: { messageChannel?: string; permanent?: boolean; aspectRatio?: number }): SimFrame;
    removeFrame(frame: SimFrame, onComplete?: () => void): void;
    post(frame: SimFrame, msg: SimulatorMessage): void;
    setFrameAppearance(frame: SimFrame, state: SimulatorState, opts: { autoRun: boolean }): void;
    setAspectRatio(frame: SimFrame, ratio: number): void;
    freeze(value: boolean): void;
    // parent / dependent editors
    postToParent(msg: SimulatorMessage): void;
    postToDependentEditors(msg: SimulatorMessage, except?: unknown): void;
    environment(): { origin: string; isLocalHost: boolean; locationHref: string };
}
```

**`pxtsimcore`: `SimulatorCoordinator`.** It owns the policy and has no DOM:
- State machine and `setState`.
- `run`, `start`, `stop`, `restart`, `suspend`, `unload`, and `mute`.
- Run-message construction (`_currentRuntime`, `frameCounter`, theme rotation, `runId`).
- **Spin-up decisions**: given an incoming broadcast message, return an action the host performs, or perform it through `SimFrameHost`. This covers extension frame, legacy message sim, secondary board, restart stale frame, single or multi-editor suppression, jacdac filtering, and the cap of two board frames.
- Message routing (`recipients(msg, source)`), recorder single-start, and deferred message queue.
- Debugger protocol and trace interval.
- Allowed-origin checks (`isOriginAllowed`), driven by `environment()`.

**`pxtsim`: `DomFrameHost`**, which implements `SimFrameHost`, plus the existing public `SimulatorDriver` as a thin façade:
- `createFrame` (iframe, wrapper div, loader/icon, sandbox attributes, localization), `simFrames`, `mainFrame`, `freeze` overlay, `setFrameState` icon and class updates, aspect-ratio padding, frame cleanup timer, `loanSimulator`/`unloanSimulator`, `hide`/`unhide` and the `removeElement`/`revealElement` options, `window.addEventListener('message')`, and `contentWindow.postMessage`.
- `SimulatorDriver` keeps its **exact public API** (`run`, `stop`, `restart`, `postMessage`, `preload`, `resume`, `setBreakpoints`, and so on) and just constructs a `SimulatorCoordinator` with a `DomFrameHost`, so webapp, kiosk, multiplayer, and the target repos don't change.

### What makes this hard
1. **State stored in the DOM.** The code uses `frame.dataset` as its database (`runid`, `runtimeid`, `loading`, `origin`, `messagechannel`, `aspectratio`, `permanent`). These move to `SimFrame` fields, and the DOM host stores a back-reference from each `SimFrame` to its element.
2. **`frames = this.simFrames(); // refresh`** after creating frames inside `postMessage`. The coordinator needs `host.frames()` to stay consistent after `createFrame`.
3. **`source: Window` identity** is used to find the source frame and to avoid echoing. Make it an opaque `source` token that the host maps to a `SimFrame` (`host.frameForSource(source)`).
4. **Side effects hidden in state changes.** `setState` currently calls `freeze` and `setFrameState` for every frame. Route these through the host.
5. **Ordering.** `startFrame` calls `setFrameState`, aspect ratio, and trace interval in a specific order, so keep the sequencing in one place.

### Suggested sequence
1. **Characterize first.** Add unit tests for the spin-up logic using a fake `SimFrameHost` (secondary frame creation, extension reuse and restart, single-simulator mode, jacdac drop, deferred messages). There is currently no DOM-free way to test this.
2. Introduce `SimFrame` and `SimFrameHost` inside `simdriver.ts`, with an iframe-backed implementation, and refactor in place. No file moves; behavior is unchanged.
3. Extract the coordinator into a separate file in `pxtsim`. Verify the DOM-free tsconfig compiles it.
4. Move the coordinator to `pxtsimcore` (or its own package) once step 1 of the main plan exists.

### Does this need to be in `pxtsimcore`?
Not necessarily. The runtime side (the VM, boards, `Runtime`, `Embed`) is what runs in the simulator frame and is the primary reason for the DOM-free split. The coordinator is useful for testing and alternate hosts, but it is **editor-side**. Consider a second DOM-free module, such as `pxtsimdriver-core`, rather than bundling it into `pxtsimcore`, so frames and the runtime don't share a bundle.

## Open questions

- **Namespace:** Should core keep the `pxsim` namespace (recommended, for compatibility), or become something like `pxsimcore`?
- **Publishing:** Should `pxtsimcore` be a separate npm artifact, or only an internal build layer?



