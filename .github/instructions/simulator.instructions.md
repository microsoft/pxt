---
description: "Instructions for PXT simulator development"
applyTo: "pxtsim/**/*.ts,pxtsimcore/**,cli/simtest.ts,tests/simcore-test/**,sim/**/*.ts,**/sim/*.ts"
---

# PXT Simulator Development Instructions

## Simulator Architecture

- Follow the modular board/state pattern established in the codebase
- Separate visual rendering from simulation logic
- Use TypeScript interfaces to define board state contracts
- Implement proper cleanup in simulation lifecycle methods
- `pxtsimcore` is the DOM-free core project; it compiles without the `dom` lib, which is the check
- New runtime, board-state and synthesis code belongs to `pxtsimcore`; only view code belongs to `pxtsim`
- Globals the core may use are declared in `pxtsimcore/globals.d.ts`; never add the `dom` lib to core
- Consumers load `built/pxtsim.js`, which is core followed by the DOM code; keep the `pxsim` namespace
- A target's or library's DOM-free simulator files live in its `core/` folder, and its `tsconfig.core.json` globs that folder
- A lib's or target's full simulator config compiles only its view files against the core bundle's `.d.ts` and prepends the core bundle, so `sim.js` is `simcore.js` followed by the view code; a view file never references a core source file, only the core declarations

## Host Abstractions

- Core reads time, timers and randomness through `host.clock()`, `host.timers()` and `host.rng()`, never `Date.now`, `setTimeout`, `setInterval`, `requestAnimationFrame` or `Math.random`
- Core reaches the parent page through `host.environment()` and audio through `audiohost.audio()`
- A new seam defaults to today's behavior and lets callers override members one at a time, as `setEnvironment` does

## Board State and View

- `board()` is the state, used by shims and `state/*`; `boardView()` is for view code; state files never reference `visuals`
- A board state must construct and run with no view; the Node boot test proves it
- Tests inject input through the board state the same way the visuals do, not by raising DAL events by id

## Audio/Media Handling

- Web Audio lives in the `audiohost` DOM implementation; core code plays sound through `audiohost.audio()`
- Implement proper gain control and volume management
- Handle browser compatibility issues (Chrome, Firefox, Safari)
- Use MediaStream API for recording functionality
- Always clean up audio resources when stopping simulation

## Headless Runs

- `pxt simtest` and the simcore tests run on the virtual host (`pxsim.host.createVirtualHost`) and the silent audio host, so pauses take no real time and runs are repeatable
- After the top-level code finishes, a run advances virtual time by `--settle` and stops; it never waits for the program to go idle, and its timeout watchdog stays on real time
- Fixtures are TypeScript under `tests/simcore-test/fixtures/`, compiled by the test project; do not generate them at test time or embed them as strings
- A target ships a DOM-free simulator bundle by adding `sim/tsconfig.core.json`, which `pxt buildtarget` compiles to `built/simcore.js`

## Visual Components

- Use SVG for scalable simulator graphics
- Implement proper coordinate systems and transforms
- Support both light and dark themes
- Ensure responsive design for different screen sizes
- Use CSS custom properties for theming

## Performance Optimization

- Minimize DOM manipulations during animation
- Use `requestAnimationFrame` for smooth animations in view code; core uses `host.timers().requestFrame`
- Implement efficient update cycles
- Cache frequently accessed DOM elements
- Profile performance in different browsers

## Hardware Simulation

- Accurately model hardware behavior and constraints
- Implement realistic timing and delays on the host clock
- Handle edge cases and error conditions
- Support debugging and breakpoint functionality
- Maintain compatibility with runtime implementations

## Debugging Support

- Include comprehensive logging for development
- Implement proper error handling and recovery
- Support simulator reset and state inspection
- Provide clear error messages for debugging

## Workflow

- A plan phase is done when its test is checked in and green, not when the code exists
- Characterize behavior with tests before moving code, and keep file moves and behavior changes in separate commits
- Before declaring done, run `npx gulp`, `npx gulp testsimcore`, `npx gulp testsimdriver`, `npx gulp testpxteditor` and `npx gulp lint`
- Report anything noticed and not fixed, with a proposed time to fix it
