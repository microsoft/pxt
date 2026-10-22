# Plan: split `pxtsimcore` (DOM-free) from `pxtsim` (DOM)

## Key constraint

`pxtsim` is built as a single `outFile` (`built/pxtsim.js`) in the `pxsim` namespace. It is consumed by the webapp, the simulator frame, and the target repos (`pxt-common-packages/sim`, `pxt-microbit/sim`) through globals and `built/pxtsim.d.ts`. To avoid breaking consumers, keep the **`pxsim` namespace and the existing `pxtsim.js` bundle** and make it a superset of the core.

## Target layout

- **`pxtsimcore/`** builds `built/pxtsimcore.js` and `.d.ts`.
  - Its tsconfig has `lib: ["es2017", "ES2018.Promise"]` with **no `dom`**, so the compiler enforces DOM-freedom.
- **`pxtsim/`** builds `built/pxtsim.js`.
  - For compatibility it remains the existing complete bundle while the source split is in progress.
  - The two bundles must not be loaded together yet: `pxtsim.js` still contains the core sources, so concatenating/loading `pxtsimcore.js` too would duplicate namespace initialization.
  - Once the DOM-only source split is complete, the build can compose core and DOM outputs into the legacy bundle.

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
   - Added [pxtsimcore/tsconfig.json](../pxtsimcore/tsconfig.json) (no `dom` lib, `types: []`) over the candidate core files, plus [pxtsimcore/globals.d.ts](../pxtsimcore/globals.d.ts), which declares only host-agnostic globals (timers, `console`, `performance`, `TextEncoder`/`TextDecoder`).
   - The initial config was `noEmit`; step 6 now emits the core bundle and declarations. Use `node_modules/.bin/tsc -p pxtsimcore/tsconfig.json --noEmit` for a check-only run.
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

### Progress: step 2, host abstractions (done) — 59 → 31 errors

- `host.ts` (core): `pxsim.host.Environment` (`postToParent`, `locationHref`, `isPxtElectron`, `isIpcRenderer`, `frameId`) with inert defaults and `setEnvironment`.
- `domhost.ts` (DOM): installs the browser environment at load time.
- `domutils.ts` (DOM): `U.containsClass/addClass/removeClass/remove/removeChildren/clear` moved out of `runtime.ts`. Namespace merging keeps `pxsim.U.*` unchanged for pxt-microbit and pxt-common-packages.
- `runtime.ts`: `isPxtElectron`, `isIpcRenderer`, `isLocalHost`, `Runtime.postMessage` and the `Embed.frameid` uses go through `host`. `Embed.frameid` is kept for compatibility.

### Progress: step 4, audio split (done) — 31 → 17 errors

- `sound/audiohost.ts` (core): `pxsim.audiohost.AudioHost` (`stopAll`, `mute`, `playInstructionsAsync`, `playPCMBufferStreamAsync`, `setListenerPosition`, `disposeAllSpatialAudioPlayers`, `createMetronome`) plus `Metronome`/`SpatialAudioPlayer` interfaces and the preview-data types. Defaults are silent no-ops.
- `sound/audiohostdom.ts` (DOM): registers the Web Audio implementation (`AudioContextManager`, `music.Metronome`).
- `sequencer.ts`, `soundexpression.ts`, `runtime.ts`, `embed.ts` call `audiohost.audio()` instead of `AudioContextManager`. `AudioContextManager.SoundPreviewCallback` and friends are now aliases, so the public API is unchanged.

### Progress: step 5, remove remaining DOM type leaks (done) — 17 → 0 errors

- `pxtsimcore/globals.d.ts` now declares only the `ImageData` fields used by core (`width`, `height`, `data`).
- `CoreBoard`'s builtin visual factory return types are loosened to `any`, keeping the DOM-free runtime independent of SVG visual interfaces.
- `SimulatorInstructionsOptions` is now declared with core message types, and DOM-side `instructions.RenderPartsOptions` extends it.
- DOM-independent debugger helpers (`getWarningMessage`, heap inspection, and breakpoint message generation) moved to `debugcore.ts`; `debugger.ts` remains in the regular `pxtsim` build but is excluded from the core check because its session/driver layer uses `HTMLElement`.
- `pxtsimcore/tsconfig.json` includes `debugcore.ts`, not `debugger.ts`.

