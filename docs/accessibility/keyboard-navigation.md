# Keyboard Navigation

MakeCode includes features to assist in navigation when the keyboard is used as the primary input method. When a pointing device (mouse or touch input) is not used, or its use is limited, the keyboard assists navigation using these features:

* A hidden menu of shortcuts appears when the user begins to tab into the editor. Help text is displayed for the shortcuts.
* Navigation into menus and the simulator are standardized.

## Drop-down menu

When navigating through the editor with the keyboard, focus is shown with a blue outline around the interactive element. When a contextual menu opens, the ``Top`` and ``Bottom`` arrow keys navigate into, through, and out of the menu. The ``Enter`` or ``Space`` keys validate the selection. Pressing ``Tab`` or ``Shift + Tab`` moves to the next or previous interactive element outside of the current drop-down menu.

![](/static/images/accessibility-context-menu.png)

## Dialogs

Sometimes MakeCode shows a dialog on top of the editor. When a dialog is displayed, keyboard navigation is restricted to just the elements inside the dialog.

To close a dialog, navigate to the close button (shown as an X at the top right or top left corner) and press ``Enter`` or ``Space``. The ``Escape`` key will dismiss the dialog without having to navigate to the close button.

## Simulator

Currently, the simulator is only partially accessible. We are working hard to make it fully accessible soon. The following are the supported inputs and sensors.

### Buttons

A button press in the simulator is similar to button press elsewhere. A button is activated by pressing either the ``Enter`` or ``Space`` key.
When the simulator is representing a physical board, the touch related inputs (buttons, switches, capacitive pins) support a long press duration. You can perform touch-like input in the simulator with the  ``Enter`` or ``Space`` key.

### Thermometer, Light level, Noise level and Pins

The ``Thermometer``, ``Light level``, ``Noise level`` and ``Pins`` are appear as sliders in the simulator. When they have the focus, use the ``Left``, ``Up``, ``Right`` and ``Down`` arrow keys to control them.

## Block editor

The block editor is currently not accessible. Accessible coding activities require using the [JavaScript editor](#javascript-editor) .

## JavaScript editor

These keyboard shortcuts are used in the JavaScript editor:

* Pressing ``Tab`` in the editor will insert the tab character. Toggle this behavior by pressing ``Control + M`` in Windows or ``⌘ + M`` on Mac.
* The editor is configured to work with a screen reader by pressing ``Control + E`` in Windows or ``⌘ + E`` on Mac.

Read more about accessiblity for the JavaScript editor in the [Monaco Editor Accessibility Guide](https://github.com/Microsoft/monaco-editor/wiki/Monaco-Editor-Accessibility-Guide).

## Documentation

The documentation for Microsoft MakeCode is also accessible. Just like on the main editor page, a hidden menu is available to access to some shortcuts, such as jumping to the main content of the page.

The side bar menu is accessible with the ``Tab`` key.
Some menu items are cascading (a hierarchical view is shown with an arrow on the side of the menu item):

![](/static/images/accessibility-documentation-treeview.png)

Use the ``Left`` or ``Right`` arrow keys to expand or collapse menu items.