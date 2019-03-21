declare namespace pxsim {
    // ----- board definition
    interface PinBlockDefinition {
        x: number,
        y: number,
        labelPosition?: "above" | "below";
        labels: string[]
    }
    interface BoxDefinition {
        x: number;
        y: number;
        w?: number;
        h?: number;
    }
    interface LEDDefinition extends BoxDefinition {
        color: string;
        label: string;
    }
    interface TouchPadDefinition extends BoxDefinition {
        label: string; // pin name
    }
    interface ButtonDefinition extends BoxDefinition {
        index?: number; // by button index
        label?: string; // pin name
    }
    interface BoardImageDefinition {
        image: string,
        outlineImage?: string,
        width: number,
        height: number,
        pinDist: number,
        pinBlocks: PinBlockDefinition[],
        buttons?: ButtonDefinition[];
        touchPads?: TouchPadDefinition[];
        leds?: LEDDefinition[];
        reset?: BoxDefinition;
        useCrocClips?: boolean;
    }
    interface BoardDefinition {
        id?: string, // optional board id (set to the package id, multiboard only)
        boardName?: string, // friendly board name (multiboard only)
        driveDisplayName?: string, // drive name (multiboard only)
        visual: BoardImageDefinition | string,
        gpioPinBlocks?: string[][], // not used
        gpioPinMap: { [pin: string]: string },
        groundPins: string[],
        threeVoltPins?: string[],
        fiveVoltPins?: string[],
        attachPowerOnRight?: boolean,
        onboardComponents?: string[],
        pinStyles?: { [pin: string]: PinStyle },
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
        bootloaderBaudSwitchInfo?: {
            vid: string,
            pid: string,
        };
    }
    // ---- part definition
    export interface PartDefinition {
        // built-in simulator logic name
        simulationBehavior?: string,
        // total number of power + GPIO + other pins
        numberOfPins: number,
        // visual description or built-in visual name
        visual: PartVisualDefinition,
        // metadata for each pin
        pinDefinitions: PartPinDefinition[],
        // description of how part is instantiated
        instantiation?: PartSingletonDefinition | PartFunctionDefinition,
        // description of how part is instantiated
        instantiations?: (PartSingletonDefinition | PartFunctionDefinition)[],
        // list describing number and order of assembly instruction steps; the length is how many steps this part needs
        assembly: AssemblyStepDefinition[],
    }
    export interface PartVisualDefinition {
        // URL to image asset
        image?: string,
        // or name of built-in part visual
        builtIn?: string,
        // description of a parts visual; units don't matter but must be internally consistent
        width: number,
        height: number,
        // the distance between the centers of two adjecent pins; used to scale part for breadboard
        pinDistance: number,
        // the exact centers of each pin; must have as many locations as the "numberOfPins" property
        pinLocations: XY[],
    }
    export type XY = { x: number, y: number }
    export interface PartPinDefinition {
        target: UninstantiatedPinTarget, // e.g.: "ground", "MISO", etc.; see PinType
        style: PinStyle, // e.g.: "male", "female", "solder"; see PinStyle
        orientation: PinOrientation, // e.g.: "+X", "-Z", etc.; see PinOrientation
        colorGroup?: number, // if set, the allocator while try to give pins for this part in the same group the same color
    }
    export type UninstantiatedPinTarget = PinTarget | PinInstantiationIdx;
    export type PinTarget = string;
    /*          "ground"
        | "threeVolt"
        | MicrobitPin
        | SPIPin
        | I2CPin); */
    // a hard-coded pin index; used by parts that are pre-built on the microbit: led matrix, buttons, etc.
    export type MicrobitPin = string;
    /* (
        "P0" | "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8" | "P9"
        | "P10" | "P11" | "P12" | "P13" | "P14" | "P15" | "P16" | "P19" | "P20");*/
    export type SPIPin = "MOSI" | "MISO" | "SCK";
    export type I2CPin = "SDA" | "SCL";
    // the pin style, necessary to know how to attach to the pin
    export type PinStyle = "male" | "female" | "solder" | "croc";
    // orientation along an axis in a right-hand coordinate system where:
    //   -Z is into the breadboard
    //   +X is toward larger breadboard numbers
    //   +Y is toward latter breadboard letters
    export type PinOrientation = "+X" | "-X" | "+Y" | "-Y" | "+Z" | "-Z";
    // instantiation definition for parts where there maybe be at most one
    export type PartSingletonDefinition = {
        kind: "singleton"
    }
    // instantiation definition for parts that are created by a function
    export interface PartFunctionDefinition {
        kind: "function",
        fullyQualifiedName: string, // including namespace
        // if the function has the "trackArgs" annotation, this describes how each tracked
        //  argument is treated during part instantiation
        argumentRoles: ArgumentRole[],
    }
    export interface ArgumentRole {
        // argument is to be passed to the part during initialization.
        //  E.g. NeoPixel uses this to know if the strip is "RGB" or "RGBW" style
        partParameter?: string;
        // argument is a "DigitalPin" enum value that is used as a pin value for this part
        //  E.g. neopixel.create(..)'s first argument is the pin which the NeoPixel is connected to
        pinInstantiationIdx?: number;
    }
    export interface PinInstantiationIdx {
        pinInstantiationIdx: number
    }
    // describes a single step for the assembly instructions
    export interface AssemblyStepDefinition {
        part?: boolean, // if true, the part itself should be assembled during this step
        pinIndices?: number[], // the indices (ranging from 0 to "numberOfPins") of pins that should be wired for this step
    }

    export interface SimulatorMessage {
        type: string;
    }

    // type=debugger
    export interface DebuggerMessage extends SimulatorMessage {
        subtype: string;
        seq?: number;
        req_seq?: number;
    }

    // subtype=config
    export interface DebuggerConfigMessage extends DebuggerMessage {
        setBreakpoints?: number[];
    }

    // subtype=resume
    // subtype=stepover
    // subtype=stepinto

    //
    // Responses from simulator
    //

    // subtype=breakpoint
    export interface DebuggerBreakpointMessage extends DebuggerMessage {
        breakpointId: number;
        globals: Variables;
        stackframes: {
            locals: Variables;
            funcInfo: any; // pxtc.FunctionLocationInfo
            breakpointId: number;
        }[];
        exceptionMessage?: string;
        exceptionStack?: string;
    }

    // subtype=trace
    export interface TraceMessage extends DebuggerMessage {
        breakpointId: number;
    }

    // subtype=traceConfig
    export interface TraceConfigMessage extends DebuggerMessage {
        interval: number;
    }

    export interface DebuggerWarningMessage extends DebuggerMessage {
        message: string;
        breakpointIds: number[];
    }

    export interface Variables {
        [name: string]: any;
    }

    export interface VariablesRequestMessage extends DebuggerMessage {
        variablesReference: string;
        fields?: string[]
    }

    export interface VariablesMessage extends DebuggerMessage {
        variables: Variables;
    }
}