---
description: "Common development practices shared across all PXT components"
applyTo: "**/*.{ts,tsx,js,jsx}"
---

# Common PXT Development Instructions

## TypeScript Best Practices

- Use strict TypeScript configuration
- Define explicit return types for public functions
- Prefer interfaces over type aliases for object shapes
- Use union types and type guards for type safety
- Avoid `any` type - use `unknown` or proper types instead

## Code Organization

- Follow the established file and folder structure
- Use barrel exports (index.ts) for clean imports
- Keep functions and classes focused on single responsibilities
- Separate business logic from UI presentation logic
- Group related functionality into modules

## Error Handling

- Use typed errors and proper error boundaries
- Provide meaningful error messages for users and developers
- Log errors with sufficient context for debugging
- Handle edge cases and provide graceful degradation
- Implement retry logic for transient failures

## Performance Considerations

- Minimize bundle size through tree shaking
- Use lazy loading for non-critical components
- Implement proper caching strategies
- Profile performance in development and production
- Optimize for both memory usage and execution speed

## Security Guidelines

- Sanitize user inputs and validate data
- Use Content Security Policy (CSP) headers
- Avoid exposing sensitive information in client code
- Implement proper authentication and authorization
- Follow OWASP security best practices

## Git and Version Control

- Write clear, descriptive commit messages
- Use conventional commit format when possible
- Keep commits atomic and focused
- Include tests and documentation in commits
- Update version numbers following semantic versioning

## Dependencies

- Keep dependencies up to date and secure
- Minimize the number of external dependencies
- Use peer dependencies appropriately
- Document dependency requirements and compatibility
- Regular security audits of dependency tree
