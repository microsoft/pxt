# Plan: a typed input API for driving Micro:Bit programs in the simulator

## Goal

Let a test (or any tool driving a simulated program) send inputs to a MakeCode Micro:Bit program using the
same enums and types the user program sees, never raw DAL ids or `control.raiseEvent`:

```ts
// today
control.raiseEvent(DAL.DEVICE_ID_BUTTON_A, DAL.DEVICE_BUTTON_EVT_CLICK)

// wanted
sim.input.click(Button.A)
sim.input.shake()
sim.input.setTemperature(30)
```

It must work in `pxt simtest` (headless, see `pxtsimcore-refactor-plan.md`) and be reusable later by an
automated browser test or a "simulate inputs" UI.

## What exists today (findings)

- `Button` (`A=1, B=2, AB=3`), `Gesture`, `Rotation`, `Dimension`, `AcceleratorRange` etc. are `const enum`s in
  `pxt-microbit/libs/core/enums.d.ts`. A `Button` value already equals the DAL id (`DEVICE_ID_BUTTON_A = 1`), so
  no translation table is needed for A/B/AB, but the API should still map explicitly so the two can diverge.
- Sensor state lives in `DalBoardState` (`pxt-microbit/sim/core/`): `ledMatrixState`, `accelerometerState`
  (`Accelerometer.update(x, y, z)`), `thermometerState.temperature`, `compassState`, `lightSensorState`,
  `microphoneState` (an `AnalogSensorState`, `setLevel`), `logoTouch`, `edgeConnectorState` (pins), `radioState`,
  `serialState`.
- Buttons: `ButtonPairState` has `aBtn`, `bBtn`, `abBtn`; the pointer handlers in `buttonpairsim.ts` set `pressed` and
  raise `DEVICE_BUTTON_EVT_DOWN/UP/CLICK` through the `EventBus`. That logic is in a DOM file, so a program
  cannot reuse it headless without raising the events itself.
- Events and values reach user code only through `runtime`: `EventBus.queue(id, value)` (what `control.raiseEvent`
  calls), the state fields above, and incoming simulator messages (`serial`, `radiopacket`, ...) delivered via
  `Runtime.receiveMessage`.
- Tests currently run as TypeScript compiled together with a base project, so a test can call any shim that is in
  the program's compiled packages. The API can therefore be an ordinary package namespace.

## Design

### Two layers

1. **Sim-side input primitives (DOM-free).** One class per concern that applies an input to the board state and raises
   the matching events. Pointer handlers, tests and future tooling all call these, so there is one code path.
   Lives in `pxt-microbit/sim/core/` and joins `simcore.js`.
2. **Program-side API (typed, uses the shim enums).** A hidden namespace compiled into the test program that
   calls the primitives through shims. Tests use it directly; it is not shown in the toolbox.

A host-side (Node) driver is a later, optional third layer (see "Timing").

### Program-side API

A new namespace in `pxt-microbit/libs/core/` (or a separate `libs/sim-input` package a test project adds, so it
never ships in user projects): `//% blockHidden=true` / `//% advanced=true`, no `block=` attributes, no docs.
Name: `simulator` vs `simInput` is open (see questions); examples below use `sim.input`.

| Area | API (signature uses user-visible types) | Sim primitive |
|---|---|---|
| Buttons | `press(b: Button)`, `release(b: Button)`, `click(b: Button)`, `longClick(b: Button)` | `ButtonPairState`: set `pressed`, queue `DOWN`, `UP`, `CLICK`, `LONG_CLICK` using the button id; `Button.AB` presses A and B |
| Logo | `touchLogo()`, `releaseLogo()` | `logoTouch` |
| Gestures | `gesture(g: Gesture)`, `shake()` | set accelerometer so `isGesture` is true and queue the gesture event; or call `Accelerometer.update` with the vector for the gesture |
| Acceleration | `setAcceleration(x, y, z)` (milli-g) | `accelerometerState.accelerometer.update(x, y, z)`; `rotation`/`acceleration` shims then report it |
| Temperature | `setTemperature(c)` | `thermometerState.temperature` |
| Light | `setLightLevel(n)` | `lightSensorState.setLevel` |
| Compass | `setHeading(deg)`, `setMagneticForce(dim: Dimension, v)` | `compassState` |
| Sound | `setSoundLevel(n)` | `microphoneState.setLevel` |
| Pins | `setPinValue(p: DigitalPin \| AnalogPin, v)`, `pressPin(p: TouchPin)` | `edgeConnectorState.getPin(id)` `.value`/`.mode`, queue pin events |
| Radio | `receiveRadio(value)` / `receiveRadioString`, `setRadioGroup` | build a `radiopacket` message and call `runtime.receiveMessage` |
| Serial in | `receiveSerial(text)` | `serial` message into the runtime |
| Time | `advance(ms)` | see Timing |
| Observing | `led(x, y): boolean`, `ledBrightness(x, y)`, `screenText()` | read `ledMatrixState` (already testable via `led.point`) |

