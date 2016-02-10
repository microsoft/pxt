namespace rt.state {
    export interface IFont {
        chars: Util.StringMap<number[]>;
    }

    export enum DisplayMode {
        bw,
        greyscale
    }

    export interface IBoard {
        id?: string;

        // display
        image?: number[];
        brigthness?: number;
        displayMode?: DisplayMode
        font?: IFont;

        // buttons    
        buttonsPressed?: boolean[];

        // pins
        P0Touched?: boolean;
        P1Touched?: boolean;
        P2Touched?: boolean;

        // sensors    
        acceleration?: number[];
        heading?: number;
        temperature?: number;
        lightLevel?: number;
    }

    export function createBoard(id?: string): IBoard {
        return {
            id: id || ("b" + Math.random()),
            brigthness: 255,
            displayMode: DisplayMode.bw,
            image: [
                0, 255, 0, 255, 0,
                255, 0, 255, 0, 255,
                255, 0, 0, 0, 255,
                0, 255, 0, 255, 0,
                0, 0, 255, 0, 0,
            ],
            buttonsPressed: [false, false, false],
            acceleration: [0, 0, -1023],
            heading: 90,
            temperature: 21
        }
    }
}