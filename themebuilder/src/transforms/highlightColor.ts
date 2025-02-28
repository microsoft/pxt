import { stateAndDispatch } from "../state";
import { setColorsToHighlight } from "../state/actions";
import { setCurrentFrameTheme } from "./setCurrentFrameTheme";


export function highlightColor(colorId: string) {
    const { state, dispatch } = stateAndDispatch();
    const { editingTheme, highlightBackground: highlightColor } = state;

    if (editingTheme) {
        const newTheme = { ...editingTheme, colors: { ...editingTheme.colors, [colorId]: highlightColor } };
        setCurrentFrameTheme(newTheme);

        // For now, only support one color highlighted at a time
        dispatch(setColorsToHighlight([colorId]));
    }
}
