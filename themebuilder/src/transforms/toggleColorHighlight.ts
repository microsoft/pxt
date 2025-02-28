import { stateAndDispatch } from "../state";
import { clearHighlight } from "./clearHighlight";
import { highlightColor } from "./highlightColor";


export function toggleColorHighlight(colorId: string) {
    const { state } = stateAndDispatch();
    const { colorsToHighlight } = state;

    const isHighlighted = colorsToHighlight?.includes(colorId);
    if (isHighlighted) {
        clearHighlight();
    } else {
        highlightColor(colorId);
    }
}