Rules:
- Parameters are the existing enums (`Button`, `Gesture`, `Dimension`, `DigitalPin`, `TouchPin`, `Rotation`) so
  the compiler checks values and tests read like user code.
- No parameter is a `DAL` constant; the mapping from enum to DAL id lives in one table in the primitive layer.
- Methods return immediately and only queue events; they do not wait for handlers. `sim.input.click(Button.A)`
  followed by `pause(1)` lets handlers run. A `...AndWait` variant is possible if tests need it.
- Unsupported inputs for the running hardware version (e.g. logo touch on v1) throw a clear runtime error rather than
  silently doing nothing.

### Shim wiring

- Declare shims in a `.d.ts`/`.ts` in the new namespace with `//% shim=simInput::press` etc.; implement
  `namespace pxsim.simInput` in a DOM-free file in `sim/core/`, which both `sim/tsconfig.core.json` and
  `sim/tsconfig.json` glob.
- The implementations call `board()` (never `boardView()`), so they run under `pxt simtest` in both default and
  `--core` mode.
- The shim namespace is only compiled when a project includes the package, so real user programs and the
  hex/native build are unaffected. Native builds must not reference it; the package is marked
  `"public": false` / simulator-only (`//% shim` with no C++ implementation, plus `//% simulator`-only guard) and is
  never added to `pxt.json` of shipped projects.

### Making the pointer path share the primitives

Refactor `ButtonPairView.attachEvents` (and the accelerometer/pin handlers) to call the same primitives instead of
duplicating the `pressed` + `bus.queue` logic. This guarantees that a test exercising `click(Button.A)` goes through
the code the real button uses, and removes the last DOM dependence on those state paths.

### Timing

`advance(ms)` is the open design point for the API, not for the clock: pxt's `pxsim.host` lets a host replace time
(`setClock`/`setTimers`/`setRng`), and `pxsim.host.createVirtualHost` is one that moves only when asked, with `advance(ms)`
and `runUntil(done)`.
- Simple option (phase 1): tests use `pause(ms)` in the program; inputs are queued by the program itself, so
  ordering is deterministic within the program's own scheduler. Virtual time.
- Later option: a host-side driver in `pxt simtest` that schedules `{ at: ms, input }` steps (from `// @input` comments or
  a sidecar JSON) and sends them as messages into the runtime on the virtual host, so inputs can arrive while the
  program is blocked and `advance(ms)` becomes a message to the driver. `simtest` runs on the virtual host, and
  busy loops yield on an instruction budget.

## Phases

1. **Primitives + buttons.** Extract button press/release/click from `buttonpairsim.ts` into a DOM-free
   `sim/core/siminput.ts`; add `Button` API and a test `tests/sim/input-buttons.ts` that replaces
   `control.raiseEvent(DAL...)` in the current `buttons.ts`. Verify the browser button still works (manual).
2. **Sensors.** Acceleration, gestures, temperature, light, compass, sound; tests for each that read the value
   back through the user-facing `input.*` APIs.
3. **Pins and logo.** Digital/analog/touch pins and logo touch, including hardware-version checks.
4. **Radio and serial in.** Message-based inputs.
5. **Docs and rollout.** Document the namespace in `pxt-microbit/tests/sim/README.md`; migrate existing tests off raw
   `control.raiseEvent`; add a lint-style check (grep in CI) that tests do not use `DAL.` directly.
