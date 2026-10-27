# The headless test harness

The design of the test harness the headless layer builds toward, above `pxt simtest`.
`headless-harness-overview.md` beside this file is the short tour to read first, `README.md`
describes the layer as it stands, the Status section at the end of this file says which parts of
the harness exist, and `headless-harness-plan.md` is the order the rest lands in. A test is a
project plus a scenario, and it runs from the command line, from Node and in a browser worker over
the same driver, producing the same trace. The unit of time is the frame (`FRAME_MS` on the virtual
host): a scripted input is due at a frame, an
expectation holds over a window of frames, and every record in the trace is indexed by frame.

## Contributors

A contributor is anything in a staged world that a scenario can script or a test can observe.
One shape serves every source:

- `id`: durable and unique in the world. `board` for the simulator's own device; a role name for
  a module an extension attaches (the role as the user spelled it); a key for a program
  contributor; a medium's id.
- `provider`: who declares it, for attribution: the target for the board, the extension's
  `owner/repo` for a module or a program contributor, the platform for a medium.
- `docs`: optional markdown about the contributor as a whole: what it is and how its kinds,
  channels and events relate in time and to each other, the guidance a scenario author, a person
  or a tool, reads before scripting it.
- `inputKinds()`: entries `{ name, description, class, values, docs? }`. `class` is `level` (held
  until set again) or `arrival` (a one-off). `values` says what a value may be, as one of
  `{ "enum": [...] }`, `{ "range": [min, max] }` with an optional `step`, or `{ "encoding": text }`
  stating a compound value's string form. `description` is one sentence for a reader; `docs` is
  optional markdown for more.
- `stateChannels()`: entries `{ name, description, rendering, bulk?, docs? }`, each a level the
  contributor holds. `rendering` states the string the channel shows (`25 brightness digits 0-9,
  row-major`), which is the string an expectation names; `bulk: true` marks a channel that renders
  as a hash (Values).
- `eventKinds()`: entries `{ name, description, values, docs? }`, each an arrival the contributor
  emits, `values` as for a kind.
- `apply(kind, value)`: delivers one scripted input through the contributor's own seam.
- `readState()`: the contributor's channels as rendered strings, as they stand after the frame.
- `emit(name, value)`: supplied by the driver rather than implemented by the contributor: the
  handle a program contributor registers through carries it, and a module's factory receives it as
  its second argument. The contributor calls it at the moment an event happens; the driver
  collects.

Four sources implement it:

- The board: `apply` is a typed input through the core primitives (`{ kind: "click", button: 1 }`
  and its kin), `readState` is the headless board view's snapshot rendered per channel, and the
  view's change signal carries its events.
- A module: a simulator extension's DOM-free core, attached to a board over a medium. An extension
  whose simulator exists only as an iframe page has no headless form and contributes nothing to a
  headless run; it ships a core to be testable.
- A program contributor: code inside the compiled program that registers over the program-message
  channel under a key of its own, a short name the extension chooses. It publishes its
  declaration when it registers, drains its inbox at the start of each
  frame so an input due at frame N is applied before frame N's handlers run, and posts its state
  and events at the end of each frame so the driver reads them without a round trip.
- A medium: a world-level contributor that connects boards and modules (below).

How a program contributor registers. The contract is a set of messages over the program-message
channel, so a program in any language can speak it; the `harness` library in pxt-common-packages
(`libs/harness`, depending on `core`, a `harness` namespace with no blocks) is the wrapper a program
normally uses, and an extension that contributes depends on it. Its functions are `shim=TD_NOOP`
with simulator-only bodies, so a program contributor compiles to nothing on hardware and the posting
loop runs only in the simulator. The program sends its declaration on the `harness` channel from its
start-up code: a JSON object with `key`, `provider`, `docs` and the `inputs`, `channels` and
`events` lists of entries in the shape above, names bare. The driver runs the program to its first
frame boundary, collects the declarations, and fixes the composed surface before frame 0 is
dispatched; a declaration arriving later and one whose key is already registered or taken by another
outer name are each refused with a stable code naming the key, the first registration standing and
the program running on without a contributor. Inputs arrive on the `harness.<key>` channel, one
message per input, `{ "kind", "value" }` with the kind bare and the value as the scenario wrote it;
the driver posts every input due at frame N before frame N's handlers run, in scenario order, and
the program applies each through the contributor's own seam, its handler receiving the scalar. The
program posts on the `harness` channel once per frame, from a loop the library runs at the frame
period it reads from the simulator host, `{ "key", "state", "events" }` with `state` an object of
bare channel names
to rendered strings and `events` the `[name, value]` pairs emitted since the last post, in emission
order; the driver stamps the post with the frame it arrives in, prefixes the key, and reads it in
its post-step with no round trip. A program that declares and never posts renders its channels
absent.

