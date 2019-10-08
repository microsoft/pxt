# Translations in Context

Last week, we were lucky to meet plenty of MakeCode users at [micro:bit live](https://www.microbit.org/en/2019-04-12-microbit-live/). 
With many participants from non-English speaking languages, it reminded has important it is to localize the editors. 
Unfortunately, they also reminded us that translation was not as smooth as can be. 

MakeCode uses [Crowdin](https://crowdin.com/) to manage the localization of all content, APIs and documentation. With so much content,
it can be very tricky to find which strings to translate first.

To address the issues above, **we have added [in context translations](https://support.crowdin.com/in-context-localization/)** which allow to perform the translations from within the editor itself (or the documentation page). No need to go through the Crowdin web site anymore.

https://youtu.be/OugXfqhWUQo

## Documentation translation

In the documentation page, click on the **Translate this page** in the footer (you can try to translate this blog post).

![Link to enable translation mode in the documentation](/static/blog/translations-in-context/docsbutton.png)

Each piece of text that can be translated will have a colored border and an icon to edit the translation.
Red border means no translation, blue translation but not validated, green validated translation.

![A paragraph of text translated using Crowdin](/static/blog/translations-in-context/docstr.png)

## Editor translation

To enter the translation mode in the editor, go the gearwheel menu, click **Languages** then the **Translate the editor** button at the bottom.

![Button in language dialog](/static/blog/translations-in-context/translatebutton.png)

The in context translations mostly work the same as a documentation page. For user interface elements, simply click on the icon to translate them.

![An example of incontext translations](/static/blog/translations-in-context/home.png)

For blocks, go to the context menu
and click **Translate this bloc**

![](/static/blog/translations-in-context/contextmenu.png)

You will be prompted with a dialog that contains the block translatable string.

![](/static/blog/translations-in-context/block.png)

## Roll-out

The in-context translations are available in the beta of these editors.

* `/beta` version of [micro:bit editor](https://makecode.microbit.org/beta)
* `/beta` version of [MakeCode Arcade](https://arcade.makecode.com/beta)
* `/beta` version of [Adafruit Circuit Playground Express](https://makecode.adafruit.com/beta)
* The [Maker Editor](https://maker.makecode.com)

## Feedback?

Drop us a note in the MakeCode forums at https://forum.makecode.com 
