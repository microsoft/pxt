declare namespace pxsim {
    interface PinBlockDefinition {
        x: number,
        y: number,
        labelPosition: "above" | "below";
        labels: string[]
    }
    interface BoardImageDefinition {
        image: string,
        outlineImage?: string,
        width: number,
        height: number,
        pinDist: number,
        pinBlocks: PinBlockDefinition[],
    }
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
    }
    interface FactoryFunctionPinAlloc {
        type: "factoryfunction",
        functionName: string,
        pinArgPositions: number[],
        otherArgPositions?: number[],
    }
    interface PredefinedPinAlloc {
        type: "predefined",
        pins: string[],
    }
    interface AutoPinAlloc {
        type: "auto",
        gpioPinsNeeded: number | number[],
    }
    interface PartVisualDefinition {
        image: string,
        width: number,
        height: number,
        pinDist: number,
        extraColumnOffset?: number,
        firstPin: [number, number],
    }
    interface WireDefinition {
        start: WireLocationDefinition,
        end: WireLocationDefinition,
        color: string,
        assemblyStep: number
    }
    type WireLocationDefinition =
        ["breadboard", string, number] | ["GPIO", number] | "ground" | "threeVolt"

    interface PartDefinition {
        visual: string | PartVisualDefinition,
        breadboardColumnsNeeded: number,
        breadboardStartRow: string,
        wires: WireDefinition[],
        assemblyStep: number,
        pinAllocation: FactoryFunctionPinAlloc | PredefinedPinAlloc | AutoPinAlloc,
    }
}