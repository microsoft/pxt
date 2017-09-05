# Testing the accessibility features

This page describes the testing documentation of **Microsoft MakeCode** related to accessibility.

## Testing

Makecode.com, MakeCode's targets and documentation must be tested.

* [Keyboard navigation](#testing-keyboard-navigation)
* [Assistive technologies](#testing-assistive-technologies)
* [High contrast](#testing-high-contrast)

The following external websites accessible from the following menus **must not** be tested :

* MakeCode editor (PXT)/Help/Support
* PXT/Help/Buy
* PXT/Settings/Privacy & Cookies
* PXT/Settings/Terms Of Use
* PXT/Settings/Give Feedback
* In MakeCode.com, the YouTube integration

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

# Testing assistive technologies

The assistive technologies allow blind people to use a software without seeing the screen. They use the keyboard navigation and a screen reader that will read the content of the page where the user focus on.

## Screen readers

We must test MakeCode with several screen readers to be sure that it is accessible on all platforms :
* Voice Over (included to macOS). Please try it with Safari, Chrome and FireFox on macOS.
* [NVDA](https://www.nvaccess.org/) (for Windows). Please try is with Chrome and FireFox.
* Narrator (included to Windows). Please try it with IE and MS Edge.
* [JAWS](http://www.freedomscientific.com/Products/Blindness/JAWS). It is the most used screen reader on Windows and is mainly used with FireFox.

**JAWS is not free to use**. A business license key can be found on Microsoft's internal tools for Microsoft employees.

## Testing screen readers

To test the screen readers, we could try to navigates into PXT by closing the eyes or just not watching the screen and see if we are not lost in the editor while navigating with the keyboard.

We must consider that every interactive component must be announced :
* List box
* List box item (and know if it is selected)
* Tree view
* Tree item (and know if it is expanded)
* Tab panel
* Dialog
* Alert
* Button
* Menu bar
* Menu item
* Drop down menu (and know if it is expanded)
* Sliders (and know its value when we change it)
* Input (and know the current value)
* Search result (at least the number of result)

The way the components are described is different from a screen reader to another, but we must be sure that for all of them, the provided information are enough to understand the purpose of the interactive component, its content and its state (in particular when it is disabled). We must consider that the user already knows how to interact with a slider, a drop down menu and else but it happens that an additional explaination of how to use it is provided by a screen reader.

# Testing high contrast

The high contrast mode helps people with vision impairment to read the screen. The goal of this mode is to increase the contrast between the text, interactive element and the background. For example, a white text on black background is easier to read than a light grey text on a white background.

The high contrast mode can be enabled independently from the operating system configuration. Therefore, it can be enabled manually from the ``Hidden Tab Menu`` or from the ``Settings`` menu.

![](/static/images/accessibility-highcontrast.png)

As there are variations between the high contrast mode of the website and the render when the high contrast modes of the hosting operating system are enabled, the guideline to test the high contrast is simply to be sure that all text and interactive elements are well visible and that the focus is visible enough to be determine with a low vision on which component we are navigating.