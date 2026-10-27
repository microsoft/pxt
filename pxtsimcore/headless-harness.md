# The headless test harness

The design of the test harness the headless layer builds toward, above `pxt simtest`. `headless-
harness-overview.md` beside this file is the short tour to read first, `README.md` describes the
layer as it stands, the Status section at the end of this file says which parts of the harness
exist, and `headless-harness-plan.md` is the order the rest lands in. A test is a project plus a
scenario, and it runs from the command line, from Node and in a browser worker over the same driver,
producing the same trace. The unit of time is the frame (`FRAME_MS` on the virtual host): a scripted
input is due at a frame, an expectation holds over a window of frames, and every record in the trace
is indexed by frame.

## Contributors

A contributor is anything in a staged world that a scenario can script or a test can observe.
One shape serves every source:

- `id`: durable and unique in the world. `board` for the simulator's own device; a role name for
  a module an extension attaches (the role as the user spelled it); a key for a program
  contributor; a medium's id.
- `provider`: who declares it, for attribution: the target for the board, the extension's
  `owner/repo` for a module or a program contributor, the platform for a medium it supplies and the
  extension's `owner/repo` for one an extension ships.
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
- `saveState()` and `restoreState(data)`, optional: the contributor's settled state at a frame
  boundary as plain JSON in a shape of its own carrying its own format version, and the same data
  taken back (Saving and restoring). A contributor without them makes its world unsaveable.

Four sources implement it:

- The board: `apply` is a typed input through the core primitives (`{ kind: "click", button: 1 }`
  and its kin), `readState` is the headless board view's state rendered per channel, and the
  view's change signal carries its events.
- A module: a simulator extension's DOM-free core, attached to a board over a medium, or a module
  the platform supplies, attached to the board directly. An extension whose simulator exists only as
  an iframe page has no headless form and contributes nothing to a headless run; it ships a core to
  be testable.
- A program contributor: code inside the compiled program that registers over the program-message
  channel under a key of its own, a short name the extension chooses. It publishes its
  declaration when it registers, drains its inbox at the start of each
  frame so an input due at frame N is applied before frame N's handlers run, and posts its state
  and events at the end of each frame so the driver reads them without a round trip.
- A medium: a world-level contributor that connects boards and modules, or models the space they
  share (below). The platform supplies the media a target's own cores speak to; an extension ships
  a medium of its own the way it ships a module.

How a program contributor registers. The contract is a set of messages over the program-message
channel, so a program in any language can speak it; the `harness` library in pxt-common-packages
(`libs/harness`, depending on `core`, a `harness` namespace whose only blocks are the scenario
calls) is the wrapper a program normally uses, and an extension that contributes depends on it. Its
functions are `shim=TD_NOOP` with simulator-only bodies, so a program contributor compiles to
nothing on hardware and the posting loop runs only in the simulator. The library and the program's
own contributor code compile under pxt's static TypeScript subset, so they use only what that subset
offers. The program sends its declaration on the `harness` channel from its start-up code: a JSON
object with `key`, `provider`, `docs` and the `inputs`, `channels` and `events` lists of entries in
the shape above, names bare. The driver runs the program to its first frame boundary, collects the
declarations, and fixes the composed surface before frame 0 is dispatched; a declaration arriving
later and one whose key is already registered or taken by another outer name are each refused with a
stable code naming the key, the first registration standing and the program running on without a
contributor. Inputs arrive on the `harness.<key>` channel, one message per input, `{ "kind", "value"
}` with the kind bare and the value as the scenario wrote it; the driver posts every input due at
frame N before frame N's handlers run, in scenario order, and the program applies each through the
contributor's own seam, its handler receiving the scalar. The program posts on the `harness` channel
once per frame, from a loop the library runs at the frame period it reads from the simulator host,
`{ "key", "state", "events" }` with `state` an object of bare channel names to rendered strings and
`events` the `[name, value]` pairs emitted since the last post, in emission order; the driver stamps
the post with the frame it arrives in, prefixes the key, and reads it in its post-step with no round
trip. A program that declares and never posts renders its channels absent.

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

