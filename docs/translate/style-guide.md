# MakeCode Crowdin Project Style Guide

There are 4 categories of translatable content in the MakeCode project.

1. **[UI strings](#ui-strings)** - strings for the editor window and its controls, and dialog window text.

2. **[Code block strings](#code-block-strings)** - Text that appears in the graphical blocks that represent code objects.

3. **[jsDoc strings](#jsdoc-strings)** - Help text that describes the purpose, parameters, and return values for the functions and methods of the coding API provided to the user in a target editor.

4. **[Document pages](#document-pages)** - Markdown files which contain reference, user guides, how-to info, course content, lessons, tutorials, skillmaps, technical info, and other documentation.

The MakeCode platform collects it's translatable content and generates files for each of these categories. When changes and additions occur to the code and content in the platform, the content files are updated with the affected strings. Those files are then uploaded to Crowdin and the new string changes are available for translators to work on.

## UI strings

The UI strings are for the text content of window controls, menu items, dialog text, user notifications, and other text info related to interaction with the code editor.

These strings are present in Crowdin as *.json files and are primarily in `strings.json`, `webstrings.json` and `target-strings.json`. Separate features like the Tutorial Tool and the Skillmap system have their own UI content files.

Translating these files is probably the most literal and there are no specific guidelines or rules to follow for them.

## Code block strings

The coding blocks available in the Blocks editor display with a block name and parameters. The names and parameters for these blocks are extracted from the TypeScript code that implements them. They're represented by a single string entry in *.json file that is uploaded to Crowdin. The file has a naming format of `*-strings.json` such as `core-strings.json` or `datalogger-strings.json`. The first part of the file name generally represents the functional group of the blocks represented.

Some blocks will just have a name while others will have a name and one or more parameters. Here's an example of how blocks with their text might appear in a user's program:

![Block strings](/static/translation/style-guide/block-string-example.png)

### Translating block strings with just a name

Translating a block with no parameters is a simple matter of just using the name for the string in the target language.

The **clear screen** block in the above example has the source of `clear screen` in the Crowdin editor. The context Id is `basic.clearScreen|block` which tells you that this is text for the **clear screen** block in the **basic** category.

The Polish translation of this is just a simple string replacement of:

`wyczyść ekran`

### Translating block strings with a parameter

Block strings with a parameter, in addition to the block name string, will include a word or a letter as a parameter name along with a parameter tag prefix. The prefix denotes that the next word (or letter) is a parameter name. The prefix is either a `%` or a `$` symbol. Most often the `%` is used.

The following example shows the text for a "led enable" block with a parameter of "%on".

```led enable %on```

The "on button A pressed" block shown in the example will have a source string in Crowdin formatted like this:

```on button|%NAME|pressed```

The button name of **A** is a parameter in this block and it's selection from a dropdown list in the block. The parameter is shown in the source string and is called `%NAME`.

The translation of the string MUST preserve the orignal name of the parameter, `NAME`, including the parameter tag `%`.

Here's a translated example in German:

```wenn Knopf|%NAME|geklickt```

It's also acceptable to have the parameter occur elsewhere in the string if it translates better into the target language, such as in Spanish:

```al presionarse el botón|%NAME|```

You'll notice that many of the source strings have the vertical bar `|` character in them. This is an indicator to adjust the horizontal spacing when rendering the text for the block. It's best to keep them the in same place for the translated string.

### Translating block strings with multiple parameters

The translation process for block strings with multiple parameters is the same as that for a single parameter except for some special cases.

Going back to the example blocks shown above, the source string for the "plot x y" block is:

```plot|x %x|y %y```

The Japanese for this block string has the expected format which is:

`点灯|x %x|y %y`

#### Reordering parameters

There might be some cases where the translation to the target language makes more sense if the block text and/or parameters are ordered differently. As an example, a the source block string has two parameters in it with `%this` being first and `%pos` being second:

`char from %this|at %pos`

It might translate into Spanish better if the order of the parameters is changed:

`devuelve el carácter de la posición $pos de $this`

To accommodate this, you'll notice that the parameter prefix of `%` is replaced with `$` and the parameters are ordered differently in the translated string. This change in the prefix character is necessary when the source string parameter prefix is `%` and you want to change the order of the parameters in the translated string.

Sometimes you'll encounter a source string with `$` as the parameter prefix. This is valid and you can change the order of the parameters if needed. Be certain to keep the use of the `$` prefix in either case. This string:

`play melody $melody at tempo $tempo|(bpm)`

Translates to this in French:

`jouer la mélodie $melody à $tempo|(bpm)`

Here is a brief list of rules for using parameter prefixes with parameter order.

|Source Parms|Target Parms same order|Target Parms different order|
|-|-|-|
|%a %b %c|%a %b %c|$c $a $b|
|$a $b $c|$a $b $c|$c $a $b|


### Other special source strings

#### Parameter only strings

Occasionally, a source string will contain only a parameter as the whole string. In this case, leave the string untranslated or translated exactly as the source string:

`%name` translates to `%name` as the target string.

#### Value and instance parameters

Some source strings have more complex parameters that contain a preset or an 'instance' name. You must leave these keep them the same in your translated string. Examples of these are:

* `%note=device_note` - preserve the parameter name, equal sign, and value name, as is, in the translation
* `%sprite(myImage)` - preserve the parameter name, parentheses, and instance name, as is, in the translation

#### Id strings

Id strings are often used for representing values in dropdown lists or other value selection methods. They have this format:

`{id:soundexpression}mysterious`

In the case of an Id string, only the part outside of the parenthesis `{x:y}zzz` is translated (only the `zzz`). The Russian translation for this example is:

`{id:soundexpression}таинственный`

## jsDoc strings

The coding blocks will show description tips or "bubbles" when the mouse cursor hovers over the block or a parameter in the block. These description strings are found in files that have a naming format of `*-jsdoc-strings.json` such as `core-jsdoc-strings.json` or `datalogger-jsdoc-strings.json`. The first part of the file name generally represents the functional group of the blocks represented.

### Block descriptions

The text for the block descriptions appears in a text bubble when the mouse cursor hovers over the body of the block image.

![Block description](/static/translation/style-guide/block-desc-example.png)

In the Crowdin editor, you'll see the source string of:

```
Turn on the specified LED using x, y coordinates (x is horizontal, y is vertical). (0,0) is upper left.
```

The context ID for the string will show `led.plot` which means that this if the description for the **plot x y** block in the **led** category.

The Portuguese, Brazilian translation for this description is:

```
Ligar o LED especificado ao utilizar coordenadas x, y (x é horizontal, y é vertical). (0,0) é é a parte superior esquerda.
```

The block rendering with the translated strings:

![Block description pt-br](/static/translation/style-guide/block-desc-ptbr-example.png)

### Block parameters

There are similar strings that are sometimes shown for the block parameters. For the **x** parameter in the **plot x y** block, its source string is:

```
the horizontal coordinate of the LED starting at 0
```

The context Id for this string is `led.plot|param|x` which lets you know that this is the **x** parameter of the **plot** block in the **led** category.

## Document pages

Document pages in Markdown are a mix of free form written content and extra metadata that informs the MakeCode document renderer to do special things. MakeCode uses its own extended Markdown to allow more user interaction with documents. Also, tutorials and skillmaps use Markdown files as the format to script the activities they present.

With these extensions not part of common Markdown, Crowdin doesn't recognize the marks and metadata as formatting and will present them as source to translate. It's important to recognize these extensions and leave them intact, not translating them.

### Code snippets

Crowdin will escape the code snippet block delimiters like ```` ```blocks```` or ```` ```typescript ```` but the actual code will appear as translatable text in the Crowdin editor.

```
basic.forever(function () {
    led.plotBarGraph(
        input.lightLevel(),
        0
    )
    pins.servoWritePin(AnalogPin.P0, input.lightLevel())
})
```

Leave the code from the code snippets untranslated.

### Custom page elements

Some extensions are used for page elements like hint boxes or link buttons. They are denoted by the `~` symbol. As an example, a "hint" box will look like this in the Crowdin editor:

```
~ hint

Title of the hint

The content of the hint is here....
~
```

The title of the hint and the hint text are translated. The hint delimiter start `~ hint` and end `~` remain untranslated.

A page my have other custom elements like a link button which is formatted similar to a hint.

```
~button /projects/rc-car/code

Code for the car
~
```

Just the text for the button, `Code for the car`, is translated.

In general, any word beginning with or the symbol itself, `~` is left untranslated.

### Code Block text highlights

As a way to refer to a block used in the Blocks editor, highlights are placed on text mentioning a block name. This a renders the text in a colored background that matches the color of the block category in the toolbox.

```
||basic:on start||
```

-- or --

```
||radio(noclick):radio send number||
```

With the block highlights, only the text portion to the RIGHT of the `:` is translated. The category name and info to the LEFT of the `:` is untranslated.

The Greek translation for a highlight mentioning the "on start" block is:

```
||basic:στην εκκίνηση||
```

### Attributes for tutorials and skillmaps

Although tutorials and skillmaps aren't displayed as regular document pages, they use Markdown files to contain the content for their activities and control flow. The difference between tutorials/skillmaps and regular Markdown documents pages are the control options and attribute information include in the text.

#### Control options

Options to control the behavior of user interactions are set with option tags that begin with the `@` symbol. The majority of these will appear at the beginning of a line. Some examples of these are:

```
@explicitHints true

@hideIteration true

@diffs true
```

These control options will not work if they're are translated and will affect the behavior of the tutorial/skillmap activites. Leave the control options untranslated.

#### Heading attributes

In some of the headings for activity steps will contain an attribute also starting with the `@` symbol. These will occur at someplace in the string but not at the beginning. In this case, only the word next to the `@` is left untranslated. The other portions of the string are translated. Examples of this are:

```
{Intro @showdialog}
```

-- or --

```
Introduction @showdialog
```

With theses strings, "Intro" and "Introduction" are translated and the rest of the string is left untranslated.


#### Tutorial hint attributes

Tutorial hints, which are coding solutions or examples, are either grouped inside `~hint ... hint~` tags or directly under a single `~tutorialhint` tag.

Within the `~hint` and `hint~` are strings describing how to solve a coding step. This information is translated. The actual tags, `~hint` and `hint~` are left untranslated.

This is an example of text strings within a "hint":

```
~hint What does this do?

---

The ``||hourOfAi:every 5000 ms||`` block will run the code you put inside of it on a specified millisecond (ms) time interval.

hint~
```

The `~tutorialhint` attribute tag indicates that the code directly below it is a coding solution for the activity step. Both the `~tutorialhint` tag and the code following it are left untranslated.
