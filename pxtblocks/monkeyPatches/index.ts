import { monkeyPatchBlockSvg } from "./blockSvg";
import { monkeyPatchBlockDragStrategy } from "./block_drag_strategy";
import { monkeyPatchConnection } from "./connection";
import { monkeyPatchFullBlockField } from "./fullBlockField";
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
    monkeyPatchFullBlockField();
    monkeyPatchBlockDragStrategy();
}
