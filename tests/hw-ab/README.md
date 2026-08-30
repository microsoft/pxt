# hw-ab: hardware A/B comparison on micro:bit

Build a candidate and a reference compiler's hexes from one checkout, run both
on a real micro:bit, and diff what the board prints. One board, three commands:

    npm run hwab -- build --v2-only --ref-switches "<optOutSwitch,...>"
    npm run hwab -- ab truthiness      # also: ab lowering, ab iface
    npm run hwab -- capture soak candidate --soak 30   # GC/leak watch

Needs a micro:bit on USB and the prerequisites below.

The programs it runs are the codegen corpus files from
`tests/compile-test/lang-test0/` named in `gen-project.js`'s `CASES` table
(coverage map: `README-codegen.md` there).

## Contents

| file | what it does |
| --- | --- |
| `hwab.js` | one entry point for the whole workflow; the normal interface |
| `gen-project.js` | writes one device project per case (its `CASES` table, plus soak) under `<target>/projects/hw-ab/` |
| `build-ab.js` | builds candidate and reference hexes into `out/` |
| `run-capture.js` | flashes one hex and captures its serial output |
| `diff-ab.js` | normalizes and diffs two captures |

`out/` is generated and gitignored.

To add a case: add one entry to the `CASES` table in `gen-project.js`.
Everything downstream -- the build, `hwab`, the `cases` listing -- reads the
generated `cases.txt`, so nothing else needs editing.

## Commands

Every artifact is at a derived path -- case `C` on side `S` is
`out/<C>/<S>.hex` and `out/<C>/<S>.log` -- so `hwab.js` derives them and only
the case name is ever typed. A case may be named exactly or by any unique
substring of its name: `truthiness` and `iface` resolve, while an ambiguous
substring like `condition` is rejected with the candidate list.

| command | what it does |
| --- | --- |
| `build [args...]` | builds the hexes; every argument passes through to `build-ab.js` |
| `capture <case> [side] [--timeout <sec>] [--soak <min>]` | flashes one hex and captures its serial output; side is `candidate` (default) or `reference`; `--soak` is for (and required by) the soak case |
| `diff <case>` | diffs the case's candidate and reference captures |
| `ab <case> [--timeout <sec>]` | capture candidate, capture reference, diff -- the whole per-case loop on one board |
| `cases` | lists the known cases and which hexes and logs exist right now |
| `help` | the usage summary |

Two invocation forms:

    npm run hwab -- cases
    node tests/hw-ab/hwab.js cases  # cwd-independent

Exit codes are the underlying script's, verbatim; `ab` reports the first
failing stage's.

The underlying scripts remain directly invocable as `node tests/hw-ab/<name>.js`
for scripting and debugging -- the wrapper only assembles their arguments, and
each script's own `--help` documents its full contract.

## Prerequisites

- `pxt` and `pxt-microbit` sibling checkouts, npm-linked, `pxt` CLI on PATH.
- A current `npm run build` in `pxt` -- rebuild after compiler changes.
- A populated `pxt-microbit/built/hexcache/`, so builds need no toolchain or
  build service.
- One micro:bit on USB, MICROBIT drive mounted (see Platforms).

## Two reference strategies

**Switch-based.** One checkout, two builds: the candidate with no compile
switches, the reference with the opt-out switches that turn the change under
test off, named explicitly via `--ref-switches` (there is no default -- the
right names depend on which change is being tested). Fast, and the two hexes
are guaranteed to differ in nothing else.

Two constraints:

1. The compiler must actually implement the switches. PXT parses
   `PXT_COMPILE_SWITCHES` name-agnostically -- an unknown switch name is
   accepted silently and then never read. A misspelled or not-yet-implemented
   switch therefore produces a "reference" that is a second candidate build.
   `build-ab.js` compares the two hexes and refuses to continue if they are
   byte-identical, rather than letting you diff a build against itself.
2. It only covers changes that are gated behind those switches. An ungated
   change is in both builds and the comparison cannot see it.

