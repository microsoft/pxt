# Translations in context

MakeCode has the capability for [in context translations](https://support.crowdin.com/in-context-localization/). This allows you to perform translations to text content right at the place where you see it in the editor (or in a documentation page).

Here's a video example:

https://youtu.be/OugXfqhWUQo

### ~ hint

#### Trouble signing in with Crowdin?

If you have trouble with signing into the in-context translation page,
you might need to disable ``same site by default cookies``.
Go to **chrome://flags/#same-site-by-default-cookies**
and set the **SameSite by default cookies** to **Disabled** option.

### ~

## Editor translation

To enter translation mode in the editor, go the gearwheel menu, click **Languages** and then click the **Translate the editor** button at the bottom.

![Button in language dialog](/static/blog/translations-in-context/translatebutton.png)

Each portion of text that is available for translation will have a colored border and an icon to edit the translation. The colored borders mean:

* Red border: the text has no translation
* Blue border: the text has a translation but it isn't validated/approved
* Green border: the text has a valdated/approved translation

For user interface elements, simply click on the icon to translate them.

![An example of incontext translations](/static/blog/translations-in-context/home.png)

For blocks, go to the context menu
and click **Translate this block**.

![Blocks context menu with translate option](/static/blog/translations-in-context/contextmenu.png)

You will be prompted with a dialog that contains the block translatable string.

![Translation dialog](/static/blog/translations-in-context/block.png)

## Documentation page translation

When on any documention page, click on the **Language** button
in the footer and then select **Translate this page** in the dialog.
