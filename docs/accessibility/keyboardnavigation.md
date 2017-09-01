# Keyboard Navigation

In order to use **Microsoft MakeCode** for people who prefer use the keyboard or cannot use the mouse of a touch screen, some features have been implemented to help our consumers to use Microsoft MakeCode.

* A hidden menu with shortcuts that appears when the user starts tabbing into the editor and the documentation is available.
* The navigation into the menus and simulator have been standardized.

## Drop-down menu

When you navigation into Microsoft MakeCode with the keyboard, the focus is represented by a blue outline on the interactive element. When a contextual menu opens, use the ``Top`` and ``Bottom`` arrow keys to navigate into the menu, and ``Enter`` or ``Space`` to validate the selection. Press ``Tab`` or ``Shift + Tab`` to move to the next or previous interactive element outside of the current Drop-down menu.

![](/static/images/accessibility-context-menu.png)

## Dialogs

Sometimes in Microsoft MakeCode, a view will appear above everything. Those view are commonly similar to a dialog box. For this reason, the keyboard navigation will be trapped into the dialog until it's closed.

To close a dialog, navigate to the close button (represented by a cross at the top right or left corner) and press ``Enter`` or ``Space``, or press the ``Escape`` key.

## Simulator

The simulator is actually partially accessible. We are working hard to make it fully accessible soon.
Please find below the list of supported sensors.

### Buttons

As any other interactive element on Windows, macOS or Linux, a button can be activated by pressing the ``Enter`` or ``Space`` keys.
When the board is represented in the simulator is designed to support long press, you can perform a long press on those keys.

### Thermometer, Light level, Noise level and Pins

The ``Thermometer``, ``Light level``, ``Noise level`` and ``Pins`` are represented as sliders in the simulator. To control them when they have the focus, use the ``Left``, ``Up``, ``Right`` and ``Down`` arrow keys. 

## Block editor

The block editor is not accessible yet. As a workaround, we suggest for the moment to use the [JavaScript editor](#javascript-editor).

## JavaScript editor

When entering into the JavaScript editor, use the following keyboard shortcuts :

* Pressing ``Tab`` in the editor will insert the tab character. Toggle this behavior by pressing ``Control + M`` or ``⌘ + M`` on Mac.
* To configure the editor to be optimized for usage with a Screen Reader, press ``Control + E`` or ``⌘ + E`` on Mac.

For more information, refer to the [Monaco Editor Accessibility Guide](https://github.com/Microsoft/monaco-editor/wiki/Monaco-Editor-Accessibility-Guide).

## Documentation

The documentation of Microsoft MakeCode is accessible too. Like on the main editor page, a hidden menu is available to access to some shortcuts like accessing to the main content of the page.

The side vertical menu is accessible with the ``Tab`` key.
At some point, a hierarchical view is available and represented by the follow arrow on the side of the menu item :

![](/static/images/accessibility-documentation-treeview.png)

Use the ``Left`` or ``Right`` arrow keys to expand or collapse the selected item.