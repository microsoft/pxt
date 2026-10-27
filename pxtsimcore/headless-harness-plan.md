# The headless test harness: implementation plan

`headless-harness.md` beside this file is the end state, and its Status section says which parts
exist. This file is the order the parts land in. Each phase lands in slices and leaves the layer
usable on its own once complete: it ships with the checks its "Lands when" clause names green, it
flips its lines in the Status section, and it edits this file when it changes the order of what
follows.

Phases are numbered for reference only; a later phase may land ahead of an earlier one when nothing
below depends on the gap.

Repositories: `pxt` (core and the command line), `pxt-microbit` (the board contributor, the first
target), `pxt-common-packages` (the program-message channel and the radio), `pxt-arcade` (the
screen), `pxt-mkc` (the MakeCode CLI's test command). A phase names which it touches.

Required reading before any work on a phase: "How agents work this plan", at the end of this file
above the Ledger. It binds every agent that reads, dispatches or implements from this file, and a
slice begun without it is not a slice of this plan.

## Phase 1: the driver over a fixture

The harness core with no real board: the contributor interface, composition, per-frame dispatch,
the trace, the scenario file and its evaluator, exercised through a fixture contributor alone.

- `pxt`: a `harness/` folder in `pxtsimcore/` with the contributor interface and its structured
  entries (class, values, rendering, bulk, docs), the composed surface with provider and
  contributor on every record, its digest, and its validation (names matched whole, values against
  each kind's `values`, collisions refused at staging by outer name), the surface operation (run
  to the first frame boundary, return the surface, stop), the per-frame dispatch over the virtual
  host (route, pre-step, frame, post-step, one `readState` per contributor, events in emission
  order), the canonical JSON Lines trace writer and reader, the scenario file reader (seed, frames,
  frame period, staging, inputs, expectations in both forms with negation, watch, versions pin),
  the evaluator, and the report (verdicts, then the watched change log). The fixture contributor
  of the spec's Conformance section (one channel, one kind, one event kind) lives in
  `tests/simcore-test/` and runs through `gulp testsimcore`.
- Depends on: nothing beyond the virtual host.
- Lands when: the fixture runs alone and as two attachments under two roles, staged through a
  test-only in-process `defineModule` since no `core` loading exists yet, with the composed names
  and order the spec gives; the evaluator holds a point window, a negated level and a negated
  arrival; a watch list changes the report and leaves the trace byte-identical; a trace parses and
  re-serializes byte for byte; the fixture's event appears once, in emission order; the surface
  operation returns the header's surface for the two-attachment staging and the same digest twice;
  an input whose value is outside its kind's `values` is rejected by composed name.
- Status lines: Composition, values, state and events; Scenarios; the scenario file and the trace
  format; the trace and the shells (the driver exists, `simtest` not yet over it).

## Phase 2: the board contributor and `pxt simtest` over scenarios

The first real contributor and the first shell.

- `pxt-microbit`: the typed input primitives of `sim/README.md` as `sim/core/` code, one function
  per input applying to `DalBoardState` and queuing the matching events, called by the pointer
  handlers in `sim/visuals/` so a scripted input takes the path a real one takes; the headless
  board view whose `updateView` snapshot renders the board's channels (display as 25 brightness
  digits, pins, servo angles, neopixels) and whose change signal carries the board's events
  (`serial`, `display.show`, `speaker.play`); the board contributor declaring kinds, channels and
  events as structured entries with descriptions, renderings and docs, and `apply` over the
  primitives.
- `pxt`: `pxt simtest` takes a project directory, finds every `*.scenario.json` in it, compiles
  the project, runs each scenario through the driver, writes the trace beside the scenario,
  compares it to a committed trace, and reports verdicts; a `--surface` form prints the surface
  operation's result; the `--base` form stays for smoke tests. The run options a project implies
  are assembled by the one function the editor also calls.
- Depends on: phase 1.
- Lands when: the worked example of the spec's Scenarios section runs green from the command
  line, from a scenario beside `pxt.json` and from the same scenario moved into a subfolder; two
  runs of one scenario produce byte-identical traces; `@serial` tests keep passing as a projection
  of the trace; `--surface` prints the board's entries with their renderings.
- Status lines: Contributors (the board); the trace and the shells (`simtest` over the driver).

