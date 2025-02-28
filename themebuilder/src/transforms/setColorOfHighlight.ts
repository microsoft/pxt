import { stateAndDispatch } from "../state";
import { setHighlightColor } from "../state/actions";
import { Color } from "../types/color";

export function setColorOfHighlight(color: string) {
    const { dispatch } = stateAndDispatch();

    const parsedColor = new Color(color);
    const foreground = parsedColor.isDarkColor() ? "#ffffff" : "#000000";

    dispatch(setHighlightColor(foreground, color));
}
