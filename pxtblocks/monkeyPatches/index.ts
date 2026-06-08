import { monkeyPatchBlockSvg } from "./blockSvg";
import { monkeyPatchConnection } from "./connection";
import { monkeyPatchGesture, monkeyPatchShadowDragTargetBlock } from "./gesture";
import { monkeyPatchGrid } from "./grid";
import { monkeyPatchAddKeyMapping } from "./shortcut_registry";

export function applyMonkeyPatches() {
    monkeyPatchBlockSvg();
    monkeyPatchGrid();
    monkeyPatchGesture();
    monkeyPatchShadowDragTargetBlock();
    monkeyPatchAddKeyMapping();
    monkeyPatchConnection();
}