A step counter in a micro:bit program, from an extension whose repository is `example/pxt-steps`:

```ts
let count = 0
let goal = 20
const steps = harness.register("steps", "example/pxt-steps", {
    inputs: [{ name: "goal", description: "the count to reach", class: "level",
        values: { range: [1, 10000] } }],
    channels: [{ name: "count", description: "shakes counted since start",
        rendering: "decimal integer" }],
    events: [{ name: "reached", description: "the goal was reached; the value is the goal",
        values: { range: [1, 10000] } }]
})
steps.onInput("goal", value => { goal = value as number })
steps.state(() => ({ count: "" + count }))
input.onGesture(Gesture.Shake, () => {
    count++
    if (count == goal) steps.emit("reached", "" + goal)
})
```

The composed surface gains `steps.goal`, `steps.count` and `steps.reached`, so a scenario writes
`{ "kind": "steps.goal", "at": 0, "value": 3 }` and expects `steps.reached` with value `"3"`. On
the wire, the program sends the declaration once, the driver sends `{ "kind": "goal", "value": 3 }`
on `harness.steps` at frame 0, and the program sends `{ "key": "steps", "state": { "count": "1" },
"events": [] }` on `harness` each frame, with `[["reached", "3"]]` in the frame the goal is met.

How a module is found. A simulator extension is declared in the target's `approvedRepoLib` under
its `owner/repo` with a `simx` entry naming its iframe page; the entry has a `core` field, the path
within the repository of a DOM-free script. The driver loads the script into the same context as the
target's core bundle, as `pxtsimcore.js` and `simcore.js` are loaded, and as it loads the script
calls `pxsim.harness.defineModule(kind, factory)` once per kind of module the extension stands for
(a slider, a button, a servo), `factory` taking an attachment's config and the driver's `emit` and
returning a contributor; the driver pairs each call with the script it is loading, so the script
names no repository. An extension with no `core` field is the iframe-only case. Nothing registers at
test time: an attachment, from the project's staging file or the scenario's staging, names the
extension as its `module` by `owner/repo` and the kind as `kind`, omitted when the core defines one
kind, and the driver builds one contributor per attachment from that kind's factory, under the
attachment's role, with the `owner/repo` as its `provider`. How the module exchanges frames with the
board is the contract of the medium it is attached over (Media and topology). In
the live simulator the extension's page builds the same core source into itself, calls the factory
directly and renders the contributor's state, so the contributor is the model in the headless run
and in the frame alike; `core.js` is the entry that wraps the factory in the `defineModule` call for
the driver's context, where `pxsim` exists, and the page needs no `pxsim`. How the page observes the
core is the extension's business, and the core knows nothing of the page.

A slider whose repository is `example/pxt-slider`. The target's `approvedRepoLib` entry:

```json
"example/pxt-slider": { "simx": { "index": "index.html", "core": "built/core.js" } }
```

Its `built/core.js`:

```js
pxsim.harness.defineModule("slider", (config, emit) => {
    let position = config.start || 0;
    return {
        inputKinds: () => [{ name: "position", description: "where the knob is", class: "level",
            values: { range: [0, 100] } }],
        stateChannels: () => [{ name: "position", description: "where the knob is",
            rendering: "decimal integer 0 to 100" }],
        eventKinds: () => [],
        apply: (kind, value) => { position = value; },
        readState: () => ({ position: "" + position }),
    };
});
```

A scenario staging it on the one board over a bus, and moving it at frame 10:

```json
{
  "frames": 30,
  "staging": {
    "attachments": [
      { "board": "board", "role": "slider 1", "module": "example/pxt-slider",
        "config": { "start": 50 } }
    ],
    "media": [{ "id": "bus 1", "kind": "jacdac", "attached": ["board", "slider 1"] }]
  },
  "inputs": [{ "kind": "slider 1.position", "at": 10, "value": 80 }],
  "expectations": [
    { "channel": "slider 1.position", "value": "80", "window": { "from": 10, "to": 29 } }
  ]
}
```

Rules every contributor obeys:

- The driver observes, never reconstructs. `readState` renders state the contributor itself holds
  and settled during the frame; `emit` is called at the moment the event happens. Nothing
  reconstructs another contributor's state or events from the outside, and no event is derived
  from a state diff.
- Reads are pure. `readState` changes nothing.
- Deterministic. Same seed, same scripted inputs, same frame count give the same state and
  events, byte for byte. Entropy only through `host.rng()`.
- Headless. A contributor runs with no DOM, in a worker and in Node alike.

## Composition

The driver composes a world's contributors into one declared surface and one dispatch table.

- Order is fixed, so same-seed reruns and the declared surface are byte-identical: the board;
  then modules in ascending order of role; then program contributors in ascending order of key;
  then media in ascending order of id. Within a contributor, declaration order. In a world of
  several simulators, boards by id, then media; within a board, as above.
