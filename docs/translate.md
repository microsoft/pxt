# Help translate

Microsoft MakeCode supports localized content for both MakeCode web app and target documentation.
The default language is currently always English.

Our translations are managed via Crowdin, a translation management platform. It is free to join
and you can volunteer to translate parts of the web site.

## Crowdin project

The project below contains the resources from https://makecode.com and the menu items of @homeurl@.

* [https://crowdin.com/project/kindscript](https://crowdin.com/project/kindscript)

If you want to help translating the editor, please sign in to Crowdin and send us a translator request.

### ~ hint

Looking to help translate **microbit.org**? Try http://translate.microbit.org/ to help the Microbit Foundation!

### ~

## [Tasks](https://crowdin.com/project/kindscript/tasks)

We have create a [tasks for each language and editor](https://crowdin.com/project/kindscript/tasks) to help navigate the translation system.

* **Common / User Interface / Translation**: translating the menu items, buttons and other common UI elements. Available to **translators** for a given language.
* **Common / User Interface / Proofreading**: proofreading the menu items, buttons and other common UI elements. Available to **proof readers** for a given language.

![UI elements](/static/translationui.png)

* **Minecraft / Blocks+description / Translation**: translating the blocks and block descriptions. Available to **translators** for a given language.
* **Minecraft / Blocks+description / Proofreading**: proofreading translating the blocks and block descriptions. Available to **proof readers** for a given language.

* **micro:bit / Blocks+description / Translation**: translating the blocks and block descriptions. Available to **translators** for a given language.
* **micro:bit / Blocks+description / Proofreading**: proofreading translating the blocks and block descriptions. Available to **proof readers** for a given language.

![UI elements](/static/translationblocks.png)


## Live Translations

All translations are "almost" live from the Crowdin project. Our cloud keeps a cache of the translated strings and updates to the **validated** strings will make it to production. Note that there may be a delay of up to 5 minutes before your changes in Crowdin make it into the "live" view.

## Translating the editor interface

All the editor interface strings, like the "Download" button are in the ``strings.json`` file.

## Translating the blocks and reference documentation

You will find target specific localization files under folders in crowdin. For example, all blocks, reference translations for the **microbit** are under ``/microbit`` , one for the block definition and one for the descriptions:

* ``core-strings.json``: contains the block definitions
* ``core-jsdoc-strings.json``: contains the descriptions

The block definition should be carefully translated using the [block definition syntax](/defining-blocks). 
Open the developer tools and watch the console, PXT wil validate the localized string and flag potential issues.

### Block localization guidance

* Do not capitalize blocks
* Do not translalte ``%variable`` names
* Do not reorder parameters
* Maintain the same structure of ``|`` and ``%variables%``

### Testing block translations

It might be helpful to see what a translated block will look like prior to submitting the translated block string. This is useful in verifying that the format and order of the block string elements appear correctly.

You can do this using a MakeCode editor project with custom blocks. Let's say you're trying to translate the block string for the **agent.transfer()** function:

```
"agent transfer|amount %quantity|from slot %srcSlot|to slot %destinationSlot"
```

The block, in English, looks like:

![Default English block](/static/block-english.png)

To test your translation for the block string, start by following the instructions for adding [custom blocks](https://makecode.microbit.org/blocks/custom) to the project. Then, insert a 'dummy' function (a function that will pretends to be the one you want the translation for) at the bottom of the `custom` namespace.

In this example, we're testing a Korean string for **agent.transfer()**. We've named the function as **transfer** and defined a `blockId` attribute. The `block` attribute contains the Korean string we want to test:

```typescript-ingnore
**
 * Custom blocks
 */
//% weight=100 color=#0fbc11 icon=" "
namespace custom {
    ...

    /*
     * A 'dummy' function to test translation of agent.transfer()
     * @param quantity number of items, eg: 1
     * @param sourceSlot the source slot, eg: 1
     * @param destinationSlot the destination slot, eg: 2
     * 
     */
    //% blockId=custom_transfer block="에이전트가 아이템 옮기기: |%quantity |개|슬롯 %sourceSlot |에서|슬롯 %destinationSlot |로"
    export function transfer(quantity: number, sourceSlot: number, destinationSlot: number): void {

    }
}
```

After reloading the editor in the browser, the new test block for **transfer** appears in the **CUSTOM** category. We can now see what the translation will look like later for the actual block in the target editor.

![Custom Korean block](/static/block-korean.png)

## Translating Target specific strings

The `pxtarget.json` file contains a number of strings which
show up on doc pages (mostly menu items and target name). These strings are uploaded as the ``targetid/target-strings.json`` file in Crowdin and loaded by the editor on demand.

## Translating Documentation

Translation of documentation pages are pulled from crowdin by the cloud backend automatically.
