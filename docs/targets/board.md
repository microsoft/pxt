#  Board Definition

The simulator "board" contains the current state of the simulated system. 
It is important to store all the state within the board instance as PXT will reuse the same simulator IFrame for multiple runs.vc0

```typescript-ignore
    interface BoardDefinition {
        visual: BoardImageDefinition | string,
        gpioPinBlocks?: string[][],
        gpioPinMap: { [pin: string]: string },
        groundPins: string[],
        threeVoltPins: string[],
        fiveVoltPins: string[],
        attachPowerOnRight?: boolean,
        onboardComponents?: string[]
        marginWhenBreadboarding?: [number, number, number, number],
        spiPins?: {
            MOSI: string,
            MISO: string,
            SCK: string,
        },
        i2cPins?: {
            SDA: string,
            SCL: string,
        }
    }

    interface BoardImageDefinition {
        image: string,
        outlineImage?: string,
        width: number,
        height: number,
        pinDist: number,
        pinBlocks: PinBlockDefinition[],
        leds?: LEDDefinition[]
    }
```

## Multiple core packages

It is possible to include multiple board definitions within one target.
This is done by using multiple core packages (aka board packages), each corresponding to 
a specific board model.
You just set `"core": true` in `pxt.json` of all the board
packages and include them in `bundleddirs` in `pxtarget.json`.
Make sure you give them unique (within target) `name` properties in `pxt.json`,
especially when you're copying an existing one.

You still have to pick one default in `corepkg` in `pxtarget.json`.

Users can change the board model of a project by adding a corresponding core package.
Any existing core package will be removed.

The second step is setting `simulator.dynamicBoardDefinition` in `pxtarget.json`
to `true`, and including `board.json` and possibly `board.svg` in the 
board packages.

The `board.json` file in board package contains the `BoardDefinition` structure
defined above.
The `visual.image` field would typically contain `pkg://board.svg`, which will be
expanded to data-URI of the `board.svg`. You can also use a URL in `/docs/static`.

Typically, different board will have different pinouts. Look [here at the bottom](/simshim)
about how to handle that.