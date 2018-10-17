# Assistive technologies

Assistive technologies, specifically screen readers, describe to the user what a visual component on a page does and how to interact with it. Here are some points to consider in order to make your page elements accessible by screen readers.

## Try MakeCode with an assistive technology

Test MakeCode with several screen readers to ensure that it is accessible on all platforms:

* **Voice Over** (included with Mac). Test with with Safari, Chrome and FireFox on Mac.
* [NVDA](https://www.nvaccess.org/) (for Windows). Try this with Chrome and FireFox.
* **Narrator** (included with Windows). Check it with IE and Microsoft Edge.
* [JAWS](http://www.freedomscientific.com/Products/Blindness/JAWS). This is the the most widely used screen reader on Windows (primarily with FireFox).

### ~hint

**JAWS is not free to use**. For Microsoft employees, a business license key can be found on Microsoft's internal tools site .
### ~

## What to consider while testing MakeCode

You must ensure that all components are described correctly by the screen readers. There are  differences in behavior between screen readers such as NVDA or the Narrator. They can differ depending on how the web page is described and which web browser is used. For example, some screen readers will read the title attribute of HTML element, while others do not.

The goal is to have something that is globally understandable with any screen reader. It is better to have too much information described by a specific screen reader than not enough by all.

To know if components in MakeCode are described adequately by an assistive technology, see if these questions are satisfied:
* Is the type of component is announced (button, slider, menu, menu item...) ?
* Is the content of the component or its behavior is announced (for example, a Close button has only an icon, which is not a useful description for a visually impaired user)?
* After an interaction on a component, like a search bar or a slider, is the result or new value announced?
* Is the component state is announced? For example, a button being disabled or a menu expanded must be announced.

## Make your elements accessible to screen readers

Several [ARIA](http://www.w3.org/TR/wai-aria-1.1/) markup extensions are available to make your elements accessible. Below are some of the most useful ones. This is not an exhaustive list, many other attributes exist.

### Role

The ``role`` attribute is used to say what kind of component the user is focusing on. The roles are usually defined with a ``div`` element. The ``button`` and ``section`` elements implicitly have a ``role`` in HTML5.

There are a lot of available **[roles](http://www.w3.org/TR/wai-aria/roles)**. Some of them are associated with other ARIA attributes. For example, a ``treeitem`` allows us to also use the ``aria-expanded`` attribute that defines whether the item is expanded or collapsed. A complete list of roles and their associated ARIA attribute can be found in this role [schema](http://www.w3.org/TR/wai-aria/rdf_model.png).

#### Example

```html
<div role="button" onclick="foo()">Click here</div>
<button onclick="foo()">Click here</button>
```

### Aria-label and Aria-labelledby

``Aria-label`` and ``Aria-labelledby`` set some alternative content or title to an element. This is different from a description (see [Aria-describedby](#aria-describedby)).

There are two ways to define a label.

* ``Aria-label`` is a simple attribute to directly set the text that is read by the assistive technology.
* ``Aria-labelledby`` makes a reference to an **ID** of a **label** element.

**NOTE:** Use only one label attribute, never use them both in an element.

#### Example

With **Aria-label**:

```html
<div role="button" aria-label="Close"><i icon="closeIcon"></i></div>
```

With **Aria-labelledby**:

```html
<label id="closeLabel" class="accessible-hidden">Close</label>
<div role="button" aria-labelledby="closeLabel"><i icon="closeIcon"></i></div>
```

The ``accessible-hidden`` class is part of PXT and can be used to make a label hidden on the screen but still visible for a screen reader (therefore, it will read it).

### Aria-describedby

This attribute is used to include an additional description of the element. It is usually read a **few seconds after** the ``aria-label`` and the ``role`` by the screen readers.

#### Example

```html
<label id="closeDescription" class="accessible-hidden">Close the dialog and returns to the menu</label>
<div role="button" aria-label="Close" aria-describedby="closeDescription"><i icon="closeIcon"></i></div>
```

The ``accessible-hidden`` class is part of PXT and can be used to make a label hidden on the screen but still visible for a screen reader (therefore, it will read it).

### Aria-hidden

The ``Aria-hidden`` attribute defines whether or not the element is exposed to the screen reader. This is different from a visibility property that would have an impact on the visual rendering of the element. Setting ``Aria-hidden`` to 'true' prevents the screen reader from describing the current component.

#### Example

```html
<div role="button" aria-label="Close" aria-hidden="true">This is a visible button that will not be announced by the screen reader as long as aria-hidden is true</div>
```

### Aria-selected and Aria-expanded

These attributes are used to define whether an item is selected, expanded or collapsed.

* ``Aria-selected`` Indicates that an item is selected. For example, an option in a list is selected.
* ``Aria-expanded`` Indicates that a tree item or a drop down menu is expanded or collapsed.

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

Some content changes dynamically after an interaction or after an interval of time. ``Aria-live`` is used to indicate to the screen reader that an element can refresh at any moment and that the screen reader must announce the changes. This is useful to announce, for example, the result of a chat, an IRC, an updated chart...

``Aria-live`` is used in one of 3 modes.

| Mode      | Description                                                                                            |
|-----------|--------------------------------------------------------------------------------------------------------|
| off       | Do not announce any change in the element. This is the default value.                                  |
| polite    | Announce the change if the screen reader has nothing else to announce, and, the user is not moving. |
| assertive | Announce the change as soon as possible.                                                               |

#### Example

```html
<div role="alert" aria-live="assertive">
    <!-- Dynamic generated content/text to announce -->
</div>
```