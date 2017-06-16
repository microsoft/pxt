#  Board Definition

TBD

```typescript
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