The DOM-free type-check now passes with zero diagnostics:
`node_modules/.bin/tsc -p pxtsimcore/tsconfig.json`.

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

6. **Update the build.** 🚧 In progress.
   - Add a `pxtsimcore` task in `gulpfile.js`; once the DOM-only project consumes core output, establish the required build order.
   - Wire it into the existing lists that mention `built/pxtsim.js` (around lines 117, 142, 153, 474, and 804).
   - Concatenate `pxtsimcore.js` before `pxtsim.js`, or have `pxtsim` emit both.
   - Add the package to the watch task and the lint task.
   - Update the `.d.ts` copy and publish steps for the new `pxtsimcore.d.ts`.

### Progress: first build-pipeline milestone (done)

- `pxtsimcore/tsconfig.json` now emits declarations and targets `built/pxtsimcore.js`.
- Added a `pxtsimcore` gulp task that emits `built/pxtsimcore.js` and `built/pxtsimcore.d.ts`.
- The `pxtsim` TypeScript project now compiles only the DOM-side sources against `pxtsimcore.d.ts`, emitting `built/pxtsimdom.js` and `built/pxtsimdom.d.ts`.
- The `pxtsim` gulp task runs core first, compiles DOM sources, then composes core followed by DOM into the compatibility outputs `built/pxtsim.js` and `built/pxtsim.d.ts`. The standalone core declaration reference is removed from the composed declaration file.
- Wired the composed task into full builds, CLI builds, source watchers and the gulp exports. The pxtsim ESLint project list includes both the DOM and core tsconfigs so core source files remain lintable after the split; `pxtsimcore/globals.d.ts` is linted separately with the core tsconfig.
- Verified both project builds, the DOM-free `--noEmit` check, the composed declaration file, and Node loading of the compatibility bundle with neither `window` nor `document`. The Micro:bit simulator tsconfig also type-checks against the new output.
- The common-packages simulator's standalone tsconfig currently fails because its expected `node_modules/pxt-core/built/pxtsim.d.ts` is absent in this workspace. Its build needs to be rechecked in the normal package-linked target environment.

The remaining step-6 work is packaging/distribution of the separate `pxtsimcore` artifact if a consumer is introduced; current consumers continue to use the compatibility `pxtsim` outputs.

7. **Verify.**
   - Run `gulp` for the full build.
   - Run the existing tests and smoke-test the simulator in the browser.
   - Build `pxt-common-packages` and `pxt-microbit` against the new output to confirm the `pxsim` API is unchanged.
   - Optionally add a Node test that loads `pxtsimcore.js` with no `window` defined, to guard against regressions.

## Suggested ordering

Do steps 1–2 first, since they surface the full list of violations without moving files. Then split `runtime.ts` and the small utilities. Do the audio split last because it is the riskiest.

## Board state vs. board view (`DalBoard` split)

### Progress: preserve `board()` for state and add `boardView()` (initial step done)