## Phase 3: program contributors

Code inside the compiled program as a contributor.

- `pxt-common-packages`: `libs/harness`, depending on `core`, a `harness` namespace of
  `shim=TD_NOOP` functions with simulator-only bodies over `control.simmessages`: the declaration
  sent on the `harness` channel from start-up code, inputs received on `harness.<key>`, state and
  events posted on `harness` once per frame from a loop at the frame period the library reads from
  the simulator host; a hardware build of a program depending on it carries none of it.
- `pxt`: the driver's side of the protocol; the program run to its first frame boundary and the
  surface fixed from the staging and the declarations before frame 0; the key as outer name; a
  late declaration and a key collision each refused with a stable code, the first registration
  standing; the composed surface in `simtest` resolved from the
  declarations the programs publish.
- Depends on: phase 2.
- Lands when: a test program registering a contributor with one channel and one kind runs under a
  scenario addressing `<key>.<name>`, its input applied before the frame's handlers run and its
  state read with no round trip; two programs registering the same key produce the refusal, and so
  does a declaration sent after frame 0; a scenario with a non-default `framePeriod` reads the
  program's posts once per frame; the test program's hardware build is byte-identical with and
  without the registration.
- Status lines: Contributors (program contributors).

## Phase 4: the worker shell and the Node caller

One driver under three shells.

- `pxt`: a browser worker that loads `pxtsimcore.js` and a target's `simcore.js`, installs the
  virtual host and the silent audio host, runs the driver and returns results as messages; a Node
  caller taking the same inputs programmatically; both assembling run options through the one
  shared function; `pxt simtest` rebuilt as a front end over the Node caller that also runs in a
  project folder over the bundles the installed target package ships; a target release publishing
  `pxtsimcore.js` and its `simcore.js` beside `pxtworker.js`.
- `pxt-mkc`: `mkc test`, fetching the two bundles from the target's release into the cache beside
  the compiler, compiling the project, and running every scenario in it over the Node caller.
- Depends on: phase 2.
- Lands when: same seed, same inputs, same frames give byte-identical traces in the worker, in
  Node, from `pxt simtest` in a project folder and from `mkc test` against a released target; a
  contributor reachable from one shell is reachable from the others; the surface operation
  answers from every shell.
- Status lines: the trace and the shells (all three).

## Phase 5: media, topology and modules

The world level: media as contributors, attachments as staging, modules over a medium.

- `pxt`: the `core` entry of the simulator extension configuration and its loading into the core
  context, `pxsim.harness.defineModule(kind, factory)` pairing each factory with the script being
  loaded and the attachment's `kind` selecting one; the medium contributor shape with attach and
  detach as input kinds and the staging's initial topology; the jacdac bus and the display shield
  as the first media; `staging.json` beside `pxt.json` as the default a scenario's staging
  replaces section by section; the `projstaging` request family (read with bundle and core URLs,
  write of the entries the writer owns, subscribe with change notifications) behind its
  registration flag; a detach rendering a module's channels absent without moving the surface; the
  simulator coordinator routing extension traffic by topology with link and unlink calls, in place
  of broadcasting a channel to every extension frame; the live run and a scenario both starting
  from `staging.json`.
- `pxt-microbit`: the board attaching to a bus.
- Depends on: phase 2; phase 4 for the live coordinator work.
- Lands when: the spec's fixture contributor, shipped as the `core` script of a test extension
  defining two kinds, is staged under
  two roles with one kind each over the bus and contributes under `<role>.<name>`; unplugging one
  at a frame renders its channels absent and emits the bus's detached event; a third, staged
  unattached, starts absent, and an attach at frame N renders it present from N+1, emits the
  attached event, and is seen by a program handler on the board on N+1 under the same device
  identity in two runs; a role equal to the outer segment of a board name is refused at staging; a
  `projstaging` write from one frame reaches a subscriber in another, and the subscriber's next
  surface operation shows the new role; the read reply's core URL resolves to the test extension's
  script.
- Status lines: Media and topology (the media framework, the bus and the shield); Scenarios
  (`staging.json`, `projstaging`).

## Phase 6: worlds of several simulators and the radio ether's delivery

Several boards in lockstep, and radio frames carried by a medium.

