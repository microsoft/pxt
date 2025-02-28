import { stateAndDispatch } from "../state";
import { getDerivedColors } from "../utils/colorUtils";
import { setCurrentEditingTheme } from "./setCurrentEditingTheme";
import { setCurrentFrameTheme } from "./setCurrentFrameTheme";

export function setColorValue(colorId: string, value: string) {
    const { state } = stateAndDispatch();
    const { editingTheme } = state;
    if (!editingTheme) return;

    const allRelatedColors = getDerivedColors(colorId, value, editingTheme.colors);

    // TODO thsparks : do not auto-set derived colors if the user has already set them directly
    // TODO thsparks : perhaps a list of direct-set color ids, then we can clear those and derive again if user wishes to refresh
    // TODO thsparks : or data structure of base -> derived list w/ that info

    const newTheme = { ...editingTheme, colors: { ...editingTheme.colors, ...allRelatedColors } };
    setCurrentFrameTheme(newTheme);
    setCurrentEditingTheme(newTheme);
}