- `DalBoard` remains the state object stored in `runtime.board` and returned by the existing `board()` helper.
- Added `DalBoardView` and `boardView()` in pxt-microbit. The view object owns the `BoardHost`, SVG view creation, screenshot implementation, DOM initialization, and listener cleanup.
- Added optional `Runtime.boardView: BoardView`; simulator startup, stop, screenshot, recording, thumbnail, and display-update paths now route view operations through it. `DalBoard` no longer exposes view lifecycle methods.
- Moved builtin visual factories and update subscribers from `CoreBoard`/`DalBoard` into `BoardView`/`DalBoardView`. `CoreBoard` retains only `builtinParts`; `BoardHost` receives visual factories in its options.
- Changed the headphone SVG lookup in `state/edgeconnector.ts` and the MicroBit view-update subscription in `visuals/microbit.ts` to use `boardView()`; state call sites remain on `board()`.
- Extracted component-state construction and state-only behavior into `DalBoardState` in `sim/state/dalboardstate.ts`. `DalBoard` remains a compatibility subclass returned by `board()`, while `DalBoardView` now depends on the state type.
- `ensureHardwareVersion()` queues a runtime display update instead of calling the view directly, so `DalBoardState` has no view dependency.
- Added an initial DOM-free target state project in `pxt-microbit/sim/tsconfig.core.json`. The source set passed a no-DOM compiler probe using the workspace-built pxtsimcore declarations and the live pxt-common-packages checkout.
- Moved `AnimationQueue` into `pxtsimcore`; it is simulation scheduling logic and does not require the DOM.
- Split `CommonNeoPixelState` and `LightBoard` declarations from the SVG implementation so state consumers no longer need to compile the mixed visual file.
- Kept recording and sample playback state on the compatibility `DalBoard` subclass because those implementations still use browser media and audio APIs; moving those host-backed features is separate audio work.
- `pxt-microbit/node_modules` is now linked to the workspace pxt and pxt-common-packages, and `tsc -p sim/tsconfig.core.json` passes (0 errors) against the real sources; the temporary `corehost.d.ts` shim is gone.
- `board()`, `boardView()`, and `DalBoard` moved to the DOM-free `sim/state/boardaccess.ts`. `boardView()` returns `DalBoardViewContract` (`addUpdateSubscriber`, `setAudioPinEnabled`), which `DalBoardView` implements. The core compile also uses the real `state/misc.ts` and `base/sim/control.ts`.
- Moved the neopixel state functions (`neopixelState`, `sendBufferAsm`, `light.sendBuffer`) from `pxt-common-packages/libs/core/sim/neopixel.ts` into `neopixelstate.ts`, leaving only the SVG view in `neopixel.ts`.
- `state/hostglobals.d.ts` declares only `setTimeout`, `clearTimeout`, and `console` (the same host-agnostic globals as `pxtsimcore/globals.d.ts`) for the core compile.
- Extended `audiohost.AudioHost` with tone, stop, tone gain, stop-all subscription, mute query, audio-element activity, MIDI, sample playback, and an `AudioElementHandle` for recorded audio. `audiohostdom.ts` forwards these to `AudioContextManager`; without a host they are silent no-ops.
- `edgeconnector.ts`, `audio-samples.ts`, and `midi.ts` now use `audiohost.audio()` and are in the core target compile. The headphone-disabled SVG moved to `DalBoardView.setAudioPinEnabled`. `samplesState` moved onto `DalBoardState`.
- Recording is split: `record-audio.ts` is DOM-free and talks to a `record.RecorderHost` / `RecordingSession` interface; `record-audio-dom.ts` supplies the MediaRecorder/getUserMedia implementation (and Safari/Firefox quirks). `recordingState` moved onto `DalBoardState`, `DalBoard` is now an empty compatibility subclass, and `record-audio.ts` and `music.ts` are in the core target compile.
- Where files go: DOM-free generic files from `pxtsim/` go into `pxtsimcore`. Target files stay in the target repo and are added to its `tsconfig.core.json`.

### Progress: move visual registries and lifecycle to `boardView()` (done)

- Added a host-neutral `BoardView` contract and optional `Runtime.boardView`.
- Runtime display updates, screenshots, recording, thumbnails, simulator start, and stop now use `runtime.boardView`; board state retains the run options, message/event bus, parts, and audio cleanup.
- Moved builtin visual factory maps and update subscribers off `CoreBoard` and onto `DalBoardView`; `BoardHost` receives visual factories explicitly.
- `DalBoard` no longer exposes screenshot or view lifecycle methods. `boardView()` is backed by `runtime.boardView`.
- Removed the obsolete no-op `BaseBoard.updateView()` method so the state-facing board no longer advertises a view operation.
- Component-state construction now lives in `DalBoardState`, separate from `DalBoardView`; hardware-version changes use the runtime display-update queue as the state-to-view invalidation path.

