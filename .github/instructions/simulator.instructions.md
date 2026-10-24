---
description: "Instructions for PXT simulator development"
applyTo: "pxtsim/**/*.ts,pxtsimcore/**,cli/simtest.ts,tests/simcore-test/**,sim/**/*.ts,**/sim/*.ts"
---

# PXT Simulator Development Instructions

## Simulator Architecture

- `pxtsimcore` is the DOM-free core project; it compiles without the `dom` lib, which is the check
- New runtime, board-state and synthesis code belongs to `pxtsimcore`; only view code belongs to `pxtsim`
- Globals the core may use are declared in `pxtsimcore/globals.d.ts`; never add the `dom` lib to core
- Consumers load `built/pxtsim.js`, which is core followed by the DOM code; keep the `pxsim` namespace

## Host Abstractions

- Core reads time, timers and randomness through `host.clock()`, `host.timers()` and `host.rng()`, never `Date.now`, `setTimeout`, `setInterval`, `requestAnimationFrame` or `Math.random`
- Core reaches the parent page through `host.environment()` and audio through `audiohost.audio()`
- A new seam defaults to today's behavior and lets callers override members one at a time, as `setEnvironment` does

## Board State and View

- `board()` is the state, used by shims and `state/*`; `boardView()` is for view code; state files never reference `visuals`
- A board state must construct and run with no view; the Node boot test proves it
- Tests inject input through the board state the same way the visuals do, not by raising DAL events by id

## Headless Runs

- `pxt simtest` and the simcore tests run on the virtual host (`pxsim.host.createVirtualHost`), so pauses take no real time and runs are repeatable
- After the top-level code finishes, a run advances virtual time by `--settle` and stops; it never waits for the program to go idle, and its timeout watchdog stays on real time
- Fixtures are TypeScript under `tests/simcore-test/fixtures/`, compiled by the test project; do not generate them at test time or embed them as strings

## Visual Components

- Use SVG for scalable simulator graphics
- Support light and dark themes with CSS custom properties
- Call `requestAnimationFrame` from view code only; core uses `host.timers().requestFrame`

## Workflow

- A plan phase is done when its test is checked in and green, not when the code exists
- Characterize behavior with tests before moving code, and keep file moves and behavior changes in separate commits
- Before declaring done, run `npx gulp`, `npx gulp testsimcore`, `npx gulp testsimdriver`, `npx gulp testpxteditor` and `npx gulp lint`
- Report anything noticed and not fixed, with a proposed time to fix it
