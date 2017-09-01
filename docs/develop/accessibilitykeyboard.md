# Keyboard

This documentation is related to technical points to consider to make your changes accessible with the keyboard.

## Tab Index

The goal of defining a ``Tab Index`` is to define the tabbing navigation order of a document. We should consider, while working with a Left To Right reading way environement, being able to **navigate from left to right, from top to bottom** by using ``Tab`` key, and the opposite by using ``Shift + Tab``.

Here is an example :

```html
<div tabindex="0">Interactive element</div>
```

There is 3 ways to set the tab index attribute :
* A negative value (usually ``-1``) means that the element should not be reached by keyboard navigation. The element can still be focused with the mouse.
* A zero (``tabindex="0"``) means that the element should be reach by keyboard navigation in DOM order.
* A positive value (greather than 0) means that the element should be reach in the specified order, from 0 to the greatest N value. In other words, ``tabindex="0"`` will be reach before ``tabindex="1"`` which will be reach before ``tabindex="2"``.

The tab index can be defined in HTML or JavaScript depending of the scenario. Please try to priorities an HTML implementation.

## Keyboard interaction

A lot of element have a behavior on a click with the mouse. It is usually defined by the ``onClick`` attribute. If there is no other special interaction with the component, it will be required to have the same behavior than a click while pressing the ``Enter`` or ``Space`` key.

A helper method automate this action. Feel free to use, in ``React``, the method ``sui.fireClickOnEnter``.
You will also have to make a choice of which keyboard event is the best to use : ``KeyDown``, ``KeyUp`` or ``KeyPress``. Please try to use as much as possible the ``KeyDown`` event as ``KeyPress`` has some compatibility issues with Internet Explorer.

Here is an example of implementation using React :

```js
import * as sui from "./sui";
[...]
<div tabIndex={0} onClick={() => action() } onKeyDown={sui.fireClickOnEnter}>Interactive element</div>
```

## Focus trap

In specific cases like modals, we do not want that user can tab outside of the modal in question, otherwise he would be able to navigation below the dimmer which is not a good user experience.

A helper is here to help to defines how the focus trap must work. It is defined into ``core.initializeFocusTabIndex`` and has the following arguments :

| Argument | Description |
|----------|-------------|
| element  | The container element where it must find the first and last interactive elements to make the trap. Usually the root of the modal. |
| allowResetFocus | Defines whether the trap must be redefined even if it's already set and that the focus is in the container element.Usefull to reset the focus trap if the modal content changes at a moment. |
| giveFocusToFirstElement | Defines whether the first interactive element must get the focus as soon as possible. |
| unregisterOnly | Defines whether the focus trap must be unloader/stopped/unregistered and must not be redefined. |