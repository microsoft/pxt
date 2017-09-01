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