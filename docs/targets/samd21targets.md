# Creating a SAMD21 MakeCode target

This guide describes the steps to get a SAMD21 based target setup and working.

## Prerequisites

1. Install [Node](https://nodejs.org) (minimum version 5.7) and npm (should come with Node)

2. Install the PXT command line:
```
npm install -g pxt
```

3. Read the [Creating Targets](https://makecode.com/target-creation) docs.

## Step 1: UF2-SAMD21 Bootloader

Create a new pull request in the [UF2-SAMD21](https://github.com/microsoft/uf2-samd21/pulls) bootloader repo to add a config for the board. The [README](https://github.com/microsoft/uf2-samd21/blob/master/README.md) has details on how to create a configuration. You can look at the [generic](https://github.com/microsoft/uf2-samd21/blob/master/boards/generic/board_config.h) config to see an example.

## Step 2: Create a target repo

Clone [pxt-sample](https://github.com/microsoft/pxt-sample) as the base to create your target. Be sure to run `npm install` in this repo.
You can serve the sample editor by running `pxt serve` in the root directory.

## Step 3: Take a look at pxtarget.json

Inside your repo, you will need a `pxtarget.json` file that configures the pxt editor for your target.
See the [pxtarget](/targets/pxtarget) page for documentation on this file and all of the options that are available.

## Step 4: Add the common packages

[pxt-common-packages](https://github.com/microsoft/pxt-common-packages) is the repo where the CODAL code common to all SAMD21 targets lives.
Run `npm install --save pxt-common-packages` inside the target repo (your new target built from pxt-sample) to add it to your target.
If you are developing libraries locally, you can instead clone the pxt-common-packages repo from Github and link it like so: `npm link <path to cloned repo>` (be sure to add it to your `package.json` if you link the package locally).

## Step 5: Setting up the target's libs folder.

The `libs` folder in a target contains the libraries of code that run on the actual device.
Libraries are a combination of C++ and TypeScript (\*.ts) files that define the APIs available in the block and text editors.
To set up your target's `libs` folder, do the following:

### Add the pxt-common-packages "core" library

This step is used to configure the "core" library in pxt-common-packages.
You can also use following steps for any other library you wish to include from pxt-common-packages.

1. Delete the contents of the `libs\core` in the pxt-sample repo.

2. Create a new file named `pxt.json` containing this:
```json
{
    "additionalFilePath": "../../node_modules/pxt-common-packages/libs/core"
}
```

3. With the file path configured, any file that is added to this directory with the same name as a file in the pxt-common-packages core library will override that file. Using this method you can override any of the files in pxt-common-packages.

4. Repeat these steps for the "base" library in pxt-common-packages.

### Add your board's "main" library

1. Inside the `libs` folder, create a directory with the name of your board.
This directory will be the main library for your board and should contain any code that does not belong in pxt-common-packages.
Add a `pxt.json` file to this folder that depends on the "core" library created in the previous step.
See the [pxt.json](https://github.com/microsoft/pxt-adafruit/blob/master/libs/circuit-playground/pxt.json) in the pxt-adafruit circuit-playground library as an example of what this file should look like.

2. Add a file named `config.ts`. This file is used to configure the pinout of the board. See the pxt-adafruit circuit-playground's [config.ts](https://github.com/microsoft/pxt-adafruit/blob/master/libs/circuit-playground/config.ts) for an example.

3. Add another file named `device.d.ts`. This file is used to define the components of the board that will be visible to TypeScript. See the pxt-adafruit circuit-playground's [device.d.ts](https://github.com/Microsoft/pxt-adafruit/blob/master/libs/circuit-playground/device.d.ts) for an example.

4. Be sure to add both `device.d.ts` and `config.ts` to the `pxt.json` you added in step 1.

### Add the "blocksproj" library

Inside the `libs` folder, you need a `blocksproj` lib.
This library contains the default, or "base", project that is initially loaded in the editor when the user starts a new project.
The `main.blocks` file contains the XML definition for the initial blocks of the project. For now, you can leave it as is.
Inside the `pxt.json` of this library, add a dependency for the "main" library created in the last step.

## Step 6: Add the common-sim library

For the pxt simulator to simulate functions defined in C++, equivalent TypeScript versions of the functions are necessary. The npm module for pxt-common-packages includes a "common-sim" file that defines the simulator implementations for all of its APIs. To use common-sim in your target:

1. Inside `sim\public\sim.manifest` add a line with the contents `/sim/common-sim.js` under the `CACHE` section.

2. Inside `sim\public\simulator.html` add a script tag for `/sim/common-sim.js` above the script tag for `/sim/sim.js`.

3. Inside `sim\simulator.ts` add `/// <reference path="../built/common-sim.d.ts"/>` to the top of the file.

4. Inside `sim\simulator.ts` modify the `Board` class to implement the `CommonBoard` interface from common-sim.

## Step 7: Next steps

At this point, you should have a basic target that can generate UF2 files. Check out these next steps to further customize your target.

1. Go to the [theming docs](https://makecode.com/targets/theming) for details on how to customize the look and feel of the editor.

2. Learn how to [define blocks](https://makecode.com/defining-blocks) for your target using comment annotations.

3. Add documentation to your editor. Find out how to write reference and project topics in [markdown](https://makecode.com/writing-docs).
