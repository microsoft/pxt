# Creating a SAMD21 MakeCode target

## Prerequisites

1. Install Node (minimum version 5.7) and npm (should come with Node)

2. Install the PXT command line:
  ```
  npm install -g pxt
  ```

3. Read the [Creating a Target](https://makecode.com/target-creation) docs.

## Step 1: UF2-SAMD21 Bootloader

Create a PR adding a config for the board to the [UF2-SAMD21](https://github.com/Microsoft/uf2-samd21/) Bootloader repo (see the README of that repo for details).

## Step 2: Configure the pins in pxt-common-packages

The pinouts for boards are defined in the file `libs\core\pins.h` in the [pxt-common-packages](https://github.com/Microsoft/pxt-common-packages) repo.
Create a PR adding a board id and pin definitions in this file.
See `BOARD_ID_METRO` for an example of what that looks like for the Adafruit Metro board.
You can do this locally to start and open a pr later if desired.

## Step 3: Create a target repo

Clone [pxt-sample](https://github.com/Microsoft/pxt-sample) to start.
Be sure to run `npm install` in this repo.
You can serve the sample editor by running `pxt serve` in the root directory.

## Step 4: Take a look at pxtarget.json

Inside your repo, you will need a pxtarget.json file that configures the pxt editor for your target.
Go to https://makecode.com/targets/pxtarget for documentation on this file and all of the options that are available.

## Step 4: Add the common packages

pxt-common-packages is the repo where the common CODAL code shared between targets lives.
Run `npm install --save pxt-common-packages` inside the target repo to add it to your target.
If you are developing libraries locally, you can instead clone the pxt-common-packages repo from Github and link it like so: `npm link <path to cloned repo>` (be sure to add it to your `package.json` if you link the package locally)

## Step 5: Setting up the target's libs folder.

The libs folder in a target contains the libraries of code that run on the actual device.
They are made up of a combination of C++ and Typescript files that define the APIs that are available in the block and text editors.
To set up your target's libs folder, do the following:

### Add the pxt-common-packages "core" library

This step will be used to configure the "core" library in pxt-common-packages.
The following steps 1-4 can also be used for any other library you wish to use from pxt-common-packages.

1. Delete the contents of the `libs\core` in the pxt-sample repo.

2. Copy the `pxt.json` file from `pxt-common-packages\libs\core` into the newly empty directory.

3. Inside the new `pxt.json`, add an additional property that points to the pxt-common-packages core library like so:
        "additionalFilePath": "../../node_modules/pxt-common-packages/libs/core"

4. With the file path configured, any file that is added to this directory with the same name as a file in pxt-common-packages' core library will override that file. Using this method you can override any of the files in pxt-common-packages.

5. Copy the files `devpins.h` and `devpins.cpp` from `pxt-common-packages\libs\core` into `libs\core`. These files are used to configure each pin on the board to be either analog, digital, or PWM. Take a look at [pxt-adafruit](https://github.com/Microsoft/pxt-adafruit/tree/master/libs/core) for an example of what this should look like.

### Add your board's "main" library

Inside the libs folder, create a directory with the name of your board.
This directory will be the main library for your board and should contain any code that does not belong in pxt-common-packages.
Add a `pxt.json` to this file that depends on the "core" library created in the previous step.
See [pxt-adafruit's circuit-playground lib](https://github.com/Microsoft/pxt-adafruit/blob/master/libs/circuit-playground/pxt.json) for an example of what this file should look like.

### Add the "blocksproj" library

Inside the libs folder, there should be a "blocksproj" lib.
This library will be the project that is initially loaded in the editor when the user starts a new project.
The `main.blocks` file contains the XML definition for the initial blocks project. For now, you can leave it as is.
Inside the `pxt.json` of this library, add a dependencyfor the "main" library created in the last step.

## Step 6: Add the common-sim library

For the pxt simulator to simulate functions defined in C++, equivalent TypeScript versions of the functions must be defined. The pxt-common-packages npm module includes a common-sim file that defines the simulator implementations for all of its APIs. To use common-sim in your target:

1. Inside `sim\public\sim.manifest` add a line with the contents `/sim/common-sim.js` under the `CACHE` section.

2. Inside `sim\public\simulator.html` add a script tag for `/sim/common-sim.js` above the script tag for `/sim/sim.js`.

3. Inside `sim\simulator.ts` add `/// <reference path="../built/common-sim.d.ts"/>` to the top of the file.

4. Inside `sim\simulator.ts` modify the `Board` class to implement the `CommonBoard` interface from common-sim.

## Step 7: Next steps

At this point, you should have a basic target that can generate UF2 files.

1. Check out the [theming docs](https://makecode.com/targets/theming) for details on how to customize the looks and feel of the editor.

2. Learn how to [define blocks](https://makecode.com/defining-blocks) for your target using comment annotations.

3. Write documentation and projects for your editor in [markdown](https://makecode.com/writing-docs)