### Why
`BaseBoard` and `CoreBoard` in `pxtsim/runtime.ts` and the original `DalBoard` implementation mixed **simulation state** with **view/DOM**. The initial split now keeps `board()` state-facing and provides `boardView()` for target view operations. Component-state construction is separated into `DalBoardState`; the remaining goal is to move more of the generic state foundation and target state dependencies into the DOM-free `pxtsimcore` boundary.

### What is mixed in today

| Concern | Members |
|---|---|
| **State (DOM-free)** | `bus`, `id`, `runOptions`, `storedState`, `setStoredState`, `writeSerial`, `receiveMessage`, `addMessageListener`, `builtinParts`, and component state including `ledMatrixState`, `edgeConnectorState`, `serialState`, `accelerometerState`, `compassState`, `thermometerState`, `lightSensorState`, `buttonPairState`, `radioState`, `microphoneState`, `lightState`, `fileSystem`, `logoTouch`, `speakerEnabled`, `controlMessageState`, `neopixelState()`, `tryGetNeopixelState()`, and `hardwareVersion` |
| **Host-backed state (not yet in core)** | `recordingState` (`MediaRecorder`, `MediaStream`, `HTMLAudioElement`) and `samplesState` (audio playback through the browser audio implementation) |
| **View (DOM)** | `DalBoardView.viewHost` (`visuals.BoardHost`), `view` (`SVGElement`), `builtinVisuals`, `builtinPartVisuals`, update subscribers and `updateView`, `screenshotAsync` (canvas), DOM initialization, view cleanup, and mute-button side effects |

Component states are constructed with `builtinParts[...]` entries, but `builtinParts` itself is just a map of state objects. It is DOM-free and belongs with the state.

### Proposed split

1. **`pxtsimcore`: `BaseBoardState` and `CoreBoardState`.**
   - Hold `id`, `bus`, `runOptions`, `storedState`, serial buffering, message listeners, `builtinParts`, and a `onViewInvalidated` event (replacing `updateSubscribers`).
   - `updateView()` becomes `invalidateView()`, which just raises that event and has no DOM knowledge.
2. **`pxtsim`: `BaseBoard` and `CoreBoard` (state side).**
   - Keep `runtime.board` as the state accessor and expose optional `runtime.boardView` for view lifecycle operations.
   - `CoreBoard` keeps `builtinParts`; its view factory maps and update subscribers live on the view contract.
   - The DOM host initializes, updates, screenshots, and cleans up through `runtime.boardView`.
3. **`pxt-microbit`:**
   - Keep `DalBoard` as the state object returned by `board()`, preserving target and package call sites; it extends `DalBoardState`.
   - Add a distinct `DalBoardView`, returned by `boardView()`, to own `viewHost`, `view`, DOM initialization, screenshots, view cleanup, visual factories, and update subscribers.
   - Keep component-state construction in the DOM-free `DalBoardState`.
4. **Runtime wiring.**
   - Keep `runtime.board` as the state object for compatibility and use `runtime.boardView` for view operations; do not change state callers to a new `boardState()` name.
   - `BareBoard` and `initBareRuntime` only need a state object.
   - Constructors that currently take `runtime` or `this` (for example `RadioState(runtime, this, ...)`, `SerialState(runtime, this)`, `ControlMessageState(this)`) should take the state object, not the view-capable board.
5. **`ensureHardwareVersion`** changes state and queues a runtime display update; the runtime delivers the update through `boardView()`.
   - The DOM `MicroBitBoardSvg` already reads `hardwareVersion` and re-renders on `updateState`.

### Accessors in `pxt-microbit/sim/dalboard.ts`

```ts
export function board(): DalBoard {             // existing state accessor
    return runtime.board as DalBoard;
}
export function boardView(): DalBoardView {     // new view accessor
    return runtime.boardView as DalBoardView;
}
```

Rule: **keep `board()` for state access. Use `boardView()` only for `viewHost`, `view`, screenshots, DOM initialization, and cleanup.** This minimizes source churn while making accidental view access visible.

