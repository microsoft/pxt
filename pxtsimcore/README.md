# The DOM-free simulator core

The simulator is two TypeScript projects that share the `pxsim` namespace. `pxtsimcore/` holds
everything that runs without a browser: the VM, board state, sound synthesis, the host seams and
the editor-side frame policy. `pxtsim/` holds the code that needs the DOM: the embed, SVG views,
Web Audio and iframes. Consumers keep loading one composed `built/pxtsim.js`.

## Layout

- `pxtsimcore/tsconfig.json` compiles `pxtsimcore/**/*.ts` with `lib: ["es2017", "ES2018.Promise"]`,
  `types: []` and no `dom`, to `built/pxtsimcore.js` and `built/pxtsimcore.d.ts`. That the
  project compiles without `dom` is the check that core is DOM-free.
  - `runtime.ts`: the VM, `Runtime`, `BaseBoard`, `CoreBoard` and `RuntimeBoardView`.
  - `messages.ts` (the simulator message interfaces), `eventbus.ts` (`EventBus` and the board
    location types), `simtypes.ts` (`SimulatorState`, `SimulatorRunOptions` and friends).
  - `host.ts` and `virtualhost.ts`: the host seams and the virtual host.
  - `allocator.ts`, `debugcore.ts`, `debugProtocol.ts`, `langsupport.ts`, `libgeneric.ts`,
    `localization.ts`, `logger.ts`, `utils.ts`.
  - `simcoordinator.ts` and `simframe.ts`: the editor-side frame policy.
  - `sound/`: synthesis and sequencing (`soundSynthesizer*.ts`, `soundEmojiSynthesizer.ts`,
    `soundexpression.ts`, `song.ts`, `sequencer.ts`, `musicalProgressions.ts`), the
    play-instructions format (`instructions.ts`) and the audio seam (`audiohost.ts`).
  - `state/`: `AnimationQueue` and the generic `ButtonPairState`, `CompassState`,
    `FileSystemState` and `LightSensorState`.
  - `visuals/boardgeometry.ts`: coordinates, wire colors and breadboard geometry, which
    `allocator.ts` needs.
- `pxtsim/tsconfig.json` compiles `pxtsim/**/*.ts` with the `dom` libs, against
  `built/pxtsimcore.d.ts`, to `built/pxtsimdom.js` and `built/pxtsimdom.d.ts`: `embed.ts`,
  `domhost.ts`, `domutils.ts` (the `pxsim.U` element helpers), `debugger.ts`, `instructions.ts`,
  `accessibility.ts`, `simlib.ts`, `svg.ts`, `simdriver.ts`, `simframedom.ts`, `sound/` (the Web
  Audio implementation, `audiohostdom.ts`, the metronome worker and the worklet) and `visuals/`
  (`BoardHost`, the breadboard, generic boards and parts, wiring).
- Membership is location: a file belongs to the project whose directory holds it, and neither
  config lists sources.
- The gulp `pxtsim` task builds core, then the DOM project, then composes `built/pxtsim.js` as
  `pxtsimcore.js` followed by `pxtsimdom.js`, and `built/pxtsim.d.ts` the same way with the DOM
  declarations' reference to `pxtsimcore.d.ts` removed. Its `pxtsimcore` step also copies
  `pxtsimcore/globals.d.ts` to `built/pxtsimcore-globals.d.ts`.
- All of these outputs ship in the pxt-core package (`built/*.js`, `built/**/*.d.ts`). A target's
  core config compiles against `pxtsimcore.d.ts` followed by `pxtsimcore-globals.d.ts`.
- `gulp lint` lints both directories; `pxtsimcore/.eslintrc.js` points the parser at the core
  config.

## The boundary

- Core may name its own declarations, the globals in `pxtsimcore/globals.d.ts` and the
  `localtypings/` files it references (`pxtparts.d.ts`, `pxtarget.d.ts`, `pxtmusic.d.ts`,
  `vscode-debug-protocol.d.ts`). It never names anything in `pxtsim/`; DOM code reaches core
  through `built/pxtsimcore.d.ts`.
- `globals.d.ts` declares what browsers, workers and Node share: the timer functions, `console`,
  `performance`, `btoa`/`atob`, `TextEncoder`/`TextDecoder`, `URL`/`URLSearchParams`, the
  `ImageData` fields core reads, and `requestAnimationFrame`, `cancelAnimationFrame`,
  `setImmediate` and `MessageChannel` typed as possibly undefined, so core checks before calling.
- Core reads time, timers and randomness through `pxsim.host`, and audio through
  `pxsim.audiohost`. The serial message's `time:` field stays on `Date.now` as wall-clock
  telemetry.