How a module is found. A simulator extension is declared in the target's `approvedRepoLib` under its
`owner/repo` with a `simx` entry naming its iframe page; the entry has a `core` field, the path
within the repository of a DOM-free script. The script is plain JavaScript with the full standard
library, never static TypeScript: the driver loads it into the same context as the target's core
bundle, as `pxtsimcore.js` and `simcore.js` are loaded, and as it loads the script calls
`pxsim.harness.defineModule(kind, factory)` once per kind of module the extension stands for (a
slider, a button, a servo), `factory` taking an attachment's config and the driver's `emit` and
returning a contributor; the driver pairs each call with the script it is loading, so the script
names no repository. An extension with no `core` field is the iframe-only case. Nothing registers at
test time: an attachment, from the project's staging file or the scenario's staging, names the
extension as its `module` by `owner/repo` and the kind as `kind`, omitted when the core defines one
kind, and the driver builds one contributor per attachment from that kind's factory, under the
attachment's role, with the `owner/repo` as its `provider`. A core script defines a medium the same
way, `pxsim.harness.defineMedium(kind, factory)`, the factory taking the medium's params and the
driver's `emit` and returning a contributor that also carries `propagate(deliver)`, the step a
medium runs after the boards: `deliver(id, name, value)` delivers a value to an attached board under
a quantity its attachment map names, or to a medium listed after this one under one of that medium's
own kinds, and delivers nothing for a quantity the map leaves out. A medium declares two lists a
module does not: `quantities()`, entries `{ name, description, values, docs? }` for each quantity
its propagate step applies to a board, and `params()`, entries of the same shape for each field its
staging `params` accepts, so a staging editor or a tool can validate and write a staging for a
medium it has never seen; a map key must be a declared quantity and a map value one of the board's
own kinds. A staging's media entry names the extension as its `module` by `owner/repo` and the kind
as `kind`, and omits `module` for a medium the platform supplies. How the module exchanges frames
with the board is the contract of the medium it is attached over (Media and topology). In the live
simulator the extension's page builds the same core source into itself, calls the factory directly
and renders the contributor's state, so the contributor is the model in the headless run and in the
frame alike; `core.js` is the entry that wraps the factory in the `defineModule` call for the
driver's context, where `pxsim` exists, and the page needs no `pxsim`. How the page observes the
core is the extension's business, and the core knows nothing of the page.

A slider whose repository is `example/pxt-slider`. The target's `approvedRepoLib` entry:

