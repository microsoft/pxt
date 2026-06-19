# Accessibility

Microsoft MakeCode includes some core features which promote greater accessibility for everyone. The menus and documentation are accessible with keyboard, assistive technology (including screen readers) and alternative themes, such as a high contrast color mode.  
The JavaScript, Python, and Block editors are accessible using the keyboard and are accessible to screen readers.

Some MakeCode block editors including Arcade are not yet accessible. Accessible coding is done using just the JavaScript or Python editors in these cases.

Here are the accessible features and how to enable and use them.

## Keyboard Navigation

MakeCode includes features to assist in navigation when the keyboard is used as the primary input method. When a pointing device (mouse or touch input) is not used, or its use is limited, the keyboard assists navigation using these features:
>A **hidden menu** of shortcuts appears when the user begins to tab into the editor. Help text is displayed for the shortcuts.
>Navigation into menus, **JavaScript editor**, and **Python editor** are standardized .
You can use the `Tab` key to jump between MakeCode controls. Use `Shift`+`Tab` to tab in reverse order. As you tab through the UI controls, you can see an indicator around the UI element once the element gains focus.

## Blocks editor keyboard controls

The micro:bit MakeCode block editor allows you to use keyboard controls to create programs using blocks.

### Global

These shortcuts are available in all areas of the editor:

