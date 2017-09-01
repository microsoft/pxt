# Testing keyboard navigation

Users must be able to do the same things with the keyboard than with the mouse in MakeCode.

## Navigation way

While working with a Left To Right reading way environement, the user must able to **navigate from left to right, from top to bottom** by using ``Tab`` key, and the opposite by using ``Shift + Tab``.
There is an exception for the simulator. The keyboard navigation does not respect the reading way **yet**.

![](/static/images/accessibility-keyboard-navigation.gif)

## Tab panels

By convention, tab panels must be navigable with the ``Left``, ``Right``, ``Up`` and ``Down`` arrow keys. In Right To Left reading mode, the behavior must follow the reading way. The navigation must be looping, which means that once at the last tab, we must come back directly to the first one after a ``Tab``.

![](/static/images/accessibility-tabpanel.gif)

## Dialog box

A lot of dialog box are available in PXT. Projects button, Share, Language, About and others are opening dialog box. While a dialog box is opened, the user must not be able to access to interactive element outside of the dialog without closing it.
We must be sure that the user cannot access to anything outside of the dialog box without closing it and that the keyboard navigation is trapped.

The user must be able to close a dialog by activating the answer buttons (OK, Accept, Cancel...), the close button or by pressing ``Escape``.

![](/static/images/accessibility-modals.gif)

## Tree view

The tree views have a standard way to navigate.
The user must be able to use the ``Right`` or ``Left`` keys to expand or collapse a node. He must be able to use ``Tab`` to navigate in the tree, and ``Enter`` to activate a node. Depending of what kind of interaction is available, the ``Enter`` key can also expand or collapse a node and replace the ``Left`` or ``Right`` keys.

![](/static/images/accessibility-treeview.gif)

## Drop down menu

Two drop down menu exist in PXT. They are located at the top right hand-corner.
The menu must be opened when the focus is given it's parent button and must be close if the user press ``Tab``, ``Shift + Tab`` or ``Escape``. WHile the menu is open, the user must be able to navigate inside of the drop down menu with the ``Up`` and ``Down`` arrow keys. The navigation must not be looping.

![](/static/images/accessibility-dropdown.gif)

## Slider

The slider's value can be changed by pressing the ``Left``, ``Right``, ``Up`` and ``Down`` arrow keys.