```json
{ "example/pxt-slider": { "simx": { "index": "index.html", "core": "built/core.js" } } }
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

A medium from an extension `example/pxt-lamps`: a world of lamps at fixed positions, each board
reading a light level that falls off with distance from every lamp. Its `built/core.js`:

```js
pxsim.harness.defineMedium("lamps", (params, emit) => {
    const lamps = params.lamps;
    const boards = params.boards;
    const level = id => {
        let sum = 0;
        for (const lamp of lamps) {
            const dx = lamp.x - boards[id].x, dy = lamp.y - boards[id].y;
            sum += lamp.lumens / (1 + dx * dx + dy * dy);
        }
        return Math.min(255, Math.round(sum));
    };
    return {
        inputKinds: () => lamps.map(l => ({ name: "lamp " + l.id + ".lumens",
            description: "how bright the lamp is", class: "level",
            values: { range: [0, 100000] } })),
        stateChannels: () => Object.keys(boards).map(id => ({ name: "light " + id,
            description: "the light level the world gives the board",
            rendering: "0 to 255" })),
        eventKinds: () => [],
        quantities: () => [{ name: "light", description: "light falling on a board",
            values: { range: [0, 255] } }],
        params: () => [
            { name: "lamps", description: "the lamps: id, x, y, lumens each",
              values: { encoding: "array of { id, x, y, lumens }" } },
            { name: "boards", description: "each attached board's x and y by id",
              values: { encoding: "object of id to { x, y }" } }],
        apply: (kind, value) => {
            lamps.find(l => "lamp " + l.id + ".lumens" === kind).lumens = value;
        },
        readState: () => Object.fromEntries(
            Object.keys(boards).map(id => ["light " + id, "" + level(id)])),
        propagate: deliver => {
            for (const id of Object.keys(boards)) deliver(id, "light", level(id));
        },
    };
});
```

A scenario staging it on one board, mapping its light quantity to the board's own light-level kind,
and dimming the lamp at frame 20:

```json
{
  "frames": 40,
  "staging": {
    "media": [
      { "id": "world", "kind": "lamps", "module": "example/pxt-lamps",
        "params": { "lamps": [{ "id": "1", "x": 0, "y": 10, "lumens": 20000 }],
                    "boards": { "board": { "x": 0, "y": 0 } } },
        "attached": [{ "id": "board", "map": { "light": "light-level" } }] }
    ]
  },
  "inputs": [{ "kind": "world.lamp 1.lumens", "at": 20, "value": 2000 }],
  "expectations": [
    { "channel": "world.light board", "value": "198", "window": { "from": 0, "to": 19 } },
    { "channel": "world.light board", "value": "20", "window": { "from": 21, "to": 39 } }
  ]
}
```

The world's `propagate` applies the level to the board under the quantity `light`, which the
attachment maps to `light-level`, so the program reads 198 from frame 1 and 20 from frame 21; a
board whose map named no `light` would read nothing from this world. The world knows no sensor and
no target, only the quantity and the id. With this staging the board's `light-level` is a driven
kind: the surface marks it as driven by `world`, and a scenario that scripts it is rejected, because
the world would overwrite the input on the next frame.

Rules every contributor obeys:

- The driver observes, never reconstructs. `readState` renders state the contributor itself holds
  and settled during the frame; `emit` is called at the moment the event happens. Nothing
  reconstructs another contributor's state or events from the outside, and no event is derived
  from a state diff.
- Reads are pure. `readState` changes nothing.
- Deterministic. Same seed, same scripted inputs, same frame count give the same state and events,
  byte for byte. Entropy only through `host.rng()` or a stream the driver hands out by name.
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
  contributor's is `<key>.<name>` (`game.score`), and a medium's is `<id>.<name>` (`ether.link board
  1-board 3`, `bus 1.attached`). The board's names are bare; it is the one contributor every world
  has. In a world of several simulators the board id is the outer name of everything on that board
  (`board 2.display`, `board 3.slider 1.position`), omitted when there is one. A composed name is
  matched whole against the declared surface and never split on its separator, so a role may contain
  any character the editor lets the user type; the one split is of the board's own names, on their
  first `.`, for the collision check below. The extension that declares a contributor is its
  `provider`, for attribution, and is never part of a name: two instances of one extension are told
  apart by role, and a role reads as the user spelled it.
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
  input's value against its kind's `values`; a rejection lists the composed names. A board kind
  that a staged medium's attachment map targets is driven: the surface carries the medium's id on
  it as `drivenBy`, and a scenario that scripts a driven kind is rejected, since the medium would
  overwrite the input on the next frame. A staging whose map names an undeclared quantity or a
  kind the board does not declare, or whose `params` carry a field the medium does not declare, is
  refused before the first frame.
- Dispatch, per frame: route the inputs due this frame to their contributors; the contributors' pre-
  step; the runtime's frame; the contributors' post-step folds the posts received during the frame
  into state; the driver reads every contributor's `readState` once and merges in composed order,
  and collects the events emitted during the frame in emission order. Every board takes its frame
  first and every medium propagates after, in the order the staging lists the media, so a radio
  frame sent on frame N reaches its receivers on frame N+1 whichever board sent it, delivery latency
  never depends on board order, and a medium listed before another can feed it within the frame. The
  composed surface keeps its order by id whatever the staging's order.

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
pixels at 4 bits each, 9600 bytes a frame) renders as a content hash instead: FNV-1a 64-bit over the
channel's bytes (for a screen, the framebuffer followed by the palette), as 16 lowercase hex digits,
so every shell renders the same value and a changed frame costs the trace one short line. The bytes
themselves are a bulk value the driver hands the shell under the serialized-state rule of Shells
over one driver, on request through a run option and for the frame a bulk-channel expectation fails
at; a shell with files keeps them beside the scenario. A check finer than the whole channel is a
probe: a module the platform supplies, staged as an attachment under a role with its probe list as
config and no `module`, attached to the board directly, so it composes as any module does. Each
probe is one declared channel (`probe.pixel 10,20` reads a color index, `probe.region 0,0,16,16`
reads that region's hash), so the surface stays small and fixed and an expectation stays one line. A
probe has no kinds of its own and reads the board's screen through a seam the board exposes for
probes, purely and deterministically; that seam is the one place a contributor reads state it does
not hold.

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

A scenario is a file in the project, or the same declarations made from static TypeScript the
project compiles (below). It declares:

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
- Optionally, the frames to save at: the run produces the world's saved state at each, and the
  shell decides where it goes, a file beside the scenario for a shell with files (Saving and
  restoring).
- Optionally, a save to start from, named by where the shell finds it or carried whole: the run
  restores it and continues. Frames stay absolute, so `frames` must exceed the save's frame, an
  input due at or before it is rejected, and windows read as the tail of the run that made the save.
  The scenario carries no staging; the world is rebuilt from the staging the save carries, and a
  rebuilt world whose surface digest differs from the save's is refused before the first frame.
- Optionally, a versions pin: the pxt-core, target and pinned dependency versions the scenario holds
  for. A shell refuses to run a pinned scenario at any other version, which is what a comparison of
  traces across shells needs. The versions a run actually ran under are recorded in the trace header
  whether or not the scenario pins them.

The file is JSON, `<name>.scenario.json`, anywhere in the project: beside `pxt.json` or in any
folder of it, a simulator extension's project folder included (a dependency's own files are not the
project's), and the trace and any bulk-value files land beside it. A shell finds every
`*.scenario.json` the project holds. Its fields are those declarations: `"seed"`; `"frames"`;
`"staging"` with `"boards"` (`{ "id", "project" }` entries, `project` a path relative to the file,
the array omitted for the one-board case), `"attachments"` (`{ "board", "role", "module", "kind",
"config" }` entries) and `"media"` (`{ "id", "kind", "module", "params", "attached" }` entries,
`module` only for a medium an extension ships, `attached` the initial topology as a list of ids or
of `{ "id", "profile", "map" }` entries, `profile` the name of one of the radio profiles the board's
target declares and `map` the quantity-to-kind map, a bare id standing for the target's default
profile and an empty map); `"inputs"` (`{ "kind", "at", "value" }` entries); `"expectations"` (`{
"channel", "value", "window" }` level entries and `{ "event", "value", "window" }` arrival entries,
`window` as `{ "from", "to" }`, `"not": true` for a negated form); `"watch"` (an array of composed
names); `"framePeriod"`; `"clock"` (an array of `frames` integers); `"saves"` (an array of frame
indices); `"from"` (the path of a save file relative to the scenario, or the save itself as an
object); and `"versions"`, the pin. A field a scenario does not need is omitted; `frames` is the one
required field.

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

The project's staging file is `staging.json` beside `pxt.json`, holding one `staging` object in the
scenario's shape, and it is project state: the live simulator starts from it, a scenario without a
`staging` runs on it, and it travels with the project. Extensions reach it through a request family
of its own, `projstaging`, gated by a registration flag of its own, as every project access a
simulator extension has is: a read returns the file with, for each attachment, the URL of its
module's core script and, once, the URLs of the headless bundles; a write replaces the entries the
writer owns; a subscription delivers a change notification whenever the file changes. An extension
that edits topology writes the media and attachments it owns; a reader takes the whole file and
learns which extension declared an entry from the entry's own `module` and `kind`.

A scenario in static TypeScript. Any file the project compiles may declare scenarios through the
`harness` library instead of writing the file: a test file, which `pxt.json` lists as `testFiles`
and a build of the project compiles unless told to ignore tests, never a dependency's; or a program
file, where a declaration costs a hardware build nothing and the live simulator ignores it, and
which is the only place blocks reach. Each `harness.scenario(name, fields, declare)` call names a
scenario, gives the fields the file would carry outside its list-like ones (`seed`, `frames`,
`framePeriod`, `staging`, `clock`, `from` as a path, `versions`), and declares inputs, expectations,
the watch list and the frames to save at through the handle it passes, `input`, `expectChannel`,
`expectEvent`, `expectNoChannel`, `expectNoEvent`, `watch` and `save`, each call repeatable so a
loop can declare many. The library sends the declaration over the `harness` channel as it sends a
contributor's; the driver runs the program to its first frame boundary and takes every scenario
declared; the shell runs each as it would a `<name>.scenario.json` beside the declaring file and
keeps the trace there under that name. The declared form is data, not behavior: the handle takes
values only, a declaration after the first frame boundary is refused with a stable code, and a shell
writes any declared scenario out as its file on request, so the two forms are one scenario in two
syntaxes and a tool that reads files reads both. A scenario's name is its file's basename or its
declared name, and names are unique across the project whichever form they take: a declared
`counter` beside a `counter.scenario.json`, or two declarations of one name, is a collision refused
before any run, as roles and keys are. Scenario calls are `shim=TD_NOOP` like the rest of the
library and reach no hardware build. The counter scenario, declared in place of its file:

```ts
harness.scenario("counter", { seed: 7, frames: 120 }, t => {
    t.input("light-level", 0, 180)
    t.input("button-a", 10, "click")
    t.input("button-a", 40, "click")
    t.expectEvent("display.show", "2", 40, 60)
    t.expectChannel("display", "0000000000000000000000000", 100, 119)
    t.expectNoEvent("serial", "error", 0, 119)
    t.watch(["display", "display.show", "serial"])
    t.save(40)
})
```

Running it produces the trace the file form produces, byte for byte. Declared from a program file
the form is reachable from blocks, so a test of a program can be authored in the editor the program
was.

The expectation semantics are defined here, once, and pxt's evaluator implements them. A consumer
that carries scenarios in a shape of its own implements the same semantics and checks against
this evaluator: the same scenario yields the same verdicts.

## The trace

The trace is the complete observation record: per frame, the state deltas in composed order and the
events in emission order. It is the test's artifact and the replay oracle; a report (verdicts first,
then the change log over watched entries) is a view over it. The `@serial` golden is a projection of
the trace's serial events and stays as a smoke oracle.

Two runs of one test produce the same trace when both run the same pxt-core, the same target version
and the same pinned dependencies, and so the same compiled JavaScript and the same two headless
bundles (`pxtsimcore.js` and the target's `simcore.js`). A test records those versions, and a
comparison across shells is valid only at equal versions. Program contributors are compiled into the
program and identical across shells by construction; the board contributor is the target's core
bundle in every shell; a module has its core in every shell. One caveat: transcendental math
(`Math.sin` and its kin) is not bit-identical across JavaScript engines, so identity holds across
shells on one engine, and across engines only for traces whose rendered values are quantized past
the last bit, as the display's one-digit brightness is.

## Trace format

The trace is JSON Lines text, one JSON record per line, a header record first and then one record
per frame in frame order; a shell with files keeps it as `<name>.trace.jsonl` beside the scenario.
Every record is serialized canonically, so one trace is one byte sequence: no whitespace outside
strings, keys in the order given here, state keys in composed order, strings escaped as JSON
requires, and every number in its shortest round-trip JSON form. Within a surface record the keys
follow the order the Contributors section lists the fields, `name` and `contributor` first, and an
optional field that is absent is omitted, never written as `null`.

- The header record: `{"scenario": name, "seed": n, "framePeriod": ms, "from": {...}, "versions":
  {...}, "surface": {...}}`. `from` is present for a run that started from a save and holds the
  save's frame and surface digest; a frame record then starts at the frame after it and the first
  record holds every channel, as frame 0's does. `versions` holds `pxt-core`, `target` and then each
  pinned dependency by name, each a version string, the dependencies in ascending order of name.
  `surface` is the composed surface: `"contributors"`, an array in composed order of `{ "id",
  "provider", "docs" }` records, and `"inputs"`, `"channels"`, `"events"`, `"quantities"` and
  `"params"`, each an array in composed order of the declared entry records with the composed name
  as `name` and the declaring contributor's id as `contributor`, an input record of a driven kind
  carrying `drivenBy`, a quantity or param record named like any other (`world.light`) while an
  attachment map keys quantities bare, so a trace describes itself without its scenario. The surface
  digest is FNV-1a 64-bit over the canonical bytes of the `surface` object, 16 lowercase hex digits;
  a shell or tool that caches or compares surfaces uses it, and every one computes the same one.
- A frame record: `{"frame": n, "state": {name: value, ...}, "events": [[name, value], ...]}`.
  `state` holds the channels that changed since the last frame, in composed order, every value a
  rendered string and `null` for a channel rendered absent; the first frame record holds every
  channel. `events` holds every event emitted during the frame as `[name, value]` pairs in emission
  order, every value a string. A frame with no change and no event is still a record, with an
  empty object and an empty array, so the frame count is the line count less one.
- Serial output is the `serial` events, and the `@serial` golden is the sequence of their values.
- Byte identity, wherever this spec claims it, is identity of the trace file.

The trace of the counter scenario of the Scenarios section, abridged to the header with one of the
board's entries per list and to frames 0, 1, 10 and 40, each record one line in the file:

```json
{"scenario":"counter","seed":7,"framePeriod":16,"versions":{"pxt-core":"9.2.1","target":"6.0.14"},
 "surface":{"contributors":[{"id":"board","provider":"microbit"}],
  "inputs":[{"name":"button-a","contributor":"board","description":"the A button","class":"arrival",
   "values":{"enum":["press","release","click","long-click"]}}],
  "channels":[{"name":"display","contributor":"board","description":"the LED display",
   "rendering":"25 brightness digits 0-9, row-major"}],
  "events":[{"name":"display.show","contributor":"board","description":"text the board shows",
   "values":{"encoding":"the text"}}],
  "quantities":[],"params":[]}}
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
  project, runs each scenario and reports verdicts and the trace. It runs in a target checkout,
  over the bundles the checkout builds, and in a project folder with the target's package
  installed, over the bundles the package ships. It resolves the composed surface in Node: the
  board's kinds from the target's core bundle, a program contributor's from the declaration it
  publishes, a module's from the attachments the staging declares.
