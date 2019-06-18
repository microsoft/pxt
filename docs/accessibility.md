# Accessibility

**Microsoft MakeCode** includes some core features which promote greater accessibility for everyone. The menus, the JavaScript editor and the documentation are accessible with the keyboard, assistive technologies, and a high contrast color mode. These improve the visibility of the UI elements and the navigation between them. The block editor is not accessible yet, so, accessible coding is done using just the [JavaScript editor](#javascript-editor).

Here are the accessible features and how to enable and use them.

## Keyboard Navigation

MakeCode includes features to assist in navigation when the keyboard is used as the primary input method. When a pointing device (mouse or touch input) is not used, or its use is limited, the keyboard assists navigation using these features:

* A **hidden menu** of shortcuts appears when the user begins to tab into the editor. Help text is displayed for the shortcuts.
* Navigation into menus and **JavaScript editor** are standardized.

You can use the ``Tab`` key to jump between MakeCode controls. Use ``Shift+Tab`` to tab in reverse order. As you tab through the UI controls, you can see an indicator around the UI element once the element gains focus.

### Tab trapping

#### Dialogs

Sometimes MakeCode shows a dialog on top of the editor. When a dialog is displayed, keyboard navigation is restricted to just the elements inside the dialog.

To close a dialog, navigate to the close button (shown as an **X** at the top right or top left corner) and press ``Enter`` or ``Space``. The ``Escape`` key will dismiss the dialog without having to navigate to the close button.

#### JavaScript editor navigation

These keyboard shortcuts are used in the [JavaScript editor](#javascript-editor):

* By default, pressing ``Tab`` in the editor will insert the tab character.
* Toggle this behavior by pressing ``Control+M`` on **Windows** or ``⌘+M`` on **Mac**.
* In order to jump to the toolbox from the editor. Press ``Control+Alt+T`` on **Windows** or ``⌘+Alt+T`` on **Mac**.

### Drop-down menu

When navigating through the editor with the keyboard, focus is shown with a blue outline around the interactive element. When a contextual menu opens, the ``Top`` and ``Bottom`` arrow keys navigate into, through, and out of the menu. The ``Enter`` or ``Space`` keys validate the selection. Pressing ``Tab`` or ``Shift+Tab`` moves to the next or previous interactive element outside of the current drop-down menu.

![](/static/images/accessibility/accessibility-context-menu.png)

### Block editor

The **block editor** is currently not accessible yet. Accessible coding activities require using the [JavaScript editor](#javascript-editor).

### Documentation

The **documentation** for Microsoft MakeCode is also accessible. Just like on the main editor page, a **hidden menu** is available to access to some shortcuts, such as jumping to the main content of the page.

The side bar menu is accessible with the ``Tab`` key.
Some menu items are cascading (a hierarchical view is shown with an arrow on the side of the menu item):

![](/static/images/accessibility/accessibility-documentation-treeview.png)

Use the ``Left`` or ``Right`` arrow keys to expand or collapse menu items.

## Assistive technologies

Several screen readers are available to help to use MakeCode.

### JAWS (Job Access With Speech) Screen Reader

[JAWS](http://www.freedomscientific.com/Products/Blindness/JAWS) is a **popular commercial screen reader for Windows**.

* [Download JAWS](http://www.freedomscientific.com/Downloads/JAWS)

### NVDA (NonVisual Desktop Access)

[NVDA](https://www.nvaccess.org/) is a **free screen reader for Windows**.

* [Download NVDA](https://www.nvaccess.org/download/)

### Narrator

**Narrator** is the **built-in screen reader that is part of Windows**. To start Narrator:

* Press the ``Windows`` key to open the ``Start Menu``, type ``"Narrator"``, and press ``Enter``.
>-- OR --
* Use the ``Ease Of Access`` section in the ``Windows settings``. Set Narrator to ``On``.

### Voice Over

**Voice Over** is the **built-in screen reader provided with the Mac**. To start Voice Over:

* Press the ``⌘+F5`` keys.
>-- OR --
* Use the ``Universal Access`` pane of ``System Preferences``.

## High Contrast

The high contrast helps people to locate and distinguish between the different visual elements in the MakeCode editor. This is enabled by each **MakeCode target** with its own use of color and contrast. So, a high contrast view is not always available in every instance of a MakeCode editor (partner editions).

The high contrast mode in the editor is available even when the operating system configuration hasn't enabled it. In MakeCode, it is enabled manually from either the ``Hidden Tab Menu`` or the ``Settings`` menu.

![](/static/images/accessibility/accessibility-highcontrast.png)

## JavaScript editor

Read more about accessibility for the **JavaScript editor** (keyboard navigation, screen readers and high contrast) in the [Monaco Editor Accessibility Guide](https://github.com/Microsoft/monaco-editor/wiki/Monaco-Editor-Accessibility-Guide).