- Load order: each project concatenates its files into one script, so a file that reads another
  file's members while the script loads pins that file ahead of it with `/// <reference path>`.
  In core the one load-time read is `libgeneric.ts`, whose `RefCollection` extends `RefObject`
  from `langsupport.ts`. In `pxtsim/` the Web Audio sources pin `sound/audioSource.ts`, their
  base class, and `simdriver.ts` pins `simframedom.ts`.

## Host seams

- `pxsim.host.Environment` is what the runtime knows about its page: `postToParent`,
  `locationHref`, `isPxtElectron`, `isIpcRenderer` and `frameId`. The defaults are inert;
  `pxtsim/domhost.ts` installs the browser environment at load time through `setEnvironment`.
- `pxsim.host.Clock` (`now`, `perfNowUs`), `Timers` (`setTimeout`, `clearTimeout`, `setInterval`,
  `clearInterval`, `requestFrame`, `cancelFrame`) and `RandomSource` (`next`, `seed`) are read
  through `host.clock()`, `host.timers()` and `host.rng()`. Every timer and frame call returns a
  `TimerHandle`, an opaque value passed back to the matching cancel call.
- The defaults are `Date.now`, a performance-based microsecond clock, the global timers looked up
  at call time, `requestAnimationFrame` or a `FRAME_MS` (16 ms) timeout, and `Math.random` with a
  `seed` that does nothing. `setEnvironment`, `setClock`, `setTimers` and `setRng` override some
  members and fill the rest from the defaults.
- `pxsim.audiohost.AudioHost` is the audio seam: tones, sample and PCM playback, MIDI, audio
  elements for recorded audio, muting, `stopAll`, spatial players and `createMetronome`.
  `audiohost.audio()` returns the current host and `setAudioHost` overrides members over the
  silent defaults. `pxtsim/sound/audiohostdom.ts` registers the Web Audio host, which forwards to
  `AudioContextManager`.
- The silent host, used whenever no other host is registered:
  - `playInstructionsAsync` resolves once the buffer's duration (`music.instructionsDurationMs`)
    has passed on the host clock, or early when `isCancelled` returns true, polled on frame-sized
    ticks;
  - `createMetronome` returns an `audiohost.TimerMetronome`, which ticks on `host.timers()`;
  - `stopAll` calls its `onStopAll` listeners in registration order;
  - `createAudioElement` returns an inert element whose `play` resolves at once;
  - `isMuted` is true, `isAudioElementActive` is false, sample and PCM playback resolve at once,
    and everything else does nothing.
- Sound events: `audiohost.SoundEvent` is `"playinstructions" | "muteallchannels"`.
  `audiohost.setSoundEventHandler` sets the single observer and `audiohost.notifySoundEvent`
  calls it. Both hosts notify: playing instructions with the buffer, `stopAll` with none.
- Queued play: `audiohost.queuePlay(when, play)` calls `play` after `when` ms on `host.timers()`
  unless a `stopAll` ran in between, and `audiohost.queuePlayInstructions` queues a
  `playInstructionsAsync` that way. `AudioContextManager.queuePlayInstructions` delegates to it.

## The virtual host

- `pxsim.host.createVirtualHost(options)` returns a deterministic host: a clock that moves only
  when driven, timers and `FRAME_MS` frames on one queue ordered by virtual time, and a seeded
  random source. `use()` makes it the host the runtime reads.
- `advance(ms)` moves virtual time forward, firing everything due on the way in time order and
  yielding to the event loop around each callback. `runUntil(done)` fires queued callbacks one at
  a time until `done()` is true, and keeps yielding while the queue is empty so real timers can
  make it true. `stop()` ends both for good. `now()` reads elapsed virtual milliseconds; the clock
  itself reads from a nonzero epoch, since the runtime treats a performance time of 0 as unset.
- `yieldToEventLoop` may be injected; the default is `setImmediate`, else a `MessageChannel`
  message, else `setTimeout(fn, 0)`.
- The seed: the random source is `pxsim.host.createSeededRandom(seed)`, a mulberry32 generator,
  started from `options.seed` or `pxsim.host.DEFAULT_SEED`. One seed always yields one sequence;
  a program that calls `seedAddRandom` reseeds it.
- The yield budget: the runtime's `maybeYield` yields after 20 ms of host time, or after
  `YIELD_BUDGET` (100000) calls on one unchanged clock reading. On the virtual clock a busy loop
  therefore still yields, so a headless run times out instead of hanging Node.

## Board state and view

- `runtime.board` is the board state (`BaseBoard`, usually a `CoreBoard` subclass) and
  `runtime.boardView` is its optional view (`RuntimeBoardView`). The `board()` and `boardView()`
  accessors are defined by each target: `board()` for shims and state code, `boardView()` for
  view code only. A board state constructs and runs with no view.
