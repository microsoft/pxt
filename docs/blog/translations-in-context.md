# Translations in Context

Posted on October 8, 2018 by [pelikhan](https://github.com/pelikhan)

Last week, we had the good fortune of meeting plenty of MakeCode users at [micro:bit live](https://www.microbit.org/en/2019-04-12-microbit-live/). 
With many of the participants coming from a non-English speaking background, it reminded me again of how important it is to localize the editors. 
Unfortunately, it was also noted to us that the translation process was not as smooth as could be. 

MakeCode uses [Crowdin](https://crowdin.com/) to manage the localization of all content, APIs, and documentation. With so much content,
it can be very tricky to locate and begin translating the strings we're interested in.

To address the issues just mentioned, **we've added [in context translations](https://support.crowdin.com/in-context-localization/)** which allow translations of the strings from within the editor itself (or in a documentation page). No need to go on to the Crowdin web site anymore and navigate to the proper strings.

https://youtu.be/OugXfqhWUQo

## Documentation translation

In a documentation page, click on the **Translate this page** link in the footer (you can also try to translate this blog post).

![Link to enable translation mode in the documentation](/static/blog/translations-in-context/docsbutton.png)

Each portion of text that is available for translation will have a colored border and an icon to edit the translation. The colored borders mean:

* Red border: the text has no translation
* Blue border: the text has a translation but it isn't validated/approved
* Green border: the text has a valdated/approved translation

![A paragraph of text translated using Crowdin](/static/blog/translations-in-context/docstr.png)

## Editor translation

To enter translation mode in the editor, go the gearwheel menu, click **Languages** and then click the **Translate the editor** button at the bottom.

![Button in language dialog](/static/blog/translations-in-context/translatebutton.png)

The in context translations, for the most part, work the same as for a documentation page. For user interface elements, simply click on the icon to translate them.

![An example of incontext translations](/static/blog/translations-in-context/home.png)

For blocks, go to the context menu and click **Translate this block**.

![Blocks context menu with translate option](/static/blog/translations-in-context/contextmenu.png)

You will be prompted with a dialog that contains the block translatable string.

![Translation dialog](/static/blog/translations-in-context/block.png)

## Roll-out

The in context translations are available in the beta editions of these editors.

* `/beta` version of [micro:bit editor](https://makecode.microbit.org/beta)
* `/beta` version of [MakeCode Arcade](https://arcade.makecode.com/beta)
* `/beta` version of [Adafruit Circuit Playground Express](https://makecode.adafruit.com/beta)
* The [Maker Editor](https://maker.makecode.com)

## Feedback?

Drop us a note in the MakeCode forums at https://forum.makecode.com with any comments.
