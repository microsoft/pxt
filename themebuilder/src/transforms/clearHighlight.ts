import { stateAndDispatch } from "../state";
import { setColorsToHighlight } from "../state/actions";
import { setCurrentFrameTheme } from "./setCurrentFrameTheme";

export function clearHighlight() {
    const { state, dispatch } = stateAndDispatch();
    const { editingTheme } = state;

    // Go back to the editing theme, clearing any discrepancies between it and the iframe theme.
    if (editingTheme) {
        setCurrentFrameTheme(editingTheme);
    }

    dispatch(setColorsToHighlight([]));
}
