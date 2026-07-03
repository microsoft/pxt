import * as Blockly from "blockly";
import { assertMethod } from "./util";

/**
 * Fixes delete-area hit testing at non-default zoom. Fixed upstream in
 * commit 9f4f1c1, which is not in the blockly 13.1.0.
 *   Issue: https://github.com/RaspberryPiFoundation/blockly/issues/10095
 *   PR:    https://github.com/RaspberryPiFoundation/blockly/pull/10096
 *
 * Dragger.onDrag/onDragEnd compute the hit-test coordinate once and pass that
 * same Coordinate object to several getDragTarget calls. getDragTarget runs it
 * through wsToScreenCoordinates, whose `coordinate.scale(ws.scale)` mutates the
 * coordinate in place. So the first call scales the shared coordinate by the
 * zoom factor, the next call scales the already-scaled value again, and it
 * lands outside the delete area. At scale 1 the mutation is a no-op, which is
 * why blocks only fail to delete when the workspace is zoomed (pxt zooms by
 * default). The error grows with distance from the workspace origin.
 *
 * Fix: clone the coordinate before the round-trip so successive calls can't
 * corrupt each other. Drop this once we upgrade past blockly 9f4f1c1.
 */
export function monkeyPatchDeleteArea() {
    const proto = Blockly.WorkspaceSvg.prototype as any;
    assertMethod(proto, "getDragTarget");

    proto.getDragTarget = function (
        this: Blockly.WorkspaceSvg,
        point: PointerEvent | Blockly.utils.Coordinate,
    ): Blockly.IDragTarget | null {
        const coordinate =
            point instanceof Blockly.utils.Coordinate
                ? Blockly.utils.svgMath.wsToScreenCoordinates(this, point.clone())
                : new Blockly.utils.Coordinate(point.clientX, point.clientY);
        // dragTargetAreas is private in the .d.ts.
        const areas = (this as any).dragTargetAreas as Array<{
            component: Blockly.IDragTarget;
            clientRect: Blockly.utils.Rect;
        }>;
        for (const area of areas) {
            if (area.clientRect.contains(coordinate.x, coordinate.y)) {
                return area.component;
            }
        }
        return null;
    };
}
