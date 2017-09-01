# Assistive technologies

This documentation is related to technical points to consider to make your changes accessible with the screen readers.

## Try MakeCode with an assistive technology

You must test MakeCode with several screen readers to be sure that it is accessible on all platforms :
* Voice Over (included to macOS). Please try it with Safari, Chrome and FireFox on macOS.
* [NVDA](https://www.nvaccess.org/) (for Windows). Please try is with Chrome and FireFox.
* Narrator (included to Windows). Please try it with IE and MS Edge.
* [JAWS](http://www.freedomscientific.com/Products/Blindness/JAWS). It is the most used screen reader on Windows and is mainly used with FireFox.

**JAWS is not free to use**. A business license key can be found on Microsoft's internal tools for Microsoft employees.

## What to consider while testing MakeCode

You must be sure that all components are described correctly by the screen readers. There are some differences in the behavior of screen readers such as NVDA or the Narrator depending of how the website is described and which web browser is used. For example, some screen readers read the title attribute of HTML element, while some other do not.

Therefore, the goal is to get something that is globally understandable with any screen reader. It is better to have too many information described by a specific screen reader than not enough on most of them.

To know if MakeCode is enough described by an assistive technology, you must ask yourself this not exhausting list of questions :
* Does the type of component is announced (button, slider, menu, menu item...) ?
* Does the content of the component or its behavior is announced (for example, a Close button has just an icon, which is not a good description for a blind user)?
* After an interaction on a component like a search bar or a slider, does the result or new value is announced?
* Does the component state is announced? For example, a disabled button or expanded menu must be announced.

## Make your changes accessible for screen readers

Several [ARIA](http://www.w3.org/TR/wai-aria-1.1/) markup extension are available to make your changes accessible. You can find below the must useful ones. It is not exhausting, a lot of other attributes exist.

### Role

The ``role`` attribute is used to define what kind of component the user is focusing on. The roles are usually defined with a ``div`` element. A ``button`` or ``section`` element in HTML5 have implicitly a role.

There are a lot of **[roles available](http://www.w3.org/TR/wai-aria/roles)**. Some of them are associated with some other ARIA attributes. For example, a ``treeitem`` allow us to also use the ``aria-expanded`` attribute that defines whether the item is expanded or collapsed. A complete list of roles and their associated ARIA attribute can be found on [this schema](http://www.w3.org/TR/wai-aria/rdf_model.png).

#### Example

```html
<div role="button" onclick="foo()">Click here</div>
<button onclick="foo()">Click here</button>
```

### Aria-label and Aria-labelledby

``Aria-label`` and ``Aria-labelledby`` are designed to define an alternative content or title to an element, which is different from a description (see [Aria-describedby](#aria-describedby)).

There is two ways to define a label. You must never use them both in an element.

* ``Aria-label`` is a simple attribute where we define directly the text that will be read by the assistive technology.
* ``Aria-labelledby`` makes a reference to the **ID** of a **label** element.

#### Example

With **Aria-label**

```html
<div role="button" aria-label="Close"><i icon="closeIcon"></i></div>
```

With **Aria-labelledby**

```html
<label id="closeLabel" class="accessible-hidden">Close</label>
<div role="button" aria-labelledby="closeLabel"><i icon="closeIcon"></i></div>
```

The ``accessible-hidden`` class is part of PXT and can be used to make a label not visible on the screen but still visible for a screen reader (therefore, it will read it).

### Aria-describedby

This attribute is designed to define an additional description of the element. It is usually read a **few seconds after** the ``aria-label`` and the ``role`` by the screen readers.

#### Example

```html
<label id="closeDescription" class="accessible-hidden">Close the dialog and returns to the menu</label>
<div role="button" aria-label="Close" aria-describedby="closeDescription"><i icon="closeIcon"></i></div>
```

The ``accessible-hidden`` class is part of PXT and can be used to make a label not visible on the screen but still visible for a screen reader (therefore, it will read it).

### Aria-hidden

The ``Aria-hidden`` attribute defines whether the element is exposed to the screen reader. it is different from a visibility property that would have an impact on the visual render of the page. Setting ``Aria-hidden`` to true prevent the screen reader to describe the current component.

#### Example

```html
<div role="button" aria-label="Close" aria-hidden="true">This is a visible button that will not be announced by the screen reader as long as aria-hidden is true</div>
```

### Aria-selected and Aria-expanded

Those two attributes are used to define whether an item is selected, expanded or collapse.

``Aria-selected`` will mainly be used when an option in a list in selected for example. ``Aria-expanded`` will be use to say that a tree item or a drop down menu is expanded or collapsed.

#### Example

```html
<div role="menu" aria-expanded="true">
    <div role="listbox">
        <div role="option" aria-selected="true">Option 1</div>
        <div role="option">Option 2</div>
    </div>
</div>
```

### Aria-live

It happens that some content change dynamically after an interaction or an interval of time. ``Aria-live`` can be used to indicates to the screen reader that an element can be refresh at any moment and that the screen reader must announce the changes. It is usefull to announce, for example, the result of a chat, an IRC, an updated chart...

``Aria-live`` can be configured with 3 modes.

| Mode      | Description                                                                                            |
|-----------|--------------------------------------------------------------------------------------------------------|
| off       | Do not announce any change in the element. This is the default value.                                  |
| polite    | Announce the change if the screen reader has nothing else to announce and that the user is not moving. |
| assertive | Announce the change as soon as possible.                                                               |

#### Example

```html
<div role="alert" aria-live="assertive">
    <!-- Dynamic generated content/text to announce -->
</div>
```