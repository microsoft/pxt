---
description: "Common accessibility guidelines for all PXT components"
applyTo: "**/*.{ts,tsx,less,css}"
---

# PXT Accessibility Instructions

## ARIA Guidelines

- Use semantic HTML elements as the foundation
- Add ARIA roles, properties, and states when semantic HTML is insufficient
- Ensure ARIA labels are descriptive and context-aware
- Follow ARIA authoring practices for complex widgets

## Keyboard Navigation

- Implement logical tab order throughout the interface
- Provide visible focus indicators for all interactive elements
- Support standard keyboard shortcuts and navigation patterns
- Handle focus management for dynamic content changes

## Screen Reader Support

- Provide meaningful alternative text for images and icons
- Use proper heading hierarchy (h1, h2, h3, etc.)
- Announce dynamic content changes with live regions
- Ensure form labels are properly associated with inputs

## Color and Contrast

- Maintain WCAG 2.1 AA contrast ratios (4.5:1 for normal text)
- Don't rely solely on color to convey information
- Support high contrast mode and forced color schemes
- Test with color blindness simulation tools

## WCAG Compliance

- Target WCAG 2.1 AA conformance level
- Test with automated accessibility tools (axe, Lighthouse)
- Conduct manual testing with keyboard and screen readers
- Document accessibility features and testing procedures

## Common Patterns

### Modals and Dialogs
- Trap focus within modal content
- Return focus to trigger element on close
- Provide proper ARIA labeling (aria-labelledby, aria-describedby)
- Support Escape key to close

### Menus and Navigation
- Use proper ARIA menu roles and properties
- Support arrow key navigation within menus
- Indicate current page/section appropriately
- Handle submenu expansion and collapse

### Forms
- Associate labels with form controls
- Provide clear error messages and validation feedback
- Group related form fields with fieldset/legend
- Support autocomplete where appropriate
