import { monkeyPatchBlockSvg } from "./blockSvg";
import { monkeyPatchGesture } from "./gesture";
import { monkeyPatchGrid } from "./grid";
import { monkeyPatchAddKeyMapping } from "./shortcut_registry";

export function applyMonkeyPatches() {
    monkeyPatchBlockSvg();
    monkeyPatchGrid();
    monkeyPatchGesture();
    monkeyPatchAddKeyMapping();
}