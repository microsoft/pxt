# MakeCode extensions

Extensions are PXT's dynamic/static library mechanism for extending a target, such as the
pxt-micro:bit:

> [pxt-microbit](https://github.com/microsoft/pxt-microbit)

Here is an example of a simple extension that extends the pxt-microbit target 
so that the micro:bit can drive a NeoPixel strip:

> [pxt-neopixel](https://github.com/Microsoft/pxt-neopixel)

To see how this extension is surfaced, visit https://makecode.microbit.org/ and select the "Extensions" option from the gear menu. You will see the extension "neopixel" listed in the available options. If you click on it, a new block category named "Neopixel" will be added to the editor. 

In this scenario, PXT dynamically loads the neopixel extensions directly from GitHub, compiles it and incorporates it into the web app. Extensions also can be bundled with a web app (the analog of static linking). For dynamically loaded extensions, targets can provide a white list of approved extensions (see [pxtarget.json](/targets/pxtarget#bundleddirs-string-)).

* Got some questions? Join us on our [Community Discord](https://aka.ms/makecodecommunity)!

## Authoring extensions

* [Extension getting started guide](/extensions/getting-started)
* Extension configuration via [pxt.json](/extensions/pxt-json) file
* [Naming conventions](/extensions/naming-conventions)
* [Extension versioning](/extensions/versioning)
* [Extension localization](/extensions/localization)
* [Extension approval](/extensions/approval)
* [GitHub Extension Authoring](/extensions/github-authoring)

## [Editor extensions](/extensions/extensions)

Extensions may provide an optional editor extension. An editor extension is an HTML page that gets loaded inside an iFrame by the editor. It allows to interact with the project or access serial data via messages. These editor extensions are hosted on [GitHub pages](https://pages.github.com/).
