import { stateAndDispatch } from "../state";
import { setEditingTheme } from "../state/actions";
import { setCurrentFrameTheme } from "./setCurrentFrameTheme";

export function setCurrentEditingTheme(theme: pxt.ColorThemeInfo) {
    const { dispatch } = stateAndDispatch();

    // Updates to editing theme implicitly update frame theme as well
    setCurrentFrameTheme(theme);

    dispatch(setEditingTheme(theme));
}
