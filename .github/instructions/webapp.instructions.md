---
description: "Instructions for PXT webapp React components"
applyTo: "webapp/**/*.{ts,tsx,js,jsx}"
---

# PXT Webapp Development Instructions

## React Component Guidelines

- Use functional components with hooks instead of class components
- Implement proper TypeScript interfaces for all props
- Use React.memo for performance optimization when appropriate
- Follow the existing component structure in `webapp/src/`

## State Management

- Use React hooks (useState, useEffect, useContext) for local state
- Leverage the existing Redux store for global application state
- Keep component state minimal and lift state up when needed

## Accessibility Requirements

- Always include proper ARIA attributes
- Use semantic HTML elements
- Ensure keyboard navigation works properly
- Follow WCAG 2.1 AA guidelines
- Test with screen readers

## Styling

- Use the existing Less/CSS variables for theming
- Follow the BEM naming convention for CSS classes
- Ensure responsive design across different screen sizes
- Support both light and dark themes

## UI Components

- Reuse existing components from `react-common/`
- Follow the design system patterns
- Include proper focus management
- Implement loading states for async operations

## Performance

- Lazy load components when appropriate
- Optimize bundle size by avoiding unnecessary imports
- Use React.Suspense for code splitting
- Implement proper error boundaries