6. **Optional: host-side scheduler** (Timing) and reuse from the browser simulator for a "simulate input" panel.

## Testing

- Each input has a `tests/sim/*.ts` program with `// @serial:` expectations that assert the user handler fired
  (or the sensor read back the set value).
- Negative tests: unsupported input on the hardware version, out-of-range values (clamped as the real DAL does).
- A small test in `pxt` is not needed; this lives entirely in `pxt-microbit` plus the `pxt simtest` runner.

## Risks

- **Enum drift:** `Button`/`Gesture` values equal DAL ids today by convention. Mitigation: the single mapping table
  plus a test that every enum member maps.
- **Gesture realism:** raising a gesture event without moving the accelerometer can leave `input.isGesture`
  inconsistent. Prefer driving gestures through acceleration vectors where possible.
- **Leaking into shipped projects:** keep the namespace in a package that is never a dependency of real projects, and
  check the native build output is unchanged.
- **Same names as user APIs:** avoid names that collide with `input.*`; a separate top-level namespace avoids this.

## Open questions

1. Namespace name: `sim.input`, `simInput`, or `testInput`?
2. Package location: inside `libs/core` (always available to tests, hidden) or a separate opt-in `libs/sim-input`?
3. Should the API also be exposed to the host (Node) side for scripted timelines, or is in-program use enough?
4. Is the "simulate inputs" browser panel a goal, which would justify building the primitives for UI reuse now?

---

# Addendum: loading other programs into their own simulators (`test.sim[id]`)

## Goal

