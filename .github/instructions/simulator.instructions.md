---
description: "Instructions for PXT simulator development"
applyTo: "pxtsim/**/*.ts,sim/**/*.ts,**/sim/*.ts"
---

# PXT Simulator Development Instructions

## Simulator Architecture

- Follow the modular board/state pattern established in the codebase
- Separate visual rendering from simulation logic
- Use TypeScript interfaces to define board state contracts
- Implement proper cleanup in simulation lifecycle methods

## Audio/Media Handling

- Use Web Audio API for audio processing and effects
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
- Use requestAnimationFrame for smooth animations
- Implement efficient update cycles
- Cache frequently accessed DOM elements
- Profile performance in different browsers

## Hardware Simulation

- Accurately model hardware behavior and constraints
- Implement realistic timing and delays
- Handle edge cases and error conditions
- Support debugging and breakpoint functionality
- Maintain compatibility with runtime implementations

## Debugging Support

- Include comprehensive logging for development
- Implement proper error handling and recovery
- Support simulator reset and state inspection
- Provide clear error messages for debugging