|Action | Windows | Mac |
|-|-|-|
| Show/hide shortcut help | ``Ctrl``+`/` | `⌘`+`/` |
| Screen reader mode (additional audio cues and navigation aids for screen reader users) | `Ctrl`+`Alt`+`Z` | `⌘`+`Alt`+`Z` |
| Move between menus, simulator and the workspace | `Tab` or `Shift`+`Tab` | |
| Area menu (then press an area's number, or `Tab` to it and press `Enter` )  | `Ctrl`+`B` | `⌘`+`B` |

#### Keyboard controls help

Press `Control` + `/` on Windows or `⌘` + `/` on Mac to open or close the keyboard controls help.

![Keyboard controls](/static/images/accessibility/keyboard-controls.png)

If you have enough space you can keep the help open by navigating to the **Workspace**. 

#### Navigating between areas

`Tab` and `Shift`+`Tab` can be used to navigate to, and within, areas outside the **Workspace**.

Alternatively, use `Ctrl`+`B` followed by the number of the area you want to jump to.

![Navigating areas](/static/images/accessibility/area-navigation.png)

| Action | Windows | Mac |
|-|-|-|
| Top bar | `Ctrl`+`B` then `1` | `⌘`+`B` then `1` |
| Simulator | `Ctrl`+`B` then `2` | `⌘`+`B` then `2` |
| Toolbox | `Ctrl`+`B` then `3` | `⌘`+`B` then `3` |
| Workspace | `Ctrl`+`B` then `4` | `⌘`+`B` then `4` |
| Bottom bar | `Ctrl`+`B` then `5` | `⌘`+`B` then `5` |

<br/>

The area numbers remain consistent when the layout changes, for example the simulator in the micro:bit MakeCode editor appears in the bottom right when the window is narrow or with high page zoom.

When the area overlay is shown you can also use `Tab` and `Shift`+`Tab` to navigate to the next and previous area.

### Toolbox

| Action | Windows | Mac |
| - | - | - |
| Move in and out of categories | `Left` and `Right` arrow keys | `Left` and `Right` arrow keys |
| Navigate categories or blocks | `Up` and `Down` arrow keys | `Up` and `Down` arrow keys |
| Insert block | `Enter` or `Space` | `Enter` or `Space` |
| Next/Previous heading in blocks list | `H` or `Shift+H` | `H` or `Shift`+`H` |

#### Search box

The search box in the **Toolbox** can be useful for keyboard users.

![Toolbox search box](/static/images/accessibility/search-box.png)

After pressing `T` from the **Workspace** (or `Ctrl+B` then `3`), just start typing and the text will appear in the search box. Matching search results are shown immediately. Press `Enter` to navigate to the search results.

### Selected block

| Action | Windows | Mac |
|-|-|-|
| Move in and out of a block | `Left` and `right` arrow keys | `Left` and `right` arrow keys |
| Edit or confirm | `Enter` or `Space` | `Enter` or `Space` |
| Cancel or exit | `Escape` | `Escape` |
| Move mode | `M` | `M` |
| Move mode for a stack | `Shift`+`M` | `Shift`+`M` |
| Copy | `Ctrl`+`C` | `⌘`+`C` |
| Paste | `Ctrl`+`V` | `⌘`+`V` |
| Cut | `Ctrl`+`X` | `⌘`+`X` |
| Duplicate | `D` | `D` |
| Disconnect block | `X` | `X` |
| Delete | `Delete` or `Backspace` | `Delete` or `Backspace` |
| Screen reader: More block information | `I` | `I` |
| Screen reader: Container block information | `Shift`+`I` | `Shift`+`I` |

</br>
Some actions are also available from the context menu for a block by pressing the ≣ Menu key.


### Move mode

Keyboard controls in move mode:

| Action | Windows | Mac |
|-|-|-|
| Move to positions | Arrow keys | Arrow keys |
| Move anywhere | Hold `Ctrl` and press arrow keys | Hold `Ctrl` and press arrow keys |
| Confirm | `Enter` or `Space` | `Enter` or `Space` |
| Cancel | `Escape` | `Escape` |

</br>

Press `M` to put a single block into move mode or `Shift`+`M` to put a block stack into move mode.

Blocks added from the **Toolbox** are placed on the **Workspace** in move mode:

![Move and dragging blocks](/static/images/accessibility/move-drag-blocks.png)

Press `Enter` to confirm the position OR use arrow keys to move the block to another position and then `Enter` to confirm.

Hold `Ctrl` and arrow keys to move a block around the Workspace (to any position not connected to existing blocks) and then `Enter` to confirm.

## Help messages

Some actions display a helpful pop-up message at the bottom of the **Workspace**. For screen reader users a live region is used.

![Pop-up help message](/static/images/accessibility/popup-help-message.png)

## Tab trapping

### Dialogs

Sometimes MakeCode shows a dialog on top of the editor. When a dialog is displayed, keyboard navigation is restricted to just the elements inside the dialog.

To close a dialog, press the `Escape` key or navigate to the close button (shown as an **X** at the top right or top left corner) and press `Enter` or `Space`.   

### JavaScript and Python editor navigation

These keyboard shortcuts are used in the JavaScript editor:

>By default, pressing `Tab` in the editor will insert the tab character. Toggle this behavior by pressing `Control`+`M` on **Windows** or `Control`+`Shift`+`M` on **Mac**. In order to jump to the toolbox from the editor. Press `Control`+`Alt`+`T` on **Windows** or `⌘`+`Alt`+`T` on **Mac**.

## Drop-down menu

When navigating through the editor with the keyboard, focus is shown with a blue outline around the interactive element. When a contextual menu opens, the `Top` and `Bottom` arrow keys navigate into, through, and out of the menu. The `Enter` or `Space` keys validate the selection. Pressing `Tab` or `Shift`+`Tab` moves to the next or previous interactive element outside of the current drop-down menu.

![Context menu](/static/images/accessibility/accessibility-context-menu.png)

## Documentation

The **documentation** for Microsoft MakeCode is also accessible. Just like on the main editor page, a **hidden menu** is available to access some shortcuts, such as jumping to the main content of the page.

The side bar menu is accessible with the `Tab` key. Some menu items are cascading (a hierarchical view is shown with an arrow on the side of the menu item):

![Tree view](/static/images/accessibility/accessibility-documentation-treeview.png)

Use the Left or Right arrow keys to expand or collapse menu items.

## Immersive reader

Some MakeCode editors will have an option to use the [Microsoft Immersive Reader](https://education.microsoft.com/en-us/resource/9b010288) when certain text is displayed. The Immersive Reader is a tool to help with reading comprehension. It adds the ability to change colors, themes, font size, spacing, and highlight parts of speech. Along with its other capabilities, it will also read the text aloud. When available, the **Immersive Reader** icon appears near instructions or other information it will read.

![Immersive reader button](/static/images/accessibility/immersive-reader-button.jpg)

The Immersive Reader opens in a separate window to show and read the text.

![Immersive reader](/static/images/accessibility/immersive-reader.jpg)

## MakeCode Arcade and the Immersive Reader

The [MakeCode Arcade](https://arcade.makecode.com/) editor has the Immersive Reader available when displaying tutorial instructions.

## Screen readers

Screen reader access for the micro:bit MakeCode block editor was added in summer 2026. Users can also use screen readers with the Javascript or Python editors. 

Several screen readers are available to help to use MakeCode.

### JAWS (Job Access With Speech) Screen Reader

[JAWS](http://www.freedomscientific.com/Products/Blindness/JAWS) is a popular commercial screen reader for Windows.

[`|Download JAWS|`](http://www.freedomscientific.com/Downloads/JAWS)

### NVDA (NonVisual Desktop Access)

[NVDA](https://www.nvaccess.org/) is a free screen reader for Windows.

[`|Download NVDA|`](https://www.nvaccess.org/download/)

### Narrator

Narrator is the built-in screen reader that is part of Windows. To start Narrator:

>Press the `Windows` key to open the **Start Menu**, type "Narrator", and press Enter.

>– OR –

>Use the **Ease Of Access** section in the Windows settings. Set **Narrator** to **On**.

With Windows Narrator you need to turn scan mode off to use the MakeCode Blocks editor. To turn scan mode on or off, press your screen reader key (usually Insert or `Caps Lock`) and `Spacebar`. 


### Voice Over

Voice Over is the built-in screen reader provided with the Mac. To start Voice Over:

>Press the `⌘`+`F5` keys.

>– OR –

>Use the Universal Access pane of System Preferences.

### ChomeVox

ChromeVox is the built-in screen reader for ChromeOS. To start ChromeVox:

>Press `Ctrl+Alt+Z`

## Blocks editor with a screen reader

In the MakeCode Blocks editor, press Tab to reach ‘Skip to Blocks Workspace’ and then `Enter`.

Windows Narrator users may need to press their Narrator screen reader key (usually `Caps Lock` or `Insert`) and `Space` to turn scan mode off.

To enable screen reader mode press `Control+Alt+Z` on **Windows** or `⌘+Alt+Z` on **Mac**. Screen reader mode includes hard stops instead of wrapping when navigating blocks and beeps when changing container nesting levels. 

Screen reader users can use the keyboard controls to navigate MakeCode including the Blocks workspace.

The following additional commands are available for screen reader users:

| Action | Windows | Mac |
|-|-|-|
| Screen reader mode on or off | `Ctrl+Alt+Z` | `⌘+Alt+Z` |
| Screen reader: More block information | `I` | `I` |
| Screen reader: Container block information | `Shift+I` | `Shift+I` |
  
### Live regions

Some announcements are made to an ARIA live region including: toast notifications, simulator status and move mode status. 

## Zoom and responsive layout

MakeCode editors feature responsive, adaptive layouts that work at high levels of zoom, remaining usable at zoom levels of at least 200% and beyond. Different areas of the interface will automatically reflow and collapse to allow continued access to all areas. 

![Zoom size 1](/static/images/accessibility/zoom1.png)
_Zoom level 1_

![Zoom size 2](/static/images/accessibility/zoom2.png)
_Zoom level 2_

![Zoom size 3](/static/images/accessibility/zoom3.png)
_Zoom level 3_

## High Contrast

The high contrast helps people to locate and distinguish between the different visual elements in the MakeCode editor. This is enabled by each MakeCode target with its own use of color and contrast. So, a high contrast view and dark view are not always available in every instance of a MakeCode editor (partner editions).

Where they are available, these modes are available even when the operating system configuration hasn’t enabled it. If available, in MakeCode, `Tab` to the **Settings** menu and choose **Theme** then choose from the available options.

![Settings menu choosing theme](/static/images/accessibility/settings-menu-theme.png)

![Theme choices](/static/images/accessibility/theme-choices.png)
    
## JavaScript and Python editors

Read more about accessibility for the JavaScript or Python editor (keyboard navigation, screen readers and high contrast) in the [Monaco Editor Accessibility Guide](https://github.com/microsoft/monaco-editor/wiki/Monaco-Editor-Accessibility-Guide).

## Accessibility guidance for specific editors

Some MakeCode editors have more detailed accessibility information and guidance specific to its own platform.

For MakeCode for the micro:bit, please visit [Micro:bit Educational Foundation’s MakeCode Accessibility](https://microbit.org/accessibility/microsoft-makecode/) support page for videos and a downloadable resources to help you learn how to use keyboard controls and other accessibility features.