A Static TypeScript program (the "test", which is itself the headless test runner's program) can start other MakeCode
programs in separate headless simulator instances, name each with an id, and drive and observe them with the input API
above. `test.sim` is a map from id to handle:

```ts
test.load("a", { share: "_abc123XYZ" })                      // share link / script id
test.load("b", { github: "owner/repo#v1.2.0" })              // github repo (optionally tag/branch)
test.load("c", { project: "libs/blocksprj" })                 // local project dir (CLI/tests)
test.load("d", { source: "led.plot(0, 0)" })                 // inline source

test.sim["a"].input.click(Button.A)
test.sim["b"].input.setTemperature(30)
console.log(test.sim["a"].led(0, 0) ? "on" : "off")
test.sim["a"].stop()
```

`test.sim` is a plain `Map<SimHandle>` (index signature on an object), not a namespace indexer, so `test.sim[id]` is valid
Static TypeScript. `test.load` also returns the handle, so `const a = test.load("a", ...)` works too.

## Where this runs (decided)

The scope is the **headless test runner**, not the browser editor. The test program is one headless runtime; every
program it loads is another headless runtime (own `vm` context and board). Programs never talk to each other and never
get a view. The runner is the only party that sees any message:

- Messages a child posts (`radiopacket`, `serial`, `bulkserial`, custom messages, errors) are **intercepted by the test
  runner**, which decides what to do: record them for the test to read, drop them, forward them to another child (for
  example to bridge radio between boards), transform them, or fail the test.
- Inputs flow the other way: the test program calls `test.sim[id].input...`, the runner turns that into a message
  to child `id`.

Because of this, the earlier browser design below is deferred. It is kept only as a possible later reuse of the same
protocol.

Original framing, kept for reference:

- **Headless (`pxt simtest`)**: the Node host owns every runtime. It compiles the requested program, creates a new
  `vm` context per id (the existing `runHeadlessAsync` already builds one), and routes calls to it.
- **Browser**: the host is `SimulatorCoordinator`/`SimulatorDriver`, which already manages multiple frames
  (`SimFrame`), a per-frame id (`frameId`) and message routing. A new "secondary simulator" is another frame with a
  program of its own; no new DOM abstractions are required beyond the existing `SimFrameHost`.

Both use one message protocol (below) so the controller code is identical.

## Design

### 1. Program-side API (controller)

A hidden namespace in the same opt-in package as the input API (names are open questions):

- `test.load(id: string, source: SimSource): SimHandle` loads and starts the program, registers it in `test.sim`, and
  returns the handle.
- `test.sim: Map<SimHandle>` holds all loaded simulators by id.
- `handle.waitUntilRunning()` blocks the fiber until the program has started or failed.
- `SimHandle` exposes: `input` (the input API, bound to this simulator), observers (`led`, `screenText`, `serialOutput`),
  `stop()`, `restart()`, `onSerial(handler)`, `onError(handler)`, and `onMessage(handler)` for raw messages the child posts.
- Message policy: `test.onMessage((id, msg) => ...)` and `test.forward(fromId, toId, filter?)` let the test decide
  what happens to messages a child posts. With no handler set, child messages are only recorded (default: nothing is
  delivered to any other simulator).
- `SimSource` is a tagged object: `{ share }`, `{ github }`, `{ project }`, `{ source }`, `{ json }` (files map), extensible.
- Ids are plain strings chosen by the controller; ids must be unique per runner: loading an id that is already in `test.sim` is an error
  (stop the old one first with `test.sim[id].stop()`, which frees the id). The host also keeps a generated frame id for the
  underlying context.

STS note: an indexer on a namespace is not valid TypeScript, so `sim` is a property holding a `Map<SimHandle>`. Still
verify that Static TypeScript compiles string-indexed access on it, and that `test` as a namespace name does not clash
with existing identifiers.

### 2. Host protocol

New simulator messages (typed in `pxtsim` DOM-free code, next to the `SimulatorMessage` types):

| Direction | Message | Purpose |
|---|---|---|
| controller → host | `{ type: "simload", id, source }` | create/replace simulator `id` |
| host → controller | `{ type: "simloaded", id, ok, error? }` | program compiled and started (or failed) |
| controller → host | `{ type: "siminput", id, input: { kind, ...args } }` | an input from the input API, addressed to `id` |
| controller → host | `{ type: "simstop", id }` | stop and dispose |
| host → controller | `{ type: "simevent", id, event: { kind: "serial" \| "error" \| "led", ... } }` | outputs the controller observes |
| child → host | any simulator message the child posts | intercepted by the runner; never delivered elsewhere unless the test forwards it |
| host → child | `{ type: ..., }` forwarded by the test | only what `test.forward` or `handle.send` chooses |

The input API from the first part must therefore have a serializable form (`{ kind: "click", button: 1 }`), so the same
primitive layer is reached either directly (in-program tests) or over a message (cross-simulator). The input
primitives take the target `DalBoardState`; the host picks the board for `id`.

### 3. Resolving and compiling a program

The host needs a "source → runnable JS" step. Existing pieces to reuse:

- Share link / id: `pxt.Cloud.downloadScriptFilesAsync(id)` (already used by `Package.loadAsync` in `pxtlib/package.ts`).
- GitHub: the existing `pxt.github` resolution (`user/repo#tag`) used for extensions.
- Local project dir (CLI/tests): `MainPackage.loadAsync` as `pxt simtest` does.
- Compile: `pxtc.compile` for JS (non-native `BuildOption.Run`) in the CLI; in the browser the pxtrunner/webapp compile
  path (`pxtrunner/runner.ts` `simulateAsync`/`buildSimJsInfo`).
- Sim bundle: must match the loaded program's target. If the loaded program targets a different target than the
  controller (for example arcade vs. micro:bit), the host has to load that target's bundle. V1: same target only, with
  a clear error otherwise.

The host exposes this as a `ProgramResolver` interface (`resolveAsync(source): Promise<{ js, files, target }>`)
so the CLI, the webapp and tests can each plug in their implementation and tests can supply a fake without the
network.

### 4. Headless implementation (`pxt simtest`)

- `simtest.ts` gains a `SimInstance` abstraction over one `vm` context + `Runtime`, a registry keyed by id, and a
  message router implementing the protocol above.
- The controller's own runtime has `postMessage` routed to the registry; messages for `id` are handled by calling the
  input primitives on that instance's board and queuing events.
- Time: all instances share the Node event loop. Deterministic cross-simulator timing uses the host clock seams
  (`pxsim.host`, see Timing in the first plan); `pxt simtest` runs on the virtual host.
- Safety: loading from the network in a test run must be explicit (`--allow-network`), with a resolver cache so repeated
  runs do not depend on the network; github/share loads are pinned to a tag or script id.

### 5. Browser implementation (deferred)

- `SimulatorCoordinator` gains an optional "child simulator" registry: id → `SimFrame` + run options. `simload` triggers
  compile through the resolver, then creates the frame (`SimFrameHost.createFrame`) with the compiled code.
- Routing: `siminput` messages are delivered to that frame only (the existing targeted-send path, as used for
  single-frame messages), and `simevent`s from the child frame are forwarded to the controller frame.
- UI: child simulators are shown stacked/side-by-side with their id as the label; stopping the controller disposes
  its children.
- Limits: a cap on the number of child simulators, and children do not recursively load others in V1.

## Security and robustness

- A program that can load arbitrary programs is a new capability. Gate it on the host: off by default in the editor
  (only enabled for the test/"autograder" scenarios), and never available to a program that runs in a shared/embedded
  context.
- Resolver allow-list for sources (share ids, pinned github refs); size and count limits; timeouts per child.
- Errors in a child never throw into the controller: they arrive as `simevent` errors and as a failed `whenReady`.

## Phases (after input API phases 1-2)

1. **Protocol + serializable inputs.** Define the messages and the serializable form of each input; the direct and
   messaged paths share the same primitives. Unit-test with a fake host.
2. **Headless registry.** `SimInstance` + registry in `cli/simtest.ts`; `test.load({ project })` and `{ source }`;
   `test.sim[id].input.click(Button.A)` and observers; the message interception hooks; test with two micro:bit
   programs where the test bridges radio between them.
3. **Resolver.** `ProgramResolver` with share-link and github implementations (CLI), cached; `--allow-network`.
4. **(Deferred) Browser coordinator support.** Child frames, routing, labels.
5. **Cross-target loads and polish.** Optional; docs and examples.

## Open questions

Decided: spelling is `test.sim[id]` with `sim` a map; the first (and only V1) consumer is the headless test runner;
children are headless and communicate only through messages the runner intercepts.

All resolved:

1. A duplicate id is an error; `stop()` releases an id for reuse.
2. Same target for every program: the runner and all children use the one target `sim.js`; a child built for another
   target fails to load with a clear error.
3. Forwarding is decided by the test runner. Default is record-only; nothing is delivered between children unless the
   test calls `test.forward` or handles `test.onMessage`.
4. Child errors are decided by the test runner. A child error is delivered as an event (`handle.onError`, and
   `test.onMessage` with an error message) and does not by itself end the test or any other child; the test chooses to
   fail, stop that child, or continue. If nothing handles the error, it is recorded and reported in the test results at
   the end (a test with an unhandled child error is reported as failed so errors are not silently lost).

---

# Addendum: observing a simulator's visible output

## Goal

The test runner (and the test program through `test.sim[id]`) can subscribe to what a simulator would show, and assert
over it, without any DOM: LED matrix, serial, sound, pin outputs, radio sent, and so on.

## What exists

- The runtime already has a "something visible changed" signal: `Runtime.updateDisplay()` (called after display writes and
  by `maybeUpdateDisplay` once per scheduler tick). Today it only calls `boardView.updateView()` and `postFrame()`, so in
  headless mode, where there is no `boardView`, the signal goes nowhere.
- `DalBoardViewContract.addUpdateSubscriber` already lets DOM-free state code subscribe to view updates.
- Visible state is plain data on `DalBoardState`: `ledMatrixState.image` (+ brightness, displayMode), pin values and modes,
  `microServoState`, `neoPixelState`, `audioState`, the radio/serial state, `thermometer`, etc.
- Outputs that are already messages: `serial`, `bulkserial`, `radiopacket`, audio/`music` events, and anything the board
  posts through `Runtime.postMessage` (already intercepted by `runHeadlessAsync`).

## Ideas

### A. A headless board view (recommended core)

Add a DOM-free `HeadlessBoardView implements DalBoardViewContract` and install it as `runtime.boardView` in
`initHeadlessDalBoard`. It does no drawing; its `updateView()` takes a cheap snapshot of the observable state and notifies
subscribers. Everything that today calls `boardView()` (audio pin enabling, update subscribers) keeps working, and
the runtime's existing `updateDisplay` becomes the change signal with no new hooks in state code.

Why: single choke point, no changes to individual state files, and a real view can still be used in the browser.

### B. Typed snapshots plus change events

- `handle.snapshot()` returns a plain serializable object: `{ leds: number[][], brightness, pins: {...}, servos, neopixels, audio: {...}, ... }`.
- Observers subscribe by area with typed callbacks, including the shim enums where relevant:
  `handle.onLedChange((leds) => ...)`, `handle.onPinChange(pin: DigitalPin, (value) => ...)`,
  `handle.onSerial(line => ...)`, `handle.onSound(note => ...)`.
- Change events are derived by diffing consecutive snapshots in the view, so state files do not each need their own event.

### C. Assertions that wait

Subscriptions are only useful in tests when they can block until a condition holds:

- `handle.waitFor(() => handle.led(2, 2), timeoutMs)` / `handle.expect.led(2, 2).toBeOn()`.
- `handle.expect.screenText("Hi")` for text scrolling (needs the scroll sequence recorded: see D).
- `handle.expect.serial("x")` for the next serial line, consuming from a recorded buffer.
- Timeouts report the last snapshot so failures are diagnosable.

### D. Recorded history for time-based output

Some output is only meaningful as a sequence (scrolling text, animations, tones, servo moves). The view keeps an optional
ring buffer of timestamped snapshots/events (`handle.history`, size-limited and opt-in) so a test can assert "showed
H then i" or "played A4 then C5" after the fact, instead of racing the animation.

### E. Derived, human-level views

Helpers on top of snapshots: `handle.ledsAsString()` (`"#...#\n..."`, matches the `images.createImage` literal syntax, so
expected images read like user code), `handle.screenshotText()` for failure messages, and golden-file comparison for larger
state. A later optional `render(snapshot) → SVG` could reuse the DOM view for debugging only.

### F. Message-based observation for other targets/instances

Since the runner intercepts all messages, extend the child's `postMessage` stream with a `{ type: "simstate", area, data }`
message emitted by the headless view on change. This is the same channel the runner already uses for `serial` and
`radiopacket`, which keeps the child-to-runner protocol uniform and makes the program-side API (`test.sim[id].led(...)`)
a thin reader of the runner's mirrored state. Prefer this when the observer is in the test program (a different runtime than
the observed board); use direct snapshots when the observer is the runner itself.