**Git-based.** Build the reference from a reference commit. Slower (a full
`npm run build` of pxt per side) but it covers every change, gated or not. This
is the gold standard; use it whenever ungated changes are in play.

    # reference side
    git -C <pxt> checkout <reference-commit>
    (cd <pxt> && npm run build)
    npm run hwab -- build --reference-only --v2-only

    # candidate side
    git -C <pxt> checkout <candidate-branch>
    (cd <pxt> && npm run build)
    npm run hwab -- build --candidate-only --v2-only

The two runs fill `out/<case>/reference.hex` and `candidate.hex` side by side
-- `out/` is preserved between runs -- and `ab <case>` / `diff <case>` then
work as usual. The preservation cuts both ways: a stale hex from an earlier
run pairs silently with a fresh one, so check `sizes.txt` if in doubt.

## Full A/B walkthrough

Switch-based, V2/CODAL only, naming the opt-out switches of the change under
test:

    cd <pxt>
    npm run hwab -- build --v2-only --ref-switches "<optOutSwitch,...>"

That generates the projects, builds both sides of every case, and writes
`out/<case>/{candidate,reference}.hex` plus `out/sizes.txt` (byte size and
sha256 per hex). Then, for each semantic case:

    npm run hwab -- ab truthiness
    npm run hwab -- ab lowering
    npm run hwab -- ab iface

One `ab` run is the whole loop for one case on one board: it flashes the
candidate hex and captures until the board reports its verdict, then flashes the
reference hex and captures again, then diffs the two logs. It stops at the first
stage that fails and names that stage. The stages are also available one at a
time -- `capture <case> candidate`, `capture <case> reference`, `diff <case>` --
which is what to reach for when the two sides are run on different boards or at
different times.

`run-capture.js` exits 0 on `HWAB PASS`, 1 on `ASSERT` (printing the failing
assertion id), 2 on timeout, 3 on a host/board problem. `diff-ab.js` exits
nonzero on divergence and prints a unified diff of the normalized lines.

A pass on both sides is not the whole story, which is why `ab` diffs even when
both captures passed: the trace lines between the banners can differ while the
final verdict does not.

### What the device prints

    HWAB START <case>     once, after a 10 s startup delay
    <trace lines>         from the prelude's msg()
    HWAB PASS <case>      repeated every 2 s, forever

The 10 second delay and the repeating PASS both exist for the same reason:
serial capture cannot begin until the board re-enumerates after flashing, so a
program that printed its verdict once and immediately would race the capture.

On failure the generated `assert` prints `ASSERT <id>` and then panics 45. The
host prelude's `assert` throws instead, and an uncaught throw on device is just
panic 999, which does not say which assertion failed -- `gen-project.js`
rewrites the prelude's assert at generation time to get a legible failure. The
rewrite is bracketed by `---- hw-ab generated replacement ----` comments in the
generated `main.ts`.

## Soak procedure

The `soak` project loops forever over the allocation shapes the corpus
exercises -- strings built in condition position, a map grown by computed key,
polymorphic interface dispatch over mixed class/literal receivers -- and every
five seconds forces a collection and prints the collector's own numbers:

    HWAB SOAK <elapsed-ms> free=<n> min=<n> total=<n> numgc=<n>

Those come from `control.gcStats()` (declared in
`pxt-common-packages/libs/base/gcstats.ts`, backed by `getGCStats` in
`gc.cpp`), read after an explicit `control.gc()` so that `lastFreeBytes` is
current rather than left over from whenever the runtime last collected.
`free` is `lastFreeBytes`, `min` is `minFreeBytes` (the low-water mark since
boot), `total` is the total heap in bytes, `numgc` is the collection count.

Run both sides for at least 30 minutes each:

    npm run hwab -- capture soak candidate --soak 30
    npm run hwab -- capture soak reference --soak 30
    npm run hwab -- diff soak

