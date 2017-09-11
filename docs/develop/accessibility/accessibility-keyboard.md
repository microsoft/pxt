# Keyboard

Keyboard accessibility allows navigation to each element of interaction in the visual interface. Here are some points to consider to help ensure that user input is accessible with the keyboard.

## Tab Index

A ``Tab Index`` is a position in the tabbing navigation order of a document. In an enviroment where we read left-to-right, it should be possible to **navigate from left to right, from top to bottom** with the ``Tab`` key, and in the opposite direction using ``Shift + Tab``.

Here's an example of an HTML element with a tab index:

```html
<div tabindex="0">Interactive element</div>
```

There are 3 ways to set the tab index attribute:

* With a negative value (usually ``-1``). This means that the element isn't reachable by keyboard navigation. The element can still receive focus with the mouse.
* Use a zero (``tabindex="0"``). This means that the element is reached by keyboard navigation in DOM order.
* A positive value (greather than 0). This means that the element is reached in the order of 0 to the greatest N value. In other words, ``tabindex="0"`` is reached before ``tabindex="1"`` which is reached reach before ``tabindex="2"``, and so on.

The tab index is defined in HTML or JavaScript depending the page initialization scenario. We recommend using an HTML implementation when practical.

## Keyboard interaction

Many elements respond to a mouse click. This is usually defined with the ``onClick`` attribute. If no additonal interaction is needed with a component, it is required that pressing the ``Enter`` or ``Space`` key has the same behavior to the ``onClick``.

There are a helper methods to automate this action. Feel free to use them. In **React**, for example, the method is ``sui.fireClickOnEnter``.
You will also have to decide on which keyboard event to use: ``KeyDown``, ``KeyUp`` or ``KeyPress``. When possible, always use the ``KeyDown`` event as ``KeyPress`` has compatibility problems with Internet Explorer.

Here is an example of implementation using React:

```js
import * as sui from "./sui";
[...]
<div tabIndex={0} onClick={() => action() } onKeyDown={sui.fireClickOnEnter}>Interactive element</div>
```

## Focus trap

In certain situations, like in modals, we do not want the user to tab outside of the modal. If this was allowed, the user could navigate below the dimmer resulting in a poor interaction experience.

There's a helper to set how a focus trap must work. It is defined as ``core.initializeFocusTabIndex`` and has these arguments:

| Argument | Description |
|----------|-------------|
| element  | The container element having the first and last interactive elements to make the trap. Usually the root of the modal. |
| allowResetFocus | The trap must be redefined even if it's already set and the focus is in the container element. Useful to reset the focus trap if the modal content changes suddenly. |
| giveFocusToFirstElement | Indicates whether the first interactive element must get the focus as soon as possible. |
| unregisterOnly | The focus trap must be unloaded/stopped/unregistered and must not be redefined. |