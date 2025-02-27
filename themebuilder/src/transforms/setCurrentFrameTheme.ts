import { sendThemeAsync } from "../services/makecodeEditorService";
import { stateAndDispatch } from "../state";
import { setFrameTheme } from "../state/actions";

export function setCurrentFrameTheme(theme: pxt.ColorThemeInfo) {
    const { dispatch } = stateAndDispatch();

    if (theme) {
        sendThemeAsync(theme);
    }

    dispatch(setFrameTheme(theme));
}