`--soak` mode exits 0 if `HWAB SOAK` lines were still arriving at the end and
1 if output stalled. The soak program has no pass/fail verdict, so `hwab`
refuses a plain capture of it (and `ab soak`) rather than running a capture
that can only time out.

What a leak looks like:

- `free` trends down across the run while `numgc` keeps climbing. A healthy run
  oscillates around a stable `free` -- the workload allocates and the collector
  reclaims it -- and `min` settles rather than falling monotonically.
- Eventually the board stops printing. That is an out-of-memory panic: the LED
  matrix shows a sad face with 020 or 021.
- Compare time-to-failure, not just pass/fail. `HWAB SOAK` lines carry elapsed
  milliseconds precisely so the two builds can be compared on how long they
  lasted.

`diff-ab.js` masks the elapsed and heap numbers before diffing, since they vary
legitimately between two runs of the same build; it prints the final soak line
from each log side by side for eyeballing. Heap trend analysis is out of scope
for the diff -- read the logs directly for that.

### PXT_GC_STRESS (advanced)

`pxt-common-packages/libs/base/gc.cpp` has a commented-out
`//#define PXT_GC_STRESS 1` near line 47. Enabling it makes the runtime collect
far more aggressively, which surfaces missing GC roots and premature frees in
minutes instead of hours -- a value that survives normal execution because a
collection never happened to run at the wrong moment will be collected out from
under the code almost immediately.

This changes C++, not TypeScript, so it does not take effect through the
hexcache path used above. It requires a real runtime rebuild: either a local
CODAL toolchain (`pxt buildtarget` / `pxt build --local` with arm-none-eabi-gcc
and the CODAL sources fetched) or a cloud rebuild against a modified
common-packages. Budget the setup time before reaching for it, and remember to
revert the define -- a stress build's timing is not comparable with a normal
build's.

## Interpreting device panics

| number | meaning |
| --- | --- |
| 45 | an `assert` in the generated program failed; the id is on serial |
| 999 | unhandled thrown value (a `throw` that reached the top) |
| 020 / 021 | out of memory |

A panic 999 in a generated case project means something threw that was not an
assertion -- the case files raise exceptions deliberately in a few places, so a
999 points at an exception escaping a `try` that should have caught it.

## Troubleshooting

**`no MICROBIT volume within 30s`** -- the drive is not mounted. Check the
cable is a data cable, not charge-only. If a `MAINTENANCE` drive appears
instead, DAPLink is in bootloader mode and its interface firmware needs
reflashing. See the Platforms section for where each platform looks and how to
point the script somewhere else.

**`no <serial device> found`** -- mass storage came up but the serial port did
not. Unplug and replug; if it persists the DAPLink interface firmware is likely
out of date. Note that no pxt CLI command can substitute here: `pxt console`
and `hidserial` speak HF2, and the micro:bit is DAPLink, so the capture has to
read the serial device directly.

**`more than one <serial device>`** -- another USB serial device is attached
and the capture cannot tell which board is which. Unplug the others, or name
the right one with `MICROBIT_SERIAL`.

**`candidate and reference hexes are byte-identical`** -- the reference build
differs from the candidate only by compile switches, and those switches changed
nothing. Almost always this means the compiler on this branch does not
implement them: an unrecognised switch name is accepted silently and never
read. Check the spelling against what the compiler reads, or switch to the
git-based reference strategy.

**Empty capture / timeout** -- the capture attached after the program had
already printed, or the board reset. The repeating PASS banner normally covers
this; an empty log with a sad face on the matrix means the program panicked
before reaching its verdict.

**Timeout with bytes but no lines (garbage in the log)** -- the port was read
with the wrong line settings, so every byte decodes as noise. The script guards
against the usual cause on each platform (see the ordering paragraph under
Platforms). If it still happens, something else has the port open and is
reconfiguring it, or the device is not the micro:bit.

**Build fails with `Package not installed: <something>`** -- the generated
`pxt.json` stamps the current target version so pxt-microbit's upgrade rules do
not inject extra dependencies. If the stamp is missing the project reads as
version 0.0.0 and those rules fire. Regenerate with `gen-project.js`.

