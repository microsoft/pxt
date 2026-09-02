# PXT Framework Development Instructions

## General Guidelines

- Follow TypeScript strict mode conventions
- Use semantic versioning for all packages
- Maintain backward compatibility when possible
- Write clear, self-documenting code with JSDoc comments
- Follow the existing code style and patterns in each component

## Architecture Principles

- The PXT framework follows a modular architecture with clear separation between:
  - Core framework (`pxtlib/`, `pxtcompiler/`)
  - Web application (`webapp/`)
  - Simulator (`pxtsim/`)
  - Target implementations (`pxt-microbit/`, `pxt-common-packages/`)

## Code Generation Standards

- Always include proper type annotations
- Use `export` statements for public APIs
- Prefer `const` over `let` where possible
- Use arrow functions for callbacks and short functions
- Include error handling for async operations

## Testing Requirements

- Write unit tests for new functionality
- Include accessibility tests for UI components
- Test simulator features across different browsers
- Validate TypeScript compilation without errors

## Documentation

- Update relevant README files when adding features
- Include inline documentation for complex algorithms
- Document breaking changes in commit messages
- Provide examples for new API functions
