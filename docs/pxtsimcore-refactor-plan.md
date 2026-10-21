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

1. **Add a DOM-free type-check first (low risk).**
   - Create `pxtsimcore/tsconfig.json` without `dom`.
   - Point it at the candidate files and treat the errors as the work list. The list will include `Runtime.postMessage`, `U.isLocalHost`, and the `U.*Class` helpers.

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

## Open questions

- **Namespace:** Should core keep the `pxsim` namespace (recommended, for compatibility), or become something like `pxsimcore`?
- **Publishing:** Should `pxtsimcore` be a separate npm artifact, or only an internal build layer?
