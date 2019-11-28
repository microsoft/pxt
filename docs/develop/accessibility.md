# Accessibility

Accessibility features are included as a core part of **Microsoft MakeCode**. Any MakeCode target can extend accessibility to itself by following the recommendations provided in this guide.

## Being responsible

We can ensure that MakeCode achieves it's accessibility goals only if every contributor is responsible to ensure the accessibility of their own features or changes. The guidance given here will help you know what is important and what to keep in mind while designing and developing for MakeCode.

## Accessible Rich Internet Applications (WAI-ARIA) 1.1

[WAI-ARIA](http://www.w3.org/TR/wai-aria-1.1/) is the specification that describes the standard support for accessibility in web apps. It defines a set of best practices and available markup extensions (mostly as attributes for HTML5 elements) which are used to make web pages accessible with keyboards and screen readers.

The WAI-ARIA specification provides a standards and guidance for keyboard navigation that combines the use of HTML and JavaScript. Most of the ARIA markup extensions for HTML5 elements define how a screen reader must react when the user is focused on the element.

For example, often a DIV element is clickable and visually looks like a button or menu. The ARIA markup extension provides additional information to the user such as the role of the DIV (is it a button, a menu item, a header?), the description, and how to interact with it.

## What to consider when editing MakeCode

* Many of the SUI (available in [sui.tsx](https://github.com/microsoft/pxt/blob/master/webapp/src/sui.tsx)) elements are already accessible, such as the buttons, code cards, modals. But for some other elements, like hyperlinks, which do not have a SUI implementation, you will have to make them accessible yourself.
* You might want to include new libraries in PXT, or one of the targets, to quickly add a new feature (like charts, a grid, etc.). You are now required to include accessibility as design consideration when including or developing libraries. If a library you wish to use is not accessible, find an alternative one or consider adding the required accessibility features to it.
* As a general rule, you can expect an additional 5% to 15% of development time for adding the necessary accessibility features to a library you create or modify for your use.

The following topics discuss accessible development for MakeCode:

* [Keyboard](/develop/accessibility/accessibility-keyboard) related issues
* [Assistive technologies](/develop/accessibility/accessibility-screen-reader)
* [High contrast](/develop/accessibility/accessibility-high-contrast)

## Testing the accessibility features

When you do your changes on the accessibility, be sure to do the right tests.
[How to test the accessibility features and what to test](/develop/accessibility/accessibility-testing)