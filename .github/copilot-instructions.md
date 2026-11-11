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
- For pages under `docs/`, follow `.github/instructions/docs.instructions.md`: write
  each section for humans, define key terms at the top, give each example a use
  case, and put agent-oriented detail in a final `## Agent Notes` section

## Code Comments

Keep writing ordinary comments for human readers. Agent notes are an addition to
them, not a replacement.

### Human-facing comments

- Add a normal comment wherever a human reader would need help: the intent of
  non-obvious code, the reason behind a design choice, or how a complex
  algorithm works.
- Phrase these comments the way an experienced teammate would explain the code
  out loud, in plain, natural sentences. Avoid generated-sounding phrasing such
  as restating the code line by line, filler like "This function is responsible
  for...", or references to the conversation or task that produced the change.
- Reviewers will reject PRs whose human-facing comments don't read as if a
  person wrote them.

### Agent notes

- Prefix a code comment with `Agent Note:` when its main purpose is to stop
  future contributors or AI agents from repeating a known mistake, such as a
  non-obvious invariant, an ordering requirement, or a fix that looks redundant
  but isn't. For example, `// Agent Note: claim choices before sorting by weight`.
- Use the language's normal comment syntax: `// Agent Note: ...` in TS/JS,
  `/* Agent Note: ... */` in CSS/LESS, and `<!-- Agent Note: ... -->` in HTML or
  markdown.
- Keep the note to one or two lines that state the constraint and why it holds.
  Don't put the prefix on ordinary explanatory comments. Agent notes should also
  read naturally.
- Before changing code near an `Agent Note:`, read it. If your change makes the
  note inaccurate, update or remove it.
