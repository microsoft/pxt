---
description: "Instructions for PXT simulator development"
applyTo: "pxtsim/**/*.ts,pxtsimcore/**,sim/**/*.ts,**/sim/*.ts"
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

## Host Abstractions

- Core reads time, timers and randomness through `host.clock()`, `host.timers()` and `host.rng()`, never `Date.now`, `setTimeout`, `setInterval`, `requestAnimationFrame` or `Math.random`
- Core talks to the parent page through `host.environment()` and plays sound through `audiohost.audio()`
- Core reports through `pxsim.log`, `pxsim.warn` and `pxsim.error` (the `pxsim.Logger` a host may replace), never `console` directly
- A new host interface defaults to today's behavior, and its setter takes only the members a caller wants to change, as `setEnvironment` does

## Board State and View

- `board()` is the state, used by shims and `state/*`; `boardView()` is for view code; state files never reference `visuals`
- A board state must construct and run with no view
- Tests inject input through the board state the same way the visuals do, not by raising DAL events by id

## Audio/Media Handling

- Web Audio lives in the `audiohost` DOM implementation; core code plays sound through `audiohost.audio()`
- Implement proper gain control and volume management
- Handle browser compatibility issues (Chrome, Firefox, Safari)
- Use MediaStream API for recording functionality
- Always clean up audio resources when stopping simulation

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
