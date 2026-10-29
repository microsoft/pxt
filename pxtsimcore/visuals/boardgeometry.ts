// DOM-free geometry, color and breadboard-layout helpers shared by the allocator and the visuals.
namespace pxsim.visuals {
    export type Coord = [number, number];
    export function findDistSqrd(a: Coord, b: Coord): number {
        let x = a[0] - b[0];
        let y = a[1] - b[1];
        return x * x + y * y;
    }
    export function findClosestCoordIdx(a: Coord, bs: Coord[]): number {
        let dists = bs.map(b => findDistSqrd(a, b));
        let minIdx = dists.reduce((prevIdx, currDist, currIdx, arr) => {
            return currDist < arr[prevIdx] ? currIdx : prevIdx;
        }, 0);
        return minIdx;
    }

    export type WireColor =
        "black" | "white" | "gray" | "purple" | "blue" | "green" | "yellow" | "orange" | "red" | "brown" | "pink";
    export const GPIO_WIRE_COLORS = ["pink", "orange", "yellow", "green", "purple"];
    export const WIRE_COLOR_MAP: Map<string> = {
        black: "#514f4d",
        white: "#fcfdfc",
        gray: "#acabab",
        purple: "#a772a1",
        blue: "#01a6e8",
        green: "#3cce73",
        yellow: "#ece600",
        orange: "#fdb262",
        red: "#f44f43",
        brown: "#c89764",
        pink: "#ff80fa"
    }
    export function mapWireColor(clr: WireColor | string): string {
        return WIRE_COLOR_MAP[clr] || clr;
    }

    // Pin rows and columns
    export const BREADBOARD_MID_ROWS = 10;
    export const BREADBOARD_MID_COLS = 30;

    // Row and column helpers
    const alphabet = "abcdefghij".split("").reverse();
    export function getColumnName(colIdx: number): string { return `${colIdx + 1}` };
    export function getRowName(rowIdx: number): string { return alphabet[rowIdx] };
}
