import { monkeyPatchBlockSvg } from "./blockSvg";
import { monkeyPatchGrid } from "./grid";

export function applyMonkeyPatches() {
    monkeyPatchBlockSvg();
    monkeyPatchGrid();
}