- `BaseBoard` holds the id, the `EventBus`, the run options, stored state, serial buffering and
  message listeners. `CoreBoard` adds `builtinParts`, the part states keyed by simulation
  behavior, and stops sound when killed.
- `RuntimeBoardView` members and their callers:
  - `builtinVisuals` (part view constructors by simulation behavior) and `builtinPartVisuals`
    (part image constructors by built-in part name): read by the parts instructions page in
    `pxtsim/instructions.ts`.
  - `initAsync(msg)`: called by the embed for each run once the board's `initAsync` has
    resolved, while that runtime is still current and alive; the program starts when it resolves.
  - `updateView()`: called by `Runtime.updateDisplay`, which a target calls to redraw and which
    the scheduler calls when updates queued with `queueDisplayUpdate` are flushed.
  - `addUpdateSubscriber(fn)`: registers `fn` to run on every `updateView`; view code such as
    the board SVG subscribes here.
  - `screenshotAsync(width?)`: called for each screenshot request, for each frame while
    recording, and for thumbnail frames after a user interaction.
  - `kill()`: called by the embed when it stops a run, after the runtime and the board.
- With no view the runtime skips every view call; screenshots, recording and thumbnails do
  nothing.
- A target implements: a board state class; `pxsim.initCurrentRuntime`, which sets
  `runtime.board` and `runtime.boardView`; a view class implementing `RuntimeBoardView`; and, to
  run headless, `pxsim.initHeadlessRuntime`, which sets the board with no view.
- A view that tilts the accelerometer by pointer constructs `visuals.AccelerometerTiltInput`
  with the board's `AccelerometerState` and calls `attach` with the board element.
- `BoardHost` wiring: the view's `initAsync` builds a `visuals.BoardHost` from
  `visuals.mkBoardView(...)` and `visuals.BoardHostOpts`, passing the board state as `state` and
  its own `builtinVisuals`. `BoardHost.addPart` builds each part that declares a
  `simulationBehavior` from the matching `builtinVisuals` entry and initializes it with the
  matching `builtinParts` state.

## Simulator frames

`SimulatorDriver` runs in the editor, not in the simulator frame. Its policy is DOM-free and lives
in core; only the iframe handling needs the DOM.

- `pxtsimcore/simframe.ts` defines `SimFrame`, an opaque handle to one frame (`id`,
  `messageChannel`, `runId`, `runtimeId`, `permanent`, `loading`, `origin`, `aspectRatio`,
  `attached`, `matchesSource`, `focus`), and `SimFrameHost`, which the environment holding the
  frames implements: list, create, remove, hide, reveal, post to, style, size and freeze frames.
- `pxtsimcore/simcoordinator.ts` defines `SimEnvironment` (origin, URL, parent window, dependent
  editor liveness, configured simulator URL, message listener) and `SimulatorCoordinator`, which
  owns the policy:
  - the `SimulatorState` machine and `run`, `stop`, `restart`, `suspend`, `mute` and `preload`;
  - run-message construction: frame ids, theme rotation and run ids;
  - spin-up decisions for broadcast messages: a secondary board frame (at most two board frames,
    none in single-simulator mode), simulator extension and legacy message simulator frames, and
    restarting a frame whose run is stale;
  - routing: which frames receive a message, the source frame and jacdac traffic to secondary
    boards skipped, messages deferred until a frame has loaded, and at most one recorder;
  - the debugger protocol and trace interval, and the allowed-origin check on incoming messages.
- `pxtsim/simframedom.ts` has `DomSimFrameHost`, the iframe-backed `SimFrameHost`; a frame's state
  lives in the iframe's dataset, and loaning a frame is DOM-only. `pxtsim/simdriver.ts` has
  `SimulatorDriver extends SimulatorCoordinator`, which builds a `DomSimFrameHost` and a DOM
  `SimEnvironment` and adds `loanSimulator`, `unloanSimulator`, `isLoanedSimulator` and the
  element callbacks in `SimulatorDriverOptions`; the rest of its public API is the
  coordinator's.
- The coordinator reads its frame cleanup timer and frame-id randomness through `pxsim.host`.
  `tests/simdriver-test` drives `SimulatorDriver` through a fake DOM.

## Target core bundles

- A target ships a DOM-free simulator bundle by adding `sim/tsconfig.core.json` with `outFile`
  `../built/simcore.js`. Its files are the target's `sim/core/` folder (and any library core
  files it lists), compiled against `pxtsimcore.d.ts` and `pxtsimcore-globals.d.ts` with no
  `dom` lib.
