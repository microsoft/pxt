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
        attachPowerOnRight?: boolean,
        onboardComponents?: string[]
        useCrocClips?: boolean,
        marginWhenBreadboarding?: [number, number, number, number],
        spiPins?: {
            MOSI: string,
            MISO: string,
            SCK: string,
        },
        i2cPins?: {
            SDA: string,
            SCL: string,
        },
        analogInPins?: string[] //TODO: implement allocation
    }
```