- `pxt`: an orchestrator advancing one runtime per `vm` context or worker a frame at a time by
  board id, with every medium propagating after every board; the board id as outer name; one trace
  per world; the scenario's boards with their projects; the radio ether as a medium delivering
  frames at frame boundaries in stable order with a link matrix (`ether.link <a>-<b>`) and a
  per-link strength scripted through `ether.strength <a>-<b>` or defaulted.
- `pxt-common-packages`: the radio's core posting frames to the ether when one is present, the
  broadcast `radiopacket` message staying for the live simulator.
- Depends on: phases 4 and 5.
- Lands when: two boards exchanging frames over the ether receive each other's frame at the same
  frame offset whichever board id is lower; cutting a link at a frame stops delivery from that
  frame; a variant of the spec's three-board example with scripted link strengths and no spatial
  medium runs green.
- Status lines: Worlds with several simulators; Media and topology (the ether's delivery).

## Phase 7: the radio ether's model surface and the spatial world

Controlled nondeterminism.

- `pxt`: the loss models (Bernoulli, Gilbert-Elliott) on a random stream derived from the run seed
  and the medium's id; delay in whole frames with jitter and duplication; the drop event per link
  with its cause; the collision switch; the spatial world as a medium with placement and path kinds
  and position channels; strength from distance by log-distance path loss with seeded shadowing
  and the reception curve.
- Depends on: phase 6.
- Lands when: every frame a loss model removes is matched by one drop event on its link and a bare
  matrix emits none; changing a loss parameter leaves the random numbers a program draws unchanged;
  the three-board example runs with strengths derived from positions.
- Status lines: Media and topology (complete).

## Phase 8: recording and replay

A run as a portable artifact.

- `pxt`: the recording (seed, per-frame clock deltas, inputs at frame grain, project and version
  record); replay of the same program by the recorded deltas; replay of a changed program at the
  nominal period; the live simulator seeded at run start with the seed logged and the frame deltas
  logged; the recorder in the live driver stamping the inputs the view applies with their frame.
- `pxt-microbit`: the live-capture sensors (microphone level, device-motion acceleration, light
  level, the recorder host's clip) reading scenario values through `apply` in a headless run.
- Depends on: phase 2; phase 5 for recording a live run's topology.
- Lands when: a recording of a run replays to a byte-identical trace in Node and in the worker; a
  program polling the sound level three times in a frame reads the frame's recorded level three
  times.
- Status lines: Recording and replay.

## Phase 9: bulk channels and probes

The screen as a channel.

- `pxt`: hash rendering for a channel declared bulk (FNV-1a 64-bit, 16 hex digits); the run flag
  and the failed-expectation dump of a frame's bytes beside the scenario; the probe module staged
  as an attachment with its probe list as config, one channel per probe.
- `pxt-arcade`: the screen as a bulk channel, framebuffer then palette, once pxt-arcade's
  simulator is on the DOM-free split (an open item of `README.md`).
- Depends on: phase 5 for the probe as an attachment; the pxt-arcade split for the screen.
- Lands when: a scenario pins a region of the screen by hash and a pixel by color index; a failed
  screen expectation leaves the frame's bytes beside the scenario; the screen's rendered value is
  16 characters on every frame of a run with a moving sprite.
- Status lines: Composition, values, state and events (bulk channels).

## After the phases

When every phase has landed, the Status section of `headless-harness.md` says so on every line,
every open Ledger entry below has been resolved or moved to the Open items of `README.md`, and
this file is removed together with the pointers to it in `README.md` and the overview; the spec
stays as the design of record.

## How agents work this plan

This plan is written for two agents with distinct jobs, and that split is the configuration to
work it in. A planning agent holds the whole plan: it reads the spec and the code, splits a phase
into slices, drafts each slice's kickoff for the developer's review, and keeps the Status section,
this file and the Ledger current. A coding agent holds one slice: it receives the approved
kickoff, writes the code and the tests it names, and reports back. The planner never writes the
slice's code and the coder never redraws the plan, so the plan stays coherent across slices and
each slice stays small enough to review. One agent doing both jobs loses the review step between
them, which is where misreadings are caught, and tends to widen a slice while inside it. The
developer sits between the two: ruling on the plan and the spec, approving kickoffs, and
reviewing what lands.

The steps below hold whoever dispatches the agents; each block names the role it binds. A slice is
named by the title of its kickoff.

Before touching a phase (the planner):

1. Read, in full and in this order: `README.md` beside this file, `headless-harness.md`, this
   plan, and `.github/instructions/simulator.instructions.md`. Then read the code the phase names.
2. Check the Status section against the code. Where they disagree, the code is the fact: correct
   the Status line first, as a documentation-only slice of the planner's own that needs no
   kickoff, before planning on it.
3. Check that every phase in "Depends on" has landed. If one has not, stop and report; do not
   build on the gap or pull the missing phase in.
4. Restate the phase's scope in a few lines, and turn each "Lands when" clause into a named test
   to write. Anything beyond that scope is a question for the developer, not a decision.

Dispatching a slice (the planner and the developer):

- The planning agent drafts the kickoff, the exact text the coding agent will receive, and the
  developer reviews it before anything is dispatched. The draft is where last details get
  settled: the review catches what the planner misread, and writing it forces the planner to
  answer every open question by reading the spec and the code rather than leaving it for the
  coding agent to guess at.
- A kickoff states the slice's scope and what is out of it, the files to read first, the tests
  to write from the "Lands when" clauses, the invariants to preserve, and the Status lines to
  flip. A question the planner cannot settle from the spec and the code is listed for the
  developer with a one-line statement of what it is, never as a bare reference, and the draft
  is not approved while one stands open.
- Dispatch happens only after the developer approves the draft, and the coding agent receives
  the approved text as written.

While implementing (the coder):

- Read the four files of step 1 in full, then the files the kickoff names, before editing.
- Judge the code against the spec, not against this plan's wording. The plan summarizes; the spec
  rules. Where the two disagree, the spec wins; report the disagreement, and the planner corrects
  the plan in the same slice.
- When the implementation shows the spec wrong, ambiguous or incomplete, stop and report the
  problem with the reason; the planner carries the proposed spec edit to the developer, whose
  decision it is. Once agreed, the edit lands in the same slice as the code it describes.
- Build the phase and nothing of later phases. A seam a later phase needs exists only when a
  "Lands when" clause of this phase exercises it; otherwise its need is recorded in that later
  phase's text here, not pre-built.
- Every "Lands when" clause is a test, in `tests/simcore-test/` for the core and the target's
  own test folder for a board; byte-identity claims are asserted by tests, never checked by eye.
- The harness speaks its own vocabulary: frames, scenarios, contributors, the trace. Terms from
  a particular consumer of the harness do not enter the code, the tests or these files.
- No plan names in code: no phase numbers in identifiers, file names, test names or comments.
  Name things for what they are.
- Prose in these files and in comments is ASCII and wrapped at 100 columns, as the sibling files
  are. Comments say what a symbol is, not why it was shaped that way.

Finishing a slice (the coder, then the planner):

- The coder runs the build and the test suites the touched repository runs in CI, and
  `pxt simtest` on the target's tests when a board is touched. Green means no warnings either.
- The coder reports what changed, what was verified and what remains, and lists every problem
  noticed and not fixed; nothing noticed is dropped silently.
- The planner flips the Status lines the phase names, in present tense, without dates, and the
  Conformance line check by check as the slice lands the checks the spec lists; updates
  `README.md` when the slice alters what the folder contains or how it plugs into the system,
  and this plan when the slice alters the order or scope of what follows; and enters each
  reported problem in the Ledger at the end of this file. These edits land in the slice.
- The pull request text is the squash commit message. It describes the end state the slice
  produces and names the spec sections and Status lines it touches; it narrates no history and
  carries no Ledger entries.

Across repositories: a phase touching `pxt` and a target or `pxt-common-packages` lands `pxt`
first, and each companion pull request names the `pxt` slice it depends on.

## Ledger

Problems noticed while working a slice and not fixed in it, so they can be reviewed later. One
entry per problem, appended at the end, in this form:

    - L<n>. <the problem, concretely enough to act on without rediscovering it>. Found: <phase, and
      the slice by its kickoff title>. Proposed: <fix now | fold into phase N | its own slice
      after X | leave, because Y>.
      Status: <open | scheduled | resolved | wont-fix>.

Entries are append-only and never renumbered. When an entry is addressed, or dissolves because the
code moved under it, its Status is updated in place. Read the Ledger before adding to it: the
problem may already be here.
