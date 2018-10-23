# Testing the accessibility features

The accessibility features are validated using a test process. This guide describes how to test and validate the UI elements of **Microsoft MakeCode** and targets.

## Testing sites and targets

Makecode.com, MakeCode targets, and documentation must be tested for these core features:

* [Keyboard navigation](#testing-keyboard-navigation)
* [Assistive technologies](#testing-assistive-technologies)
* [High contrast](#testing-high-contrast)

There are some exceptions to the accessibility test coverage. These external resources are excluded from testing:

* MakeCode editor (PXT)/Help/Support
* PXT/Help/Buy
* PXT/Settings/Privacy & Cookies
* PXT/Settings/Terms Of Use
* PXT/Settings/Give Feedback
* In MakeCode.com, any YouTube integration

## Testing keyboard navigation

Users must have the same access with the keyboard to UI elements that the mouse and touch input have in MakeCode.

### Navigation path

Using a left-to-right reading order, the user must be able to **navigate from left to right, from top to bottom** using the ``Tab`` key. The user must also be able to navigate in the opposite direction using the ``Shift + Tab`` keys.
The simulator is exempt from this. Keyboard navigation in the simulator doesn't follow any reading order **yet**.

![](/static/images/accessibility/accessibility-keyboard-navigation.gif)

### Tab panels

By convention, tab panels must always be navigable with the ``Left``, ``Right``, ``Up`` and ``Down`` arrow keys. In right-to-left reading mode, the behavior must follow the reading order. The navigation must loop, which means that once the last tab position is reached, the next ``Tab`` key press takes the reader back to the first tab position.

![](/static/images/accessibility/accessibility-tabpanel.gif)

### Dialog box

Many dialog boxes are shown in PXT. Dialog boxes are used for the Projects button, Share, Language, About, and others. When a dialog box is open, the user must not have to access to any interactive element outside of the dialog prior to closing it. The keyboard navigation is 'trapped' inside the dialog.

The dialog must close itself with activation of the answer buttons (OK, Accept, Cancel...), the close button, or by pressing ``Escape``.

![](/static/images/accessibility/accessibility-modals.gif)

### Tree view

The tree views use standard navigation. The user must be able to use the ``Right`` or ``Left`` keys to expand or collapse a node. The ``Tab``key navigates into the tree and ``Enter`` activates a node. Depending on what kind of interaction is available, the ``Enter`` key will also expand or collapse a node and instead of using the ``Left`` or ``Right`` keys.

![](/static/images/accessibility/accessibility-treeview.gif)

### Drop down menu

Dropdown menues are located at the top right hand-corner of the view. A menu must be opened when the focus is given to it's parent button and must be close if the user press ``Tab``, ``Shift + Tab`` or ``Escape``. When the menu is open, navigation through the options of the dropdown menu are with the ``Up`` and ``Down`` arrow keys. The navigation must not loop.

![](/static/images/accessibility/accessibility-dropdown.gif)

### Slider

The slider's value is changed by pressing the ``Left``, ``Right``, ``Up``, and ``Down`` arrow keys.

## Testing assistive technologies

The assistive technologies help someone with visual impairment navigate a UI without seeing a screen. Keyboard navigation with the use of a screen reader reads the content of the page where the user is focused.

### Screen readers

MakeCode is tested with several screen readers to ensure accessibility on all platforms:

* Voice Over (included in macOS). Test with Safari, Chrome and FireFox on macOS.
* [NVDA](https://www.nvaccess.org/) (for Windows). Check it with Chrome and FireFox.
* Narrator (included in Windows). Test with IE and Microsoft Edge.
* [JAWS](http://www.freedomscientific.com/Products/Blindness/JAWS). Run a test with this screen reader since it is the one most widely used readers for Windows. It is commonly used along with FireFox.

**JAWS is not free to use**. For Microsoft employees, a business license key is available at Microsoft's internal tools site.

### Testing screen readers

Simulate the conditions of visual impairment. You could try navigating through the editorclosing your eyes or just not watch the screen and see if you become lostin the editor during keyboard navigation.

Every interactive component must be announced during navigation:

* List box
* List box item (also, tells if it's selected)
* Tree view
* Tree item (also, tells if it's expanded)
* Tab panel
* Dialog
* Alert
* Button
* Menu bar
* Menu item
* Drop down menu (also, tells if it's expanded)
* Sliders (also, mentions the new value if it changes)
* Input (also, mentions the current value)
* Search result (at least tells the total number of results)

The way components are described is different from a one screen reader to another. Verify that all of them provide enough information to understand the purpose of the interactive component, its content, and its state (especially when disabled). Although it is assumend that the user already knows how to interact with a slider, a dropdown menu, or other component, verify that any additional usage information is provided by the screen reader.

## Testing high contrast

High contrast mode helps people with vision impairment read the screen. The goal of this mode is to increase the contrast between the text, interactive elements, and the background. For example, a white text on black background is easier to read than a light grey text on a white background.

High contrast is available independently from the operating system configuration. It is enabled manually from the ``Hidden Tab Menu`` or from the ``Settings`` menu.

![](/static/images/accessibility/accessibility-highcontrast.png)

Variations can exist between the high contrast mode of a website and the rendering in high contrast mode of the host operating system. A simple guideline when testing high contrast is to just make sure that all text and interactive elements are highly visible. Check that the focus indication is visible enough to determine which component is at current position in the navigation path.