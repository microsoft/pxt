# Scripts for PXT

## pxt-blockly
In order to debug pxt-blockly in PXT, run the ``scripts/link-pxtblockly.sh`` which will link pxt-blockly under ``built/web/`` and then instead of using index.html to debug, using blockly.html which will using the blockly uncompressed files instead of the bundled files in PXT.

To remove the link, there's a helper script that you can use as well ``scripts/unlink-pxtblockly.sh``