- `mkc test` is the same command for a project author with no target checkout: the MakeCode CLI
  fetches the two headless bundles from the target's release beside the compiler it already
  fetches, compiles the project as `mkc build` does, and runs every scenario the project holds. A
  target's release therefore ships `pxtsimcore.js` and its `simcore.js` beside `pxtworker.js`.
- Either command runs every scenario by default and one or more by name when names are given,
  `mkc test counter`, the name being the scenario's name in either form.
- A Node caller drives the driver programmatically with the same inputs; the two commands above are
  thin front ends over it, so the shells are three: the command line, the Node caller and the
  worker.
- A browser worker loads `pxtsimcore.js` and `simcore.js`, installs the virtual host and the silent
  audio host, and runs the same driver; results come back as worker messages. A simulator extension
  hosting this shell takes the bundle URLs and each attachment's core URL from the `projstaging`
  read reply (Scenarios).

Every shell offers three operations over a staging and its compiled programs: run a scenario;
surface, which runs each program to its first frame boundary, returns the composed surface as the
trace header carries it, and stops; and save, which runs to a given frame and produces the world's
saved state (Saving and restoring), or takes one and runs on from it. The surface operation is how
an editor tab learns what a scenario may name without running one; the save operation is how a tab
saves on a button press, through the coordinator, and how a shell resumes a run.

