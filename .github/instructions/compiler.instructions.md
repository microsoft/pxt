---
description: "Instructions for PXT compiler and language services"
applyTo: "pxtcompiler/**/*.ts,pxtlib/**/*.ts"
---

# PXT Compiler Development Instructions

## TypeScript Compiler Integration

- Extend TypeScript compiler APIs following established patterns
- Maintain compatibility with current TypeScript version
- Handle AST transformations carefully to preserve source maps
- Implement proper error reporting with accurate location information

## Symbol Resolution

- Use the existing symbol table and resolution mechanisms
- Implement proper scoping rules for PXT language features
- Handle namespace resolution and imports correctly
- Support both TypeScript and Python syntax trees

## Code Generation

- Generate efficient target code for embedded devices
- Optimize for memory usage and performance
- Support different target architectures (ARM, ESP32, etc.)
- Implement proper dead code elimination

## Language Services

- Provide accurate IntelliSense and autocomplete
- Implement hover information and documentation
- Support go-to-definition and find-references
- Handle incremental compilation for performance

## API Documentation

- Extract API information from TypeScript declarations
- Generate block definitions from function signatures
- Support localization of API documentation
- Maintain backward compatibility in API changes

## Error Handling

- Provide clear, actionable error messages
- Include source location information
- Support error recovery for better IDE experience
- Implement proper diagnostic reporting

## Performance

- Optimize compilation speed for large projects
- Implement efficient caching strategies
- Support incremental builds
- Profile and optimize hot code paths
