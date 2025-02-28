import { ModalOptions } from "../types/modalOptions";

// Changes to app state are performed by dispatching actions to the reducer
type ActionBase = {
    type: string;
};

/**
 * Actions
 */
type SetTargetConfig = ActionBase & {
    type: "SET_TARGET_CONFIG";
    config: pxt.TargetConfig;
};

type SetFrameTheme = ActionBase & {
    type: "SET_FRAME_THEME";
    theme: pxt.ColorThemeInfo;
};

type SetEditingTheme = ActionBase & {
    type: "SET_EDITING_THEME";
    theme: pxt.ColorThemeInfo;
}

type SetColorsToHighlight = ActionBase & {
    type: "SET_COLORS_TO_HIGHLIGHT";
    colors: string[];
};

type SetHighlightColor = ActionBase & {
    type: "SET_HIGHLIGHT_COLOR";
    fg: string;
    bg: string;
};

type SetUserProfile = ActionBase & {
    type: "SET_USER_PROFILE";
    profile: pxt.auth.UserProfile;
};

type ClearUserProfile = ActionBase & {
    type: "CLEAR_USER_PROFILE";
};

type HideModal = ActionBase & {
    type: "HIDE_MODAL";
};

type ShowModal = ActionBase & {
    type: "SHOW_MODAL";
    modalOptions: ModalOptions;
};

/**
 * Union of all actions
 */

export type Action =
    | SetTargetConfig
    | SetFrameTheme
    | SetEditingTheme
    | SetColorsToHighlight
    | SetHighlightColor
    | SetUserProfile
    | ClearUserProfile
    | HideModal
    | ShowModal


/**
 * Action creators
 */

const setTargetConfig = (config: pxt.TargetConfig): SetTargetConfig => ({
    type: "SET_TARGET_CONFIG",
    config,
});

const setFrameTheme = (theme: pxt.ColorThemeInfo): SetFrameTheme => ({
    type: "SET_FRAME_THEME",
    theme,
})

const setEditingTheme = (theme: pxt.ColorThemeInfo): SetEditingTheme => ({
    type: "SET_EDITING_THEME",
    theme,
});

const setColorsToHighlight = (colors: string[]): SetColorsToHighlight => ({
    type: "SET_COLORS_TO_HIGHLIGHT",
    colors,
});

const setHighlightColor = (fg: string, bg: string): SetHighlightColor => ({
    type: "SET_HIGHLIGHT_COLOR",
    fg,
    bg
});

const setUserProfile = (profile: pxt.auth.UserProfile): SetUserProfile => ({
    type: "SET_USER_PROFILE",
    profile
});

const clearUserProfile = (): ClearUserProfile => ({
    type: "CLEAR_USER_PROFILE"
});

const hideModal = (): HideModal => ({
    type: "HIDE_MODAL"
});

const showModal = (modalOptions: ModalOptions): ShowModal => ({
    type: "SHOW_MODAL",
    modalOptions,
});

export {
    setTargetConfig,
    setFrameTheme,
    setEditingTheme,
    setColorsToHighlight,
    setHighlightColor,
    setUserProfile,
    clearUserProfile,
    hideModal,
    showModal
};