The driver produces and consumes serialized state, never storage: a scenario in, and a trace, a
save, a bulk value or a recording out, each a byte sequence, JSON text or raw bytes, handed to the
shell that asked. Every shell maps those bytes to its own storage, files beside the scenario for the
command line, messages for the worker, and finds scenarios, resolves `from` paths and names files on
its own side of that line. Nothing in the driver opens a file.

A contributor reachable from one shell and not another is a defect. The run options a project
implies (board definition, parts, function arguments, dependencies, the simulator's stored settings)
are assembled by one function in pxt that the command line and the editor both call; two shells
given different options do not produce the same trace.

## Worlds with several simulators

The world is the unit of a test; one simulator is the degenerate case.

- N runtimes in lockstep on one virtual clock, each advanced one frame at a time in a fixed order by
  board id. A runtime is a global per context, so a multi-simulator world is one Node `vm` context,
  or one worker, per board, with the driver advancing each context's virtual clock in turn.
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
      { "id": "space", "kind": "spatial",
        "params": { "positions": { "board 1": "0,0", "board 2": "40,40", "board 3": "0,40" } },
        "attached": ["board 1", "board 2", "board 3"] },
      { "id": "ether", "kind": "radio", "params": { "group": 7, "loss": "none" },
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
2's does not; the `near` line is each board's own report. The spatial world is listed before the
ether so the strengths it computes reach it. Every board's name is prefixed by its id because there
are several, and the media are not, because they belong to the world.

## Media and topology

A medium is a contributor at the world level that connects boards and modules, or models the space
they share. A board or module attaches to one or more typed media; the platform supplies the media a
target's own cores speak to, the radio ether, the jacdac bus, the display shield and a spatial world
of positions alone, and an extension ships any other as a core; attach and detach are input kinds of
the medium; a group or address within a medium is isolated from other instances of that medium. A
medium reads nothing about a board but the parameters its attachment carries: the ether reads the
radio profile the attachment names, one of those the target declares (transmit power levels in dBm,
receiver sensitivity, band), and a world that drives sensors reads a map from the quantities it
models to the board's own input kinds, light to a micro:bit's light-level kind, so no medium names a
target or a sensor.

- Media are explicit instances with ids. Two jacdac buses are two media; a shield is one; a radio
  group is a parameter of the ether.
- The radio ether delivers frames between the boards attached to it at frame boundaries in stable
  order and stamps each delivery with a signal strength: scripted per link through the ether's
  `ether.strength <a>-<b>` input kind, by a scenario or by a world listed before the ether that
  computes it from positions. The ether's channels report per-link strength whichever applied it.
- The platform's spatial world owns positions and nothing else. Its input kinds place a board or
  module or move it along a path; its channels report positions as compound values; listed before
  the ether, it applies the per-link strength its propagation model computes, log-distance path loss
  with seeded shadowing quantized to whole dBm, when no richer world is staged.
- A richer world is a medium an extension ships: obstacles that move, surfaces with states,
  sources of light, sound and heat, an acoustic layer with echo, whatever its physics models, all
  inside one DOM-free core the driver runs headless and the coordinator runs live. Its layers are
  its internal structure; the harness sees one contributor whose kinds and channels name the
  things it models (`world.obstacle door.open`, `world.surface floor.wet`, `world.sound board 2`).
- Media feed one another through their declared kinds and nothing else. A world listed before the
  ether applies the per-link strength it computes through `ether.strength <a>-<b>` each frame, and
  applies the levels it computes to each board through the kinds its attachment map names; the
  board reads them on frame N+1 as it reads a radio frame. The ether never asks a world for
  anything; it reads what was applied to it.
- Medium contracts. The seam between a target's core and a medium is a named contract, and the
  platform ships one implementation of each: `radio` (frames in from a board's radio core,
  deliveries out to boards, each stamped with a strength), `jacdac` (module and board frames on a
  bus) and `shield` (one board's screen). An extension's medium either implements a contract, in
  which case the board's core attaches to it and the platform's medium of that contract is not
  staged, or stands alone and feeds. A board attaches to at most one medium per contract. The
  `radio` contract also fixes the names every implementation declares, `link <a>-<b>` and
  `strength <a>-<b>` as kinds and channels and `drop <a>-<b>` as an event, so a scenario and a
  telemetry view written against them run on the platform's ether and on an extension's radio
  alike; an implementation adds whatever else it models.
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
  stream of its own, handed to it by the driver and derived from the run seed and the medium's id,
  so one seed gives one drop pattern and changing a loss parameter never changes the random
  numbers a program draws; any medium that wants entropy asks the driver for a stream by name.
- Delay in whole frames, with optional jitter and duplication; reordering arises only when delay
  varies.
- A drop event per link, `ether.drop <a>-<b>`, emitted for every frame the matrix, the loss model,
  a collision or the reception curve removes, with the cause as the value.
- Collisions as a switch: two boards transmitting in the same frame, both within range of a
  receiver, both lose the frame at that receiver.
- Strength from distance belongs to the world that holds positions, the platform's spatial world or
  an extension's; the ether's reception curve turns the strength applied to it into loss.

Model parameters are staging data of the medium and input kinds of it, so a scenario can degrade a
link mid-run.

## Recording and replay

A run is recorded at the grain of the host seams, not as a call-ordered log of nondeterministic
calls, so a recording replays against a changed program as well as against the one it was made from.
The core reaches every source of nondeterminism through a seam: `host.clock()` and `host.timers()`,
`host.rng()` and the streams the driver hands out, and inputs through `apply`. A live-captured
sensor is an input like any other: the microphone level, the accelerometer fed from device motion,
the light level, and recorded audio, whose recorder-host seam hands back a clip.

- A recording is the run seed, the clock delta of each frame, the inputs at frame grain as
  `(kind, at, value)`, the staging, and the versions record of the scenario. A captured clip or
  other bulk value is a bulk value the shell keeps, beside the scenario where it has files.
- Replay of the same program advances the virtual host by the recorded deltas, seeds `host.rng()`
  with the recorded seed, applies the inputs at their frames, and reproduces the run exactly: the
  same random numbers in the same order, the same timer firings, the same trace.
- Replay against a changed program keeps the inputs and the seed and drops the clock deltas for the
  nominal frame period. The world is the same; the behavior differs.
- Live-capture sensors in a headless run read the scenario's values through `apply`, so a program
  that polls the sound level three times in a frame reads the frame's recorded level three times.

The live simulator takes a seeded random source with the seed chosen at run start and logged, and
logs its frame deltas, so a run a user saw replays exactly. The recorder is the live simulator's: it
subscribes to the inputs the view applies (the same primitives the headless protocol reaches over
its input message), stamps each with the frame it landed in, and produces the scenario for the
editor to keep.

A six-frame recording of a user pressing and releasing A while the light changed, as the recorder
produces it:

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

## Saving and restoring

A world's state can be saved at a frame boundary and restored into a fresh driver, so a long
session resumes after a reload, a run forks at a frame, and a tab rewinds without replaying from
zero. The frame boundary is the one safe point: every contributor's state has settled, every medium
has propagated, and every inbox is empty by construction.

- A save is one JSON value, serialized canonically: the driver's own state (the frame index, the
  inputs still due, the position of every random stream it handed out, the staging the world was
  built from, the surface digest), every contributor's `saveState()` in composed order, each board's
  runtime saved form (its heap, fibers, scheduler and board state, taken by the runtime's own
  mechanism), the compiled program of each board, and the versions record the trace header carries.
- The runtime's saved form carries the compiled program it was taken under, and a restore runs
  that program on the restoring runtime, so a save taken under one target version resumes under a
  newer one; the project's source may have moved on, and a restore resumes the program that was
  running.
- Every saved form carries a format version of its own, independent of any release number and
  bumped only when its shape changes: the driver's, the runtime's, each platform medium's and each
  extension's. A layer restores every version it has ever written; migration lives in
  `restoreState`, where old data arrives with its version. The versions record is recorded and
  never refused on; a restore is refused only by a layer that cannot read a format version it is
  handed, with a stable code naming the layer and the version, or by a surface digest that does
  not match the staging it is restored into.
- A contributor saves the minimum, since its saved shape is public from its first release:
  positions and states, the progress of anything moving, and anything in flight that has not yet
  reached a channel; nothing derived, which the next propagate step recomputes, and nothing a view
  owns. A contributor without `saveState` makes its world unsaveable, refused with a stable code
  naming the contributor rather than saved wrong.
- A save is the driver's operation, never the program's: a shell asks for it, a scenario's
  `saves` field asks for it at given frames, and a tab asks for it through the coordinator; the
  driver performs it at the next frame boundary. No program can request one, and the `harness`
  library has no call for it; `saveState` is the driver's call into each contributor during a
  save, as `readState` is during a frame.
- Serialization and storage are separate layers. The driver's save operation produces a save and its
  restore consumes one; the driver reads and writes no storage. Where a save rests is the shell's
  choice: `pxt simtest` and `mkc test` write a save the `saves` field asks for as
  `<name>.<frame>.save.json` beside the scenario and resolve a `from` path relative to the scenario
  before handing the driver the save; the worker shell has no files, so it returns a save as a
  message and takes one the same way, as a JSON string or the parsed object, and a tab keeps saves
  in browser storage and hands them back with no file in between. A file and a string in memory are
  the same save.
- Two saves of one scenario at one frame are byte-identical, and a run restored at frame N
  continues to the same trace from N as a run that never stopped.

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
- A save at frame N of the fixture world restores into a fresh driver and continues to a trace
  byte-identical from N to the unbroken run's; two saves at one frame are byte-identical; a save
  from each released format of every platform layer restores and continues the same way.

## Status

What exists and what does not, piece by piece. A change that lands a piece edits its line.

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
- Scenarios: not started. `pxt simtest` takes programs, and `@serial` is the only expectation; no
  scenario API exists in static TypeScript. No `staging.json` and no `projstaging` family exist, and
  no request family lets a simulator extension read or write project files.
- The scenario file and the trace format: not started. `simtest` reads no scenario file and
  writes no trace.
- The trace and the shells: not started. `simtest` is the one shell, and the only headless driver
  is `runHeadlessAsync` in `cli/simtest.ts`, which runs one runtime in one `vm` context and only
  in a target checkout. No target release ships the headless bundles, and the MakeCode CLI has no
  test command. No shell offers the surface or the save operation.
- Worlds with several simulators: not started.
- Media and topology: not started. The radio simulator (pxt-common-packages
  `libs/radio/sim/core/`) posts each packet as a broadcast `radiopacket` message with a fixed
  default signal strength and the coordinator relays it to the other board frames; there is no
  medium, link matrix or propagation model.
- Recording and replay: not started. The live simulator runs on the default host (`Date.now`,
  `Math.random`) with no seed and no frame log.
- Saving and restoring: not started. No contributor saves state, the driver has no saved form, and
  the runtime's saved form is designed apart from this spec.
- Conformance: none of the checks exists.
