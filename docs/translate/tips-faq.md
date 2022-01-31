# Tips and FAQ

## Tips and guidance #tips

### Publishing new translations #newtranslations

Once a translation is approved by a proofreader it is published to the "live" website for MakeCode.com or the target editor. There's a scheduled process which checks for new translations in Crowdin and brings them down to the website serving a MakeCode editor. There is a period of delay from when a new translation is approved and when it will appear on the site. This is generally between 10 - 30 minutes.

### Live Translations #livetranslations

To test your changes "live", use the [in context translations](#translations-in-context) feature to fetch the most recent translations available in any language directly from crowdin.

### Tutorials and skillmaps #tutorialtranslations

Tutorials are markdown pages that follow a very specific format. This is so that the tutorial engine can read the individual sections and build a proper list of steps for them. Be aware that there are some macros that are unique to tutorials and you should not translate them. Some of these are:

* ``@fullscreen``
* ``@unplugged``

Tutorial macros begin with the `@` character. These macros will appear as strings along with the other content of the tutorial. Leave the entire string untranslated.

#### Block highlights

The MakeCode markdown format provides "block highlighting" for text. This helps text in tutorial content refer to actual blocks in the Toolbox. When shown in the tutorial content panel, the text is highlighted with the color of the block category it is part of. The format of a block highlight looks like this in Crowdin:

`` ||loops:for|| ``

The first part of the highlight text is the block category, "loops", and the second part after the ":", "for", is the text of the for loop block. Another example is:

`` ||variables:change item by 1|| ``

Here, the block category is "variables" and the rest of the string after ":" is the block text. When you translate, leave the block category "variables" as it is and localize the block text of "change item by 1". The French version of this block highlight might look like:

`` ||variables:modefier item de 1|| ``

When possible, try to make the block text translation closely match the localized text shown for the block in the Toolbox.

### Block localization guidance #blockguidance

* Do not capitalize words in blocks
* Do not translate any ``%variable`` or ``$variable`` names
* Do not reorder parameters
* Maintain the same order and spacing of all ``|`` and ``%variable`` names in the block text
> Note: If the order of the ``%variable`` names reads poorly in the translated language, it's possible change the order if there are no ``|`` symbols and you use ``$`` instead of ``%`` as a prefix for the variable.

## FAQ #faq

Here are answers to some common questions about localization and translation in Crowdin.

### Do I translate those names with special characters in the block strings?

No, leave the words connected to `$`, `%`, `=`, etc. untranslated. These are parameter names and need to remain as they are. Also, the `|` is a separator character and is NOT translated. In this example, two untranslated strings in Crowdin appear like this:

```
serial|redirect to|TX %tx|RX %rx|at baud rate %rate
serial set rx buffer size to $size
serial|write buffer %buffer=serial_readbuffer
```

Here, you can translate `serial`, `redirect to`, `set`, `buffer`, `write`, `size`, and `to`.

The words `%tx`, `%rx`, `%rate` `$size`, and `%buffer=serialbuffer` stay the same and are NOT translated.

### What about the text inside the '{ }'

The text inside `{ }` such as `{0:s}` and `{id:name}` is left alone and NOT translated.