- Names. A contributor's own names are plain (`button-a`, `light-level`, `display`). Every
  contributor but the board has its id as the outer name of its kinds, channels and events: a
  module's composed name is `<role>.<name>` (`slider 1.position`, `arm servo.angle`), a program
  contributor's is `<key>.<name>` (`game.score`), and a medium's is `<id>.<name>`
  (`ether.link board 1-board 3`, `bus 1.attached`). The board's names are bare; it is the one
  contributor of the default world. In a world of several simulators the board id is the outer
  name of everything on that board (`board 2.display`, `board 3.slider 1.position`), omitted when
  there is one. A composed name is matched whole against the declared surface and never split on
  its separator, so a role may contain any character the editor lets the user type; the one split
  is of the board's own names, on their first `.`, for the collision check below. The extension
  that
  declares a contributor is its `provider`, for attribution, and is never part of a name: two
  instances of one extension are told apart by role, and a role reads as the user spelled it.
- Collisions are refused at staging, before the first frame, with a stable code that names the
  colliding outer name, never merged silently: a role, key or medium id already taken by another
  contributor's outer name, or equal to one of the board's own names or to the outer segment of
  one (`display`, `speaker`, `pin 0`), whatever kinds the newcomer declares. The refusal therefore
  depends on the names in the staging and the registered keys alone, never on a contributor's
  declaration list.
- The composed surface is fixed for a run. It is declared from the staging and the program
  contributors' declarations before the first frame; a detach renders a channel's value as absent
  and never removes the channel or moves another's place.
- An input kind, a channel and an event kind may share a composed name (`slider 1.position` is a
  kind and a channel; `bus 1.attached` is the list of roles on the bus and the arrival of one); an
  input or an expectation says which it names.

- Validation. A scenario's kinds are checked against the composed surface for its staging and each
  input's value against its kind's `values`; a rejection lists the composed names.
- Dispatch, per frame: route the inputs due this frame to their contributors; the contributors'
  pre-step; the runtime's frame; the contributors' post-step folds the posts received during the
  frame into state; the driver reads every contributor's `readState` once and merges in composed
  order, and collects the events emitted during the frame in emission order. In a world of several
  simulators every board
  takes its frame first and every medium propagates after, so a radio frame sent on frame N
  reaches its receivers on frame N+1 whichever board sent it; delivery latency never depends on
  board order.

The surface of a micro:bit with the slider of the Contributors section under the role `slider 1`,
the `steps` program contributor and one bus, in composed order (the board's own entries
abridged):

```text
contributor   inputs                        channels               events
board         button-a, button-b, ...      display, pin 0, ...    serial, display.show, speaker.play
slider 1      slider 1.position             slider 1.position
steps         steps.goal                    steps.count            steps.reached
bus 1         bus 1.attach, bus 1.detach    bus 1.attached         bus 1.attached, bus 1.detached
```

The same staging with the slider under the role `display` is refused before frame 0 with a stable
code naming `display`, because `display` is the outer segment of the board's own `display` and
`display.show`; the slider's declaration list plays no part in the refusal.

## Values

Scripted values are scalar: number, boolean or string. A kind's `values` defines what a value may
be, an enumeration, a range, or for a compound value its string encoding (`x,y` in pixels), and its
description the meaning. Rendered channel values are strings whose form the channel's `rendering`
states; the LED display renders as one string of brightness digits.

