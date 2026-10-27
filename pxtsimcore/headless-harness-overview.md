# The headless test harness, in outline

A short tour of the harness for a first read. `headless-harness.md` beside this file is the
complete design and the reference for every detail left out here; the last section says what else
to read.

## What it is for

A MakeCode program is tested by running it in the simulator with no screen attached, feeding it
inputs at chosen moments, and checking what it did. The harness is the machinery that makes that
repeatable: the same program, the same inputs and the same seed give the same result, byte for
byte, whether the test runs from the command line, from Node or inside a browser worker. A test is
a project plus a scenario file in the project, and running the test produces a trace file
that records everything the program showed and did, frame by frame.

The unit of time is the simulator frame. Inputs are due at a frame, expectations hold over a range
of frames, and every line of the trace is one frame.

## Five ideas

**Contributor.** Anything in the simulated world that a test can poke or watch. Each one declares
three lists: the inputs it accepts (a button press, a light level, a slider position), the state
channels it holds (what the display shows, where a servo is), and the events it emits (a serial
line, a note played). The board itself is a contributor; so is a module an extension attaches, so
is code inside the program that wants to be testable, and so is a medium like a radio ether or a
bus that connects boards together. One shape serves all four.

**Composed surface.** Before a run starts, the harness gathers every contributor's lists into one
flat, ordered surface: this is everything the scenario may name. Names are plain for the board
(`button-a`, `display`) and prefixed by the owner for everything else (`slider 1.position`,
`steps.count`, `ether.link board 1-board 3`). The surface is fixed for the run, and it is written
into the trace header, so a trace explains itself.

**Scenario.** A small JSON file: how many frames to run, a seed, the inputs with the frame each is
due, and the expectations. An expectation either says a channel shows a value for every frame of a
window, or an event with a value arrives at some frame in a window; each has a negated form. There
are no tolerances; a contributor that wants fuzzy matching declares a coarser channel. The scenario
may also describe the staging, which boards and attached modules and media the world has, and may
pin the versions it was written against.

**Trace.** One JSON Lines file per run: a header, then one record per frame holding the channels
that changed and the events that fired. Values are strings, rendered by the contributor that owns
them. A committed trace is the golden the next run is compared against. A channel too big to print
on a line, a game screen for instance, renders as a hash, with the bytes dumped to a file when a
check fails.

**World.** One board is the default, but a scenario can stage several, each with its own project,
joined by media. The radio ether is a medium with a per-link matrix, loss models and delay, all
driven from the run seed so a flaky network is reproducible. A jacdac bus and a display shield are
media too. Attach and detach are inputs of a medium, so a test can unplug a module mid-run, or
stage one unplugged and plug it in at a chosen frame to check that the program notices a device
arriving, the way a real one would.

## How a run goes

The driver loads the headless simulator bundles, builds the world from the staging, and starts the
program. During start-up, code in the program that wants to be a contributor registers itself over
the program-message channel, declaring its lists. The driver then fixes the composed surface,
checks the scenario against it, and begins stepping frames. Each frame it delivers the inputs due,
lets the simulator run the frame, reads every contributor's state once, collects the events, and
writes the frame record. After the last frame it evaluates the expectations and reports verdicts.
With several boards, every board steps before any medium delivers, so a radio frame sent on frame
N always arrives on frame N+1.

Everything in that paragraph lives in one shared driver in core. The shells around it are thin:
`pxt simtest` for a target developer, `mkc test` for a project author with nothing but a project
folder, a Node caller under both, and a browser worker. Beside running a
scenario, every shell can also answer "what is the surface for this staging" without running one,
which is what an editor tab needs to offer completion.

## Two ways an extension joins in

An extension that ships a simulator page can also ship a core: a DOM-free script that defines one
or more module kinds, each a factory returning a contributor. A user attaches a module to the board
under a role they name, and the module's inputs and channels appear in the surface under that role.
In the live editor the extension's own page builds in the same core and draws its state, so the
model is one piece of code with two hosts.

An extension whose simulation is really the program's own logic registers from inside the program
instead: a few lines at start-up declare a key and the lists, and from then on the driver posts
inputs to it and it posts its state back each frame. A game extension can expose its score and
level this way without the harness knowing anything about games.

Either way the harness learns of the extension only through the surface it declares. Nothing in the
harness names a particular extension.

## Project state and the live simulator

The world a project runs in, its boards, attached modules and media, is project state, kept in a
staging file beside `pxt.json`. The live simulator starts from it, a scenario starts from it unless
it says otherwise, and it travels with the project when shared. Extensions read and write it
through a small request family, so an extension with a topology editor can attach a module and a
testing tool can see the surface change, neither knowing the other exists. The same attach and
detach operations drive the live simulator's routing: traffic goes where the topology says, not to
every frame.

## Recording

The live simulator can run with a seeded random source and log how long each frame took. Then a
session is a recording: the seed, each frame's clock delta, and the user's inputs with their
frames, replayable headlessly as a scenario. A bug seen in the editor becomes a test with no
retyping.

## What to read next

The full design is `headless-harness.md`: the exact contributor shape, the composition order and
collision rules, the scenario and trace file formats with a worked example, the registration
protocol, the media and ether model, recording, and conformance. Its Status section is the
inventory of what is built. `headless-harness-plan.md` sequences the rest into phases and carries
the working agreements for the agents that build it.