### Which `board()` calls need `boardView()`

Most of the roughly 84 `board()` call sites in `pxt-microbit/sim` already access state and should remain unchanged.

**Keep on `board()` (state):**
- State files and runtime APIs using component state, `bus`, `writeSerial`, `runOptions`, `speakerEnabled`, and `ensureHardwareVersion`.
- `dalboard.ts` state initialization, `parsePinString`, and `postError`.

**Use `boardView()` only for view interactions:**
- `state/edgeconnector.ts`: headphone SVG lookup (`viewHost.getView().querySelector(...)`).
- `DalBoardView.initAsync`, screenshot, cleanup, update subscribers, and visual factories.
- `visuals/microbit.ts` continues to access board state for sensor and input state. Its visual instance itself remains view code.

### Same pattern in `pxt-common-packages`
The common-packages sim has its own `board()` helper and its own `CoreBoard` state interfaces (for example `EventBusBoard`, `CommonBoard`). Keep `board()` as state access there; add a view accessor only if view code in that target needs one. The broad call-site review found no direct `viewHost`, `view`, screenshot, or visual-factory access through `board()`. Inspect these two indirect/dynamic call sites during the state/view split:

- `pxt-common-packages/libs/screen/sim/state.ts:134-139`: `ScreenState.updateStats()` casts `board()` to `any` and invokes optional `updateStats()`. Inspection: neither pxt-common-packages nor pxt-microbit defines `updateStats` on a board (it is only a `//% shim=pxt::updateStats` in the screen targetoverrides), so it is implemented by an arcade-style board outside these repos. It only updates a stats overlay, so it is view-only. Microbit is unaffected (no-op because `b.updateStats` is undefined). Resolution: when investigating pxt-arcade, move it to `boardView()` (optional `updateStats`).
- `pxt-common-packages/libs/game/sim/multiplayer.ts:184`: multiplayer input handling casts `board()` to `any` and invokes `handleKeyEvent()`. Inspection: no definition of `handleKeyEvent` exists in pxt-common-packages or pxt-microbit; it is only reached through the `any` cast, and only for the multiplayer "server" origin, so it is an arcade board method. It injects simulated key input, so it is simulation behavior and should stay on `board()` as an optional state-side interface (for example `KeyEventBoard`) once the arcade board is inspected.

### Migration steps
1. In pxt, add `BaseBoardState` and `CoreBoardState`, preserving `runtime.board` as the state-facing compatibility accessor.
2. In pxt-microbit, keep `DalBoard`/`board()` as state access and introduce `DalBoardView`/`boardView()` for view-only operations.
3. ✅ Move view fields, visual registries, update subscriptions, and lifecycle operations to the view object; leave state call sites on `board()`.
4. Incrementally move state files into the core compile (`pxtsimcore` equivalent for the target) and confirm there are no DOM references with the DOM-free tsconfig. Keep browser media and audio state on the host side until its interfaces are separated.
5. Remove remaining compatibility hooks once nothing uses them, and run the microbit and common-packages simulator tests.

### Follow-up work after Micro:bit refactor and testing

