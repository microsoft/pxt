---
description: "Instructions for styling and theming in PXT"
applyTo: "**/*.{less,css}"
---

# PXT Theming and Styling Instructions

## CSS/Less Guidelines

- Use CSS custom properties (variables) for all color values
- Follow the existing naming conventions for variables
- Implement both light and dark theme support
- Use semantic color names rather than specific color values

## Print Styles

- Always provide fallback colors for print media
- Use `@media print` blocks with solid color alternatives
- Apply `print-color-adjust: exact` for variable color preservation
- Test print functionality across different browsers

## Responsive Design

- Use mobile-first responsive design principles
- Implement proper breakpoints for different screen sizes
- Ensure touch-friendly interactions on mobile devices
- Test across different device orientations

## Accessibility

- Maintain sufficient color contrast ratios (WCAG AA)
- Support high contrast mode and forced colors
- Use focus indicators that are clearly visible
- Ensure text remains readable when zoomed to 200%

## Component Styling

- Follow BEM methodology for CSS class naming
- Keep specificity low and avoid !important
- Use flexbox and CSS Grid for layout
- Implement proper component encapsulation

## Performance

- Minimize CSS bundle size
- Use efficient selectors and avoid deep nesting
- Implement critical CSS for above-the-fold content
- Optimize for browser rendering performance

## Browser Compatibility

- Support modern browsers (Chrome, Firefox, Safari, Edge)
- Provide graceful degradation for older browsers
- Test vendor prefixes and feature support
- Handle browser-specific quirks appropriately
