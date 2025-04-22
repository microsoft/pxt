import { monkeyPatchBlockSvg } from "./blockSvg";
import { monkeyPatchGesture } from "./gesture";
import { monkeyPatchGrid } from "./grid";

export function applyMonkeyPatches() {
    monkeyPatchBlockSvg();
    monkeyPatchGrid();
    monkeyPatchGesture();
}