- Investigate the `pxt-arcade` simulator's board/state/view architecture and DOM dependencies.
- Determine whether `pxt-arcade` can use the same `pxtsimcore` boundary and `board()` state / `boardView()` view pattern.
- Do this investigation only after completing and validating the `pxt-microbit` refactor.

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
   - **Done:** `tests/simdriver-test/simdriverrunner.ts` already had a fake DOM and hide/unhide and jacdac tests (upstream #11640). Added a "broadcast routing" suite (29 tests) against the current `SimulatorDriver` using the same fake DOM: secondary board frame spin-up and deferral, single-simulator and single-run suppression, the two-board-frame cap, stale-run restarts, simulator extension spin-up (origin, language, permanent, aspect ratio) and restart, legacy message simulator URL substitution and precedence, `nestedEditorSim` and `toParentIFrameOnly` suppression, dependent editors and parent window forwarding, the hardware debugger path, frame-id targeting, and one-recorder-only. The suite passes against unchanged driver code. It still drives the DOM driver through the fake DOM rather than a `SimFrameHost`; it carries over to the extraction unchanged.
2. Introduce `SimFrame` and `SimFrameHost` inside `simdriver.ts`, with an iframe-backed implementation, and refactor in place. No file moves; behavior is unchanged.
   - **Done:** `pxtsim/simframe.ts` defines the DOM-free `SimFrame` / `SimFrameHost` types; `pxtsim/simframedom.ts` has the iframe-backed `DomSimFrameHost` (frame state still lives in `dataset`, loan/unloan stay in the DOM host). `simdriver.ts` no longer touches `dataset`, iframes, or wrapper elements except via the host. All 46 driver tests pass; they only needed two internal-access tweaks (`deferredMessages` now holds `SimFrame`s).
3. Extract the coordinator into a separate file in `pxtsim`. Verify the DOM-free tsconfig compiles it.
   - **Done (in `pxtsimcore`, not a separate bundle):** `pxtsim/simcoordinator.ts` holds the DOM-free `SimulatorCoordinator` (all routing, run, debugger and state logic) plus `SimulatorCoordinatorOptions` and a `SimEnvironment` interface (origin, href, parent window, dependent-editor liveness, configured sim URL, message listener). `pxtsim/simdriver.ts` is now a thin `SimulatorDriver extends SimulatorCoordinator` that builds a `DomSimFrameHost` and a `DomSimEnvironment`, adds the loan methods and the element callbacks in `SimulatorDriverOptions`; its public API is unchanged. `URL`/`URLSearchParams` were declared in `pxtsimcore/globals.d.ts`. Driver tests (46), lint, pytraces, and webapp/pxtrunner type-checks pass.
4. Move the coordinator to `pxtsimcore` (or its own package) once step 1 of the main plan exists.

### Does this need to be in `pxtsimcore`?
Not necessarily. The runtime side (the VM, boards, `Runtime`, `Embed`) is what runs in the simulator frame and is the primary reason for the DOM-free split. The coordinator is useful for testing and alternate hosts, but it is **editor-side**. Consider a second DOM-free module, such as `pxtsimdriver-core`, rather than bundling it into `pxtsimcore`, so frames and the runtime don't share a bundle.

## Headless simulator tests (`pxt simtest`)

**Goal.** Run a compiled MakeCode program in Node against a target's real simulator state (for Micro:Bit, `DalBoardState` and its peripherals) with no browser, and assert on the outcome. This is the first automated test that exercises target simulator code; today `tsc` proves only that the core files are DOM-free in type terms.

**What exists.** `pxt run` already compiles to JS and calls `runCoreAsync` (`cli/cli.ts`), which sets `pxsim.initCurrentRuntime = pxsim.initBareRuntime` and runs a `pxsim.Runtime` with a `BareBoard`. It has only `basic.pause`/`showNumber`/`serial`, so no target code runs. `pxtsimcore` has no DOM, and the Micro:Bit core compile (`sim/tsconfig.core.json`) lists the DOM-free state files but only type-checks them (no emit).

**Design.**
1. **Core bundle per target.** Give the target core config an emit (`outFile: ../built/simcore.js`, declarations not needed). It holds the DOM-free state classes plus a small headless entry, for Micro:Bit `initRuntimeWithDalBoardState()`, which creates a `DalBoard` (an empty subclass of `DalBoardState`) with no `boardView`, sets `runtime.board`, and registers `runtime.postError`. `boardView()` must stay unused on this path; any code that needs it fails with a clear "view not available headless" error.
2. **Bundle contract.** The bundle sets `pxsim.initHeadlessRuntime` (new, optional, declared in `pxtsimcore`). The CLI uses it when present, otherwise falls back to `initBareRuntime`. Optionally it also sets `pxsim.headlessSnapshot()`, returning JSON of observable board state (LED image, pin values, serial buffer), for state assertions.
3. **CLI command.** `pxt simtest [file|dir ...]` (target-side `pxt simtest tests/sim`), implemented by refactoring `runCoreAsync` into `runHeadlessAsync(compileResult, opts)`, which returns `{ messages, errors, serial, snapshot, timedOut }`:
   - compile each test with `buildCoreAsync` (JS only, no native build, so no yotta or cloud);
   - load `pxtsimcore.js` (core) and then the target's `built/simcore.js` into the Node process. `pxtsimcore` needs the globals tests already set up (`pxt`, `ts`), and nothing else;
   - run until the top-level code finishes **and** the runtime has no pending timers or `forever` loops, or until `--timeout` (default 5s), then `Runtime.kill()`;
   - exit non-zero on the first failure. Print one line per test: `ok`/`FAIL`, name, and for failures the diff.
4. **Test format.** A test is a plain `.ts` (or `.py`) program. Pass means no runtime error and no failed `control.assert`. Optional expectations are leading comments, parsed by the command: `// @serial: line` (in order), `// @snapshot: path = value` (v2). This keeps tests readable in the editor and compilable in the real build, like `tests/compile-test`.
5. **Coverage rule.** A test can only call sim functions that are in the core compile. Calls into view-only shims (screen drawing, neopixel SVG, and so on) throw. Grow the core list as more state files are made DOM-free; a test that needs a missing one is a signal to split that file.

**Phases.**
1. *Prove pxtsimcore is DOM-free at runtime.* In `pxt/tests`, a mocha test loads `built/pxtsimcore.js` in a `vm` context that has no `window`, `document` or `navigator`, and runs a `Runtime` with the bare board. This also catches top-level code that touches the DOM and was never flagged because `tsc` allows it through `any`. No CLI work yet.
   - **Done:** `tests/simcore-test/simcorerunner.ts` (`gulp testsimcore`, also in `testAll`) loads only `built/pxtsimcore.js` into a Node `vm` context that has no `window`, `document`, `navigator` or `location`, checks those are undefined, then compiles a program with pxtc and runs it on the bare board in that context. Caveat found: the full `pxtsim.js` also *loads* in such a context (its DOM use is inside functions), so loading alone proves little; the run is what guards against DOM use in the runtime path. The guard grows with phases 2 to 4.
2. *Core bundle emit for Micro:Bit.* Emit `built/simcore.js`; add the headless init; load it in a `vm` context and call `initHeadlessRuntime`. Check that `DalBoardState` constructs with no DOM. Expected trouble spots: constructors that touch the view, and `/// <reference>` ordering of the concatenated output (as with `record-audio-dom.ts` and `sim.js`).
3. *`pxt simtest`.* Refactor `runCoreAsync`, add the command, `--timeout`, `--json` for CI, and the `@serial` expectations. Unit-test it in `pxt` with a toy target.
4. *Micro:Bit tests.* Add `tests/sim/` programs: LED matrix, buttons via `control.raiseEvent`, serial, accelerometer, music/audio host (a recording fake `AudioHost`), and recording with a fake `RecorderHost`. These are the paths I changed and could only type-check.
5. *CI.* Run `pxt simtest tests/sim` in the target's workflow (alongside `testghpkgs`), and `gulp testsimcore` in pxt's `testAll`.

**Risks and open questions.**
- Whether the real `DalBoardState` constructor can run without a view (`edgeconnector`, `microphone`, `radio` take the board in their constructors). Phase 2 answers this.
- Timers: the runtime uses real `setTimeout`. If tests are slow, add a fake-clock hook behind `U.nextTick`/`setTimeout` rather than sleeping.
- Multi-target: arcade and others would opt in by emitting their own `simcore.js`; the command must tolerate a target without one.
- `pxt testdir` in a target currently crashes (`installAsync()` called without `parsed`; see the test investigation). It is a separate bug and not required here, but `simtest` must not depend on `installAsync`.

## Open questions

- **Namespace:** Should core keep the `pxsim` namespace (recommended, for compatibility), or become something like `pxsimcore`?
- **Publishing:** Should `pxtsimcore` be a separate npm artifact, or only an internal build layer?
