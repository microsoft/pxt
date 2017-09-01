# Accessibility

The **Microsoft MakeCode** team wants to be sure that every person on the planet can play with it to achieve more. It is very important for us when we're working to make computer science more accessible to consumers with disabilities.

## Being responsible

Starting from now, every contributor and MakeCode team member will be responsible to insure the accessibility of their own features or changes. The following documentation must help to understand what is important to keep in mind while designing and developing MakeCode.

## Accessible Rich Internet Applications (WAI-ARIA) 1.1

[WAI-ARIA](http://www.w3.org/TR/wai-aria-1.1/) is the specification that describes the standard support for accessibility in web apps. It defines a set of best practice and available markup extensions (mostly as attributes on HTML5 elements) which can be used to make a web page being usable with a keyboard and screen readers.

You will find in WAI-ARIA some advice and standard of use for the keyboard navigation that usually include a mix of HTML and JavaScript. Most of the ARIA markup extensions on HTML5 elements are designed to defines how a screen reader must react when the user is focusing on a specific element.

For example, it is often that a DIV element is clickable and visually looks like a button or menu. The ARIA markup extension will help to provides information to the user such like the role of the DIV (is it a button, a menu item, a header?), the description and how to interact with it...

## What to consider when editing MakeCode

* First, a lot of SUI (available in [sui.tsx](https://github.com/Microsoft/pxt/blob/master/webapp/src/sui.tsx)) elements are already accessible, such as the buttons, code cards, modals. But for some other elements like hyper link which does not have a SUI implementation, you will have to make them accessible yourself.
* You might want to add some libraries to PXT or one of the target to add a new feature quickly, such like charts, grid and more. Starting from now, you are required to consider how accessible this librarie is. If none of the available librarie you want to use is accessible, please consider the difficulty and cost of time required to make it accessible for the use you need.
* Finally, without counting the accessibility issues related to new or current libraries you want to use, the cost required to make your changes accessibile is estimated between 5 and 15% of additional implementing time.

The following documentation explains in more details what to consider to make your changes accessible :
* [Keyboard](/develop/accessibilitykeyboard) related issues
* [Assistive technologies](/develop/accessibilityscreenreader)
* [High contrast](/develop/accessibilityhighcontrast)