Bulk channels. A channel whose natural rendering runs past a line (the Arcade screen: 160 by 120
pixels at 4 bits each, 9600 bytes a frame) renders as a content hash instead: FNV-1a 64-bit over
the channel's bytes (for a screen, the framebuffer followed by the palette), as 16 lowercase hex
digits, so every host renders the same value and a changed frame costs the trace one short line.
The bytes themselves are a file beside the scenario under the bulk-value rule of Recording and
replay: a run flag writes a frame's bytes on request, and a failed expectation on a bulk channel
writes the frame it failed at. A check finer than the whole channel is a probe: a module the
platform supplies, staged as an attachment under a role with its probe list as config, so it
composes as any module does. Each probe is one declared channel (`probe.pixel 10,20` reads a
color index, `probe.region 0,0,16,16` reads that region's hash), so the surface stays small and
fixed and an expectation stays one line. A probe has no kinds of its own and reads the board's
screen through a seam the board exposes for probes, purely and deterministically; that seam is the
one place a contributor reads state it does not hold.

## State and events

Outputs are level or arrival, as inputs are. A channel is a level: the display's pixels, a
servo's angle, a pin's value. An event is an arrival: text shown, a tone started, a serial line
written, a radio frame sent. Polled state cannot carry arrivals (two consecutive `showNumber(5)`
calls read as one value; a value shown and replaced inside one frame is never seen), so the trace
carries both.

- State on a frame is the channels that changed since the last frame, in composed order, each a
  rendered string or absent; the first frame holds every channel.
- Events on a frame are every event emitted during it, in emission order, each a name and a
  value. Several events of one kind in one frame are all kept. Trace format gives the bytes.
- Board event kinds: `serial`, one event per line; `display.show`, the text the board scrolls or
  prints; `speaker.play`, the sound's name. The display's pixels stay a channel.
- The headless board view pushes on change (its `updateView` is the change signal, flushed at most
  once per scheduler step), and the board contributor turns that signal into events and state
  deltas.

## Scenarios

A scenario is a file beside the project. It declares:

- The seed every random choice in the run draws from (`host.rng()` and the media's own streams),
  the virtual host's default seed when omitted.
- The run length in frames. The run ends after that frame whatever the program is doing, so a
  `forever` program passes and a window past the last frame is not satisfied.
- The staging: the boards (one, or several, each with its project), the attachments (which module
  is on which board under which role, with its config) and the media with their parameters and
  initial topology. The project's staging file (below) is the default a scenario starts from; a
  scenario's staging replaces each of `boards`, `attachments` and `media` it names, whole, and
  takes the others from the file.
- Inputs: `(kind, at, value)` entries, `at` a frame index, `kind` a composed name.
- Expectations, in two forms over a window of frames `{ from, to }`. The level form names a
  channel and a rendered value and holds when the channel shows the value on every frame of the
  window, the channel reconstructed frame by frame from the deltas, a channel absent from a frame
  holding what it last showed; a window the run does not reach is not satisfied; the point form is
  `{ from: n, to: n }`. The arrival form names an event kind and a value and holds when an event
  of that kind with that value is emitted on some frame of the window. Each form has a negated
  counterpart: the channel never shows the value on any frame of the window, or no such event is
  emitted in it. No expectation carries a range or a tolerance; a contributor that wants a
  tolerant check declares a quantized channel.
- A watch list: the channels and event kinds a report renders. Unwatched contributors still settle
  and still drive the world; their entries stay in the trace and leave the report. An entry an
  expectation names is rendered whether or not the list names it. With no watch list the report
  renders everything.
- The nominal frame period, `FRAME_MS` when omitted.
- Optionally, the clock: the clock delta of each frame in milliseconds, one entry per frame, which
  a recording carries (Recording and replay) and a written scenario omits for the nominal period
  throughout.
- Optionally, a versions pin: the pxt-core, target and pinned dependency versions the scenario
  holds for. A shell refuses to run a pinned scenario at any other version, which is what a
  comparison of traces across hosts needs. The versions a run actually ran under are recorded in
  the trace header whether or not the scenario pins them.

The file is JSON, `<name>.scenario.json`, anywhere in the project: beside `pxt.json` or in any
folder of it, an extension's own folder included, and the trace and any bulk-value files land
beside it. A shell finds every `*.scenario.json` the project holds. Its fields are those
declarations: `"seed"`; `"frames"`; `"staging"` with `"boards"` (`{ "id", "project" }` entries,
`project` a path relative to the file, the array omitted for the one-board case), `"attachments"`
(`{ "board", "role", "module", "kind", "config" }` entries) and `"media"` (`{ "id", "kind",
"params", "attached" }` entries, `attached` the initial topology); `"inputs"` (`{ "kind", "at",
"value" }`
entries); `"expectations"` (`{ "channel", "value", "window" }` level entries and `{ "event",
"value", "window" }` arrival entries, `window` as `{ "from", "to" }`, `"not": true` for a negated
form); `"watch"` (an array of composed names); `"framePeriod"`; `"clock"` (an array of `frames`
integers); and `"versions"`, the pin. A field a scenario does not need is omitted; `frames` is the
one required field.

A counter program on one micro:bit, `counter.scenario.json` beside its `pxt.json`, with a light
level held from the first frame, two clicks, and three expectations:

```json
{
  "seed": 7,
  "frames": 120,
  "inputs": [
    { "kind": "light-level", "at": 0, "value": 180 },
    { "kind": "button-a", "at": 10, "value": "click" },
    { "kind": "button-a", "at": 40, "value": "click" }
  ],
  "expectations": [
    { "event": "display.show", "value": "2", "window": { "from": 40, "to": 60 } },
    { "channel": "display", "value": "0000000000000000000000000",
      "window": { "from": 100, "to": 119 } },
    { "event": "serial", "value": "error", "window": { "from": 0, "to": 119 }, "not": true }
  ],
  "watch": ["display", "display.show", "serial"]
}
```

No staging means the one-board world on the project's own target. `light-level` is a level kind
and holds 180 for the whole run; `button-a` is an arrival kind whose value names the gesture
(`press`, `release`, `click`, `long-click`), as its `values` in the composed surface state.
The channel expectation's value is the rendered string the trace shows, here the 25 brightness
digits of a blank display. The shell writes `counter.trace.jsonl` beside the scenario; a committed
trace is the golden the next run is compared against, and a flag rewrites it.

The project's staging file is `staging.json` beside `pxt.json`, holding one `staging` object in
the scenario's shape, and it is project state: the live simulator starts from it, a scenario
without a `staging` runs on it, and it travels with the project. Extensions reach it through a
request family of its own, `projstaging`, gated by a registration flag of its own as every other
project access a simulator extension has is: a read
returns the file with, for each attachment, the URL of its module's core script and, once, the
URLs of the headless bundles; a write replaces the entries the writer owns; a subscription
delivers a change notification whenever the file changes. An extension that edits topology writes
the media and attachments it owns; a reader takes the whole file and learns which extension
declared an entry from the entry's own `module` and `kind`.

The expectation semantics are defined here, once, and pxt's evaluator implements them. A consumer
that carries scenarios in a shape of its own implements the same semantics and checks against
this evaluator: the same scenario yields the same verdicts.

## The trace

The trace is the complete observation record: per frame, the state deltas in composed order and
the events in emission order. It is the test's artifact and the replay oracle; a report (verdicts
first, then the change log over watched entries) is a view over it. The
`@serial` golden is a projection of the trace's serial events and stays as a smoke oracle.

Two runs of one test produce the same trace when both run the same pxt-core, the same target
version and the same pinned dependencies, and so the same compiled JavaScript and the same two
headless bundles (`pxtsimcore.js` and the target's `simcore.js`). A test records those versions,
and a comparison across hosts is valid only at equal versions. Program contributors are compiled
into the program and identical across hosts by construction; the board contributor is the target's
core bundle in every host; a module has its core in every host. One caveat: transcendental math
(`Math.sin` and its kin) is not bit-identical across JavaScript engines, so identity holds across
hosts on one
engine, and across engines only for traces whose rendered values are quantized past the last bit,
as the display's one-digit brightness is.

## Trace format

The trace is a JSON Lines file, `<name>.trace.jsonl` beside the scenario: one JSON record per line,
a header record first and then one record per frame in frame order. Every record is serialized
canonically, so one trace is one byte sequence: no whitespace outside strings, keys in the order
given here, state keys in composed order, strings escaped as JSON requires, and every number in its
shortest round-trip JSON form. Within a surface record the keys follow the order the Contributors
section lists the fields, `name` and `contributor` first, and an optional field that is absent is
omitted, never written as `null`.

- The header record: `{"scenario": name, "seed": n, "framePeriod": ms, "versions": {...},
  "surface": {...}}`. `versions` holds `pxt-core`, `target` and then each pinned dependency by name,
  each a version string, the dependencies in ascending order of name. `surface` is the composed
  surface: `"contributors"`, an array in composed order of `{ "id", "provider", "docs" }` records,
  and `"inputs"`, `"channels"` and `"events"`, each an array in composed order of the declared
  entry records with the composed name as `name` and the declaring contributor's id as
  `contributor`, so a trace describes itself without its scenario. The surface digest is FNV-1a
  64-bit over the canonical bytes of the `surface` object, 16 lowercase hex digits; a host that
  caches or compares surfaces uses it, and every host computes the same one.
- A frame record: `{"frame": n, "state": {name: value, ...}, "events": [[name, value], ...]}`.
  `state` holds the channels that changed since the last frame, in composed order, every value a
  rendered string and `null` for a channel rendered absent; the first frame record holds every
  channel. `events` holds every event emitted during the frame as `[name, value]` pairs in emission
  order, every value a string. A frame with no change and no event is still a record, with an
  empty object and an empty array, so the frame count is the line count less one.
- Serial output is the `serial` events, and the `@serial` golden is the sequence of their values.
- Byte identity, wherever this document claims it, is identity of this file.

The trace of the counter scenario of the Scenarios section, abridged to the header with two of the
board's entries and to frames 0, 1, 10 and 40, each record one line in the file:

```json
{"scenario":"counter","seed":7,"framePeriod":16,"versions":{"pxt-core":"9.2.1","target":"6.0.14"},
 "surface":{"contributors":[{"id":"board","provider":"microbit"}],
  "inputs":[{"name":"button-a","contributor":"board","description":"the A button","class":"arrival",
   "values":{"enum":["press","release","click","long-click"]}}],
  "channels":[{"name":"display","contributor":"board","description":"the LED display",
   "rendering":"25 brightness digits 0-9, row-major"}],
  "events":[{"name":"display.show","contributor":"board","description":"text the board shows",
   "values":{"encoding":"the text"}}]}}
{"frame":0,"state":{"display":"0000000000000000000000000","pin 0":"0"},"events":[]}
{"frame":1,"state":{},"events":[]}
{"frame":10,"state":{"display":"0900099000090000900009990"},"events":[["display.show","1"]]}
{"frame":40,"state":{"display":"9990000090099009000099990"},"events":[["display.show","2"]]}
```

The header is wrapped here for the page; in the file it is one line with no spaces. Frame 0 holds
every channel, frame 1 changed nothing, and the click due at frame 10 was applied before that
frame's handlers ran, so the show event and the new display pixels are both in frame 10's record.

## Shells over one driver

Composition, dispatch, observation and evaluation live in one shared headless driver in core. The
shells are thin:

- `pxt simtest` takes a project directory with its scenario files, found throughout the project
  (the `--base` form with single `.ts` files stays as a convenience for smoke tests), compiles the
  project, runs each scenario and reports verdicts and the trace. It resolves the composed surface
  in Node: the board's kinds from the target's core bundle, a program contributor's from the
  declaration it publishes, a module's from the attachments the staging declares.
- A Node caller drives the driver programmatically with the same inputs.
- A browser worker loads `pxtsimcore.js` and `simcore.js`, installs the virtual host and the silent
  audio host, and runs the same driver; results come back as worker messages. A simulator extension
  hosting this shell takes the bundle URLs and each attachment's core URL from the `projstaging`
  read reply (Scenarios).

Every shell offers two operations over a staging and its compiled programs: run a scenario, and
surface, which runs each program to its first frame boundary, returns the composed surface as the
trace header carries it, and stops. The surface operation is how an editor tab learns what a
scenario may name without running one.

A contributor reachable from one shell and not another is a defect. The run options a project
implies (board definition, parts, function arguments, dependencies, stored state) are assembled by
one function in pxt that the command line and the editor both call; two hosts given different
options do not produce the same trace.

## Worlds with several simulators

The world is the unit of a test; one simulator is the degenerate case.

- N runtimes in lockstep on one virtual clock, each advanced one frame at a time in a fixed order
  by board id. A runtime is a global per context, so a multi-simulator world is one Node `vm`
  context, or one worker, per board, with an orchestrator that advances each host's virtual clock
  in turn.
- Names gain the board id as an outer name, as Composition states.
- The trace is per world and carries every board's record.
- The project is one project deployed to several boards (the radio case) or a set of projects,
  one per board, named in the scenario.

Worked example: three micro:bits on one radio group, two stationary, one moving along a scripted
path. The stationary boards read signal strength and report when the moving board is near. The
path is an input to the spatial world addressed to the moving board; the strength each stationary
board reads is derived by the radio ether from positions; the reports are those boards' own
display or serial events, unchanged. One project runs on all three boards:

```json
{
  "seed": 3,
  "frames": 300,
  "staging": {
    "boards": [
      { "id": "board 1", "project": "." },
      { "id": "board 2", "project": "." },
      { "id": "board 3", "project": "." }
    ],
    "media": [
      { "id": "ether", "kind": "radio", "params": { "group": 7, "loss": "none" },
        "attached": ["board 1", "board 2", "board 3"] },
      { "id": "space", "kind": "spatial",
        "params": { "positions": { "board 1": "0,0", "board 2": "40,40", "board 3": "0,40" } },
        "attached": ["board 1", "board 2", "board 3"] }
    ]
  },
  "inputs": [
    { "kind": "space.path board 3", "at": 0, "value": "0,2 over 200" }
  ],
  "expectations": [
    { "event": "board 1.serial", "value": "near", "window": { "from": 150, "to": 299 } },
    { "event": "board 2.serial", "value": "near", "window": { "from": 0, "to": 299 }, "not": true }
  ],
  "watch": ["board 1.serial", "board 2.serial", "ether.strength board 1-board 3"]
}
```

Board 3 moves from `0,40` to `0,2` over 200 frames, so the strength board 1 reads climbs and board
2's does not; the `near` line is each board's own report. Every board's name is prefixed by its id
because there are several, and the media are not, because they belong to the world.

## Media and topology

A medium is a contributor at the world level that connects boards and modules. A board or module
attaches to one or more typed media; which media exist is a platform supply; attach and detach are
host-invoked operations; a group or address within a medium is isolated from other instances of
that medium.

- Media are explicit instances with ids. Two jacdac buses are two media; a shield is one; a radio
  group is a parameter of the ether.
- The radio ether delivers frames between the boards attached to it at frame boundaries in stable
  order and stamps each delivery with a signal strength: scripted per link through the ether's
  `ether.strength <a>-<b>` input kind, or derived from the two boards' positions by a deterministic
  propagation model quantized to whole dBm. The ether's channels report per-link strength either
  way.
- The spatial world owns positions. Its input kinds place a board or module or move it along a
  path; its channels report positions as compound values.
- The jacdac bus carries module frames among the boards and modules attached to it. An attach
  presents the module to the board's device stack exactly as a real device appearing on the bus
  would, announce included, under a device identity derived from the run seed and the module's
  role, so the same scenario always sees the same device; a detach is the reverse, the device
  going quiet and the stack timing it out as it would a real one.
- The display shield is a medium that takes exactly one board. Its headless core is the screen
  buffer; its visual host is the simulator extension frame.
- Topology is staging data. The staging declares the initial attachments with each medium's
  parameters (radio group, bus, shield slot); attach and detach are input kinds of the medium,
  their value the role of a module or, in a world of several boards, a board id, so a test can
  unplug a module at a frame and check that its role reads as absent, or plug one in and check that
  the program noticed.
- Hot plugging. A module listed in the attachments but in no medium's initial topology is in the
  surface and starts absent; `<medium>.attach` at frame N makes it present, the board's handlers
  seeing it from frame N+1 because media propagate after boards step, and `<medium>.detach` renders
  it absent again. The medium emits `<medium>.attached` and `<medium>.detached` events with the
  role as the value in the frame the change takes effect, so an expectation can check the plug
  itself and not only the program's response.
- The same operations are an API in the live simulator: the simulator coordinator routes extension
  traffic by topology instead of broadcasting a channel to every extension frame, and exposes link
  and unlink calls. The editor's live topology is both user-driven UI state and project state: the
  project's `staging.json` is the default, written through `projstaging` by the extension whose tab
  edits a medium, and a test or an API call overrides it for a run.

A button module plugged into a bus at frame 30 and pulled at frame 70, the program showing text on
each change and the module's own channel read while it is present:

```json
{
  "frames": 90,
  "staging": {
    "attachments": [
      { "board": "board", "role": "button 1", "module": "example/pxt-bus-modules",
        "kind": "button" }
    ],
    "media": [{ "id": "bus 1", "kind": "jacdac", "attached": ["board"] }]
  },
  "inputs": [
    { "kind": "bus 1.attach", "at": 30, "value": "button 1" },
    { "kind": "button 1.press", "at": 50, "value": "click" },
    { "kind": "bus 1.detach", "at": 70, "value": "button 1" }
  ],
  "expectations": [
    { "event": "bus 1.attached", "value": "button 1", "window": { "from": 31, "to": 31 } },
    { "event": "display.show", "value": "hello", "window": { "from": 31, "to": 40 } },
    { "channel": "button 1.pressed", "value": "false", "window": { "from": 31, "to": 49 } },
    { "event": "display.show", "value": "bye", "window": { "from": 71, "to": 80 } }
  ]
}
```

`button 1` is in the surface from frame 0 and absent until frame 31; its channel carries a value
from 31 to 70 and is absent again after.

The radio ether's model surface. Control over who sees which radio messages, and the real-world
nondeterminism it stands in for, is a set of parameters and input kinds of the ether, every one
deterministic given the run seed; nothing in it is real randomness. The vocabulary follows Cooja's
per-link medium, netem's impairment set, and the seeded discrete-event simulators (ns-3, OMNeT++,
BabbleSim):

- A link matrix: `ether.link <a>-<b>` is an input kind, on or off at a frame, and a channel
  reporting the link's state; the staging sets the initial matrix. Deterministic by construction.
- A strength per link, `ether.strength <a>-<b>`: an input kind that sets it at a frame, and a
  channel reporting it in whole dBm whichever way it was arrived at.
- A loss model, for the ether or per link: none, a Bernoulli rate, or Gilbert-Elliott (a good and
  a bad state, two transition probabilities, a loss rate in each). The ether draws from a random
  stream of its own, derived from the run seed and the medium's id, so one seed gives one drop
  pattern and changing a loss parameter never changes the random numbers a program draws.
- Delay in whole frames, with optional jitter and duplication; reordering arises only when delay
  varies.
- A drop event per link, `ether.drop <a>-<b>`, emitted for every frame the matrix, the loss model,
  a collision or the reception curve removes, with the cause as the value.
- Collisions as a switch: two boards transmitting in the same frame, both within range of a
  receiver, both lose the frame at that receiver.
- Strength from distance: log-distance path loss with seeded shadowing gives a per-link strength
  from positions, and a reception curve turns strength into loss.

Model parameters are staging data of the medium and input kinds of it, so a scenario can degrade a
link mid-run.

## Recording and replay

A run is recorded at the grain of the host seams, not as a call-ordered log of nondeterministic
calls, so a recording replays against a changed program as well as against the one it was made
from. The core reaches every source of nondeterminism through a seam: `host.clock()` and
`host.timers()`, `host.rng()`, and inputs through `apply`. A live-captured sensor is an input like
any other: the microphone level, the accelerometer fed from device motion, the light level, and
recorded audio, whose recorder-host seam hands back a clip.

- A recording is the run seed, the clock delta of each frame, the inputs at frame grain as
  `(kind, at, value)`, and the project and version record of the scenario. A captured clip or
  other bulk value is a file beside the scenario.
- Replay of the same program advances the virtual host by the recorded deltas, seeds `host.rng()`
  with the recorded seed, applies the inputs at their frames, and reproduces the run exactly: the
  same random numbers in the same order, the same timer firings, the same trace.
- Replay against a changed program keeps the inputs and the seed and drops the clock deltas for the
  nominal frame period. The world is the same; the behavior differs.
- Live-capture sensors in a headless run read the scenario's values through `apply`, so a program
  that polls the sound level three times in a frame reads the frame's recorded level three times.

The live simulator takes a seeded random source with the seed chosen at run start and logged, and
logs its frame deltas, so a run a user saw replays exactly. The recorder is the live driver's: it
subscribes to the inputs the view applies (the same primitives the headless protocol reaches over
its input message), stamps each with the frame it landed in, and writes the scenario.

A six-frame recording of a user pressing and releasing A while the light changed, as the recorder
writes it:

```json
{
  "seed": 48213,
  "frames": 6,
  "clock": [16, 16, 17, 16, 33, 16],
  "inputs": [
    { "kind": "button-a", "at": 2, "value": "press" },
    { "kind": "button-a", "at": 4, "value": "release" },
    { "kind": "light-level", "at": 5, "value": 62 }
  ],
  "versions": { "pxt-core": "9.2.1", "target": "6.0.14" }
}
```

A recording carries no expectations until someone adds them; the trace the live run produced is
committed beside it as the golden, so the first check a replay makes is byte identity with what
the user saw. The fifth frame took 33 milliseconds live, and the replay advances the host by 33
there too; replayed against a changed program, `clock` is dropped and every frame is 16.

## Conformance

- A fixture contributor (one channel, one kind, one event kind) runs through the driver alone, and
  again as two attachments of one module under two roles, proving composed names and order.
- Same seed, same inputs, same frames give byte-identical traces in a worker and in Node.
- The fixture emits one event per frame it is poked; the event is in the trace once, in emission
  order, never derived from a state diff.
- A recording of a run replays to a byte-identical trace in Node and in a worker.
- Two boards exchanging frames over the ether receive each other's frame at the same frame offset,
  whichever board id is lower.
- The evaluator holds a point window, a negated level and a negated arrival; a watch list changes
  the report and leaves the trace byte-identical.
- Every frame a loss model removes is matched by one drop event on its link, and a bare link
  matrix emits none.
- A trace parses record by record, its header record's surface equals the composed surface
  declared for its staging, and re-serializing the parsed records reproduces the file byte for
  byte.

## Status

What exists and what does not, section by section. A change that lands a piece edits its line.

- Foundations in place: the virtual host (seeded random source, frame queue, `advance` and
  `runUntil`), the silent audio host, the view-less runtime (`pxsim.initHeadlessRuntime`;
  pxt-microbit's `initHeadlessDalBoard`), `pxt simtest` with the `@serial` golden and the `--core`
  run, and the two headless bundles (`pxtsimcore.js` and a target's `simcore.js`; pxt-microbit
  ships one).
- Contributors: no contributor interface exists in core. The board's typed input primitives and
  the headless board view with its snapshot are a proposal in pxt-microbit's `sim/README.md`, not
  code. The program-message channel exists (`control.simmessages`, pxt-common-packages
  `libs/base/controlmessage.ts` over `libs/base/sim/core/controlmessage.ts`) with no registration
  or declaration over it and no `libs/harness`. The simulator extension
  configuration has no `core` entry. No module and no medium implements the shape, and no
  declaration is structured (class, values, rendering, docs).
- Composition, values, state and events: not started. There is no composed surface, no dispatch
  table and no trace record; a program's serial output reaches `simtest` through the serial
  message alone.
- Scenarios: not started. `pxt simtest` takes programs, and `@serial` is the only expectation. No
  `staging.json` and no `projstaging` family exist, and no request family lets a simulator
  extension read or write project files.
- The scenario file and the trace format: not started. `simtest` reads no scenario file and
  writes no trace.
- The trace and the shells: not started. `simtest` is the one shell, and the only headless driver
  is `runHeadlessAsync` in `cli/simtest.ts`, which runs one runtime in one `vm` context. No shell
  offers the surface operation.
- Worlds with several simulators: not started.
- Media and topology: not started. The radio simulator (pxt-common-packages
  `libs/radio/sim/core/`) posts each packet as a broadcast `radiopacket` message with a fixed
  default signal strength and the coordinator relays it to the other board frames; there is no
  medium, link matrix or propagation model.
- Recording and replay: not started. The live simulator runs on the default host (`Date.now`,
  `Math.random`) with no seed and no frame log.
- Conformance: none of the checks exists.