## Recommended design

A + B + C + F, with D opt-in and E as helpers:

1. `HeadlessBoardView` (A) produces snapshots and notifies subscribers on `updateDisplay`.
2. The snapshot's shape is defined once (a `BoardSnapshot` type in the DOM-free sim code) and used by the runner, the
   `simstate` message (F) and the test-program API (B).
3. The runner keeps the latest snapshot per child (mirror) and the serial/radio/message logs; the test program reads these
   through `test.sim[id]` shims, and `waitFor`/`expect` (C) are built on the mirror plus change notification.
4. Throttling: snapshots are emitted at most per scheduler tick (already how `maybeUpdateDisplay` works), and only when
   changed (structural compare), to keep message volume low.

## Phases

1. `HeadlessBoardView` + `BoardSnapshot` for LEDs and serial; the runner reads the snapshot at test end (assert on final
   state only). Test: `led-serial` rewritten to assert the final LED image via a header comment like `// @leds:`.
2. Change notification + `simstate` messages; `waitFor`.
3. More areas: pins, servo, neopixel, audio/music events, radio sent.
4. History buffer (D) and the string helpers (E).

## Open questions

1. Snapshot granularity: whole-board snapshot each change (simple, larger) or per-area deltas (smaller, more code)?
2. Should observation require opting in per area (`handle.watch("leds")`) to keep messages small, or always on?
3. Which visible outputs matter first for Micro:Bit tests: LEDs and serial, then pins/radio, then sound?