## Platforms

Only `run-capture.js` touches the hardware; it detects the platform itself.
Everything else is platform-independent node:

| | macOS | Linux | Windows |
| --- | --- | --- | --- |
| MICROBIT volume | `/Volumes/MICROBIT` | `/media/$USER/MICROBIT`, `/run/media/$USER/MICROBIT`, `/media/MICROBIT` | the drive letter whose volume label is `MICROBIT`, from `Get-CimInstance Win32_LogicalDisk` |
| serial device | `/dev/cu.usbmodem*` | `/dev/ttyACM*` | the `COM` port whose name matches mbed/DAPLink/USB Serial, from `Get-CimInstance Win32_SerialPort`; opened as `\\.\COM<n>` |
| line settings | `stty -f <dev> 115200 raw -echo` | `stty -F <dev> 115200 raw -echo` | `mode COM<n>: BAUD=115200 PARITY=n DATA=8 STOP=1 to=off xon=off dtr=on rts=on` |

Two environment variables override the discovery when it needs help:
`MICROBIT_VOLUME` (path or drive of the mounted drive, e.g. `/Volumes/MICROBIT`
or `E:`) and `MICROBIT_SERIAL` (serial device to read, e.g. `/dev/ttyACM0` or
`COM5`). Both accept exactly what the platform's own tools print.

Ordering differs by platform and matters. On POSIX the device is opened first
and the settings are applied second: terminal settings reset when the last open
of a tty closes, and `stty` opens and closes the device itself, so the held fd
is what makes 115200/raw survive to the reader. On Windows the configuration
belongs to the port rather than to a handle, so `mode` runs before the handle is
opened. `dtr=on` is not optional there -- a CDC device may transmit nothing
until DTR is asserted.

Linux permissions: opening `/dev/ttyACM*` usually requires membership in the
`dialout` group (`sudo usermod -a -G dialout $USER`, then log in again).

### Windows troubleshooting

**No MICROBIT drive letter.** Check what Windows sees:

    powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,VolumeName"

If no volume is labelled `MICROBIT` the board is not in mass-storage mode -- the
cable may be charge-only, or a `MAINTENANCE` label means DAPLink is in
bootloader mode and needs its interface firmware reflashed. If the drive is
there under a different label, point the script at it with `MICROBIT_VOLUME=E:`.

**No COM port.** Check what the port is called:

    powershell -NoProfile -Command "Get-CimInstance Win32_SerialPort | Select-Object DeviceID,Name"

Device Manager lists the same port under Ports (COM & LPT). If the port exists
but its name does not mention mbed, DAPLink or USB Serial, name it directly with
`MICROBIT_SERIAL=COM5`. If there is no port at all, the DAPLink interface
firmware or its Windows serial driver is missing.

**`mode` fails.** Another program is holding the port -- the MakeCode editor's
serial view, PuTTY, Tera Term, the Arduino IDE. Close it and rerun; only one
program may configure and read the port at a time.

WSL2 also works, through the Linux path: pass the board through with
[usbipd-win](https://github.com/dorssel/usbipd-win) so the board appears as
`/dev/ttyACM*`, and mount the Windows-side MICROBIT drive into WSL
(`sudo mount -t drvfs E: /mnt/microbit`, then `MICROBIT_VOLUME=/mnt/microbit`).
The native Windows path needs none of that.

**Manual (no setup, any platform).** Copy the hex onto the MICROBIT drive in
Explorer or Finder, then watch the board's serial port at 115200 8N1 in any
serial terminal (PuTTY, or the MakeCode editor's serial view). The verdict is
readable by eye: the program prints `HWAB START <case>`, then either
`HWAB PASS <case>` repeatedly or `ASSERT <id>` followed by a sad face and 45 on
the LED matrix; the soak build prints `HWAB SOAK` lines whose `free=` value
should stay flat.
