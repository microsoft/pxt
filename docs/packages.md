# PXT Packages

Packages are PXT's dynamic/static library mechanism for extending a target, such as the
pxt-micro:bit:

* https://github.com/microsoft/pxt-microbit

Here is an example of a simple package that extends the pxt-microbit target 
so that the micro:bit can drive a NeoPixel strip:

* https://github.com/Microsoft/pxt-neopixel

To see how this package is surfaced, visit https://makecode.microbit.org/ and select the "Add Package" option from the gear menu. You will see the package "neopixel" listed in the available options. If you click on it, a new block category named "Neopixel" will be added to the editor. 

In this scenario, PXT dynamically loads the neopixel packages directly from GitHub, compiles it and incorporates it into the web app. Packages also can be bundled with a web app (the analog of static linking). For dynamically loaded packages, targets can provide a white list of approved packages (see [pxtarget.json](/targets/pxtarget)).

# Authoring packages

* [Package getting started guide](/packages/getting-started)
* Pacakge configuration via [pxt.json](/packages/pxtJson) file
* [Package versioning](/packages/versioning)
* [Package approval](/packages/approval)
