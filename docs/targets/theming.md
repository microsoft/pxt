# Theming

PXT uses the [Semantic UI](http://semantic-ui.com/) framework to create the user interface.

## pxtarget.json

The ``pxtarget.json`` contains an extensive customization section to control logos, names, colors, etc...

### Blockly

To Blockly themeing, you can overwrite the default Blockly options by configuring `blocklyOptions` under your target's `appTheme`. 

See [Blockly Configuration](https://developers.google.com/blockly/guides/get-started/web) for a full list of Blockly configurable options.

## Semantic Theming

PXT comes with a default Semantic UI theme. You can however completely override the theme and use all the flexibility of Semantic UI to customize your target.

* copy the ``_theme`` folder from the project to the root of your target, and rename it to ``site``
* customize the variables!

You will most likely be updating the site variables under ``site/globals/site.variables``

From more information on themeing, visit [http://semantic-ui.com/usage/theming.html](http://semantic-ui.com/usage/theming.html)

``pxt serve`` or ``pxt buildtarget`` will automatically rebuild ``semantic.css`` and override the built-in CSS from the app.

## Favicon

Use [realfavicongenerator](http://realfavicongenerator.net/) to generate all the relevant favicon icon files and save them under ``static/icons`` in the ``docs`` folder.