- `sim/tsconfig.json` compiles only the view files, against `pxtsim.d.ts` and the core bundle's
  `.d.ts`, and lists `../built/simcore.js` in a top-level `prepend`. `prepend` is a pxt key, not a
  TypeScript one, and only `tsconfig.json` may carry it.
- `pxt buildtarget` (and `pxt rebundle`) compile the sim folder: `tsconfig.core.json` first, to
  `built/simcore.js`, then `tsconfig.json`, to `built/sim.js`. After a build, each `prepend`
  entry is concatenated ahead of the output, and when the config emits declarations the prepends'
  `.d.ts` files are concatenated ahead of the output's `.d.ts`. So `sim.js` is `simcore.js`
  followed by the view code. An `outFile` other than the required path is a build error.
- The npm-package form: a sim folder at `node_modules/pxt-<target>-sim` may use
  `./built/simcore.js` and `./built/sim.js`, and the outputs are copied into the target's
  `built/`.
- pxt-common-packages keeps each library's DOM-free files in `libs/<lib>/sim/core/` and its view
  files in `libs/<lib>/sim/`. Its `sim/tsconfig.core.json` compiles `../libs/*/sim/core/*.ts` to
  `built/common-simcore.js`, and its `sim/tsconfig.json` compiles `../libs/*/sim/*.ts` and
  prepends `built/common-simcore.js`, to `built/common-sim.js`. A target's `pxt buildtarget`
  builds both when `common-sim.js` is missing, `pxt serve` builds both on every build, and both
  copy both pairs into the target's `built/`.
- A consumer loads `pxtsim.js` and the target's `sim.js` (the browser simulator), or
  `pxtsimcore.js` and `simcore.js` (headless, DOM-free); never both pairs, since `pxtsim.js`
  already contains core. A target that ships `simcore.js` is never loaded headless through
  `sim.js`: its view code may use the DOM at load, and only the DOM-free pair runs without one.

## Running programs headless

`pxt simtest [file|dir ...]` compiles each test program on top of a base project and runs it in
a Node `vm` context with no browser globals (`cli/simtest.ts`, `runHeadlessAsync`).

- Flags: `--base <dir>` is the project each test compiles on top of (default: the current
  directory); it must have exactly one `.ts` file, which the test replaces. The bundles are the
  DOM-free pair, `pxtsimcore.js` and `built/simcore.js`, when the target has built `simcore.js`,
  and the full pair, `pxtsim.js` and `built/sim.js`, otherwise. `--core` requires the DOM-free
  pair and stops with a message when the target has not built one. `--sim <file>` names the
  target bundle explicitly. `--timeout <ms>` bounds each run in real time (default 5000).
  `--settle <ms>` is the virtual time a program runs after its top-level code finishes
  (default 300).
- A directory argument runs every `.ts` file in it, in name order.
- Each run installs a virtual host and the silent audio host before constructing the `Runtime`,
  sets `pxsim.initCurrentRuntime` to `pxsim.initHeadlessRuntime`, steps the host until the top-level
  code finishes, advances it by `--settle`, and then ends whatever is still scheduled. A run
  never waits for the program to go idle, so a `forever` program passes. The timeout watchdog
  stays on real time.
- Expectations: every line of the form `// @serial: text` is one expected serial line, in order.
- A test passes when it compiles, raises no runtime error, finishes before the timeout and, when
  it has `@serial` lines, writes exactly those lines. `simtest` runs every test, prints `ok` or
  `FAIL` with the reason for each and a count, and exits 1 when any failed.
- `gulp testsimcore` (`tests/simcore-test`) loads `built/pxtsimcore.js` alone into such a
  context, runs programs through `runHeadlessAsync` on the TypeScript fixture
  `tests/simcore-test/fixtures/toybundle.ts`, and drives a virtual host directly.
- The harness above `simtest` (contributors, scenarios, the trace, worlds of several simulators,
  media, recording and replay) is outlined in `headless-harness-overview.md` beside this file for
  a first read, designed in full in `headless-harness.md`, whose Status section says which parts
  exist, and sequenced in `headless-harness-plan.md`.

## Open items

- pxt-common-packages' mqtt, wifi and text-to-speech simulators (`libs/mqtt/sim/net.ts`,
  `libs/wifi---esp32/sim/wifisockets.ts`, `libs/text-to-speech/sim/tts.ts`) are view code only.
- pxt-microbit keeps its own accelerometer, edge connector, thermometer and music simulators in
  `sim/core/` instead of using pxt-common-packages' versions.
- `debugProtocol.ts` times out pending requests on the global `setTimeout`, not on
  `host.timers()`.
- The coordinator has no tests through a fake `SimFrameHost`; its tests go through
  `SimulatorDriver` and a fake DOM.
