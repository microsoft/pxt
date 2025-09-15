---
description: "Instructions for PXT block editor development"
applyTo: "pxtblocks/**/*.ts"
---

# PXT Blocks Development Instructions

## Blockly Integration

- Follow Blockly extension patterns and APIs
- Maintain compatibility with current Blockly version
- Implement proper block disposal and cleanup
- Handle workspace serialization/deserialization correctly

## Block Definition

- Create accessible block definitions with proper ARIA labels
- Support both beginner and advanced block modes
- Implement proper input validation and type checking
- Provide clear visual feedback for block states

## Custom Field Types

- Extend Blockly field types following established patterns
- Implement proper serialization for custom fields
- Handle focus management and keyboard navigation
- Support theming and customization

## Code Generation

- Generate clean, readable TypeScript/Python code
- Handle proper indentation and formatting
- Support round-trip conversion (blocks ↔ text)
- Maintain source comments and structure

## Accessibility

- Ensure blocks work with screen readers
- Implement proper keyboard navigation
- Provide meaningful descriptions for complex blocks
- Support high contrast and other accessibility features

## Performance

- Optimize block rendering for large workspaces
- Implement efficient block search and filtering
- Handle workspace scaling and zooming smoothly
- Minimize memory usage for block instances

## Localization

- Support right-to-left languages
- Implement proper text measurement and layout
- Handle translation of block text and tooltips
- Maintain block functionality across languages
